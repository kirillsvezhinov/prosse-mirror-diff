import { Schema, type Node as PMNode, type NodeSpec, type MarkSpec, type DOMOutputSpec } from "prosemirror-model";
import { schema as baseSchema } from "./src/schema";
import { LoadStatus } from "./src/blocks/media-block/types/load-status";
import { FileType, getFileType } from "./src/blocks/media-block/types/file-type";
import { DEFAULT_MIME_TYPE } from "./src/blocks/media-block/media.const";
import { LanguageService } from "./src/blocks/code-block/language.service";

/**
 * The `@schema` package (src/schema/src) is the real, portable content model
 * — specs, markdown parser, markdown serializer — deliberately with no
 * toDOM/parseDOM baked in for its custom nodes (that lives elsewhere in the
 * real app, e.g. React NodeViews). This file is the "additional schema for
 * the frontend" that this read-only diff viewer needs instead: it extends
 * the base schema's spec via the same OrderedMap `.update()`/`.addToEnd()`
 * pattern `src/schema/src/schema.ts` already uses to extend
 * prosemirror-markdown — never editing files under src/schema/src/ itself,
 * so the base package stays exactly as merged.
 *
 * Two kinds of additions:
 *  1. toDOM/parseDOM for the 4 node types that have none at all:
 *     `code_block`, `empty_paragraph`, `custom_image_node`, `file_attachment`.
 *  2. A `diffStatus` attr + `data-diff` output on every node type the diff
 *     engine can tint as a whole block (see src/diff/schemaConfig.ts's
 *     LEAF_NODES), plus the 3 presentational diff marks
 *     (diffInsert/diffDelete/diffFormat) the diff engine paints onto inline
 *     content. Both are inherently diff-viewer-only concerns, so they live
 *     here rather than in the portable base package.
 */

type DiffStatus = null | "inserted" | "deleted" | "modified";

function dataDiff(status: DiffStatus): Record<string, string> {
  return status ? { "data-diff": status } : {};
}

function withDiffStatus(base: NodeSpec, toDOM: (node: PMNode) => DOMOutputSpec): NodeSpec {
  return {
    ...base,
    attrs: { ...(base.attrs ?? {}), diffStatus: { default: null } },
    toDOM,
  };
}

const nodes = baseSchema.spec.nodes
  // --- nodes that already have toDOM/parseDOM (inherited from
  // prosemirror-markdown / prosemirror-tables) — preserved verbatim via the
  // spread in withDiffStatus, only the DOM tag shape below needs repeating
  // since we can't splice an attribute into an *existing* toDOM closure.
  .update(
    "paragraph",
    withDiffStatus(baseSchema.spec.nodes.get("paragraph")!, (node) => ["p", dataDiff(node.attrs.diffStatus), 0])
  )
  .update("heading", withDiffStatus(baseSchema.spec.nodes.get("heading")!, (node) => [`h${node.attrs.level}`, dataDiff(node.attrs.diffStatus), 0]))
  .update("horizontal_rule", withDiffStatus(baseSchema.spec.nodes.get("horizontal_rule")!, (node) => ["div", dataDiff(node.attrs.diffStatus), ["hr"]]))
  .update("table", withDiffStatus(baseSchema.spec.nodes.get("table")!, (node) => ["table", dataDiff(node.attrs.diffStatus), ["tbody", 0]]))
  .update("table_row", withDiffStatus(baseSchema.spec.nodes.get("table_row")!, (node) => ["tr", dataDiff(node.attrs.diffStatus), 0]))

  // --- nodes with genuinely no toDOM/parseDOM in the base package ---
  .update("code_block", {
    ...withDiffStatus(baseSchema.spec.nodes.get("code_block")!, (node) => [
      "pre",
      { "data-language": node.attrs.language, ...dataDiff(node.attrs.diffStatus) },
      ["code", 0],
    ]),
    // Diff marks are the only marks a real document could never contain on
    // its own — widening this is additive, no existing content stops being
    // valid, it just also permits the differ's own presentational marks.
    marks: "diffInsert diffDelete diffFormat",
    parseDOM: [
      {
        tag: "pre",
        preserveWhitespace: "full" as const,
        getAttrs: (dom) => ({
          language: (dom as HTMLElement).getAttribute("data-language") || LanguageService.DEFAULT_LANGUAGE,
        }),
      },
    ],
  })
  .update("empty_paragraph", {
    ...withDiffStatus(baseSchema.spec.nodes.get("empty_paragraph")!, (node) => ["p", { class: "empty-line", ...dataDiff(node.attrs.diffStatus) }, 0]),
    parseDOM: [{ tag: "p.empty-line" }],
  })
  .update("custom_image_node", {
    ...withDiffStatus(baseSchema.spec.nodes.get("custom_image_node")!, (node) => [
      "img",
      {
        src: node.attrs.downloadUrl,
        alt: node.attrs.fileName,
        title: node.attrs.fileName,
        width: node.attrs.width ?? undefined,
        height: node.attrs.height ?? undefined,
        ...dataDiff(node.attrs.diffStatus),
      },
    ]),
    parseDOM: [
      {
        tag: "img[src]",
        getAttrs: (dom) => {
          const el = dom as HTMLElement;
          const width = el.getAttribute("width");
          const height = el.getAttribute("height");
          return {
            localId: "",
            attachmentId: null,
            fileName: el.getAttribute("alt") || el.getAttribute("title") || "file",
            status: LoadStatus.COMPLETED,
            progress: 100,
            mimeType: DEFAULT_MIME_TYPE,
            fileType: getFileType(DEFAULT_MIME_TYPE),
            downloadUrl: el.getAttribute("src") || "",
            width: width ? Number(width) : null,
            height: height ? Number(height) : null,
          };
        },
      },
    ],
  })
  .update("file_attachment", {
    ...withDiffStatus(baseSchema.spec.nodes.get("file_attachment")!, (node) => [
      "a",
      { class: "file-attachment", href: node.attrs.downloadUrl, ...dataDiff(node.attrs.diffStatus) },
      ["span", { class: "file-attachment-icon" }, "\u{1F4CE}"],
      ["span", { class: "file-attachment-name" }, node.attrs.fileName],
    ]),
    parseDOM: [
      {
        tag: "a.file-attachment[href]",
        getAttrs: (dom) => {
          const el = dom as HTMLElement;
          const fileName = el.querySelector(".file-attachment-name")?.textContent || "file";
          return {
            localId: "",
            attachmentId: null,
            fileName,
            status: LoadStatus.COMPLETED,
            progress: 100,
            mimeType: DEFAULT_MIME_TYPE,
            fileType: FileType.OTHER,
            downloadUrl: el.getAttribute("href") || "",
          };
        },
      },
    ],
  });

const marks = baseSchema.spec.marks
  .addToEnd("diffInsert", {
    excludes: "",
    attrs: { changeId: { default: 0 } },
    toDOM: () => ["ins", { class: "diff-insert" }, 0],
  } satisfies MarkSpec)
  .addToEnd("diffDelete", {
    excludes: "",
    attrs: { changeId: { default: 0 } },
    toDOM: () => ["del", { class: "diff-delete" }, 0],
  } satisfies MarkSpec)
  .addToEnd("diffFormat", {
    excludes: "",
    attrs: { added: { default: [] as string[] }, removed: { default: [] as string[] }, changeId: { default: 0 } },
    toDOM: (mark) => ["span", { class: "diff-format", title: describeFormatChange(mark.attrs.added, mark.attrs.removed) }, 0],
  } satisfies MarkSpec);

function describeFormatChange(added: string[], removed: string[]): string {
  const parts: string[] = [];
  if (added.length) parts.push(`+${added.join(", +")}`);
  if (removed.length) parts.push(`-${removed.join(", -")}`);
  return parts.join(" ");
}

export const schema = new Schema({ nodes, marks });
export type TSchema = typeof schema;
