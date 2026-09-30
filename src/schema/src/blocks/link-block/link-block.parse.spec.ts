import type { ParseSpec } from 'prosemirror-markdown';

export const extractAttachmentId = (url: string): null | string => {
  // Регулярное выражение для проверки паттерна и захвата UUID
  const regex =
    /^\/api\/v1\/public\/content\/attachment\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i;

  const match = url.match(regex);

  return match && match[1] ? match[1] : null;
};


export const linkParseSpec: Record<string, ParseSpec> = {
  link: {
    mark: 'link',
    getAttrs: (tok) => {
      const href = tok.attrGet('href');
      const attachmentId = extractAttachmentId(href || '');

      return {
        href: tok.attrGet('href'),
        target: '_blank',
        title: tok.attrGet('title') || null,
        isAttachmentLink: Boolean(attachmentId), // Маркер для плагина, чтобы отличать ссылки от файлов
      };
    },
  },
};
