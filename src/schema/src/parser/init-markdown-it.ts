import MarkdownIt from 'markdown-it';
import { OVERRIDE_BLOCK_RULE } from './rule-override';

/**
 * Регистрирует все кастомные правила markdown-it.
 *
 * Порядок core-правил важен: каждое следующее правило работает с токенами,
 * которые мог изменить предыдущее (например, `block_table_cell` восстанавливает
 * параграфы внутри ячеек таблиц, а `custom_block_media_rule` выносит медиа
 * в отдельные блоки).
 */
function registerCustomRules(mdInstance: MarkdownIt): void {
  mdInstance.core.ruler.push('block_table_cell', OVERRIDE_BLOCK_RULE['block_table_cell']);
  mdInstance.core.ruler.push('custom_block_media_rule', OVERRIDE_BLOCK_RULE['custom_block_media_rule']);
  // preserve должен идти ДО empty_paragraph: сначала превращаем whitespace-only и indented code_block в paragraph,
  // чтобы empty_paragraph не создал лишние empty_paragraph узлы.
  mdInstance.core.ruler.push('preserve_leading_whitespace', OVERRIDE_BLOCK_RULE['preserve_leading_whitespace']);
  mdInstance.core.ruler.push('empty_paragraph', OVERRIDE_BLOCK_RULE['empty_paragraph']);
  // Регистрируется до встроенного `image`, чтобы перехватить синтаксис
  // `{width=N}` раньше стандартной обработки картинок
  mdInstance.inline.ruler.before('image', 'image_with_size', OVERRIDE_BLOCK_RULE['image_with_size']);
}

export const initMarkdownItWithRules = (): MarkdownIt => {
  const md = MarkdownIt('default', {
    html: false,
  })
    .enable('strikethrough')
    .enable('table');

  registerCustomRules(md);

  return md;
};
