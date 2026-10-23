/*
 * runtime/blocks — marker-block string helpers shared by every in-page runtime.
 *
 * Leaf module: it imports nothing local, so any adapter, generator, or checker can
 * use it without creating an import cycle (see runtime/pipeline.mjs for the rules).
 *
 * One insertion rule: every </body> insertion goes through insertBeforeBodyEnd and
 * lands before the LAST </body>. Every replacement uses a function replacer, so a
 * block that contains `$&`, `$$`, `` $` `` or `$'` is inserted byte-for-byte.
 */

export function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function markerPair(id) {
	return { start: `<!-- vpk-${id}:start -->`, end: `<!-- vpk-${id}:end -->` };
}

const MARKED_BLOCK = /<!-- (vpkh?-[\w-]+):(?:start|begin) -->[\s\S]*?<!-- \1:end -->/g;

// Half-open [start, end) ranges of every vpk-*/vpkh-* marked block (":start" or ":begin").
export function markedRanges(html) {
	return [...html.matchAll(MARKED_BLOCK)].map(match => [match.index, match.index + match[0].length]);
}

function blockPattern(start, end, suffix = "") {
	return new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}${suffix}`, "i");
}

// Replaces the first START…END block in place. Returns null when either marker is absent.
export function replaceMarkedBlock(html, start, end, block) {
	if (!html.includes(start) || !html.includes(end)) return null;
	return html.replace(blockPattern(start, end), () => block);
}

// Removes the first START…END block plus one trailing newline; unchanged when absent.
export function removeMarkedBlock(html, start, end) {
	if (!html.includes(start) || !html.includes(end)) return html;
	return html.replace(blockPattern(start, end, "\\n?"), () => "");
}

function lastIndexOfTag(html, tag) {
	return html.toLowerCase().lastIndexOf(tag);
}

// `${block}\n` before the last </body>. A document with <body…> but no </body> gets
// `${block}\n</body>\n` before its last </html>. Anything else throws "missing </body>".
export function insertBeforeBodyEnd(html, block) {
	const bodyEnd = lastIndexOfTag(html, "</body>");
	if (bodyEnd >= 0) return `${html.slice(0, bodyEnd)}${block}\n${html.slice(bodyEnd)}`;
	const htmlEnd = lastIndexOfTag(html, "</html>");
	if (/<body\b/i.test(html) && htmlEnd >= 0) return `${html.slice(0, htmlEnd)}${block}\n</body>\n${html.slice(htmlEnd)}`;
	throw new Error("missing </body>");
}

// In place when present, otherwise inserted before the last </body>. Never moves a block.
export function upsertMarkedBlock(html, { start, end, block }) {
	return replaceMarkedBlock(html, start, end, block) ?? insertBeforeBodyEnd(html, block);
}

// In place when present, otherwise `${block}\n` before the first </head>; throws "missing </head>".
export function upsertMarkedHeadBlock(html, { start, end, block }) {
	const replaced = replaceMarkedBlock(html, start, end, block);
	if (replaced !== null) return replaced;
	const headEnd = html.toLowerCase().indexOf("</head>");
	if (headEnd < 0) throw new Error("missing </head>");
	return `${html.slice(0, headEnd)}${block}\n${html.slice(headEnd)}`;
}

// Legacy enhancement semantics: strip the first START…END block and its trailing whitespace,
// then re-append the block before the last </body>. Only the enhancement step may use this,
// and it must run last (a second move-to-end step would create a 2-cycle).
export function moveMarkedBlockToBodyEnd(html, { start, end, block, label }) {
	const stripped = html.replace(blockPattern(start, end, "\\s*"), () => "");
	try {
		return insertBeforeBodyEnd(stripped, block);
	} catch (error) {
		if (label) throw new Error(`${error.message}: ${label}`);
		throw error;
	}
}
