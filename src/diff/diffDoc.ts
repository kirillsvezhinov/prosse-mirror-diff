import { Node as PMNode } from "prosemirror-model";
import { schema } from "../schema";
import { diffArrays } from "./myersDiff";
import type { DiffStatus, Line, RenderLine } from "./flatten";
import { flattenDoc, lineSignature, rebuildBlocks, rebuildDoc } from "./flatten";
import { isVoidLeaf } from "./schemaConfig";
import type { Run } from "./inlineDiff";
import { diffInline, nextChangeId, resetChangeIdCounter } from "./inlineDiff";
import { textSimilarity } from "./similarity";

export interface DiffStats {
  insertedLines: number;
  deletedLines: number;
  modifiedLines: number;
  insertedChars: number;
  deletedChars: number;
  formatChanges: number;
}

/**
 * How a deleted line and an inserted line occupying the same run get paired
 * into a "modify" (rather than shown as a separate delete + insert):
 *  - "structural": paired whenever they have the exact same signature
 *    (container path / node type / attrs) — cheap, but blind to content: any
 *    two same-shaped lines in the same slot get merged even if their text is
 *    unrelated.
 *  - "similarity": paired only when their plain text is actually alike
 *    (Dice-coefficient bigram overlap above a threshold) — avoids nonsensical
 *    modify-pairs between unrelated paragraphs, at the cost of one similarity
 *    check per candidate pair.
 */
export type PairingMode = "structural" | "similarity";

const SIMILARITY_THRESHOLD = 0.4;

export interface DiffOptions {
  pairing?: PairingMode;
}

export interface DiffResult {
  doc: PMNode;
  stats: DiffStats;
  durationMs: number;
}

type LineOp =
  | { kind: "equal"; oldLine: Line; newLine: Line }
  | { kind: "modify"; oldLine: Line; newLine: Line }
  | { kind: "delete"; oldLine: Line }
  | { kind: "insert"; newLine: Line };

/** Accepts either a plain PM JSON doc or an already-parsed document node
 * (e.g. straight out of the Markdown parser) — either way the caller says
 * "here's a version of the document", not "here's JSON". */
export type DocInput = PMNode | unknown;

function resolveDoc(input: DocInput): PMNode {
  return input instanceof PMNode ? input : schema.nodeFromJSON(input as any);
}

export function diffDocuments(oldInput: DocInput, newInput: DocInput, options?: DiffOptions): DiffResult {
  const start = performance.now();
  const pairing: PairingMode = options?.pairing ?? "structural";
  resetChangeIdCounter();

  const oldDoc = resolveDoc(oldInput);
  const newDoc = resolveDoc(newInput);

  const stats: DiffStats = {
    insertedLines: 0,
    deletedLines: 0,
    modifiedLines: 0,
    insertedChars: 0,
    deletedChars: 0,
    formatChanges: 0,
  };

  const renderLines = diffBlocks(flattenDoc(oldDoc), flattenDoc(newDoc), pairing, stats);
  const doc = rebuildDoc(renderLines);
  const durationMs = performance.now() - start;
  return { doc, stats, durationMs };
}

/**
 * The core "flatten → line-diff → pair replacements → render" pipeline,
 * factored out so it can run on any block+ content — the whole document, or
 * (recursively) a single table cell's content — the exact same way. `stats`
 * is mutated in place, so a nested call naturally rolls its counts up into
 * the outer, document-level totals.
 */
function diffBlocks(oldLines: Line[], newLines: Line[], pairing: PairingMode, stats: DiffStats): RenderLine[] {
  const rawOps = diffArrays(
    oldLines,
    newLines,
    (a, b) => a.textHash === b.textHash && a.plainText === b.plainText && lineSignature(a) === lineSignature(b)
  );
  const ops = pairAdjacentReplacements(rawOps, pairing);
  return ops.map((op) => toRenderLine(op, stats, pairing));
}

/**
 * diffArrays() on whole lines only ever emits "equal" | "delete" | "insert".
 * Walk the raw op stream and fold an adjacent (delete-run, insert-run) into
 * "modify" pairs wherever a deleted line and an inserted line occupy the
 * same structural slot (same container path / node type / attrs) — that is
 * the common "this paragraph was edited" case, which we want diffed inline
 * rather than shown as a whole-line delete next to a whole-line insert.
 */
function linesMatchForPairing(a: Line, b: Line, pairing: PairingMode): boolean {
  if (pairing === "structural") {
    return lineSignature(a) === lineSignature(b);
  }
  // similarity: still require the same leaf type (a sane inline diff needs
  // compatible content), but replace exact structural-signature equality
  // with "text is actually alike" — this is the fix for the case where two
  // same-shaped, unrelated lines in the same slot would otherwise get forced
  // into a single nonsensical "modify" pair.
  if (a.nodeType !== b.nodeType) return false;
  return textSimilarity(a.plainText, b.plainText) >= SIMILARITY_THRESHOLD;
}

function pairAdjacentReplacements(
  rawOps: ReturnType<typeof diffArrays<Line>>,
  pairing: PairingMode
): LineOp[] {
  const out: LineOp[] = [];
  let i = 0;
  while (i < rawOps.length) {
    const op = rawOps[i];
    if (op.type === "equal") {
      out.push({ kind: "equal", oldLine: op.oldItem, newLine: op.newItem });
      i++;
      continue;
    }
    if (op.type === "delete") {
      let j = i;
      const deletes: Line[] = [];
      while (j < rawOps.length && rawOps[j].type === "delete") {
        deletes.push((rawOps[j] as any).oldItem);
        j++;
      }
      const inserts: Line[] = [];
      let k = j;
      while (k < rawOps.length && rawOps[k].type === "insert") {
        inserts.push((rawOps[k] as any).newItem);
        k++;
      }
      // Re-diff just this (deletes, inserts) run against each other, using
      // "same slot" (path/nodeType/attrs) as the equality test. This is what
      // keeps a leftover pure insert (e.g. a brand new <hr>) in its correct
      // position relative to the modify-pairs around it — a plain greedy
      // "find any matching insert" search would instead push every matched
      // pair first and strand unmatched inserts at the end of the run.
      const subOps = diffArrays(deletes, inserts, (a, b) => linesMatchForPairing(a, b, pairing));
      for (const s of subOps) {
        if (s.type === "equal") out.push({ kind: "modify", oldLine: s.oldItem, newLine: s.newItem });
        else if (s.type === "delete") out.push({ kind: "delete", oldLine: s.oldItem });
        else out.push({ kind: "insert", newLine: s.newItem });
      }
      i = k;
      continue;
    }
    // pure insert run with no preceding delete
    out.push({ kind: "insert", newLine: op.newItem });
    i++;
  }
  return out;
}

function lineOpNodeType(op: LineOp): Line["nodeType"] {
  return op.kind === "delete" ? op.oldLine.nodeType : op.kind === "insert" ? op.newLine.nodeType : op.newLine.nodeType;
}

function toRenderLine(op: LineOp, stats: DiffStats, pairing: PairingMode): RenderLine {
  if (lineOpNodeType(op) === "table") return toRenderTableLine(op, stats, pairing);

  if (op.kind === "delete") {
    const runs = wholeLineRuns(op.oldLine, "delete");
    stats.deletedLines++;
    stats.deletedChars += op.oldLine.plainText.length;
    return {
      path: op.oldLine.path,
      containerAttrs: op.oldLine.containerAttrs,
      nodeType: op.oldLine.nodeType,
      attrs: op.oldLine.attrs,
      runs,
      diffStatus: "deleted",
    };
  }
  if (op.kind === "insert") {
    const runs = wholeLineRuns(op.newLine, "insert");
    stats.insertedLines++;
    stats.insertedChars += op.newLine.plainText.length;
    return {
      path: op.newLine.path,
      containerAttrs: op.newLine.containerAttrs,
      nodeType: op.newLine.nodeType,
      attrs: op.newLine.attrs,
      runs,
      diffStatus: "inserted",
    };
  }

  // equal or modify: always run inline diff, since a line-level "equal" match
  // only guarantees identical plain text, not identical marks.
  if (isVoidLeaf(op.oldLine.nodeType)) {
    return {
      path: op.newLine.path,
      containerAttrs: op.newLine.containerAttrs,
      nodeType: op.newLine.nodeType,
      attrs: op.newLine.attrs,
      runs: [],
      diffStatus: null,
    };
  }

  const { runs, changed } = diffInline(op.oldLine.chars, op.newLine.chars);
  if (changed) {
    stats.modifiedLines++;
    for (const r of runs) {
      const hasInsert = r.marks.some((m) => m.type.name === "diffInsert");
      const hasDelete = r.marks.some((m) => m.type.name === "diffDelete");
      const hasFormat = r.marks.some((m) => m.type.name === "diffFormat");
      if (hasInsert) stats.insertedChars += r.text.length;
      if (hasDelete) stats.deletedChars += r.text.length;
      if (hasFormat) stats.formatChanges++;
    }
  }
  return {
    path: op.newLine.path,
    containerAttrs: op.newLine.containerAttrs,
    nodeType: op.newLine.nodeType,
    attrs: op.newLine.attrs,
    runs,
    diffStatus: changed ? "modified" : null,
  };
}

function wholeLineRuns(line: Line, kind: "insert" | "delete"): Run[] {
  if (!line.chars.length) return [];
  const changeId = nextChangeId();
  const markFactory = kind === "insert" ? schema.marks.diffInsert : schema.marks.diffDelete;
  const diffMark = markFactory.create({ changeId });
  // Group consecutive chars that share the exact same underlying content marks
  // into single text runs (still each individually wrapped in the diff mark).
  const runs: Run[] = [];
  for (const unit of line.chars) {
    const marks = [diffMark, ...unit.marks];
    if (unit.node) {
      runs.push({ text: "", node: unit.node, marks });
      continue;
    }
    const key = marks.map((m) => `${m.type.name}:${JSON.stringify(m.attrs)}`).join("|");
    const last = runs[runs.length - 1] as (Run & { _key?: string }) | undefined;
    if (last && (last as any)._key === key && !last.node) {
      last.text += unit.ch;
    } else {
      const run: Run & { _key?: string } = { text: unit.ch, marks, _key: key };
      runs.push(run);
    }
  }
  return runs;
}

/**
 * `table` is registered as a "structuredText" leaf (see schemaConfig.ts), so
 * it never goes through the normal per-character inline diff — its "text" is
 * a whole grid of cells, not a run of characters. Instead:
 *  - a table that's purely deleted/inserted is rebuilt as-is with diffStatus
 *    set on the table itself (same block-level tint as any other leaf).
 *  - a table paired as "equal"/"modify" gets its *rows* LCS-diffed (same
 *    equal/delete/insert + adjacent-replacement-pairing shape as top-level
 *    lines, just scoped to one table's rows) — so a genuinely added/removed
 *    row shows as just that one row tinted, not the whole table replaced.
 *    A matched row pair whose *cell* shape doesn't line up (only reachable
 *    under "similarity" row-pairing, which doesn't check shape) falls back
 *    to an opaque delete+insert for that one row.
 */
function toRenderTableLine(op: LineOp, stats: DiffStats, pairing: PairingMode): RenderLine {
  if (op.kind === "delete" || op.kind === "insert") {
    const line = op.kind === "delete" ? op.oldLine : op.newLine;
    const diffStatus: DiffStatus = op.kind === "delete" ? "deleted" : "inserted";
    if (op.kind === "delete") {
      stats.deletedLines++;
      stats.deletedChars += line.plainText.length;
    } else {
      stats.insertedLines++;
      stats.insertedChars += line.plainText.length;
    }
    const node = line.node!;
    return {
      path: line.path,
      containerAttrs: line.containerAttrs,
      nodeType: line.nodeType,
      attrs: line.attrs,
      runs: [],
      diffStatus,
      prebuiltNode: node.type.create({ ...node.attrs, diffStatus }, node.content, node.marks),
    };
  }

  const oldTable = op.oldLine.node!;
  const newTable = op.newLine.node!;
  const oldRows: PMNode[] = [];
  oldTable.forEach((r) => oldRows.push(r));
  const newRows: PMNode[] = [];
  newTable.forEach((r) => newRows.push(r));

  const rawRowOps = diffArrays(oldRows, newRows, (a, b) => a.textContent === b.textContent && sameRowShape(a, b));
  const rowOps = pairTableRows(rawRowOps);

  let tableChanged = false;
  const rebuiltRows = rowOps.flatMap((rowOp) => renderTableRow(rowOp, stats, pairing, () => (tableChanged = true)));

  const diffStatus: DiffStatus = tableChanged ? "modified" : null;
  return {
    path: op.newLine.path,
    containerAttrs: op.newLine.containerAttrs,
    nodeType: op.newLine.nodeType,
    attrs: op.newLine.attrs,
    runs: [],
    diffStatus,
    prebuiltNode: newTable.type.create({ ...newTable.attrs, diffStatus }, rebuiltRows, newTable.marks),
  };
}

type RowOp =
  | { kind: "equal"; oldRow: PMNode; newRow: PMNode }
  | { kind: "modify"; oldRow: PMNode; newRow: PMNode }
  | { kind: "delete"; oldRow: PMNode }
  | { kind: "insert"; newRow: PMNode };

/** (type, colspan, rowspan) per cell in a row — not cell *content*, that's
 * what the cell-content diffBlocks() call handles once a row pair is
 * confirmed cell-compatible. */
function rowCellShape(row: PMNode): unknown[] {
  const cells: unknown[] = [];
  row.forEach((cell) => cells.push({ type: cell.type.name, colspan: cell.attrs.colspan ?? 1, rowspan: cell.attrs.rowspan ?? 1 }));
  return cells;
}

function sameRowShape(a: PMNode, b: PMNode): boolean {
  return JSON.stringify(rowCellShape(a)) === JSON.stringify(rowCellShape(b));
}

/**
 * Deliberately NOT split by "structural vs. similarity" the way
 * linesMatchForPairing() is — always requires content similarity, regardless
 * of the document-wide pairing mode. Structural pairing's "ignore content,
 * pair by shape alone" philosophy makes sense for block-level content, where
 * node type (paragraph vs. heading vs. ...) is itself a meaningful signal;
 * for table rows it degenerates to "pair by position only", because every
 * row in a real table almost always shares the exact same cell shape. Left
 * unconditional, a deleted row and an unrelated inserted row of the same
 * shape (the common case) would get force-paired into a nonsensical
 * character-level "modify" instead of showing as a clean delete + insert.
 */
function rowsMatchForPairing(a: PMNode, b: PMNode): boolean {
  return sameRowShape(a, b) && textSimilarity(a.textContent, b.textContent) >= SIMILARITY_THRESHOLD;
}

/** Mirrors pairAdjacentReplacements() (fold an adjacent delete-run/insert-run
 * into "modify" pairs) but over table rows — kept separate rather than
 * generalizing the two, since the two operate on different item shapes
 * (Line vs. PMNode) and unifying them would mean reworking the already-
 * exercised top-level pipeline's field names for marginal gain. */
function pairTableRows(rawOps: ReturnType<typeof diffArrays<PMNode>>): RowOp[] {
  const out: RowOp[] = [];
  let i = 0;
  while (i < rawOps.length) {
    const op = rawOps[i];
    if (op.type === "equal") {
      out.push({ kind: "equal", oldRow: op.oldItem, newRow: op.newItem });
      i++;
      continue;
    }
    if (op.type === "delete") {
      let j = i;
      const deletes: PMNode[] = [];
      while (j < rawOps.length && rawOps[j].type === "delete") {
        deletes.push((rawOps[j] as any).oldItem);
        j++;
      }
      const inserts: PMNode[] = [];
      let k = j;
      while (k < rawOps.length && rawOps[k].type === "insert") {
        inserts.push((rawOps[k] as any).newItem);
        k++;
      }
      const subOps = diffArrays(deletes, inserts, rowsMatchForPairing);
      for (const s of subOps) {
        if (s.type === "equal") out.push({ kind: "modify", oldRow: s.oldItem, newRow: s.newItem });
        else if (s.type === "delete") out.push({ kind: "delete", oldRow: s.oldItem });
        else out.push({ kind: "insert", newRow: s.newItem });
      }
      i = k;
      continue;
    }
    out.push({ kind: "insert", newRow: op.newItem });
    i++;
  }
  return out;
}

function renderTableRow(op: RowOp, stats: DiffStats, pairing: PairingMode, markChanged: () => void): PMNode[] {
  if (op.kind === "delete" || op.kind === "insert") {
    const row = op.kind === "delete" ? op.oldRow : op.newRow;
    const diffStatus: DiffStatus = op.kind === "delete" ? "deleted" : "inserted";
    if (op.kind === "delete") {
      stats.deletedLines++;
      stats.deletedChars += row.textContent.length;
    } else {
      stats.insertedLines++;
      stats.insertedChars += row.textContent.length;
    }
    markChanged();
    return [row.type.create({ ...row.attrs, diffStatus }, row.content, row.marks)];
  }

  // "equal" and "modify" rows are both only ever produced (see the raw row
  // LCS above and rowsMatchForPairing()) when the cell shape already
  // matches, so a cell-by-index zip is always safe here.
  const oldCells: PMNode[] = [];
  op.oldRow.forEach((c) => oldCells.push(c));
  const newCells: PMNode[] = [];
  op.newRow.forEach((c) => newCells.push(c));

  let rowChanged = false;
  const rebuiltCells = newCells.map((newCell, cellIndex) => {
    const oldCell = oldCells[cellIndex];
    const cellRenderLines = diffBlocks(flattenDoc(oldCell), flattenDoc(newCell), pairing, stats);
    if (cellRenderLines.some((l) => l.diffStatus !== null)) rowChanged = true;
    const content = rebuildBlocks(cellRenderLines, 0);
    return newCell.type.create(newCell.attrs, content.length ? content : [schema.nodes.paragraph.create()], newCell.marks);
  });

  if (rowChanged) {
    stats.modifiedLines++;
    markChanged();
  }
  const rowDiffStatus: DiffStatus = rowChanged ? "modified" : null;
  return [op.newRow.type.create({ ...op.newRow.attrs, diffStatus: rowDiffStatus }, rebuiltCells, op.newRow.marks)];
}
