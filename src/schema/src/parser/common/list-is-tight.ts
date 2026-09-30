import { Token } from 'markdown-it';
/**
 * Определяет, является ли список «плотным» (tight) или «рыхлым» (loose).
 *
 * В CommonMark различают два режима рендеринга списков:
 *  - **плотный (tight)** — между пунктами нет пустых строк; содержимое
 *    пункта идёт прямо в `<li>` без обёртки `<p>` (пример: `- a\n- b`);
 *  - **рыхлый (loose)** — между пунктами есть пустая строка; содержимое
 *    пункта оборачивается в `<p>` (пример: `- a\n\n- b`).
 *
 * Режим сохраняется в атрибуте `tight` ноды списка и нужен, чтобы
 * парсинг и сериализация не теряли форматирование: без него `- a\n- b`
 * (плотный) при сохранении превратился бы в `- a\n\n- b` (рыхлый) и
 * наоборот.
 *
 * markdown-it не кладёт атрибут `tight` на bullet_list_open/ordered_list_open,
 * а помечает вложенный paragraph_open флагом `hidden`:
 *  - плотный  → `hidden=true`
 *  - рыхлый   → `hidden=false`
 *
 * Поэтому от list_open идём вперёд по токенам до первого paragraph_open
 * и читаем у него `hidden`.
 *
 * Пример токенов для `- a\n- b` (плотный):
 *   bullet_list_open
 *     list_item_open
 *       paragraph_open  hidden=true   ← это и есть признак плотного
 *
 * Для `- a\n\n- b` (рыхлый) hidden=false у paragraph_open.
 */
export function listIsTight(tokens: ReadonlyArray<Token>, index: number): boolean {
  for (let i = index + 1; i < tokens.length; i += 1) {
    if (tokens[i]!.type !== 'list_item_open') {
      return tokens[i]!.hidden;
    }
  }

  return false;
}