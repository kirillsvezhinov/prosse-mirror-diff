import { Token } from 'markdown-it';
import type { StateCore } from 'markdown-it';

export function blockTableCellRule(state: StateCore): void {
  const tokens = state.tokens;
  const newTokens: Array<Token> = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) {
      continue;
    }

    const isCellOpen = token.type === 'td_open' || token.type === 'th_open';
    const inlineToken = tokens[i + 1];
    const closeToken = tokens[i + 2];
    const isInline = inlineToken?.type === 'inline';
    const isCellClose = closeToken?.type === 'td_close' || closeToken?.type === 'th_close';

    if (!isCellOpen || !isInline || !isCellClose) {
      newTokens.push(token);
      continue;
    }

    const level = token.level;
    const children = inlineToken.children ?? [];

    newTokens.push(token);
    newTokens.push(...restoreCellBlocksFromInline(state, inlineToken, children, level + 1));
    newTokens.push(closeToken);

    i += 2;
  }

  state.tokens = newTokens;
}

function expandEmbeddedBrTokens(state: StateCore, children: Array<Token>): Array<Token> {
  const result: Array<Token> = [];

  for (const child of children) {
    const content = child.content ?? '';

    if (child.type === 'text' && /<br\s*\/?>/i.test(content)) {
      const parts = content.split(/(<br\s*\/?>)/gi).filter(Boolean);

      for (const part of parts) {
        if (/<br\s*\/?>/i.test(part)) {
          const br = new state.Token('html_inline', '', 0);
          br.content = '<br>';
          br.level = child.level;
          br.block = false;
          result.push(br);
        } else if (part.length > 0) {
          const text = cloneToken(child);
          text.content = part;
          result.push(text);
        }
      }

      continue;
    }

    result.push(child);
  }

  return result;
}

function restoreCellBlocksFromInline(
  state: StateCore,
  sourceInline: Token,
  children: Array<Token>,
  level: number,
): Array<Token> {
  const normalizedChildren = expandEmbeddedBrTokens(state, children);

  return createParagraphWithHardBreaks(state, sourceInline, normalizedChildren, level);
}

type CellSection = { kind: 'paragraph'; children: Array<Token> } | { kind: 'empty_paragraph' };

/**
 * Разбивает содержимое ячейки таблицы на секции:
 *  - 1 br подряд → `hardbreak` внутри текущего параграфа
 *  - 2+ br подряд → разрыв параграфа: закрываем текущую секцию,
 *    вставляем (brCount - 1) маркеров `empty_paragraph`, открываем новую.
 *
 * Согласовано с top-level правилом `empty_paragraph` (см.
 * `empty-paragraph.rule.ts`): N пустых строк = N `empty_paragraph`-узлов.
 * Внутри ячейки роль пустой строки играют подряд идущие `<br>` (или
 * `softbreak`/`hardbreak`).
 *
 * Пустые ячейки (нет ни одного не-br токена) → одна секция `empty_paragraph`.
 */
function createParagraphWithHardBreaks(
  state: StateCore,
  sourceInline: Token,
  children: Array<Token>,
  level: number,
): Array<Token> {
  const sections: Array<CellSection> = [];
  let current: Array<Token> = [];
  let brCount = 0;

  const flushParagraph = (): void => {
    if (current.length === 0) {
      return;
    }
    sections.push({ kind: 'paragraph', children: current });
    current = [];
  };

  const handleBrs = (): void => {
    if (brCount === 1) {
      // Одиночный br внутри уже непустой группы → hardbreak.
      if (current.length > 0) {
        const hardbreak = new state.Token('hardbreak', 'br', 0);
        hardbreak.level = level;
        hardbreak.block = false;
        current.push(hardbreak);
      }
      // br в начале группы игнорируем (визуально не имеет смысла).
    } else if (brCount >= 2) {
      // 2+ br подряд = (brCount - 1) пустых строк между параграфами.
      flushParagraph();
      for (let i = 0; i < brCount - 1; i += 1) {
        sections.push({ kind: 'empty_paragraph' });
      }
    }
    brCount = 0;
  };

  for (const child of children) {
    if (isBrToken(child)) {
      brCount += 1;
      continue;
    }
    handleBrs();
    current.push(child);
  }
  // Хвостовые brs (>0) обрабатываем так же, как и в середине.
  handleBrs();
  flushParagraph();

  if (sections.length === 0) {
    sections.push({ kind: 'empty_paragraph' });
  }

  return sections.flatMap((section) => {
    if (section.kind === 'empty_paragraph') {
      return [createEmptyParagraphToken(state, level)];
    }
    const inline = cloneInlineToken(state, sourceInline, section.children, level);

    return createParagraphTokens(state, inline, level);
  });
}

/**
 * Создаёт токен `empty_paragraph` для вставки между параграфами внутри
 * ячейки таблицы. Level совпадает с уровнем параграфов ячейки
 * (`td_open.level`), чтобы корректно лечь в дерево токенов.
 */
function createEmptyParagraphToken(state: StateCore, level: number): Token {
  const token = new state.Token('empty_paragraph', '', 0);
  token.block = true;
  token.level = level;
  token.map = null;

  return token;
}

function isBrToken(token: Token): boolean {
  const content = (token.content || '').trim().toLowerCase();

  if (token.type === 'hardbreak' || token.type === 'softbreak') {
    return true;
  }

  if (token.type === 'html_inline' || token.type === 'html_block') {
    return content === '<br>' || content === '<br/>' || content === '<br />';
  }

  if (token.type === 'text') {
    return content === '<br>' || content === '<br/>' || content === '<br />';
  }

  return false;
}

function createParagraphTokens(state: StateCore, inlineToken: Token, level: number): Array<Token> {
  const pOpen = new state.Token('paragraph_open', 'p', 1);
  pOpen.block = true;
  pOpen.level = level - 1;

  inlineToken.level = level;

  const pClose = new state.Token('paragraph_close', 'p', -1);
  pClose.block = true;
  pClose.level = level - 1;

  return [pOpen, inlineToken, pClose];
}

function cloneInlineToken(state: StateCore, source: Token, children: Array<Token>, level: number): Token {
  const inline = new state.Token('inline', '', 0);
  inline.content = source.content;
  inline.children = children;
  inline.level = level;
  inline.block = false;
  inline.map = source.map ?? null;

  return inline;
}

function cloneToken(token: Token): Token {
  const copy = Object.create(Object.getPrototypeOf(token)) as Token;

  copy.type = token.type;
  copy.tag = token.tag;
  copy.nesting = token.nesting;
  copy.attrs = token.attrs ? token.attrs.map(([k, v]) => [k, v]) : null;
  copy.map = token.map ? [...token.map] : null;
  copy.level = token.level;
  copy.children = token.children ? [...token.children] : null;
  copy.content = token.content;
  copy.markup = token.markup;
  copy.info = token.info;
  copy.meta = token.meta ? { ...token.meta } : null;
  copy.block = token.block;
  copy.hidden = token.hidden;

  return copy;
}
