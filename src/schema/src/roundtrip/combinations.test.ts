import { describe, expect, it } from 'vitest';
import { parser } from '../parser';
import { CANONICAL_BLOCKS, expectStable, roundTrip } from './roundtrip.helpers';

const BLOCK_NAMES = Object.keys(CANONICAL_BLOCKS);

/**
 * Списки одного семейства, разделённые пустой строкой, по CommonMark сливаются
 * в один разреженный список. Такие пары проверяются отдельно в lists.test.ts
 */
const LIST_FAMILIES = [
  ['bulletList', 'nestedList'],
  ['orderedList'],
];

const familyOf = (name: string): Array<string> | undefined =>
  LIST_FAMILIES.find((family) => family.includes(name));

const mergesIntoOneList = (first: string, second: string): boolean => {
  const family = familyOf(first);

  return family !== undefined && family === familyOf(second);
};

/** Все имена марок, встречающиеся в документе, — для проверки, что круг ни одну не потерял. */
const collectMarkNames = (markdown: string): Array<string> => {
  const found = new Set<string>();

  parser.parse(markdown).descendants((node) => {
    node.marks.forEach((mark) => found.add(mark.type.name));
  });

  return [...found].sort();
};

const pairs = BLOCK_NAMES.flatMap((first) => BLOCK_NAMES.map((second) => [first, second] as const));
const independentPairs = pairs.filter(([first, second]) => !mergesIntoOneList(first, second));
const mergingPairs = pairs.filter(([first, second]) => mergesIntoOneList(first, second));

describe('Каждый блок по отдельности канонический', () => {
  it.each(BLOCK_NAMES)('%s', (name) => {
    expectStable(CANONICAL_BLOCKS[name]!);
  });
});

describe('Соседство двух блоков', () => {
  it('матрица покрывает все сочетания', () => {
    expect(pairs).toHaveLength(BLOCK_NAMES.length * BLOCK_NAMES.length);
    expect(independentPairs.length + mergingPairs.length).toBe(pairs.length);
  });

  it.each(independentPairs)('%s + %s', (first, second) => {
    expectStable(`${CANONICAL_BLOCKS[first]}\n\n${CANONICAL_BLOCKS[second]}`);
  });

  it.each(mergingPairs)('%s + %s сливаются в один список', (first, second) => {
    const doc = parser.parse(`${CANONICAL_BLOCKS[first]}\n\n${CANONICAL_BLOCKS[second]}`);

    expect(doc.childCount).toBe(1);
    expect(doc.firstChild?.type.name).toBe(first === 'orderedList' ? 'ordered_list' : 'bullet_list');
  });
});

describe('Соседство трёх блоков', () => {
  // Без списков: их слияние — отдельная тема, здесь проверяется именно стык трёх блоков
  const TRIPLE_SOURCE = ['heading', 'paragraph', 'blockquote', 'codeFence', 'table', 'image'];
  const triples = TRIPLE_SOURCE.flatMap((first) =>
    TRIPLE_SOURCE.flatMap((second) => TRIPLE_SOURCE.map((third) => [first, second, third] as const)),
  );

  it.each(triples)('%s + %s + %s', (first, second, third) => {
    expectStable(
      [CANONICAL_BLOCKS[first], CANONICAL_BLOCKS[second], CANONICAL_BLOCKS[third]].join('\n\n'),
    );
  });
});

describe('Вложенность: блок внутри цитаты', () => {
  const intoBlockquote = (markdown: string): string =>
    markdown
      .split('\n')
      .map((line) => (line === '' ? '>' : `> ${line}`))
      .join('\n');

  it.each(BLOCK_NAMES)('%s', (name) => {
    expectStable(intoBlockquote(CANONICAL_BLOCKS[name]!));
  });
});

describe('Вложенность: блок внутри пункта списка', () => {
  const intoListItem = (markdown: string): string =>
    markdown
      .split('\n')
      .map((line, index) => {
        if (index === 0) {
          return `* ${line}`;
        }

        return line === '' ? '' : `  ${line}`;
      })
      .join('\n');

  it.each(BLOCK_NAMES)('%s', (name) => {
    expectStable(intoListItem(CANONICAL_BLOCKS[name]!));
  });
});

describe('Вложенность: содержимое внутри ячейки таблицы', () => {
  const intoCell = (inline: string): string => `| колонка |\n| --- |\n| ${inline} |`;

  it.each([
    ['простой текст', 'значение'],
    ['курсив', '*курсив*'],
    ['жирный', '**жирный**'],
    ['зачёркнутый', '~~зачёркнутый~~'],
    ['инлайн-код', '`код`'],
    ['ссылка', '[текст](https://example.com)'],
    ['картинка', '![кот](https://example.com/cat.png)'],
    ['вложение', '[о.pdf](/api/v1/public/content/attachment/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee)'],
    ['перенос строки', 'раз<br>два'],
    ['разрыв абзаца', 'раз<br><br>два'],
    ['экранированная черта', 'раз \\| два'],
    ['эмодзи', 'готово 🎉'],
  ])('%s', (_name, inline) => {
    expectStable(intoCell(inline));
  });
});

describe('Комбинации инлайн-марок', () => {
  const INLINE = {
    em: (text: string): string => `*${text}*`,
    strong: (text: string): string => `**${text}**`,
    strike: (text: string): string => `~~${text}~~`,
  };
  const NAMES = Object.keys(INLINE) as Array<keyof typeof INLINE>;
  const nestedPairs = NAMES.flatMap((outer) =>
    NAMES.filter((inner) => inner !== outer).map((inner) => [outer, inner] as const),
  );

  it.each(nestedPairs)('%s вокруг %s переживает круг без потери марок', (outer, inner) => {
    const source = INLINE[outer](`до ${INLINE[inner]('внутри')} после`);
    const marksBefore = collectMarkNames(source);

    expect(collectMarkNames(roundTrip(source))).toEqual(marksBefore);
  });

  it.each([
    ['курсив в жирном', '**жирный *и курсив***'],
    ['жирный в курсиве', '*курсив **и жирный***'],
    ['код в ссылке', '[`код`](https://example.com)'],
    ['зачёркнутый в ссылке', '[~~текст~~](https://example.com)'],
    ['марки подряд', '*раз* **два** ~~три~~ `четыре`'],
  ])('%s', (_name, source) => {
    expectStable(source);
  });
});

describe('Границы документа', () => {
  it.each(BLOCK_NAMES)('%s единственным блоком', (name) => {
    expectStable(CANONICAL_BLOCKS[name]!);
  });

  it.each(BLOCK_NAMES)('%s первым блоком документа', (name) => {
    expectStable(`${CANONICAL_BLOCKS[name]}\n\nхвостовой текст`);
  });

  it.each(BLOCK_NAMES)('%s последним блоком документа', (name) => {
    expectStable(`ведущий текст\n\n${CANONICAL_BLOCKS[name]}`);
  });

  it.each([1, 2, 3])('%i пустых строк вокруг блока сохраняются', (count) => {
    const gap = '\n'.repeat(count + 1);

    expectStable(`до${gap}# Заголовок${gap}после`);
  });
});
