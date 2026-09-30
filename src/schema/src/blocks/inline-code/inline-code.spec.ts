import { schema as markdownSchema } from 'prosemirror-markdown';
import type { MarkSpec } from 'prosemirror-model';

export const inlineCodeMarkSpec: MarkSpec = {
  ...markdownSchema.spec.marks.get('code'),
  defining: true,
};
