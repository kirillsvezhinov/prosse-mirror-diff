import MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";
import { MarkdownParser } from "prosemirror-markdown";
import { schema } from "../schema";

/**
 * Maps CommonMark tokens onto our own schema (src/schema.ts), so markdown
 * input can be parsed straight into the doc used by the diff pipeline —
 * no intermediate "prosemirror-markdown" schema involved.
 *
 * Node/mark names line up 1:1 with our schema, so this is close to
 * prosemirror-markdown's own `defaultMarkdownParser` config; hard line
 * breaks aren't represented in our schema, so they're dropped (`ignore`)
 * rather than crashing the parse. Images are (see schema.ts's `image` node).
 *
 * "commonmark" is strict CommonMark and disables GFM tables by default;
 * `.enable(["table"])` re-activates markdown-it's own bundled table rule
 * (it's registered either way, the preset just toggles it off) without
 * pulling in a plugin. thead/tbody are markdown-it bookkeeping only — our
 * schema's `table` is `table_row+` directly (row vs. header is a per-*cell*
 * distinction, table_header vs. table_cell, matching prosemirror-tables'
 * shape) — so both are `ignore`d: markdown-it still walks their tr/th/td
 * children in sequence, they just don't wrap a node of their own.
 *
 * markdown-it puts a cell's text directly inside th/td (no paragraph
 * wrapper), but our schema's table_cell/table_header require `block+`
 * content — MarkdownParser builds nodes via `createAndFill`, which *silently
 * drops* content that can't be fit (no error, the cell just comes out
 * empty), so this isn't optional: a core rule inserts a synthetic
 * paragraph_open/paragraph_close around each cell's inline content before
 * MarkdownParser ever sees the token stream.
 */
const md = new MarkdownIt("commonmark", { html: false }).enable(["table"]);

md.core.ruler.push("wrap_table_cells", (state) => {
  const tokens = state.tokens;
  const out: typeof tokens = [];
  for (const tok of tokens) {
    if (tok.type === "th_open" || tok.type === "td_open") {
      out.push(tok, new state.Token("paragraph_open", "p", 1));
      continue;
    }
    if (tok.type === "th_close" || tok.type === "td_close") {
      out.push(new state.Token("paragraph_close", "p", -1), tok);
      continue;
    }
    out.push(tok);
  }
  state.tokens = out;
});

export const markdownParser = new MarkdownParser(schema, md, {
  blockquote: { block: "blockquote" },
  paragraph: { block: "paragraph" },
  list_item: { block: "list_item" },
  bullet_list: { block: "bullet_list" },
  ordered_list: { block: "ordered_list", getAttrs: (tok: Token) => ({ order: +tok.attrGet("start")! || 1 }) },
  heading: { block: "heading", getAttrs: (tok: Token) => ({ level: +tok.tag.slice(1) }) },
  code_block: { block: "code_block", noCloseToken: true },
  fence: { block: "code_block", noCloseToken: true },
  hr: { node: "horizontal_rule" },
  hardbreak: { ignore: true, noCloseToken: true },
  image: {
    node: "image",
    getAttrs: (tok: Token) => ({
      src: tok.attrGet("src"),
      title: tok.attrGet("title") || null,
      alt: (tok.children?.[0] && tok.children[0].content) || null,
    }),
  },
  table: { block: "table" },
  thead: { ignore: true },
  tbody: { ignore: true },
  tr: { block: "table_row" },
  th: { block: "table_header" },
  td: { block: "table_cell" },

  em: { mark: "em" },
  strong: { mark: "strong" },
  link: { mark: "link", getAttrs: (tok: Token) => ({ href: tok.attrGet("href") }) },
  code_inline: { mark: "code", noCloseToken: true },
});

/** Parse a Markdown string straight into a document of our schema. */
export function parseMarkdown(source: string) {
  return markdownParser.parse(source);
}
