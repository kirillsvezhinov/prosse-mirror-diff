import { DEFAULT_MIME_TYPE } from '../media.const';

/*
 * Типы файлов
 */
export enum FileType {
  IMAGE = 'Image',
  PDF = 'Pdf',
  DOCUMENT = 'Document',
  SPREADSHEET = 'Spreadsheet',
  TXT = 'Txt',
  ARCHIVE = 'Archive',
  OTHER = 'Other',
  VIDEO = 'Video',
  AUDIO = 'Audio',
  XML = 'Xml',
}

/**
 * Соответствие расширений файлов их mimeType которые мы поддерживаем
 */
export const EXTENSION_TO_MIME_TYPE_CONFORMITY: Record<string, string> = {
  avi: 'video/x-msvideo',
  bmp: 'image/bmp',
  csv: 'text/csv',
  dcx: 'image/x-dcx',
  djvu: 'image/x-djvu',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  emf: 'image/x-emf',
  gif: 'image/gif',
  heic: 'image/heic',
  jfif: 'image/jpeg',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  m4a: 'audio/x-m4a',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  mpeg: 'video/mpeg',
  pdf: 'application/pdf',
  png: 'image/png',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  psx: 'image/x-pcx',
  rar: 'application/vnd.rar',
  rtf: 'application/rtf',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  ts: 'video/mp2t',
  txt: 'text/plain',
  wav: 'audio/wav',
  webp: 'image/webp',
  wmv: 'video/x-ms-wmv',
  xls: 'application/vnd.ms-excel',
  xlsb: 'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xml: 'application/xml',
  xps: 'application/oxps',
  zip: 'application/zip',
};

/**
 * Получает тип файла по его mimeType
 * @param mimeType - mimeType файла или ничего
 * @return - тип файла
 */
export function getFileType(mimeType: string | null): FileType {
  switch (mimeType) {
    /*
     * Картинки
     */
    // .gif Graphics Interchange Format (GIF)
    case EXTENSION_TO_MIME_TYPE_CONFORMITY.gif:
    // .webp Может быть как статическим, так и анимированным изображением
    case EXTENSION_TO_MIME_TYPE_CONFORMITY.webp:
    // .bmp Windows OS/2 Bitmap Graphics
    case EXTENSION_TO_MIME_TYPE_CONFORMITY.bmp:
    // .jpeg .jpg JPEG images
    case EXTENSION_TO_MIME_TYPE_CONFORMITY.jpg:
    // .png Portable Network Graphics
    case EXTENSION_TO_MIME_TYPE_CONFORMITY.png:
    // .tif .tiff Tagged Image File Format (TIFF)
    case EXTENSION_TO_MIME_TYPE_CONFORMITY.tif:
      return FileType.IMAGE;

    /*
     * PDF
     */
    // .pdf Adobe Portable Document Format (PDF)
    case EXTENSION_TO_MIME_TYPE_CONFORMITY.pdf:
      return FileType.PDF;

    /*
     * Документы
     */
    // .odt OpenDocument text document
    case EXTENSION_TO_MIME_TYPE_CONFORMITY.odt:
    // .doc Microsoft Word
    case EXTENSION_TO_MIME_TYPE_CONFORMITY.doc:
    // .docx Microsoft Word (OpenXML)
    case EXTENSION_TO_MIME_TYPE_CONFORMITY.docx:
      return FileType.DOCUMENT;

    /*
     * Электронные таблицы
     */
    // .ods OpenDocument spreadsheet document
    case EXTENSION_TO_MIME_TYPE_CONFORMITY.ods:
    // .xls Microsoft Excel
    case EXTENSION_TO_MIME_TYPE_CONFORMITY.xls:
    // .xlsx Microsoft Excel (OpenXML)
    case EXTENSION_TO_MIME_TYPE_CONFORMITY.xlsx:
      return FileType.SPREADSHEET;

    /*
     * Текстовые файлы
     */
    // .txt Text, (generally ASCII or ISO 8859-n)
    case EXTENSION_TO_MIME_TYPE_CONFORMITY.txt:
      return FileType.TXT;

    /*
     * Архивы
     */
    // .arc Archive document (multiple files embedded)
    case EXTENSION_TO_MIME_TYPE_CONFORMITY.rar:
    // .zip ZIP archive
    case EXTENSION_TO_MIME_TYPE_CONFORMITY.zip:
      return FileType.ARCHIVE;

    /**
     * Видео
     */
    case EXTENSION_TO_MIME_TYPE_CONFORMITY.avi:
    case EXTENSION_TO_MIME_TYPE_CONFORMITY.mp4:
    case EXTENSION_TO_MIME_TYPE_CONFORMITY.mpeg:
    case EXTENSION_TO_MIME_TYPE_CONFORMITY.ts:
    case EXTENSION_TO_MIME_TYPE_CONFORMITY.wmv:
      return FileType.VIDEO;

    /**
     * Аудио
     */
    case EXTENSION_TO_MIME_TYPE_CONFORMITY.m4a:
    case EXTENSION_TO_MIME_TYPE_CONFORMITY.mp3:
    case EXTENSION_TO_MIME_TYPE_CONFORMITY.wav:
      return FileType.AUDIO;

    case EXTENSION_TO_MIME_TYPE_CONFORMITY.xml:
      return FileType.XML;
    /*
     * Другие
     */
    default:
      return FileType.OTHER;
  }
}

export function getMimeTypeByFilename(filename: string): string {
  const ext = (filename.split('.').pop() || '').toLowerCase();

  return EXTENSION_TO_MIME_TYPE_CONFORMITY[ext] || DEFAULT_MIME_TYPE;
}
