import { schema as markdownSchema } from 'prosemirror-markdown';
import type { NodeSpec } from 'prosemirror-model';

/**
 * Переопределения схемы для списков поверх prosemirror-markdown.
 *
 * `list_item.content` переопределён на `paragraph block*`: типом по умолчанию
 * пункта становится paragraph, а не empty_paragraph. Иначе пустой пункт списка
 * получал empty_paragraph, и при нажатии Backspace внутри списка редактор
 * воспринимал удаление последнего символа как создание нового пункта вместо
 * обычного удаления текста.
 *
 * `bullet_list`/`ordered_list` по умолчанию tight=true, чтобы списки,
 * созданные в режиме rich, сериализовались в markdown без пустых строк между
 * пунктами. Иначе prosemirror-markdown задаёт tight=false, и при смене режима
 * rich на markdown каждая строка списка отделяется пустой строкой.
 */
export const listItemNodeSpec: NodeSpec = {
  ...markdownSchema.spec.nodes.get('list_item')!,
  content: 'paragraph block*',
};

export const bulletListNodeSpec: NodeSpec = {
  ...markdownSchema.spec.nodes.get('bullet_list')!,
  attrs: { tight: { default: true } },
};

export const orderedListNodeSpec: NodeSpec = {
  ...markdownSchema.spec.nodes.get('ordered_list')!,
  attrs: { order: { default: 1 }, tight: { default: true } },
};
