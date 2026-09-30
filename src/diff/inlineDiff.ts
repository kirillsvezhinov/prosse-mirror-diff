import { Mark, Node as PMNode } from "prosemirror-model";
import { schema } from "../schema";
import { diffArrays } from "./lcs";

export interface CharUnit {
  ch: string;
  marks: readonly Mark[];
}

export interface Run {
  text: string;
  marks: Mark[];
}

/** Flatten the inline content of a single block node into one char per unit, each carrying its marks. */
export function flattenInlineNode(node: PMNode): CharUnit[] {
  const out: CharUnit[] = [];
  node.forEach((child) => {
    if (!child.isText || !child.text) return;
    for (const ch of child.text) {
      out.push({ ch, marks: child.marks });
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

let changeIdCounter = 1;
export function nextChangeId(): number {
  return changeIdCounter++;
}
export function resetChangeIdCounter(): void {
  changeIdCounter = 1;
}

// One character tagged with which "chunk" it belongs to, but *not yet*
// carrying a changeId/mark instance — those are only minted once per merged
// chunk (see diffInline below), so five deleted characters in a row become
// one <del> chunk instead of five single-character ones.
type ChunkKind = "equal" | "format" | "delete" | "insert";
interface TaggedChar {
  text: string;
  chunkKind: ChunkKind;
  /** Everything that must match for two adjacent chars to belong to the same visual chunk. */
  groupKey: string;
  contentMarks: readonly Mark[];
  added: string[];
  removed: string[];
}

/**
 * Character-level diff between two inline runs. Alignment is based on
 * character identity only; once aligned, marks are compared separately so a
 * pure formatting change (same text, different marks) is reported as such
 * instead of a delete+insert pair. Adjacent characters that are part of the
 * same edit (same kind of change + same surrounding formatting) are merged
 * into a single chunk, so e.g. deleting 5 characters out of a word produces
 * one struck-through <del> run, not five.
 */
export function diffInline(oldChars: CharUnit[], newChars: CharUnit[]): { runs: Run[]; changed: boolean } {
  const ops = diffArrays(oldChars, newChars, (a, b) => a.ch === b.ch);

  const tagged: TaggedChar[] = [];
  let changed = false;

  for (const op of ops) {
    if (op.type === "equal") {
      const oldKey = markSetKey(op.oldItem.marks);
      const newKey = markSetKey(op.newItem.marks);
      if (oldKey === newKey) {
        tagged.push({ text: op.newItem.ch, chunkKind: "equal", groupKey: `eq:${newKey}`, contentMarks: op.newItem.marks, added: [], removed: [] });
      } else {
        changed = true;
        const addedMarks = op.newItem.marks.filter((m) => !op.oldItem.marks.some((o) => markKey(o) === markKey(m)));
        const removedMarks = op.oldItem.marks.filter((m) => !op.newItem.marks.some((n) => markKey(n) === markKey(m)));
        const added = addedMarks.map(markLabel);
        const removed = removedMarks.map(markLabel);
        tagged.push({
          text: op.newItem.ch,
          chunkKind: "format",
          groupKey: `fmt:${added.join(",")}>${removed.join(",")}:${newKey}`,
          contentMarks: op.newItem.marks,
          added,
          removed,
        });
      }
    } else if (op.type === "delete") {
      changed = true;
      tagged.push({
        text: op.oldItem.ch,
        chunkKind: "delete",
        groupKey: `del:${markSetKey(op.oldItem.marks)}`,
        contentMarks: op.oldItem.marks,
        added: [],
        removed: [],
      });
    } else {
      changed = true;
      tagged.push({
        text: op.newItem.ch,
        chunkKind: "insert",
        groupKey: `ins:${markSetKey(op.newItem.marks)}`,
        contentMarks: op.newItem.marks,
        added: [],
        removed: [],
      });
    }
  }

  // Merge adjacent chars belonging to the same chunk, then mint one
  // changeId + one set of diff marks per merged chunk (not per character).
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

function finishChunk(chunk: TaggedChar): Run {
  switch (chunk.chunkKind) {
    case "equal":
      return { text: chunk.text, marks: chunk.contentMarks as Mark[] };
    case "format": {
      const changeId = nextChangeId();
      const diffMark = schema.marks.diffFormat.create({ added: chunk.added, removed: chunk.removed, changeId });
      return { text: chunk.text, marks: [diffMark, ...chunk.contentMarks] };
    }
    case "delete": {
      const changeId = nextChangeId();
      return { text: chunk.text, marks: [schema.marks.diffDelete.create({ changeId }), ...chunk.contentMarks] };
    }
    case "insert": {
      const changeId = nextChangeId();
      return { text: chunk.text, marks: [schema.marks.diffInsert.create({ changeId }), ...chunk.contentMarks] };
    }
  }
}
