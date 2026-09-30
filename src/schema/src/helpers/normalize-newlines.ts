/**
 * Утилиты нормализации переводов строк для кроссплатформенной работы (Windows CRLF / macOS / Linux LF).
 */

const CRLF_RE = /\r\n?/g;
const LEADING_NEWLINES_RE = /^(\r?\n)+/;
const TRAILING_NEWLINES_RE = /(\r?\n)+$/;

/**
 * Приводит все переводы строк (`\r\n` и одиночные `\r`) к стандартному `\n`.
 */
export function normalizeNewlines(text: string): string {
  return text.replace(CRLF_RE, '\n');
}

/**
 * Разбивает текст на строки с поддержкой как `\n`, так и `\r\n`.
 */
export function splitLines(text: string): Array<string> {
  return text.split(/\r?\n/);
}

/**
 * Удаляет ведущие и завершающие переводы строк (включая `\r\n`).
 */
export function trimSurroundingNewlines(text: string): string {
  return text.replace(LEADING_NEWLINES_RE, '').replace(TRAILING_NEWLINES_RE, '');
}
