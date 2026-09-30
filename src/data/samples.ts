// Sample "old" / "new" ProseMirror documents (plain JSON, matching src/schema.ts)
// used to demo the diff viewer: text insertions/deletions, list item add/edit/remove,
// formatting-only changes (marks changed but text didn't), a changed link href,
// a changed code block and an inserted horizontal rule.

export interface SamplePair {
  id: string;
  label: string;
  oldDoc: unknown;
  newDoc: unknown;
}

const releaseNotesOld = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Release notes" }] },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "This release improves performance and fixes a few bugs reported by the community." },
      ],
    },
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Highlights" }] },
    {
      type: "bullet_list",
      content: [
        { type: "list_item", content: [{ type: "paragraph", content: [{ type: "text", text: "Faster startup time" }] }] },
        { type: "list_item", content: [{ type: "paragraph", content: [{ type: "text", text: "Improved memory usage" }] }] },
        { type: "list_item", content: [{ type: "paragraph", content: [{ type: "text", text: "Minor UI polish" }] }] },
      ],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", marks: [{ type: "strong" }], text: "Note:" },
        { type: "text", text: " this build is " },
        { type: "text", marks: [{ type: "em" }], text: "experimental" },
        { type: "text", text: " and may be unstable." },
      ],
    },
    {
      type: "blockquote",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Feedback is welcome via the issue tracker." }] },
      ],
    },
    { type: "code_block", content: [{ type: "text", text: "npm install my-lib@1.0.0" }] },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "See the " },
        { type: "text", marks: [{ type: "link", attrs: { href: "https://example.com/docs/v1" } }], text: "documentation" },
        { type: "text", text: " for details." },
      ],
    },
  ],
};

const releaseNotesNew = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Release notes" }] },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "This release greatly improves performance, adds dark mode, and fixes a number of bugs reported by the community.",
        },
      ],
    },
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Highlights" }] },
    {
      type: "bullet_list",
      content: [
        { type: "list_item", content: [{ type: "paragraph", content: [{ type: "text", text: "Faster startup time" }] }] },
        {
          type: "list_item",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Improved memory usage by 30%" }] }],
        },
        { type: "list_item", content: [{ type: "paragraph", content: [{ type: "text", text: "Dark mode support" }] }] },
      ],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", marks: [{ type: "strong" }], text: "Note:" },
        { type: "text", text: " this build is " },
        { type: "text", marks: [{ type: "strong" }, { type: "em" }], text: "stable" },
        { type: "text", text: " and ready for production." },
      ],
    },
    {
      type: "blockquote",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Feedback is welcome via the issue tracker." }] },
      ],
    },
    { type: "code_block", content: [{ type: "text", text: "npm install my-lib@2.0.0" }] },
    { type: "horizontal_rule" },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "See the " },
        { type: "text", marks: [{ type: "link", attrs: { href: "https://example.com/docs/v2" } }], text: "documentation" },
        { type: "text", text: " and the changelog for details." },
      ],
    },
  ],
};

const minimalOld = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "The quick brown fox jumps over the lazy dog." },
      ],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "This sentence stays " },
        { type: "text", marks: [{ type: "em" }], text: "exactly" },
        { type: "text", text: " the same." },
      ],
    },
  ],
};

const minimalNew = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "The quick red fox leaps over the sleepy dog." },
      ],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "This sentence stays " },
        { type: "text", marks: [{ type: "em" }], text: "exactly" },
        { type: "text", text: " the same." },
      ],
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: "A brand new paragraph was appended at the end." }],
    },
  ],
};

export const samplePairs: SamplePair[] = [
  { id: "release-notes", label: "Release notes (rich example)", oldDoc: releaseNotesOld, newDoc: releaseNotesNew },
  { id: "minimal", label: "Minimal example", oldDoc: minimalOld, newDoc: minimalNew },
];
