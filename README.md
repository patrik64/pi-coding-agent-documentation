# pi coding-agent documentation

Annotated source documentation for [pi coding-agent](https://github.com/patrik64/pi-mono/tree/main/packages/coding-agent) (`packages/coding-agent` of the pi monorepo),
built with Next.js, [fumadocs](https://fumadocs.dev) and [Code Hike](https://codehike.org).

The sidebar mirrors the project's file tree — one page per source file, each a
**scrollycoding walkthrough**: a scroll-driven code panel with animated token
transitions, explaining the file step by step alongside excerpts of the real
code. Every excerpt is quoted verbatim and checked against the source.

## View

deploy it with `pnpm build` (any Next.js host); locally it runs at http://localhost:3000.

Machine-readable copies live at
`/llms.txt` (an
index), `/llms-full.txt`
(the whole corpus) and `/md/<page-path>` (one page's markdown).

## Run

```sh
pnpm i
pnpm dev
```

Requires the `pi-mono` repository checked out as a sibling directory
(`../pi-mono`, documenting `../pi-mono/packages/coding-agent`) for `pnpm gen` and `pnpm check`.

## Check the docs against the source

```sh
pnpm check
```

`scripts/check-docs.mjs` is what keeps the documentation honest. It reports:

- **drift** — a quoted line that no longer appears in the file it came from,
  which is how pages silently rot as the source changes,
- **orphans** — a page whose `source:` file no longer exists, and source files
  that have no page yet,
- **MDX hazards** — raw `<`, `>`, `{` or `}` in prose, malformed step fences,
  and unbalanced Scrollycoding blocks.

Without `../pi-mono` present it runs the MDX checks only. CI
(`.github/workflows/ci.yml`) checks out both repositories so the full set runs.

## Regenerate pages

```sh
pnpm gen
```

`scripts/generate-docs.mjs` walks `../pi-mono/packages/coding-agent` (`src/`
and `scripts/`; vendored files and binary assets are skipped) and, for every source file:

- creates `content/docs/<path>.mdx` with the file's leading comment as the
  summary and its full source embedded,
- rewrites only pages whose frontmatter says `generated: true`,
- prunes generated pages whose source file is gone, and *reports* hand-written
  pages in the same state rather than deleting prose worth keeping,
- rewrites every `meta.json` (folders first, like a file explorer).

Every file currently has a hand-written walkthrough; `gen` scaffolds a
generated source page for any file added later, which can be promoted the same
way.

## Write a walkthrough

To promote a generated page to a hand-written walkthrough, remove
`generated: true` from its frontmatter and write Code Hike
[scrollycoding](https://codehike.org/docs/layouts/scrollycoding) content —
see `content/docs/src/core/agent-session.ts.mdx` for the pattern:

````mdx
<Scrollycoding>

## !!steps Step title

Explanation shown next to the code.

```ts ! file.ts
// the code for this step; annotate with // !mark or // !mark(1:3)
```

</Scrollycoding>
````

Keep the `source:` frontmatter field — it renders the
"View source on GitHub" button and is what `pnpm check` verifies excerpts
against.

One rule worth knowing before writing: code inside a fence must be copied
**verbatim** from the source (use a `// ...` line to mark omissions).
`pnpm check` enforces it.

## The code graph

`/docs/code-graph`
draws one node per page that has a `source:` field, and one edge per pair of
such pages where either links to the other. It is built from the links
fumadocs-mdx extracts at compile time (`extractLinkReferences` in
`source.config.ts`), so there is nothing to regenerate: link one walkthrough to
another and the edge appears.

The pieces are `lib/build-graph.ts` (the data), `components/graph-view.tsx`
(the canvas, adapted from the fumadocs
[Graph View](https://www.fumadocs.dev/docs/ui/components/graph-view)) and
`components/code-graph.tsx` (the legend and the table view). Node colors are
the `--graph-*` variables in `app/global.css`.
