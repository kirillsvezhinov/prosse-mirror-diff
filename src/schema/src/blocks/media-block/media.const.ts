export const DEFAULT_MIME_TYPE = 'application/octet-stream';
export const ATTACHMENT_CONTENT_URL = '/api/v1/public/content/attachment';

export function getAttachmentUrl(attachmentId: string): string {
  return `${ATTACHMENT_CONTENT_URL}/${attachmentId}`;
}

export function createMediaLocalId(): string {
  return crypto.randomUUID();
}
