import type { Node as PMNode } from "prosemirror-model";
import { schema } from "../schema";
import type { CharUnit, Run } from "./inlineDiff";
import { flattenInlineNode } from "./inlineDiff";
import type { ContainerType, LeafNodeType } from "./schemaConfig";
import { containerConfigFor, isVoidLeaf, leafConfigFor, warnUnknownNodeType } from "./schemaConfig";

/** One "line" = one leaf block (paragraph/heading/code_block/hr/...), with the chain of
 * containers (blockquote / lists / ...) it lives inside, flattened out of the tree.
 *
 * Which node types are leaves vs. containers, and how each is walked/rebuilt,
 * is entirely driven by src/diff/schemaConfig.ts — this file is the generic
 * engine, not the place to special-case a new node type. */
export interface Line {
  path: ContainerType[];
  containerAttrs: Record<string, unknown>[]; // aligned with `path`
  nodeType: LeafNodeType;
  attrs: Record<string, unknown>;
  chars: CharUnit[];
  plainText: string;
  /** FNV-1a hash of plainText, computed once at flatten time. Lets the diff
   * equality check reject a same-length-but-different-content pair in O(1)
   * instead of a full O(len) string scan — worthwhile because this equality
   * check runs tens of millions of times on a multi-MB document. */
  textHash: number;
  /** Only set for a "structuredText" leaf (currently just `table`): the
   * original node, so diffDoc.ts's dedicated handling can recurse into its
   * actual row/cell structure instead of the normal per-character inline
   * diff, which doesn't apply here. */
  node?: PMNode;
}

function hashText(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function flattenDoc(doc: PMNode): Line[] {
  const out: Line[] = [];
  walk(doc, [], [], out);
  return out;
}

function walk(
  container: PMNode,
  path: ContainerType[],
  containerAttrs: Record<string, unknown>[],
  out: Line[]
): void {
  container.forEach((child) => {
    const typeName = child.type.name;

    const leaf = leafConfigFor(typeName);
    if (leaf) {
      if (leaf.structuredText) {
        const plainText = leaf.structuredText(child);
        out.push({
          path,
          containerAttrs,
          nodeType: typeName as LeafNodeType,
          attrs: leaf.attrs ? leaf.attrs(child) : {},
          chars: [],
          plainText,
          textHash: hashText(plainText),
          node: child,
        });
        return;
      }
      const chars = leaf.void ? [] : flattenInlineNode(child);
      const plainText = chars.map((c) => c.ch).join("");
      out.push({
        path,
        containerAttrs,
        nodeType: typeName as LeafNodeType,
        attrs: leaf.attrs ? leaf.attrs(child) : {},
        chars,
        plainText,
        textHash: hashText(plainText),
      });
      return;
    }

    const container_ = containerConfigFor(typeName);
    if (container_) {
      if (container_.kind === "wrap") {
        walk(child, [...path, container_.nodeType as ContainerType], [...containerAttrs, {}], out);
      } else {
        // "list": each item is walked directly (transparently) so its own
        // leaf content lands at the same path depth as the list itself —
        // the item wrapper only reappears when rebuilding (see buildLevel).
        const listAttrs = { ...child.attrs };
        child.forEach((item) => {
          walk(item, [...path, container_.nodeType as ContainerType], [...containerAttrs, listAttrs], out);
        });
      }
      return;
    }

    warnUnknownNodeType(typeName);
  });
}

export function attrsEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// The diff engine calls lineSignature() as an O(1) piece of an equality
// predicate that itself runs inside the O(N*D) inner loop of the array-diff
// algorithm — on a multi-MB document that's tens of millions of calls, so
// recomputing path.join/JSON.stringify every time (instead of once per line,
// which is immutable once flattened) was the dominant cost, not the diff
// algorithm itself.
const signatureCache = new WeakMap<Line, string>();

export function lineSignature(line: Line): string {
  let sig = signatureCache.get(line);
  if (sig === undefined) {
    sig = `${line.path.join("/")}#${line.nodeType}#${JSON.stringify(line.attrs)}`;
    signatureCache.set(line, sig);
  }
  return sig;
}

// ---- rebuilding a diffed doc from a flat, ordered list of rendered lines ----

export type DiffStatus = "inserted" | "deleted" | "modified" | null;

export interface RenderLine {
  path: ContainerType[];
  containerAttrs: Record<string, unknown>[];
  nodeType: LeafNodeType;
  attrs: Record<string, unknown>;
  runs: Run[];
  diffStatus: DiffStatus;
  /** Escape hatch for a leaf whose final node diffDoc.ts already built by
   * hand (currently just `table`, reassembled from per-cell recursive diffs)
   * — buildLeaf() returns this as-is instead of going through the generic
   * attrs+runs reconstruction, which assumes flat inline content. */
  prebuiltNode?: PMNode;
}

export function rebuildDoc(lines: RenderLine[]): PMNode {
  const blocks = rebuildBlocks(lines, 0);
  return schema.nodes.doc.create(null, blocks);
}

/** Rebuild a flat, ordered RenderLine[] back into a nested block array —
 * exported so diffDoc.ts's table handling can reuse it to rebuild a single
 * cell's content the exact same way the top-level doc is rebuilt. */
export function rebuildBlocks(lines: RenderLine[], depth: number): PMNode[] {
  return rebuildLevel(lines, depth);
}

function rebuildLevel(lines: RenderLine[], depth: number): PMNode[] {
  const result: PMNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.path.length === depth) {
      result.push(buildLeaf(line));
      i++;
      continue;
    }
    const containerType = line.path[depth];
    const groupAttrs = line.containerAttrs[depth];
    let end = i + 1;
    while (
      end < lines.length &&
      lines[end].path.length > depth &&
      lines[end].path[depth] === containerType &&
      attrsEqual(lines[end].containerAttrs[depth], groupAttrs)
    ) {
      end++;
    }
    const group = lines.slice(i, end);
    const cfg = containerConfigFor(containerType);
    if (!cfg) {
      // Every path segment was produced by a container config in walk()
      // above, so this can only mean schemaConfig.ts changed shape under us
      // mid-run — fail loudly rather than silently dropping content.
      throw new Error(`No container config for "${containerType}" — check src/diff/schemaConfig.ts`);
    }
    if (cfg.kind === "wrap") {
      const children = rebuildLevel(group, depth + 1);
      // createAndFill() picks whatever the schema's own default-fill type is
      // for this content expression (e.g. empty_paragraph vs paragraph) —
      // this engine doesn't hardcode that assumption for a node type it
      // doesn't own.
      result.push(children.length ? schema.nodes[cfg.nodeType].create(null, children) : schema.nodes[cfg.nodeType].createAndFill()!);
    } else {
      const items = group.map((l) => schema.nodes[cfg.itemType].create(null, [buildLeaf(l)]));
      result.push(schema.nodes[cfg.nodeType].create(groupAttrs as any, items));
    }
    i = end;
  }
  return result;
}

function buildLeaf(line: RenderLine): PMNode {
  if (line.prebuiltNode) return line.prebuiltNode;
  const attrs = { ...line.attrs, diffStatus: line.diffStatus };
  if (isVoidLeaf(line.nodeType)) {
    return schema.nodes[line.nodeType].create(attrs);
  }
  const content = line.runs
    .filter((r) => r.text.length > 0 || r.node)
    .map((r) => (r.node ? r.node.type.create(r.node.attrs, null, r.marks) : schema.text(r.text, r.marks)));
  return schema.nodes[line.nodeType].create(attrs, content);
}
