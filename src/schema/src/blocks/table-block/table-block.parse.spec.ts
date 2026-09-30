import { ParseSpec } from 'prosemirror-markdown';
import { TABLE_CELL_NODE, TABLE_HEADER_NODE, TABLE_NODE, TABLE_ROW_NODE } from './table.const';

export const tableParseSpec: Record<string, ParseSpec> = {
  table: { block: TABLE_NODE },
  thead: { ignore: true },
  tbody: { ignore: true },
  tr: { block: TABLE_ROW_NODE },
  th: { block: TABLE_HEADER_NODE },
  td: { block: TABLE_CELL_NODE },
};
