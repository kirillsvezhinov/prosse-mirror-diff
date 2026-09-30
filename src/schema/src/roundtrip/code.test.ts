import { describe, expect, it } from 'vitest';
import { parser } from '../parser';
import { expectNormalized, expectStable, outlineOf } from './roundtrip.helpers';

const SUPPORTED_LANGUAGES = [
  'typescript',
  'javascript',
  'python',
  'css',
  'java',
  'powershell',
  'cpp',
  'csharp',
  'clike',
  'c',
  'objectivec',
  'rust',
  'sql',
  'swift',
  'json',
  'yml',
  'docker',
  'plaintext',
];

describe('Блок кода: поддерживаемые языки', () => {
  it.each(SUPPORTED_LANGUAGES)('язык %s раунд-трипится', (language) => {
    expectStable(`\`\`\`${language}\nкод\n\`\`\``);
  });

  it('язык попадает в атрибут узла', () => {
    const doc = parser.parse('```sql\nselect 1;\n```');

    expect(doc.firstChild?.type.name).toBe('code_block');
    expect(doc.firstChild?.attrs.language).toBe('sql');
  });
});

describe('Блок кода: язык вне списка приводится к plaintext', () => {
  it.each([
    ['go', '```go\nx := 1\n```'],
    ['bash', '```bash\nls -la\n```'],
    ['html', '```html\n<div></div>\n```'],
    ['алиас ts', '```ts\nconst a = 1;\n```'],
    ['алиас js', '```js\nconst a = 1;\n```'],
  ])('%s', (_name, source) => {
    expect(parser.parse(source).firstChild?.attrs.language).toBe('plaintext');
  });

  it('пустая инфо-строка тоже даёт plaintext', () => {
    expectNormalized('```\nкод\n```', '```plaintext\nкод\n```');
  });

  it('метаданные после языка отбрасываются', () => {
    expectNormalized('```typescript title="a.ts"\nкод\n```', '```typescript\nкод\n```');
  });

  it('тильды как ограждение заменяются на бэктики', () => {
    expectNormalized('~~~\nкод\n~~~', '```plaintext\nкод\n```');
  });
});

describe('Блок кода: содержимое', () => {
  it('пустая строка внутри кода не разрывает блок', () => {
    expectStable('```typescript\nconst a = 1;\n\nconst b = 2;\n```');
  });

  it('бэктики внутри кода', () => {
    expectStable('```typescript\nconst a = `шаблон`;\n```');
  });

  it('символы разметки внутри кода не экранируются', () => {
    expectStable('```typescript\nconst a = 2 * 3; // [ссылка] _низ_ | черта\n```');
  });

  it('несколько строк кода', () => {
    expectStable('```python\ndef f():\n    return 1\n```');
  });

  it('пустой блок кода получает пустую строку внутри', () => {
    expectNormalized('```typescript\n```', '```typescript\n\n```');
  });

  it('структура: один узел code_block с текстом', () => {
    expect(outlineOf('```sql\nselect 1;\n```')).toBe(['doc', '  code_block', '    text "select 1;"'].join('\n'));
  });
});

describe('Блок кода в окружении', () => {
  it('внутри цитаты', () => {
    expectStable('> ```typescript\n> const a = 1;\n> ```');
  });

  it('внутри пункта списка', () => {
    expectStable('* пункт\n\n  ```typescript\n  const a = 1;\n  ```');
  });

  it('между параграфами', () => {
    expectStable('до\n\n```typescript\nconst a = 1;\n```\n\nпосле');
  });
});

describe('Отступной код блоком не становится', () => {
  // preserveLeadingWhitespaceRule: четыре пробела в начале строки — это отступ
  // пользователя, а не блок кода. Текст сохраняется как параграф вместе с пробелами.
  it('четыре пробела остаются текстом параграфа', () => {
    expectStable('    const a = 1;');
  });

  it('отступной текст даёт paragraph, а не code_block', () => {
    expect(outlineOf('    const a = 1;')).toContain('paragraph');
    expect(outlineOf('    const a = 1;')).not.toContain('code_block');
  });
});

describe('Инлайн-код', () => {
  it('простой', () => {
    expectStable('текст `код` текст');
  });

  it('один пробел по краям снимается по правилам CommonMark', () => {
    // `` ` код ` `` — это код-спан с содержимым "код": по CommonMark по одному
    // пробелу с каждого края служит обрамлением, а не содержимым.
    expectNormalized('` код `', '`код`');
    expect(parser.parse('` код `').textContent).toBe('код');
  });

  it('несколько инлайн-кодов в строке', () => {
    expectStable('`раз` и `два` и `три`');
  });
});
