import { StateCore, Token } from 'markdown-it';
import { imageWithSize } from '../blocks/media-block/parser-md-rules/img-with-size.rule';
import { emptyParagraphRule } from '../blocks/empty-paragraph/parser-md-rules/empty-paragraph.rule';
import { blockTableCellRule } from '../blocks/table-block/parser-md-rules/rule-override.table-cell';
import { extractAttachmentId } from '../blocks/link-block/link-block.parse.spec';
import { preserveLeadingWhitespaceRule } from './preserve-leading-whitespace.rule';

interface IMediaTokenInfo {
  type: 'image' | 'file_attachment';
  startIndex: number;
  endIndex: number;
  token: Token;
  href?: string;
  title?: string;
}

/**
 * Находит все медиа-элементы (image и file_attachment) в children массиве
 */
export function findMediaTokens(state: StateCore, children: Array<Token>): Array<IMediaTokenInfo> {
  const mediaTokens: Array<IMediaTokenInfo> = [];
  let i = 0;

  while (i < children.length) {
    const child = children[i];

    if (!child) {
      continue;
    }

    // Обработка изображений
    if (child.type === 'image') {
      mediaTokens.push({
        type: 'image',
        startIndex: i,
        endIndex: i,
        token: child,
      });
      i++;
      continue;
    }

    // Обработка ссылок (превращаем в file_attachment)
    if (child.type === 'link_open') {
      const linkCloseIndex = findMatchingToken(children, i, 'link_open', 'link_close');

      if (linkCloseIndex !== -1) {
        const textToken = children[i + 1];
        const title = textToken?.type === 'text' ? textToken.content : '';
        const href = child.attrGet('href') || '';
        const attachmentId = extractAttachmentId(href);

        // Если ссылка не подходит под формат файла (не имеет attachmentId, то пропускаем дальнейшую обработку)
        if (!attachmentId) {
          i = linkCloseIndex + 1;
          continue;
        }

        // Создаем новый токен file_attachment
        const fileToken = createFileAttachmentToken(state, child, href, title);

        mediaTokens.push({
          type: 'file_attachment',
          startIndex: i,
          endIndex: linkCloseIndex,
          token: fileToken,
          href,
          title,
        });

        i = linkCloseIndex + 1;
        continue;
      }
    }

    i++;
  }

  return mediaTokens;
}

/**
 * Создаёт токен file_attachment из link_open токена
 */
function createFileAttachmentToken(state: StateCore, linkToken: Token, href: string, title: string): Token {
  const fileToken = new state.Token('file_attachment', 'div', 0);
  fileToken.attrSet('href', href);
  fileToken.attrSet('title', title);
  fileToken.content = title;
  fileToken.block = true;
  fileToken.markup = linkToken.markup;
  fileToken.info = linkToken.info;

  return fileToken;
}

/**
 * Находит индекс закрывающего токена для парного тега
 */
function findMatchingToken(tokens: Array<Token>, startIndex: number, openType: string, closeType: string): number {
  let depth = 1;

  for (let i = startIndex + 1; i < tokens.length; i++) {
    const currentToken = tokens[i];
    if (!currentToken) {
      continue;
    }

    if (currentToken.type === openType) {
      depth++;
    }
    if (currentToken.type === closeType) {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }

  return -1;
}

/**
 * Создаёт токен paragraph_open
 */
function createParagraphOpen(state: StateCore, level: number, map: [number, number] | null = null): Token {
  const token = new state.Token('paragraph_open', 'p', 1);
  token.block = true;
  token.level = level;
  token.map = map;

  return token;
}

/**
 * Создаёт токен paragraph_close
 */
function createParagraphClose(state: StateCore, level: number): Token {
  const token = new state.Token('paragraph_close', 'p', -1);
  token.block = true;
  token.level = level;

  return token;
}

/**
 * Создаёт инлайн-токен с текстом.
 *
 * `inlineToken.block = true` нужен: иначе правило пустых строк
 * не видит разрезанный абзац и вставляет лишние пустые строки
 * между текстом и картинкой.
 */
function createInlineToken(state: StateCore, text: string, level: number): Token {
  const textToken = new state.Token('text', '', 0);
  textToken.content = text;
  textToken.level = level;

  const inlineToken = new state.Token('inline', '', 0);
  inlineToken.children = [textToken];
  inlineToken.content = text;
  inlineToken.block = true;
  inlineToken.level = level;

  return inlineToken;
}

/**
 * Создаёт группу токенов для параграфа (open, inline, close)
 */
function createParagraphTokens(
  state: StateCore,
  inlineToken: Token,
  level: number,
  map: [number, number] | null = null,
): Array<Token> {
  const paragraphOpen = createParagraphOpen(state, level, map);
  const paragraphClose = createParagraphClose(state, level);
  inlineToken.level = level;
  inlineToken.map = map;

  return [paragraphOpen, inlineToken, paragraphClose];
}

/**
 * Основная функция правила для выноса медиа в блоки
 */
// eslint-disable-next-line complexity
export function blockMediaRule(state: StateCore): void {
  const tokens = state.tokens;
  const newTokens: Array<Token> = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (!token) {
      continue;
    }

    // Проверяем структуру paragraph_open -> inline -> paragraph_close
    if (
      token.type === 'paragraph_open' &&
      tokens[i + 1]?.type === 'inline' &&
      tokens[i + 2]?.type === 'paragraph_close'
    ) {
      const inlineToken = tokens[i + 1];
      // Условие в if-е обеспечивает присутствие inlineToken
      const children = inlineToken!.children ?? [];
      const level = token.level;

      // Находим все медиа-токены
      const mediaTokens = findMediaTokens(state, children);

      // Если нет медиа-токенов, оставляем параграф как есть
      if (mediaTokens.length === 0) {
        // @ts-ignore
        newTokens.push(token, inlineToken, tokens[i + 2]);
        i += 2;
        continue;
      }

      // Копия исходного map нужна всем новым токенам (абзацам и картинкам).
      // Без неё правило пустых строк не понимало, что часть строк уже
      // занята картинкой, и добавляло лишние пустые строки вокруг неё.
      const sourceMap = token.map ? ([...token.map] as [number, number]) : null;

      // Разбиваем параграф на части
      let currentTextStart = 0;

      for (const mediaInfo of mediaTokens) {
        // Текст перед медиа-элементом
        if (mediaInfo.startIndex > currentTextStart) {
          const textBefore = extractTextFromTokens(children.slice(currentTextStart, mediaInfo.startIndex));

          if (textBefore) {
            const inlineBefore = createInlineToken(state, textBefore, level);
            newTokens.push(...createParagraphTokens(state, inlineBefore, level, sourceMap));
          }
        }

        // Вставляем медиа-токен как top-level block: empty_paragraph.rule
        // учитывает только token.block && level===0 && map!=null.
        if (mediaInfo.type === 'image' || mediaInfo.type === 'file_attachment') {
          mediaInfo.token.level = level;
          mediaInfo.token.block = true;
          mediaInfo.token.map = sourceMap;
          newTokens.push(mediaInfo.token);
        }

        currentTextStart = mediaInfo.endIndex + 1;
      }

      // Текст после последнего медиа-элемента
      if (currentTextStart < children.length) {
        const textAfter = extractTextFromTokens(children.slice(currentTextStart));

        if (textAfter) {
          const inlineAfter = createInlineToken(state, textAfter, level);
          newTokens.push(...createParagraphTokens(state, inlineAfter, level, sourceMap));
        }
      }

      // Пропускаем обработанные токены
      i += 2;
      continue;
    }

    // Не параграф - просто добавляем токен
    newTokens.push(token);
  }

  // Заменяем токены
  state.tokens = newTokens;
}

/**
 * Извлекает текст из массива токенов
 */
function extractTextFromTokens(tokens: Array<Token>): string {
  return tokens
    .map((token) => {
      if (token.type === 'text') {
        return token.content;
      }
      if (token.children) {
        return extractTextFromTokens(token.children);
      }

      return '';
    })
    .join('');
}

/**
 * Порядок ключей совпадает с порядком регистрации в registerCustomRules
 * (markdown.config.ts), кроме image_with_size — он вешается на inline.ruler.
 */
export const OVERRIDE_BLOCK_RULE = {
  block_table_cell: blockTableCellRule,
  /**
   * Правило для переопределения того, как ведут себя медиа блоки в редакторе.
   * Они являются блочными и именно из-за этого необходимо записывать их токены между параграфами, т.е. в одиночестве на строке
   * Правило выбирает картинки и файлы и вставляет их отдельно между параграфами, остальные токены (между/на одной строке) остаются в параграфах
   */
  custom_block_media_rule: blockMediaRule,
  /**
   * Возвращает ведущие пробелы/табы, которые markdown-it обрезает
   * у top-level параграфов. Иначе Tab-отступ пропадает при сохранении.
   * Должен идти до empty_paragraph.
   */
  preserve_leading_whitespace: preserveLeadingWhitespaceRule,
  /**
   * Правило, добавляющее `empty_paragraph` для пустых строк между top-level
   * блоками, а также до первого и после последнего блока.
   * Идёт после preserve_leading_whitespace: preserve сначала превращает whitespace-only и indented code_block в paragraph,
   * чтобы empty_paragraph не создал лишние empty_paragraph узлы.
   */
  empty_paragraph: emptyParagraphRule,
  /**
   * Правило, которое превращает часть с размерами в аттрибуты токенов
   * Пример картинки с написанным размером: ![название](ссылка){width=200}
   * Правило превращает {width=200} в аттрибут.
   * Подключается как before до обработки других правил картинок
   */
  image_with_size: imageWithSize,
} as const;
