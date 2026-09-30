import { BaseTextSerializer } from './base-text.serializer';
import { MarkdownDocumentSerializer } from './markdown-document-serializer';
import { MediaSerializer } from '../blocks/media-block/media.serializer';
import { CodeSerializer } from '../blocks/code-block/code.serializer';
import { TableSerializer } from '../blocks/table-block/table.serializer';

export const serializer = new MarkdownDocumentSerializer(
  {
    ...BaseTextSerializer.getNodesSerializerMethods(),
    ...CodeSerializer.getNodesSerializerMethods(),
    ...MediaSerializer.getNodesSerializerMethods(),
    ...TableSerializer.getNodesSerializerMethods(),
  },
  BaseTextSerializer.getMarksSerializerSpecs(),
  {
    escapeExtraCharacters: /\|/,
  },
);
