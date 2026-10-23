// Pure thread model for vpk-html x-thread pages (browser- and Node-safe, no DOM, no I/O). doc = { content, state }:
// the x-thread content IR and vpk-x-thread-state/1. Ops never mutate input; they return { doc, error?, message?,
// info?, warnings?, ... } with structural sharing (media data URLs are never copied); on error doc is the input.
// hashText lives here because this module precedes islands.mjs in the bundle; bundle.mjs concatenates modules,
// so private top-level names carry a tm/TM_ prefix.

import { parseTweet, weightedLength } from "./twitter-text.mjs";

export const STATUSES = Object.freeze(["draft", "approved", "skipped", "posted"]);
export const MAX_POSTS = 25, MAX_MEDIA = 4, MAX_WEIGHT = 280, MAX_TEXT_CHARS = 1000, NUMBERING_RESERVE = 7;
export const MAX_NOTE_CHARS = 240, WARN_WEIGHT = 260, INTENT_BASE = "https://x.com/intent/tweet";

const TM_DATA_NEEDED = "[DATA NEEDED", TM_MEDIA_KINDS = ["image", "gif", "video"], TM_NUMBERING = ["none", "suffix", "prefix"];
const TM_FULL = `A thread holds at most ${MAX_POSTS} posts`, TM_MEDIA_FULL = `A post holds at most ${MAX_MEDIA} media items`;
// Severity per status (§4.5 table); a missing status means the row does not apply.
const TM_SEVERITY = {
	limit: { draft: "warning", approved: "error", posted: "warning", skipped: "info" },
	empty: { draft: "warning", approved: "error", posted: "error", skipped: "info" },
	"data-needed": { draft: "warning", approved: "error", posted: "error", skipped: "info" },
	"too-long": { draft: "warning", approved: "error", posted: "error", skipped: "warning" },
	"media-alt": { draft: "warning", approved: "error", skipped: "info" },
	"media-planned": { draft: "info", approved: "warning", skipped: "info" },
	"approval-stale": { approved: "error" },
	"posted-text-changed": { posted: "warning" },
};

export function hashText(value) {
	let hash = 0x811c9dc5;
	for (const unit of String(value ?? "").split("")) hash = Math.imul(hash ^ unit.charCodeAt(0), 0x01000193);
	return "h" + (hash >>> 0).toString(36);
}

const tmPosts = doc => doc?.content?.posts || [];
const tmIndex = (doc, id) => tmPosts(doc).findIndex(post => post.id === id);
const tmPost = (doc, id) => tmPosts(doc)[tmIndex(doc, id)] || null;
const tmEntry = (doc, id) => doc?.state?.posts?.[id] || null;
const tmSettings = doc => ({ numbering: "none", ...(doc?.state?.settings || {}) });
const tmFail = (doc, error, message, extra = {}) => ({ doc, error, message, ...extra });
const tmLabel = (doc, id) => `Post ${tmIndex(doc, id) + 1}`;
const tmLower = text => text.charAt(0).toLowerCase() + text.slice(1);
const tmLines = text => String(text ?? "").replace(/\r\n?/g, "\n");
const tmSame = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const tmIso = now => new Date(now ?? Date.now()).toISOString();
const tmWithPosts = (doc, posts) => ({ content: { ...doc.content, posts }, state: doc.state });
const tmWithState = (doc, patch) => ({ content: doc.content, state: { ...doc.state, ...patch } });
const tmReplacePost = (doc, index, post) => tmWithPosts(doc, tmPosts(doc).map((item, at) => (at === index ? post : item)));
const tmNotFound = (doc, id) => tmFail(doc, "not-found", `No post with id ${id}`);
const tmSplice = (doc, index, remove, ...posts) => tmWithPosts(doc, tmPosts(doc).toSpliced(index, remove, ...posts));
const tmWithEntry = (doc, id, entry) => tmWithState(doc, {
	posts: entry ? { ...doc.state?.posts, [id]: entry } : Object.fromEntries(Object.entries(doc.state?.posts || {}).filter(([key]) => key !== id)),
});

// Highest content index that is posted or has an open intent; nothing at or above it may change.
const tmLockedIndex = doc => tmPosts(doc).findLastIndex(post => tmEntry(doc, post.id)?.status === "posted" || Boolean(tmEntry(doc, post.id)?.intent));
// Numbering is frozen once anything went out (or is out in X), so n/total never changes under it.
const tmChainLocked = doc => tmSettings(doc).numbering !== "none" && tmLockedIndex(doc) >= 0;

function tmGuardPost(doc, id) {
	const index = tmIndex(doc, id), entry = tmEntry(doc, id);
	if (index < 0) return tmNotFound(doc, id);
	if (entry?.status === "posted") return tmFail(doc, "posted-locked", `${tmLabel(doc, id)} is posted and locked`);
	if (entry?.intent) return tmFail(doc, "intent-open", `${tmLabel(doc, id)} is open in X; record its link or cancel it first`);
	if (index <= tmLockedIndex(doc)) return tmFail(doc, "posted-locked", "Posts above the last posted post can't change");
	return null;
}

const tmLockedFail = doc => tmFail(doc, "numbering-locked", "Numbering is locked after the first post went out");
// Removing or restoring the non-skipped post id changes the numbered chain length.
const tmChainGuard = (doc, id) => (tmChainLocked(doc) && statusOf(doc, id) !== "skipped" ? tmLockedFail(doc) : null);
// Pre-checks for ops that add posts (added) and, when inChain, lengthen the numbered chain.
const tmGuardGrowth = (doc, added, inChain) =>
	tmPosts(doc).length + added > MAX_POSTS ? tmFail(doc, "too-many-posts", TM_FULL) : inChain && tmChainLocked(doc) ? tmLockedFail(doc) : null;

function tmFinish(doc, extra = {}) {
	const checked = revalidateApprovals(doc), info = [...(extra.info || []), ...checked.info];
	return { ...extra, doc: checked.doc, ...(info.length ? { info } : {}) };
}

export function statusOf(doc, id) {
	const status = tmEntry(doc, id)?.status;
	return STATUSES.includes(status) ? status : "draft";
}

export function chain(doc) {
	return tmPosts(doc).filter(post => statusOf(doc, post.id) !== "skipped");
}

export function composePostText(doc, id) {
	const post = tmPost(doc, id), { numbering } = tmSettings(doc);
	const ids = post && (numbering === "suffix" || numbering === "prefix") ? chain(doc).map(item => item.id) : [];
	if (!ids.includes(id)) return post ? post.text : "";
	const tag = `${ids.indexOf(id) + 1}/${ids.length}`;
	return numbering === "suffix" ? `${post.text}\n\n${tag}` : `${tag} ${post.text}`;
}

export function countPost(doc, id) {
	return parseTweet(composePostText(doc, id));
}

function tmIssues(doc, post, status) {
	const issues = [];
	const add = (code, message, extra = {}) => {
		const severity = TM_SEVERITY[code === "over-limit" || code === "invalid-chars" ? "limit" : code][status];
		if (severity) issues.push({ severity, code, message, ...extra });
	};
	const text = post.text || "", composed = composePostText(doc, post.id), count = parseTweet(composed);
	if (!text.trim()) add("empty", "The post has no text");
	else if (count.weightedLength > MAX_WEIGHT) add("over-limit", `Over by ${count.weightedLength - MAX_WEIGHT} (${count.weightedLength} / ${MAX_WEIGHT})`);
	else if (!count.valid) add("invalid-chars", "Contains characters X does not accept");
	if (text.includes(TM_DATA_NEEDED)) add("data-needed", "The text still contains [DATA NEEDED");
	// Code points of the trimmed text, like content-ir.mjs maxLength.
	if ([...text.trim()].length > MAX_TEXT_CHARS) add("too-long", `Longer than ${MAX_TEXT_CHARS} characters: too long to save back to the agent`);
	(post.media || []).forEach((item, index) => {
		const alt = typeof item.alt === "string" ? item.alt : "";
		if (!alt.trim() || alt.includes(TM_DATA_NEEDED)) add("media-alt", `Image ${index + 1} needs alt text`, { index });
		if (!item.asset) add("media-planned", `Image ${index + 1} is not attached yet`, { index });
	});
	const entry = tmEntry(doc, post.id);
	if (entry?.approvedHash !== hashText(composed)) add("approval-stale", "The text changed after approval");
	if (entry?.posted && entry.posted.text !== composed) add("posted-text-changed", "The text differs from what was posted");
	return issues;
}

// Errors that block (or invalidate) an approval, ignoring the approval hash itself.
const tmApprovalBlockers = (doc, post) => tmIssues(doc, post, "approved").filter(issue => issue.severity === "error" && issue.code !== "approval-stale");

export function postIssues(doc, id) {
	const post = tmPost(doc, id);
	return post ? tmIssues(doc, post, statusOf(doc, id)) : [];
}

export function validateThread(doc) {
	const result = { errors: [], warnings: [], info: [] };
	const push = (severity, id, code, message) => {
		const position = id ? tmIndex(doc, id) + 1 : 0;
		const prefix = position ? `Post ${position} (${id}): ` : id ? `${id}: ` : "";
		result[severity === "info" ? "info" : `${severity}s`].push({ id: id || null, position, code, message: prefix + message });
	};
	const posts = tmPosts(doc), step = nextStep(doc);
	if (!posts.length) push("error", null, "no-posts", "The thread has no posts");
	if (posts.length > MAX_POSTS) push("error", null, "too-many-posts", `The thread has ${posts.length} posts; the limit is ${MAX_POSTS}`);
	const seen = new Set();
	for (const post of posts) {
		if (!/^p[0-9]{1,2}$/.test(String(post.id))) push("error", post.id, "bad-id", "Post ids look like p1 to p99");
		if (seen.has(post.id)) push("error", post.id, "duplicate-id", "The post id is used twice");
		seen.add(post.id);
		if ((post.media || []).length > MAX_MEDIA) push("error", post.id, "too-many-media", `More than ${MAX_MEDIA} media items`);
		const entry = tmEntry(doc, post.id);
		if (entry && Boolean(entry.posted) !== (entry.status === "posted")) push("error", post.id, "status-mismatch", "Posted status and posted record disagree");
		// An open intent must be the queue's current post with the reply target X was given.
		const drifted = entry?.intent && (step.postId !== post.id || (entry.intent.inReplyTo || null) !== step.inReplyTo);
		if (drifted) push("warning", post.id, "intent-stale", "Open in X, but the queue moved on since; cancel it and open it again");
		for (const issue of postIssues(doc, post.id)) push(issue.severity, post.id, issue.code, issue.message);
	}
	for (const id of Object.keys(doc?.state?.posts || {})) if (!seen.has(id)) push("warning", id, "unknown-state", "State for a post that is not in the content (fill drops it)");
	const { replyToId } = tmSettings(doc), postedIds = new Set();
	let [previous, gap] = [null, null];
	for (const post of chain(doc)) {
		const posted = tmEntry(doc, post.id)?.posted;
		gap = gap || (posted ? null : post.id);
		if (!posted) continue;
		if (gap) push("error", post.id, "posted-gap", `Posted, but ${tmLower(tmLabel(doc, gap))} before it is not`);
		const expected = previous ? previous.id : replyToId;
		if (previous ? posted.inReplyTo !== expected : posted.inReplyTo && posted.inReplyTo !== replyToId) {
			push("error", post.id, "reply-chain", `Replies to ${posted.inReplyTo || "nothing"}, expected ${expected || "no parent"}`);
		}
		if (postedIds.has(posted.id)) push("error", post.id, "duplicate-posted-id", `Posted id ${posted.id} is recorded twice`);
		postedIds.add(posted.id);
		previous = posted;
	}
	return result;
}

// max + 1 while that stays <= 99, else the smallest free p1...p99 (null when all are taken).
export function nextPostId(doc) {
	const used = new Set(tmPosts(doc).map(post => post.id));
	const max = Math.max(0, ...[...used].map(id => Number(/^p([0-9]{1,2})$/.exec(String(id))?.[1] || 0)));
	const free = max < 99 ? max + 1 : Array.from({ length: 99 }, (_, n) => n + 1).find(n => !used.has(`p${n}`));
	return free ? `p${free}` : null;
}

export function setText(doc, id, text) {
	const index = tmIndex(doc, id), entry = tmEntry(doc, id), post = tmPosts(doc)[index], value = tmLines(text);
	if (index < 0) return tmNotFound(doc, id);
	if (entry?.status === "posted") return tmFail(doc, "posted-locked", `${tmLabel(doc, id)} is posted and locked`);
	if (entry?.intent) return tmFail(doc, "intent-open", `${tmLabel(doc, id)} is open in X; cancel it before editing`);
	return value === post.text ? { doc } : tmFinish(tmReplacePost(doc, index, { ...post, text: value }));
}

// afterId: a post id, null for the top, or undefined to append.
export function insertPost(doc, afterId, text = "") {
	const after = afterId === undefined ? tmPosts(doc).length - 1 : afterId === null ? -1 : tmIndex(doc, afterId);
	if (afterId !== undefined && afterId !== null && after < 0) return tmNotFound(doc, afterId);
	const blocked = after + 1 <= tmLockedIndex(doc) ? tmFail(doc, "posted-locked", "New posts go after the last posted post") : tmGuardGrowth(doc, 1, true);
	if (blocked) return blocked;
	const id = nextPostId(doc); // never null: the growth guard keeps the thread at <= 25 posts
	return tmFinish(tmSplice(doc, after + 1, 0, { id, text: tmLines(text) }), { id, index: after + 1 });
}

// Drops the bytes of assets no post references any more and returns them (for undo).
function tmDropMedia(doc, assets) {
	const referenced = new Set(tmPosts(doc).flatMap(post => (post.media || []).map(item => item.asset)));
	const drop = assets.filter(asset => asset && !referenced.has(asset) && asset in (doc.state?.media || {}));
	const removed = Object.fromEntries(drop.map(asset => [asset, doc.state.media[asset]]));
	const media = Object.fromEntries(Object.entries(doc.state?.media || {}).filter(([asset]) => !drop.includes(asset)));
	return { doc: drop.length ? tmWithState(doc, { media }) : doc, removed };
}

export function deletePost(doc, id) {
	const last = tmPosts(doc).length === 1 ? tmFail(doc, "last-post", "A thread needs at least one post") : null;
	const blocked = tmGuardPost(doc, id) || last || tmChainGuard(doc, id);
	if (blocked) return blocked;
	const index = tmIndex(doc, id), post = tmPosts(doc)[index];
	const dropped = tmDropMedia(tmWithEntry(tmSplice(doc, index, 1), id, null), (post.media || []).map(item => item.asset));
	const record = { kind: "delete", label: "Undo delete", index, post, entry: tmEntry(doc, id), media: dropped.removed };
	return tmFinish(dropped.doc, { undo: record, info: [`Post ${index + 1} deleted`] });
}

export function movePost(doc, id, toIndex) {
	const from = tmIndex(doc, id);
	if (from < 0) return tmNotFound(doc, id);
	const locked = tmLockedIndex(doc);
	if (from <= locked) return tmFail(doc, "posted-locked", "Posted posts and the posts above them can't move");
	const to = Math.min(tmPosts(doc).length - 1, Math.max(locked + 1, Math.trunc(Number(toIndex) || 0)));
	if (to === from) return { doc, index: from };
	const moved = tmSplice(tmSplice(doc, from, 1), to, 0, tmPosts(doc)[from]);
	return tmFinish(moved, { index: to, info: [`Post ${from + 1} moved to position ${to + 1}`] });
}

function tmGraphemes(text) {
	if (typeof Intl === "undefined" || typeof Intl.Segmenter !== "function") return Array.from(text);
	return Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text), part => part.segment);
}

// The last grapheme boundary at or before offset, so a split never breaks an emoji or a pair.
function tmGraphemeFloor(text, offset) {
	const at = Math.max(0, Math.min(text.length, Math.trunc(Number(offset) || 0)));
	let floor = 0;
	for (const grapheme of tmGraphemes(text)) if ((floor += grapheme.length) > at) return floor - grapheme.length;
	return floor;
}

export function splitPost(doc, id, offset) {
	const skipped = statusOf(doc, id) === "skipped", blocked = tmGuardPost(doc, id) || tmGuardGrowth(doc, 1, !skipped);
	if (blocked) return blocked;
	const index = tmIndex(doc, id), post = tmPosts(doc)[index], at = tmGraphemeFloor(post.text, offset);
	const first = post.text.slice(0, at).trimEnd(), second = post.text.slice(at).trimStart();
	if (!first.trim() || !second.trim()) return tmFail(doc, "split-empty", "Put the caret where both halves keep some text");
	const newId = nextPostId(doc); // never null: the growth guard keeps the thread at <= 25 posts
	const [a, b] = [{ ...post, text: first }, { id: newId, text: second, note: `Split from ${id}` }];
	const next = tmSplice(doc, index, 1, a, b);
	const record = { kind: "split", label: "Undo split", index, before: post, after: [a, b], entry: tmEntry(doc, id) };
	const info = [`Post ${index + 1} split into posts ${index + 1} and ${index + 2}`];
	return tmFinish(skipped ? tmWithEntry(next, newId, { status: "skipped" }) : next, { id: newId, undo: record, info });
}

function tmJoinNotes(...notes) {
	const joined = notes.filter(note => typeof note === "string" && note.trim()).join(" · ");
	return joined.length > MAX_NOTE_CHARS ? joined.slice(0, MAX_NOTE_CHARS - 1).trimEnd() + "…" : joined;
}

export function mergeWithNext(doc, id) {
	const index = tmIndex(doc, id), [a, b] = index < 0 ? [] : tmPosts(doc).slice(index, index + 2);
	if (a && !b) return tmFail(doc, "no-next", `There is no post after ${tmLower(tmLabel(doc, id))}`);
	const media = [...(a?.media || []), ...(b?.media || [])], full = media.length > MAX_MEDIA ? tmFail(doc, "too-many-media", TM_MEDIA_FULL) : null;
	const blocked = tmGuardPost(doc, id) || tmGuardPost(doc, b.id) || full || tmChainGuard(doc, b.id);
	if (blocked) return blocked;
	const { media: _media, note: _note, ...rest } = a, note = tmJoinNotes(a.note, b.note);
	const merged = { ...rest, text: `${a.text.trimEnd()}\n\n${b.text.trimStart()}`, ...(media.length ? { media } : {}), ...(note ? { note } : {}) };
	const record = { kind: "merge", label: "Undo merge", index, before: [a, b], after: merged, entries: [tmEntry(doc, id), tmEntry(doc, b.id)] };
	const next = tmWithEntry(tmSplice(doc, index, 2, merged), b.id, null);
	return tmFinish(next, { undo: record, info: [`Posts ${index + 1} and ${index + 2} merged`] });
}

// One-step undo of delete, split and merge. It refuses (undo-stale) once the affected posts changed.
export function undo(doc, record) {
	if (!record || !["delete", "split", "merge"].includes(record.kind)) return tmFail(doc, "no-undo", "Nothing to undo");
	const stale = () => tmFail(doc, "undo-stale", "The thread changed since; nothing to undo"), posts = tmPosts(doc);
	if (record.kind === "delete") {
		const index = Math.min(record.index, posts.length);
		if (tmIndex(doc, record.post.id) >= 0) return stale();
		const late = index <= tmLockedIndex(doc) ? tmFail(doc, "posted-locked", "A later post went out; the delete can't be undone") : null;
		const blocked = late || tmGuardGrowth(doc, 1, record.entry?.status !== "skipped");
		if (blocked) return blocked;
		const restored = tmWithEntry(tmSplice(doc, index, 0, record.post), record.post.id, record.entry);
		return tmFinish(tmWithState(restored, { media: { ...(doc.state?.media || {}), ...(record.media || {}) } }), { info: [`Post ${index + 1} restored`] });
	}
	const [first, second] = record.kind === "split" ? record.after : record.before;
	const index = tmIndex(doc, first.id);
	if (index < 0) return stale();
	if (record.kind === "split") {
		if (!tmSame(posts[index], record.after[0]) || !tmSame(posts[index + 1], record.after[1])) return stale();
		const blocked = tmGuardPost(doc, first.id) || tmGuardPost(doc, second.id) || tmChainGuard(doc, second.id);
		if (blocked) return blocked;
		const restored = tmWithEntry(tmWithEntry(tmSplice(doc, index, 2, record.before), second.id, null), first.id, record.entry);
		return tmFinish(restored, { info: [`Post ${index + 1} restored`] });
	}
	if (!tmSame(posts[index], record.after) || tmIndex(doc, second.id) >= 0) return stale();
	const blocked = tmGuardPost(doc, first.id) || tmGuardGrowth(doc, 1, record.entries?.[1]?.status !== "skipped");
	if (blocked) return blocked;
	const restored = tmWithEntry(tmWithEntry(tmSplice(doc, index, 1, ...record.before), first.id, record.entries?.[0]), second.id, record.entries?.[1]);
	return tmFinish(restored, { info: [`Posts ${index + 1} and ${index + 2} restored`] });
}

export function setStatus(doc, id, status) {
	if (!["draft", "approved", "skipped"].includes(status)) return tmFail(doc, "bad-status", "Use recordPosted to mark a post as posted");
	const index = tmIndex(doc, id), current = statusOf(doc, id);
	if (index < 0) return tmNotFound(doc, id);
	if (current === status && status !== "approved") return { doc };
	const blocked = tmGuardPost(doc, id) || ((current === "skipped") !== (status === "skipped") && tmChainLocked(doc) ? tmLockedFail(doc) : null);
	if (blocked) return blocked;
	if (status !== "approved") return tmFinish(tmWithEntry(doc, id, status === "skipped" ? { status } : null));
	const candidate = tmWithEntry(doc, id, { status }), blockers = tmApprovalBlockers(candidate, tmPosts(doc)[index]);
	if (blockers.length) return tmFail(doc, "approve-blocked", blockers[0].message, { issues: blockers });
	return tmFinish(tmWithEntry(doc, id, { status, approvedHash: hashText(composePostText(candidate, id)) }));
}

export function approveAllValid(doc) {
	let next = doc;
	const blocked = [];
	for (const post of tmPosts(doc)) {
		if (statusOf(next, post.id) !== "draft") continue;
		const result = setStatus(next, post.id, "approved");
		if (result.error) blocked.push({ id: post.id, code: result.error, reason: result.message });
		else next = result.doc;
	}
	const approved = tmPosts(doc).filter(post => statusOf(doc, post.id) === "draft").length - blocked.length;
	const reasons = blocked.map(item => `; ${tmLower(tmLabel(next, item.id))}: ${tmLower(item.reason)}`).join("");
	return { doc: next, approved, blocked, info: [`Approved ${approved} post${approved === 1 ? "" : "s"}${reasons}`] };
}

export function clearApprovals(doc) {
	const targets = tmPosts(doc).filter(post => tmEntry(doc, post.id)?.status === "approved" && !tmEntry(doc, post.id).intent);
	return { doc: targets.reduce((next, post) => tmWithEntry(next, post.id, null), doc), cleared: targets.length };
}

// Approved posts whose composed text no longer matches approvedHash go back to draft.
export function revalidateApprovals(doc) {
	const stale = tmPosts(doc).filter(post => tmEntry(doc, post.id)?.status === "approved" && tmEntry(doc, post.id).approvedHash !== hashText(composePostText(doc, post.id)));
	const info = stale.map(post => `${tmLabel(doc, post.id)} went back to draft: its text changed after approval${tmEntry(doc, post.id).intent ? " (the open post in X was cancelled)" : ""}`);
	return { doc: stale.reduce((next, post) => tmWithEntry(next, post.id, null), doc), info };
}

const tmBadAsset = asset => typeof asset !== "string" || /^[a-z][a-z0-9+.-]*:|^[/\\]|\\/i.test(asset) || asset.split("/").some(part => part === ".." || part === "");

export function mediaAssetName(doc, postId, ext = "png") {
	const stems = new Set(tmPosts(doc).flatMap(post => (post.media || []).map(item => String(item.asset || "").replace(/\.[^./]+$/, ""))));
	let n = 1;
	while (stems.has(`media/${postId}-${n}`)) n += 1;
	return `media/${postId}-${n}.${String(ext).toLowerCase().replace(/^\./, "")}`;
}

function tmMediaItem(doc, { kind = "image", alt = "", asset, dataUrl } = {}) {
	if (!TM_MEDIA_KINDS.includes(kind)) return { error: "bad-kind", message: `Media kind must be one of ${TM_MEDIA_KINDS.join(", ")}` };
	if (asset !== undefined && tmBadAsset(asset)) return { error: "bad-asset", message: "Media paths stay inside the thread folder" };
	if (asset && tmPosts(doc).some(post => (post.media || []).some(item => item.asset === asset))) return { error: "duplicate-asset", message: `${asset} is already attached` };
	if (dataUrl !== undefined && (!asset || !String(dataUrl).startsWith("data:"))) return { error: "bad-data", message: "Image bytes need a data URL and an asset path" };
	return { item: { kind, alt: typeof alt === "string" ? alt : "", ...(asset ? { asset } : {}) }, bytes: dataUrl ? { [asset]: dataUrl } : null };
}

// Media edits keep an approval only while the post stays approvable.
function tmEditMedia(doc, id, edit) {
	const guard = tmGuardPost(doc, id);
	if (guard) return guard;
	const index = tmIndex(doc, id), { media: current, ...post } = tmPosts(doc)[index], result = edit(current ? current.slice() : []);
	if (result.error) return tmFail(doc, result.error, result.message);
	let next = tmReplacePost(doc, index, result.media.length ? { ...post, media: result.media } : post);
	if (result.bytes) next = tmWithState(next, { media: { ...(doc.state?.media || {}), ...result.bytes } });
	if (result.drop) next = tmDropMedia(next, [result.drop]).doc;
	const blockers = statusOf(next, id) === "approved" ? tmApprovalBlockers(next, tmPosts(next)[index]) : [];
	return blockers.length ? { doc: tmWithEntry(next, id, null), info: [`${tmLabel(next, id)} went back to draft: ${tmLower(blockers[0].message)}`] } : { doc: next };
}

export function addMedia(doc, id, spec = {}) {
	return tmEditMedia(doc, id, media => {
		const made = media.length >= MAX_MEDIA ? { error: "too-many-media", message: TM_MEDIA_FULL } : tmMediaItem(doc, spec);
		return made.error ? made : { media: [...media, made.item], bytes: made.bytes };
	});
}

export function removeMedia(doc, id, assetOrIndex) {
	return tmEditMedia(doc, id, media => {
		const index = typeof assetOrIndex === "number" ? assetOrIndex : media.findIndex(item => item.asset === assetOrIndex);
		if (!media[index]) return { error: "not-found", message: "No such media item" };
		return { media: media.filter((_, at) => at !== index), drop: media[index].asset };
	});
}

export function setMediaAlt(doc, id, index, alt) {
	return tmEditMedia(doc, id, media => {
		if (!media[index]) return { error: "not-found", message: "No such media item" };
		return { media: media.map((item, at) => (at === index ? { ...item, alt: tmLines(alt) } : item)) };
	});
}

export function fillPlannedSlot(doc, id, index, { asset, dataUrl, kind } = {}) {
	return tmEditMedia(doc, id, media => {
		const slot = media[index];
		if (!slot || slot.asset) return { error: "not-planned", message: "That media item is not a planned slot" };
		const made = asset ? tmMediaItem(doc, { kind: kind || slot.kind, alt: slot.alt, asset, dataUrl }) : { error: "bad-asset", message: "Filling a slot needs an asset path" };
		return made.error ? made : { media: media.map((item, at) => (at === index ? made.item : item)), bytes: made.bytes };
	});
}

function tmBlockReason(post, issue) {
	if (issue.code === "empty" || issue.code === "data-needed") return issue.code;
	return issue.code === "media-alt" && String(post.media?.[issue.index]?.alt).includes(TM_DATA_NEEDED) ? "data-needed" : "invalid";
}

export function nextStep(doc) {
	const thread = chain(doc);
	if (!thread.length) return { kind: "empty" };
	const index = thread.findIndex(post => statusOf(doc, post.id) !== "posted");
	if (index < 0) return { kind: "done", posted: thread.length };
	const post = thread[index], inReplyTo = index > 0 ? tmEntry(doc, thread[index - 1].id)?.posted?.id || null : tmSettings(doc).replyToId || null;
	const where = { postId: post.id, position: index + 1, total: thread.length, inReplyTo };
	const entry = tmEntry(doc, post.id), blockers = tmApprovalBlockers(doc, post);
	if (blockers.length) return { kind: "blocked", ...where, reason: tmBlockReason(post, blockers[0]), message: blockers[0].message };
	const approved = entry?.status === "approved" && entry.approvedHash === hashText(composePostText(doc, post.id));
	if (!approved) return { kind: "blocked", ...where, reason: "not-approved", message: `Approve ${tmLower(tmLabel(doc, post.id))} to continue` };
	return entry.intent ? { kind: "await-url", ...where } : { kind: "open", ...where, text: composePostText(doc, post.id), media: post.media || [] };
}

export function buildIntentUrl({ text, inReplyTo } = {}) {
	const href = INTENT_BASE + "?text=" + encodeURIComponent(String(text ?? ""));
	if (inReplyTo === undefined || inReplyTo === null || inReplyTo === "") return href;
	if (!/^\d{1,20}$/.test(String(inReplyTo))) throw new RangeError("in_reply_to must be a numeric post id");
	return href + "&in_reply_to=" + inReplyTo;
}

const TM_POSTED_URL = /^(?:https?:\/\/)?(?:(?:www|mobile)\.)?(?:x|twitter)\.com\/(?:(?:i\/web|i)\/status|([A-Za-z0-9_]{1,15})\/status(?:es)?)\/(\d{1,20})(?:[/?#]\S*)?$/i;

export function parsePostedUrl(input) {
	const value = String(input ?? "").trim();
	if (!value) return { error: "Paste the link to the post" };
	if (/^\d{1,20}$/.test(value)) return { id: value, handle: null, url: `https://x.com/i/status/${value}` };
	const match = TM_POSTED_URL.exec(value);
	if (!match) return { error: "That is not a link to a post on x.com (x.com/<handle>/status/<id>)" };
	return { id: match[2], handle: match[1] || null, url: `https://x.com/${match[1] || "i"}/status/${match[2]}` };
}

// The current queue step for id, or a failure when id is not the post to open or record next.
function tmCurrent(doc, id, verb) {
	const step = nextStep(doc);
	if (step.postId === id && (step.kind === "open" || step.kind === "await-url")) return { step };
	if (step.postId === id) return tmFail(doc, "not-approved", `Approve ${tmLower(tmLabel(doc, id))} before ${verb}`);
	return tmFail(doc, "not-current", `${tmLabel(doc, id)} is not next in the queue`);
}

export function recordPosted(doc, id, parsed, now) {
	const link = typeof parsed === "string" ? parsePostedUrl(parsed) : parsed || {};
	if (link.error || !link.id) return tmFail(doc, "bad-url", link.error || "Paste the link to the post");
	const { step, ...failed } = tmCurrent(doc, id, "recording its link");
	if (!step) return failed;
	const duplicate = tmPosts(doc).find(post => tmEntry(doc, post.id)?.posted?.id === link.id);
	if (duplicate) return tmFail(doc, "duplicate", `That link is already recorded for ${tmLower(tmLabel(doc, duplicate.id))}`);
	const warnings = [], author = String(doc.content?.author?.handle || "").replace(/^@/, "").toLowerCase();
	if (author && link.handle && link.handle.toLowerCase() !== author) warnings.push(`The link is from @${link.handle}, not @${author}`);
	// X got the in_reply_to the intent was opened with: record that parent, and warn when the queue expects another.
	const intent = tmEntry(doc, id)?.intent, parent = intent ? intent.inReplyTo || null : step.inReplyTo;
	if (parent !== step.inReplyTo) warnings.push(`${tmLabel(doc, id)} was opened in X as a reply to ${parent || "nothing"}, but the queue expects ${step.inReplyTo || "no parent"}`);
	if (/^\d+$/.test(parent || "") && BigInt(link.id) <= BigInt(parent)) warnings.push("The post id is older than the post it replies to");
	const posted = { id: link.id, url: link.url, ...(parent ? { inReplyTo: parent } : {}), at: tmIso(now), text: composePostText(doc, id) };
	const next = tmWithEntry(doc, id, { status: "posted", posted }), after = nextStep(next);
	const tail = after.kind === "done" ? " All posts are recorded." : after.postId ? ` Next: ${tmLower(tmLabel(next, after.postId))}.` : "";
	return { doc: next, ...(warnings.length ? { warnings } : {}), info: [`${tmLabel(doc, id)} recorded.${tail}`] };
}

export function unrecordPosted(doc, id) {
	if (statusOf(doc, id) !== "posted") return tmFail(doc, "not-posted", `${tmLabel(doc, id)} is not posted`);
	const thread = chain(doc), later = thread.slice(thread.findIndex(post => post.id === id) + 1);
	if (later.some(post => statusOf(doc, post.id) === "posted")) return tmFail(doc, "not-last", "Only the last posted post can be unrecorded");
	// An open intent already went to X with this post's id as in_reply_to, so the record stays until it is cancelled.
	const open = tmPosts(doc).find(post => post.id !== id && tmEntry(doc, post.id)?.intent);
	if (open) return tmFail(doc, "intent-open", `${tmLabel(doc, open.id)} is open in X; cancel it before unrecording ${tmLower(tmLabel(doc, id))}`);
	return { doc: tmWithEntry(doc, id, { status: "approved", approvedHash: hashText(composePostText(doc, id)) }) };
}

export function markIntentOpened(doc, id, now) {
	const { step, ...failed } = tmCurrent(doc, id, "opening it");
	if (!step) return failed;
	const intent = { openedAt: tmIso(now), ...(step.inReplyTo ? { inReplyTo: step.inReplyTo } : {}), textHash: hashText(composePostText(doc, id)) };
	return { doc: tmWithEntry(doc, id, { ...tmEntry(doc, id), intent }) };
}

export function cancelIntent(doc, id) {
	const { intent, ...entry } = tmEntry(doc, id) || {};
	return { doc: intent ? tmWithEntry(doc, id, entry) : doc };
}

export function setNumbering(doc, numbering) {
	if (!TM_NUMBERING.includes(numbering)) return tmFail(doc, "bad-numbering", `Numbering is one of ${TM_NUMBERING.join(", ")}`);
	if (tmSettings(doc).numbering === numbering) return { doc };
	if (tmLockedIndex(doc) >= 0) return tmLockedFail(doc);
	return tmFinish(tmWithState(doc, { settings: { ...tmSettings(doc), numbering } }));
}

// S7: post 1 replies to an existing post. value is a post URL or id; null clears it.
export function setReplyToId(doc, value) {
	if (tmLockedIndex(doc) >= 0) return tmFail(doc, "posted-locked", "The thread already started");
	const { replyToId: _old, ...settings } = tmSettings(doc);
	const link = value === null || value === undefined || value === "" ? null : parsePostedUrl(value);
	if (link?.error) return tmFail(doc, "bad-url", link.error);
	return { doc: tmWithState(doc, { settings: link ? { ...settings, replyToId: link.id } : settings }) };
}

// ---- Composer: turn pasted notes, lists, markdown or JSON into posts ----

const TM_SEPARATOR = /^\s*(?:-{3,}|\*{3,}|_{3,}|={3,})\s*$/;
const TM_NUMBERED = /^\s*\d{1,3}\s*(?:[.)]|\/\d{0,3})\s+/;
const TM_BULLET = new RegExp("^[-*\\u2022+]\\s+");
const TM_COUNTER_SUFFIX = /\s*\(\d{1,3}\/\d{1,3}\)\s*$|\s+\d{1,3}\/\d{1,3}\s*$/;
const TM_SENTENCE_END = new RegExp("[.!?\\u2026]+[\"')\\]\\u2019\\u201D]*\\s+|\\n+", "g");

function tmLink(label, url) {
	const bare = url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
	return label === url || label.replace(/\/$/, "") === bare ? url : `${label} ${url}`;
}

export function markdownToPlain(chunk) {
	const notes = [], media = [];
	const text = tmLines(chunk)
		// [!] and [>] keep HTML comment delimiters out of the inlined page script (check-html, parser).
		.replace(/<[!]--\s*note:\s*([\s\S]*?)\s*--[>]/gi, (_, note) => (notes.push(note.trim()), ""))
		.replace(/<[!]--[\s\S]*?--[>]/g, () => "")
		.replace(/!\[([^\]]*)\]\(\s*[^)\s]*(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g, (_, alt) => (media.push({ kind: "image", alt: alt.trim() }), ""))
		.replace(/\[([^\]]+)\]\(\s*([^)\s]+)(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g, (_, label, url) => tmLink(label.trim(), url))
		.split("\n")
		.map(line => line.replace(/^\s*(?:>\s?)+/, () => "").replace(/^\s{0,3}#{1,6}\s+(.*?)(?:\s+#+)?\s*$/, (_, heading) => heading))
		.join("\n")
		.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, (_, inner) => inner)
		.replace(/(^|[^\w])__(?=\S)([\s\S]*?\S)__(?!\w)/g, (_, lead, inner) => lead + inner)
		.replace(/`([^`\n]+)`/g, (_, code) => code)
		.replace(/(^|[^\w*\\])\*(?=[^\s*])([^*\n]*?[^\s*\\])\*(?![\w*])/gm, (_, lead, inner) => lead + inner)
		.replace(/(^|[^\w\\])_(?=[^\s_])([^_\n]*?[^\s_\\])_(?!\w)/gm, (_, lead, inner) => lead + inner)
		.replace(/\\([!-/:-@[-`{-~])/g, (_, char) => char)
		.replace(/[ \t]+$/gm, () => "")
		.replace(/\n{3,}/g, () => "\n\n")
		.trim();
	const note = tmJoinNotes(...notes);
	return { text, ...(note ? { note } : {}), ...(media.length ? { media } : {}) };
}

function tmJsonPost(item) {
	const text = typeof item === "string" ? item : typeof item?.text === "string" ? item.text : null;
	if (text === null) return null;
	const media = (Array.isArray(item.media) ? item.media : []).filter(entry => entry && typeof entry === "object").map(entry => ({
		kind: TM_MEDIA_KINDS.includes(entry.kind) ? entry.kind : "image",
		alt: typeof entry.alt === "string" ? entry.alt : "",
		...(typeof entry.asset === "string" && !tmBadAsset(entry.asset) ? { asset: entry.asset } : {}),
	}));
	const note = typeof item.note === "string" ? item.note.trim() : "";
	return { text: tmLines(text).trim(), ...(note ? { note } : {}), ...(media.length ? { media } : {}) };
}

// A JSON array of posts, { title?, posts }, or a content envelope / export carrying content.posts.
function tmFromJson(source) {
	let value;
	try { value = /^[[{]/.test(source) ? JSON.parse(source) : null; } catch { return null; }
	const holder = Array.isArray(value) ? { posts: value } : value?.content?.posts ? value.content : value;
	const posts = Array.isArray(holder?.posts) ? holder.posts.map(tmJsonPost) : [null];
	if (posts.includes(null)) return null;
	return { title: typeof holder.title === "string" && holder.title.trim() ? holder.title.trim() : undefined, posts };
}

function tmDetect(lines) {
	if (lines.some(line => TM_SEPARATOR.test(line))) return "separators";
	if (lines.filter(line => TM_NUMBERED.test(line)).length >= 2) return "numbered";
	return lines.filter(line => TM_BULLET.test(line)).length >= 2 ? "bullets" : "paragraphs";
}

function tmChunks(lines, mode) {
	if (mode === "paragraphs") return lines.join("\n").split(/\n[ \t]*\n/);
	const marker = mode === "numbered" ? TM_NUMBERED : mode === "bullets" ? TM_BULLET : TM_SEPARATOR;
	const items = [{ lines: [], listed: false }];
	for (const line of lines) {
		if (!marker.test(line)) items[items.length - 1].lines.push(line);
		else items.push({ lines: mode === "separators" ? [] : [line.replace(marker, () => "")], listed: mode !== "separators" });
	}
	const texts = items.map(item => item.lines.join("\n").trim());
	return texts.map((text, index) => (items[index].listed ? text.replace(TM_COUNTER_SUFFIX, () => "") : text));
}

export function splitSource(source, { mode = "auto", stripMarkdown = true, fit = false, max = MAX_WEIGHT, reserve = 0 } = {}) {
	const text = tmLines(source).trim();
	if (!text) return { mode, posts: [] };
	const json = mode === "auto" || mode === "json" ? tmFromJson(text) : null;
	if (mode === "json" && !json) return { mode, posts: [], error: "bad-json", message: "Paste a JSON array of posts or { title, posts }" };
	let { title, posts } = json || {}, used = "json";
	if (!json) {
		let lines = text.split("\n");
		const heading = /^#\s+(.+?)\s*#*\s*$/.exec(lines[0]);
		if (heading && (lines.length === 1 || !lines[1].trim())) [title, lines] = [heading[1], lines.slice(1)];
		used = mode === "auto" ? tmDetect(lines) : mode;
		posts = tmChunks(lines, used).map(chunk => (stripMarkdown ? markdownToPlain(chunk) : { text: chunk.trim() }));
	}
	posts = posts.filter(post => post.text || post.media);
	if (fit) posts = posts.flatMap(post => splitToFit(post.text, max, reserve).map((piece, index) => (index ? { text: piece } : { ...post, text: piece })));
	const result = { ...(title ? { title } : {}), mode: used, posts };
	if (posts.length <= MAX_POSTS) return result;
	return { ...result, error: "too-many-posts", message: `That makes ${posts.length} posts; a thread holds at most ${MAX_POSTS}` };
}

// Greedy split at sentence ends, then words, then graphemes, so each piece weighs <= max - reserve.
export function splitToFit(text, max = MAX_WEIGHT, reserve = 0) {
	const limit = Math.max(1, max - reserve), value = tmLines(text);
	const fits = candidate => weightedLength(candidate.trim()) <= limit;
	if (fits(value)) return [value.trim()];
	const pieces = [];
	let current = "";
	const place = (unit, finer) => {
		if (fits(current + unit)) return void (current += unit);
		if (current.trim()) pieces.push(current.trim());
		current = "";
		if (fits(unit) || !finer) current = unit;
		else finer(unit);
	};
	const units = value.split(new RegExp(`(?<=${TM_SENTENCE_END.source})`));
	const graphemes = word => tmGraphemes(word).forEach(grapheme => place(grapheme));
	for (const unit of units) place(unit, sentence => sentence.split(/(?<=\s)/).forEach(word => place(word, graphemes)));
	if (current.trim()) pieces.push(current.trim());
	return pieces;
}

export function fitPost(doc, id) {
	const guard = tmGuardPost(doc, id);
	if (guard) return guard;
	const index = tmIndex(doc, id), post = tmPosts(doc)[index];
	const [first, ...rest] = splitToFit(post.text, MAX_WEIGHT, tmSettings(doc).numbering === "none" ? 0 : NUMBERING_RESERVE);
	if (!rest.length) return { doc, ids: [id], info: [`${tmLabel(doc, id)} already fits`] };
	const skipped = statusOf(doc, id) === "skipped", blocked = tmGuardGrowth(doc, rest.length, !skipped);
	if (blocked) return blocked;
	let next = tmReplacePost(doc, index, { ...post, text: first });
	const ids = [id];
	for (const piece of rest) {
		const newId = nextPostId(next); // never null: the growth guard keeps the thread at <= 25 posts
		next = tmSplice(next, index + ids.length, 0, { id: newId, text: piece, note: `Split from ${id}` });
		if (skipped) next = tmWithEntry(next, newId, { status: "skipped" });
		ids.push(newId);
	}
	return tmFinish(next, { ids, info: [`${tmLabel(doc, id)} split into ${ids.length} posts`] });
}
