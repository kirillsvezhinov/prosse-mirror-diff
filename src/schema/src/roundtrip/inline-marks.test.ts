import { describe, expect, it } from 'vitest';
import { parser } from '../parser';
import { expectNormalized, expectStable, outlineOf } from './roundtrip.helpers';

describe('Одиночные марки', () => {
  it.each([
    ['курсив', '*курсив*'],
    ['жирный', '**жирный**'],
    ['зачёркнутый', '~~зачёркнутый~~'],
    ['инлайн-код', '`код`'],
    ['ссылка', '[текст](https://example.com)'],
    ['ссылка с заголовком', '[текст](https://example.com "подпись")'],
    ['автоссылка', '<https://example.com>'],
  ])('%s раунд-трипится', (_name, source) => {
    expectStable(source);
  });

  it('курсив даёт марку em на тексте', () => {
    expect(outlineOf('*курсив*')).toBe(['doc', '  paragraph', '    text[em] "курсив"'].join('\n'));
  });

  it('ссылка сохраняет href и title в атрибутах', () => {
    const doc = parser.parse('[текст](https://example.com "подпись")');
    const mark = doc.firstChild?.firstChild?.marks[0];

    expect(mark?.type.name).toBe('link');
    expect(mark?.attrs.href).toBe('https://example.com');
    expect(mark?.attrs.title).toBe('подпись');
  });
});

describe('Подчёркивание нормализуется в звёздочки', () => {
  it('одиночное подчёркивание — курсив', () => {
    expectNormalized('_курсив_', '*курсив*');
  });

  it('двойное подчёркивание — жирный', () => {
    expectNormalized('__жирный__', '**жирный**');
  });

  it('подчёркивание внутри слова маркой не становится', () => {
    expectStable('snake_case_name');
  });
});

describe('Вложенность марок', () => {
  it('жирный внутри курсива', () => {
    expectStable('*курсив **и жирный***');
  });

  it('курсив внутри жирного', () => {
    expectStable('**жирный *и курсив***');
  });

  it('инлайн-код внутри ссылки', () => {
    expectStable('[`код`](https://example.com)');
  });

  it('несколько марок подряд в одном параграфе', () => {
    expectStable('**жирный** и *курсив* и ~~зачёркнутый~~ и `код`');
  });

  it.each([
    ['жирный вокруг курсива', '***оба***'],
    ['код рядом с жирным', '`код` и **жирный**'],
    ['ссылка вокруг зачёркнутого', '[~~текст~~](https://example.com)'],
  ])('%s', (_name, source) => {
    expectStable(source);
  });
});

describe('Порядок марок приводится к каноническому', () => {
  // Набор марок на тексте — это множество, а не стек: порядок задаётся схемой,
  // а не исходной разметкой. Поэтому запись нормализуется, но содержимое не теряется.
  it('зачёркнутый снаружи жирного переставляется', () => {
    expectNormalized('~~**оба**~~', '**~~оба~~**');
  });

  it('ссылка внутри курсива выносится наружу', () => {
    expectNormalized('[*курсив*](https://example.com)', '*[курсив](https://example.com)*');
  });

  it('зачёркнутый снаружи ссылки убирается внутрь', () => {
    expectNormalized('~~[текст](https://example.com)~~', '[~~текст~~](https://example.com)');
  });

  it('перестановка не теряет ни одной марки', () => {
    const before = parser.parse('~~**оба**~~');
    const after = parser.parse('**~~оба~~**');
    const marksOf = (doc: ReturnType<typeof parser.parse>): Array<string> =>
      (doc.firstChild?.firstChild?.marks ?? []).map((mark) => mark.type.name).sort();

    expect(marksOf(before)).toEqual(['strike', 'strong']);
    expect(marksOf(after)).toEqual(['strike', 'strong']);
  });
});

describe('Марки вплотную к тексту', () => {
  it('курсив без пробелов вокруг', () => {
    expectStable('до*курсив*после');
  });

  it('звёздочка с пробелами курсивом не становится, но экранируется', () => {
    // `* не курсив *` не является курсивом в CommonMark, поэтому остаётся текстом —
    // а текстовая звёздочка при сериализации обязана быть экранирована.
    expectNormalized('текст * не курсив * текст', 'текст \\* не курсив \\* текст');
  });

  it('марка в начале и в конце параграфа', () => {
    expectStable('**начало** середина **конец**');
  });
});

describe('Инлайн-код', () => {
  it('содержит бэктик — обрамление удлиняется', () => {
    expectStable('`` a ` b ``');
  });

  it('содержит символы разметки — они не экранируются внутри кода', () => {
    expectStable('`a * b _ c [d]`');
  });

  it('содержит вертикальную черту', () => {
    expectStable('`a | b`');
  });

  it('код даёт марку code, а не узел', () => {
    expect(outlineOf('`код`')).toBe(['doc', '  paragraph', '    text[code] "код"'].join('\n'));
  });
});
