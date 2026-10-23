// Stretch features for the x-thread runtime (browser-only; bundled after runtime-queue.mjs and before
// runtime.mjs): S1 thread numbering, S2 fit long posts, S3 keyboard reorder and approve. Each feature
// is independent and optional: it adds controls to the template and hooks the runtime calls (xsRender,
// xsCard, xsChange, xsClick, xsKey); remove one by deleting its markup and its branch here. Free
// posting only (decision 3): nothing here opens a window, calls an API or navigates. Private
// top-level names carry an xs/XS_ prefix (one bundle scope); `kit` is the runtime's DOM toolkit
// (runtime.mjs).

import { MAX_WEIGHT, NUMBERING_RESERVE, chain, composePostText, fitPost, movePost, revalidateApprovals, setNumbering, setReplyToId, setStatus, statusOf, unrecordPosted } from "./thread-model.mjs";
import { parseTweet } from "./twitter-text.mjs";
import { EXPORT_SCHEMA, isImageDataUrl, normalizeContent, normalizeState } from "./islands.mjs";
import { xqCopy, xqExportState } from "./runtime-queue.mjs";

const xsById = (ui, id) => ui.doc.getElementById(id);
const xsSet = (node, name, value) => {
	if (value === false || value === null || value === undefined) node.removeAttribute(name);
	else if (node.getAttribute(name) !== String(value === true ? "" : value)) node.setAttribute(name, value === true ? "" : String(value));
};
// A post that went out, or is open in X, can't change: its numbering and its length are fixed.
const xsLocked = (doc, id) => statusOf(doc, id) === "posted" || Boolean(doc.state.posts[id]?.intent);

// ---- S1 numbering: "3/6" after (suffix) or before (prefix) the text, counted into the limit ----

// The tag composePostText adds to a post ("3/6"), or "" when numbering is off or the post is skipped.
export function xsTag(doc, id) {
	const numbering = doc.state.settings?.numbering;
	if (numbering !== "suffix" && numbering !== "prefix") return "";
	const ids = chain(doc).map(post => post.id), at = ids.indexOf(id);
	return at < 0 ? "" : `${at + 1}/${ids.length}`;
}

// The Numbering select shows the thread's setting; once a post is open or posted it is locked, and says why.
function xsRenderNumbering(ui) {
	const select = xsById(ui, "xt-numbering"), hint = xsById(ui, "xt-numbering-hint");
	if (!select) return;
	const doc = ui.data, setting = doc.state.settings?.numbering || "none";
	const locked = doc.content.posts.some(post => xsLocked(doc, post.id));
	if (select.value !== setting) select.value = setting;
	xsSet(select, "disabled", locked);
	if (hint) {
		const text = locked ? `Numbering is locked at /${chain(doc).length} because a post is open in X or posted.` : `Adds each post's place, such as 3/6, to its text and counts it. Reserves ${NUMBERING_RESERVE} characters when splitting. Locks once a post is open in X.`;
		if (hint.textContent !== text) hint.textContent = text;
	}
}

// ---- S2 fit: split an over-long post into posts that each fit (the model keeps every word) ----

// The Fit button on a post card shows only for an editable post over the limit.
export function xsCard(ui, li, post) {
	const doc = ui.data, n = doc.content.posts.findIndex(item => item.id === post.id) + 1;
	const fit = li.querySelector('[data-action="fit"]'), unlock = li.querySelector('[data-action="unlock-posted"]');
	if (fit) {
		const over = parseTweet(composePostText(doc, post.id)).weightedLength > MAX_WEIGHT;
		xsSet(fit, "hidden", !over || xsLocked(doc, post.id));
		xsSet(fit, "aria-label", `Split post ${n} into posts that fit`);
	}
	if (unlock) { // S8: only a posted card offers it
		xsSet(unlock, "hidden", statusOf(doc, post.id) !== "posted");
		xsSet(unlock, "aria-label", `Unlock post ${n}: remove its recorded link`);
	}
}

// ---- S7 reply to an existing post: settings.replyToId makes post 1 a reply (in_reply_to) ----

const xsReplyValue = doc => (doc.state.settings?.replyToId ? `https://x.com/i/status/${doc.state.settings.replyToId}` : "");

function xsRenderReplyTo(ui) {
	const input = xsById(ui, "xt-reply-to");
	if (!input) return;
	xsSet(input, "disabled", ui.data.content.posts.some(post => xsLocked(ui.data, post.id)));
	if (ui.doc.activeElement !== input) input.value = xsReplyValue(ui.data); // never rewrite what is being typed
}

// Called by the runtime after every render, once the post cards are current.
export function xsRender(ui) {
	if (!ui.data) return;
	xsRenderNumbering(ui);
	xsRenderReplyTo(ui);
}

// ---- S5 Copy JSON and Import JSON: the page's export object to the clipboard, and back from a file ----

function xsReadText(ui, file) {
	if (typeof file.text === "function") return file.text();
	return new Promise((resolve, reject) => {
		const reader = new ui.win.FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(reader.error || new Error("read failed"));
		reader.readAsText(file);
	});
}

// Folds an export of this thread into the page with the CLI's import rules: the import's order, text, images
// and statuses win, posted records from both sides are kept, and nothing changes until the user confirms.
async function xsImport(ui, kit, file) {
	const refuse = message => kit.apply({ error: "bad-import", message }, { at: "thread" });
	let data;
	try { data = JSON.parse(await xsReadText(ui, file)); } catch { return refuse(`${file.name || "That file"} is not valid JSON`); }
	if (data?.schema !== EXPORT_SCHEMA) return refuse(`${file.name || "That file"} is not an x-thread export (${EXPORT_SCHEMA})`);
	const threadId = data.source?.threadId ?? data.state?.threadId, current = ui.data;
	if (threadId !== ui.threadId) return refuse(`That export is for thread ${JSON.stringify(threadId)}, not ${JSON.stringify(ui.threadId)}`);
	const { content, issues } = normalizeContent(data.content), { state, issues: stateIssues } = normalizeState(data.state, content);
	const used = new Set(content.posts.flatMap(post => (post.media || []).map(item => item.asset)));
	state.threadId = ui.threadId;
	state.stateRevision = current.state.stateRevision;
	state.media = Object.fromEntries(Object.entries({ ...current.state.media, ...state.media }).filter(([asset]) => used.has(asset)));
	if (current.content.posts.some(post => xsLocked(current, post.id))) state.settings = current.state.settings; // numbering stays locked
	if (!ui.env.confirm(`Import ${content.posts.length} post${content.posts.length === 1 ? "" : "s"} from ${file.name || "the file"}? Order, text, images and statuses are replaced; posted links are kept.`)) return;
	const merged = kit.unionPosted(revalidateApprovals({ content, state }).doc, current);
	ui.notes = merged.notes;
	ui.undo = null;
	const problems = issues.length + stateIssues.length;
	kit.apply({ doc: merged.doc }, { structural: true, force: true, info: [`Imported ${content.posts.length} posts from ${file.name || "the file"}${problems ? `; ${problems} problem${problems === 1 ? "" : "s"} repaired: ${[...issues, ...stateIssues][0]}` : ""}`] });
}

// <select> and <input> changes; returns true when the event was one of these controls'.
export function xsChange(ui, kit, event) {
	const input = event.target;
	if (input?.getAttribute?.("data-role") === "import-input") {
		const file = input.files?.[0];
		input.value = "";
		if (file) xsImport(ui, kit, file);
		return true;
	}
	if (input?.id === "xt-reply-to") {
		const result = setReplyToId(ui.data, input.value.trim());
		kit.apply(result, { at: "thread", info: result.error ? [] : [input.value.trim() ? "Post 1 now replies to that post" : "Post 1 starts a new thread"] });
		if (result.error) input.focus?.();
		else input.value = xsReplyValue(ui.data); // a committed change shows the canonical link at once
		return true;
	}
	if (input?.id === "xt-numbering") {
		const result = setNumbering(ui.data, input.value);
		kit.apply(result, { at: "thread", info: result.error ? [] : [`Numbering ${input.value === "none" ? "off" : input.value === "suffix" ? "after the text" : "before the text"}`] });
		return true;
	}
	return false;
}

// ---- S6 Copy image: the attached image on the clipboard as a PNG, to paste into X's composer ----

async function xsToPng(ui, dataUrl) {
	const [head, payload] = dataUrl.split(","), type = /data:([^;,]+)/.exec(head)[1];
	const blob = new ui.win.Blob([Uint8Array.from(ui.win.atob(payload), char => char.charCodeAt(0))], { type });
	if (type === "image/png") return blob;
	const bitmap = await ui.win.createImageBitmap(blob), canvas = ui.doc.createElement("canvas");
	canvas.width = bitmap.width;
	canvas.height = bitmap.height;
	canvas.getContext("2d").drawImage(bitmap, 0, 0);
	return new Promise((resolve, reject) => canvas.toBlob(out => (out ? resolve(out) : reject(new Error("no png"))), "image/png"));
}

async function xsCopyImage(ui, kit, id, at) {
	const n = ui.data.content.posts.findIndex(post => post.id === id) + 1, item = ui.data.content.posts[n - 1]?.media?.[at];
	const bytes = item?.asset ? ui.data.state.media[item.asset] : null;
	try {
		if (!isImageDataUrl(bytes)) throw new Error("no image bytes");
		await ui.win.navigator.clipboard.write([new ui.win.ClipboardItem({ "image/png": await xsToPng(ui, bytes) })]);
		kit.announce(`Image ${at + 1} of post ${n} copied`);
	} catch {
		kit.apply({ error: "no-copy-image", message: `Couldn't copy image ${at + 1}; use Download image ${at + 1}` }, { at: id });
	}
}

// Button clicks (post cards and toolbar); returns true when handled.
export function xsClick(ui, kit, action, id, target) {
	if (action === "unlock-posted" && id) { // S8: take back a recorded link (a deleted post, a wrong link); last posted post only
		const n = ui.data.content.posts.findIndex(post => post.id === id) + 1;
		if (ui.env.confirm(`Remove the recorded link for post ${n}? Do this only if the post was deleted on X or the wrong link was pasted.`)) {
			kit.apply(unrecordPosted(ui.data, id), { at: id, info: [`The link for post ${n} was removed; it is approved again`], focus: () => ui.cards.get(id)?.querySelector('[data-action="edit"]') });
		}
		return true;
	}
	if (action === "copy-image" && id) {
		xsCopyImage(ui, kit, id, Number(target.getAttribute("data-index")));
		return true;
	}
	if (action === "copy-json") {
		const images = xsById(ui, "xt-export-images");
		xqCopy(ui, kit, JSON.stringify(xqExportState(ui, { includeImages: images ? images.checked : true }), null, 2), "The export JSON");
		return true;
	}
	if (action === "fit" && id) {
		const result = fitPost(ui.data, id);
		ui.modes.set(id, "read");
		kit.apply(result, { at: id, structural: true, scroll: true, focus: () => ui.cards.get(id)?.querySelector('[data-action="edit"]') });
		return true;
	}
	return false;
}

// ---- S4 FLIP: moved posts glide to their new place (--vpk-dur-enter, --ease-out; none under reduced motion) ----

// Positions of the cards, read before the list is reordered; null when nothing will move or motion is off.
export function xsFlipFirst(ui, posts) {
	const list = ui.els.posts, cards = posts.map(post => ui.cards.get(post.id));
	if (!cards.some((card, index) => card && list.children[index] !== card)) return null;
	try { if (ui.win.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return null; } catch { return null; }
	if (typeof list.animate !== "function") return null;
	return new Map(cards.filter(Boolean).map(card => [card, card.getBoundingClientRect().top]));
}

// After the reorder and the card updates: slide each card that changed place from where it was.
export function xsFlipPlay(ui, first) {
	if (!first) return;
	const style = ui.win.getComputedStyle(ui.doc.documentElement);
	const raw = style.getPropertyValue("--vpk-dur-enter").trim(), duration = (/^[\d.]+s$/.test(raw) ? parseFloat(raw) * 1000 : parseFloat(raw)) || 140;
	const easing = style.getPropertyValue("--ease-out").trim() || "ease-out";
	const moved = [...first].map(([card, top]) => [card, top - card.getBoundingClientRect().top]).filter(([, shift]) => Math.abs(shift) > 1);
	for (const animation of ui.flips || []) animation.cancel();
	ui.flips = moved.map(([card, shift]) => card.animate([{ transform: `translateY(${shift}px)` }, { transform: "none" }], { duration, easing }));
}

// ---- S3 keys on a post card: Alt+ArrowUp/Down moves the post, Mod+Enter toggles its approval ----

// Alt+Arrow leaves text fields alone (their arrows move the caret); Mod+Enter also works while editing.
// The post is the same element after a move, so the focused control keeps focus (xtRenderPosts restores it).
export function xsKey(ui, kit, event) {
	const target = event.target, li = target.closest?.("li.xt-post");
	if (!li || event.shiftKey) return false;
	const doc = ui.data, id = li.getAttribute("data-post-id"), index = doc.content.posts.findIndex(post => post.id === id), n = index + 1;
	if (event.altKey && !event.ctrlKey && !event.metaKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
		if (/^(TEXTAREA|INPUT|SELECT)$/.test(target.tagName)) return false;
		event.preventDefault();
		const result = movePost(doc, id, index + (event.key === "ArrowUp" ? -1 : 1));
		if (result.doc === doc && !result.error) kit.apply({ error: "no-move", message: `Post ${n} can't move further` }, { at: id });
		else kit.apply(result, { at: id, structural: true, scroll: true, focus: () => (target.isConnected ? target : null) });
		return true;
	}
	if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key === "Enter") {
		event.preventDefault();
		const status = statusOf(doc, id);
		if (status === "posted") return true;
		kit.apply(setStatus(doc, id, status === "approved" ? "draft" : "approved"), { at: id, info: [status === "approved" ? `Post ${n} back to draft` : `Post ${n} approved`] });
		return true;
	}
	return false;
}
