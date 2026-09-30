import { schema as markdownSchema } from 'prosemirror-markdown';
import type { MarkSpec } from 'prosemirror-model';

export const linkMarkSpec: MarkSpec = {
  ...markdownSchema.spec.marks.get('link'),
};
