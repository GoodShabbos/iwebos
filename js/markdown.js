// markdown.js — a small, safe Markdown → HTML renderer for the Notepad.
// Input is HTML-escaped first, so nothing typed can inject markup; only the
// tags this file emits ever reach the DOM. Supports headings, bold/italic/
// strikethrough, inline + fenced code, links (http/https/mailto only),
// blockquotes, flat bullet/numbered lists and horizontal rules.

const esc = (s) => s
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

function inline(text) {
  const stash = [];
  const keep = (html) => `\u0000${stash.push(html) - 1}\u0000`;
  let s = esc(text);
  s = s.replace(/`([^`]+)`/g, (_, code) => keep(`<code>${code}</code>`));
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) =>
    /^(https?:\/\/|mailto:)/i.test(url)
      ? keep(`<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`)
      : m);
  s = s.replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_, a, b) => `<strong>${a ?? b}</strong>`);
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*(?!\*)/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^\w_])_([^_\s][^_]*)_(?![\w_])/g, '$1<em>$2</em>');
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => stash[i]);
}

const HR = /^\s*([-*_])(\s*\1){2,}\s*$/;
const UL = /^\s*[-*+]\s+/;
const OL = /^\s*\d+\.\s+/;
const startsBlock = (l) => /^(#{1,6}\s|```|>)/.test(l) || HR.test(l) || UL.test(l) || OL.test(l);

export function renderMarkdown(src) {
  const lines = String(src).replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    if (/^```/.test(line)) {
      const code = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i++; // closing fence (or end of input)
      out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
      continue;
    }

    const h = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (h) {
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
      i++;
      continue;
    }

    if (HR.test(line)) { out.push('<hr>'); i++; continue; }

    if (/^>/.test(line)) {
      const quote = [];
      while (i < lines.length && /^>/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote>${renderMarkdown(quote.join('\n'))}</blockquote>`);
      continue;
    }

    const list = UL.test(line) ? { re: UL, tag: 'ul' } : OL.test(line) ? { re: OL, tag: 'ol' } : null;
    if (list) {
      const items = [];
      while (i < lines.length && list.re.test(lines[i])) items.push(`<li>${inline(lines[i++].replace(list.re, ''))}</li>`);
      out.push(`<${list.tag}>${items.join('')}</${list.tag}>`);
      continue;
    }

    const para = [];
    while (i < lines.length && lines[i].trim() && (para.length === 0 || !startsBlock(lines[i]))) para.push(lines[i++].trim());
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return out.join('\n');
}
