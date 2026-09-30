import type { StateCore, Token } from 'markdown-it';
import { splitLines } from '../../../helpers/normalize-newlines';

type BlockToken = Token & {
  map: [start: number, end: number];
};

/**
 * Пустая строка для этого правила — любая, где нет непробельных символов.
 * CommonMark так не считает, но иначе теряются одиночные пробелы вокруг
 * `---` и другие whitespace-only строки между top-level блоками.
 *
 * Ячейки таблицы сюда не входят: у них свой разбор `<br>` в
 * `rule-override.table-cell.ts`.
 */
const EMPTY_LINE_RE = /^\s*$/;

/**
 * Вставляет `empty_paragraph` на каждую пустую строку между top-level
 * блоками, а также до первого и после последнего блока.
 *
 * Смотрит только `level === 0`. Вложенные `list_item` / `blockquote`
 * не трогает — иначе пустые строки попали бы внутрь списка или цитаты.
 *
 * Инстанс markdown-it не мутирует (можно вешать как обычное core-правило).
 * `token.map` меняется только у top-level блоков: эти диапазоны читает
 * только это правило, затем `state.tokens` заменяется новым массивом.
 */
export function emptyParagraphRule(state: StateCore): void {
  const sourceLines = splitLines(state.src);

  trimTrailingEmptyLines(state.tokens, sourceLines);
  state.tokens = insertEmptyParagraphs(state, sourceLines.length);
}

function isTopLevelBlock(token: Token): token is BlockToken {
  return token.block && token.level === 0 && token.map !== null;
}

/**
 * markdown-it часто включает хвостовые пустые строки в `map` блока.
 * Сжимаем конец диапазона, чтобы эти строки стали отдельными
 * `empty_paragraph`, а не частью предыдущего блока.
 */
function trimTrailingEmptyLines(tokens: Array<Token>, sourceLines: Array<string>): void {
  for (const token of tokens) {
    if (!isTopLevelBlock(token)) {
      continue;
    }

    const [start, end] = token.map;
    token.map = [start, trimMapEnd(start, end, sourceLines)];
  }
}

function trimMapEnd(start: number, end: number, sourceLines: Array<string>): number {
  let trimmedEnd = end;

  while (trimmedEnd > start + 1 && EMPTY_LINE_RE.test(sourceLines[trimmedEnd - 1] ?? '')) {
    trimmedEnd -= 1;
  }

  return trimmedEnd;
}

/**
 * `previousBlockEnd` закрывает три случая:
 * - leading-пустые строки, пока равен 0;
 * - промежутки между соседними top-level блоками;
 * - trailing-пустые строки после последнего блока.
 */
function insertEmptyParagraphs(state: StateCore, totalLines: number): Array<Token> {
  const tokens: Array<Token> = [];
  let previousBlockEnd = 0;
  let hasBlock = false;

  for (const token of state.tokens) {
    if (isTopLevelBlock(token)) {
      appendEmptyParagraphs(tokens, state, previousBlockEnd, token.map[0]);

      previousBlockEnd = token.map[1];
      hasBlock = true;
    }

    tokens.push(token);
  }

  if (hasBlock) {
    appendEmptyParagraphs(tokens, state, previousBlockEnd, totalLines);
  }

  return tokens;
}

function appendEmptyParagraphs(tokens: Array<Token>, state: StateCore, startLine: number, endLine: number): void {
  for (let line = startLine; line < endLine; line += 1) {
    tokens.push(createEmptyParagraphToken(state, line));
  }
}

function createEmptyParagraphToken(state: StateCore, line: number): Token {
  const token = new state.Token('empty_paragraph', '', 0);

  token.map = [line, line + 1];
  token.block = true;

  return token;
}
