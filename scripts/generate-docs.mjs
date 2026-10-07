// Generates one MDX page per source file of ../pi-mono/packages/coding-agent, mirroring its
// directory tree under content/docs. Pages carry `generated: true` in their
// frontmatter and are rewritten on every run; remove that flag (as the
// hand-written walkthroughs do) and the page is left alone. meta.json files
// are always rewritten to keep the sidebar in file-explorer order.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DOCS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = path.resolve(DOCS_ROOT, '..', 'pi-mono', 'packages', 'coding-agent');
const CONTENT = path.join(DOCS_ROOT, 'content', 'docs');

const INCLUDE_DIRS = ['src', 'scripts'];
const SKIP_DIRS = new Set(['node_modules', 'dist', 'vendor', 'assets']);
const LANGS = {
  '.ts': 'ts',
  '.js': 'js',
  '.mjs': 'js',
  '.md': 'md',
  '.sh': 'bash',
  '.css': 'css',
  '.html': 'html',
  '.json': 'json',
};

// Optional overrides for files whose leading comment is missing or unhelpful.
const SUMMARIES = {
  'src/index.ts': 'Public SDK entry point of @earendil-works/pi-coding-agent.',
  'src/main.ts': 'The CLI entry point: argument parsing, mode selection and startup.',
};

/** First leading comment of the file, collapsed to one line (or undefined). */
function extractSummary(source, ext) {
  const lines = source.split('\n').slice(0, 60);
  const collected = [];
  let inBlock = false;
  let inImport = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (inBlock) {
      const end = line.indexOf('*/');
      collected.push((end >= 0 ? line.slice(0, end) : line).replace(/^\*\s?/, ''));
      if (end >= 0) break;
      continue;
    }
    if (inImport) {
      if (line.endsWith(';')) inImport = false;
      continue;
    }
    if (line.startsWith('import ') || line.startsWith('use ')) {
      if (!line.endsWith(';')) inImport = true;
      continue;
    }
    if (line === '' || line.startsWith('<script') || line.startsWith('#[') || line.startsWith('#!['))
      continue;
    if (line.startsWith('//')) {
      collected.push(line.replace(/^\/\/[/!]?\s?/, ''));
      continue;
    }
    if (line.startsWith('/*')) {
      const body = line.replace(/^\/\*+\s?/, '');
      const end = body.indexOf('*/');
      collected.push(end >= 0 ? body.slice(0, end) : body);
      if (end < 0) inBlock = true;
      else break;
      continue;
    }
    if (line.startsWith('<!--') && ext === '.html') {
      collected.push(line.replace(/^<!--\s?/, '').replace(/-->.*$/, ''));
      continue;
    }
    break; // first real code line ends the header comment
  }
  const text = collected.join(' ').replace(/\s+/g, ' ').trim();
  if (!text) return undefined;
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}

function fallbackSummary(relPath) {
  const base = path.basename(relPath);
  if (/\.(test|spec)\.[jt]s$/.test(base)) {
    return `Unit tests for ${base.replace(/\.(test|spec)\.([jt]s)$/, '.$2')}.`;
  }
  if (base === 'index.ts') return `Barrel module re-exporting ${path.dirname(relPath)}.`;
  return `Source file ${relPath} of pi coding-agent.`;
}

function readFrontmatter(mdxPath) {
  const text = fs.readFileSync(mdxPath, 'utf8');
  const m = /^---\n([\s\S]*?)\n---/.exec(text);
  return m ? m[1] : '';
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      files.push(...walk(full));
    } else if (LANGS[path.extname(e.name)]) {
      files.push(full);
    }
  }
  return files;
}

function generatePage(relPath) {
  const abs = path.join(PROJECT, relPath);
  const outPath = path.join(CONTENT, `${relPath}.mdx`);

  if (fs.existsSync(outPath) && !/^generated:\s*true$/m.test(readFrontmatter(outPath))) {
    return 'kept';
  }

  const sourceText = fs.readFileSync(abs, 'utf8').replace(/\n$/, '');
  const ext = path.extname(relPath);
  const base = path.basename(relPath);
  const summary =
    SUMMARIES[relPath] ?? extractSummary(sourceText, ext) ?? fallbackSummary(relPath);

  const backtickRuns = sourceText.match(/`+/g) ?? [];
  const fence = '`'.repeat(Math.max(4, ...backtickRuns.map((r) => r.length + 1)));

  const mdx = `---
title: ${JSON.stringify(base)}
description: ${JSON.stringify(summary)}
source: ${JSON.stringify(relPath)}
generated: true
---

_Auto-generated page showing the full file contents. To replace it with a
hand-written walkthrough, remove \`generated: true\` from the frontmatter so
\`pnpm gen\` keeps your edits._

${fence}${LANGS[ext]} ${base} -n
${sourceText}
${fence}
`;

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const existed = fs.existsSync(outPath);
  fs.writeFileSync(outPath, mdx);
  return existed ? 'updated' : 'created';
}

/** Delete generated pages whose source file no longer exists, and report
 * hand-written ones — those are never deleted automatically, since the prose
 * may be worth moving rather than losing. */
function pruneStale(validOutputs) {
  let pruned = 0;
  const orphans = [];
  const mdxFiles = [];
  (function collect(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) collect(full);
      else if (e.name.endsWith('.mdx')) mdxFiles.push(full);
    }
  })(CONTENT);
  for (const mdxPath of mdxFiles) {
    if (validOutputs.has(mdxPath)) continue;
    const fm = readFrontmatter(mdxPath);
    if (/^generated:\s*true$/m.test(fm)) {
      fs.rmSync(mdxPath);
      pruned++;
    } else if (/^source:/m.test(fm)) {
      orphans.push(path.relative(CONTENT, mdxPath));
    }
  }
  return { pruned, orphans };
}

/** Rewrite meta.json in every content folder: subfolders first, then pages. */
function writeMeta(dir, isRoot) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const folders = [];
  const pages = [];
  for (const e of entries) {
    if (e.isDirectory()) {
      folders.push(e.name);
      writeMeta(path.join(dir, e.name), false);
    } else if (e.name.endsWith('.mdx') && e.name !== 'index.mdx') {
      pages.push(e.name.replace(/\.mdx$/, ''));
    }
  }
  const byName = (a, b) => a.localeCompare(b, 'en');
  folders.sort(byName);
  pages.sort(byName);

  const meta = { title: path.basename(dir), pages: [...folders, ...pages] };
  if (isRoot) {
    // fixed order for the hand-written pages, then the mirrored tree
    // `index` is never collected above (it is the folder's own page) but must
    // still lead the sidebar; the others appear only if their file exists.
    const fixed = [
      'index',
      'architecture',
      'code-graph',
      'findings',
      'src',
      'scripts',
    ];
    const rest = meta.pages.filter((p) => !fixed.includes(p));
    const lead = fixed.filter((p) => p === 'index' || meta.pages.includes(p));
    meta.pages = [...lead, ...rest];
    delete meta.title;
  }
  if (path.basename(dir) === 'src' && path.dirname(dir) === CONTENT) meta.defaultOpen = true;
  fs.writeFileSync(path.join(dir, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
}

const counts = { created: 0, updated: 0, kept: 0 };
const validOutputs = new Set();
for (const includeDir of INCLUDE_DIRS) {
  for (const file of walk(path.join(PROJECT, includeDir))) {
    const relPath = path.relative(PROJECT, file);
    validOutputs.add(path.join(CONTENT, `${relPath}.mdx`));
    counts[generatePage(relPath)]++;
  }
}
const { pruned, orphans } = pruneStale(validOutputs);
writeMeta(CONTENT, true);
console.log(
  `docs: ${counts.created} created, ${counts.updated} regenerated, ${counts.kept} hand-written kept, ${pruned} stale pruned`,
);
if (orphans.length > 0) {
  console.log(
    `\n${orphans.length} hand-written page(s) document a source file that no longer exists.\n` +
      'They were kept — move or delete them by hand:',
  );
  for (const o of orphans.sort()) console.log(`  ${o}`);
}
