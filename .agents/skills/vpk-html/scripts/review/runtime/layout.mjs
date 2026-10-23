/*
 * review/runtime/layout: the M2 Layout tab of the review drawer (ws1 4.18). "Check this page" runs
 * the layout audit (review/layout-audit.mjs layoutFindings) at the current window width; each
 * finding offers Reveal and "Add as comment" (kind "layout"). Nothing runs automatically (the
 * lavish passive-inbox rule): only the button runs the audit.
 *
 * Serialized module: named function imports and export function declarations only, no
 * module-level state, plain ASCII.
 */

import { createBlockAnchor } from "../anchor.mjs";
import { layoutFindings } from "../layout-audit.mjs";
import { nowIso } from "../schema.mjs";
import { ensureIndex } from "./boot.mjs";
import { openComposer } from "./composer.mjs";
import { appendNodes, clearNode, h, plural, revealInView, uiButton } from "./dom.mjs";
import { captureFocus, restoreFocus } from "./threads.mjs";

export function layoutDot() {
	return " " + String.fromCharCode(183) + " ";
}

export function layoutLabel(finding) {
	return "Layout" + layoutDot() + finding.rule + layoutDot() + (finding.overflowPx ? finding.overflowPx + "px at " : "at ") + finding.viewportWidth;
}

export function runLayoutCheck(ctx) {
	let findings = [];
	let failed = null;
	try {
		findings = layoutFindings();
	} catch (error) {
		failed = error && error.message ? error.message : "The layout check failed";
	}
	ctx.layoutResult = { findings, failed, width: ctx.win.innerWidth, at: nowIso() };
	return ctx.layoutResult;
}

// The block a finding names, when the index still has it.
export function layoutTarget(ctx, finding) {
	return finding.blockId ? ensureIndex(ctx).elements.get(finding.blockId) || null : null;
}

// "Add as comment": the composer, prefilled, anchored to the finding's block (page-level findings
// become a general layout comment).
export function addLayoutComment(ctx, finding) {
	const element = layoutTarget(ctx, finding);
	const anchor = element ? createBlockAnchor(ensureIndex(ctx), element) : null;
	const label = layoutLabel(finding);
	const layout = { rule: finding.rule, axis: finding.axis, viewportWidth: finding.viewportWidth };
	if (finding.overflowPx) layout.overflowPx = finding.overflowPx;
	ctx.composer.draft = label + ". ";
	openComposer(ctx, { kind: "layout", anchor, label, layout });
}

export function renderLayoutTab(ctx) {
	const saved = captureFocus(ctx, ctx.ui.panels.layout);
	const panel = clearNode(ctx.ui.panels.layout);
	const result = ctx.layoutResult || null;
	appendNodes(ctx, panel, [
		h(ctx, "p", { class: "vr-where", text: "Checks this page at the current window width for sideways scrolling, clipped text or controls, and covered text. It runs only when you press the button." }),
		h(ctx, "div", { class: "vr-row-actions" }, [uiButton(ctx, { label: result ? "Check again" : "Check this page", cls: "vr-primary", onClick: () => {
			runLayoutCheck(ctx);
			ctx.focusAfter = (node) => node.querySelector(".vr-primary");
			renderLayoutTab(ctx);
		} })]),
	]);
	if (!result) return restoreFocus(ctx, panel, saved);
	if (result.failed) panel.appendChild(h(ctx, "p", { class: "vr-notice", text: result.failed }));
	else {
		panel.appendChild(h(ctx, "p", { class: "vr-time", text: (result.findings.length ? plural(result.findings.length, "issue") : "No layout issues") + " at " + result.width + " px wide" }));
	}
	const list = h(ctx, "div", { class: "vr-threads", role: "list", "aria-label": "Layout issues" });
	for (const finding of result.findings) {
		const element = layoutTarget(ctx, finding);
		list.appendChild(h(ctx, "div", { class: "vr-thread", role: "listitem" }, [
			h(ctx, "div", { class: "vr-who" }, [h(ctx, "span", { class: "vr-name", text: finding.rule }), h(ctx, "span", { class: "vr-chip", text: (finding.overflowPx ? finding.overflowPx + "px" : "covered") + " at " + finding.viewportWidth })]),
			h(ctx, "p", { class: "vr-where", text: finding.selector }),
			h(ctx, "div", { class: "vr-actions" }, [
				element ? uiButton(ctx, { label: "Reveal", onClick: () => revealInView(ctx, element) }) : null,
				uiButton(ctx, { label: "Add as comment", onClick: () => addLayoutComment(ctx, finding) }),
			]),
		]));
	}
	panel.appendChild(list);
	restoreFocus(ctx, panel, saved);
}
