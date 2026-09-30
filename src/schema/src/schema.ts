import { schema as markdownSchema } from 'prosemirror-markdown';
import { Schema } from 'prosemirror-model';
import {
  codeBlockSpec,
  emptyParagraphNodeSpec,
  listItemNodeSpec,
  bulletListNodeSpec,
  orderedListNodeSpec,
  imageNodeSpec,
  fileNodeSpec,
  tableNodeSpec,
  linkMarkSpec,
  inlineCodeMarkSpec,
  CODE_BLOCK_NODE,
  FILE_NODE_NAME,
  IMAGE_NODE_NAME,
  EMPTY_PARAGRAPH
} from './blocks';

export const schema = new Schema({
  nodes: markdownSchema.spec.nodes
    .update(CODE_BLOCK_NODE, codeBlockSpec)
    // empty_paragraph стоит перед paragraph в группе `block`, поэтому
    // становится типом по умолчанию для doc и table_cell. Это нужно, чтобы
    // Enter между абзацами сохранял пустые строки при сериализации в markdown —
    // без этого пользовательские пустые строки терялись бы при сохранении.
    //
    // Но для list_item этот же тип по умолчанию — баг: пустой пункт списка
    // получал empty_paragraph, и при нажатии Backspace внутри списка редактор
    // воспринимал удаление последнего символа как создание нового пункта
    // вместо обычного удаления текста. Поэтому list_item переопределён
    // ниже на content: 'paragraph block*' — типом по умолчанию пункта
    // становится paragraph, и Backspace работает как ожидается.
    .addBefore('paragraph', EMPTY_PARAGRAPH, emptyParagraphNodeSpec)
    .update('list_item', listItemNodeSpec)
    // По умолчанию tight=true, чтобы списки, созданные в режиме rich,
    // сериализовались в markdown без пустых строк между пунктами.
    // Иначе prosemirror-markdown задаёт tight=false, и при смене режима
    // rich на markdown каждая строка списка отделяется пустой строкой.
    .update('bullet_list', bulletListNodeSpec)
    .update('ordered_list', orderedListNodeSpec)
    .addToEnd(IMAGE_NODE_NAME, imageNodeSpec)
    .addToEnd(FILE_NODE_NAME, fileNodeSpec)
    .append(tableNodeSpec),
  marks: markdownSchema.spec.marks
    .update('link', linkMarkSpec)
    .update('code', inlineCodeMarkSpec)
    .addToEnd('strike', {
      parseDOM: [{ tag: 's' }],
      toDOM() {
        return ['s', 0];
      },
    }),
});

export type TSchema = typeof schema