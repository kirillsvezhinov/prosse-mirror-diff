# Media block

## Кастомные блоки в схеме

- `custom_image_node` - Картинка с опциональной шириной
- `file_attachment` - Произвольный файл (pdf-ка, excel-ка, ...) в нашем хранилище

## Атрибуты

- `localId` генерируется через `crypto.randomUUID()`.
- `attachmentId` — UUID, извлечённый из URL функцией `extractAttachmentId` (относительный путь `/api/v1/public/content/attachment/{uuid}`).
- `fileType` — enum (`Image`, `Pdf`, `Document`, `Spreadsheet`, `Txt`, `Archive`, `Video`, `Audio`, `Xml`, `Other`), вычисляется по `mimeType` или расширению имени.
- `status` — `pending` / `uploading` / `completed` / `failed` / `cancelled`.

У `custom_image_node` дополнительно `width` и `height`.

## Синтаксис markdown

| Синтаксис | Результат |
|---|---|
| `![alt](url)` | image |
| `![alt](url){width=N}` | image c шириной |
| `[name](/api/v1/public/content/attachment/{uuid})` | file |
| [link](url) | будет обычный ссылкой (не медиа блок) |

## Правила сериализации для media block

| Тип блока | Markdown после сериализации |
|---|---|
| `custom_image_node` | `![fileName](url){width=N?}` |
| `file_attachment` | `[fileName](/api/v1/public/content/attachment/{attachmentId})` |

## Особенности схемы

- `imageWithSize` распознаёт только `{width=N}` — в синтаксисе высоты нет.
- При парсинге картинка получает `mimeType = application/octet-stream` всегда. Файл получает mime по расширению имени. Если расширения нет — mime = `application/octet-stream`.
