import { DiffView } from "./DiffView";
import type { DocInput } from "../diff/diffDoc";

interface DiffCompareProps {
  oldDoc: DocInput;
  newDoc: DocInput;
}

/** Side-by-side demo of the two delete/insert "modify"-pairing strategies,
 * so their behavior on the same input is directly comparable: structural
 * (exact path/nodeType/attrs signature — cheap, blind to content) vs.
 * similarity (same leaf type + text-similarity threshold — pairs only lines
 * that are actually alike). Both run on the same Myers-based engine, so the
 * timing difference reflects the pairing cost only, not the underlying diff
 * algorithm. */
export function DiffCompare({ oldDoc, newDoc }: DiffCompareProps) {
  return (
    <div className="diff-compare">
      <div className="diff-compare-column">
        <h3 className="diff-compare-title">
          Structural pairing
          <span className="diff-compare-hint">пара по path/nodeType/attrs — без учёта текста</span>
        </h3>
        <DiffView oldDoc={oldDoc} newDoc={newDoc} pairing="structural" />
      </div>
      <div className="diff-compare-column">
        <h3 className="diff-compare-title">
          Similarity pairing
          <span className="diff-compare-hint">пара только если текст реально похож (Dice ≥ 0.4)</span>
        </h3>
        <DiffView oldDoc={oldDoc} newDoc={newDoc} pairing="similarity" />
      </div>
    </div>
  );
}
