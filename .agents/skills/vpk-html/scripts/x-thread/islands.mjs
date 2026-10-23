// Islands and text helpers for vpk-html x-thread pages (browser- and Node-safe, no DOM, no I/O).
// The content island (data-vpk-content="x-thread", the WS6 envelope's `content`) and the state
// island (data-vpk-x-thread-state, vpk-x-thread-state/1) are both written by json-island.mjs
// serializeJsonIsland; this module never serializes JSON itself. Splices use slice(), never a
// replace() replacement string. hashText comes from thread-model.mjs (one bundle scope), and
// private top-level names carry an is/IS_ prefix because bundle.mjs concatenates modules.

import { findJsonIslands, jsonIslandTag, parseJsonIsland, serializeJsonIsland } from "../json-island.mjs";
import { MAX_MEDIA, MAX_POSTS, STATUSES, hashText, parsePostedUrl } from "./thread-model.mjs";

export const CONTENT_ATTR = "data-vpk-content";
export const CONTENT_TYPE = "x-thread";
export const STATE_ATTR = "data-vpk-x-thread-state";
export const STATE_SCHEMA = "vpk-x-thread-state/1";
export const LOCAL_SCHEMA = "vpk-x-thread-local/1";
export const EXPORT_SCHEMA = "vpk-x-thread-export/1";
export const TEMPLATE_THREAD_ID = "x-thread-template";
export const THREAD_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const STORAGE_PREFIX = "vpk-x-thread:";
export const isThreadId = value => typeof value === "string" && THREAD_ID_PATTERN.test(value);

const IS_MEDIA_KINDS = ["image", "gif", "video"];
const IS_POST_ID = /^p[0-9]{1,2}$/;
const IS_DIGITS = /^\d{1,20}$/;
const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const isText = value => typeof value === "string";
const IS_IMAGE_DATA_URL = /^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/; // XQ_IMAGE_TYPES only: an imported text/html or SVG blob: link would run its script (B2 decision 15a)
export const isImageDataUrl = value => isText(value) && IS_IMAGE_DATA_URL.test(value);
const isBadAsset = asset => !isText(asset) || /^[a-z][a-z0-9+.-]*:|^[/\\]|\\/i.test(asset) || asset.split("/").some(part => part === ".." || part === "" || part === ".");

export function contentIslandTag(content) {
	return jsonIslandTag({ [CONTENT_ATTR]: CONTENT_TYPE }, content);
}

export function stateIslandTag(state) {
	return jsonIslandTag({ [STATE_ATTR]: STATE_SCHEMA }, state);
}

// Every island carrying attr (and, for the content island, the x-thread type): { openEnd, closeStart, raw }.
export function findIslands(html, attr) {
	const islands = findJsonIslands(String(html), attr);
	const wanted = attr === CONTENT_ATTR ? islands.filter(island => island.attrs[CONTENT_ATTR] === CONTENT_TYPE) : islands;
	return wanted.map(island => ({ openEnd: island.contentStart, closeStart: island.contentEnd, raw: island.raw }));
}

export function findIsland(html, attr) {
	return findIslands(html, attr)[0] || null;
}

function isParse(raw, label, issues) {
	try {
		return parseJsonIsland(raw);
	} catch (error) {
		issues.push(`The ${label} island is not valid JSON: ${error.message}`);
		return undefined;
	}
}

// → { content, state, issues[] }; never throws. content/state are undefined when missing or broken.
export function readIslands(html) {
	const issues = [];
	const read = (attr, label) => {
		const found = findIslands(html, attr);
		if (found.length === 0) issues.push(`The page has no ${label} island`);
		if (found.length > 1) issues.push(`The page has ${found.length} ${label} islands; expected one`);
		return found.length ? isParse(found[0].raw, label, issues) : undefined;
	};
	return { content: read(CONTENT_ATTR, "content"), state: read(STATE_ATTR, "state"), issues };
}

// Replaces both payloads in place: bytes outside the two payloads stay identical. Throws when an island is missing.
export function writeIslands(html, { content, state }) {
	const source = String(html);
	const contentIsland = findIsland(source, CONTENT_ATTR), stateIsland = findIsland(source, STATE_ATTR);
	if (!contentIsland || !stateIsland) throw new Error("writeIslands: the page needs a content island and a state island");
	const edits = [[contentIsland, serializeJsonIsland(content)], [stateIsland, serializeJsonIsland(state)]].sort((a, b) => b[0].openEnd - a[0].openEnd);
	let out = source;
	for (const [island, payload] of edits) out = out.slice(0, island.openEnd) + payload + out.slice(island.closeStart);
	return out;
}

export function isCanonicalIsland(raw) {
	try {
		return serializeJsonIsland(parseJsonIsland(raw)) === raw;
	} catch {
		return false;
	}
}

function isMedia(items, label, issues) {
	if (items === undefined) return [];
	if (!Array.isArray(items)) {
		issues.push(`${label}: media is not a list; ignored`);
		return [];
	}
	const media = [];
	for (const item of items) {
		if (!isObject(item)) continue;
		const kind = IS_MEDIA_KINDS.includes(item.kind) ? item.kind : "image";
		const entry = { kind, alt: isText(item.alt) ? item.alt : "" };
		if (item.asset !== undefined && !isBadAsset(item.asset)) entry.asset = item.asset;
		else if (item.asset !== undefined) issues.push(`${label}: media path ${JSON.stringify(item.asset)} leaves the thread folder; ignored`);
		media.push(entry);
	}
	if (media.length > MAX_MEDIA) issues.push(`${label}: more than ${MAX_MEDIA} media items; extra items ignored`);
	return media.slice(0, MAX_MEDIA);
}

// Defensive shape repair so a hand-damaged island never throws in the runtime. Not a schema
// validator: references/schemas/x-thread.json through --check-content is the authority.
export function normalizeContent(raw) {
	const issues = [];
	const source = isObject(raw) ? raw : {};
	if (!isObject(raw)) issues.push("The content island is not an object");
	const content = { title: isText(source.title) && source.title.trim() ? source.title : "Untitled thread" };
	if (isObject(source.author)) {
		const author = {};
		if (isText(source.author.name) && source.author.name.trim()) author.name = source.author.name;
		if (isText(source.author.handle) && source.author.handle.trim()) author.handle = source.author.handle;
		if (Object.keys(author).length) content.author = author;
	}
	const used = new Set(), posts = [];
	const list = Array.isArray(source.posts) ? source.posts : [];
	if (!Array.isArray(source.posts)) issues.push("The content island has no posts list");
	for (const [index, item] of list.entries()) {
		if (!isObject(item)) {
			issues.push(`Item ${index + 1} in posts is not a post; ignored`);
			continue;
		}
		let id = isText(item.id) && IS_POST_ID.test(item.id) && !used.has(item.id) ? item.id : null;
		if (!id) {
			id = Array.from({ length: 99 }, (_, n) => `p${n + 1}`).find(candidate => !used.has(candidate) && !list.some(other => isObject(other) && other.id === candidate));
			issues.push(`Post ${index + 1} had a missing or repeated id; it is now ${id}`);
		}
		used.add(id);
		const post = { id, text: isText(item.text) ? item.text : "" };
		const media = isMedia(item.media, `Post ${index + 1}`, issues);
		if (media.length) post.media = media;
		if (isText(item.note) && item.note.trim()) post.note = item.note;
		posts.push(post);
	}
	if (posts.length > MAX_POSTS) issues.push(`The thread has ${posts.length} posts; only the first ${MAX_POSTS} are kept`);
	content.posts = posts.slice(0, MAX_POSTS);
	return { content, issues };
}

export function emptyState(threadId) {
	return { schema: STATE_SCHEMA, threadId: isThreadId(threadId) ? threadId : "x-thread", stateRevision: 1, settings: { numbering: "none" }, posts: {}, media: {} };
}

// B2 decision 15a: the one link a posted record may carry, https://x.com/<handle|i>/status/<id>, built from the
// record's id. The handle comes from the stored link only when that link parses as a post link for the same id,
// so an import or a hand edit can never put another scheme or host into a link the page renders.
export function canonicalPostedUrl(posted) {
	const id = String(posted?.id ?? ""), link = parsePostedUrl(isText(posted?.url) ? posted.url : "");
	return `https://x.com/${!link.error && link.id === id && link.handle ? link.handle : "i"}/status/${id}`;
}

function isPosted(value, label, issues) {
	if (!isObject(value) || !IS_DIGITS.test(String(value.id))) return null;
	const posted = { id: String(value.id), url: canonicalPostedUrl(value) };
	if (isText(value.url) && value.url !== posted.url) issues.push(`${label}: the post link was rebuilt as ${posted.url}`);
	if (IS_DIGITS.test(String(value.inReplyTo ?? ""))) posted.inReplyTo = String(value.inReplyTo);
	posted.at = isText(value.at) ? value.at : "";
	posted.text = isText(value.text) ? value.text : "";
	return posted;
}

function isIntent(value) {
	if (!isObject(value)) return null;
	const intent = { openedAt: isText(value.openedAt) ? value.openedAt : "" };
	if (IS_DIGITS.test(String(value.inReplyTo ?? ""))) intent.inReplyTo = String(value.inReplyTo);
	intent.textHash = isText(value.textHash) ? value.textHash : "";
	return intent;
}

// → { state, issues[] }: entries for unknown post ids are dropped (with an issue); defaults fill gaps.
export function normalizeState(raw, content) {
	const issues = [];
	const source = isObject(raw) ? raw : {};
	if (raw !== undefined && !isObject(raw)) issues.push("The state island is not an object; starting from an empty state");
	const state = emptyState(source.threadId);
	if (source.threadId !== undefined && state.threadId !== source.threadId) issues.push(`The thread id ${JSON.stringify(source.threadId)} is not valid; using ${state.threadId}`);
	if (Number.isInteger(source.stateRevision) && source.stateRevision >= 1) state.stateRevision = source.stateRevision;
	if (isObject(source.settings)) {
		if (["none", "suffix", "prefix"].includes(source.settings.numbering)) state.settings.numbering = source.settings.numbering;
		if (IS_DIGITS.test(String(source.settings.replyToId ?? ""))) state.settings.replyToId = String(source.settings.replyToId);
	}
	const ids = new Set((content?.posts || []).map(post => post.id));
	for (const [id, entry] of Object.entries(isObject(source.posts) ? source.posts : {})) {
		if (!ids.has(id)) {
			issues.push(`State for ${id}, which is not in the thread, was dropped`);
			continue;
		}
		if (!isObject(entry) || !STATUSES.includes(entry.status)) continue;
		const posted = entry.status === "posted" ? isPosted(entry.posted, id, issues) : null;
		if (entry.status === "posted" && !posted) {
			issues.push(`${id} was marked posted without a valid post link; it is back to draft`);
			continue;
		}
		const next = { status: entry.status };
		if (entry.status === "approved" && isText(entry.approvedHash)) next.approvedHash = entry.approvedHash;
		if (posted) next.posted = posted;
		const intent = entry.status !== "posted" ? isIntent(entry.intent) : null;
		if (intent) next.intent = intent;
		if (next.status === "draft" && !next.intent) continue;
		state.posts[id] = next;
	}
	for (const [asset, bytes] of Object.entries(isObject(source.media) ? source.media : {})) {
		if (isBadAsset(asset)) continue;
		if (isImageDataUrl(bytes)) state.media[asset] = bytes; else issues.push(`Image ${asset} was dropped: its bytes are not a PNG, JPEG, GIF or WebP base64 data URL`);
	}
	return { state, issues };
}

// NFKD, strip marks, lowercase, runs of anything else to "-", trimmed, at most 64 characters.
export function slugifyThreadId(name) {
	const slug = String(name ?? "").normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64).replace(/-+$/g, "");
	return slug || "x-thread";
}

// Text and attribute values for HTML. # { } and the ( after rgb/rgba/hsl/hsla become numeric
// entities so check-html's colour and placeholder scans never read user text as code.
export function escapeHtmlText(value) {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/#/g, "&#35;")
		.replace(/\{/g, "&#123;")
		.replace(/\}/g, "&#125;")
		.replace(/\b(rgba?|hsla?)\(/gi, (_, name) => `${name}&#40;`);
}

// Sorted-key JSON, the same comparison content-ir.mjs uses for island equality.
export function canonicalJson(value) {
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
	if (isObject(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
	return JSON.stringify(value);
}

export function contentHash(content) {
	return hashText(canonicalJson(content));
}

export function storageKey(threadId) {
	return STORAGE_PREFIX + threadId;
}
