import type { ParseSpec } from 'prosemirror-markdown';
import { extractAttachmentId } from '../../link-block/link-block.parse.spec';
import { createMediaLocalId, DEFAULT_MIME_TYPE, getAttachmentUrl } from '../media.const';
import { getFileType } from '../types/file-type';
import { LoadStatus } from '../types/load-status';
import { FILE_NODE_NAME } from './file.node-spec';
import { IMAGE_NODE_NAME } from './image.node-spec';
import { MediaNodeAttrsFactory } from './media-node.attribute';
import type { MediaNodeAttrs } from './media-node.attribute';

export const mediaTokenSpec: Record<string, ParseSpec> = {
  image: {
    node: IMAGE_NODE_NAME,
    getAttrs: (tok): MediaNodeAttrs => {
      const url = tok.attrGet('src');
      const attachmentId = url ? extractAttachmentId(url) : null;
      // Эта на случай, когда загружаем что-то не с нашего бэка
      const downloadUrl = attachmentId ? getAttachmentUrl(attachmentId) : url || '';
      const width = Number(tok.attrGet('width')) || undefined;
      const height = Number(tok.attrGet('height')) || undefined;

      return {
        attachmentId: attachmentId,
        fileName: tok.content || 'file',
        status: attachmentId ? LoadStatus.PENDING : LoadStatus.COMPLETED,
        progress: attachmentId ? 0 : 100,
        localId: createMediaLocalId(),
        mimeType: DEFAULT_MIME_TYPE,
        fileType: getFileType(DEFAULT_MIME_TYPE),
        downloadUrl,
        width,
        height,
      };
    },
  },

  file_attachment: {
    node: FILE_NODE_NAME,
    getAttrs: (tok) => {
      const href = tok.attrGet('href') || '';
      const attachmentId = tok.attrGet('attachmentId') || extractAttachmentId(href);
      const fileName = tok.attrGet('fileName') || tok.content || 'file';

      const attrs = MediaNodeAttrsFactory.createFromMarkdown(href, fileName);
      attrs.status = attachmentId ? LoadStatus.COMPLETED : LoadStatus.PENDING;
      attrs.progress = attachmentId ? 100 : 0;

      return attrs;
    },
  },
};
