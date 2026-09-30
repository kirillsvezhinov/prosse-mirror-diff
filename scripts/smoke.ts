import { diffDocuments } from "../src/diff/diffDoc";
import { samplePairs } from "../src/data/samples";
import { defaultNewMarkdown, defaultOldMarkdown } from "../src/data/markdownSamples";
import { parseMarkdown } from "../src/schema";

for (const pair of samplePairs) {
  console.log(`\n=== ${pair.label} ===`);
  const { doc, stats } = diffDocuments(pair.oldDoc, pair.newDoc);
  doc.check();
  console.log("stats:", stats);
}

console.log(`\n=== Markdown -> ProseMirror -> diff ===`);
const oldDoc = parseMarkdown(defaultOldMarkdown);
const newDoc = parseMarkdown(defaultNewMarkdown);
oldDoc.check();
newDoc.check();
const mdDiff = diffDocuments(oldDoc, newDoc);
mdDiff.doc.check();
console.log("stats:", mdDiff.stats);
console.log(JSON.stringify(mdDiff.doc.toJSON(), null, 2));

console.log("\nOK: no exceptions, doc.check() passed for all samples (JSON and Markdown paths).");
