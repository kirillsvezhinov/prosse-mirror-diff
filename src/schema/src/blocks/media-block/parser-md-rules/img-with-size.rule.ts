import type { StateInline } from 'markdown-it';

export function imageWithSize(state: StateInline, silent: boolean): boolean {
  const match = state.src.slice(state.pos).match(/^!\[([^\]]*)\]\(([^)]+)\)\{width=(\d+)\}/);

  if (!match) {
    return false;
  }

  if (!silent) {
    const token = state.push('image', 'img', 0);
    token.content = match[1]!;
    token.attrs = [
      ['src', match[2]!],
      ['alt', match[1]!],
    ];

    if (match[3]) {
      token.attrs.push(['width', match[3]]);
    }
  }

  state.pos += match[0].length;

  return true;
}
