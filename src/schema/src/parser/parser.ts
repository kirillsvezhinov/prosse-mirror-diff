import { MarkdownParser } from 'prosemirror-markdown';
import { initMarkdownItWithRules } from './init-markdown-it';
import { mediaTokenSpec } from '../blocks/media-block/specs/media.parse-spec';
import { schema } from '../schema';
import { linkParseSpec } from '../blocks/link-block/link-block.parse.spec';
import { defaultParseSpec } from './default-spec/default.parse.spec';
import { codeParseSpec } from '../blocks/code-block/code.parse.spec';
import { tableParseSpec } from '../blocks/table-block/table-block.parse.spec';
import { emptyParagraphParseSpec } from '../blocks/empty-paragraph/empty-paragraph.parse.spec';

export const parser = new MarkdownParser(schema, initMarkdownItWithRules(), {
  ...defaultParseSpec,
  ...emptyParagraphParseSpec,
  ...codeParseSpec,
  ...tableParseSpec,
  ...mediaTokenSpec,
  ...linkParseSpec,
});
  
