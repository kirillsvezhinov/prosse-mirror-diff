import { describe, expect, it } from 'vitest';
import { parser } from '../parser';
import { expectNormalized, expectStable, outlineOf } from './roundtrip.helpers';

describe('Маркированный список', () => {
  it('простой список', () => {
    expectStable('* один\n* два');
  });

  it('один пункт', () => {
    expectStable('* единственный');
  });

  it.each([
    ['дефис', '- один\n- два'],
    ['плюс', '+ один\n+ два'],
  ])('маркер «%s» нормализуется в звёздочку', (_name, source) => {
    expectNormalized(source, '* один\n* два');
  });

  it('структура: bullet_list > list_item > paragraph', () => {
    expect(outlineOf('* один')).toBe(
      ['doc', '  bullet_list', '    list_item', '      paragraph', '        text "один"'].join('\n'),
    );
  });
});

describe('Нумерованный список', () => {
  it('простой список', () => {
    expectStable('1. один\n2. два');
  });

  it('стартовый номер, отличный от единицы, сохраняется', () => {
    expectStable('5. пять\n6. шесть');
  });

  it('стартовый номер попадает в атрибут order', () => {
    const doc = parser.parse('5. пять\n6. шесть');

    expect(doc.firstChild?.type.name).toBe('ordered_list');
    expect(doc.firstChild?.attrs.order).toBe(5);
  });

  it('скобка как делимитер нормализуется в точку', () => {
    expectNormalized('1) один\n2) два', '1. один\n2. два');
  });

  it('повторяющиеся номера перенумеровываются по порядку', () => {
    expectNormalized('1. один\n1. два\n1. три', '1. один\n2. два\n3. три');
  });
});

describe('Вложенность списков', () => {
  it('два уровня', () => {
    expectStable('* один\n  * вложенный');
  });

  it('три уровня', () => {
    expectStable('* a\n  * b\n    * c');
  });

  it('нумерованный внутри маркированного', () => {
    expectStable('* пункт\n  1. раз\n  2. два');
  });

  it('маркированный внутри нумерованного', () => {
    expectStable('1. пункт\n   * раз\n   * два');
  });

  it('структура вложенного списка', () => {
    expect(outlineOf('* один\n  * вложенный')).toBe(
      [
        'doc',
        '  bullet_list',
        '    list_item',
        '      paragraph',
        '        text "один"',
        '      bullet_list',
        '        list_item',
        '          paragraph',
        '            text "вложенный"',
      ].join('\n'),
    );
  });
});

describe('Блоки внутри пункта списка', () => {
  it('второй абзац', () => {
    expectStable('* один\n\n  второй абзац');
  });

  it('блок кода', () => {
    expectStable('* пункт\n\n  ```typescript\n  const a = 1;\n  ```');
  });

  it('цитата', () => {
    expectStable('* пункт\n\n  > цитата');
  });

  it('картинка', () => {
    expectStable('* ![кот](https://example.com/cat.png)');
  });

  it('таблица', () => {
    expectStable('* | a |\n  | --- |\n  | 1 |');
  });

  it('перенос строки внутри пункта', () => {
    expectStable('* первая\n  вторая');
  });
});

describe('Плотные и разреженные списки', () => {
  it('разреженный маркированный сохраняет пустые строки', () => {
    expectStable('* один\n\n* два');
  });

  it('разреженный нумерованный сохраняет пустые строки', () => {
    expectStable('1. один\n\n2. два');
  });

  it('плотность попадает в атрибут tight', () => {
    expect(parser.parse('* один\n* два').firstChild?.attrs.tight).toBe(true);
    expect(parser.parse('* один\n\n* два').firstChild?.attrs.tight).toBe(false);
  });
});

describe('Соседние списки сливаются — семантика CommonMark', () => {
  // Два списка одного типа, разделённые пустой строкой, по CommonMark являются одним разреженным списком
  it('два маркированных списка становятся одним разреженным', () => {
    expectNormalized('* один\n* два\n\n* три\n* четыре', '* один\n\n* два\n\n* три\n\n* четыре');
  });

  it('два нумерованных списка получают сквозную нумерацию', () => {
    expectNormalized('1. один\n2. два\n\n1. три\n2. четыре', '1. один\n\n2. два\n\n3. три\n\n4. четыре');
  });

  it('слияние даёт ровно один узел списка', () => {
    const doc = parser.parse('* один\n* два\n\n* три');

    expect(doc.childCount).toBe(1);
    expect(doc.firstChild?.type.name).toBe('bullet_list');
    expect(doc.firstChild?.childCount).toBe(3);
  });

  it('списки разного типа не сливаются', () => {
    expectStable('* один\n\n1. раз');
  });

  it('списки, разделённые другим блоком, не сливаются', () => {
    expectStable('* один\n\nтекст между\n\n* два');
  });
});
