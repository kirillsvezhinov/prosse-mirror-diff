import type { NodeSpec } from 'prosemirror-model';
import { LanguageService } from './language.service';

export interface ICodeBlockAttrs {
  language: string;
}

export const codeBlockSpec: NodeSpec = {
  content: 'text*',
  group: 'block',
  code: true,
  marks: '',
  defining: true,
  isolating: true,
  attrs: {
    language: { default: LanguageService.DEFAULT_LANGUAGE },
  },
};
