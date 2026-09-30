import { MarkdownSerializerState } from 'prosemirror-markdown';
import { Node, Node as PMNode } from 'prosemirror-model';
import { extractAttachmentId } from '../link-block/link-block.parse.spec';
import { getAttachmentUrl } from './media.const';
import { FILE_NODE_NAME } from './specs/file.node-spec';
import { IMAGE_NODE_NAME } from './specs/image.node-spec';

export class MediaSerializer {
  private static fileNode(state: MarkdownSerializerState, node: PMNode): void {
    // Сериализуем в MD: ![fileName](/api/v1/public/content/attachment/attachmentId)
    // Пишем без fileName, потому что названия могут ломать ссылки из-за пробелов и остального
    const { attachmentId, fileName } = node.attrs;
    state.write(`[${fileName}](${getAttachmentUrl(attachmentId as string)})`);
    state.closeBlock(node);
  }

  private static imageNode(state: MarkdownSerializerState, node: PMNode): void {
    // Сериализуем в MD: ![fileName](/api/v1/public/content/attachment/attachmentId)
    // Пишем без fileName, потому что названия могут ломать ссылки из-за пробелов и остального
    const { attachmentId, downloadUrl, fileName, width } = node.attrs;

    const urlWithAttachmentId = getAttachmentUrl(attachmentId as string);
    const hasAttachment = extractAttachmentId(urlWithAttachmentId);
    const urlForMd = hasAttachment ? urlWithAttachmentId : (downloadUrl as string);

    // Базовый синтаксис без размера изображения
    let md = `![${fileName}](${urlForMd})`;

    // Добавляем размеры, если есть
    if (width) {
      const w = (width as string) || '';
      md += `{width=${w}}`;
    }

    state.write(md);
    state.closeBlock(node);
  }

  public static getNodesSerializerMethods(): Record<
    typeof IMAGE_NODE_NAME | typeof FILE_NODE_NAME,
    (state: MarkdownSerializerState, node: Node, parent: Node, index: number) => void
  > {
    return {
      [IMAGE_NODE_NAME]: MediaSerializer.imageNode,
      [FILE_NODE_NAME]: MediaSerializer.fileNode,
    };
  }
}
