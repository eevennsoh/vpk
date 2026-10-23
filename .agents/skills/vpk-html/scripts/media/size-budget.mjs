/*
 * media/size-budget — page weight and the data-URL viewer budget (the single size value).
 *
 * Chromium caps URLs at 2 MiB (kMaxURLChars = 2,097,152). A viewer that opens an HTML file as
 * `data:text/html;base64,…` therefore renders it blank above
 *   floor((2,097,152 − 22) / 4) × 3 = 1,572,846 bytes.
 * Percent-encoded viewers fail earlier; base64 is the optimistic bound. Full browsers are fine.
 * references/checks-thresholds.json mirrors the value as sizeBudget.warnBytes (test-guarded).
 * Everyone imports this module or calls weightWarnings(); nobody re-derives the number.
 * check-html prints the warning (advisory, stderr); --verify prints the page weight.
 */

export const URL_CAP_CHARS = 2 * 1024 * 1024;
export const DATA_URL_HTML_PREFIX = "data:text/html;base64,";
export const DATA_URL_SAFE_HTML_BYTES = Math.floor((URL_CAP_CHARS - DATA_URL_HTML_PREFIX.length) / 4) * 3; // 1,572,846

const DATA_URL = /data:([a-z]+\/[a-z0-9.+-]+)[;,][^"')\s]*/gi;
const RUNTIME_BLOCK = /<!-- ([\w-]+):(?:start|begin) -->([\s\S]*?)<!-- \1:end -->/g;

export function base64Length(bytes) {
	return 4 * Math.ceil(bytes / 3);
}

export function dataUrlLength(bytes) {
	return DATA_URL_HTML_PREFIX.length + base64Length(bytes);
}

export function formatMB(bytes) {
	return `${(bytes / 1e6).toFixed(2)} MB`;
}

function lineAt(html, index) {
	let line = 1;
	for (let cursor = html.indexOf("\n"); cursor >= 0 && cursor < index; cursor = html.indexOf("\n", cursor + 1)) line += 1;
	return line;
}

// → { bytes, dataUrls: { [mime]: chars }, nonMediaBytes, largest: [{ mime, chars, line }] (top 3), runtimeBlocks: [{ id, bytes }] }
export function measureHtmlWeight(html) {
	const bytes = Buffer.byteLength(html);
	const dataUrls = {};
	const urls = [];
	let mediaChars = 0;
	for (const match of html.matchAll(DATA_URL)) {
		const mime = match[1].toLowerCase();
		const chars = match[0].length;
		dataUrls[mime] = (dataUrls[mime] ?? 0) + chars;
		mediaChars += chars;
		urls.push({ mime, chars, index: match.index });
	}
	const largest = urls
		.sort((a, b) => b.chars - a.chars)
		.slice(0, 3)
		.map(({ mime, chars, index }) => ({ mime, chars, line: lineAt(html, index) }));
	const runtimeBlocks = [...html.matchAll(RUNTIME_BLOCK)].map(match => ({ id: match[1], bytes: Buffer.byteLength(match[0]) }));
	return { bytes, dataUrls, nonMediaBytes: Math.max(0, bytes - mediaChars), largest, runtimeBlocks };
}

// Media groups for the message: each mime on its own, every font/* merged as "fonts". Top 3, largest first.
function mediaBreakdown(dataUrls) {
	const groups = new Map();
	for (const [mime, chars] of Object.entries(dataUrls)) {
		const key = mime.startsWith("font/") ? "fonts" : mime;
		groups.set(key, (groups.get(key) ?? 0) + chars);
	}
	return [...groups].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([key, chars]) => `${key} ${formatMB(chars)}`);
}

// ws4a extension (integration §3 P4): the lite-film target and the composition-specific remedy.

// Byte target for the re-encoded lite film, so `<slug>.lite.html` fits `budgetBytes` with `marginBytes` to spare:
// the non-film bytes stay, and the film's data URL may use what is left (base64 is 4 chars per 3 bytes).
export function liteFilmTargetBytes({ htmlBytes, filmDataUrlChars, budgetBytes = DATA_URL_SAFE_HTML_BYTES, marginBytes = 16384 }) {
	return Math.floor(((budgetBytes - (htmlBytes - filmDataUrlChars) - marginBytes) * 3) / 4);
}

function mimeShare(weight, prefix) {
	return Object.entries(weight.dataUrls).filter(([mime]) => mime.startsWith(prefix)).reduce((sum, [, chars]) => sum + chars, 0);
}

// One sentence chosen by what makes the document heavy: video, fonts or images at 40% or more of its bytes.
export function weightRemedy(weight, { slug = "<slug>" } = {}) {
	const share = prefix => mimeShare(weight, prefix) / Math.max(1, weight.bytes);
	if (share("video/") >= 0.4) return `Ship ${slug}.lite.html (scripts/media/embed.mjs writes it automatically).`;
	if (share("font/") >= 0.4) return `Fonts are ${formatMB(mimeShare(weight, "font/"))}: run build.mjs --inject-runtime <file> to drop invalid @font-face payload, or --refresh-library for skill assets.`;
	if (share("image/") >= 0.4) return `Images are ${formatMB(mimeShare(weight, "image/"))}: re-encode them (encode.mjs stills, WebP q60–72) or link them instead of embedding.`;
	return "Split the document or move media out of the HTML.";
}

export function weightWarnings(html, { label = "document", budgetBytes = DATA_URL_SAFE_HTML_BYTES } = {}) {
	const weight = measureHtmlWeight(html);
	if (weight.bytes <= budgetBytes) return [];
	const breakdown = mediaBreakdown(weight.dataUrls);
	const detail = breakdown.length > 0 ? ` (${breakdown.join(", ")})` : "";
	const slug = String(label).split(/[\\/]/).pop().replace(/\.html?$/i, "") || "document";
	return [`${label}: ${formatMB(weight.bytes)} exceeds the ${formatMB(budgetBytes)} data-URL viewer budget${detail}. Full browsers are fine; viewers that open HTML as a base64 data: URL render it blank, and percent-encoded viewers fail earlier. ${weightRemedy(weight, { slug })}`];
}

// One-line page-weight summary for --verify.
export function formatHtmlWeight(weight) {
	const largest = weight.largest.map(({ mime, chars, line }) => `${mime} ${formatMB(chars)} at line ${line}`).join(", ");
	return `${formatMB(weight.bytes)}${largest ? ` (largest: ${largest})` : ""}`;
}
