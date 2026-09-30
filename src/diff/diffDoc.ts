import { Node as PMNode } from "prosemirror-model";
import { schema } from "../schema";
import { diffArrays } from "./lcs";
import type { Line, RenderLine } from "./flatten";
import { flattenDoc, lineSignature, rebuildDoc } from "./flatten";
import { isVoidLeaf } from "./schemaConfig";
import type { Run } from "./inlineDiff";
import { diffInline, nextChangeId, resetChangeIdCounter } from "./inlineDiff";

export interface DiffStats {
  insertedLines: number;
  deletedLines: number;
  modifiedLines: number;
  insertedChars: number;
  deletedChars: number;
  formatChanges: number;
}

export interface DiffResult {
  doc: PMNode;
  stats: DiffStats;
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

export function diffDocuments(oldInput: DocInput, newInput: DocInput): DiffResult {
  resetChangeIdCounter();

  const oldDoc = resolveDoc(oldInput);
  const newDoc = resolveDoc(newInput);

  const oldLines = flattenDoc(oldDoc);
  const newLines = flattenDoc(newDoc);

  const rawOps = diffArrays(oldLines, newLines, (a, b) => lineSignature(a) === lineSignature(b) && a.plainText === b.plainText);

  const ops = pairAdjacentReplacements(rawOps);

  const stats: DiffStats = {
    insertedLines: 0,
    deletedLines: 0,
    modifiedLines: 0,
    insertedChars: 0,
    deletedChars: 0,
    formatChanges: 0,
  };

  const renderLines: RenderLine[] = ops.map((op) => toRenderLine(op, stats));
  const doc = rebuildDoc(renderLines);
  return { doc, stats };
}

/**
 * diffArrays() on whole lines only ever emits "equal" | "delete" | "insert".
 * Walk the raw op stream and fold an adjacent (delete-run, insert-run) into
 * "modify" pairs wherever a deleted line and an inserted line occupy the
 * same structural slot (same container path / node type / attrs) — that is
 * the common "this paragraph was edited" case, which we want diffed inline
 * rather than shown as a whole-line delete next to a whole-line insert.
 */
function pairAdjacentReplacements(
  rawOps: ReturnType<typeof diffArrays<Line>>
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
      const subOps = diffArrays(deletes, inserts, (a, b) => lineSignature(a) === lineSignature(b));
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

function toRenderLine(op: LineOp, stats: DiffStats): RenderLine {
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
    const key = marks.map((m) => `${m.type.name}:${JSON.stringify(m.attrs)}`).join("|");
    const last = runs[runs.length - 1] as (Run & { _key?: string }) | undefined;
    if (last && (last as any)._key === key) {
      last.text += unit.ch;
    } else {
      const run: Run & { _key?: string } = { text: unit.ch, marks, _key: key };
      runs.push(run);
    }
  }
  return runs;
}
