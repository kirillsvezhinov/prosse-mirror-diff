import { describe, expect, it } from 'vitest';
import { schema } from '../schema';
import { getChildren, isEmptyDocument } from './document-helpers';

describe('document-helpers', () => {
  describe('isEmptyDocument', () => {
    it('true для документа с единственным пустым paragraph', () => {
      const doc = schema.nodes.doc.create(null, [schema.nodes.paragraph.create()]);

      expect(isEmptyDocument(doc)).toBe(true);
    });

    it('true для документа с единственным пустым empty_paragraph', () => {
      const doc = schema.nodes.doc.create(null, [schema.nodes.empty_paragraph.create()]);

      expect(isEmptyDocument(doc)).toBe(true);
    });

    it('false, если paragraph содержит текст', () => {
      const paragraph = schema.nodes.paragraph.create(null, schema.text('текст'));
      const doc = schema.nodes.doc.create(null, [paragraph]);

      expect(isEmptyDocument(doc)).toBe(false);
    });

    it('false для документа с несколькими дочерними блоками', () => {
      const doc = schema.nodes.doc.create(null, [schema.nodes.paragraph.create(), schema.nodes.paragraph.create()]);

      expect(isEmptyDocument(doc)).toBe(false);
    });

    it('false, если единственный блок — не paragraph/empty_paragraph, даже при пустом содержимом', () => {
      const doc = schema.nodes.doc.create(null, [schema.nodes.code_block.create()]);

      expect(isEmptyDocument(doc)).toBe(false);
    });
  });

  describe('getChildren', () => {
    it('возвращает дочерние блоки документа по порядку', () => {
      const first = schema.nodes.paragraph.create(null, schema.text('первый'));
      const second = schema.nodes.paragraph.create(null, schema.text('второй'));
      const doc = schema.nodes.doc.create(null, [first, second]);

      expect(getChildren(doc)).toEqual([first, second]);
    });

    it('возвращает пустой массив для узла без дочерних элементов', () => {
      const paragraph = schema.nodes.paragraph.create();

      expect(getChildren(paragraph)).toEqual([]);
    });

    it('возвращает инлайн-содержимое узла (текстовые узлы)', () => {
      const paragraph = schema.nodes.paragraph.create(null, schema.text('привет'));

      const children = getChildren(paragraph);

      expect(children).toHaveLength(1);
      expect(children[0]?.isText).toBe(true);
      expect(children[0]?.text).toBe('привет');
    });
  });
});
