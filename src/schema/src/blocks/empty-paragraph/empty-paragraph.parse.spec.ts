import { schema as markdownSchema, ParseSpec } from 'prosemirror-markdown';
import type { Mark, MarkSpec } from 'prosemirror-model';


export const emptyParagraphParseSpec: Record<string, ParseSpec> = {
  empty_paragraph: { node: 'empty_paragraph' },
};
