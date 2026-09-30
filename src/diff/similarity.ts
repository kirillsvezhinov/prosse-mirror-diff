/**
 * Sørensen–Dice coefficient over character bigrams: 2*overlap / (bigrams(a) + bigrams(b)),
 * in [0, 1]. O(len(a) + len(b)) via hashed bigram multisets, so it stays cheap
 * even for long paragraphs — unlike a full edit-distance ratio, which would be
 * another O(len*len) table per comparison.
 */
export function textSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigramsA = bigramCounts(a);
  const bigramsB = bigramCounts(b);
  const [small, large] = bigramsA.size <= bigramsB.size ? [bigramsA, bigramsB] : [bigramsB, bigramsA];

  let overlap = 0;
  for (const [bigram, count] of small) {
    const otherCount = large.get(bigram);
    if (otherCount) overlap += Math.min(count, otherCount);
  }

  let totalA = 0;
  for (const count of bigramsA.values()) totalA += count;
  let totalB = 0;
  for (const count of bigramsB.values()) totalB += count;

  return (2 * overlap) / (totalA + totalB);
}

function bigramCounts(s: string): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const bigram = s.slice(i, i + 2);
    map.set(bigram, (map.get(bigram) ?? 0) + 1);
  }
  return map;
}
