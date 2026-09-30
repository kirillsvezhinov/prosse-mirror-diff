import type { NodeSpec } from 'prosemirror-model';
import { DEFAULT_MIME_TYPE } from '../media.const';
import { getFileType } from '../types/file-type';
import { LoadStatus } from '../types/load-status';

export const FILE_NODE_NAME = 'file_attachment';

export const fileNodeSpec: NodeSpec = {
  inline: false,
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  attrs: {
    localId: { default: '' },
    attachmentId: { default: null },
    fileName: { default: 'file' },
    status: { default: LoadStatus.PENDING },
    progress: { default: 0 },
    mimeType: { default: DEFAULT_MIME_TYPE },
    fileType: { default: getFileType(DEFAULT_MIME_TYPE) },
    downloadUrl: { default: '' },
  },
};
