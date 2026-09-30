import type { NodeSpec } from 'prosemirror-model';

/**
 * Маркер пустой строки между top-level блоками.
 *
 * На схемотехническом уровне НЕ ставить его перед
 * `paragraph` в schema — иначе он станет defaultType для `doc`, `list_item`
 * и `table_cell`. Подробнее — в `normalize-empty-paragraph.plugin.ts`.
 *
 * `selectable: true` нужен, чтобы пользователь мог выделить пустой
 * параграф и изменить его содержимое (перевести в обычный параграф).
 */
export const emptyParagraphNodeSpec: NodeSpec = {
  group: 'block',
  content: 'inline*',
  selectable: true,
};
