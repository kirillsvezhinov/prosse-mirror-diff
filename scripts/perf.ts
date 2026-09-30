/**
 * Performance sanity check for the diff engine on large (multi-MB) documents.
 * Usage: npm run perf [-- <paragraphs>]   (default ~6000 paragraphs, ~2-3 MB per side)
 *        npm run perf -- --file old.md new.md
 */
import { readFileSync } from "node:fs";
import { diffDocuments } from "../src/diff/diffDoc";
import { parseMarkdown } from "../src/schema";

function genDoc(paragraphs: number, seed: number): string {
  const lines: string[] = [];
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  const words = [
    "alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel",
    "india", "juliet", "kilo", "lima", "mike", "november", "oscar", "papa",
  ];
  for (let i = 0; i < paragraphs; i++) {
    if (i % 40 === 0) lines.push(`## Section ${i / 40}`);
    const wc = 30 + Math.floor(rand() * 40);
    const p: string[] = [];
    for (let w = 0; w < wc; w++) p.push(words[Math.floor(rand() * words.length)]);
    lines.push(p.join(" ") + ".");
  }
  return lines.join("\n\n");
}

function editDoc(md: string, editRatio: number, seed: number): string {
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  const words = ["zulu", "yankee", "xray", "whiskey", "victor"];
  return md
    .split("\n\n")
    .map((para) => {
      if (rand() >= editRatio) return para;
      const tokens = para.split(" ");
      const idx = Math.floor(rand() * tokens.length);
      tokens[idx] = words[Math.floor(rand() * words.length)];
      return tokens.join(" ");
    })
    .join("\n\n");
}

const args = process.argv.slice(2);
let oldMd: string;
let newMd: string;

if (args[0] === "--file") {
  oldMd = readFileSync(args[1], "utf8");
  newMd = readFileSync(args[2], "utf8");
} else {
  const paragraphs = Number(args[0] ?? 6000);
  oldMd = genDoc(paragraphs, 42);
  newMd = editDoc(oldMd, 0.05, 99);
}

console.log(
  `old: ${(oldMd.length / 1024 / 1024).toFixed(2)} MB, new: ${(newMd.length / 1024 / 1024).toFixed(2)} MB`
);

const t0 = performance.now();
const oldDoc = parseMarkdown(oldMd);
const newDoc = parseMarkdown(newMd);
console.log(`parse: ${(performance.now() - t0).toFixed(1)}ms`);

for (const pairing of ["structural", "similarity"] as const) {
  const t1 = performance.now();
  const { stats, durationMs } = diffDocuments(oldDoc, newDoc, { pairing });
  const wall = performance.now() - t1;
  console.log(`\n[${pairing}] internal=${durationMs.toFixed(1)}ms wall=${wall.toFixed(1)}ms`);
  console.log(stats);
}
