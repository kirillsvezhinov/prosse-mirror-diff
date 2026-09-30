import { describe, expect, it, test } from 'vitest';
import { parser } from '../parser';
import { roundTrip } from './roundtrip.helpers';

/**
 * ВЕСЬ ФАЙЛ ЭТО ОШИБКИ, найденные при тестировании
 * Тесты специально помечены fails. После починки эти тесты обязаны упасть — значит их нужно актуализировать
 */

// Такая фигня возможно только при переходе из MD редаткора в Rich
describe('ОШИБКА: марки рядом с инлайн-картинкой теряются', () => {
  // Причина: extractTextFromTokens в src/parser/rule-override.ts при выносе картинки
  // из параграфа собирает только .content текстовых токенов и не восстанавливает
  // em_open / strong_open / link_open.
  // TODO need made it
  const source = '**жирный** ![кот](https://example.com/cat.png) *курсив*';

  test.fails('жирный и курсив превращаются в обычный текст', () => {
    // Намеренно ставим "\n" потому что у нас картинка - блочный элемент живущий на отдельной строке
    expect(roundTrip(source)).toBe('**жирный**\n![кот](https://example.com/cat.png)\n*курсив*');
  });
  // TODO need made it
  test.fails('второй круг отличается от первого — стейт расходится', () => {
    const once = roundTrip(source);
    const twice = roundTrip(once);

    expect(twice).not.toBe(once);
    expect(twice).toBe('**жирный**\n![кот](https://example.com/cat.png)\n*курсив*');
  });

  it('сходится только к третьему кругу', () => {
    const twice = roundTrip(roundTrip(source));

    expect(roundTrip(twice)).toBe(twice);
  });

    // TODO need made it
  it('Ссылка потерялась при соседстве с картинкой', () => {
    expect(roundTrip('см [тут](https://example.com) ![кот](https://example.com/cat.png)')).toBe(
      'см тут \n![кот](https://example.com/cat.png)',
    );
  });

    // TODO need made it
  it('картинка отдельным блоком марки вокруг не теряет', () => {
    // Граница проблемы: пока картинка не делит параграф с текстом, всё цело
    const safe = '**жирный**\n\n![кот](https://example.com/cat.png)\n\n*курсив*';

    expect(roundTrip(safe)).toBe(safe);
  });
});

// TODO need made it
// Не идемпотентный кейс: документ, сохранённый дважды, отличается от сохранённого один раз
describe('ОШИБКА: пробелы по краям инлайн-кода теряются', () => {
  // Причина: prosemirror-markdown добавляет пробел-обрамление только когда содержимое
  // начинается или кончается бэктиком, но не когда оно начинается с пробела.
  // По CommonMark для содержимого " код " нужно писать `` `  код  ` `` — два пробела.

  test.fails('ОШИБКА: содержимое с пробелами по краям не переживает второй круг', () => {
    const source = '`  код  `';
    const once = roundTrip(source);

    expect(once).toBe('`  код  `');
    expect(parser.parse(once).textContent).toBe('  код  ');
  });

  test.fails('ОШИБКА: второй круг отличается от первого', () => {
    const once = roundTrip('`  код  `');

    expect(roundTrip(once)).toBe(once);
    expect(roundTrip(once)).toBe('`  код  `');
  });

  it('код-спан из одного пробела устойчив', () => {
    // Пробел здесь считается контентом инлайн-кода, поэтому пробел сохраняется
    expect(roundTrip('` `')).toBe('` `');
  });
});

// В принципе пофиг, потому что мы не поддерживаем ref на ссылки
describe('WARNING: reference-определения ссылок уничтожаются', () => {
  // Причина: emptyParagraphRule считает «пустой» любую строку, не давшую блочного
  // токена, а reference-правило markdown-it токенов не выдаёт вовсе.
  it('строка определения исчезает, а на её месте появляются пустые строки', () => {
    const source = 'Текст\n\n[label]: /url "title"\n\nСсылка [label][label] тут';

    expect(roundTrip(source)).toBe('Текст\n\n\n\nСсылка [label](/url "title") тут');
  });

  it('reference-ссылка переписывается в инлайновую', () => {
    const doc = parser.parse('[label]: /url "title"\n\nСсылка [label][label] тут');

    expect(doc.textContent).toContain('Ссылка label тут');
  });

  it('результат при этом идемпотентен — теряется только исходная запись', () => {
    const once = roundTrip('Текст\n\n[label]: /url "title"\n\nСсылка [label][label] тут');

    expect(roundTrip(once)).toBe(once);
  });
});

// Для картинки и файлов в принципе пофиг, но оставлю тест, чтоб при смене поведения сразу видеть че поменялось
describe('WARNING: хвост attachment-URL отбрасывается в картинках и файлах', () => {
  // Причина: extractAttachmentId матчит только префикс с UUID, а MediaSerializer
  // собирает URL заново из одного attachmentId.
  const BASE = '/api/v1/public/content/attachment/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  it('query-параметры теряются', () => {
    expect(roundTrip(`[о.pdf](${BASE}?v=2)`)).toBe(`[о.pdf](${BASE})`);
  });

  it('хвостовой сегмент пути теряется', () => {
    expect(roundTrip(`[о.pdf](${BASE}/download)`)).toBe(`[о.pdf](${BASE})`);
  });

  it('у картинки-вложения хвост теряется так же', () => {
    expect(roundTrip(`![кот](${BASE}?size=large)`)).toBe(`![кот](${BASE})`);
  });
});
