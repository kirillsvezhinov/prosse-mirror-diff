import { extractAttachmentId } from '../../link-block/link-block.parse.spec';
import { createMediaLocalId, getAttachmentUrl } from '../media.const';
import { FileType, getFileType, getMimeTypeByFilename } from '../types/file-type';
import { LoadStatus } from '../types/load-status';

export type MediaNodeAttrs = {
  localId: string;
  attachmentId: string | null;
  fileName: string;
  fileType: FileType;
  mimeType: string;
  status: LoadStatus;
  progress: number;
  downloadUrl: string;
  width?: number;
  height?: number;
};

export class MediaNodeAttrsFactory {
  static createFromMarkdown(url: string, alt: string, localId?: string): MediaNodeAttrs {
    const attachmentId = extractAttachmentId(url);
    const mimeType = getMimeTypeByFilename(alt);
    return {
      localId: localId ?? createMediaLocalId(),
      attachmentId,
      fileName: alt || 'file',
      downloadUrl: attachmentId ? getAttachmentUrl(attachmentId) : '',
      status: attachmentId ? LoadStatus.COMPLETED : LoadStatus.PENDING,
      progress: attachmentId ? 100 : 0,
      mimeType,
      fileType: getFileType(mimeType),
    };
  }
}
