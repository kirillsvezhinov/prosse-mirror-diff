/**
 * Generic O(n*m) LCS-based diff over two arrays. Good enough for prototype-
 * sized documents (dozens to low hundreds of lines/characters per block).
 * Produces a minimal edit script of equal/delete/insert ops.
 */

export type DiffOp<T> =
  | { type: "equal"; oldItem: T; newItem: T; oldIndex: number; newIndex: number }
  | { type: "delete"; oldItem: T; oldIndex: number }
  | { type: "insert"; newItem: T; newIndex: number };

export function diffArrays<T>(oldArr: T[], newArr: T[], equal: (a: T, b: T) => boolean): DiffOp<T>[] {
  const n = oldArr.length;
  const m = newArr.length;

  // dp[i][j] = length of LCS of oldArr[i..] and newArr[j..]
  const dp: Uint32Array[] = new Array(n + 1);
  for (let i = 0; i <= n; i++) dp[i] = new Uint32Array(m + 1);

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = equal(oldArr[i], newArr[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const ops: DiffOp<T>[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (equal(oldArr[i], newArr[j])) {
      ops.push({ type: "equal", oldItem: oldArr[i], newItem: newArr[j], oldIndex: i, newIndex: j });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: "delete", oldItem: oldArr[i], oldIndex: i });
      i++;
    } else {
      ops.push({ type: "insert", newItem: newArr[j], newIndex: j });
      j++;
    }
  }
  while (i < n) {
    ops.push({ type: "delete", oldItem: oldArr[i], oldIndex: i });
    i++;
  }
  while (j < m) {
    ops.push({ type: "insert", newItem: newArr[j], newIndex: j });
    j++;
  }
  return ops;
}
