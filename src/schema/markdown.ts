import type { Node as PMNode } from "prosemirror-model";
import { schema } from "./dom";
import { parser as baseParser } from "./src/parser";
import { serializer as baseSerializer } from "./src/serializer";

/**
 * `src/schema/src`'s `parser` builds nodes against its own base Schema
 * instance — a *different* object from this app's extended `schema` (dom.ts)
 * even though every node/mark name matches (ProseMirror requires exact
 * schema identity for a doc to be usable with an EditorState, not just
 * matching type names). Re-hydrating through JSON is the standard, cheap way
 * to move a parsed doc from one schema instance to a compatible one — the
 * extended schema fills in `diffStatus` (and any other added attrs) with its
 * own defaults for anything not present in the JSON, same as any other
 * schema-driven default.
 */
export function parseMarkdown(source: string): PMNode {
  const baseDoc = baseParser.parse(source);
  return schema.nodeFromJSON(baseDoc.toJSON());
}

export function serializeMarkdown(doc: PMNode): string {
  return baseSerializer.serialize(doc);
}
