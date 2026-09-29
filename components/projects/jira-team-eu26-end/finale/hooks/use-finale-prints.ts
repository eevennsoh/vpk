"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import { flashPrintRect } from "@/components/projects/jira-team-eu26-end/finale/lib/finale-column-flash";
import { waitForFinaleColumnCapture } from "@/components/projects/jira-team-eu26-end/finale/lib/capture-done-column";
import { FINALE_DONE_COLUMN_TITLE } from "../lib/finale-trigger";

const ISSUE_KEY = /\b[A-Z][A-Z0-9]+-\d+\b/u;
const CARD = '[data-slot="jira-issue-card"]';
/** Lets the board's own drop animation finish before a card is printed. */
const PRINT_SETTLE_MS = 700;
let fontEmbedCss: Promise<string> | null = null;

/**
 * Freezes line breaks: text that sits on one line in the live DOM is pinned to
 * one line in the print copy. The print renderer measures glyphs a hair wider,
 * so tight fits (a "TEU-13" key in a 42px slot) would otherwise re-wrap.
 */
function freezeSingleLineText(source: HTMLElement, copy: HTMLElement): void {
	const sourceWalker = document.createTreeWalker(source, NodeFilter.SHOW_TEXT);
	const copyWalker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
	const range = document.createRange();
	for (let original = sourceWalker.nextNode(), cloned = copyWalker.nextNode(); original && cloned; original = sourceWalker.nextNode(), cloned = copyWalker.nextNode()) {
		if (!original.textContent?.trim() || !cloned.parentElement) continue;
		range.selectNodeContents(original);
		if (range.getClientRects().length === 1) cloned.parentElement.style.whiteSpace = "nowrap";
	}
}

/** A DOM clone loses scroll offsets; bake them into its content before rasterising. */
export function freezeFinalePrintScroll(source: HTMLElement, copy: HTMLElement): void {
	const originals = [...source.children];
	const copies = [...copy.children];
	for (let index = 0; index < originals.length; index += 1) {
		const original = originals[index];
		const cloned = copies[index];
		if (!(original instanceof HTMLElement) || !(cloned instanceof HTMLElement)) continue;
		if (source.scrollLeft !== 0 || source.scrollTop !== 0) {
			const transform = cloned.style.transform;
			cloned.style.transform = `translate(${-source.scrollLeft}px, ${-source.scrollTop}px)${transform && transform !== "none" ? ` ${transform}` : ""}`;
		}
		freezeFinalePrintScroll(original, cloned);
	}
}

interface FinalePrintOptions {
	readonly pixelRatio?: number;
	/**
	 * Print an off-screen copy instead of the live node, so transient pointer
	 * state (the hover MCB's cursor leaves on a card) never bakes into the print.
	 */
	readonly detach?: boolean;
	/** Adjust the detached copy before it is printed (e.g. hide parts of it). */
	readonly prepare?: (copy: HTMLElement) => void;
}

function printBackdrop(element: HTMLElement): string {
	for (let node: HTMLElement | null = element; node; node = node.parentElement) {
		const colour = getComputedStyle(node).backgroundColor;
		if (colour.startsWith("rgb(") || /,\s*1\)$/u.test(colour)) return colour;
	}
	return getComputedStyle(document.body).backgroundColor;
}

/** Offscreen clones must load immediately: lazy visibility never arrives there. */
export async function loadFinalePrintImages(element: HTMLElement): Promise<void> {
	await Promise.all([...element.querySelectorAll("img")].map((image) => {
		image.loading = "eager";
		return image.decode().catch(() => undefined);
	}));
}

/** Print the settled face, rather than freezing a still-hidden arrival/drag ghost. */
export function settleFinaleColumnCopy(column: HTMLElement): void {
	for (const face of column.querySelectorAll<HTMLElement>('[data-issue-source-ghost-content], [data-slot="jira-creating-card"]')) {
		face.style.opacity = "1";
		face.style.transform = "none";
	}
	for (const ghost of column.querySelectorAll<HTMLElement>("[data-issue-source-ghost-placeholder]")) ghost.style.opacity = "0";
	for (const slot of column.querySelectorAll<HTMLElement>('[data-slot="jira-creating-slot"]')) slot.style.height = "auto";
	// AnimatePresence can retain the outgoing drag caption/badge after state clears.
	for (const transient of column.querySelectorAll<HTMLElement>('[data-board-column-header-copy-layer="label"], [data-auto-arrange-count]')) transient.remove();
	for (const resting of column.querySelectorAll<HTMLElement>('[data-board-column-header-copy-layer="add"]')) {
		resting.style.opacity = "1";
		resting.style.transform = "none";
	}
}

/**
 * Rasterises a DOM subtree to a canvas (the same html-to-image path Peel uses).
 * Font embedding covers the whole document and is resolved once: embedding
 * only the first printed node's fonts let later prints fall back to a wider
 * face and re-wrap text.
 */
export async function printFinaleElement(element: HTMLElement, options: FinalePrintOptions = {}): Promise<HTMLCanvasElement> {
	const { getFontEmbedCSS, toCanvas } = await import("html-to-image");
	await document.fonts.ready;
	fontEmbedCss ??= getFontEmbedCSS(document.body, { preferredFontFormat: "woff2" }).catch(() => "");
	let target = element;
	let host: HTMLDivElement | null = null;
	if (options.detach) {
		host = document.createElement("div");
		host.setAttribute("aria-hidden", "true");
		host.inert = true;
		host.style.cssText = "position:fixed;left:-30000px;top:0;pointer-events:none;";
		const copy = element.cloneNode(true) as HTMLElement;
		copy.style.width = `${element.offsetWidth}px`;
		copy.style.height = `${element.offsetHeight}px`;
		copy.style.margin = "0";
		freezeSingleLineText(element, copy);
		freezeFinalePrintScroll(element, copy);
		options.prepare?.(copy);
		host.append(copy);
		target = copy;
		document.body.append(host);
	}
	try {
		await loadFinalePrintImages(target);
		return await toCanvas(target, {
			pixelRatio: options.pixelRatio ?? Math.min(window.devicePixelRatio || 1, 2),
			fontEmbedCSS: await fontEmbedCss,
			style: { margin: "0", transform: "none" },
		});
	} finally {
		host?.remove();
	}
}

/**
 * The Done column after native drop cleanup (header, surface and its cards), for
 * the flash's column pass (`finale-column-flash.tsx`), which renders the
 * whole column through the flash. Scroll offsets are baked into the copy, and
 * only a plain backdrop fills its overscan. Cards below the visible list
 * are clipped out of the print anyway, so the copy swaps them for one spacer of
 * the same height: the rasteriser then inlines styles for only the cards that
 * show (about 4 of 13), which is most of the print's cost.
 */
export async function printFinaleColumn(signal?: AbortSignal): Promise<HTMLCanvasElement | undefined> {
	const column = await waitForFinaleColumnCapture(signal);
	if (!column) return undefined;
	const liveList = column.querySelector<HTMLElement>("[data-jira-kanban-card-list]");
	const trim = trailingHiddenCards(column, liveList);
	const bounds = column.getBoundingClientRect();
	const region = flashPrintRect(bounds);
	const backdrop = printBackdrop(column);
	const prepare = (copy: HTMLElement) => {
		settleFinaleColumnCopy(copy);
		if (trim) {
			const container = elementAtPath(copy, trim.path);
			const items = [...(container?.children ?? [])].slice(trim.from);
			const spacer = document.createElement("div");
			spacer.style.cssText = `height:${trim.height}px;flex-shrink:0;`;
			for (const item of items) item.remove();
			container?.append(spacer);
		}
	};
	const image = await printFinaleElement(column, { detach: true, prepare }).catch(() => undefined);
	if (!image || signal?.aborted) return undefined;
	const ratio = Math.min(window.devicePixelRatio || 1, 2);
	const padded = document.createElement("canvas");
	padded.width = Math.round(region.width * ratio);
	padded.height = Math.round(region.height * ratio);
	const context = padded.getContext("2d");
	if (!context) return undefined;
	context.fillStyle = backdrop;
	context.fillRect(0, 0, padded.width, padded.height);
	context.drawImage(image, (bounds.x - region.x) * ratio, (bounds.y - region.y) * ratio, bounds.width * ratio, bounds.height * ratio);
	padded.dataset.finaleBackdrop = backdrop;
	return padded;
}

interface TrailingCards {
	/** Child indices from the column down to the element holding the cards. */
	readonly path: readonly number[];
	/** First item index that sits wholly below the visible list. */
	readonly from: number;
	/** Height those items occupy, kept as a spacer so layout never shifts. */
	readonly height: number;
}

/** The run of card items at the end of the list that the list's viewport never shows. */
function trailingHiddenCards(column: HTMLElement, list: HTMLElement | null): TrailingCards | null {
	const cards = [...column.querySelectorAll<HTMLElement>(CARD)];
	if (!list || cards.length < 2) return null;
	// Each card's item is its ancestor directly under the element holding every card.
	let item: HTMLElement = cards[0];
	while (item.parentElement && !item.parentElement.contains(cards[1])) item = item.parentElement;
	const container = item.parentElement;
	if (!container || !column.contains(container)) return null;
	const items = [...container.children] as HTMLElement[];
	const visibleBottom = list.getBoundingClientRect().bottom;
	let from = items.length;
	const holdsCard = (entry: HTMLElement) => entry.matches(CARD) || entry.querySelector(CARD) !== null;
	while (from > 0 && holdsCard(items[from - 1]) && items[from - 1].getBoundingClientRect().top >= visibleBottom) from -= 1;
	if (from >= items.length) return null;
	const top = items[from].getBoundingClientRect().top;
	const bottom = Math.max(...items.slice(from).map((entry) => entry.getBoundingClientRect().bottom));
	const path: number[] = [];
	for (let node: HTMLElement = container; node !== column; node = node.parentElement as HTMLElement) {
		path.unshift([...(node.parentElement?.children ?? [])].indexOf(node));
	}
	return { path, from, height: bottom - top };
}

function elementAtPath(root: HTMLElement, path: readonly number[]): HTMLElement | null {
	let node: Element | null = root;
	for (const index of path) node = node?.children[index] ?? null;
	return node as HTMLElement | null;
}

/** A keynote card on the board: in Done, or anywhere (for the idle pre-print). */
export function findFinaleCard(code: string, scope: "done" | "board" = "done"): HTMLElement | null {
	const root = scope === "done" ? document.querySelector(`[data-jira-kanban-column="${FINALE_DONE_COLUMN_TITLE}"]`) : document;
	const cards = root?.querySelectorAll<HTMLElement>('[data-slot="jira-issue-card"]') ?? [];
	for (const card of cards) {
		if (card.textContent?.match(ISSUE_KEY)?.[0] === code) return card;
	}
	return null;
}

export interface FinaleCardPrints {
	/** Print a card shortly after it lands in Done (idle time, so the demo stays smooth). */
	readonly schedule: (code: string) => void;
	/** Ensure these cards are printed now; resolves once every available print exists. */
	readonly ensure: (codes: readonly string[]) => Promise<void>;
	/**
	 * Print cards from wherever they sit, one per idle slot, so the finale can
	 * start moments after the last card lands (cards share one width across
	 * columns). Arrival in Done still re-prints each card.
	 */
	readonly prewarm: (codes: readonly string[]) => void;
	readonly get: (code: string) => HTMLCanvasElement | undefined;
}

/**
 * Prints of the Done column's cards, captured incrementally as MCB drags them
 * in, so the finale's GL layer can start on pixel-identical copies without a
 * capture stall at the end.
 */
export function useFinaleCardPrints(): FinaleCardPrints {
	const printsRef = useRef(new Map<string, HTMLCanvasElement>());
	const pendingRef = useRef(new Map<string, Promise<void>>());
	const timersRef = useRef(new Set<number>());

	const capture = useCallback((code: string, scope: "done" | "board" = "done") => {
		const existing = pendingRef.current.get(code);
		if (existing) return existing;
		const element = findFinaleCard(code, scope) ?? (scope === "done" ? findFinaleCard(code, "board") : null);
		if (!element) return Promise.resolve();
		const task = printFinaleElement(element, { detach: true })
			.then((canvas) => {
				printsRef.current.set(code, canvas);
			})
			.catch(() => undefined)
			.finally(() => {
				pendingRef.current.delete(code);
			});
		pendingRef.current.set(code, task);
		return task;
	}, []);

	const schedule = useCallback((code: string) => {
		const timer = window.setTimeout(() => {
			timersRef.current.delete(timer);
			const idle = window.requestIdleCallback ?? ((callback: () => void) => window.setTimeout(callback, 0));
			idle(() => {
				// Never print while the finale plays: it would cost frames, and the
				// pre-printed copy is already on screen.
				if (document.querySelector("dialog[data-jira-team-eu26-end-finale][open]")) return;
				void capture(code);
			});
		}, PRINT_SETTLE_MS);
		timersRef.current.add(timer);
	}, [capture]);

	const ensure = useCallback(async (codes: readonly string[]) => {
		await Promise.all(codes.map((code) => (printsRef.current.has(code) ? undefined : capture(code))));
	}, [capture]);

	const get = useCallback((code: string) => printsRef.current.get(code), []);

	const prewarm = useCallback((codes: readonly string[]) => {
		const idle = window.requestIdleCallback ?? ((callback: () => void) => window.setTimeout(callback, 50));
		const next = (index: number) => {
			if (index >= codes.length) return;
			idle(() => {
				const code = codes[index];
				const task = printsRef.current.has(code) ? Promise.resolve() : capture(code, "board");
				void task.then(() => next(index + 1));
			});
		};
		next(0);
	}, [capture]);

	useEffect(() => {
		const timers = timersRef.current;
		return () => {
			for (const timer of timers) window.clearTimeout(timer);
			timers.clear();
		};
	}, []);

	return useMemo(() => ({ schedule, ensure, get, prewarm }), [ensure, get, prewarm, schedule]);
}
