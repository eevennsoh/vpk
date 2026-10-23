// Browser runtime for vpk-html x-thread pages, bundled into the page by bundle.mjs.
// bootXThread(document, window, { storage, clock, now, raf, confirm }) reads the content and state
// islands, merges the browser's local copy, renders the thread (read mode by default, so post
// text is commentable DOM text), and wires the composer, per-post actions, media slots, the
// posting queue, copy/export and the C5 provider (runtime-queue.mjs). Posts are
// keyed by content id and never re-created (WS1 C1). No console calls and no script-opened
// windows: every intent is a link the user clicks. Private top-level names carry an xt/XT_ prefix.

import { MAX_WEIGHT, WARN_WEIGHT, approveAllValid, cancelIntent, chain, clearApprovals, composePostText, deletePost, mergeWithNext, movePost, removeMedia, revalidateApprovals, setMediaAlt, setStatus, setText, splitPost, statusOf, undo, validateThread } from "./thread-model.mjs";
import { extractUrlsWithIndices, parseTweet } from "./twitter-text.mjs";
import { parseJsonIsland } from "../json-island.mjs";
import { CONTENT_ATTR, CONTENT_TYPE, LOCAL_SCHEMA, STATE_ATTR, canonicalJson, contentHash, normalizeContent, normalizeState, storageKey } from "./islands.mjs";
import { xsCard, xsChange, xsClick, xsFlipFirst, xsFlipPlay, xsKey, xsRender, xsTag } from "./runtime-stretch.mjs";
import { xqAddFiles, xqClick, xqCloseCopy, xqComposer, xqCopy, xqDownload, xqExportState, xqInput, xqIntentOpened, xqKeydown, xqMediaFocus, xqMediaHref, xqRegisterProvider, xqRender, xqRenderMedia, xqRevokeMedia, xqSummaryCounts } from "./runtime-queue.mjs";

const XT_THREAD_CODES = ["no-posts", "too-many-posts", "bad-id", "duplicate-id", "too-many-media", "status-mismatch", "posted-gap", "reply-chain", "duplicate-posted-id", "intent-stale", "unknown-state"];
const XT_STATUS_LABEL = { draft: "Draft", approved: "Approved", skipped: "Skipped", posted: "Posted" };
const XT_TAG = /(^|[^\p{L}\p{N}_])([@#][\p{L}\p{N}_]+)/gu;

const xtPad = n => String(n).padStart(2, "0");
const xtBlockId = id => `xtpost${String(id).slice(1)}`;
const xtPosts = ui => ui.data?.content.posts || [];
const xtIndex = (ui, id) => xtPosts(ui).findIndex(post => post.id === id);
// K26: an attribute scan over the whole composed path, so events from inside the review UI's shadow root are seen too.
const xtFromReviewUi = event => (event.composedPath?.() ?? []).some(node => node?.nodeType === 1 && node.hasAttribute("data-vpk-review-ui"));

function xtEnv(win, options) {
	let storage = null;
	try {
		storage = options.storage !== undefined ? options.storage : win.localStorage;
		if (storage) storage.getItem("vpk-x-thread:");
	} catch {
		storage = null;
	}
	const clock = options.clock || win;
	return {
		storage,
		setTimeout: (fn, ms) => clock.setTimeout(fn, ms),
		clearTimeout: id => clock.clearTimeout(id),
		now: options.now || (clock.now ? () => clock.now() : () => Date.now()),
		raf: options.raf || (fn => (win.requestAnimationFrame ? win.requestAnimationFrame(fn) : clock.setTimeout(fn, 16))),
		confirm: options.confirm || (message => { try { return win.confirm(message); } catch { return false; } }),
	};
}

function xtEl(doc, tag, attrs = {}, children = []) {
	const node = doc.createElement(tag);
	for (const [name, value] of Object.entries(attrs || {})) if (value !== null && value !== undefined && value !== false) node.setAttribute(name, value === true ? "" : String(value));
	for (const child of [].concat(children ?? [])) if (child !== null && child !== undefined && child !== false) node.append(child);
	return node;
}

// true writes a boolean attribute ("" for hidden/readonly, "true" for aria-*); false/null removes it.
function xtAttr(node, name, value) {
	if (value === null || value === undefined || value === false) {
		if (node.hasAttribute(name)) node.removeAttribute(name);
		return;
	}
	const text = value === true ? (name.startsWith("aria-") ? "true" : "") : String(value);
	if (node.getAttribute(name) !== text) node.setAttribute(name, text);
}

function xtText(node, text) {
	if (node.textContent !== text) node.textContent = text;
}

// scroll: true when the control may be off screen (the toolbar's Undo, a restored or moved post, the
// queue, the copy box): scroll only as far as needed; scroll-margin in x-thread.css clears the fades.
function xtFocus(node, scroll = false) {
	try { node.focus({ preventScroll: true }); } catch { node.focus(); }
	if (scroll) node.scrollIntoView?.({ block: "nearest", inline: "nearest" });
}

export function bootXThread(doc, win, options = {}) {
	const body = doc.body;
	const byId = id => doc.getElementById(id);
	if (!body || body.hasAttribute("data-xt-ready") || !byId("xt-posts")) return null;
	body.setAttribute("data-xt-ready", "");
	const env = xtEnv(win, options);
	const ui = {
		doc, win, env, cards: new Map(), modes: new Map(), mediaUrls: new Map(), mediaNotes: new Map(), notes: [], loadIssues: [], notice: null,
		els: {
			main: byId("xt-main"), posts: byId("xt-posts"), queue: byId("xt-queue-body"), live: byId("xt-live"), save: byId("xt-save"), banner: byId("xt-banner"),
			summary: byId("xt-summary"), composer: byId("xt-composer"), source: byId("xt-source"), splitMode: byId("xt-split-mode"), stripMd: byId("xt-strip-md"),
			preview: byId("xt-composer-preview"), exportImages: byId("xt-export-images"), copyBox: byId("xt-copy-box"), copyText: byId("xt-copy-text"),
			postTemplate: byId("xt-post-template"), icons: byId("xt-icon-set"),
		},
	};
	try { ui.embedded = win.top !== win; } catch { ui.embedded = true; }
	ui.kit = {
		el: (tag, attrs, children) => xtEl(doc, tag, attrs, children),
		icon: name => xtIcon(ui, name),
		apply: (result, opts) => xtApply(ui, result, opts),
		announce: message => xtAnnounce(ui, message),
		render: () => xtRender(ui),
		now: () => env.now(),
		later: fn => env.setTimeout(fn, 0),
		focus: xtFocus,
		mediaHref: asset => xqMediaHref(ui, asset),
		unionPosted: xtUnionPosted,
		downloadName: (postId, index, asset) => `${ui.threadId}-post-${xtPad(xtIndex(ui, postId) + 1)}-${index + 1}.${String(asset).split(".").pop()}`,
	};
	xtLoad(ui);
	xtBind(ui);
	if (ui.data && ui.els.composer) ui.els.composer.open = xtPosts(ui).length <= 1;
	xtRender(ui);
	if (ui.data) xqRegisterProvider(ui);
	doc.dispatchEvent(new win.CustomEvent("vpk:content-ready", { detail: { type: CONTENT_TYPE } }));
	return { getDoc: () => ui.data, flush: () => xtFlush(ui), exportState: opts => xqExportState(ui, opts) };
}

// ---- Load: islands, local copy, drift ----

function xtReadIsland(doc, selector) {
	const node = doc.querySelector(selector);
	return node ? parseJsonIsland(node.textContent) : undefined;
}

function xtLoad(ui) {
	let rawContent, rawState;
	try {
		rawContent = xtReadIsland(ui.doc, `script[type="application/json"][${CONTENT_ATTR}="${CONTENT_TYPE}"]`);
		if (rawContent === undefined) throw new Error("the content island is missing");
	} catch (error) {
		ui.fatal = `This page's thread could not be read (${error.message}). Re-render it with x-thread.mjs fill.`;
		return;
	}
	try { rawState = xtReadIsland(ui.doc, `script[type="application/json"][${STATE_ATTR}]`); } catch (error) {
		ui.loadIssues.push(`The thread state could not be read (${error.message}); starting from a fresh state.`);
	}
	const { content, issues } = normalizeContent(rawContent);
	const { state, issues: stateIssues } = normalizeState(rawState, content);
	const checked = revalidateApprovals({ content, state });
	ui.loadIssues.push(...issues, ...stateIssues, ...checked.info);
	ui.file = { doc: checked.doc, hash: contentHash(content), revision: state.stateRevision };
	ui.base = { hash: ui.file.hash, revision: ui.file.revision };
	ui.threadId = state.threadId;
	ui.key = storageKey(state.threadId);
	ui.data = ui.file.doc;
	const local = xtReadLocal(ui);
	if (!local) return;
	ui.savedAt = local.savedAt;
	ui.mediaPersisted = local.mediaPersisted;
	const comparable = d => canonicalJson({ content: d.content, posts: d.state.posts, settings: d.state.settings, media: d.state.media });
	if (local.baseContentHash === ui.file.hash && local.baseStateRevision === ui.file.revision) ui.data = local.doc;
	else if (comparable(local.doc) === comparable(ui.file.doc)) ui.data = ui.file.doc;
	else {
		ui.data = local.doc;
		ui.base = { hash: local.baseContentHash, revision: local.baseStateRevision };
		ui.drift = { local: local.doc, localRevision: local.baseStateRevision };
	}
}

function xtReadLocal(ui) {
	if (!ui.env.storage) return null;
	let record;
	try { record = JSON.parse(ui.env.storage.getItem(ui.key) || "null"); } catch { record = null; }
	if (!record || record.schema !== LOCAL_SCHEMA) return null;
	const { content } = normalizeContent(record.content);
	const { state } = normalizeState(record.state, content);
	state.threadId = ui.threadId;
	// Images kept for the session only: take the file's bytes for assets the local copy still uses.
	for (const [asset, bytes] of Object.entries(ui.file.doc.state.media)) if (!(asset in state.media)) state.media[asset] = bytes;
	return { doc: revalidateApprovals({ content, state }).doc, baseContentHash: record.baseContentHash, baseStateRevision: record.baseStateRevision, savedAt: record.savedAt, mediaPersisted: record.mediaPersisted !== false };
}

// Adds every posted record from `source` to `target`; a posted post missing from target is
// re-inserted after its previous neighbour. No posted record is ever dropped.
function xtUnionPosted(target, source) {
	let doc = target;
	const notes = [];
	source.content.posts.forEach((post, index) => {
		const entry = source.state.posts[post.id];
		if (entry?.status !== "posted") return;
		const present = doc.content.posts.some(item => item.id === post.id), mine = doc.state.posts[post.id];
		if (mine?.status === "posted") {
			if (mine.posted.id !== entry.posted.id) notes.push(`Post ${post.id} has two different post links; this page keeps ${mine.posted.url}.`);
			return;
		}
		let posts = doc.content.posts;
		if (!present) {
			const before = source.content.posts.slice(0, index).reverse().map(item => doc.content.posts.findIndex(other => other.id === item.id)).find(at => at >= 0);
			posts = posts.toSpliced(before === undefined ? 0 : before + 1, 0, post);
			notes.push(`Post ${post.id} was already posted but is missing from the agent's version; it is kept in the thread.`);
		}
		doc = { content: { ...doc.content, posts }, state: { ...doc.state, posts: { ...doc.state.posts, [post.id]: entry } } };
	});
	return { doc, notes };
}

function xtResolve(ui, choice) {
	const local = ui.drift ? ui.drift.local : ui.data;
	const merged = choice === "keep-local" ? xtUnionPosted(local, ui.file.doc) : xtUnionPosted(ui.file.doc, local);
	// The banner's buttons go away with the drift: focus moves to the thread heading (tabindex -1).
	const focus = ui.els.banner?.contains(ui.doc.activeElement) ? ui.doc.getElementById("xt-thread-title") : null;
	ui.drift = null;
	ui.base = { hash: ui.file.hash, revision: ui.file.revision };
	ui.notes = merged.notes;
	ui.undo = null;
	xtApply(ui, { doc: revalidateApprovals(merged.doc).doc }, { force: true, focus, info: [choice === "keep-local" ? "Kept this browser's edits" : "Loaded the agent's version of the thread"] });
	xtFlush(ui);
}

// ---- Save: debounced local copy ----

function xtScheduleSave(ui) {
	if (!ui.env.storage) return;
	if (ui.saveTimer) ui.env.clearTimeout(ui.saveTimer);
	ui.saveTimer = ui.env.setTimeout(() => xtFlush(ui), 250);
}

function xtFlush(ui) {
	if (ui.saveTimer) ui.env.clearTimeout(ui.saveTimer);
	ui.saveTimer = null;
	if (!ui.dirty || !ui.data || !ui.env.storage) return;
	const record = { schema: LOCAL_SCHEMA, savedAt: new Date(ui.env.now()).toISOString(), baseContentHash: ui.base.hash, baseStateRevision: ui.base.revision, mediaPersisted: true, content: ui.data.content, state: ui.data.state };
	try {
		ui.env.storage.setItem(ui.key, JSON.stringify(record));
	} catch {
		try {
			ui.env.storage.setItem(ui.key, JSON.stringify({ ...record, mediaPersisted: false, state: { ...record.state, media: {} } }));
			record.mediaPersisted = false;
		} catch {
			ui.saveFailed = true;
			return xtRenderSaved(ui);
		}
	}
	ui.dirty = false;
	ui.saveFailed = false;
	ui.savedAt = record.savedAt;
	ui.mediaPersisted = record.mediaPersisted;
	xtRenderSaved(ui);
}

// A save can change the banner too: images dropped to fit the quota, or storage failing in a preview.
function xtRenderSaved(ui) { xtRenderBanner(ui); xtRenderStatus(ui); }

// ---- Apply a model result, then render ----

// at: where a refusal is shown on screen (a post id, "queue" or "thread"); #xt-live speaks it too.
// The notice stays until the next change that goes through.
function xtApply(ui, result, { info = [], structural = false, force = false, quiet = false, focus = null, scroll = false, at = "thread" } = {}) {
	if (!result) return false;
	// A refused action keeps focus where it is (no queue focus hand-off is pending).
	if (result.error) { ui.focusAfter = null; ui.notice = { at, message: result.message }; xtAnnounce(ui, result.message); xtRender(ui); return false; }
	ui.notice = null;
	if (result.doc && (result.doc !== ui.data || force)) {
		ui.data = result.doc;
		ui.dirty = true;
		xtScheduleSave(ui);
	}
	if (result.undo) ui.undo = result.undo;
	else if (structural) ui.undo = null;
	const messages = [...info, ...(result.info || []), ...(result.warnings || [])];
	if (messages.length && !quiet) xtAnnounce(ui, messages.join(". ").replace(/\.\./g, "."));
	xtRender(ui);
	if (focus) {
		const node = typeof focus === "function" ? focus() : focus;
		if (node) xtFocus(node, scroll);
	}
	return true;
}

function xtAnnounce(ui, message) {
	const live = ui.els.live;
	if (!live || !message) return;
	live.textContent = live.textContent === message ? `${message} ` : message;
}

// ---- Render ----

function xtRender(ui) {
	xtRenderBanner(ui);
	xtRenderStatus(ui);
	if (!ui.data) return;
	xtRenderPosts(ui);
	xtRenderToolbar(ui);
	xsRender(ui);
	xqRender(ui, ui.kit);
	xtNotifyRendered(ui);
}

function xtRenderStatus(ui) {
	const { summary, save } = ui.els;
	if (summary && ui.data) {
		const c = xqSummaryCounts(ui), parts = [`${c.posts} post${c.posts === 1 ? "" : "s"}`, `${c.approved} approved`, `${c.posted} posted`];
		if (c.skipped) parts.push(`${c.skipped} skipped`);
		if (c.over) parts.push(`${c.over} over the limit`);
		if (c.planned) parts.push(`${c.planned} image${c.planned === 1 ? "" : "s"} to attach`);
		xtText(summary, parts.join(" · "));
	}
	if (!save) return;
	const time = ui.savedAt ? new Date(ui.savedAt) : null;
	const clock = time && !Number.isNaN(time.getTime()) ? ` · ${xtPad(time.getHours())}:${xtPad(time.getMinutes())}` : "";
	if (!ui.env.storage || ui.saveFailed) xtText(save, "Not saved: storage unavailable. Export JSON before closing.");
	else if (ui.savedAt) xtText(save, `Saved in this browser${clock}`);
	else xtText(save, "Edits are saved in this browser as you go");
}

function xtRenderBanner(ui) {
	const banner = ui.els.banner, { el } = ui.kit;
	if (!banner) return;
	const lines = [...(ui.fatal ? [ui.fatal] : []), ...ui.loadIssues, ...ui.notes];
	if (ui.data) {
		const result = validateThread(ui.data);
		for (const item of [...result.errors, ...result.warnings]) if (XT_THREAD_CODES.includes(item.code)) lines.push(item.message);
	}
	if (ui.mediaPersisted === false) lines.push("Images are kept for this session only. Export JSON to keep them.");
	if (ui.embedded && (!ui.env.storage || ui.saveFailed)) lines.push("Open this file directly in your browser to post: links to X can't open from this preview.");
	const drift = ui.drift ? `The agent updated this thread (revision ${ui.file.revision}). This browser has edits based on revision ${ui.drift.localRevision}.` : "";
	const signature = JSON.stringify([lines, drift]);
	if (signature === ui.bannerSignature) return;
	ui.bannerSignature = signature;
	const children = lines.map(line => el("p", {}, line));
	if (drift) {
		children.push(el("p", {}, drift), el("div", { class: "xt-banner__actions" }, [
			el("button", { type: "button", class: "xt-btn-sm", "data-action": "use-file" }, "Use the agent's version"),
			el("button", { type: "button", class: "xt-btn-sm", "data-action": "keep-local" }, "Keep my edits"),
		]));
	}
	banner.replaceChildren(...children);
	xtAttr(banner, "hidden", children.length === 0);
	xtAttr(banner, "data-tone", drift || ui.fatal ? "warning" : null);
}

function xtIcon(ui, name) {
	const svg = ui.els.icons?.content.querySelector(`[data-xt-icon="${name}"] svg`);
	return svg ? svg.cloneNode(true) : null;
}

function xtCreateCard(ui, post) {
	const li = ui.els.postTemplate.content.firstElementChild.cloneNode(true), id = post.id;
	li.setAttribute("data-post-id", id);
	li.setAttribute("data-vpk-id", xtBlockId(id));
	const q = selector => li.querySelector(selector);
	q(".xt-post__title").id = `xt-h-${id}`;
	q(".xt-post__text").id = `xt-text-${id}`;
	q(".xt-count").id = `xt-count-${id}`;
	q(".xt-post__reason").id = `xt-reason-${id}`;
	const editor = q(".xt-post__editor");
	editor.id = `xt-edit-${id}`;
	editor.setAttribute("aria-labelledby", `xt-h-${id}`);
	editor.setAttribute("aria-describedby", `xt-count-${id}`);
	li.setAttribute("aria-labelledby", `xt-h-${id}`);
	ui.cards.set(id, li);
	return li;
}

function xtRenderPosts(ui) {
	const list = ui.els.posts, posts = xtPosts(ui), active = ui.doc.activeElement;
	const first = xsFlipFirst(ui, posts), keep = new Set(posts.map(post => post.id));
	// A deleted post's UI state goes with its card: an id that comes back later (Append) starts fresh.
	for (const [id, li] of ui.cards) if (!keep.has(id)) { li.remove(); ui.cards.delete(id); ui.modes.delete(id); ui.mediaNotes.delete(id); }
	posts.forEach((post, index) => {
		const li = ui.cards.get(post.id) || xtCreateCard(ui, post);
		if (list.children[index] !== li) list.insertBefore(li, list.children[index] || null);
	});
	const locked = posts.findLastIndex(post => statusOf(ui.data, post.id) === "posted" || ui.data.state.posts[post.id]?.intent);
	posts.forEach((post, index) => xtUpdateCard(ui, ui.cards.get(post.id), post, index, locked));
	xsFlipPlay(ui, first);
	if (active && active !== ui.doc.activeElement && ui.doc.contains(active)) xtFocus(active);
}

function xtUpdateCard(ui, li, post, index, lockedIndex) {
	const doc = ui.data, id = post.id, n = index + 1, total = xtPosts(ui).length, status = statusOf(doc, id), entry = doc.state.posts[id];
	const mode = ui.modes.get(id) || "read", locked = status === "posted" || Boolean(entry?.intent);
	const q = selector => li.querySelector(selector), act = name => q(`[data-action="${name}"]`);
	xtAttr(li, "data-status", status);
	xtAttr(li, "data-mode", mode);
	xtText(q(".xt-post__no"), xtPad(n));
	xtText(q(".xt-post__title"), `Post ${n} of ${total}`);
	const author = q(".xt-author"), { name, handle } = doc.content.author || {};
	const authorKey = `${name || ""}|${handle || ""}`;
	if (author.getAttribute("data-key") !== authorKey) {
		author.setAttribute("data-key", authorKey);
		author.replaceChildren(...[name || "", handle ? ui.kit.el("span", { class: "xt-handle" }, ` @${handle.replace(/^@/, "")}`) : null].filter(Boolean));
	}
	xtAttr(q(".xt-chip"), "data-status", status);
	xtText(q(".xt-chip__label"), XT_STATUS_LABEL[status]);
	xtRenderText(ui, q(".xt-post__text"), post);
	const editor = q(".xt-post__editor");
	xtAttr(q(".xt-post__text"), "hidden", mode === "edit");
	xtAttr(editor, "hidden", mode !== "edit");
	xtAttr(editor, "readonly", locked);
	if (ui.doc.activeElement !== editor && editor.value !== post.text) editor.value = post.text;
	const note = q(".xt-post__note");
	xtText(note, post.note || "");
	xtAttr(note, "hidden", !post.note);
	xqRenderMedia(ui, q(".xt-media"), post, index, locked);
	const count = parseTweet(composePostText(doc, id)), w = count.weightedLength, over = w > MAX_WEIGHT;
	const countNode = q(".xt-count"), tag = xsTag(doc, id), countKey = `${w}|${count.valid}|${tag}`;
	xtAttr(countNode, "data-state", over || !count.valid ? "over" : w >= WARN_WEIGHT ? "warn" : "ok");
	if (countNode.getAttribute("data-key") !== countKey) {
		countNode.setAttribute("data-key", countKey);
		const visible = (over ? `Over by ${w - MAX_WEIGHT}` : count.valid || !w ? `${w} / ${MAX_WEIGHT}` : "Contains characters X does not accept") + (tag ? ` · numbered ${tag}` : "");
		const spoken = (over ? `${w} of ${MAX_WEIGHT} characters, over the limit by ${w - MAX_WEIGHT}` : `${w} of ${MAX_WEIGHT} characters`) + (tag ? `, numbered ${tag}` : "");
		countNode.replaceChildren(ui.kit.el("span", { "aria-hidden": "true" }, visible), ui.kit.el("span", { class: "xt-sr-only" }, spoken));
	}
	const trial = status === "draft" && !locked ? setStatus(doc, id, "approved") : null, blockedBy = trial?.error ? trial.message : "";
	const reason = q(".xt-post__reason");
	xtText(reason, blockedBy ? `Can't approve yet: ${blockedBy}` : "");
	xtAttr(reason, "hidden", !blockedBy);
	const notice = q(".xt-post__notice"), refused = ui.notice?.at === id ? ui.notice.message : "";
	xtText(notice, refused);
	xtAttr(notice, "hidden", !refused);
	const approve = act("approve"), skip = act("skip"), edit = act("edit");
	xtAttr(approve, "aria-pressed", status === "approved" || status === "posted" ? "true" : "false");
	xtAttr(approve, "aria-label", `Approve post ${n}`);
	xtAttr(approve, "aria-disabled", Boolean(blockedBy) || locked);
	xtAttr(approve, "aria-describedby", blockedBy ? `xt-reason-${id}` : null);
	xtAttr(skip, "aria-pressed", status === "skipped" ? "true" : "false");
	xtAttr(skip, "aria-label", `Skip post ${n}`);
	xtAttr(skip, "aria-disabled", locked);
	xtText(edit.querySelector('[data-role="edit-label"]'), mode === "edit" ? "Done editing" : "Edit");
	xtAttr(edit, "aria-label", mode === "edit" ? `Done editing post ${n}` : `Edit post ${n}`);
	xtAttr(act("split"), "aria-label", `Split post ${n} at the caret`);
	xtAttr(act("copy"), "aria-label", `Copy post ${n}`);
	const movable = index > lockedIndex;
	xtAttr(act("move-up"), "aria-label", `Move post ${n} up`);
	xtAttr(act("move-up"), "aria-disabled", !movable || index - 1 <= lockedIndex);
	xtAttr(act("move-down"), "aria-label", `Move post ${n} down`);
	xtAttr(act("move-down"), "aria-disabled", !movable || index === total - 1);
	xtAttr(act("drag"), "aria-label", `Drag to reorder post ${n}`);
	xtAttr(act("drag"), "aria-disabled", !movable);
	xtAttr(act("drag"), "draggable", movable ? "true" : "false");
	xtAttr(act("merge-next"), "aria-label", `Merge post ${n} with the next post`);
	xtAttr(act("merge-next"), "aria-disabled", !movable || index === total - 1);
	xtAttr(act("delete"), "aria-label", `Delete post ${n}`);
	xtAttr(act("delete"), "aria-disabled", !movable || total === 1);
	xtAttr(act("cancel-intent"), "hidden", !entry?.intent);
	xtAttr(act("cancel-intent"), "aria-label", `Cancel: post ${n} is no longer open in X`);
	for (const name of ["approve", "skip", "split", "move-up", "move-down", "drag", "merge-next", "delete"]) xtAttr(act(name), "hidden", status === "posted" || (name === "split" && mode !== "edit"));
	const posted = q(".xt-post__posted");
	const postedKey = entry?.posted ? entry.posted.url : "";
	if (posted.getAttribute("data-key") !== postedKey) {
		posted.setAttribute("data-key", postedKey);
		posted.replaceChildren(...(postedKey ? ["Posted: ", ui.kit.el("a", { href: postedKey, target: "_blank", rel: "noopener noreferrer" }, postedKey)] : []));
	}
	xtAttr(posted, "hidden", !postedKey);
	xsCard(ui, li, post);
}

// Read mode: the post as DOM text (WS1 anchors on it). URLs, mentions and hashtags get spans;
// text past the 280 limit is wrapped in <mark class="xt-overflow">. The text itself is unchanged.
function xtRenderText(ui, node, post) {
	const text = post.text || "";
	if (node.getAttribute("data-rendered") === String(text.length) && node.textContent === text) return;
	node.setAttribute("data-rendered", String(text.length));
	const count = parseTweet(text), cut = count.weightedLength > MAX_WEIGHT ? count.validRangeEnd + 1 : text.length;
	const spans = extractUrlsWithIndices(text).map(item => [item.indices[0], item.indices[1], "url"]);
	for (const match of text.matchAll(XT_TAG)) {
		const start = match.index + match[1].length, end = start + match[2].length;
		if (!spans.some(([a, b]) => start < b && end > a)) spans.push([start, end, "tag"]);
	}
	const cuts = [...new Set([0, text.length, Math.min(cut, text.length), ...spans.flat().filter(value => typeof value === "number")])].sort((a, b) => a - b);
	const parts = [];
	for (let i = 0; i < cuts.length - 1; i += 1) {
		const [a, b] = [cuts[i], cuts[i + 1]], kind = spans.find(([s, e]) => s <= a && b <= e)?.[2];
		let part = kind ? ui.kit.el("span", kind === "url" ? { class: "xt-url", title: "Counts as 23" } : { class: "xt-tag" }, text.slice(a, b)) : text.slice(a, b);
		if (a >= cut) part = ui.kit.el("mark", { class: "xt-overflow" }, part);
		parts.push(part);
	}
	node.replaceChildren(...parts);
}

function xtRenderToolbar(ui) {
	const button = ui.els.main.querySelector('[data-action="undo"]'), notice = ui.doc.getElementById("xt-notice"), refused = ui.notice?.at === "thread" ? ui.notice.message : "";
	if (notice) { xtText(notice, refused); xtAttr(notice, "hidden", !refused); }
	if (!button) return;
	// An Undo that can no longer apply (a later post went out, the posts changed) is withdrawn, not offered and refused.
	if (ui.undo && undo(ui.data, ui.undo).error) ui.undo = null;
	xtAttr(button, "hidden", !ui.undo);
	xtText(button.querySelector('[data-role="undo-label"]'), ui.undo?.label || "Undo");
}

// vpk:content-rendered (WS1 C14) after a render that changed post order or text, once per frame.
function xtNotifyRendered(ui) {
	const signature = JSON.stringify(xtPosts(ui).map(post => [post.id, post.text]));
	if (signature === ui.renderedSignature) return;
	const first = ui.renderedSignature === undefined;
	ui.renderedSignature = signature;
	if (first || ui.notifyPending) return;
	ui.notifyPending = true;
	ui.env.raf(() => {
		ui.notifyPending = false;
		ui.doc.dispatchEvent(new ui.win.CustomEvent("vpk:content-rendered", { detail: { type: CONTENT_TYPE, ids: xtPosts(ui).map(post => xtBlockId(post.id)) } }));
	});
}

// ---- Events (delegated on the page root, never document capture; K26) ----

function xtBind(ui) {
	const { main, posts } = ui.els;
	main.addEventListener("click", event => xtOnClick(ui, event));
	main.addEventListener("auxclick", event => {
		const link = event.target.closest?.('a[data-role="intent"]');
		if (link && event.button === 1 && !xtFromReviewUi(event)) xqIntentOpened(ui, ui.kit, link, event);
	});
	main.addEventListener("input", event => xtOnInput(ui, event));
	main.addEventListener("change", event => xtOnChange(ui, event));
	main.addEventListener("keydown", event => xtOnKeydown(ui, event));
	posts.addEventListener("dragstart", event => xtDrag(ui, event));
	posts.addEventListener("dragover", event => xtDrag(ui, event));
	posts.addEventListener("dragleave", event => xtDrag(ui, event));
	posts.addEventListener("drop", event => xtDrag(ui, event));
	posts.addEventListener("dragend", event => xtDrag(ui, event));
	ui.win.addEventListener("pagehide", () => { xtFlush(ui); xqRevokeMedia(ui); });
	ui.doc.addEventListener("visibilitychange", () => { if (ui.doc.visibilityState === "hidden") xtFlush(ui); });
}

function xtOnClick(ui, event) {
	if (xtFromReviewUi(event) || !ui.data) {
		if (!ui.data && event.target.closest?.('[data-action="close-copy"]')) ui.els.copyBox.hidden = true;
		return;
	}
	const link = event.target.closest?.('a[data-role="intent"]');
	if (link) return xqIntentOpened(ui, ui.kit, link, event);
	const target = event.target.closest?.("[data-action]");
	if (!target || !ui.els.main.contains(target)) return;
	const action = target.getAttribute("data-action"), li = target.closest("li.xt-post");
	const id = li ? li.getAttribute("data-post-id") : target.getAttribute("data-post-id");
	if (xqClick(ui, ui.kit, action, target) || xsClick(ui, ui.kit, action, id, target)) return;
	if (li) return xtPostAction(ui, action, id, target, li);
	const doc = ui.data, posted = xtPosts(ui).some(post => statusOf(doc, post.id) === "posted" || doc.state.posts[post.id]?.intent);
	switch (action) {
		case "approve-all": return xtApply(ui, approveAllValid(doc));
		case "clear-approvals": {
			const result = clearApprovals(doc);
			return xtApply(ui, result, { info: [`Cleared ${result.cleared} approval${result.cleared === 1 ? "" : "s"}`] });
		}
		case "copy-thread": return xqCopy(ui, ui.kit, chain(doc).map(post => composePostText(doc, post.id)).join("\n\n---\n\n"), "The thread");
		case "export-json": return xqDownload(ui, ui.kit, `${ui.threadId}.x-thread.json`, JSON.stringify(xqExportState(ui, { includeImages: ui.els.exportImages ? ui.els.exportImages.checked : true }), null, 2));
		case "reset-draft": if (ui.env.confirm("Reset to the agent's draft? Your edits in this browser are replaced; posted links are kept.")) xtResolve(ui, "use-file"); return;
		case "use-file": case "keep-local": return xtResolve(ui, action);
		case "undo": {
			// The Undo button hides itself: focus goes to the restored post's Edit button.
			const record = ui.undo, restored = record?.kind === "delete" ? record.post.id : record?.kind === "merge" ? record.before[1].id : record?.before?.id;
			ui.undo = null;
			return xtApply(ui, undo(doc, record), { structural: true, scroll: true, focus: () => ui.cards.get(restored)?.querySelector('[data-action="edit"]') });
		}
		case "close-copy": return xqCloseCopy(ui, ui.kit);
		case "composer-preview": case "composer-replace": case "composer-append": return xqComposer(ui, ui.kit, action, posted);
		default: return;
	}
}

function xtPostAction(ui, action, id, target, li) {
	const doc = ui.data, n = xtIndex(ui, id) + 1, status = statusOf(doc, id), at = Number(target.getAttribute("data-index"));
	const apply = (result, opts = {}) => xtApply(ui, result, { at: id, ...opts }); // a refusal shows under this post's buttons
	if (target.getAttribute("aria-disabled") === "true" && action !== "edit") {
		const reason = action === "approve" ? li.querySelector(".xt-post__reason").textContent : "";
		if (reason) return xtAnnounce(ui, reason); // already on screen above the buttons
		return apply({ error: "unavailable", message: status === "posted" ? `Post ${n} is posted and locked` : `That action isn't available for post ${n} right now` });
	}
	const focusSame = () => ui.cards.get(id)?.querySelector(`[data-action="${action}"]`);
	switch (action) {
		case "approve": return apply(setStatus(doc, id, status === "approved" ? "draft" : "approved"), { info: [status === "approved" ? `Post ${n} back to draft` : `Post ${n} approved`] });
		case "skip": return apply(setStatus(doc, id, status === "skipped" ? "draft" : "skipped"), { info: [status === "skipped" ? `Post ${n} is back in the thread` : `Post ${n} skipped`] });
		case "edit": {
			const editing = ui.modes.get(id) === "edit";
			ui.modes.set(id, editing ? "read" : "edit");
			xtRender(ui);
			return xtFocus(editing ? li.querySelector('[data-action="edit"]') : li.querySelector(".xt-post__editor"));
		}
		case "split": {
			const editor = li.querySelector(".xt-post__editor");
			ui.modes.set(id, "read");
			return apply(splitPost(doc, id, editor.selectionStart ?? editor.value.length), { structural: true, focus: () => li.querySelector('[data-action="edit"]') });
		}
		case "copy": return xqCopy(ui, ui.kit, composePostText(doc, id), `Post ${n}`);
		case "move-up": case "move-down": {
			const result = movePost(doc, id, n - 1 + (action === "move-up" ? -1 : 1));
			if (result.doc === doc && !result.error) return apply({ error: "no-move", message: `Post ${n} can't move further` });
			return apply(result, { structural: true, scroll: true, focus: focusSame }); // the view follows the moved post
		}
		case "drag": return xtAnnounce(ui, `Drag the handle to reorder post ${n}, or use Move up and Move down`);
		case "merge-next": return apply(mergeWithNext(doc, id), { structural: true, focus: () => ui.cards.get(id)?.querySelector('[data-action="edit"]') });
		case "delete": return apply(deletePost(doc, id), { structural: true, scroll: true, focus: () => ui.els.main.querySelector('[data-action="undo"]') });
		case "cancel-intent": ui.intentActivated = null; return apply(cancelIntent(doc, id), { info: [`Post ${n} is no longer open in X`], focus: () => li.querySelector('[data-action="edit"]') });
		case "remove-media": {
			const asset = xtPosts(ui)[n - 1].media?.[at]?.asset;
			const ok = apply(removeMedia(doc, id, at), { info: [`Image ${at + 1} removed from post ${n}`], focus: () => xqMediaFocus(ui, id, at) });
			if (ok && asset) xqRevokeMedia(ui, new Set([...ui.mediaUrls.keys()].filter(key => key !== asset)));
			return ok;
		}
		case "copy-alt": return xqCopy(ui, ui.kit, xtPosts(ui)[n - 1].media?.[at]?.alt || "", "The alt text");
		default: return;
	}
}

function xtOnInput(ui, event) {
	if (xtFromReviewUi(event) || !ui.data || xqInput(ui, ui.kit, event)) return;
	const target = event.target, li = target.closest?.("li.xt-post");
	if (!li) return;
	const id = li.getAttribute("data-post-id");
	if (target.classList.contains("xt-post__editor")) {
		const result = setText(ui.data, id, target.value);
		if (result.error) { target.value = xtPosts(ui)[xtIndex(ui, id)].text; return xtApply(ui, result, { at: id }); }
		xtApplyLater(ui, result);
		if (ui.win.CSS && !ui.win.CSS.supports?.("field-sizing", "content")) ui.env.raf(() => { target.style.height = "auto"; target.style.height = `${target.scrollHeight}px`; });
	} else if (target.getAttribute("data-role") === "media-alt") {
		xtApplyLater(ui, setMediaAlt(ui.data, id, Number(target.getAttribute("data-index")), target.value));
	}
}

// Typing updates the doc at once and renders once per frame.
function xtApplyLater(ui, result) {
	if (result.error) return xtAnnounce(ui, result.message);
	if (result.doc !== ui.data) { ui.data = result.doc; ui.dirty = true; ui.undo = null; ui.notice = null; xtScheduleSave(ui); }
	if (result.info?.length) xtAnnounce(ui, result.info.join(". "));
	if (ui.renderPending) return;
	ui.renderPending = true;
	ui.env.raf(() => { ui.renderPending = false; xtRender(ui); });
}

function xtOnChange(ui, event) {
	const input = event.target;
	if (xtFromReviewUi(event) || !ui.data || xsChange(ui, ui.kit, event) || input.getAttribute?.("data-role") !== "media-input") return;
	const li = input.closest("li.xt-post"), files = [...(input.files || [])], slot = input.getAttribute("data-index");
	input.value = "";
	if (li && files.length) xqAddFiles(ui, ui.kit, li.getAttribute("data-post-id"), files, slot === null ? null : Number(slot));
}

function xtOnKeydown(ui, event) {
	if (xtFromReviewUi(event) || !ui.data || xqKeydown(ui, ui.kit, event) || xsKey(ui, ui.kit, event)) return;
	const target = event.target;
	if (event.key === "Escape" && target.classList?.contains("xt-post__editor")) {
		event.preventDefault();
		const li = target.closest("li.xt-post");
		ui.modes.set(li.getAttribute("data-post-id"), "read");
		xtRender(ui);
		xtFocus(li.querySelector('[data-action="edit"]'));
	} else if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && target.closest?.('[role="toolbar"]') && target.tagName === "BUTTON") {
		const items = [...target.closest('[role="toolbar"]').querySelectorAll("button:not([hidden]), input")];
		const next = items[(items.indexOf(target) + (event.key === "ArrowRight" ? 1 : -1) + items.length) % items.length];
		event.preventDefault();
		xtFocus(next);
	}
}

// Reorder by dragging the handle; files dropped on a post's media box attach to it.
function xtDrag(ui, event) {
	const li = event.target.closest?.("li.xt-post"), files = [...(event.dataTransfer?.types || [])].includes("Files");
	const clear = () => ui.els.posts.querySelectorAll("[data-drop], [data-dragging], [data-dropping]").forEach(node => { node.removeAttribute("data-drop"); node.removeAttribute("data-dragging"); node.removeAttribute("data-dropping"); });
	if (event.type === "dragstart") {
		const handle = event.target.closest?.('[data-action="drag"]');
		if (!handle || handle.getAttribute("aria-disabled") === "true") return;
		ui.dragId = li.getAttribute("data-post-id");
		event.dataTransfer.effectAllowed = "move";
		event.dataTransfer.setData("text/plain", ui.dragId);
		try { event.dataTransfer.setDragImage(li, 24, 24); } catch { /* optional */ }
		li.setAttribute("data-dragging", "");
	} else if (event.type === "dragend") {
		ui.dragId = null;
		clear();
	} else if (files && !ui.dragId) {
		const box = event.target.closest?.(".xt-media");
		if (!box || !li) return;
		event.preventDefault();
		if (event.type === "dragover") box.setAttribute("data-dropping", "");
		else if (event.type === "dragleave") box.removeAttribute("data-dropping");
		else { clear(); xqAddFiles(ui, ui.kit, li.getAttribute("data-post-id"), [...event.dataTransfer.files], null); }
	} else if (ui.dragId && li) {
		event.preventDefault();
		const rect = li.getBoundingClientRect(), after = event.clientY > rect.top + rect.height / 2;
		if (event.type === "dragover") {
			ui.dropTarget = { li, after };
			if (!ui.dropPending) {
				ui.dropPending = true;
				ui.env.raf(() => {
					ui.dropPending = false;
					ui.els.posts.querySelectorAll("[data-drop]").forEach(node => node.removeAttribute("data-drop"));
					if (ui.dropTarget && ui.dragId) ui.dropTarget.li.setAttribute("data-drop", ui.dropTarget.after ? "after" : "before");
				});
			}
		} else if (event.type === "drop") {
			const id = ui.dragId, from = xtIndex(ui, id), to = xtIndex(ui, li.getAttribute("data-post-id"));
			const index = after ? (from < to ? to : to + 1) : (from < to ? to - 1 : to);
			ui.dragId = null;
			ui.dropTarget = null;
			clear();
			xtApply(ui, movePost(ui.data, id, index), { structural: true });
		}
	}
}
