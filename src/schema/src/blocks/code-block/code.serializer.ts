import { MarkdownSerializerState } from 'prosemirror-markdown';
import { Node, Node as PMNode } from 'prosemirror-model';
import { CODE_BLOCK_NODE } from './code.const';

export class CodeSerializer {
  private static codeBlock(state: MarkdownSerializerState, node: PMNode): void {
    const language: string = (node.attrs.language as string | undefined) || '';
    state.write('```' + language);
    state.ensureNewLine();

    // Если есть контент, то пишем его и переносим строку
    if (node.textContent) {
      state.write(node.textContent);
      state.ensureNewLine();
    } else {
      // Если контента нет, принудительно вставляем пустую строку
      state.write('\n');
    }

    state.write('```');
    state.closeBlock(node);
  }

  public static getNodesSerializerMethods(): Record<
    typeof CODE_BLOCK_NODE,
    (state: MarkdownSerializerState, node: Node, parent: Node, index: number) => void
  > {
    return {
      [CODE_BLOCK_NODE]: CodeSerializer.codeBlock,
    };
  }
}
