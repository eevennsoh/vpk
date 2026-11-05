import test from 'node:test';
import assert from 'node:assert/strict';
import { codeBlock, excerpt, CODE_BLOCK_CSS } from './highlight.mjs';

test('code blocks emit adjacent line spans so no blank line renders between them', () => {
	const html = codeBlock({ code: 'const a = 1;\nreturn a;', file: 'x.ts' });
	assert.equal((html.match(/class="sh__line/g) || []).length, 2);
	assert.doesNotMatch(html, /<\/span>\n<span class="sh__line/);
});

test('short language names map to sugar-high presets', () => {
	assert.match(codeBlock({ code: 'const a = 1', lang: 'ts' }), /sh__token--keyword[^>]*>const</);
	assert.match(codeBlock({ code: 'export function f() {}', lang: 'tsx' }), /sh__token--keyword[^>]*>export</);
});

test('line numbers start at the source line and marked lines are flagged', () => {
	const html = codeBlock({ code: 'a\nb\nc', file: 'x.ts', start: 70, mark: [71] });
	assert.match(html, /--vpk-code-start:69/);
	assert.equal((html.match(/data-mark/g) || []).length, 1);
	assert.match(html, /aria-label="x\.ts, lines 70 to 72"/);
});

test('file links and captions are escaped', () => {
	const html = codeBlock({ code: 'a', file: '<x>.ts', href: 'https://e.test/?a=1&b=2', caption: 'A & B.' });
	assert.match(html, /&lt;x&gt;\.ts/);
	assert.match(html, /a=1&amp;b=2/);
	assert.match(html, /<figcaption>A &amp; B\.<\/figcaption>/);
});

test('excerpt keeps an inclusive 1-based range and removes the shared indent', () => {
	assert.equal(excerpt('x\n\tif (a) {\n\t\tb();\n\t}\ny', 2, 4), 'if (a) {\n\tb();\n}');
});

test('the palette routes through tokens with no raw colour', () => {
	assert.doesNotMatch(CODE_BLOCK_CSS, /#[0-9a-f]{3,8}\b/i);
	assert.match(CODE_BLOCK_CSS, /--code-accent: color-mix\(in srgb, var\(--ill-accent\) 50%, var\(--ink\)\)/);
	assert.match(CODE_BLOCK_CSS, /--sh-keyword: var\(--code-accent\)/);
	assert.match(CODE_BLOCK_CSS, /\.vpk-code \{ display: block;/);
});
