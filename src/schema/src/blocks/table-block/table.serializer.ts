import { MarkdownSerializerState } from 'prosemirror-markdown';
import { Node, Node as PMNode } from 'prosemirror-model';
import { TABLE_CELL_NODE, TABLE_HEADER_NODE, TABLE_NODE, TABLE_ROW_NODE } from './table.const';
import { serializer } from '../../serializer';

export function serializeCellBlocks(cell: PMNode): string {
  const parts: Array<string> = [];

  cell.forEach((block) => {
    const raw = serializer.serialize(block.type.schema.topNodeType.create(null, block));
    parts.push(raw.trim());
  });

  // Не фильтруем пустые строки: empty_paragraph даёт "", а join добавляет `<br>` с обеих сторон.
  return parts.join('<br>').replace(/\n+/g, '<br>');
}

export class TableSerializer {
  private static table(state: MarkdownSerializerState, node: PMNode): void {
    state.renderContent(node);
    state.closeBlock(node);
  }

  private static tableCell(state: MarkdownSerializerState, node: PMNode): void {
    state.write('| ');
    state.write(serializeCellBlocks(node));
    state.write(' ');
  }

  private static tableRow(state: MarkdownSerializerState, node: PMNode, _parent: PMNode, index: number): void {
    state.renderContent(node);
    state.write('|');
    state.ensureNewLine();

    if (index === 0) {
      let delimiter = '|';
      node.forEach((_cell) => {
        delimiter += ' --- |';
      });
      state.write(delimiter);
      state.ensureNewLine();
    }
  }

  public static getNodesSerializerMethods(): Record<
    typeof TABLE_ROW_NODE | typeof TABLE_CELL_NODE | typeof TABLE_HEADER_NODE | typeof TABLE_NODE,
    (state: MarkdownSerializerState, node: Node, parent: Node, index: number) => void
  > {
    return {
      [TABLE_ROW_NODE]: TableSerializer.tableRow,
      [TABLE_CELL_NODE]: TableSerializer.tableCell,
      // `table_header` создаётся парсером из `th_open`/`th_close` первой строки таблицы
      // (см. th: { block: TABLE_HEADER_NODE } в markdown.config.ts). Без этой строки
      // `MarkdownSerializer` в strict-режиме (по умолчанию) бросает
      // "Token type `table_header` not supported by Markdown renderer" на любой таблице.
      // Рендер идентичен `table_cell` (в markdown это всё тот же `| ... |`),
      // поэтому используем тот же `tableCell`.
      [TABLE_HEADER_NODE]: TableSerializer.tableCell,
      [TABLE_NODE]: TableSerializer.table,
    };
  }
}
