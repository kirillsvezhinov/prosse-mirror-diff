import { tableNodes } from 'prosemirror-tables';

export const tableNodeSpec = tableNodes({
  tableGroup: 'block',
  cellContent: 'block+',
  cellAttributes: {
    background: {
      default: null,
      getFromDOM(dom) {
        return dom.style.backgroundColor || null;
      },
      setDOMAttr(value, attrs) {
        if (value) {
          attrs.style = [`background-color: ${value as string}`, attrs.style].filter(Boolean).map(String).join('; ');
        }
      },
    },
  },
});
