import { useMemo } from "react";
import { diffDocuments } from "../diff/diffDoc";
import type { DocInput } from "../diff/diffDoc";
import { ReadonlyEditor } from "./ReadonlyEditor";

interface DiffViewProps {
  oldDoc: DocInput;
  newDoc: DocInput;
}

export function DiffView({ oldDoc, newDoc }: DiffViewProps) {
  const result = useMemo(() => {
    try {
      return { ok: true as const, ...diffDocuments(oldDoc, newDoc) };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  }, [oldDoc, newDoc]);

  if (!result.ok) {
    return (
      <div className="diff-panel">
        <div className="diff-error">Не удалось построить дифф: {result.error}</div>
      </div>
    );
  }

  const { doc, stats } = result;

  return (
    <div className="diff-panel">
      <div className="diff-toolbar">
        <Legend />
        <div className="diff-stats">
          <span className="stat stat-ins">+{stats.insertedChars} chars</span>
          <span className="stat stat-del">-{stats.deletedChars} chars</span>
          <span className="stat stat-fmt">{stats.formatChanges} format change{stats.formatChanges === 1 ? "" : "s"}</span>
          <span className="stat">
            {stats.insertedLines} line{stats.insertedLines === 1 ? "" : "s"} added ·{" "}
            {stats.deletedLines} removed · {stats.modifiedLines} edited
          </span>
        </div>
      </div>
      <ReadonlyEditor doc={doc} className="pm-host pm-diff-host" />
    </div>
  );
}

function Legend() {
  return (
    <div className="diff-legend">
      <span className="legend-item">
        <ins className="diff-insert legend-swatch">Aa</ins> added
      </span>
      <span className="legend-item">
        <del className="diff-delete legend-swatch">Aa</del> removed
      </span>
      <span className="legend-item">
        <span className="diff-format legend-swatch">Aa</span> formatting changed
      </span>
      <span className="legend-item">
        <span className="legend-swatch line-swatch" /> line added/removed
      </span>
    </div>
  );
}
