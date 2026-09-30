/** Synthetic large-document generator, for demoing/verifying diff performance
 * in the UI without requiring the user to paste a real multi-MB file.
 * Deterministic (seeded PRNG) so repeated clicks are reproducible. */

const WORDS = [
  "alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel",
  "india", "juliet", "kilo", "lima", "mike", "november", "oscar", "papa",
];
const REPLACEMENT_WORDS = ["zulu", "yankee", "xray", "whiskey", "victor"];

function makeRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

export function generateLargeMarkdown(paragraphs: number, seed = 42): string {
  const rand = makeRand(seed);
  const lines: string[] = [];
  for (let i = 0; i < paragraphs; i++) {
    if (i % 40 === 0) lines.push(`## Section ${i / 40}`);
    const wordCount = 30 + Math.floor(rand() * 40);
    const words: string[] = [];
    for (let w = 0; w < wordCount; w++) words.push(WORDS[Math.floor(rand() * WORDS.length)]);
    lines.push(words.join(" ") + ".");
  }
  return lines.join("\n\n");
}

export function editMarkdown(markdown: string, editRatio: number, seed: number): string {
  const rand = makeRand(seed);
  return markdown
    .split("\n\n")
    .map((paragraph) => {
      if (rand() >= editRatio) return paragraph;
      const tokens = paragraph.split(" ");
      const idx = Math.floor(rand() * tokens.length);
      tokens[idx] = REPLACEMENT_WORDS[Math.floor(rand() * REPLACEMENT_WORDS.length)];
      return tokens.join(" ");
    })
    .join("\n\n");
}
