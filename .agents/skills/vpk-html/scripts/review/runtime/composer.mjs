/*
 * review/runtime/composer: the comment composer, the reviewer identity form,
 * inline reply/edit composers, the selection Comment button, the keyboard block
 * picker and the page shortcut C (ws1 4.8).
 *
 * C acts only without modifiers, when nothing handled the key before
 * (defaultPrevented), and never from form controls, links or widget roles. With
 * a selection it opens the composer; without one it starts the block picker,
 * which owns arrows, Home, End, Enter, Esc and p on the review UI's shadow root
 * (focus sits on a review control, and the host stops key propagation, so
 * docnav and the selector never see them) until it exits. Pointer picking uses
 * transient window capture listeners (B2 decision 7).
 *
 * Serialized module: named function imports and export function declarations
 * only, no module-level state, plain ASCII.
 */

import { createBlockAnchor, createTextAnchor } from "../anchor.mjs";
import { excerpt } from "../text.mjs";
import { addCommentRecord, announce, ensureIndex, saveIdentity, updateComment } from "./boot.mjs";
import { composedOrigin, h, isInteractiveOrigin, pathHasAttribute, reducedMotion, revealInView, sheetTop, tagLabel, uiButton } from "./dom.mjs";
import { scheduleLayout } from "./highlights.mjs";
import { applyReattach } from "./owner.mjs";
import { openPanel, showToast } from "./panel.mjs";
import { focusThread, renderComments } from "./threads.mjs";

export function createComposer(ctx) {
	const quote = h(ctx, "p", { class: "vr-quote" });
	const textarea = h(ctx, "textarea", { class: "vr-text", rows: "4", "aria-label": "Comment" });
	const identity = h(ctx, "div", { class: "vr-identity", hidden: true });
	const submit = uiButton(ctx, { label: "Comment", cls: "vr-primary", onClick: () => submitComposer(ctx) });
	const cancel = uiButton(ctx, { label: "Cancel", onClick: () => closeComposer(ctx, true) });
	const fields = h(ctx, "div", { class: "vr-fields" }, [textarea, h(ctx, "div", { class: "vr-row-actions" }, [cancel, submit])]);
	const el = h(ctx, "div", { class: "vr-composer", role: "group", "aria-label": "New comment" }, [quote, identity, fields]);
	textarea.addEventListener("keydown", (event) => {
		if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
			event.preventDefault();
			submitComposer(ctx);
		} else if (event.key === "Escape") {
			event.preventDefault();
			event.stopPropagation();
			closeComposer(ctx, true);
		}
	});
	textarea.addEventListener("input", () => (ctx.composer.draft = textarea.value));
	ctx.composer = { el, quote, textarea, identity, fields, open: false, target: null, draft: "" };
}

// target: { kind: "text" | "block" | "doc", anchor, label }
export function openComposer(ctx, target) {
	// Re-attach (M2): a picked selection or block replaces the orphan's anchor instead of opening a comment.
	if (ctx.reattach && target.anchor && (target.kind === "text" || target.kind === "block")) return applyReattach(ctx, target.anchor);
	const composer = ctx.composer;
	ctx.selectionRange = null;
	if (ctx.picker) exitBlockPicker(ctx, true);
	composer.open = true;
	composer.target = target;
	composer.quote.textContent = target.kind === "text" ? excerpt(target.label, 240) : target.kind === "block" ? "Block: " + excerpt(target.label, 200) : target.label || "General comment";
	composer.quote.className = target.kind === "text" ? "vr-quote" : "vr-where";
	composer.textarea.value = composer.draft || "";
	openPanel(ctx, "comments");
	renderComments(ctx);
	if (!ctx.identity) {
		renderIdentityForm(ctx, () => {
			composer.identity.hidden = true;
			if (target.kind === "identity") {
				closeComposer(ctx, true);
				if (typeof target.after === "function") target.after();
				else showToast(ctx, "Saved. Your answers are recorded.");
				return;
			}
			composer.fields.hidden = false;
			composer.textarea.focus();
		});
	} else {
		composer.identity.hidden = true;
		composer.fields.hidden = false;
		composer.textarea.focus();
	}
	scheduleLayout(ctx);
}

export function closeComposer(ctx, keepDraft) {
	const composer = ctx.composer;
	if (!composer) return;
	composer.draft = keepDraft ? composer.textarea.value : "";
	composer.open = false;
	composer.target = null;
	if (composer.el.parentNode) composer.el.parentNode.removeChild(composer.el);
	renderComments(ctx);
	const first = ctx.ui.panels.comments.querySelector(".vr-thread, .vr-btn");
	if (first) first.focus();
}

export function submitComposer(ctx) {
	const composer = ctx.composer;
	const body = composer.textarea.value.trim();
	if (!body) {
		announce(ctx, "Write a comment first");
		composer.textarea.focus();
		return null;
	}
	if (!ctx.identity) return null;
	const target = composer.target || { kind: "doc", anchor: null };
	const comment = addCommentRecord(ctx, { kind: target.kind, anchor: target.anchor, body, layout: target.layout });
	// A full review refuses the comment (notice shown); the text stays in the box.
	if (!comment) {
		composer.textarea.focus();
		return null;
	}
	composer.draft = "";
	composer.textarea.value = "";
	ctx.activeId = comment.id;
	closeComposer(ctx, false);
	focusThread(ctx, comment.id);
	showToast(ctx, "Comment added");
	return comment;
}

// The first-comment identity prompt: "Your name" (required, 60 max) and initials (1-3).
export function renderIdentityForm(ctx, onDone) {
	const composer = ctx.composer;
	const box = composer.identity;
	while (box.firstChild) box.removeChild(box.firstChild);
	composer.fields.hidden = true;
	box.hidden = false;
	const name = h(ctx, "input", { type: "text", class: "vr-input", maxlength: "60", autocomplete: "name", "aria-label": "Your name", required: true });
	const initials = h(ctx, "input", { type: "text", class: "vr-input vr-input-short", maxlength: "3", "aria-label": "Initials" });
	const save = () => {
		if (!name.value.trim()) {
			announce(ctx, "Your name is required");
			name.focus();
			return;
		}
		saveIdentity(ctx, name.value, initials.value);
		box.hidden = true;
		if (typeof onDone === "function") onDone();
	};
	for (const field of [name, initials]) field.addEventListener("keydown", (event) => {
		if (event.key === "Enter") {
			event.preventDefault();
			save();
		}
	});
	box.appendChild(h(ctx, "p", { class: "vr-where", text: "Add your name so others know who commented. It stays in this browser." }));
	box.appendChild(h(ctx, "label", { class: "vr-field" }, [h(ctx, "span", { text: "Your name" }), name]));
	box.appendChild(h(ctx, "label", { class: "vr-field" }, [h(ctx, "span", { text: "Initials" }), initials]));
	box.appendChild(h(ctx, "div", { class: "vr-row-actions" }, [uiButton(ctx, { label: "Continue", cls: "vr-primary", onClick: save })]));
	name.focus();
}

// Inline reply/edit composer for ctx.inline = { mode, id, text }.
export function renderInlineComposer(ctx) {
	const inline = ctx.inline;
	const area = h(ctx, "textarea", { class: "vr-text vr-inline-text", rows: "3", "aria-label": inline.mode === "reply" ? "Reply" : "Edit comment" });
	area.value = inline.text;
	area.addEventListener("input", () => (inline.text = area.value));
	// The thread row that owns this reply or edit, for focus after the commit.
	const owner = ctx.review.comments.find((comment) => comment.id === inline.id);
	const threadId = owner && owner.parentId ? owner.parentId : inline.id;
	const commit = (body) => {
		ctx.inline = null;
		if (inline.mode === "reply") {
			if (!addCommentRecord(ctx, { parentId: inline.id, kind: "doc", body })) return void (ctx.inline = inline);
		} else updateComment(ctx, inline.id, { body, bodyAt: new Date().toISOString() });
		focusThread(ctx, threadId);
	};
	const done = () => {
		const body = area.value.trim();
		if (!body) return;
		if (!ctx.identity) {
			// Ask for a name first, then post the typed text (it stays in ctx.inline).
			inline.text = area.value;
			openComposer(ctx, { kind: "identity", anchor: null, label: inline.mode === "reply" ? "Add your name to post your reply" : "Add your name to save your edit", after: () => {
				if (ctx.inline === inline && inline.text.trim()) commit(inline.text.trim());
			} });
			return;
		}
		commit(body);
	};
	const cancel = () => {
		ctx.inline = null;
		renderComments(ctx);
	};
	area.addEventListener("keydown", (event) => {
		if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
			event.preventDefault();
			done();
		} else if (event.key === "Escape") {
			event.preventDefault();
			event.stopPropagation();
			cancel();
		}
	});
	return h(ctx, "div", { class: "vr-inline" }, [area, h(ctx, "div", { class: "vr-row-actions" }, [uiButton(ctx, { label: "Cancel", onClick: cancel }), uiButton(ctx, { label: inline.mode === "reply" ? "Reply" : "Save", cls: "vr-primary", onClick: done })])]);
}

export function createSelectionButton(ctx) {
	const button = uiButton(ctx, { icon: "comment", label: "Comment", cls: "vr-select-btn" });
	button.setAttribute("aria-label", "Comment on selected text (C)");
	button.hidden = true;
	button.addEventListener("pointerdown", (event) => event.preventDefault());
	button.addEventListener("click", () => {
		const range = ctx.selectionRange;
		if (range) commentOnRange(ctx, range);
	});
	ctx.ui.selectButton = button;
	ctx.ui.shadow.appendChild(button);
}

// The current selection as a Range inside the indexed root, or null.
export function selectionInDocument(ctx) {
	const selection = ctx.doc.getSelection ? ctx.doc.getSelection() : null;
	if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
	const range = selection.getRangeAt(0);
	const root = ctx.doc.querySelector("main") || ctx.doc.body;
	if (!root || !root.contains(range.commonAncestorContainer)) return null;
	if (!String(range.toString()).trim()) return null;
	return range;
}

export function updateSelectionButton(ctx) {
	const range = selectionInDocument(ctx);
	ctx.selectionRange = range ? range.cloneRange() : null;
	if (!range && ctx.ui.selectButton) ctx.ui.selectButton.hidden = true;
	scheduleLayout(ctx);
}

// A selection inside an excluded subtree becomes a block anchor on the
// nearest stamped ancestor (ws1 4.5).
export function commentOnRange(ctx, range) {
	let index;
	try {
		index = ensureIndex(ctx);
	} catch {
		return;
	}
	const start = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
	const excluded = start && [...index.excluded].some((root) => root.contains(start));
	if (excluded) {
		const block = start.closest("[data-vpk-id]");
		if (!block) return showToast(ctx, "This part of the page cannot take comments");
		const anchor = createBlockAnchor(index, block);
		return openComposer(ctx, { kind: "block", anchor, label: anchor.blockText || tagLabel(anchor.blockTag || "") });
	}
	try {
		const anchor = createTextAnchor(index, range);
		openComposer(ctx, { kind: "text", anchor, label: anchor.quote.exact });
	} catch (error) {
		showToast(ctx, error && error.message ? error.message : "Select some text to comment on");
	}
}

export function enterBlockPicker(ctx) {
	let index;
	try {
		index = ensureIndex(ctx);
	} catch {
		return;
	}
	const blocks = [...index.elements.values()].filter((el) => el.getClientRects().length > 0 && !el.closest("[data-vpk-review-ui]"));
	if (!blocks.length) return showToast(ctx, "No blocks to comment on in this document");
	const sheet = sheetTop(ctx);
	const middle = (sheet || ctx.win.innerHeight || 768) / 2;
	let position = 0;
	let best = Infinity;
	blocks.forEach((el, at) => {
		const rect = el.getBoundingClientRect();
		const distance = Math.abs((rect.top + rect.bottom) / 2 - middle);
		if (distance < best) {
			best = distance;
			position = at;
		}
	});
	const previous = ctx.picker;
	if (previous) exitBlockPicker(ctx, true);
	// Keys reach the picker only inside the review UI (K26: no window or document
	// capture for keys): started from the page, focus moves to an off-screen
	// picker control (the outline marks the current block) and returns on Esc.
	const active = ctx.ui.shadow && ctx.ui.shadow.activeElement;
	const fromPage = !active || active === ctx.ui.pickFocus;
	const picker = { blocks, position, owner: fromPage ? pickFocus(ctx) : active, back: fromPage ? (previous && previous.back) || ctx.doc.activeElement : null };
	picker.onKey = (event) => pickerKey(ctx, event);
	picker.onPointer = (event) => {
		if (pathHasAttribute(event, "data-vpk-review-ui")) return;
		const origin = composedOrigin(event);
		const block = origin && origin.closest ? origin.closest("[data-vpk-id]") : null;
		const at = block ? picker.blocks.indexOf(block) : -1;
		if (at >= 0 && at !== picker.position) {
			picker.position = at;
			scheduleLayout(ctx);
		}
		if (event.type !== "click") return;
		// A click with detail 0 is synthetic (Enter or Space on a focused link or button): it
		// goes through, so the link is followed; only a real pointer click picks a block
		// (B2 decision 19a).
		if (event.detail === 0) return;
		if (at < 0) return exitBlockPicker(ctx);
		event.preventDefault();
		event.stopImmediatePropagation();
		chooseBlock(ctx);
	};
	// Focus leaving the picker control ends the picker (B2 decision 19a): Tab away, or a move to
	// another focusable element. A pointer click on plain page content leaves focus on the body
	// (no relatedTarget) and keeps picking. focusout bubbles to the shadow root, so a drawer
	// rebuild that swaps the owner button for a same-label one keeps the listener.
	picker.onFocusOut = (event) => {
		if (ctx.picker !== picker || !isPickerOwner(picker, composedOrigin(event))) return;
		const to = event.relatedTarget;
		if (picker.leaving || (to && !isPickerOwner(picker, to))) exitBlockPicker(ctx, true);
	};
	// The review UI's own root, capture phase: ahead of its Esc-closes-the-drawer handler.
	ctx.ui.shadow.addEventListener("keydown", picker.onKey, true);
	ctx.ui.shadow.addEventListener("focusout", picker.onFocusOut);
	// B2 decision 7: transient window capture for pointer picking, removed on exit.
	ctx.win.addEventListener("pointermove", picker.onPointer, true);
	ctx.win.addEventListener("click", picker.onPointer, true);
	ctx.picker = picker;
	if (fromPage) focusWithoutScroll(picker.owner, ctx);
	if (sheet) revealInView(ctx, blocks[position], true);
	announcePick(ctx);
	showToast(ctx, "Pick a block: arrow keys move, Enter comments, Esc cancels");
	scheduleLayout(ctx);
}

export function exitBlockPicker(ctx, silent) {
	const picker = ctx.picker;
	if (!picker) return;
	ctx.ui.shadow.removeEventListener("keydown", picker.onKey, true);
	ctx.ui.shadow.removeEventListener("focusout", picker.onFocusOut);
	ctx.win.removeEventListener("pointermove", picker.onPointer, true);
	ctx.win.removeEventListener("click", picker.onPointer, true);
	ctx.picker = null;
	if (!silent && ctx.ui.shadow.activeElement === ctx.ui.pickFocus) {
		const back = picker.back;
		if (back && back !== ctx.doc.body && back.isConnected && typeof back.focus === "function") focusWithoutScroll(back, ctx);
		else ctx.ui.pickFocus.blur();
	}
	if (!silent) announce(ctx, "Block picker closed");
	scheduleLayout(ctx);
}

// The off-screen control that holds focus for a picker started from the page.
export function pickFocus(ctx) {
	if (!ctx.ui.pickFocus) {
		ctx.ui.pickFocus = h(ctx, "button", { type: "button", class: "vr-sr", tabindex: "-1", text: "Block picker: arrow keys move, Enter comments, Escape cancels" });
		ctx.ui.shadow.appendChild(ctx.ui.pickFocus);
	}
	return ctx.ui.pickFocus;
}

export function announcePick(ctx) {
	const picker = ctx.picker;
	const el = picker.blocks[picker.position];
	if (!el) return;
	const tag = String(el.localName || el.tagName || "").toLowerCase();
	const text = excerpt(el.getAttribute("aria-label") || el.textContent || "", 60);
	announce(ctx, tagLabel(tag) + " " + (picker.position + 1) + " of " + picker.blocks.length + (text ? ": " + text : ""));
}

export function chooseBlock(ctx) {
	const picker = ctx.picker;
	const el = picker && picker.blocks[picker.position];
	if (!el) return;
	exitBlockPicker(ctx, true);
	const anchor = createBlockAnchor(ensureIndex(ctx), el);
	openComposer(ctx, { kind: "block", anchor, label: anchor.blockText || tagLabel(anchor.blockTag || "") });
}

// The control that started the picker, or (after a panel rebuild replaced it) a button with
// the same label.
export function isPickerOwner(picker, origin) {
	const owner = picker.owner;
	return !!owner && !!origin && (origin === owner || (origin.localName === "button" && origin.textContent === owner.textContent));
}

// Inside the review UI the picker owns keys only on the control that started
// it (the drawer's "Comment on a block"); every other drawer control keeps its
// own Enter and Esc. A panel rebuild replaces that button, so a same-label
// button counts as the owner too.
export function pickerKey(ctx, event) {
	const picker = ctx.picker;
	if (!picker) return;
	if (pathHasAttribute(event, "data-vpk-review-ui") && !isPickerOwner(picker, composedOrigin(event))) return;
	const key = event.key;
	// Tab is not handled: focus moves on, and the focusout of the control ends the picker.
	if (key === "Tab") {
		picker.leaving = true;
		return;
	}
	if (!["ArrowUp", "ArrowDown", "Home", "End", "Enter", "Escape", "p", "P"].includes(key)) return;
	event.preventDefault();
	event.stopImmediatePropagation();
	if (key === "Escape") return exitBlockPicker(ctx);
	if (key === "Enter") return chooseBlock(ctx);
	if (key === "p" || key === "P") return;
	const last = picker.blocks.length - 1;
	picker.position = key === "Home" ? 0 : key === "End" ? last : Math.max(0, Math.min(last, picker.position + (key === "ArrowDown" ? 1 : -1)));
	revealInView(ctx, picker.blocks[picker.position], true);
	announcePick(ctx);
	scheduleLayout(ctx);
}

// The page shortcut C (window, bubble phase).
export function handlePageShortcut(ctx, event) {
	if (!event || event.defaultPrevented || event.repeat) return;
	if (String(event.key || "").toLowerCase() !== "c" || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
	if (pathHasAttribute(event, "data-vpk-review-ui")) return;
	if (isInteractiveOrigin(composedOrigin(event))) return;
	event.preventDefault();
	const range = selectionInDocument(ctx);
	if (range) commentOnRange(ctx, range.cloneRange());
	else enterBlockPicker(ctx);
}

export function focusWithoutScroll(node, ctx) {
	if (!node) return;
	try {
		node.focus({ preventScroll: !reducedMotion(ctx) });
	} catch {
		node.focus();
	}
}
