import { badgeVariants } from "@/components/ui/badge";
import { DECK_VISIBLE_MAX } from "@/components/blocks/agent-session/session-drag-deck";
import { token } from "@/lib/tokens";
import { createIssueCohortDeckLayers, type IssueCohortGatherLayer } from "./issue-cohort-gather";

function removeIssuePreviewActions(preview: HTMLElement) {
	for (const control of preview.querySelectorAll('[data-jira-issue-selection-control], [aria-label^="More actions for "]')) control.remove();
}

/** Isolate native issue paint while preserving an attached session's visible backdrop. */
export function createIssueDragPreview(card: HTMLElement): HTMLElement {
	const shell = card.closest<HTMLElement>('[data-slot="jira-issue-agent-shell"]');
	const backdrop = shell?.querySelector<HTMLElement>('[data-slot="jira-issue-agent-backdrop"]');
	const surface = card.querySelector<HTMLElement>('[data-slot="jira-issue-surface"]');
	if (!shell || !backdrop || !surface) return card;

	const bounds = card.getBoundingClientRect();
	// A fused join removes the source's top band; the detached preview restores
	// that band from the unchanged horizontal inset.
	const inset = Math.max(0, surface.getBoundingClientRect().left - bounds.left);

	// Clone the existing chrome without the session chin. Extending only the
	// preview preserves the issue body's size and the source board's geometry.
	const preview = shell.cloneNode(false) as HTMLElement;
	const body = card.cloneNode(true) as HTMLElement;
	const sourceNodes = [card, ...card.querySelectorAll<HTMLElement | SVGElement>("*")];
	const previewNodes = [body, ...body.querySelectorAll<HTMLElement | SVGElement>("*")];
	// The offscreen clone cannot inherit the source's hover/focus state. Freeze
	// its painted appearance so issue chrome survives the lift.
	sourceNodes.forEach((source, index) => {
		const appearance = getComputedStyle(source);
		Object.assign(previewNodes[index].style, {
			opacity: appearance.opacity,
			visibility: appearance.visibility,
			color: appearance.color,
			backgroundColor: appearance.backgroundColor,
			borderColor: appearance.borderColor,
			boxShadow: appearance.boxShadow,
			pointerEvents: "none",
		});
	});
	removeIssuePreviewActions(body);
	const previewSurface = body.querySelector<HTMLElement>('[data-slot="jira-issue-surface"]')!;
	previewSurface.style.top = `${inset - 1}px`;
	preview.setAttribute("aria-hidden", "true");
	preview.inert = true;
	preview.dataset.issueDragPreview = "";
	Object.assign(preview.style, {
		position: "fixed",
		left: "-10000px",
		top: "0",
		width: `${bounds.width}px`,
		height: `${bounds.height + inset}px`,
		padding: "0",
		transform: "none",
		opacity: "1",
		pointerEvents: "none",
	});
	Object.assign(body.style, {
		height: `${bounds.height}px`,
		transform: "none",
	});
	const isolatedBackdrop = backdrop.cloneNode(true) as HTMLElement;
	Object.assign(isolatedBackdrop.style, { top: "0", bottom: "0", left: "0", right: "0", borderRadius: "10px", opacity: "1" });
	if (inset > 0) {
		preview.append(isolatedBackdrop);
	} else {
		// Native snapshots crop exterior shadows to the bitmap's rectangle,
		// leaving fragments in rounded cutouts. Keep this face shadow-free;
		// the onscreen cohort preview supplies its own travelling elevation.
		const appearance = getComputedStyle(surface);
		Object.assign(preview.style, {
			borderRadius: appearance.borderRadius,
			overflow: "hidden",
			boxShadow: "none",
		});
		previewSurface.style.boxShadow = "none";
		previewSurface.style.removeProperty("background-color");
	}
	preview.append(body);
	card.ownerDocument.body.append(preview);
	return preview;
}

/** Restore the detached face to the full card size, without changing its source well. */
function restoreIssuePreviewFace(preview: HTMLElement, card: HTMLElement) {
	const surface = card.querySelector<HTMLElement>('[data-slot="jira-issue-surface"]');
	const body = preview.querySelector<HTMLElement>('[data-slot="jira-issue-card"]');
	if (!surface || !body) return;
	const bounds = card.getBoundingClientRect();
	preview.querySelector('[data-slot="jira-issue-agent-backdrop"]')?.remove();
	Object.assign(preview.style, {
		width: `${bounds.width}px`, height: `${bounds.height}px`, overflow: "hidden",
		borderRadius: getComputedStyle(surface).borderRadius,
	});
	Object.assign(body.style, {
		position: "relative", left: "0", top: "0",
		width: `${bounds.width}px`, height: `${bounds.height}px`,
	});
	body.style.setProperty("--cover-surface-inset", "0px");
	body.style.setProperty("--cover-surface-top-inset", "0px");
	for (const cover of body.querySelectorAll<HTMLElement>('[data-slot="jira-issue-cover"]')) cover.style.setProperty("--cover-ring-inset", "0px");
	const frozenSurface = body.querySelector<HTMLElement>('[data-slot="jira-issue-surface"]');
	if (frozenSurface) {
		// Surface offsets are measured inside the issue body's 1px border.
		Object.assign(frozenSurface.style, { top: "-1px", right: "-1px", bottom: "-1px", left: "-1px" });
		// The travelling face uses its normal semantic surface, not frozen hover paint.
		frozenSurface.style.removeProperty("background-color");
	}
}

export function createIssueFacePreview(card: HTMLElement, captured?: HTMLElement): HTMLElement {
	const prepared = captured ? captured.cloneNode(true) as HTMLElement : createIssueDragPreview(card);
	const lead = prepared === card ? card.cloneNode(true) as HTMLElement : prepared;
	if (prepared === card) {
		const bounds = card.getBoundingClientRect();
		Object.assign(lead.style, { width: `${bounds.width}px`, height: `${bounds.height}px` });
	}
	restoreIssuePreviewFace(lead, card);
	removeIssuePreviewActions(lead);
	return lead;
}

/** Issue faces travel without selection wells; cohorts reuse the Agent Session deck. */
export function createIssueCohortPreview(card: HTMLElement, selection?: ReadonlySet<string>, previousLayers: readonly IssueCohortGatherLayer[] = []) {
	const count = selection?.size ?? 1;
	const lead = createIssueFacePreview(card);
	lead.dataset.issueCohortFront = "";
	const preview = card.ownerDocument.createElement("div");
	preview.className = "pointer-events-none fixed isolate";
	preview.setAttribute("aria-hidden", "true");
	preview.inert = true;
	preview.dataset.issueCohortPreview = "";
	preview.dataset.issueCohortCount = String(count);
	Object.assign(preview.style, {
		left: "0", top: "0", zIndex: "1000", width: lead.style.width, height: lead.style.height,
		willChange: "transform", pointerEvents: "none",
	});
	Object.assign(lead.style, {
		position: "relative", left: "0", top: "0", zIndex: "1",
		boxShadow: token("elevation.shadow.overlay"),
		borderRadius: lead.style.borderRadius || getComputedStyle(card).borderRadius,
	});
	const gathering: { sheet: HTMLElement; layer: IssueCohortGatherLayer }[] = [];
	const rearCount = Math.max(0, Math.min(count - 1, DECK_VISIBLE_MAX - 1));
	const layers = createIssueCohortDeckLayers(Math.random, previousLayers, rearCount);
	for (const [index, layer] of layers.entries()) {
		const sheet = card.ownerDocument.createElement("span");
		sheet.className = "pointer-events-none absolute inset-0 rounded-lg bg-surface";
		sheet.dataset.issueDeckLayer = String(index + 1);
		Object.assign(sheet.style, {
			boxShadow: token("elevation.shadow.overlay"),
			transform: `translate(${layer.xPx}px, ${layer.yPx}px) rotate(${layer.rotateDeg}deg)`,
			zIndex: String(-1 - index),
		});
		preview.append(sheet);
		gathering.push({ sheet, layer });
	}
	preview.append(lead);
	if (count > 1) {
		const badge = card.ownerDocument.createElement("span");
		badge.className = `${badgeVariants({ variant: "neutral" })} absolute -right-1 -top-1 z-10 ring-2 ring-surface`;
		badge.dataset.slot = "badge";
		badge.textContent = String(count);
		preview.append(badge);
	}
	card.ownerDocument.body.append(preview);
	return { node: preview, gathering };
}
