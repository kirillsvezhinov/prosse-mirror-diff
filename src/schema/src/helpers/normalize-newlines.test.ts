import { describe, expect, it } from 'vitest';
import { normalizeNewlines, splitLines, trimSurroundingNewlines } from './normalize-newlines';

describe('normalize-newlines helpers', () => {
  describe('normalizeNewlines', () => {
    it('преобразует Windows CRLF (\\r\\n) в LF (\\n)', () => {
      expect(normalizeNewlines('line1\r\nline2\r\nline3')).toBe('line1\nline2\nline3');
    });

    it('преобразует одиночные \\r в \\n', () => {
      expect(normalizeNewlines('line1\rline2\rline3')).toBe('line1\nline2\nline3');
    });

    it('сохраняет стандартный LF (\\n) без изменений', () => {
      expect(normalizeNewlines('line1\nline2\nline3')).toBe('line1\nline2\nline3');
    });
  });

  describe('splitLines', () => {
    it('корректно разбивает строку с CRLF без остаточных \\r', () => {
      const result = splitLines('строка 1\r\n   \r\nстрока 2');
      expect(result).toEqual(['строка 1', '   ', 'строка 2']);
    });

    it('корректно разбивает строку с LF', () => {
      const result = splitLines('строка 1\nстрока 2');
      expect(result).toEqual(['строка 1', 'строка 2']);
    });

    it('возвращает один элемент для строки без переносов', () => {
      expect(splitLines('одна строка')).toEqual(['одна строка']);
    });
  });

  describe('trimSurroundingNewlines', () => {
    it('удаляет ведущие и хвостовые CRLF и LF', () => {
      expect(trimSurroundingNewlines('\r\n\r\nтекст\r\n\r\n')).toBe('текст');
      expect(trimSurroundingNewlines('\n\nтекст\n\n')).toBe('текст');
      expect(trimSurroundingNewlines('\r\nтекст\n')).toBe('текст');
    });

    it('сохраняет внутренние переносы строки', () => {
      expect(trimSurroundingNewlines('\r\nпараграф 1\r\n\r\nпараграф 2\r\n')).toBe('параграф 1\r\n\r\nпараграф 2');
    });
  });
});
