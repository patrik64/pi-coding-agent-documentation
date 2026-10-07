import { getDocs } from '@/lib/llms';
import { GITHUB_REPO, DOCS_URL } from '@/lib/github';

export const dynamic = 'force-static';

/** Index of the corpus, in the llms.txt convention: one link per page. */
export function GET(): Response {
  const docs = getDocs();
  const lines = [
    '# pi coding-agent',
    '',
    '> Annotated source documentation for packages/coding-agent of the pi',
    '> monorepo — the terminal coding agent with read, bash, edit and write',
    '> tools, sessions, compaction, extensions and interactive, print and RPC modes.',
    '',
    `Source: ${GITHUB_REPO}`,
    `User docs: ${DOCS_URL}`,
    '',
    'One page documents each source file, explaining it step by step alongside',
    'excerpts of the real code. Each link below points at that page\'s markdown;',
    'replace /md/ with /docs/ for the rendered version, or fetch /llms-full.txt',
    'for the entire corpus in one request.',
    '',
    '## Pages',
    '',
  ];

  for (const doc of docs) {
    const suffix = doc.source ? ` — source: ${doc.source}` : '';
    const md = doc.url.replace(/^\/docs/, '/md');
    lines.push(`- [${doc.title}](${md}): ${doc.description}${suffix}`);
  }

  return new Response(`${lines.join('\n')}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
