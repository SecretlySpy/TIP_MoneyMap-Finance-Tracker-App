#!/usr/bin/env node
import { readFile, writeFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const sourceFile = resolve(repoRoot, 'README.md');
const outputFile = resolve(repoRoot, 'docs', 'index.html');

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInlineMarkdown(text, blobBase) {
  let result = escapeHtml(text);
  // Links: [text](href)
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, href) => {
    const normalized = href.trim();
    if (/^https?:\/\//.test(normalized) || normalized.startsWith('#')) {
      return `<a href="${escapeHtml(normalized)}">${escapeHtml(label)}</a>`;
    }
    if (normalized.startsWith('./') || normalized.startsWith('../') || normalized.endsWith('.md')) {
      const target = blobBase ? `${blobBase}/${normalized.replace(/^\.\/?/, '')}` : normalized;
      return `<a href="${escapeHtml(target)}">${escapeHtml(label)}</a>`;
    }
    return `<a href="${escapeHtml(normalized)}">${escapeHtml(label)}</a>`;
  });
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>');
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return result;
}

function buildHtml(bodyContent) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MoneyMap Finance Tracker</title>
  <meta name="description" content="Static MoneyMap project overview and quick start guide.">
  <style>
    :root {
      color-scheme: light;
      color: #111111;
      background: #f4f4f2;
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.7;
      text-rendering: optimizeLegibility;
      font-variant-east-asian: full-width;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      padding: 0;
      min-height: 100vh;
      background: #f4f4f2;
      color: #111;
    }
    .page {
      max-width: 920px;
      margin: 0 auto;
      padding: 2rem 1.25rem 4rem;
    }
    a { color: #0b6af2; text-decoration: none; }
    a:hover, a:focus-visible { text-decoration: underline; }
    h1, h2, h3, h4, h5, h6 { margin-top: 2.25rem; margin-bottom: 1rem; line-height: 1.15; }
    h1 { font-size: clamp(2rem, 3vw, 3rem); }
    h2 { font-size: clamp(1.5rem, 2.6vw, 2.2rem); }
    p { margin-bottom: 1.25rem; }
    ul, ol { margin: 0 0 1.25rem 1.5rem; }
    li { margin-bottom: 0.75rem; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; background: #e8e7e5; padding: 0.2rem 0.35rem; border-radius: 4px; }
    pre {
      overflow: auto;
      padding: 1rem;
      background: #1d1f21;
      color: #f8f8f2;
      border-radius: 0.75rem;
      margin: 1rem 0;
    }
    pre code { color: inherit; background: transparent; padding: 0; }
    blockquote {
      margin: 1.5rem 0;
      padding-left: 1rem;
      border-left: 4px solid #0b6af2;
      color: #333;
    }
    .hero {
      padding: 3rem 0 1.5rem;
      border-bottom: 1px solid rgba(17, 17, 17, 0.08);
    }
    .hero p { max-width: 68ch; margin-top: 1rem; font-size: 1.05rem; color: #3e444a; }
    .hero .meta { margin-top: 0.75rem; font-size: 0.95rem; color: #5c6369; }
    @media (max-width: 640px) {
      .page { padding: 1.5rem 1rem 2.5rem; }
    }
  </style>
</head>
<body>
  <main class="page">
    <div class="hero">
      <h1>MoneyMap Finance Tracker</h1>
      <p>An Android-first, offline-first personal finance tracker for students, built with React Native and Expo.</p>
      <p class="meta">Static project documentation generated from README.md.</p>
    </div>
    ${bodyContent}
  </main>
</body>
</html>`;
}

function renderMarkdown(source, blobBase) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let inCode = false;
  let codeLang = '';
  let listType = null;
  let listOpen = false;
  let paragraphOpen = false;

  const closeParagraph = () => {
    if (paragraphOpen) {
      html.push('</p>');
      paragraphOpen = false;
    }
  };
  const closeList = () => {
    if (listOpen) {
      html.push(listType === 'ol' ? '</ol>' : '</ul>');
      listType = null;
      listOpen = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, '    ');
    if (inCode) {
      if (line.trim().startsWith('```')) {
        html.push('</code></pre>');
        inCode = false;
        continue;
      }
      html.push(escapeHtml(line));
      continue;
    }

    const codeFence = line.trim().match(/^```\s*(\S*)/);
    if (codeFence) {
      closeParagraph();
      closeList();
      inCode = true;
      codeLang = codeFence[1] || '';
      html.push(`<pre><code${codeLang ? ` class="language-${escapeHtml(codeLang)}"` : ''}>`);
      continue;
    }

    if (!line.trim()) {
      closeParagraph();
      closeList();
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      closeParagraph();
      closeList();
      const level = headingMatch[1].length;
      const content = renderInlineMarkdown(headingMatch[2].trim(), blobBase);
      html.push(`<h${level}>${content}</h${level}>`);
      continue;
    }

    const listMatch = line.match(/^([-*]|\d+\.)\s+(.*)$/);
    if (listMatch) {
      closeParagraph();
      const foundType = /^\d+\./.test(listMatch[1]) ? 'ol' : 'ul';
      if (!listOpen || listType !== foundType) {
        closeList();
        listOpen = true;
        listType = foundType;
        html.push(`<${listType}>`);
      }
      const content = renderInlineMarkdown(listMatch[2].trim(), blobBase);
      html.push(`<li>${content}</li>`);
      continue;
    }

    const blockquoteMatch = line.match(/^>\s?(.*)$/);
    if (blockquoteMatch) {
      closeParagraph();
      closeList();
      html.push(`<blockquote>${renderInlineMarkdown(blockquoteMatch[1], blobBase)}</blockquote>`);
      continue;
    }

    if (!paragraphOpen) {
      closeList();
      paragraphOpen = true;
      html.push('<p>');
    }
    html.push(renderInlineMarkdown(line.trim(), blobBase));
  }

  closeParagraph();
  closeList();
  if (inCode) {
    html.push('</code></pre>');
  }
  return html.join('\n');
}

async function getRepoBlobBase() {
  try {
    const [{ stdout: urlRaw }, { stdout: branchRaw }] = await Promise.all([
      execFileAsync('git', ['config', '--get', 'remote.origin.url'], { cwd: repoRoot }),
      execFileAsync('git', ['rev-parse', '--abbrev-ref', 'origin/HEAD'], { cwd: repoRoot }),
    ]);
    const url = urlRaw.trim();
    if (!url) return null;
    let branch = branchRaw.trim();
    if (branch.startsWith('origin/')) {
      branch = branch.slice('origin/'.length);
    }
    if (!branch) {
      branch = 'main';
    }
    const normalized = url
      .replace(/^git@github\.com:/, 'https://github.com/')
      .replace(/\.git$/, '')
      .replace(/\/+$/, '');
    return `${normalized}/blob/${encodeURIComponent(branch)}`;
  } catch {
    return null;
  }
}

async function main() {
  const content = await readFile(sourceFile, 'utf8');
  const blobBase = await getRepoBlobBase();
  let bodyContent = renderMarkdown(content, blobBase);
  const titleTag = '<h1>MoneyMap Finance Tracker</h1>';
  bodyContent = bodyContent.trimStart();
  if (bodyContent.startsWith(titleTag)) {
    bodyContent = bodyContent.slice(titleTag.length).trimStart();
  }
  bodyContent = bodyContent.replace(/^<p>\s*An Android-first, offline-first personal finance tracker for students, built with React Native and Expo\.\s*<\/p>\s*/i, '');
  const output = buildHtml(bodyContent);
  await writeFile(outputFile, output, 'utf8');
  console.log(`Wrote ${outputFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
