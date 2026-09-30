import { Node } from "prosemirror-model";
import { EMPTY_PARAGRAPH, PARAGRAPH_NODE } from "../blocks";

/**
 * Документ из единственного пустого блока (paragraph или empty_paragraph) →
 * пустая строка.
 */
export function isEmptyDocument(doc: Node): boolean {
  if (doc.childCount !== 1) {
    return false;
  }

  const first = doc.firstChild;
  if (!first) {
    return true;
  }

  const isParagraph = first.type.name === PARAGRAPH_NODE || first.type.name === EMPTY_PARAGRAPH;

  return isParagraph && first.content.size === 0;
}

/**
 * Возвращает массив дочерних узлов ProseMirror Node.
 */
export function getChildren(node: Node): Array<Node> {
  const children: Array<Node> = [];
  node.forEach((child) => {
    children.push(child);
  });

  return children;
}
