/*
 * review/runtime/panel: the shadow-root UI host, launcher, drawer (Comments,
 * Decisions, Changes, Share), revision banner, notices and toasts (ws1 4.8, 4.11).
 *
 * The host is div[data-vpk-review-ui][data-vpkh-no-lightbox] appended to the
 * html element (outside body) with an open shadow root. Key events that start
 * inside the shadow root stop at the host, so docnav and the lightbox never see
 * review typing. The drawer is a non-modal dialog; Esc closes it and returns
 * focus to the launcher.
 *
 * Serialized module: named function imports and export function declarations
 * only, no module-level state, plain ASCII.
 */

import { addressedIndex } from "../merge.mjs";
import { nowIso, reviewSecretFindings } from "../schema.mjs";
import { ensureIndex, ownComments, refreshAll, reviewCounts, reviewerFor, threadStatus, workingReview, writeStore } from "./boot.mjs";
import { exitBlockPicker } from "./composer.mjs";
import { decisionAnswerText, nextDecision, openDecisionIdentity } from "./decisions.mjs";
import { appendNodes, clearNode, h, iconNode, plural, revealInView, uiButton, watchPageFocus } from "./dom.mjs";
import { paintHighlights, revealMarks, scheduleLayout, stopReveal } from "./highlights.mjs";
import { renderLayoutTab } from "./layout.mjs";
import { cancelReattach, ownerBlock, storageBlock } from "./owner.mjs";
import { captureFocus, renderComments, restoreFocus } from "./threads.mjs";
import { dropZone, estimateBytes, readImportFiles, runCopy, runDownload, runSend, saveFlowBox } from "./transport.mjs";

export function dotSep() {
	return " " + String.fromCharCode(183) + " ";
}

export function createPanel(ctx) {
	const doc = ctx.doc;
	const host = doc.createElement("div");
	host.setAttribute("data-vpk-review-ui", "");
	host.setAttribute("data-vpkh-no-lightbox", "");
	doc.documentElement.appendChild(host);
	const shadow = host.attachShadow({ mode: "open" });
	for (const type of ["keydown", "keyup", "keypress"]) host.addEventListener(type, (event) => event.stopPropagation());
	const style = doc.createElement("style");
	const source = doc.querySelector("style[" + (ctx.config.shadowStyle || "data-vpk-review-shadow") + "]");
	style.textContent = source ? source.textContent : "";
	shadow.appendChild(style);
	const ui = ctx.ui;
	ui.host = host;
	ui.shadow = shadow;
	ui.layer = h(ctx, "div", { class: "vr-layer", "aria-hidden": "true" });
	ui.pinLayer = h(ctx, "div", { class: "vr-pins" });
	ui.launcher = h(ctx, "button", { type: "button", class: "vr-launcher", "aria-expanded": "false", "aria-controls": "vr-drawer", "aria-label": "Review" }, [iconNode(ctx, "comment")]);
	ui.badge = h(ctx, "span", { class: "vr-badge-count", "aria-hidden": "true", hidden: true });
	ui.launcher.appendChild(ui.badge);
	ui.launcher.addEventListener("click", () => (ctx.isOpen ? closePanel(ctx) : openPanel(ctx, ctx.tab, { focus: true })));
	ui.banner = h(ctx, "div", { class: "vr-banner", role: "region", "aria-label": "Document updated", hidden: true });
	ui.notice = h(ctx, "p", { class: "vr-notice", hidden: true });
	ui.tablist = h(ctx, "div", { class: "vr-tabs", role: "tablist", "aria-label": "Review sections" });
	ui.tabs = {};
	ui.panels = {};
	const panels = h(ctx, "div", { class: "vr-panels" });
	const names = { comments: "Comments", decisions: "Decisions", changes: "Changes", share: "Share", layout: "Layout" };
	for (const key of Object.keys(names)) {
		const tab = h(ctx, "button", { type: "button", role: "tab", id: "vr-tab-" + key, class: "vr-tab", "aria-controls": "vr-panel-" + key, "aria-selected": "false", tabindex: "-1", text: names[key] });
		tab.addEventListener("click", () => selectTab(ctx, key, true));
		ui.tabs[key] = tab;
		ui.tablist.appendChild(tab);
		ui.panels[key] = h(ctx, "div", { role: "tabpanel", id: "vr-panel-" + key, class: "vr-panel", "aria-labelledby": "vr-tab-" + key, hidden: true });
		panels.appendChild(ui.panels[key]);
	}
	ui.tablist.addEventListener("keydown", (event) => {
		const keys = Object.keys(names);
		const at = keys.indexOf(ctx.tab);
		const next = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: keys.length - 1 }[event.key];
		if (next === undefined) return;
		event.preventDefault();
		selectTab(ctx, keys[(next + keys.length) % keys.length], true);
	});
	const close = uiButton(ctx, { icon: "close", title: "Close review", cls: "vr-icon-btn", onClick: () => closePanel(ctx) });
	ui.drawer = h(ctx, "section", { id: "vr-drawer", class: "vr-drawer", role: "dialog", "aria-label": "Review", hidden: true }, [
		h(ctx, "header", { class: "vr-head" }, [h(ctx, "h2", { class: "vr-title", text: "Review" }), h(ctx, "span", { class: "vr-rev", text: ctx.revision }), close]),
		ui.notice,
		ui.tablist,
		panels,
	]);
	// Esc closes the open drawer from any review control (drawer, launcher, banner, toast).
	shadow.addEventListener("keydown", (event) => {
		if (event.key === "Escape" && ctx.isOpen && !event.defaultPrevented) {
			event.preventDefault();
			closePanel(ctx);
		}
	});
	// Page focus never lands under the banner, the Review button or the sheet (WCAG 2.4.11).
	watchPageFocus(ctx, host);
	ui.toast = h(ctx, "div", { class: "vr-toast", role: "status", "aria-live": "polite" });
	ui.live = h(ctx, "div", { class: "vr-sr", "aria-live": "polite" });
	appendNodes(ctx, shadow, [ui.layer, ui.pinLayer, ui.banner, ui.launcher, ui.drawer, ui.toast, ui.live]);
}

export function openPanel(ctx, tab, options) {
	const ui = ctx.ui;
	if (!ui.drawer) return;
	const opts = options || {};
	if (!ctx.isOpen) {
		ctx.isOpen = true;
		ui.drawer.hidden = false;
		ui.launcher.setAttribute("aria-expanded", "true");
		// The pager steps left of a side drawer; a bottom sheet leaves it in place (no sweep across).
		if (!ctx.win.matchMedia || !ctx.win.matchMedia("(max-width: 640px)").matches) ctx.doc.documentElement.style.setProperty("--vpk-pager-right", "calc(min(380px, 100vw - 24px) + 36px)");
		try {
			ensureIndex(ctx);
		} catch {
			// The document has no main or body yet; comments still list.
		}
		refreshAll(ctx);
	}
	selectTab(ctx, tab && ui.tabs[tab] ? tab : ctx.tab, opts.focus === true);
}

export function closePanel(ctx, options) {
	const ui = ctx.ui;
	if (!ctx.isOpen) return;
	if (ctx.picker) exitBlockPicker(ctx, true);
	cancelReattach(ctx, false);
	ctx.isOpen = false;
	ui.drawer.hidden = true;
	ui.launcher.setAttribute("aria-expanded", "false");
	ctx.doc.documentElement.style.removeProperty("--vpk-pager-right");
	stopReveal(ctx);
	renderBanner(ctx);
	paintHighlights(ctx);
	if (!options || options.focus !== false) ui.launcher.focus();
}

export function markSeen(ctx) {
	ctx.seen = { lastSeenRevision: ctx.revision, seenAt: nowIso() };
	writeStore(ctx, ctx.keys.seen, ctx.seen);
	renderBanner(ctx);
}

export function selectTab(ctx, tab, focusTab) {
	const ui = ctx.ui;
	ctx.tab = tab;
	if (tab !== "comments") cancelReattach(ctx, false);
	for (const key of Object.keys(ui.tabs)) {
		const on = key === tab;
		ui.tabs[key].setAttribute("aria-selected", on ? "true" : "false");
		ui.tabs[key].setAttribute("tabindex", on ? "0" : "-1");
		ui.panels[key].hidden = !on;
	}
	if (tab === "changes") markSeen(ctx);
	renderTab(ctx);
	paintHighlights(ctx);
	scheduleLayout(ctx);
	if (focusTab) ui.tabs[tab].focus();
}

export function renderTab(ctx) {
	if (!ctx.isOpen) return;
	if (ctx.tab === "comments") renderComments(ctx);
	else if (ctx.tab === "decisions") renderDecisionsTab(ctx);
	else if (ctx.tab === "changes") renderChangesTab(ctx);
	else if (ctx.tab === "layout") renderLayoutTab(ctx);
	else renderShareTab(ctx);
}

export function renderPanel(ctx) {
	if (!ctx.ui.drawer) return;
	renderLauncher(ctx);
	renderNotice(ctx);
	renderBanner(ctx);
	renderTab(ctx);
}

export function renderLauncher(ctx) {
	const counts = reviewCounts(ctx);
	const dot = dotSep();
	let label = "Review" + dot + plural(counts.open, "open comment");
	if (ctx.decisions.size) label += dot + plural(counts.decisionsTodo, "decision") + " to answer";
	ctx.ui.launcher.setAttribute("aria-label", label);
	ctx.ui.badge.textContent = String(counts.open);
	ctx.ui.badge.hidden = counts.open === 0;
}

export function renderNotice(ctx) {
	ctx.ui.notice.textContent = [ctx.notice, ctx.capNotice].filter(Boolean).join(" ");
	ctx.ui.notice.hidden = !ctx.ui.notice.textContent;
}

export function revisionNumber(value) {
	return /^r\d+$/.test(String(value || "")) ? Number(String(value).slice(1)) : 0;
}

// Only for a reader who has seen an older revision (ws1 4.11): a seen receipt (a
// first visit writes one) or own comments on it; others' comments never count.
export function renderBanner(ctx) {
	const banner = ctx.ui.banner;
	const entries = ctx.registry.entries;
	const mine = ownComments(ctx);
	const basis = mine.length ? mine : ctx.review.comments.filter((comment) => !comment.deleted);
	let last = ctx.seen ? ctx.seen.lastSeenRevision : null;
	if (!last && mine.length) last = "r" + Math.max(...mine.map((comment) => revisionNumber(comment.revision)));
	// Hidden while the drawer is open (it would cover or overlap it; the Changes tab says the same)
	// and while page focus sits under it (bannerYield, dom.watchPageFocus).
	const show = entries.length > 0 && !!last && revisionNumber(last) < revisionNumber(ctx.revision) && !ctx.bannerDismissed && !ctx.isOpen && !ctx.bannerYield;
	banner.hidden = !show;
	clearNode(banner);
	if (!show) return;
	const addressed = addressedIndex(ctx.registry);
	const count = basis.filter((comment) => !comment.parentId && threadStatus(ctx, comment) === "addressed" && addressed.has(comment.id)).length;
	const dot = dotSep();
	const text = "Updated to " + ctx.revision + " since you last looked" + dot + count + (mine.length ? " of your comments" : count === 1 ? " comment" : " comments") + " addressed";
	appendNodes(ctx, banner, [
		h(ctx, "span", { class: "vr-banner-text", text }),
		uiButton(ctx, { label: "Reveal changes", cls: "vr-link", onClick: () => {
			openPanel(ctx, "changes", { focus: true });
			revealMarks(ctx, { revision: ctx.revision });
			renderChangesTab(ctx);
		} }),
		uiButton(ctx, { label: "Dismiss", cls: "vr-link", onClick: () => {
			ctx.bannerDismissed = true;
			markSeen(ctx);
			ctx.ui.launcher.focus();
		} }),
	]);
}

export function showToast(ctx, text, action) {
	const toast = ctx.ui.toast;
	if (!toast) return;
	clearToast(ctx);
	toast.appendChild(h(ctx, "span", { text }));
	if (action && action.label) toast.appendChild(uiButton(ctx, { label: action.label, cls: "vr-link", onClick: () => {
		clearToast(ctx, action.run);
	} }));
	toast.classList.add("is-on");
	if (ctx.timers.toast) ctx.win.clearTimeout(ctx.timers.toast);
	ctx.timers.toast = ctx.win.setTimeout(() => {
		toast.classList.remove("is-on");
		clearToast(ctx);
	}, action && action.ms ? action.ms : 6000);
}

// Empties the toast, then runs `then`. Focus on a toast control that goes away
// (action, expiry, replacement) lands on the drawer's tab, else the launcher,
// unless `then` moved it.
export function clearToast(ctx, then) {
	const ui = ctx.ui;
	const had = ui.toast.contains(ui.shadow.activeElement);
	clearNode(ui.toast);
	if (then) then();
	const active = ui.shadow.activeElement;
	if (had && !(active && active.isConnected)) (ctx.isOpen ? ui.tabs[ctx.tab] : ui.launcher).focus();
}

export function renderDecisionsTab(ctx) {
	const saved = captureFocus(ctx, ctx.ui.panels.decisions);
	const panel = clearNode(ctx.ui.panels.decisions);
	if (!ctx.decisions.size) {
		panel.appendChild(h(ctx, "p", { class: "vr-empty", text: "This document has no decision blocks." }));
		return;
	}
	const askName = !ctx.identity && ctx.pendingSeen.size > 0 ? uiButton(ctx, { label: "Add your name to record your answers", cls: "vr-primary", onClick: () => openDecisionIdentity(ctx, null) }) : null;
	panel.appendChild(h(ctx, "div", { class: "vr-row-actions" }, [askName, uiButton(ctx, { label: "Next decision", onClick: () => nextDecision(ctx) })]));
	const list = h(ctx, "div", { class: "vr-threads", role: "list", "aria-label": "Decisions" });
	for (const entry of ctx.decisions.values()) {
		const state = entry.changed ? "changed" : entry.seen ? "kept" : "to answer";
		const others = ctx.review.decisions.filter((decision) => decision.key === entry.key && (!ctx.identity || decision.reviewerId !== ctx.identity.id));
		list.appendChild(h(ctx, "div", { class: "vr-thread", role: "listitem" }, [
			h(ctx, "div", { class: "vr-who" }, [h(ctx, "span", { class: "vr-name", text: entry.question || entry.key }), h(ctx, "span", { class: "vr-chip", text: state })]),
			h(ctx, "p", { class: "vr-body", text: "Your answer: " + decisionAnswerText(entry, entry.current) }),
			others.map((decision) => h(ctx, "p", { class: "vr-where", text: reviewerFor(ctx, decision.reviewerId).name + ": " + decisionAnswerText(entry, decision.value) + (decision.seen || decision.changed ? "" : " (not opened)") })),
			h(ctx, "div", { class: "vr-actions" }, [uiButton(ctx, { label: "Jump", onClick: () => {
				revealInView(ctx, entry.fieldset);
				const control = entry.fieldset.querySelector("input, select, textarea");
				if (control) control.focus({ preventScroll: true });
			} })]),
		]));
	}
	panel.appendChild(list);
	restoreFocus(ctx, panel, saved);
}

export function renderChangesTab(ctx) {
	const saved = captureFocus(ctx, ctx.ui.panels.changes);
	const panel = clearNode(ctx.ui.panels.changes);
	const entries = ctx.registry.entries.slice().reverse();
	if (!entries.length) {
		panel.appendChild(h(ctx, "p", { class: "vr-empty", text: "No revisions recorded yet. The agent records one with build.mjs --stamp." }));
		return;
	}
	const dot = dotSep();
	panel.appendChild(h(ctx, "p", { class: "vr-where", text: "You are viewing " + ctx.revision + "." }));
	for (const entry of entries) {
		const box = h(ctx, "article", { class: "vr-change" }, [
			h(ctx, "h3", { class: "vr-sub", text: entry.id + dot + entry.label }),
			h(ctx, "p", { class: "vr-time", text: String(entry.timestamp).slice(0, 16).replace("T", " ") + " UTC" }),
			entry.summary ? h(ctx, "p", { class: "vr-body", text: entry.summary }) : null,
			h(ctx, "p", { class: "vr-where", text: [plural(entry.changed, "changed", "changed"), plural(entry.added, "added", "added"), plural(entry.removed.length, "removed", "removed"), entry.addresses.length ? "addresses " + plural(entry.addresses.length, "comment") : null].filter(Boolean).join(dot) }),
		]);
		if (entry.changed + entry.added > 0) box.appendChild(revealStepper(ctx, entry.id));
		for (const removed of entry.removed) box.appendChild(h(ctx, "p", { class: "vr-loose", text: "Removed " + removed.tag + ": " + removed.excerpt }));
		if (entry.contentChanged) box.appendChild(h(ctx, "p", { class: "vr-loose", text: "Content data changed (rendered at runtime; individual changes aren't marked)" }));
		panel.appendChild(box);
	}
	restoreFocus(ctx, panel, saved);
}

export function revealStepper(ctx, revision) {
	const on = ctx.reveal.revision === revision;
	const count = on ? ctx.reveal.list.length : 0;
	const step = (options) => {
		revealMarks(ctx, Object.assign({ revision }, options));
		renderChangesTab(ctx);
	};
	return h(ctx, "div", { class: "vr-row-actions" }, on ? [
		uiButton(ctx, { label: "Previous", icon: "chevronUp", onClick: () => step({ step: -1 }) }),
		h(ctx, "span", { class: "vr-time", text: count ? ctx.reveal.position + 1 + " of " + count : "No marked blocks" }),
		uiButton(ctx, { label: "Next", icon: "chevronDown", onClick: () => step({ step: 1 }) }),
		uiButton(ctx, { label: "Show all", pressed: ctx.reveal.all, onClick: () => step({ all: !ctx.reveal.all }) }),
	] : [uiButton(ctx, { label: "Reveal changes", onClick: () => step({}) })]);
}

export function renderShareTab(ctx) {
	const saved = captureFocus(ctx, ctx.ui.panels.share);
	const panel = clearNode(ctx.ui.panels.share);
	const review = workingReview(ctx);
	const bytes = estimateBytes(ctx);
	const limit = ctx.config.dataUrlSafeBytes || 1572846;
	if (bytes > limit) panel.appendChild(h(ctx, "p", { class: "vr-notice", text: "This file is " + (bytes / 1048576).toFixed(1) + " MB. Some previews (data: URLs) show a blank page above 1.5 MB. Share the file as a download, and return reviews as JSON." }));
	const secrets = reviewSecretFindings(review);
	if (secrets.length) panel.appendChild(h(ctx, "p", { class: "vr-notice", text: plural(secrets.length, "comment") + " may contain a secret (" + [...new Set(secrets.map((item) => item.label))].join(", ") + "). Remove it before you share." }));
	const reviewers = review.reviewers.length;
	const send = h(ctx, "div", { class: "vr-stack" }, [
		h(ctx, "h3", { class: "vr-sub", text: "Send comments back" }),
		uiButton(ctx, { label: "Copy for agent", icon: "copy", onClick: () => runCopy(ctx) }),
		ctx.identity ? uiButton(ctx, { label: "Download my comments", icon: "download", onClick: () => runDownload(ctx, "mine") }) : null,
		uiButton(ctx, { label: "Download all (" + plural(reviewers, "reviewer") + ")", icon: "download", onClick: () => runDownload(ctx, "all") }),
		uiButton(ctx, { label: "Save reviewed copy", cls: "vr-save-open", onClick: () => {
			ctx.saveFlow = { step: "scope", scope: reviewers > 1 && ctx.identity ? "mine" : "all", message: null };
			ctx.focusAfter = (node) => node.querySelector(".vr-dialog input:checked, .vr-dialog .vr-btn");
			renderShareTab(ctx);
		} }),
		ctx.host && ctx.host.canSend ? uiButton(ctx, { label: "Send to agent" + (ctx.host.agent ? " (" + ctx.host.agent + ")" : ""), icon: "send", onClick: () => runSend(ctx) }) : null,
	]);
	panel.appendChild(send);
	if (ctx.saveFlow) panel.appendChild(saveFlowBox(ctx, reviewers));
	if (ctx.copyFallback) {
		const area = h(ctx, "textarea", { class: "vr-text", readonly: true, "aria-label": "Review markdown", rows: "6" });
		area.value = ctx.copyFallback;
		appendNodes(ctx, panel, [h(ctx, "p", { class: "vr-where", text: "Press Ctrl+C (Cmd+C on a Mac) to copy." }), area]);
		ctx.win.setTimeout(() => area.select(), 0);
	}
	const input = h(ctx, "input", { type: "file", multiple: true, accept: ".json,.html,application/json,text/html", class: "vr-file", "aria-label": "Import review files" });
	input.addEventListener("change", () => {
		if (input.files && input.files.length) readImportFiles(ctx, [...input.files]);
	});
	const bring = h(ctx, "div", { class: "vr-stack" }, [
		h(ctx, "h3", { class: "vr-sub", text: "Bring comments in" }),
		uiButton(ctx, { label: "Import reviews", onClick: () => input.click() }),
		input,
		dropZone(ctx, "Or drop review files (.json or reviewed .html) here", (files) => readImportFiles(ctx, files)),
	]);
	appendNodes(ctx, panel, [ownerBlock(ctx, bring), storageBlock(ctx)]);
	restoreFocus(ctx, panel, saved);
}
