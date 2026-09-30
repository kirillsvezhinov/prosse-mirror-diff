import type { Node as PMNode } from "prosemirror-model";

/**
 * Single source of truth for which nodes of src/schema.ts the diff engine
 * knows how to walk into a flat list of "lines" (flatten.ts) and rebuild
 * back into a nested document. Adding a node type to the schema does NOT
 * automatically teach the differ about it — see docs/EXTENDING_SCHEMA.md for
 * the full checklist; this file is step one of it.
 *
 * Two kinds of nodes exist here:
 *  - "leaf" nodes are diffable lines: they either hold inline content
 *    (paragraph, heading, code_block) or are void (horizontal_rule).
 *  - "container" nodes wrap other blocks and only affect structure, never
 *    inline content directly: "wrap" containers hold `block+` (blockquote),
 *    "list" containers hold `item+`, each item holding exactly one leaf
 *    (bullet_list/ordered_list + list_item — see the limitation noted in
 *    docs/EXTENDING_SCHEMA.md).
 *
 * A node that is neither registered here nor "doc" itself is unknown to the
 * differ: its content is silently dropped from flattenDoc(), and a one-time
 * console.warn fires so that isn't a silent surprise in production too.
 */

export interface LeafNodeConfig {
  /** Schema node name — must match a node in src/schema.ts. */
  nodeType: string;
  /** True for nodes with no inline content, like horizontal_rule. */
  void?: boolean;
  /**
   * Extract the attrs that matter for this node: whether an "equal" line
   * lines up as the same slot at all (see lineSignature) and what needs to
   * survive being rebuilt after diffing (e.g. heading level). Attrs not
   * returned here are invisible to the differ — they're neither compared
   * nor preserved.
   */
  attrs?: (node: PMNode) => Record<string, unknown>;
}

export type ContainerNodeConfig =
  | {
      kind: "wrap";
      /** Schema node name; its content is `block+` directly, e.g. blockquote. */
      nodeType: string;
    }
  | {
      kind: "list";
      /** Schema node name of the list itself (bullet_list, ordered_list, ...). */
      nodeType: string;
      /** Schema node name each item is wrapped in (list_item). */
      itemType: string;
    };

export const LEAF_NODES = [
  { nodeType: "paragraph" },
  { nodeType: "heading", attrs: (node: PMNode) => ({ level: node.attrs.level }) },
  { nodeType: "code_block" },
  { nodeType: "horizontal_rule", void: true },
] as const satisfies readonly LeafNodeConfig[];

export const CONTAINER_NODES = [
  { kind: "wrap", nodeType: "blockquote" },
  { kind: "list", nodeType: "bullet_list", itemType: "list_item" },
  { kind: "list", nodeType: "ordered_list", itemType: "list_item" },
] as const satisfies readonly ContainerNodeConfig[];

export type LeafNodeType = (typeof LEAF_NODES)[number]["nodeType"];
export type ContainerType = (typeof CONTAINER_NODES)[number]["nodeType"];

const leafByType = new Map<string, LeafNodeConfig>(LEAF_NODES.map((c) => [c.nodeType, c]));
const containerByType = new Map<string, ContainerNodeConfig>(CONTAINER_NODES.map((c) => [c.nodeType, c]));

export function leafConfigFor(nodeTypeName: string): LeafNodeConfig | undefined {
  return leafByType.get(nodeTypeName);
}

export function containerConfigFor(nodeTypeName: string): ContainerNodeConfig | undefined {
  return containerByType.get(nodeTypeName);
}

export function isVoidLeaf(nodeTypeName: string): boolean {
  return leafByType.get(nodeTypeName)?.void ?? false;
}

const warnedTypes = new Set<string>();

/** Fires once per node type name, so a schema change that forgot to update
 * this file is loud instead of quietly losing content in the diff view. */
export function warnUnknownNodeType(nodeTypeName: string): void {
  if (warnedTypes.has(nodeTypeName)) return;
  warnedTypes.add(nodeTypeName);
  // eslint-disable-next-line no-console
  console.warn(
    `[prose-mirror-diff] Schema node "${nodeTypeName}" is not registered in src/diff/schemaConfig.ts — ` +
      `it will be silently skipped by the diff engine. See docs/EXTENDING_SCHEMA.md.`
  );
}
