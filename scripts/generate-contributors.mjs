// Computes the top contributors of every documented source file from the git
// history of ../pi-mono and writes them to lib/contributors.json, which the docs
// page renders as a table. Run with `pnpm contributors`.
//
// "Lines contributed" are the lines of the file's current version that `git blame`
// attributes to an author, so the numbers add up to the file's length. Authors are
// grouped by name, because the same person often commits under several e-mail addresses.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DOCS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MONOREPO = path.resolve(DOCS_ROOT, '..', 'pi-mono');
const PROJECT = path.join(MONOREPO, 'packages', 'coding-agent');
const CONTENT = path.join(DOCS_ROOT, 'content', 'docs');
const OUT = path.join(DOCS_ROOT, 'lib', 'contributors.json');
const TOP = 5;

if (!fs.existsSync(path.join(MONOREPO, '.git'))) {
  console.error('../pi-mono is not a git checkout; cannot read the history.');
  process.exit(1);
}

function* mdxFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* mdxFiles(full);
    else if (entry.name.endsWith('.mdx')) yield full;
  }
}

/** Lines per author name for one file, as `git blame` attributes them at HEAD. */
function blame(sourceRel) {
  const out = execFileSync(
    'git',
    ['blame', '--line-porcelain', '-w', 'HEAD', '--', `packages/coding-agent/${sourceRel}`],
    { cwd: MONOREPO, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const lines = new Map();
  for (const line of out.split('\n')) {
    if (!line.startsWith('author ')) continue;
    const name = line.slice('author '.length).trim();
    lines.set(name, (lines.get(name) ?? 0) + 1);
  }
  return lines;
}

const result = {};
let skipped = 0;

for (const file of mdxFiles(CONTENT)) {
  const fm = /^---\n([\s\S]*?)\n---/.exec(fs.readFileSync(file, 'utf8'));
  const sourceRel = fm && /^source:\s*"?([^"\n]+)"?$/m.exec(fm[1])?.[1];
  if (!sourceRel || result[sourceRel]) continue;
  if (!fs.existsSync(path.join(PROJECT, sourceRel))) {
    skipped++;
    continue;
  }

  const lines = blame(sourceRel);
  const total = [...lines.values()].reduce((a, b) => a + b, 0);
  result[sourceRel] = {
    total,
    top: [...lines]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, TOP)
      .map(([name, count]) => ({ name, lines: count })),
  };
}

const sorted = Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(OUT, `${JSON.stringify(sorted, null, 2)}\n`);
console.log(`${Object.keys(sorted).length} files written to ${path.relative(DOCS_ROOT, OUT)}` +
  (skipped ? ` (${skipped} skipped: source file missing)` : ''));
