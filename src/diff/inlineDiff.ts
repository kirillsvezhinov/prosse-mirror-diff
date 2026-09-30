import { Mark, Node as PMNode } from "prosemirror-model";
import { schema } from "../schema";
import { diffArrays } from "./myersDiff";

/** Object Replacement Character — the standard Unicode placeholder for "one
 * non-text thing sits here". Used as the `ch` for an atomic inline node
 * (image, ...) so the char-level LCS/Myers alignment has something to key
 * on positionally; the actual node travels alongside in `node` and is what
 * actually gets rendered — `ch` is never emitted into real output. */
const ATOMIC_PLACEHOLDER = "￼";

export interface CharUnit {
  ch: string;
  marks: readonly Mark[];
  /** Set when this unit represents a whole atomic inline node (image, ...)
   * rather than one text character. `ch` is then ATOMIC_PLACEHOLDER and the
   * unit must be treated as indivisible: never split, never merged with a
   * neighbor even if marks happen to match. */
  node?: PMNode;
}

export interface Run {
  text: string;
  marks: Mark[];
  /** Set when this run is a single atomic inline node rather than text —
   * consumers must render `node` (re-created with `marks`) instead of
   * `schema.text(text, marks)`; `text` is "" in that case. */
  node?: PMNode;
}

/** Flatten the inline content of a single block node into one unit per
 * character, plus one indivisible unit per atomic inline node (image, ...). */
export function flattenInlineNode(node: PMNode): CharUnit[] {
  const out: CharUnit[] = [];
  node.forEach((child) => {
    if (child.isText && child.text) {
      for (const ch of child.text) {
        out.push({ ch, marks: child.marks });
      }
      return;
    }
    if (!child.isText) {
      out.push({ ch: ATOMIC_PLACEHOLDER, marks: child.marks, node: child });
    }
  });
  return out;
}

function markKey(mark: Mark): string {
  return `${mark.type.name}:${JSON.stringify(mark.attrs)}`;
}

function markSetKey(marks: readonly Mark[]): string {
  return marks.map(markKey).sort().join("|");
}

function markLabel(mark: Mark): string {
  if (mark.type.name === "link") return `link(${mark.attrs.href})`;
  return mark.type.name;
}

/** Content equality for an atomic node, mirroring how a text CharUnit's `ch`
 * is its content: same node type + same attrs (src, alt, ...) = same content.
 * Marks (e.g. a link wrapping the image) are deliberately excluded here and
 * compared separately, exactly like text — so "same image, now linked" is a
 * format change, not a delete+insert, while "different src" is not equal at
 * all (the two images are different content occupying the same slot), which
 * is what makes it show up as a diff instead of silently passing through. */
function atomicContentEqual(a: PMNode | undefined, b: PMNode | undefined): boolean {
  if (!a || !b) return a === b;
  return a.type === b.type && JSON.stringify(a.attrs) === JSON.stringify(b.attrs);
}

function charUnitsEqual(a: CharUnit, b: CharUnit): boolean {
  return a.ch === b.ch && atomicContentEqual(a.node, b.node);
}

let changeIdCounter = 1;
export function nextChangeId(): number {
  return changeIdCounter++;
}
export function resetChangeIdCounter(): void {
  changeIdCounter = 1;
}
let atomicGroupCounter = 0;

// One character (or atomic node) tagged with which "chunk" it belongs to,
// but *not yet* carrying a changeId/mark instance — those are only minted
// once per merged chunk (see diffInline below), so five deleted characters
// in a row become one <del> chunk instead of five single-character ones.
type ChunkKind = "equal" | "format" | "delete" | "insert";
interface TaggedChar {
  text: string;
  node?: PMNode;
  chunkKind: ChunkKind;
  /** Everything that must match for two adjacent chars to belong to the same
   * visual chunk. Always unique for an atomic-node unit, since two atomic
   * nodes (or an atomic node and a neighboring run of text) must never be
   * merged into one chunk even when their chunkKind/marks coincide. */
  groupKey: string;
  contentMarks: readonly Mark[];
  added: string[];
  removed: string[];
}

/**
 * Character-level diff between two inline runs. Alignment is based on
 * content identity only (character value, or for an atomic node its type +
 * attrs); once aligned, marks are compared separately so a pure formatting
 * change (same content, different marks) is reported as such instead of a
 * delete+insert pair. Adjacent characters that are part of the same edit
 * (same kind of change + same surrounding formatting) are merged into a
 * single chunk, so e.g. deleting 5 characters out of a word produces one
 * struck-through <del> run, not five; atomic nodes are never merged this way
 * — each stays its own chunk.
 */
export function diffInline(oldChars: CharUnit[], newChars: CharUnit[]): { runs: Run[]; changed: boolean } {
  // Fast path: a block-level "equal" match only guarantees identical plain
  // text, not identical marks, so this check can't be skipped — but it's an
  // O(len) scan instead of building a per-character tagged array and running
  // a full array-diff, which matters because this runs once per unchanged
  // line too (not just modified ones), and on a large document unchanged
  // lines vastly outnumber modified ones.
  if (charsIdentical(oldChars, newChars)) {
    return { runs: buildUnchangedRuns(newChars), changed: false };
  }

  const ops = diffArrays(oldChars, newChars, charUnitsEqual);

  const tagged: TaggedChar[] = [];
  let changed = false;

  for (const op of ops) {
    if (op.type === "equal") {
      const oldKey = markSetKey(op.oldItem.marks);
      const newKey = markSetKey(op.newItem.marks);
      const node = op.newItem.node;
      if (oldKey === newKey) {
        tagged.push({
          text: op.newItem.ch,
          node,
          chunkKind: "equal",
          groupKey: node ? `atomic:${atomicGroupCounter++}` : `eq:${newKey}`,
          contentMarks: op.newItem.marks,
          added: [],
          removed: [],
        });
      } else {
        changed = true;
        const addedMarks = op.newItem.marks.filter((m) => !op.oldItem.marks.some((o) => markKey(o) === markKey(m)));
        const removedMarks = op.oldItem.marks.filter((m) => !op.newItem.marks.some((n) => markKey(n) === markKey(m)));
        const added = addedMarks.map(markLabel);
        const removed = removedMarks.map(markLabel);
        tagged.push({
          text: op.newItem.ch,
          node,
          chunkKind: "format",
          groupKey: node ? `atomic:${atomicGroupCounter++}` : `fmt:${added.join(",")}>${removed.join(",")}:${newKey}`,
          contentMarks: op.newItem.marks,
          added,
          removed,
        });
      }
    } else if (op.type === "delete") {
      changed = true;
      const node = op.oldItem.node;
      tagged.push({
        text: op.oldItem.ch,
        node,
        chunkKind: "delete",
        groupKey: node ? `atomic:${atomicGroupCounter++}` : `del:${markSetKey(op.oldItem.marks)}`,
        contentMarks: op.oldItem.marks,
        added: [],
        removed: [],
      });
    } else {
      changed = true;
      const node = op.newItem.node;
      tagged.push({
        text: op.newItem.ch,
        node,
        chunkKind: "insert",
        groupKey: node ? `atomic:${atomicGroupCounter++}` : `ins:${markSetKey(op.newItem.marks)}`,
        contentMarks: op.newItem.marks,
        added: [],
        removed: [],
      });
    }
  }

  // Merge adjacent chars belonging to the same chunk, then mint one
  // changeId + one set of diff marks per merged chunk (not per character).
  // Atomic-node entries always have a unique groupKey (see above), so they
  // never merge into a neighboring chunk — each renders as its own run.
  const runs: Run[] = [];
  let current: TaggedChar & { text: string } | null = null;
  for (const t of tagged) {
    if (current && current.groupKey === t.groupKey) {
      current.text += t.text;
    } else {
      if (current) runs.push(finishChunk(current));
      current = { ...t };
    }
  }
  if (current) runs.push(finishChunk(current));

  return { runs, changed };
}

function charsIdentical(a: CharUnit[], b: CharUnit[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!charUnitsEqual(a[i], b[i])) return false;
    if (markSetKey(a[i].marks) !== markSetKey(b[i].marks)) return false;
  }
  return true;
}

function buildUnchangedRuns(chars: CharUnit[]): Run[] {
  const runs: (Run & { _key?: string })[] = [];
  for (const unit of chars) {
    if (unit.node) {
      runs.push({ text: "", node: unit.node, marks: unit.marks as Mark[] });
      continue;
    }
    const key = markSetKey(unit.marks);
    const last = runs[runs.length - 1];
    if (last && last._key === key && !last.node) {
      last.text += unit.ch;
    } else {
      runs.push({ text: unit.ch, marks: unit.marks as Mark[], _key: key });
    }
  }
  return runs;
}

function finishChunk(chunk: TaggedChar): Run {
  switch (chunk.chunkKind) {
    case "equal":
      return { text: chunk.node ? "" : chunk.text, node: chunk.node, marks: chunk.contentMarks as Mark[] };
    case "format": {
      const changeId = nextChangeId();
      const diffMark = schema.marks.diffFormat.create({ added: chunk.added, removed: chunk.removed, changeId });
      return { text: chunk.node ? "" : chunk.text, node: chunk.node, marks: [diffMark, ...chunk.contentMarks] };
    }
    case "delete": {
      const changeId = nextChangeId();
      return { text: chunk.node ? "" : chunk.text, node: chunk.node, marks: [schema.marks.diffDelete.create({ changeId }), ...chunk.contentMarks] };
    }
    case "insert": {
      const changeId = nextChangeId();
      return { text: chunk.node ? "" : chunk.text, node: chunk.node, marks: [schema.marks.diffInsert.create({ changeId }), ...chunk.contentMarks] };
    }
  }
}
