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
 * prosemirror-markdown's own `defaultMarkdownParser` config; images and
 * hard line breaks aren't represented in our schema, so they're dropped
 * (`ignore`) rather than crashing the parse.
 */
const md = new MarkdownIt("commonmark", { html: false });

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
  image: { ignore: true, noCloseToken: true },

  em: { mark: "em" },
  strong: { mark: "strong" },
  link: { mark: "link", getAttrs: (tok: Token) => ({ href: tok.attrGet("href") }) },
  code_inline: { mark: "code", noCloseToken: true },
});

/** Parse a Markdown string straight into a document of our schema. */
export function parseMarkdown(source: string) {
  return markdownParser.parse(source);
}
