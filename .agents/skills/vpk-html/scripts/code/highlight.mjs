// code/highlight — build-time syntax highlighting for vpk-html code excerpts. The vendored sugar-high tokenizer
// (vendor/sugar-high, MIT, v2.6.4, see vendor/NOTICE.md) runs in Node while the page is built; the shipped HTML holds only
// static `.sh__token--*` spans that read `var(--sh-*)`, so a code block adds no runtime script and stays offline.
//
// The palette is the paper identity, not sugar-high's rainbow default: ink identifiers, the figure accent's text-safe orange
// for keywords, and stepped neutrals for everything else. Code then reads as part of the same system as the figures.

import { highlight } from './vendor/sugar-high/lib/index.js';

const ALIASES = { ts: 'typescript', tsx: 'typescript', mts: 'typescript', js: 'javascript', jsx: 'javascript', mjs: 'javascript', sh: 'shell', bash: 'shell', zsh: 'shell', py: 'python', rs: 'rust', yml: 'yaml', md: 'markdown', txt: 'plaintext' };
const escape = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

// Every role routes through page tokens, so check-html sees no raw colour. The keyword orange is the figure accent mixed
// half and half with ink: about #926817 on the light sunken surface (AA) and a pale orange on dark, so code and figures
// share one hue without a second accent token. (ADS's own code keyword token is red, which would compete with it.)
export const CODE_TOKENS_CSS = [
	'/* code/highlight: paper syntax palette (one accent, stepped neutrals) */',
	':root {',
	'\t--code-accent: color-mix(in srgb, var(--ill-accent) 50%, var(--ink));',
	'\t--sh-identifier: var(--ink);',
	'\t--sh-keyword: var(--code-accent);',
	'\t--sh-jsxliterals: var(--code-accent);',
	'\t--sh-class: var(--ink);',
	'\t--sh-entity: var(--ink);',
	'\t--sh-property: var(--body-text);',
	'\t--sh-string: var(--muted-text);',
	'\t--sh-sign: var(--subtlest-text);',
	'\t--sh-comment: var(--subtlest-text);',
	'}',
].join('\n');

// The code figure: a sunken card with a 1px ring (no border), a file header row, numbered lines and an optional caption
// outside the card. Scoped to .vpk-code so it never restyles a template's own <pre>.
export const CODE_BLOCK_CSS = `${CODE_TOKENS_CSS}
.vpk-code { display: block; inline-size: 100%; min-inline-size: 0; max-inline-size: 100%; margin: 24px 0 0; text-align: start; }
.vpk-code-card { inline-size: 100%; min-inline-size: 0; max-inline-size: 100%; border-radius: 12px; background: var(--surface-sunken); box-shadow: 0 0 0 1px color-mix(in oklab, var(--ink) 7%, transparent); overflow: clip; }
.vpk-code-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-block-size: 36px; padding: 0 14px; border-block-end: 1px solid color-mix(in oklab, var(--ink) 7%, transparent); color: var(--muted-text); font: 11px/1.4 var(--font-mono); }
.vpk-code-head a { color: inherit; text-decoration: none; }
.vpk-code-head a:hover { color: var(--ink); }
.vpk-code-lang { color: var(--subtlest-text); }
.vpk-code pre { font-variant-ligatures: none; font-feature-settings: "liga" 0, "calt" 0; display: block; inline-size: 100%; max-inline-size: 100%; box-sizing: border-box; margin: 0; padding: 12px 0; text-align: start; white-space: normal; overflow-x: auto; background: transparent; border: 0; font: 12px/1.7 var(--font-mono); tab-size: 2; }
.vpk-code code { display: block; inline-size: max-content; min-inline-size: 100%; margin: 0; padding: 0; border: 0; border-radius: 0; background: none; box-shadow: none; color: inherit; font: inherit; counter-reset: vpk-line var(--vpk-code-start, 0); }
.vpk-code .sh__line { display: block; padding-inline: 14px 18px; white-space: pre; }
.vpk-code .sh__line::before { counter-increment: vpk-line; content: counter(vpk-line); display: inline-block; inline-size: 3ch; margin-inline-end: 14px; color: var(--subtlest-text); text-align: end; opacity: .7; user-select: none; }
.vpk-code .sh__line[data-mark] { background: color-mix(in oklab, var(--ill-accent) 14%, transparent); box-shadow: inset 2px 0 var(--ill-accent); }
.vpk-code .sh__token--comment { font-style: italic; }
.vpk-code .sh__token--keyword { font-weight: 500; }
figure.vpk-code > figcaption { margin: 10px 0 0; padding: 0; text-align: start; max-inline-size: none; color: var(--muted-text); font-size: 12px; line-height: 1.5; }
@media print { .vpk-code-card { box-shadow: none; border: 1px solid var(--rule); } }`;

/**
 * Render one code excerpt as a static figure.
 * @param {{ code: string, lang?: string, file?: string, href?: string, start?: number, mark?: number[], caption?: string }} options
 *   `start` is the first source line number; `mark` lists source line numbers to tint with the figure accent.
 */
export function codeBlock({ code, lang = 'ts', file = '', href = '', start = 1, mark = [], caption = '' }) {
	const marked = new Set(mark);
	const body = highlight(String(code).replace(/\s+$/, ''), { lang: ALIASES[lang] || lang })
		.split(/\n?(?=<span class="sh__line)/)
		.map((line, index) => marked.has(start + index) ? line.replace('<span class="sh__line"', '<span class="sh__line" data-mark') : line)
		.join('');
	const name = file ? (href ? `<a href="${escape(href)}">${escape(file)} <span aria-hidden="true">↗</span></a>` : `<span>${escape(file)}</span>`) : '<span></span>';
	const label = file ? `${file}, lines ${start} to ${start + String(code).replace(/\s+$/, '').split('\n').length - 1}` : 'Code excerpt';
	return `<figure class="vpk-code" data-vpkh-no-lightbox><div class="vpk-code-card"><div class="vpk-code-head">${name}<span class="vpk-code-lang">${escape(lang)}</span></div><pre tabindex="0" aria-label="${escape(label)}"><code style="--vpk-code-start:${Math.max(0, start - 1)}">${body}</code></pre></div>${caption ? `<figcaption>${escape(caption)}</figcaption>` : ''}</figure>`;
}

/** Read a 1-based inclusive line range from source text, removing the shared indent. */
export function excerpt(source, from, to) {
	const lines = String(source).split('\n').slice(from - 1, to);
	const indent = Math.min(...lines.filter(line => line.trim()).map(line => line.match(/^\s*/)[0].length));
	return lines.map(line => line.slice(Number.isFinite(indent) ? indent : 0)).join('\n');
}
