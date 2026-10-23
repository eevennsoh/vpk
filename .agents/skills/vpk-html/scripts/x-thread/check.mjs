// x-thread in-file rules (integration R8, K10): the CONTENT_TYPE_HOOKS["x-thread"] validator that
// content-ir.mjs awaits for every data-vpk-content="x-thread" island. Thread rules only; it never
// calls checkContent. Cheap to import: pure modules, no file reads, no heavy dependencies (R28).
//
//   checkThreadHtml(html) → { ok, errors: string[], warnings: string[], info: string[] }
//
// Rules: exactly one content and one state island, both canonical (serializeJsonIsland output);
// validateThread errors and warnings (the §4.5 severity table, with stale approvals as errors);
// every attached asset has bytes in the state island and no bytes are orphaned; no template
// placeholders in the head, the <h1> or the byline; a valid threadId that is not the template's.

import { validateThread } from "./thread-model.mjs";
import { CONTENT_ATTR, STATE_ATTR, STATE_SCHEMA, TEMPLATE_THREAD_ID, THREAD_ID_PATTERN, canonicalPostedUrl, findIslands, isCanonicalIsland, isImageDataUrl, isThreadId, normalizeContent, normalizeState, readIslands } from "./islands.mjs";

const PLACEHOLDER = /\{\{[^}]+\}\}/;
const isObjectLike = value => value !== null && typeof value === "object" && !Array.isArray(value);

function visibleShell(html) {
	const head = /<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(html)?.[1] ?? "";
	const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] ?? "";
	const byline = /<p\b[^>]*class=["'][^"']*\bxt-byline\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i.exec(html)?.[1] ?? "";
	return { head: head.replace(/<style\b[\s\S]*?<\/style>/gi, "").replace(/<script\b[\s\S]*?<\/script>/gi, ""), h1, byline };
}

export function checkThreadHtml(html) {
	const source = String(html ?? "");
	const errors = [], warnings = [], info = [];
	const contentIslands = findIslands(source, CONTENT_ATTR), stateIslands = findIslands(source, STATE_ATTR);
	if (contentIslands.length !== 1) errors.push(`expected one data-vpk-content="x-thread" island, found ${contentIslands.length}`);
	if (stateIslands.length !== 1) errors.push(`expected one ${STATE_ATTR} island, found ${stateIslands.length}`);
	for (const [label, islands] of [["content", contentIslands], ["state", stateIslands]]) {
		if (islands[0] && !isCanonicalIsland(islands[0].raw)) errors.push(`${label} island not canonical (hand-edited?); re-run x-thread.mjs fill or import`);
	}
	if (!new RegExp(`${STATE_ATTR}=["']${STATE_SCHEMA}["']`).test(source) && stateIslands.length) errors.push(`the state island must declare ${STATE_ATTR}="${STATE_SCHEMA}"`);
	const read = readIslands(source);
	if (read.content === undefined || read.state === undefined) {
		for (const issue of read.issues) if (!errors.includes(issue)) errors.push(issue);
		return { ok: errors.length === 0, errors, warnings, info };
	}
	const { content, issues: contentIssues } = normalizeContent(read.content);
	const { state, issues: stateIssues } = normalizeState(read.state, content);
	contentIssues.forEach(issue => errors.push(`content: ${issue}`));
	// A rebuilt posted link is an error below, so its normalisation note is not repeated as a warning.
	stateIssues.filter(issue => !/post link was rebuilt|^Image .* was dropped/.test(issue)).forEach(issue => warnings.push(`state: ${issue}`));
	// Non-image bytes in state.media (text/html, image/svg+xml, ...) become a same-origin blob: link on "Download image N";
	// the page drops them on load, and check refuses the file so the import path never ships one.
	for (const [asset, bytes] of Object.entries(isObjectLike(read.state?.media) ? read.state.media : {})) if (!isImageDataUrl(bytes)) errors.push(`state media ${asset} is not a PNG, JPEG, GIF or WebP base64 data URL (hand-edited or imported?); re-run x-thread.mjs fill`);
	// B2 decision 15a: the page renders posted links, so a stored link that is not canonical (a javascript: link from an
	// import, another host, a tracking query) fails the check; fill and import rewrite it from the id.
	for (const [id, entry] of Object.entries(isObjectLike(read.state?.posts) ? read.state.posts : {})) {
		const posted = entry?.posted;
		if (isObjectLike(posted) && posted.url !== canonicalPostedUrl(posted)) errors.push(`${id}: the posted link is not a canonical https://x.com/<handle>/status/<id> link (hand-edited or imported?); re-run x-thread.mjs fill`);
	}
	if (read.state?.schema !== STATE_SCHEMA) errors.push(`state.schema must be ${STATE_SCHEMA}`);
	const threadId = read.state?.threadId;
	if (!isThreadId(threadId)) errors.push(`state.threadId ${JSON.stringify(threadId)} must match ${THREAD_ID_PATTERN.source}`);
	else if (threadId === TEMPLATE_THREAD_ID) errors.push(`state.threadId is still ${TEMPLATE_THREAD_ID}; render artifacts with x-thread.mjs fill`);

	const result = validateThread({ content, state });
	for (const item of result.errors) errors.push(item.message);
	for (const item of result.warnings) warnings.push(item.message);
	for (const item of result.info) info.push(item.message);

	const assets = new Set();
	content.posts.forEach((post, index) => (post.media || []).forEach((item, at) => {
		if (!item.asset) return;
		assets.add(item.asset);
		if (item.kind !== "video" && !(item.asset in state.media)) errors.push(`Post ${index + 1} (${post.id}): image ${at + 1} (${item.asset}) has no bytes in the state island; run x-thread.mjs fill`);
	}));
	for (const asset of Object.keys(state.media)) if (!assets.has(asset)) warnings.push(`state media ${asset} is not used by any post (fill drops it)`);

	const shell = visibleShell(source);
	for (const [label, text] of Object.entries(shell)) {
		if (PLACEHOLDER.test(text)) errors.push(`template placeholder left in the ${label}: ${PLACEHOLDER.exec(text)[0]}`);
	}
	return { ok: errors.length === 0, errors, warnings, info };
}
