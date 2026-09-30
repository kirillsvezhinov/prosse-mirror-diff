import { describe, expect, it } from 'vitest';
import type { Node as PMNode } from 'prosemirror-model';
import { CODE_BLOCK_NODE, EMPTY_PARAGRAPH, FILE_NODE_NAME, IMAGE_NODE_NAME } from './blocks';
import { FileType } from './blocks/media-block/types/file-type';
import { LoadStatus } from './blocks/media-block/types/load-status';
import { schema } from './schema';
import { parser } from './parser';
import { serializer } from './serializer';

describe('Схема: defaultType и согласованность', () => {
  // empty_paragraph добавлен перед paragraph → defaultType для doc/table_cell.
  // list_item переопределён на `paragraph block*` → defaultType = paragraph.
  it('doc.createAndFill заполняется empty_paragraph как defaultType', () => {
    const doc = schema.topNodeType.createAndFill();

    expect(doc).not.toBeNull();
    expect(doc?.childCount).toBe(1);
    expect(doc?.firstChild?.type.name).toBe('empty_paragraph');
  });

  it('table_cell.createAndFill заполняется empty_paragraph как defaultType', () => {
    const cellType = schema.nodes.table_cell;

    if (!cellType) {
      throw new Error('table_cell is missing from schema');
    }

    const cell = cellType.createAndFill();

    expect(cell).not.toBeNull();
    expect(cell?.firstChild?.type.name).toBe('empty_paragraph');
  });

  it('list_item.createAndFill заполняется paragraph как defaultType', () => {
    const item = schema.nodes.list_item?.createAndFill();

    expect(item).not.toBeNull();
    expect(item?.childCount).toBe(1);
    expect(item?.firstChild?.type.name).toBe('paragraph');
    expect(item?.firstChild?.textContent).toBe('');
  });
});

describe('Сохранение пустых строк между markdown-блоками', () => {
  it('сохраняет одну пустую строку между параграфами', () => {
    const source = 'Текст 1\n\nТекст 2';
    const doc = parser.parse(source);

    expect(doc.childCount).toBe(3);
    expect(doc.child(1).type.name).toBe('empty_paragraph');
    expect(serializer.serialize(doc)).toBe(source);
  });

  it.each([
    ['три пустые строки', 'Текст 1\n\n\n\nТекст 2', 5],
    ['пять пустых строк', 'Текст 1\n\n\n\n\n\nТекст 2', 7],
  ])('%s между параграфами', (_description, source, expectedChildCount) => {
    const doc = parser.parse(source);

    // Общее количество узлов = 2 параграфа + количество пустых строк.
    expect(doc.childCount).toBe(expectedChildCount);
    expect(serializer.serialize(doc)).toBe(source);
  });

  it('не создаёт empty_paragraph внутри code_block', () => {
    const source = 'Текст\n\n```plaintext\nconst a = 1;\n\nconst b = 2;\n```\n\nТекст 2';
    const doc = parser.parse(source);

    // Перенос строки внутри code_block — это его содержимое,
    // а не разделитель блоков.
    expect(doc.childCount).toBe(5);
    expect(doc.child(0).type.name).toBe('paragraph');
    expect(doc.child(1).type.name).toBe('empty_paragraph');
    expect(doc.child(2).type.name).toBe('code_block');
    expect(doc.child(2).textContent).toContain('const a = 1;\n\nconst b = 2;');
    expect(doc.child(3).type.name).toBe('empty_paragraph');
    expect(doc.child(4).type.name).toBe('paragraph');
    expect(serializer.serialize(doc)).toBe(source);
  });

  it('сохраняет пустые строки в начале и конце документа', () => {
    const source = '\n\nТекст 1\n\nТекст 2\n\n';
    const doc = parser.parse(source);

    expect(doc.childCount).toBe(7);
    expect(serializer.serialize(doc)).toBe(source);
  });

  it('сохраняет пустые строки после заголовка', () => {
    const source = '# Заголовок\n\n\nТекст';
    const doc = parser.parse(source);

    // Правило работает между любыми соседними top-level блоками,
    // поэтому между heading и paragraph сохраняются обе пустые строки.
    expect(doc.childCount).toBe(4);
    expect(doc.child(0).type.name).toBe('heading');
    expect(doc.child(1).type.name).toBe('empty_paragraph');
    expect(doc.child(2).type.name).toBe('empty_paragraph');
    expect(doc.child(3).type.name).toBe('paragraph');

    expect(serializer.serialize(doc)).toBe(source);
  });

  it('вставляет empty_paragraph между blockquote и paragraph', () => {
    const source = '> Цитата\n\n\nТекст';
    const doc = parser.parse(source);

    // Правило работает между любыми соседними top-level блоками,
    // поэтому между blockquote и paragraph сохраняются обе пустые строки.
    expect(doc.childCount).toBe(4);
    expect(doc.child(0).type.name).toBe('blockquote');
    expect(doc.child(1).type.name).toBe('empty_paragraph');
    expect(doc.child(2).type.name).toBe('empty_paragraph');
    expect(doc.child(3).type.name).toBe('paragraph');

    expect(serializer.serialize(doc)).toBe(source);
  });

  it('не вставляет empty_paragraph между пунктами одного списка', () => {
    // Вложенные параграфы внутри bullet_list имеют level > 0 и должны
    // игнорироваться. Иначе empty_paragraph попали бы между list_item
    // и сломали список.
    const source = '* a\n* b\n* c';
    const doc = parser.parse(source);

    expect(doc.childCount).toBe(1);
    expect(doc.child(0).type.name).toBe('bullet_list');
    const list = doc.firstChild!;
    expect(list.attrs.tight).toBe(true);
    expect(list.childCount).toBe(3);
    expect(list.child(0).textContent).toBe('a');
    expect(list.child(1).textContent).toBe('b');
    expect(list.child(2).textContent).toBe('c');
  });

  it('сохраняет пустые строки между пунктами loose bullet_list (tight=false)', () => {
    const source = '* a\n\n* b\n\n* c';
    const doc = parser.parse(source);

    expect(doc.childCount).toBe(1);
    expect(doc.child(0).type.name).toBe('bullet_list');
    expect(doc.child(0).attrs.tight).toBe(false);
    expect(serializer.serialize(doc)).toBe(source);
  });

  it('сохраняет пустые строки между пунктами loose ordered_list (tight=false)', () => {
    const source = '1. a\n\n2. b\n\n3. c';
    const doc = parser.parse(source);

    expect(doc.childCount).toBe(1);
    expect(doc.child(0).type.name).toBe('ordered_list');
    expect(doc.child(0).attrs.tight).toBe(false);
    expect(serializer.serialize(doc)).toBe(source);
  });

  it('не дублирует пустые строки вокруг блочной картинки', () => {
    const attachmentId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const source = `Text before\n\n![alt](/api/v1/public/content/attachment/${attachmentId})\n\nText after`;
    const doc = parser.parse(source);

    const names = Array.from({ length: doc.childCount }, (_, i) => doc.child(i).type.name);
    expect(names).toEqual(['paragraph', 'empty_paragraph', 'custom_image_node', 'empty_paragraph', 'paragraph']);
    // Сериализатор картинки подставляет fileName из attrs; важен round-trip
    // структуры блоков и отсутствие лишних пустых строк вокруг медиа.
    const roundTrip = serializer.serialize(doc);
    expect(roundTrip.split('\n\n').length).toBe(source.split('\n\n').length);
    expect(parser.parse(roundTrip).childCount).toBe(doc.childCount);
    expect(serializer.serialize(parser.parse(roundTrip))).toBe(roundTrip);
  });

  it('не дублирует пустые строки вокруг file_attachment', () => {
    const attachmentId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const source = `Before\n\n[report.pdf](/api/v1/public/content/attachment/${attachmentId})\n\nAfter`;
    const doc = parser.parse(source);

    const names = Array.from({ length: doc.childCount }, (_, i) => doc.child(i).type.name);
    expect(names).toEqual(['paragraph', 'empty_paragraph', 'file_attachment', 'empty_paragraph', 'paragraph']);
    expect(serializer.serialize(doc)).toBe(source);
  });

  it('идемпотентен parse→serialize→parse→serialize для смешанного документа', () => {
    const attachmentId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const source = [
      '# Title',
      '',
      'Paragraph',
      '',
      '* a',
      '',
      '* b',
      '',
      `![img](/api/v1/public/content/attachment/${attachmentId})`,
      '',
      'Tail',
      '',
    ].join('\n');

    const once = serializer.serialize(parser.parse(source));
    const twice = serializer.serialize(parser.parse(once));

    expect(twice).toBe(once);
  });

  it('не вставляет empty_paragraph между параграфами внутри blockquote', () => {
    // Внутри blockquote параграф имеет level > 0 и должен игнорироваться.
    const source = '> Цитата 1\n> Цитата 2';
    const doc = parser.parse(source);

    expect(doc.childCount).toBe(1);
    expect(doc.child(0).type.name).toBe('blockquote');
  });

  it('сохраняет вложенный bullet_list', () => {
    // Внутренний bullet_list имеет level=0, но лежит внутри list_item
    // внешнего списка. Правило не должно ломать структуру списка.
    const source = '* a\n  * a1\n  * a2\n* b';
    const doc = parser.parse(source);

    expect(doc.childCount).toBe(1);
    expect(doc.child(0).type.name).toBe('bullet_list');
    const listText = serializer.serialize(doc);
    expect(listText).toContain('a1');
    expect(listText).toContain('a2');
  });

  it('вставляет empty_paragraph между blockquote и paragraph (1 пустая строка)', () => {
    const source = '> Цитата\n\nТекст';
    const doc = parser.parse(source);

    expect(doc.childCount).toBe(3);
    expect(doc.child(0).type.name).toBe('blockquote');
    expect(doc.child(1).type.name).toBe('empty_paragraph');
    expect(doc.child(2).type.name).toBe('paragraph');
    expect(serializer.serialize(doc)).toBe(source);
  });

  it('сериализует пустой документ в пустую строку', () => {
    const doc = parser.parse('');

    expect(doc.childCount).toBe(1);
    expect(serializer.serialize(doc)).toBe('');
  });

  it('сохраняет пустые строки после ordered_list', () => {
    const source = '1. a\n2. b\n3. c\n\n\n';
    const doc = parser.parse(source);

    expect(doc.childCount).toBe(4);
    expect(doc.child(0).type.name).toBe('ordered_list');
    expect(doc.child(1).type.name).toBe('empty_paragraph');
    expect(doc.child(2).type.name).toBe('empty_paragraph');
    expect(doc.child(3).type.name).toBe('empty_paragraph');
    expect(serializer.serialize(doc)).toBe(source);
  });
});

describe('Сохранение переноса строки внутри параграфа', () => {
  it('одиночный перенос строки внутри параграфа сохраняется как <br>', () => {
    const source = 'Строка 1\nСтрока 2';
    const doc = parser.parse(source);

    expect(doc.childCount).toBe(1);
    const paragraph = doc.firstChild!;
    expect(paragraph.type.name).toBe('paragraph');
    expect(paragraph.child(1).type.name).toBe('hard_break');
    expect(serializer.serialize(doc)).toBe(source);
  });

  it('перенос строки сохраняется при сериализации обратно в markdown', () => {
    const source = 'A\nB\nC';
    const doc = parser.parse(source);
    const serialized = serializer.serialize(doc);

    expect(serialized).toBe(source);
  });
});

describe('empty_paragraph внутри ячеек таблицы', () => {
  /**
   * Возвращает имена типов дочерних узлов первой ячейки тела таблицы.
   * `doc.lastChild` — таблица, `.child(1)` — первая строка тела (заголовок — `.child(0)`),
   * `.firstChild` — первая `table_cell` в этой строке.
   */
  const firstBodyCellChildTypes = (md: string): Array<string> => {
    const doc = parser.parse(md);
    const cell = doc.lastChild!.child(1).firstChild!;

    return cellChildTypes(cell);
  };

  /**
   * Возвращает имена типов дочерних узлов переданной ячейки таблицы.
   */
  const cellChildTypes = (cell: PMNode): Array<string> =>
    Array.from({ length: cell.childCount }, (_, i) => cell.child(i).type.name);

  it('одиночный <br> в ячейке: один параграф с переносом строки внутри (проверка, что прежнее поведение не сломалось)', () => {
    const source = '| a | b |\n| --- | --- |\n| line1<br>line2 | y |';

    expect(firstBodyCellChildTypes(source)).toEqual(['paragraph']);
    const doc = parser.parse(source);
    const paragraph = doc.lastChild!.child(1).firstChild!.firstChild!;

    expect(paragraph.childCount).toBe(3);
    expect(paragraph.child(1).type.name).toBe('hard_break');
  });

  it('две пустые строки (два <br> подряд) в ячейке дают разрыв параграфа: [paragraph, empty_paragraph, paragraph]', () => {
    const source = '| a | b |\n| --- | --- |\n| line1<br><br>line2 | y |';

    expect(firstBodyCellChildTypes(source)).toEqual(['paragraph', 'empty_paragraph', 'paragraph']);
  });

  it('три <br> подряд в ячейке = две пустые строки между параграфами', () => {
    const source = '| a | b |\n| --- | --- |\n| line1<br><br><br>line2 | y |';

    expect(firstBodyCellChildTypes(source)).toEqual(['paragraph', 'empty_paragraph', 'empty_paragraph', 'paragraph']);
  });

  it('четыре <br> подряд в ячейке = три пустые строки между параграфами (согласовано с общим правилом empty_paragraph)', () => {
    const source = '| a | b |\n| --- | --- |\n| x<br><br><br><br>y | y |';

    expect(firstBodyCellChildTypes(source)).toEqual([
      'paragraph',
      'empty_paragraph',
      'empty_paragraph',
      'empty_paragraph',
      'paragraph',
    ]);
  });

  it('двустороннее преобразование: после сериализации и повторного разбора сохраняется структура с пустой строкой в ячейке', () => {
    const source = '| a | b |\n| --- | --- |\n| line1<br><br>line2 | y |';
    const doc = parser.parse(source);
    const serialized = serializer.serialize(doc);

    expect(serialized).toContain('<br><br>');

    const reparsed = parser.parse(serialized);
    const cell = reparsed.lastChild!.child(1).firstChild!;

    expect(cellChildTypes(cell)).toEqual(['paragraph', 'empty_paragraph', 'paragraph']);
  });

  it('двустороннее преобразование идемпотентно: повторная сериализация не меняет результат', () => {
    const source = '| a | b |\n| --- | --- |\n| line1<br><br>line2 | y |';
    const once = serializer.serialize(parser.parse(source));
    const twice = serializer.serialize(parser.parse(once));

    expect(twice).toBe(once);
  });

  it('пустая ячейка по-прежнему становится одним узлом empty_paragraph', () => {
    const source = '| a | b |\n| --- | --- |\n|  | y |';

    expect(firstBodyCellChildTypes(source)).toEqual(['empty_paragraph']);
  });

  it('ячейка заголовка (th) обрабатывается так же, как ячейка тела таблицы (td)', () => {
    // Ставим <br><br> в заголовок, чтобы проверить, что th-контент проходит
    // ту же трансформацию, что и td.
    const source = '| a<br><br>b | y |\n| --- | --- |\n| c | d |';
    const doc = parser.parse(source);
    const firstHeaderCell = doc.lastChild!.firstChild!.firstChild!;

    expect(cellChildTypes(firstHeaderCell)).toEqual(['paragraph', 'empty_paragraph', 'paragraph']);
  });

  it('соседние ячейки одной строки обрабатываются независимо: <br><br> в одной не влияет на другую', () => {
    const source = '| a | b |\n| --- | --- |\n| x<br><br>y | single |';
    const doc = parser.parse(source);
    const row = doc.lastChild!.child(1);
    const firstCell = row.firstChild!;
    const secondCell = row.child(1);

    expect(cellChildTypes(firstCell)).toEqual(['paragraph', 'empty_paragraph', 'paragraph']);
    expect(cellChildTypes(secondCell)).toEqual(['paragraph']);
  });

  it('сериализация структуры [paragraph, empty_paragraph, paragraph] даёт в ячейке <br><br>', () => {
    const source = '| a | b |\n| --- | --- |\n| x<br><br>y | z |';
    const doc = parser.parse(source);
    const serialized = serializer.serialize(doc);

    // Один `<br>` для переноса строки в ячейке, один `<br>` для empty_paragraph
    // между параграфами. Итого `<br><br>`.
    expect(serialized).toMatch(/\| x<br><br>y \|/);
  });
});

describe('code_block: язык и границы', () => {
  it('fence с поддерживаемым языком сохраняет language и раунд-трипится', () => {
    const source = '```typescript\nconst a = 1;\n```';
    const doc = parser.parse(source);

    expect(doc.child(0).type.name).toBe(CODE_BLOCK_NODE);
    expect(doc.child(0).attrs.language).toBe('typescript');
    expect(serializer.serialize(doc)).toBe(source);
  });

  it('fence с неизвестным языком приводится к plaintext', () => {
    const doc = parser.parse('```cobol\ncode\n```');

    expect(doc.child(0).attrs.language).toBe('plaintext');
  });

  it('отступный текст (4+ пробела) не становится code_block — превращается в paragraph с исходными пробелами (preserveLeadingWhitespaceRule)', () => {
    const source = '    const a = 1;';
    const doc = parser.parse(source);

    expect(doc.child(0).type.name).toBe('paragraph');
    expect(doc.child(0).textContent).toBe(source);
    expect(serializer.serialize(doc)).toBe(source);
  });

  it('инлайн-код оборачивается в mark `code` и раунд-трипится backtick-синтаксисом', () => {
    const source = 'a `code` b';
    const doc = parser.parse(source);
    const codeText = doc.firstChild!.child(1);

    expect(codeText.marks.map((mark) => mark.type.name)).toContain('code');
    expect(serializer.serialize(doc)).toBe(source);
  });
});

describe('link: обычная ссылка (не attachment)', () => {
  it('парсится в mark `link` с href/title и раунд-трипится', () => {
    const source = '[текст](https://example.com "заголовок")';
    const doc = parser.parse(source);
    const linkMark = doc.firstChild!.firstChild!.marks.find((mark) => mark.type.name === 'link');

    expect(linkMark).toBeDefined();
    expect(linkMark?.attrs.href).toBe('https://example.com');
    expect(linkMark?.attrs.title).toBe('заголовок');
    expect(serializer.serialize(doc)).toBe(source);
  });

  it('поля getAttrs, не объявленные в схеме mark (target/isAttachmentLink), не попадают в attrs', () => {
    const doc = parser.parse('[текст](https://example.com)');
    const linkMark = doc.firstChild!.firstChild!.marks.find((mark) => mark.type.name === 'link');

    expect(linkMark?.attrs).not.toHaveProperty('target');
    expect(linkMark?.attrs).not.toHaveProperty('isAttachmentLink');
  });
});

describe(`${IMAGE_NODE_NAME}: атрибуты`, () => {
  it('внешний (не-attachment) URL: attachmentId=null, status=completed, раунд-трип сохраняет {width=N}', () => {
    const source = '![alt](https://example.com/pic.png){width=200}';
    const doc = parser.parse(source);
    const image = doc.firstChild!;

    expect(image.type.name).toBe(IMAGE_NODE_NAME);
    expect(image.attrs.fileName).toBe('alt');
    expect(image.attrs.attachmentId).toBeNull();
    expect(image.attrs.status).toBe(LoadStatus.COMPLETED);
    expect(image.attrs.progress).toBe(100);
    expect(image.attrs.downloadUrl).toBe('https://example.com/pic.png');
    expect(image.attrs.width).toBe(200);
    expect(image.attrs.height).toBeNull();
    expect(image.attrs.fileType).toBe(FileType.OTHER);
    expect(serializer.serialize(doc)).toBe(source);
  });

  it('attachment URL: attachmentId извлекается, status=pending, раунд-трип восстанавливает тот же URL', () => {
    const attachmentId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const source = `![photo](/api/v1/public/content/attachment/${attachmentId})`;
    const doc = parser.parse(source);
    const image = doc.firstChild!;

    expect(image.attrs.attachmentId).toBe(attachmentId);
    expect(image.attrs.status).toBe(LoadStatus.PENDING);
    expect(image.attrs.progress).toBe(0);
    expect(serializer.serialize(doc)).toBe(source);
  });
});

describe(`${FILE_NODE_NAME}: атрибуты`, () => {
  it('извлекает attachmentId, fileName и mimeType/fileType по расширению из имени файла', () => {
    const attachmentId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const source = `[report.pdf](/api/v1/public/content/attachment/${attachmentId})`;
    const doc = parser.parse(source);
    const file = doc.firstChild!;

    expect(file.type.name).toBe(FILE_NODE_NAME);
    expect(file.attrs.fileName).toBe('report.pdf');
    expect(file.attrs.attachmentId).toBe(attachmentId);
    expect(file.attrs.mimeType).toBe('application/pdf');
    expect(file.attrs.fileType).toBe(FileType.PDF);
    expect(file.attrs.status).toBe(LoadStatus.COMPLETED);
    expect(file.attrs.progress).toBe(100);
    expect(serializer.serialize(doc)).toBe(source);
  });
});

describe('table: базовая структура и сериализация', () => {
  it('строит table/table_row/table_header/table_cell и корректно раунд-трипится', () => {
    const source = '| a | b | c |\n| --- | --- | --- |\n| 1 | 2 | 3 |\n| 4 | 5 | 6 |';
    const doc = parser.parse(source);
    const table = doc.firstChild!;

    expect(table.type.name).toBe('table');
    expect(table.childCount).toBe(3);
    expect(table.child(0).child(0).type.name).toBe('table_header');
    expect(table.child(1).child(0).type.name).toBe('table_cell');
    expect(serializer.serialize(doc)).toBe(source);
  });

  it('строка-разделитель заголовка всегда `--- ` — атрибуты выравнивания схемой не поддерживаются', () => {
    const source = '| a | b |\n| :---: | ---: |\n| 1 | 2 |';
    const doc = parser.parse(source);

    expect(serializer.serialize(doc)).toContain('| --- | --- |');
  });
});

describe('ordered_list: стартовый номер', () => {
  it('сохраняет order, отличный от 1, и раунд-трипится', () => {
    const source = '5. a\n6. b\n7. c';
    const doc = parser.parse(source);

    expect(doc.child(0).type.name).toBe('ordered_list');
    expect(doc.child(0).attrs.order).toBe(5);
    expect(serializer.serialize(doc)).toBe(source);
  });
});

describe('list_item: defaultType при парсинге', () => {
  it('дочерний блок пункта списка — paragraph, а не empty_paragraph', () => {
    const doc = parser.parse('* a');
    const item = doc.firstChild!.firstChild!;

    expect(item.type.name).toBe('list_item');
    expect(item.firstChild!.type.name).toBe('paragraph');
  });
});

describe('инлайн-марки: em/strong/strike', () => {
  it.each([
    ['em', '*курсив*'],
    ['strong', '**жирный**'],
    ['strike', '~~зачёркнутый~~'],
  ])('%s раунд-трипится', (markName, source) => {
    const doc = parser.parse(source);
    const mark = doc.firstChild!.firstChild!.marks.find((item) => item.type.name === markName);

    expect(mark).toBeDefined();
    expect(serializer.serialize(doc)).toBe(source);
  });
});

describe('heading: уровни 1–6', () => {
  it.each([1, 2, 3, 4, 5, 6])('level %i раунд-трипится', (level) => {
    const source = `${'#'.repeat(level)} Заголовок`;
    const doc = parser.parse(source);

    expect(doc.firstChild!.type.name).toBe('heading');
    expect(doc.firstChild!.attrs.level).toBe(level);
    expect(serializer.serialize(doc)).toBe(source);
  });
});

describe('horizontal_rule', () => {
  it('стандартный `---` раунд-трипится', () => {
    const source = '---';
    const doc = parser.parse(source);

    expect(doc.firstChild!.type.name).toBe('horizontal_rule');
    expect(serializer.serialize(doc)).toBe(source);
  });

  it('исходный markdown-синтаксис hr (***) не сохраняется — schema не хранит markup, сериализация всегда даёт `---`', () => {
    const doc = parser.parse('***');

    expect(serializer.serialize(doc)).toBe('---');
  });
});

describe('Схема: инвентарь узлов и марок', () => {
  it('содержит все node-типы, объявленные блоками библиотеки', () => {
    expect(Object.keys(schema.nodes)).toEqual(
      expect.arrayContaining([
        'doc',
        'paragraph',
        'blockquote',
        'horizontal_rule',
        'heading',
        CODE_BLOCK_NODE,
        'text',
        'hard_break',
        'list_item',
        'bullet_list',
        'ordered_list',
        EMPTY_PARAGRAPH,
        IMAGE_NODE_NAME,
        FILE_NODE_NAME,
        'table',
        'table_row',
        'table_cell',
        'table_header',
      ]),
    );
  });

  it('содержит все марки, объявленные блоками библиотеки', () => {
    expect(Object.keys(schema.marks)).toEqual(expect.arrayContaining(['link', 'code', 'em', 'strong', 'strike']));
  });
});
