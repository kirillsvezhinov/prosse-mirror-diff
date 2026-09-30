import { describe, expect, it } from 'vitest';
import { parser } from '../parser';
import { expectStable, outlineOf, roundTrip } from './roundtrip.helpers';

describe('Заголовки', () => {
  it.each([1, 2, 3, 4, 5, 6])('уровень %i раунд-трипится', (level) => {
    expectStable(`${'#'.repeat(level)} Заголовок`);
  });

  it('уровень сохраняется в атрибутах узла', () => {
    const doc = parser.parse('### Третий');

    expect(doc.firstChild?.type.name).toBe('heading');
    expect(doc.firstChild?.attrs.level).toBe(3);
  });

  it('заголовок с инлайн-марками', () => {
    expectStable('# Заголовок с *курсивом* и **жирным**');
  });

  it('заголовок со ссылкой', () => {
    expectStable('# [ссылка](https://example.com)');
  });

  it('заголовок с инлайн-кодом', () => {
    expectStable('## Как работает `parser.parse`');
  });

  it('семь решёток — уже не заголовок, а текст', () => {
    expect(outlineOf('####### Не заголовок')).toContain('paragraph');
  });
});

describe('Параграфы', () => {
  it('одно слово', () => {
    expectStable('Слово');
  });

  it('длинный текст с пунктуацией', () => {
    expectStable('Первое предложение. Второе — с тире, запятыми и (скобками)!');
  });

  it('два параграфа через пустую строку', () => {
    expectStable('Первый\n\nВторой');
  });

  it('структура: параграф, пустая строка, параграф', () => {
    expect(outlineOf('Первый\n\nВторой')).toBe(
      ['doc', '  paragraph', '    text "Первый"', '  empty_paragraph', '  paragraph', '    text "Второй"'].join('\n'),
    );
  });
});

describe('Цитаты', () => {
  it('однострочная', () => {
    expectStable('> цитата');
  });

  it('многострочная', () => {
    expectStable('> первая\n> вторая');
  });

  it('вложенная', () => {
    expectStable('> > глубокая');
  });

  it('с двумя абзацами внутри', () => {
    expectStable('> первый\n>\n> второй');
  });

  it('с заголовком внутри', () => {
    expectStable('> # заголовок в цитате');
  });

  it('с марками внутри', () => {
    expectStable('> цитата с *курсивом*');
  });
});

describe('Горизонтальная линия', () => {
  it('раунд-трипится', () => {
    expectStable('---');
  });

  it('между блоками текста', () => {
    expectStable('текст\n\n---\n\nещё текст');
  });

  it('единственным содержимым документа', () => {
    expect(outlineOf('---')).toBe(['doc', '  horizontal_rule'].join('\n'));
  });
});

describe('Перенос строки внутри параграфа', () => {
  it('одиночный перенос раунд-трипится', () => {
    expectStable('строка1\nстрока2');
  });

  it('три строки подряд', () => {
    expectStable('раз\nдва\nтри');
  });

  it('перенос даёт узел hard_break, а не новый параграф', () => {
    expect(outlineOf('строка1\nстрока2')).toBe(
      ['doc', '  paragraph', '    text "строка1"', '    hard_break', '    text "строка2"'].join('\n'),
    );
  });

  it('перенос внутри пункта списка', () => {
    expectStable('* первая\n  вторая');
  });

  it('перенос внутри цитаты', () => {
    expectStable('> первая\n> вторая');
  });
});

describe('Границы документа', () => {
  it('пустая строка даёт пустой документ', () => {
    expect(roundTrip('')).toBe('');
  });

  it('документ из одного блока', () => {
    expectStable('# Только заголовок');
  });

  it('ведущие пустые строки сохраняются', () => {
    expectStable('\n\nТекст');
  });

  it('хвостовые пустые строки сохраняются', () => {
    expectStable('Текст\n\n');
  });
});
