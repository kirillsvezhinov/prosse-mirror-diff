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
      const chars = leaf.void ? [] : flattenInlineNode(child);
      out.push({
        path,
        containerAttrs,
        nodeType: typeName as LeafNodeType,
        attrs: leaf.attrs ? leaf.attrs(child) : {},
        chars,
        plainText: chars.map((c) => c.ch).join(""),
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

export function lineSignature(line: Line): string {
  return `${line.path.join("/")}#${line.nodeType}#${JSON.stringify(line.attrs)}`;
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
}

export function rebuildDoc(lines: RenderLine[]): PMNode {
  const blocks = rebuildLevel(lines, 0);
  return schema.nodes.doc.create(null, blocks);
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
      result.push(schema.nodes[cfg.nodeType].create(null, children.length ? children : [schema.nodes.paragraph.create()]));
    } else {
      const items = group.map((l) => schema.nodes[cfg.itemType].create(null, [buildLeaf(l)]));
      result.push(schema.nodes[cfg.nodeType].create(groupAttrs as any, items));
    }
    i = end;
  }
  return result;
}

function buildLeaf(line: RenderLine): PMNode {
  const attrs = { ...line.attrs, diffStatus: line.diffStatus };
  if (isVoidLeaf(line.nodeType)) {
    return schema.nodes[line.nodeType].create(attrs);
  }
  const content = line.runs.filter((r) => r.text.length > 0).map((r) => schema.text(r.text, r.marks));
  return schema.nodes[line.nodeType].create(attrs, content);
}
