/**
 * Myers' O(ND) diff algorithm (Myers, "An O(ND) Difference Algorithm and Its
 * Variations", 1986) — the same algorithm behind classic `diff` and git.
 * Produces a minimal edit script (equal/delete/insert) between two arrays.
 *
 * Time: O((N+M)*D); backtrack space: O(D^2), where D is the edit distance
 * (number of non-matching elements). For near-duplicate inputs — the common
 * case of diffing two revisions of the same document — D is much smaller
 * than N+M, which is what makes this practical on multi-megabyte documents:
 * the previous implementation built a dense O(N*M) DP table, which is
 * unusable once N*M stops fitting in memory (a several-MB document flattened
 * to characters is already too large for that).
 */

export type DiffOp<T> =
  | { type: "equal"; oldItem: T; newItem: T; oldIndex: number; newIndex: number }
  | { type: "delete"; oldItem: T; oldIndex: number }
  | { type: "insert"; newItem: T; newIndex: number };

export function diffArrays<T>(oldArr: T[], newArr: T[], equal: (a: T, b: T) => boolean): DiffOp<T>[] {
  const n = oldArr.length;
  const m = newArr.length;
  if (n === 0 && m === 0) return [];

  const trace = shortestEditTrace(n, m, (x, y) => equal(oldArr[x], newArr[y]));
  const moves = backtrack(n, m, trace);

  const ops: DiffOp<T>[] = [];
  for (const move of moves) {
    if (move.x === move.prevX) {
      // pure vertical step: one element of newArr consumed, none of oldArr
      ops.push({ type: "insert", newItem: newArr[move.prevY], newIndex: move.prevY });
    } else if (move.y === move.prevY) {
      // pure horizontal step: one element of oldArr consumed, none of newArr
      ops.push({ type: "delete", oldItem: oldArr[move.prevX], oldIndex: move.prevX });
    } else {
      // diagonal step: both consumed, matched under `equal`
      ops.push({
        type: "equal",
        oldItem: oldArr[move.prevX],
        newItem: newArr[move.prevY],
        oldIndex: move.prevX,
        newIndex: move.prevY,
      });
    }
  }
  return ops;
}

interface Move {
  prevX: number;
  prevY: number;
  x: number;
  y: number;
}

interface TraceLevel {
  v: Int32Array;
  /** `v[i]` holds the furthest-reaching x for diagonal `k = i + base`. */
  base: number;
}

/**
 * The greedy forward pass ("shortest edit script"): for each edit distance
 * d = 0, 1, 2, ..., track the furthest-reaching x on every diagonal k = x-y
 * reachable with exactly d non-diagonal moves. Snapshotting v at every d
 * gives the `trace` that backtrack() walks to recover the actual path.
 *
 * Only diagonals in [-(d-1), d-1] (plus the one bootstrap entry for d=0)
 * are ever read back out of a pre-round-d snapshot — see backtrack()'s
 * prevK derivation, which mirrors the forward step exactly — so each
 * snapshot only needs to keep that narrow, depth-sized slice rather than
 * the full 2*(N+M)+1-wide working array. That turns trace storage/copy cost
 * from O(D*(N+M)) into O(D^2), which matters a lot once D << N+M (two
 * mostly-similar documents, the normal case here).
 */
function shortestEditTrace(n: number, m: number, equalAt: (x: number, y: number) => boolean): TraceLevel[] {
  const max = n + m;
  const offset = max;
  const size = 2 * max + 1;
  const v = new Int32Array(size);
  v[offset + 1] = 0; // conventional base case: "d = -1, diagonal k = 1" reaches x = 0
  const trace: TraceLevel[] = [];

  for (let d = 0; d <= max; d++) {
    const lo = Math.max(0, offset - d - 1);
    const hi = Math.min(size, offset + d + 2);
    trace.push({ v: v.slice(lo, hi), base: lo - offset });

    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) {
        x = v[offset + k + 1]; // came from a vertical (insert) move
      } else {
        x = v[offset + k - 1] + 1; // came from a horizontal (delete) move
      }
      let y = x - k;
      while (x < n && y < m && equalAt(x, y)) {
        x++;
        y++;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) return trace;
    }
  }
  return trace;
}

function backtrack(n: number, m: number, trace: TraceLevel[]): Move[] {
  const moves: Move[] = [];
  let x = n;
  let y = m;

  for (let d = trace.length - 1; d >= 0; d--) {
    const { v, base } = trace[d];
    const at = (k: number) => v[k - base];
    const k = x - y;
    const prevK = k === -d || (k !== d && at(k - 1) < at(k + 1)) ? k + 1 : k - 1;
    const prevX = at(prevK);
    const prevY = prevX - prevK;

    while (x > prevX && y > prevY) {
      moves.push({ prevX: x - 1, prevY: y - 1, x, y });
      x--;
      y--;
    }
    if (d > 0) {
      moves.push({ prevX, prevY, x, y });
    }
    x = prevX;
    y = prevY;
  }

  moves.reverse();
  return moves;
}
