
import { defaultMarkdownParser } from 'prosemirror-markdown';
import type { ParseSpec } from 'prosemirror-markdown';
import { listIsTight } from '../common/list-is-tight';



export const defaultParseSpec: Record<string, ParseSpec> = {
  ...defaultMarkdownParser.tokens,
  blockquote: { block: 'blockquote' },
  paragraph: { block: 'paragraph' },

  // tight/loose вычисляется по token.hidden у paragraph_open внутри list_item
  // markdown-it не кладёт атрибут tight на bullet_list_open/ordered_list_open — attrGet('tight') всегда null.
  bullet_list: {
    block: 'bullet_list',
    getAttrs: (_tok, tokens, i) => ({ tight: listIsTight(tokens, i) }),
  },

  list_item: { block: 'list_item' },
  ordered_list: {
    block: 'ordered_list',
    getAttrs: (tok, tokens, i) => ({
      tight: listIsTight(tokens, i),
      order: +(tok.attrGet('start') || 1),
    }),
  },

  heading: {
    block: 'heading',
    getAttrs: (tok) => ({ level: +tok.tag.slice(1) }),
  },

  // Сохраняем одиночные переносы строк внутри параграфа как <br>.
  // В дефолте prosemirror-markdown одиночный перенос превращается в
  // обычный пробел, поэтому перенос пропадает. Маппим его в hard_break.
  // Обратный маппинг в сериализаторе пишет одиночный `\n`, чтобы
  // сериализация оставалась обратимой.
  // Ограничение: маппинг глобален (blockquote, list_item и т.д.).
  softbreak: { node: 'hard_break' },
  hardbreak: { node: 'hard_break' },

  em: { mark: 'em' },
  strong: { mark: 'strong' },
  s: { mark: 'strike' },
  hr: { node: 'horizontal_rule' },
};
