import { FINALE_DONE_COLUMN_TITLE } from "./finale-trigger";

export interface FinaleCapturedRect {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

export interface FinaleCapturedCard {
	readonly rect: FinaleCapturedRect;
	/** Jira key (e.g. "TEU-6") read from the card, or "" if absent. */
	readonly code: string;
}

/** A floating element painted over the Done column (the Rovo FAB, a toolbar), with its corner radius. */
export interface FinaleCapturedOccluder extends FinaleCapturedRect {
	readonly radius: number;
}

export interface FinaleHandoffSnapshot {
	readonly column: FinaleCapturedRect;
	/** The column's scroll viewport; cards outside it stay clipped until they lift. */
	readonly list: FinaleCapturedRect;
	readonly cards: readonly FinaleCapturedCard[];
	/** Floating chrome over the column, which the flash must leave on top (see `flashOcclusion`). */
	readonly occluders: readonly FinaleCapturedOccluder[];
}

const ISSUE_KEY = /\b[A-Z][A-Z0-9]+-\d+\b/u;

function toRect(rect: DOMRect): FinaleCapturedRect {
	return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

/** Sampling pitch (px) for finding floating chrome over the column. */
const OCCLUDER_PITCH = 20;
const MAX_OCCLUDERS = 4;

function cornerRadius(element: HTMLElement, rect: DOMRect): number {
	const value = getComputedStyle(element).borderTopLeftRadius;
	const amount = Number.parseFloat(value) || 0;
	const radius = value.endsWith("%") ? (Math.min(rect.width, rect.height) * amount) / 100 : amount;
	return Math.min(radius, rect.width / 2, rect.height / 2);
}

/**
 * Floating chrome painted over the column (above it in the paint order, not
 * part of it and not one of its ancestors). At each sample point, everything
 * stacked above the column is collected and lifted to its largest ancestor
 * that is still small (never a page-sized wrapper, which may itself sit over
 * the column with no paint). The finale renders in the top layer, so without
 * this it would paint over them. Must run before the finale's dialog opens.
 */
function findOccluders(column: HTMLElement): FinaleCapturedOccluder[] {
	const bounds = column.getBoundingClientRect();
	const limit = bounds.width * bounds.height * 0.25;
	const area = (element: Element) => {
		const rect = element.getBoundingClientRect();
		return rect.width * rect.height;
	};
	const found = new Map<HTMLElement, FinaleCapturedOccluder>();
	for (let y = bounds.top + OCCLUDER_PITCH / 2; y < bounds.bottom; y += OCCLUDER_PITCH) {
		for (let x = bounds.left + OCCLUDER_PITCH / 2; x < bounds.right; x += OCCLUDER_PITCH) {
			for (const hit of document.elementsFromPoint(x, y)) {
				// Everything after the column (or its content) in the stack is beneath it.
				if (column.contains(hit) || hit.contains(column)) break;
				if (!(hit instanceof HTMLElement) || area(hit) === 0 || area(hit) > limit) continue;
				let owner: HTMLElement = hit;
				for (let node = hit.parentElement; node && node !== document.body && !node.contains(column) && area(node) <= limit; node = node.parentElement) owner = node;
				if (found.has(owner) || found.size >= MAX_OCCLUDERS) continue;
				const rect = owner.getBoundingClientRect();
				found.set(owner, { ...toRect(rect), radius: cornerRadius(owner, rect) });
			}
		}
	}
	// Keep only the outermost: a nested hit inside an occluder already found adds nothing.
	const entries = [...found.entries()];
	return entries.filter(([element]) => !entries.some(([other]) => other !== element && other.contains(element))).map(([, occluder]) => occluder);
}

const DONE_COLUMN_SELECTOR = `[data-jira-kanban-column="${FINALE_DONE_COLUMN_TITLE}"]`;
const CARD_SELECTOR = '[data-slot="jira-issue-card"]';

/** The real drop/arrival state must be gone before it becomes an immutable print. */
export function isFinaleColumnCaptureReady(column: HTMLElement): boolean {
	// The shared drop trace lives in body, outside the column. Let its real
	// completion (including cancellation/reduced motion) release this gate.
	if (column.ownerDocument.querySelector(`[data-issue-drop-trace][data-board-column-title="${FINALE_DONE_COLUMN_TITLE}"]`)) return false;
	if (column.querySelector('[data-transitioning="true"], [data-created-card-pending], [data-jira-creating-arrival="true"], [data-issue-status-choices="true"]')) return false;
	return [...column.querySelectorAll<HTMLElement>(CARD_SELECTOR)].every((card) => {
		const rect = card.getBoundingClientRect();
		return rect.width > 0 && rect.height > 0;
	});
}

/** Wait on the board's own completion markers, with no additional presentation hold. */
export function waitForFinaleColumnCapture(signal?: AbortSignal): Promise<HTMLElement | null> {
	return new Promise((resolve) => {
		let frame = 0;
		let previousGeometry: string | null = null;
		const finish = (column: HTMLElement | null) => {
			cancelAnimationFrame(frame);
			signal?.removeEventListener("abort", abort);
			resolve(column);
		};
		const abort = () => finish(null);
		const check = () => {
			if (signal?.aborted) { finish(null); return; }
			const column = document.querySelector<HTMLElement>(DONE_COLUMN_SELECTOR);
			if (!column) { finish(null); return; }
			if (isFinaleColumnCaptureReady(column)) {
				// Layout projection can outlive the arrival flag. Capture only once
				// the actual column/card bounds agree on consecutive paint frames.
				const geometry = [column, ...column.querySelectorAll<HTMLElement>(CARD_SELECTOR)].map((node) => {
					const rect = node.getBoundingClientRect();
					return [rect.x, rect.y, rect.width, rect.height].map((value) => value.toFixed(2)).join(",");
				}).join("|");
				if (geometry === previousGeometry) { finish(column); return; }
				previousGeometry = geometry;
			} else previousGeometry = null;
			frame = requestAnimationFrame(check);
		};
		signal?.addEventListener("abort", abort, { once: true });
		check();
	});
}

/** The live Done column's DOM cards (the originals the GL sheets are printed from). */
export function queryJiraTeamEu26DoneCards(): readonly HTMLElement[] {
	if (typeof document === "undefined") return [];
	return [...document.querySelectorAll<HTMLElement>(`${DONE_COLUMN_SELECTOR} ${CARD_SELECTOR}`)];
}

/**
 * Measures the live Done column at the moment the finale takes over, so every
 * card's GL sheet starts exactly on its DOM original — including cards
 * scrolled out of the column, which stay clipped until they are tossed out.
 */
export function captureJiraTeamEu26DoneColumn(): FinaleHandoffSnapshot | null {
	if (typeof document === "undefined") return null;
	const column = document.querySelector<HTMLElement>(DONE_COLUMN_SELECTOR);
	if (!column) return null;
	const listElement = column.querySelector<HTMLElement>("[data-jira-kanban-card-list]") ?? column;
	const cards = [...column.querySelectorAll<HTMLElement>(CARD_SELECTOR)]
		.map((card) => ({ card, rect: card.getBoundingClientRect() }))
		.filter(({ rect }) => rect.width > 0 && rect.height > 0)
		.map(({ card, rect }) => ({ rect: toRect(rect), code: card.textContent?.match(ISSUE_KEY)?.[0] ?? "" }));
	return {
		column: toRect(column.getBoundingClientRect()),
		list: toRect(listElement.getBoundingClientRect()),
		cards,
		occluders: findOccluders(column),
	};
}
