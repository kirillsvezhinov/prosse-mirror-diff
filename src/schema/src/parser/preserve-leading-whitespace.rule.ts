import type { StateCore, Token } from 'markdown-it';
import { splitLines } from '../helpers/normalize-newlines';

const ASCII_TRIMMABLE_RE = /^[ \t]+/;
const WHITESPACE_ONLY_RE = /^[ \t]+$/;

/**
 * markdown-it обрезает ведущие ASCII-пробелы и табы у параграфа
 * (`asciiTrim` в block-правиле `paragraph`) и выкидывает строки
 * из одних пробелов. Без этого правила отступ, вставленный Tab,
 * пропадает при parse → serialize.
 *
 * Правило:
 * - возвращает обрезанный префикс в начало top-level параграфа;
 * - возвращает пробелы после softbreak внутри параграфа;
 * - превращает whitespace-only строку в параграф с этими пробелами,
 *   а не в `empty_paragraph`.
 *
 * Не трогает списки и цитаты (`level > 0`) — там пробелы значат вложенность.
 */
export function preserveLeadingWhitespaceRule(state: StateCore): void {
  const sourceLines = splitLines(state.src);

  convertTopLevelCodeBlocks(state, sourceLines);
  restoreWhitespaceOnlyDocument(state, sourceLines);
  restoreWhitespaceOnlyLines(state, sourceLines);
  restoreParagraphWhitespace(state, sourceLines);
}

function convertTopLevelCodeBlocks(state: StateCore, sourceLines: Array<string>): void {
  const newTokens: Array<Token> = [];

  for (const token of state.tokens) {
    if (token.type === 'code_block' && token.level === 0 && token.map !== null) {
      const map = token.map;
      const content = sourceLines.slice(map[0], map[1]).join('\n');

      const open = new state.Token('paragraph_open', 'p', 1);
      open.block = true;
      open.map = map;
      open.level = 0;

      const textToken = new state.Token('text', '', 0);
      textToken.content = content;

      const inline = new state.Token('inline', '', 0);
      inline.content = content;
      inline.children = [textToken];
      inline.block = true;
      inline.map = map;
      inline.level = 0;

      const close = new state.Token('paragraph_close', 'p', -1);
      close.block = true;
      close.level = 0;

      newTokens.push(open, inline, close);
      continue;
    }

    newTokens.push(token);
  }

  state.tokens = newTokens;
}

/**
 * Документ из одних пробелов markdown-it разбирает в пустой список токенов.
 * `empty_paragraph` тоже ничего не вставляет — нет top-level блоков.
 * Собираем параграфы сами, иначе parse даст пустой `empty_paragraph`.
 */
function restoreWhitespaceOnlyDocument(state: StateCore, sourceLines: Array<string>): void {
  if (state.tokens.length > 0) {
    return;
  }

  const tokens: Array<Token> = [];

  for (let line = 0; line < sourceLines.length; line += 1) {
    const content = sourceLines[line] ?? '';

    if (!WHITESPACE_ONLY_RE.test(content)) {
      continue;
    }

    tokens.push(...createWhitespaceParagraph(state, content, [line, line + 1]));
  }

  state.tokens = tokens;
}

function restoreWhitespaceOnlyLines(state: StateCore, sourceLines: Array<string>): void {
  const tokens: Array<Token> = [];

  for (const token of state.tokens) {
    if (token.type === 'empty_paragraph' && token.map !== null) {
      const line = sourceLines[token.map[0]] ?? '';

      if (WHITESPACE_ONLY_RE.test(line)) {
        tokens.push(...createWhitespaceParagraph(state, line, token.map));
        continue;
      }
    }

    tokens.push(token);
  }

  state.tokens = tokens;
}

function restoreParagraphWhitespace(state: StateCore, sourceLines: Array<string>): void {
  for (let index = 0; index < state.tokens.length; index += 1) {
    const token = state.tokens[index];
    const inline = state.tokens[index + 1];

    if (token?.type !== 'paragraph_open' || token.level !== 0 || token.map === null) {
      continue;
    }

    if (inline?.type !== 'inline') {
      continue;
    }

    restoreSoftbreakWhitespace(state, inline, sourceLines, token.map[0]);

    if (WHITESPACE_ONLY_RE.test(inline.content)) {
      continue;
    }

    const leading = leadingWhitespace(sourceLines[token.map[0]] ?? '');

    if (leading.length === 0) {
      continue;
    }

    if (inline.content.startsWith(leading)) {
      continue;
    }

    prependToInline(state, inline, leading);
  }
}

function restoreSoftbreakWhitespace(
  state: StateCore,
  inline: Token,
  sourceLines: Array<string>,
  startLine: number,
): void {
  const children = inline.children;

  if (!children) {
    return;
  }

  let lineIndex = startLine;
  const newChildren: Array<Token> = [];

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];

    if (!child) {
      continue;
    }

    newChildren.push(child);

    if (child.type !== 'softbreak' && child.type !== 'hardbreak') {
      continue;
    }

    lineIndex += 1;
    const leading = leadingWhitespace(sourceLines[lineIndex] ?? '');

    if (leading.length === 0) {
      continue;
    }

    const next = children[index + 1];

    if (next?.type === 'text') {
      next.content = leading + next.content;
      continue;
    }

    const textToken = new state.Token('text', '', 0);
    textToken.content = leading;
    newChildren.push(textToken);
  }

  inline.children = newChildren;
}

function createWhitespaceParagraph(state: StateCore, content: string, map: [number, number]): Array<Token> {
  const open = new state.Token('paragraph_open', 'p', 1);
  open.block = true;
  open.map = map;

  const textToken = new state.Token('text', '', 0);
  textToken.content = content;

  const inline = new state.Token('inline', '', 0);
  inline.content = content;
  inline.children = [textToken];
  inline.block = true;
  inline.map = map;

  const close = new state.Token('paragraph_close', 'p', -1);
  close.block = true;

  return [open, inline, close];
}

function leadingWhitespace(line: string): string {
  return line.match(ASCII_TRIMMABLE_RE)?.[0] ?? '';
}

function prependToInline(state: StateCore, inline: Token, prefix: string): void {
  inline.content = prefix + inline.content;

  const firstChild = inline.children?.[0];

  if (firstChild?.type === 'text') {
    firstChild.content = prefix + firstChild.content;

    return;
  }

  const textToken = new state.Token('text', '', 0);
  textToken.content = prefix;
  inline.children = [textToken, ...(inline.children ?? [])];
}
