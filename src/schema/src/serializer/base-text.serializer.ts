import { defaultMarkdownSerializer, MarkdownSerializer, MarkdownSerializerState } from 'prosemirror-markdown';
import { Node as PMNode } from 'prosemirror-model';

export class BaseTextSerializer {
  private static emptyParagraph(): void {
    /**
     *  Намерено ничего не делаем, чтобы не спавнить лишних отступов между параграфами
     *  MarkdownDocumentSerializer.serialize() рендерит каждого
     *  верхнеуровневого ребёнка ИЗОЛИРОВАННО (через super.serialize() на одноузловой doc-обёртке)
     *  и сам склеивает результаты через Array.join('\n'),
     *  решая сколько переносов строки поставить между соседями.
     *  empty_paragraph в этой схеме не должен писать
     *  АБСОЛЮТНО НИЧЕГО — даже closeBlock не нужен, поскольку рендер
     *  происходит в полной изоляции без соседей, а не в общем состоянии, которое можно было бы "закрывать"/"сбрасывать".
     * */
  }

  /**
   *   Пишем одиночный `\n` вместо дефолтного `\\\n`, чтобы парсер
   *   markdown-it на одиночном переносе снова получил перенос строки
   *   и вернул тот же узел. Иначе `\\` утекал бы в текст абзаца.
   *   Известное ограничение: два hard_break подряд дают `\n\n` → парсер
   *   читает это как разрыв параграфа, а не два <br>.
   * */
  private static hardBreak(state: MarkdownSerializerState): void {
    state.write('\n');
  }

  /**
   *  Пустой документ ProseMirror — это пустой paragraph-узел.
   *  Без этой проверки он сериализуется в `\n\n` (из дефолтного
   *  `closeBlock`), что ломает round-trip для пустого документа.
   *  Непустой `paragraph` между блоками сериализуется как обычно.
   * */
  private static paragraph(state: MarkdownSerializerState, node: PMNode): void {
    if (node.content.size === 0) {
      return;
    }
    state.renderInline(node);
    state.closeBlock(node);
  }

  public static getMarksSerializerSpecs(): Record<string, MarkdownSerializer['marks'][number]> {
    return {
      ...defaultMarkdownSerializer.marks,
      strike: { open: '~~', close: '~~', mixable: true, expelEnclosingWhitespace: true },
    };
  }

  public static getNodesSerializerMethods(): Record<
    string,
    (state: MarkdownSerializerState, node: PMNode, parent: PMNode, index: number) => void
  > {
    return {
      ...defaultMarkdownSerializer.nodes,
      empty_paragraph: BaseTextSerializer.emptyParagraph,
      paragraph: BaseTextSerializer.paragraph,
      hard_break: BaseTextSerializer.hardBreak,
    };
  }
}
