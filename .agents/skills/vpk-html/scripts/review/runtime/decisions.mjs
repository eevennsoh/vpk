/*
 * review/runtime/decisions: decision blocks with seen tracking (ws1 4.10).
 *
 *   fieldset.vpk-decision[data-vpk-decision="<key>"] with a legend and radio,
 *   checkbox, select, textarea or text/range inputs; checked/selected marks the
 *   recommendation.
 *
 * The recommendation is read from the source defaults (defaultChecked,
 * defaultSelected, defaultValue), never from restored form state. The runtime
 * appends a data-vpk-generated "suggested" tag to recommended labels, applies
 * the reader's stored answer, and records one Decision per key|reviewerId.
 * Seen = at least 40% visible for 900 ms, or pointerdown/focusin inside the
 * fieldset, or "Next decision". data-vpk-decision-state (todo|kept|changed) is
 * the one transient attribute the runtime writes (ws1 4.2 exception).
 *
 * Serialized module: named function imports and export function declarations
 * only, no module-level state, plain ASCII.
 */

import { nowIso, reviewLimits } from "../schema.mjs";
import { normalizeWhitespace } from "../text.mjs";
import { ensureIndex, refuseAtCap, saveState } from "./boot.mjs";
import { h, revealInView } from "./dom.mjs";
import { openComposer } from "./composer.mjs";
import { renderPanel, showToast } from "./panel.mjs";

export function decisionControls(fieldset) {
	return [...fieldset.querySelectorAll("input, select, textarea")].filter((control) => {
		const type = String(control.getAttribute("type") || "").toLowerCase();
		return control.localName !== "input" || ["radio", "checkbox", "text", "range", ""].includes(type);
	});
}

// Values of the fieldset: chosen radio/checkbox values, selected options, or
// non-empty text/range values. With `defaults`, the source recommendation.
export function readDecisionValue(fieldset, defaults) {
	const out = [];
	for (const control of decisionControls(fieldset)) {
		const tag = control.localName;
		const type = String(control.getAttribute("type") || "").toLowerCase();
		if (tag === "select") {
			for (const option of control.options) if (defaults ? option.defaultSelected : option.selected) out.push(option.value);
		} else if (type === "radio" || type === "checkbox") {
			if (defaults ? control.defaultChecked : control.checked) out.push(control.value || "on");
		} else {
			const value = String(defaults ? control.defaultValue : control.value);
			if (value.trim()) out.push(value);
		}
	}
	return out;
}

export function writeDecisionValue(fieldset, values) {
	const wanted = new Set(values || []);
	const texts = (values || []).slice();
	for (const control of decisionControls(fieldset)) {
		const tag = control.localName;
		const type = String(control.getAttribute("type") || "").toLowerCase();
		if (tag === "select") for (const option of control.options) option.selected = wanted.has(option.value);
		else if (type === "radio" || type === "checkbox") control.checked = wanted.has(control.value || "on");
		else control.value = texts.length ? texts.shift() : "";
	}
}

export function sameValues(a, b) {
	return a.length === b.length && a.every((value, position) => value === b[position]);
}

// value -> label text for radio, checkbox and select options.
export function decisionOptions(fieldset) {
	const options = {};
	for (const control of decisionControls(fieldset)) {
		if (control.localName === "select") {
			for (const option of control.options) options[option.value] = normalizeWhitespace(option.textContent);
			continue;
		}
		const label = control.closest("label");
		if (label) {
			const copy = label.cloneNode(true);
			for (const generated of copy.querySelectorAll("[data-vpk-generated], small")) generated.remove();
			options[control.value || "on"] = normalizeWhitespace(copy.textContent) || control.value;
		}
	}
	return options;
}

export function decisionAnswerText(entry, values) {
	const list = values || [];
	if (!list.length) return "no answer";
	return list.map((value) => (entry && entry.options && entry.options[value]) || value).join(", ");
}

export function bindDecisions(ctx) {
	const fieldsets = [...ctx.doc.querySelectorAll("fieldset.vpk-decision[data-vpk-decision]")];
	for (const fieldset of fieldsets) {
		const key = fieldset.getAttribute("data-vpk-decision");
		if (!/^[a-z][a-z0-9-]{0,40}$/.test(key || "") || ctx.decisions.has(key)) continue;
		const legend = fieldset.querySelector("legend");
		const question = legend ? normalizeWhitespace(legend.textContent).slice(0, 300) : key;
		const defaultValue = readDecisionValue(fieldset, true);
		const entry = { key, fieldset, question, options: decisionOptions(fieldset), defaultValue, current: readDecisionValue(fieldset, false), seen: false, changed: false, timer: null };
		ctx.decisions.set(key, entry);
		markSuggested(ctx, fieldset);
		const mine = ctx.identity ? ctx.review.decisions.find((decision) => decision.key === key && decision.reviewerId === ctx.identity.id) : null;
		if (mine) {
			writeDecisionValue(fieldset, mine.value);
			entry.seen = mine.seen;
			entry.changed = mine.changed;
		}
		entry.current = readDecisionValue(fieldset, false);
		setDecisionState(entry);
		const onChange = () => recordDecisionChange(ctx, key);
		fieldset.addEventListener("change", onChange);
		fieldset.addEventListener("input", onChange);
		fieldset.addEventListener("pointerdown", () => markDecisionSeen(ctx, key));
		fieldset.addEventListener("focusin", () => markDecisionSeen(ctx, key));
	}
	observeDecisionSeen(ctx);
}

export function markSuggested(ctx, fieldset) {
	for (const control of decisionControls(fieldset)) {
		const type = String(control.getAttribute("type") || "").toLowerCase();
		const recommended = control.localName === "select" ? false : (type === "radio" || type === "checkbox") && control.defaultChecked;
		const label = control.closest("label");
		if (!recommended || !label || label.querySelector(".vpk-decision__suggested")) continue;
		label.appendChild(h(ctx, "span", { class: "vpk-decision__suggested", "data-vpk-generated": "", text: "suggested" }));
	}
}

export function setDecisionState(entry) {
	entry.fieldset.setAttribute("data-vpk-decision-state", entry.changed ? "changed" : entry.seen ? "kept" : "todo");
}

export function observeDecisionSeen(ctx) {
	const win = ctx.win;
	if (typeof win.IntersectionObserver !== "function" || !ctx.decisions.size) return;
	const byNode = new Map([...ctx.decisions.values()].map((entry) => [entry.fieldset, entry]));
	const observer = new win.IntersectionObserver((records) => {
		for (const record of records) {
			const entry = byNode.get(record.target);
			if (!entry || entry.seen) continue;
			if (record.intersectionRatio >= 0.4) {
				if (!entry.timer) entry.timer = win.setTimeout(() => markDecisionSeen(ctx, entry.key), 900);
			} else if (entry.timer) {
				win.clearTimeout(entry.timer);
				entry.timer = null;
			}
		}
	}, { threshold: [0, 0.4] });
	for (const node of byNode.keys()) observer.observe(node);
	ctx.ui.decisionObserver = observer;
}

export function upsertDecision(ctx, entry) {
	if (!ctx.identity) return false;
	const id = ctx.identity.id;
	const now = nowIso();
	const record = { key: entry.key, reviewerId: id, question: entry.question, value: entry.current.slice(), defaultValue: entry.defaultValue.slice(), changed: entry.changed, seen: entry.seen, updatedAt: now };
	const previous = ctx.review.decisions.find((decision) => decision.key === entry.key && decision.reviewerId === id);
	if (entry.seen) record.seenAt = previous && previous.seenAt ? previous.seenAt : now;
	if (previous && sameValues(previous.value, record.value) && previous.changed === record.changed && previous.seen === record.seen && previous.question === record.question) return false;
	// At the 200-answer cap a new record is refused, never another reviewer's evicted (B2 decision 10a).
	entry.unrecorded = !previous && ctx.review.decisions.length >= reviewLimits().decisions;
	if (entry.unrecorded) return false;
	ctx.review.decisions = [...ctx.review.decisions.filter((decision) => !(decision.key === entry.key && decision.reviewerId === id)), record]
		.sort((a, b) => (a.key !== b.key ? (a.key < b.key ? -1 : 1) : a.reviewerId < b.reviewerId ? -1 : 1));
	return true;
}

export function markDecisionSeen(ctx, key) {
	const entry = ctx.decisions.get(key);
	if (!entry || entry.seen) return;
	entry.seen = true;
	if (entry.timer) ctx.win.clearTimeout(entry.timer);
	entry.timer = null;
	setDecisionState(entry);
	if (ctx.identity) {
		if (upsertDecision(ctx, entry)) saveState(ctx);
	} else ctx.pendingSeen.add(key);
	renderPanel(ctx);
}

export function recordDecisionChange(ctx, key) {
	const entry = ctx.decisions.get(key);
	if (!entry) return;
	entry.current = readDecisionValue(entry.fieldset, false);
	entry.changed = !sameValues(entry.current, entry.defaultValue);
	entry.seen = true;
	setDecisionState(entry);
	if (!ctx.identity) {
		ctx.pendingSeen.add(key);
		const active = ctx.doc.activeElement;
		promptDecisionIdentity(ctx, active && entry.fieldset.contains(active) ? active : decisionControls(entry.fieldset)[0]);
		renderPanel(ctx);
		return;
	}
	if (upsertDecision(ctx, entry)) saveState(ctx);
	else if (entry.unrecorded) refuseAtCap(ctx, "decisions");
	renderPanel(ctx);
}

// Answering never moves focus (WCAG 3.2.2 On Input): a toast offers the name
// form instead, and once the name is saved focus returns to `control`.
export function promptDecisionIdentity(ctx, control) {
	const toast = ctx.ui.toast;
	if (toast && toast.classList.contains("is-on") && String(toast.textContent).indexOf("Add your name") === 0) return;
	showToast(ctx, "Add your name to record your answers", { label: "Add name", ms: 10000, run: () => openDecisionIdentity(ctx, control) });
}

export function openDecisionIdentity(ctx, control) {
	openComposer(ctx, { kind: "identity", anchor: null, label: "Add your name to record your answers", after: () => {
		renderPanel(ctx);
		showToast(ctx, "Saved. Your answers are recorded.");
		if (!control || !control.isConnected) return;
		try {
			control.focus({ preventScroll: true });
		} catch {
			control.focus();
		}
	} });
}

// Every decision gets a record for the reader before an export, so unopened
// ones read "(not opened; default kept)".
export function ensureDecisionRecords(ctx, render) {
	if (!ctx.identity) return;
	let changed = false;
	for (const entry of ctx.decisions.values()) {
		entry.current = readDecisionValue(entry.fieldset, false);
		if (upsertDecision(ctx, entry)) changed = true;
	}
	if (changed) saveState(ctx);
	if (changed && render) renderPanel(ctx);
}

// key -> { blockId, headingPath, question, options, start } for reviewMarkdown.
export function decisionInfoMap(ctx) {
	const out = new Map();
	let index = null;
	try {
		index = ensureIndex(ctx);
	} catch {
		index = null;
	}
	for (const entry of ctx.decisions.values()) {
		const block = entry.fieldset.closest("[data-vpk-id]");
		const blockId = block ? block.getAttribute("data-vpk-id") : null;
		const range = index && blockId ? index.blocks.get(blockId) : null;
		const headings = [];
		if (index && range) {
			for (const heading of index.headings) if (heading.start <= range.start) headings.push(heading);
		}
		out.set(entry.key, { blockId, headingPath: headings.slice(-1).map((heading) => heading.text.slice(0, 80)), question: entry.question, options: entry.options, start: range ? range.start : undefined });
	}
	return out;
}

export function nextDecision(ctx) {
	const entries = [...ctx.decisions.values()];
	const next = entries.find((entry) => !entry.seen && !entry.changed) || entries[0];
	if (!next) return null;
	revealInView(ctx, next.fieldset);
	const control = decisionControls(next.fieldset)[0];
	if (control) {
		try {
			control.focus({ preventScroll: true });
		} catch {
			control.focus();
		}
	}
	markDecisionSeen(ctx, next.key);
	return next.key;
}
