import { ParseSpec } from 'prosemirror-markdown';
import { LanguageService } from './language.service';
import { CODE_BLOCK_NODE, FALLBACK_PROGRAMMING_LANGUAGE } from './code.const';

export const codeParseSpec: Record<string, ParseSpec> = {
  code_block: {
    block: CODE_BLOCK_NODE,
    noCloseToken: true,
    getAttrs: () => ({
      language: 'plaintext',
    }),
  },

  // fenced code block: ```ts
  fence: {
    block: CODE_BLOCK_NODE,
    noCloseToken: true,
    getAttrs: (tok) => {
      const languageFromAttrs = tok.info?.trim().split(/\s+/)[0] || FALLBACK_PROGRAMMING_LANGUAGE;
      const isAllowed = LanguageService.getAllowedLanguages().includes(languageFromAttrs);
      const language = isAllowed ? languageFromAttrs : FALLBACK_PROGRAMMING_LANGUAGE;

      return {
        language,
      };
    },
  },

  code_inline: { mark: 'code' },
};
