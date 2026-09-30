import { useMemo, useState } from "react";
import { DiffView } from "./components/DiffView";
import { ReadonlyEditor } from "./components/ReadonlyEditor";
import { samplePairs } from "./data/samples";
import { defaultNewMarkdown, defaultOldMarkdown } from "./data/markdownSamples";
import { parseMarkdown } from "./markdown/fromMarkdown";
import { schema } from "./schema";
import type { Node as PMNode } from "prosemirror-model";
import "./styles.css";

type Mode = "samples" | "markdown";

export default function App() {
  const [mode, setMode] = useState<Mode>("markdown");
  const [pairId, setPairId] = useState(samplePairs[0].id);
  const [oldMd, setOldMd] = useState(defaultOldMarkdown);
  const [newMd, setNewMd] = useState(defaultNewMarkdown);
  const [showSources, setShowSources] = useState(false);

  const pair = samplePairs.find((p) => p.id === pairId) ?? samplePairs[0];

  const oldParsed = useMemo(() => tryParseMarkdown(oldMd), [oldMd]);
  const newParsed = useMemo(() => tryParseMarkdown(newMd), [newMd]);

  // Whichever mode is active, both sides end up as real PM document nodes —
  // either straight from the Markdown parser, or parsed once from the
  // sample's JSON — so the rest of the UI never has to care which mode fed it.
  const oldDoc = useMemo<PMNode>(
    () => (mode === "markdown" ? oldParsed.doc : schema.nodeFromJSON(pair.oldDoc as any)),
    [mode, oldParsed, pair]
  );
  const newDoc = useMemo<PMNode>(
    () => (mode === "markdown" ? newParsed.doc : schema.nodeFromJSON(pair.newDoc as any)),
    [mode, newParsed, pair]
  );

  return (
    <div className="app">
      <header className="app-header">
        <h1>ProseMirror Diff — прототип</h1>
        <p className="app-subtitle">
          Сравнение двух версий документа: вставки, удаления и изменения форматирования подсвечиваются
          прямо в read-only ProseMirror-блоке.
        </p>
      </header>

      <div className="controls">
        <div className="mode-switch">
          <button className={mode === "markdown" ? "tab active" : "tab"} onClick={() => setMode("markdown")}>
            Markdown → ProseMirror
          </button>
          <button className={mode === "samples" ? "tab active" : "tab"} onClick={() => setMode("samples")}>
            Готовые PM-документы
          </button>
        </div>

        {mode === "samples" && (
          <label>
            Пример:{" "}
            <select value={pairId} onChange={(e) => setPairId(e.target.value)}>
              {samplePairs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <button className="ghost-button" onClick={() => setShowSources((v) => !v)}>
          {showSources ? "Скрыть исходные версии" : "Показать исходные версии (old / new)"}
        </button>
      </div>

      {mode === "markdown" && (
        <section className="markdown-inputs">
          <div className="markdown-column">
            <h2 className="section-title">Markdown — old</h2>
            <textarea className="markdown-textarea" value={oldMd} onChange={(e) => setOldMd(e.target.value)} spellCheck={false} />
            {oldParsed.error && <div className="parse-error">Ошибка разбора: {oldParsed.error}</div>}
          </div>
          <div className="markdown-column">
            <h2 className="section-title">Markdown — new</h2>
            <textarea className="markdown-textarea" value={newMd} onChange={(e) => setNewMd(e.target.value)} spellCheck={false} />
            {newParsed.error && <div className="parse-error">Ошибка разбора: {newParsed.error}</div>}
          </div>
        </section>
      )}

      <section>
        <h2 className="section-title">Diff</h2>
        <DiffView oldDoc={oldDoc} newDoc={newDoc} />
      </section>

      {showSources && (
        <section className="sources">
          <div className="source-column">
            <h2 className="section-title">Old (распарсенный PM-документ)</h2>
            <ReadonlyEditor doc={oldDoc} className="pm-host" />
          </div>
          <div className="source-column">
            <h2 className="section-title">New (распарсенный PM-документ)</h2>
            <ReadonlyEditor doc={newDoc} className="pm-host" />
          </div>
        </section>
      )}
    </div>
  );
}

function tryParseMarkdown(source: string): { doc: PMNode; error: string | null } {
  try {
    return { doc: parseMarkdown(source), error: null };
  } catch (err) {
    return {
      doc: schema.nodeFromJSON({ type: "doc", content: [{ type: "paragraph" }] }),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
