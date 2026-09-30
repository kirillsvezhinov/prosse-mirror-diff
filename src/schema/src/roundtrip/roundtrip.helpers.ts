import { expect } from 'vitest';
import type { Node as PMNode } from 'prosemirror-model';
import { parser } from '../parser';
import { serializer } from '../serializer';

/** Полный круг: markdown -> документ -> markdown. */
export const roundTrip = (markdown: string): string => serializer.serialize(parser.parse(markdown));

/**
 * Строка переживает круг без изменений, и повторный круг тоже ничего не меняет.
 *
 * Второй проход проверяется отдельно намеренно: документ уезжает соредакторам по yjs,
 * и если сохранение дважды даёт другую строку, чем сохранение один раз, стейт клиентов
 * разъезжается. Совпадение первого прохода такую ошибку не ловит.
 */
export const expectStable = (markdown: string): void => {
  const once = roundTrip(markdown);

  expect(once).toBe(markdown);
  expect(roundTrip(once)).toBe(once);
};

/**
 * Круг приводит строку к каноническому виду.
 * Канонический вид обязан быть неподвижной точкой — иначе нормализация бесконечна.
 */
export const expectNormalized = (source: string, expected: string): void => {
  expect(roundTrip(source)).toBe(expected);
  expectStable(expected);
};

const describeNode = (node: PMNode): string => {
  if (node.isText) {
    const marks = node.marks.map((mark) => mark.type.name).join(',');

    return `text${marks ? `[${marks}]` : ''} ${JSON.stringify(node.text)}`;
  }

  return node.type.name;
};

/**
 * Компактное дерево документа для структурных проверок — читается глазами,
 * в отличие от `doc.toJSON()`.
 */
export const outline = (node: PMNode, depth = 0): string => {
  const lines = [`${'  '.repeat(depth)}${describeNode(node)}`];

  node.forEach((child) => {
    lines.push(outline(child, depth + 1));
  });

  return lines.join('\n');
};

/** Дерево документа, полученного парсингом строки. */
export const outlineOf = (markdown: string): string => outline(parser.parse(markdown));

/**
 * Снипеты, каждый из которых уже записан в каноническом виде: сам по себе
 * проходит `expectStable`. Из них собирается матрица комбинаций.
 */
export const CANONICAL_BLOCKS: Record<string, string> = {
  heading: '# Заголовок',
  paragraph: 'Просто текст',
  bulletList: '* один\n* два',
  orderedList: '1. один\n2. два',
  nestedList: '* один\n  * вложенный',
  blockquote: '> цитата',
  horizontalRule: '---',
  codeFence: '```typescript\nconst a = 1;\n```',
  table: '| a | b |\n| --- | --- |\n| 1 | 2 |',
  image: '![кот](https://example.com/cat.png)',
  file: '[отчёт.pdf](/api/v1/public/content/attachment/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee)',
  inlineMarks: 'текст с *курсивом*, **жирным** и `кодом`',
  link: 'см. [текст](https://example.com)',
};

/** Списки одного типа через пустую строку сливаются в один — см. lists.test.ts. */
export const LIST_BLOCK_NAMES = ['bulletList', 'orderedList', 'nestedList'];
