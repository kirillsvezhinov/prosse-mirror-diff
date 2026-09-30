import { describe, expect, it } from 'vitest';
import { parser } from '../parser';
import { expectNormalized, expectStable, outlineOf } from './roundtrip.helpers';

const ATTACHMENT_URL = '/api/v1/public/content/attachment/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('Структура таблицы', () => {
  it('одна колонка', () => {
    expectStable('| a |\n| --- |\n| 1 |');
  });

  it('три колонки', () => {
    expectStable('| a | b | c |\n| --- | --- | --- |\n| 1 | 2 | 3 |');
  });

  it('несколько строк тела', () => {
    expectStable('| a |\n| --- |\n| 1 |\n| 2 |\n| 3 |');
  });

  it('только заголовок без строк тела', () => {
    expectStable('| a | b |\n| --- | --- |');
  });

  it('структура: table > table_row > table_header/table_cell', () => {
    expect(outlineOf('| a |\n| --- |\n| 1 |')).toBe(
      [
        'doc',
        '  table',
        '    table_row',
        '      table_header',
        '        paragraph',
        '          text "a"',
        '    table_row',
        '      table_cell',
        '        paragraph',
        '          text "1"',
      ].join('\n'),
    );
  });
});

describe('Выравнивание колонок не сохраняется', () => {
  // Схема таблиц из prosemirror-tables не хранит выравнивание,
  // поэтому строка-разделитель всегда приводится к `| --- |`.
  it.each([
    ['по левому краю', '| a | b |\n| :--- | --- |\n| 1 | 2 |'],
    ['по правому краю', '| a | b |\n| ---: | --- |\n| 1 | 2 |'],
    ['по центру', '| a | b |\n| :---: | --- |\n| 1 | 2 |'],
  ])('%s', (_name, source) => {
    expectNormalized(source, '| a | b |\n| --- | --- |\n| 1 | 2 |');
  });
});

describe('Содержимое ячеек', () => {
  it('пустая ячейка', () => {
    expectStable('| a | b |\n| --- | --- |\n|  | 2 |');
  });

  it('пустая ячейка даёт узел empty_paragraph', () => {
    expect(outlineOf('| a |\n| --- |\n|  |')).toContain('empty_paragraph');
  });

  it('инлайн-марки', () => {
    expectStable('| a |\n| --- |\n| *курсив* и **жирный** и ~~зачёркнутый~~ |');
  });

  it('инлайн-код', () => {
    expectStable('| a |\n| --- |\n| `код` |');
  });

  it('ссылка', () => {
    expectStable('| a |\n| --- |\n| [текст](https://example.com) |');
  });

  it('картинка', () => {
    expectStable('| a |\n| --- |\n| ![кот](https://example.com/cat.png) |');
  });

  it('вложение', () => {
    expectStable(`| a |\n| --- |\n| [отчёт.pdf](${ATTACHMENT_URL}) |`);
  });

  it('кириллица', () => {
    expectStable('| Колонка |\n| --- |\n| Значение |');
  });
});

describe('Переносы строк внутри ячейки', () => {
  it('одиночный <br>', () => {
    expectStable('| a |\n| --- |\n| раз<br>два |');
  });

  it('два <br> подряд — разрыв абзаца внутри ячейки', () => {
    expectStable('| a |\n| --- |\n| раз<br><br>два |');
  });

  it('два <br> дают paragraph, empty_paragraph, paragraph', () => {
    const outline = outlineOf('| a |\n| --- |\n| раз<br><br>два |');

    expect(outline).toContain('empty_paragraph');
  });

  it.each([
    ['самозакрывающийся', '| a |\n| --- |\n| раз<br/>два |'],
    ['с пробелом', '| a |\n| --- |\n| раз<br />два |'],
    ['в верхнем регистре', '| a |\n| --- |\n| раз<BR>два |'],
  ])('%s <br> нормализуется к каноничной записи', (_name, source) => {
    expectNormalized(source, '| a |\n| --- |\n| раз<br>два |');
  });
});

describe('Вертикальная черта в ячейке', () => {
  it('экранированная черта переживает круг', () => {
    expectStable('| a |\n| --- |\n| раз \\| два |');
  });

  it('черта остаётся в тексте ячейки', () => {
    const doc = parser.parse('| a |\n| --- |\n| раз \\| два |');

    expect(doc.textContent).toContain('|');
  });
});

describe('Таблица в окружении', () => {
  it('после параграфа', () => {
    expectStable('текст\n\n| a |\n| --- |\n| 1 |');
  });

  it('перед параграфом', () => {
    expectStable('| a |\n| --- |\n| 1 |\n\nтекст');
  });

  it('между заголовками', () => {
    expectStable('# До\n\n| a |\n| --- |\n| 1 |\n\n# После');
  });

  it('внутри пункта списка', () => {
    expectStable('* | a |\n  | --- |\n  | 1 |');
  });
});
