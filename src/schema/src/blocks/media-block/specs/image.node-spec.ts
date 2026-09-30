import type { NodeSpec, Node as PMNode } from 'prosemirror-model';
import { DEFAULT_MIME_TYPE } from '../media.const';
import { getFileType } from '../types/file-type';
import { LoadStatus } from '../types/load-status';
import type { MediaNodeAttrs } from './media-node.attribute';

export const IMAGE_NODE_NAME = 'custom_image_node';

export function getMediaNodeAttrs(node: PMNode): MediaNodeAttrs {
  return node.attrs as unknown as MediaNodeAttrs;
}

export const imageNodeSpec: NodeSpec = {
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
    width: { default: null },
    height: { default: null },
  },
};
