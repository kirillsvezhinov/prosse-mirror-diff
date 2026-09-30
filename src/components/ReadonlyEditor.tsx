import { useEffect, useRef } from "react";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { Node as PMNode } from "prosemirror-model";
import { schema } from "../schema";

interface ReadonlyEditorProps {
  doc: PMNode;
  className?: string;
}

/** A read-only ProseMirror <EditorView>: renders `doc`, blocks all edits,
 * but still allows selecting/copying text like a normal document viewer. */
export function ReadonlyEditor({ doc, className }: ReadonlyEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    const view = new EditorView(hostRef.current, {
      state: EditorState.create({ doc, schema }),
      editable: () => false,
      dispatchTransaction: () => {
        // read-only: ignore every attempted transaction (selection-only
        // changes from the user are harmless to drop here for a prototype)
      },
      attributes: { class: "pm-readonly" },
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.updateState(EditorState.create({ doc, schema }));
  }, [doc]);

  return <div ref={hostRef} className={className} />;
}
