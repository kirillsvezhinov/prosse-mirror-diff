import { describe, expect, it } from 'vitest';
import { FILE_NODE_NAME, IMAGE_NODE_NAME } from '../blocks';
import { parser } from '../parser';
import { expectNormalized, expectStable, outlineOf } from './roundtrip.helpers';

const ATTACHMENT_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const ATTACHMENT_URL = `/api/v1/public/content/attachment/${ATTACHMENT_ID}`;

describe('Картинки', () => {
  it.each([
    ['внешняя', '![кот](https://example.com/cat.png)'],
    ['внешняя с шириной', '![кот](https://example.com/cat.png){width=100}'],
    ['вложение', `![кот](${ATTACHMENT_URL})`],
    ['вложение с шириной', `![кот](${ATTACHMENT_URL}){width=250}`],
    ['с кириллическим именем', '![снимок экрана.png](https://example.com/s.png)'],
  ])('%s раунд-трипится', (_name, source) => {
    expectStable(source);
  });

  it('картинка — блочный узел, а не инлайн', () => {
    expect(outlineOf('![кот](https://example.com/cat.png)')).toBe(
      ['doc', `  ${IMAGE_NODE_NAME}`].join('\n'),
    );
  });

  it('ширина попадает в атрибут width', () => {
    const doc = parser.parse('![кот](https://example.com/cat.png){width=100}');

    expect(doc.firstChild?.attrs.width).toBe(100);
  });

  it('высоты в синтаксисе нет — атрибут остаётся пустым', () => {
    const doc = parser.parse('![кот](https://example.com/cat.png){width=100}');

    expect(doc.firstChild?.attrs.height).toBeNull();
  });

  it('пустой alt заменяется на file', () => {
    expectNormalized('![](https://example.com/cat.png)', '![file](https://example.com/cat.png)');
  });

  it('две картинки подряд остаются двумя узлами', () => {
    const source = '![a](https://example.com/1.png)\n\n![b](https://example.com/2.png)';

    expectStable(source);
    expect(parser.parse(source).childCount).toBe(3);
  });
});

describe('Атрибуты картинки', () => {
  it('внешний URL: attachmentId пуст, статус completed', () => {
    const attrs = parser.parse('![кот](https://example.com/cat.png)').firstChild?.attrs;

    expect(attrs?.attachmentId).toBeNull();
    expect(attrs?.status).toBe('completed');
    expect(attrs?.progress).toBe(100);
    expect(attrs?.downloadUrl).toBe('https://example.com/cat.png');
    expect(attrs?.fileName).toBe('кот');
  });

  it('URL вложения: attachmentId извлекается, статус pending', () => {
    const attrs = parser.parse(`![кот](${ATTACHMENT_URL})`).firstChild?.attrs;

    expect(attrs?.attachmentId).toBe(ATTACHMENT_ID);
    expect(attrs?.status).toBe('pending');
    expect(attrs?.progress).toBe(0);
    expect(attrs?.downloadUrl).toBe(ATTACHMENT_URL);
  });

  it('localId генерируется для каждого узла свой', () => {
    const doc = parser.parse('![a](https://example.com/1.png)\n\n![b](https://example.com/2.png)');
    const first = doc.child(0).attrs.localId;
    const second = doc.child(2).attrs.localId;

    expect(first).toBeTruthy();
    expect(first).not.toBe(second);
  });
});

describe('Файлы-вложения', () => {
  it.each([
    ['pdf', `[отчёт.pdf](${ATTACHMENT_URL})`],
    ['без расширения', `[отчёт](${ATTACHMENT_URL})`],
    ['с пробелами в имени', `[мой отчёт за год.pdf](${ATTACHMENT_URL})`],
    ['таблица', `[данные.xlsx](${ATTACHMENT_URL})`],
    ['архив', `[исходники.zip](${ATTACHMENT_URL})`],
  ])('%s раунд-трипится', (_name, source) => {
    expectStable(source);
  });

  it('ссылка на вложение становится узлом файла, а не маркой link', () => {
    expect(outlineOf(`[отчёт.pdf](${ATTACHMENT_URL})`)).toBe(['doc', `  ${FILE_NODE_NAME}`].join('\n'));
  });

  it('обычная ссылка узлом файла не становится', () => {
    expect(outlineOf('[текст](https://example.com)')).toContain('paragraph');
    expect(outlineOf('[текст](https://example.com)')).not.toContain(FILE_NODE_NAME);
  });

  it('mime и тип определяются по расширению имени', () => {
    const attrs = parser.parse(`[отчёт.pdf](${ATTACHMENT_URL})`).firstChild?.attrs;

    expect(attrs?.mimeType).toBe('application/pdf');
    expect(attrs?.fileType).toBe('Pdf');
    expect(attrs?.fileName).toBe('отчёт.pdf');
    expect(attrs?.attachmentId).toBe(ATTACHMENT_ID);
  });

  it('без расширения mime остаётся octet-stream', () => {
    const attrs = parser.parse(`[отчёт](${ATTACHMENT_URL})`).firstChild?.attrs;

    expect(attrs?.mimeType).toBe('application/octet-stream');
  });
});

describe('Медиа в окружении', () => {
  it('картинка внутри цитаты', () => {
    expectStable('> ![кот](https://example.com/cat.png)');
  });

  it('картинка внутри пункта списка', () => {
    expectStable('* ![кот](https://example.com/cat.png)');
  });

  it('картинка внутри ячейки таблицы', () => {
    expectStable('| a |\n| --- |\n| ![кот](https://example.com/cat.png) |');
  });

  it('картинка между параграфами', () => {
    expectStable('до\n\n![кот](https://example.com/cat.png)\n\nпосле');
  });

  it('вложение между параграфами', () => {
    expectStable(`до\n\n[отчёт.pdf](${ATTACHMENT_URL})\n\nпосле`);
  });
});
