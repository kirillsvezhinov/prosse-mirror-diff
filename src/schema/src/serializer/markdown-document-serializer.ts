import { MarkdownSerializer } from 'prosemirror-markdown';
import { Node } from 'prosemirror-model';
import { getChildren, isEmptyDocument, trimSurroundingNewlines } from '../helpers';
import { EMPTY_PARAGRAPH } from '../blocks';


export class MarkdownDocumentSerializer extends MarkdownSerializer {
  private getLastNonEmptyBlockIndex(children: Array<Node>): number {
    for (let i = children.length - 1; i >= 0; i -= 1) {
      const item = children[i];
      if (item !== undefined && item.type.name !== EMPTY_PARAGRAPH) {
        return i;
      }
    }

    return -1;
  }

  private serializeChild(
    child: Node,
    docType: Node['type'],
    options: Parameters<MarkdownSerializer['serialize']>[1],
    isLastNonEmpty: boolean,
  ): string {
    if (child.type.name === EMPTY_PARAGRAPH) {
      return '\n';
    }

    const serialized = trimSurroundingNewlines(super.serialize(docType.create(null, child), options));

    return isLastNonEmpty ? serialized : `${serialized}\n`;
  }

  serialize(doc: Node, options?: Parameters<MarkdownSerializer['serialize']>[1]): string {
    if (isEmptyDocument(doc)) {
      return '';
    }

    const children = getChildren(doc);

    // Нужен, чтобы не дописывать завершающий `\n` после последнего
    // непустого блока — иначе хвостовые empty_paragraph дают лишний перенос.
    const lastNonEmptyIndex = this.getLastNonEmptyBlockIndex(children);

    return children
      .map((child, index) => this.serializeChild(child, doc.type, options, index === lastNonEmptyIndex))
      .join('');
  }
}
