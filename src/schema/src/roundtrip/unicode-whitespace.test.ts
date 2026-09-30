import { describe, expect, it } from 'vitest';
import { parser } from '../parser';
import { expectNormalized, expectStable, roundTrip } from './roundtrip.helpers';

describe('Юникод', () => {
  it.each([
    ['кириллица', 'Ёжик, чаща, съезд под ёлкой'],
    ['эмодзи', 'релиз 🎉 готов'],
    ['составной эмодзи', 'семья 👨‍👩‍👧‍👦 тут'],
    ['китайские иероглифы', '文档 测试'],
    ['диакритика', 'café naïve résumé'],
    ['математические знаки', 'a ≤ b ≥ c ≠ d'],
    ['типографские кавычки и тире', '«цитата» — вот так'],
  ])('%s раунд-трипится', (_name, source) => {
    expectStable(source);
  });

  it('эмодзи внутри марки', () => {
    expectStable('**жирный 🎉 текст**');
  });

  it('кириллица в заголовке и списке', () => {
    expectStable('# Заголовок\n\n* пункт первый\n* пункт второй');
  });

  it('кириллица в имени файла вложения', () => {
    expectStable('[отчёт за квартал.pdf](/api/v1/public/content/attachment/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee)');
  });
});

describe('Пробельные символы', () => {
  it('неразрывный пробел сохраняется', () => {
    const source = 'до после';

    expectStable(source);
    expect(parser.parse(source).textContent).toContain(' ');
  });

  it('табуляция внутри текста сохраняется', () => {
    expectStable('до\tпосле');
  });

  it('ведущие пробелы параграфа сохраняются', () => {
    expectStable('  текст с отступом');
  });

  it('хвостовые пробелы строки отбрасываются', () => {
    // Два пробела в конце строки — это разметка hard break, а не содержимое
    expectNormalized('текст   \n\nдругой', 'текст\n\nдругой');
  });
});

describe('Переводы строк', () => {
  it('CRLF приводится к LF', () => {
    // Core-правило normalize самого markdown-it, до любых наших правил
    expectNormalized('строка1\r\nстрока2', 'строка1\nстрока2');
  });

  it('CRLF между блоками', () => {
    expectNormalized('Первый\r\n\r\nВторой', 'Первый\n\nВторой');
  });

  it('одиночный CR приводится к LF', () => {
    expectNormalized('строка1\rстрока2', 'строка1\nстрока2');
  });
});

describe('Пустые документы', () => {
  it('пустая строка', () => {
    expect(roundTrip('')).toBe('');
  });

  it('только перевод строки', () => {
    expect(roundTrip('\n')).toBe('');
  });

  it('строка из одних пробелов сохраняется как параграф', () => {
    // preserveLeadingWhitespaceRule намеренно бережёт пробелы пользователя,
    // поэтому пустым такой документ не считается
    expectStable('   ');
  });
});

describe('Кратность пустых строк', () => {
  it.each([1, 2, 3, 5])('%i пустых строк между параграфами сохраняются', (count) => {
    expectStable(`Первый${'\n'.repeat(count + 1)}Второй`);
  });
});
