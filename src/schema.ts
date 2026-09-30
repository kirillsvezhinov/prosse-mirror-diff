import { Schema } from "prosemirror-model";

/**
 * Base document schema (paragraphs, headings, lists, blockquote, code block,
 * horizontal rule) extended with three presentational marks used only to
 * render a diff: diffInsert / diffDelete / diffFormat.
 *
 * Block nodes additionally carry an optional `diffStatus` attribute so a
 * whole line can be tinted (inserted / deleted / modified) in addition to
 * inline character-level highlighting.
 */

const diffStatusAttr = { diffStatus: { default: null as null | "inserted" | "deleted" | "modified" } };

const cellAttrs = {
  colspan: { default: 1 },
  rowspan: { default: 1 },
  colwidth: { default: null as number[] | null },
};

function cellDOMAttrs(node: { attrs: Record<string, any> }) {
  const attrs: Record<string, string> = {};
  if (node.attrs.colspan !== 1) attrs.colspan = String(node.attrs.colspan);
  if (node.attrs.rowspan !== 1) attrs.rowspan = String(node.attrs.rowspan);
  return attrs;
}

function parseCellAttrs(dom: HTMLElement | string) {
  const el = dom as HTMLElement;
  return {
    colspan: Number(el.getAttribute("colspan")) || 1,
    rowspan: Number(el.getAttribute("rowspan")) || 1,
    colwidth: null,
  };
}

export const schema = new Schema({
  nodes: {
    doc: { content: "block+" },

    paragraph: {
      content: "inline*",
      group: "block",
      attrs: diffStatusAttr,
      parseDOM: [{ tag: "p" }],
      toDOM(node) {
        return ["p", { "data-diff": node.attrs.diffStatus || undefined }, 0];
      },
    },

    heading: {
      content: "inline*",
      group: "block",
      attrs: { level: { default: 1 }, ...diffStatusAttr },
      parseDOM: [1, 2, 3].map((level) => ({ tag: `h${level}`, attrs: { level } })),
      toDOM(node) {
        return [`h${node.attrs.level}`, { "data-diff": node.attrs.diffStatus || undefined }, 0];
      },
    },

    blockquote: {
      content: "block+",
      group: "block",
      parseDOM: [{ tag: "blockquote" }],
      toDOM() {
        return ["blockquote", 0];
      },
    },

    code_block: {
      content: "text*",
      group: "block",
      // real content never carries marks inside a code block, but the diff
      // overlay still needs to highlight inserted/deleted/changed characters
      marks: "diffInsert diffDelete diffFormat",
      code: true,
      attrs: diffStatusAttr,
      parseDOM: [{ tag: "pre", preserveWhitespace: "full" as const }],
      toDOM(node) {
        return ["pre", { "data-diff": node.attrs.diffStatus || undefined }, ["code", 0]];
      },
    },

    horizontal_rule: {
      group: "block",
      attrs: diffStatusAttr,
      parseDOM: [{ tag: "hr" }],
      toDOM(node) {
        return ["hr", { "data-diff": node.attrs.diffStatus || undefined }];
      },
    },

    // Node shapes mirror prosemirror-tables' `tableNodes()` output (table /
    // table_row / table_cell / table_header with colspan/rowspan/colwidth),
    // so a document produced by an editor built on that package round-trips
    // through this schema unchanged. Only the shapes are replicated here —
    // this is a read-only diff viewer, so the interactive column-resizing /
    // cell-selection plugin from that package isn't needed.
    table: {
      content: "table_row+",
      group: "block",
      isolating: true,
      attrs: diffStatusAttr,
      parseDOM: [{ tag: "table" }],
      toDOM(node) {
        return ["table", { "data-diff": node.attrs.diffStatus || undefined }, ["tbody", 0]];
      },
    },

    table_row: {
      content: "(table_cell | table_header)*",
      attrs: diffStatusAttr,
      parseDOM: [{ tag: "tr" }],
      toDOM(node) {
        return ["tr", { "data-diff": node.attrs.diffStatus || undefined }, 0];
      },
    },

    table_cell: {
      content: "block+",
      attrs: cellAttrs,
      isolating: true,
      parseDOM: [{ tag: "td", getAttrs: parseCellAttrs }],
      toDOM(node) {
        return ["td", cellDOMAttrs(node), 0];
      },
    },

    table_header: {
      content: "block+",
      attrs: cellAttrs,
      isolating: true,
      parseDOM: [{ tag: "th", getAttrs: parseCellAttrs }],
      toDOM(node) {
        return ["th", cellDOMAttrs(node), 0];
      },
    },

    bullet_list: {
      content: "list_item+",
      group: "block",
      parseDOM: [{ tag: "ul" }],
      toDOM() {
        return ["ul", 0];
      },
    },

    ordered_list: {
      content: "list_item+",
      group: "block",
      attrs: { order: { default: 1 } },
      parseDOM: [{ tag: "ol" }],
      toDOM(node) {
        return node.attrs.order === 1 ? ["ol", 0] : ["ol", { start: node.attrs.order }, 0];
      },
    },

    list_item: {
      content: "paragraph+",
      parseDOM: [{ tag: "li" }],
      toDOM() {
        return ["li", 0];
      },
    },

    image: {
      inline: true,
      group: "inline",
      atom: true,
      attrs: { src: {}, alt: { default: null as string | null }, title: { default: null as string | null } },
      parseDOM: [
        {
          tag: "img[src]",
          getAttrs: (dom) => ({
            src: (dom as HTMLElement).getAttribute("src"),
            alt: (dom as HTMLElement).getAttribute("alt"),
            title: (dom as HTMLElement).getAttribute("title"),
          }),
        },
      ],
      toDOM(node) {
        return ["img", { src: node.attrs.src, alt: node.attrs.alt, title: node.attrs.title }];
      },
    },

    text: { group: "inline" },
  },

  marks: {
    strong: {
      parseDOM: [{ tag: "strong" }, { tag: "b" }],
      toDOM() {
        return ["strong", 0];
      },
    },
    em: {
      parseDOM: [{ tag: "em" }, { tag: "i" }],
      toDOM() {
        return ["em", 0];
      },
    },
    underline: {
      parseDOM: [{ tag: "u" }],
      toDOM() {
        return ["u", 0];
      },
    },
    strike: {
      parseDOM: [{ tag: "s" }, { tag: "del" }],
      toDOM() {
        return ["s", 0];
      },
    },
    code: {
      parseDOM: [{ tag: "code" }],
      toDOM() {
        return ["code", 0];
      },
    },
    link: {
      attrs: { href: {} },
      parseDOM: [{ tag: "a[href]", getAttrs: (dom) => ({ href: (dom as HTMLElement).getAttribute("href") }) }],
      toDOM(mark) {
        return ["a", { href: mark.attrs.href }, 0];
      },
    },

    // --- presentational diff marks (never present in "real" content) ---
    diffInsert: {
      excludes: "",
      attrs: { changeId: { default: 0 } },
      toDOM() {
        return ["ins", { class: "diff-insert" }, 0];
      },
    },
    diffDelete: {
      excludes: "",
      attrs: { changeId: { default: 0 } },
      toDOM() {
        return ["del", { class: "diff-delete" }, 0];
      },
    },
    diffFormat: {
      excludes: "",
      attrs: { added: { default: [] }, removed: { default: [] }, changeId: { default: 0 } },
      toDOM(mark) {
        const title = describeFormatChange(mark.attrs.added, mark.attrs.removed);
        return ["span", { class: "diff-format", title }, 0];
      },
    },
  },
});

function describeFormatChange(added: string[], removed: string[]): string {
  const parts: string[] = [];
  if (added.length) parts.push(`+${added.join(", +")}`);
  if (removed.length) parts.push(`-${removed.join(", -")}`);
  return parts.join(" ");
}

export const CONTENT_MARK_NAMES = ["strong", "em", "underline", "strike", "code", "link"] as const;
export type ContentMarkName = (typeof CONTENT_MARK_NAMES)[number];
