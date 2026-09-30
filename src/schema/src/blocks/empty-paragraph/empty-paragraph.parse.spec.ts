import type { ParseSpec } from 'prosemirror-markdown';

export const emptyParagraphParseSpec: Record<string, ParseSpec> = {
  empty_paragraph: { node: 'empty_paragraph' },
};
