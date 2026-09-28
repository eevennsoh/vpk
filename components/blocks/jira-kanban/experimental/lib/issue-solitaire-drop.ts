import { token } from "@/lib/tokens";
import { createJiraLinkingCardGlow } from "@/components/blocks/jira-linking/card-glow";
import { JIRA_LINKING_GLOW_DEFAULT_COLOR } from "@/components/blocks/jira-linking/glow-motion";

// Reference choreography: the reveal and the border travel use separate clocks.
export const CARD_DROP_STACK_EXPAND_MS = 420;
export const CARD_DROP_SHIMMER_MS = 620;
export const SINGLE_CARD_DROP_SHIMMER_MS = 500;

interface DropCard {
	code: string;
	node: HTMLElement;
	surface: HTMLElement;
	rect: DOMRect;
	surfaceRect: DOMRect;
	radius: string;
}

const SVG_NS = "http://www.w3.org/2000/svg";
let traceId = 0;

function positionTraceRect(outline: Element, rect: DOMRect, left: number, top: number, inset: number) {
	outline.setAttribute("x", String(rect.left - left + inset));
	outline.setAttribute("y", String(rect.top - top + inset));
	outline.setAttribute("width", String(Math.max(0, rect.width - inset * 2)));
	outline.setAttribute("height", String(Math.max(0, rect.height - inset * 2)));
}

/** One mask travels through all committed card outlines, measured before reveal. */
function createCollectionTrace(cards: readonly DropCard[], doc: Document, columnTitle: string) {
	const droppedSurfaces = new Set(cards.map((card) => card.surface));
	const destination = cards[0].surface.closest<HTMLElement>("[data-jira-kanban-column]");
	const excludedSurfaces = [...destination?.querySelectorAll<HTMLElement>("[data-issue-key]") ?? []].flatMap((issue) => {
		const surface = issue.querySelector<HTMLElement>('[data-slot="jira-issue-surface"]');
		return surface && !droppedSurfaces.has(surface) ? [surface] : [];
	});
	const excludedRects = excludedSurfaces.map((surface) => surface.getBoundingClientRect());
	const left = Math.min(...cards.map(({ surfaceRect }) => surfaceRect.left));
	const top = Math.min(...cards.map(({ surfaceRect }) => surfaceRect.top));
	const width = Math.max(1, Math.max(...cards.map(({ surfaceRect }) => surfaceRect.right)) - left);
	const height = Math.max(1, Math.max(...cards.map(({ surfaceRect }) => surfaceRect.bottom)) - top);
	const isSingleCard = cards.length === 1;
	const bandLength = isSingleCard ? Math.min(220, Math.max(112, height * 0.72)) : Math.min(160, Math.max(72, height * 0.45));
	const id = `issue-drop-trace-${++traceId}`;
	const svg = doc.createElementNS(SVG_NS, "svg");
	const make = (name: string, attributes: Record<string, string | number>, parent: Element) => {
		const node = doc.createElementNS(SVG_NS, name);
		for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
		parent.append(node);
		return node;
	};
	svg.setAttribute("aria-hidden", "true");
	svg.setAttribute("data-issue-drop-trace", "");
	svg.setAttribute("width", String(width));
	svg.setAttribute("height", String(height));
	svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
	Object.assign(svg.style, { position: "fixed", left: `${left}px`, top: `${top}px`, pointerEvents: "none", zIndex: "45", overflow: "visible" });
	const defs = make("defs", {}, svg);
	const gradient = make("linearGradient", { id: `${id}-gradient`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
	for (const [offset, opacity] of [[0, 0], [45, 0.18], [72, 0.5], [92, 1], [100, 0.25]]) {
		make("stop", { offset: `${offset}%`, "stop-color": "white", "stop-opacity": opacity }, gradient);
	}
	const mask = make("mask", { id, "mask-type": "luminance", maskUnits: "userSpaceOnUse", x: 0, y: -bandLength, width, height: height + bandLength * 2 }, defs);
	const band = make("rect", { x: 0, y: -bandLength, width, height: bandLength, fill: `url(#${id}-gradient)` }, mask);
	Object.assign(band.style, { transformBox: "fill-box", transformOrigin: "center bottom" });
	const targets: { surface: HTMLElement; outline: Element; inset: number }[] = [];
	for (const [index, surface] of excludedSurfaces.entries()) {
		const outline = make("rect", { "data-issue-drop-trace-exclusion": "", fill: "black" }, mask);
		positionTraceRect(outline, excludedRects[index], left, top, -1);
		targets.push({ surface, outline, inset: -1 });
	}
	const outlines = make("g", { mask: `url(#${id})` }, svg);
	for (const { surface, surfaceRect: rect, radius } of cards) {
		const outline = make("rect", {
			rx: Number.parseFloat(radius) || 8, fill: "none", stroke: columnTitle === "Done" ? token("color.border.success") : token("color.border.brand"),
			"stroke-width": 1, "vector-effect": "non-scaling-stroke",
		}, outlines);
		positionTraceRect(outline, rect, left, top, 0.5);
		targets.push({ surface, outline, inset: 0.5 });
	}
	doc.body.append(svg);
	let stopped = false;
	let frame = 0;
	const frameRects = new Array<DOMRect>(targets.length);
	const syncOutlines = () => {
		if (stopped) return;
		// Read every moving/excluded surface before writing any SVG geometry.
		for (let index = 0; index < targets.length; index++) frameRects[index] = targets[index].surface.getBoundingClientRect();
		for (let index = 0; index < targets.length; index++) {
			const target = targets[index];
			positionTraceRect(target.outline, frameRects[index], left, top, target.inset);
		}
		frame = requestAnimationFrame(syncOutlines);
	};
	frame = requestAnimationFrame(syncOutlines);
	const travel = height + bandLength * 2;
	const transformAt = (progress: number, scale: number) => `translateY(${travel * progress}px) scaleY(${scale})`;
	const animation = band.animate([
		{ transform: transformAt(0, 0.55) },
		{ transform: transformAt(0.34, 1.18), offset: 0.34 },
		{ transform: transformAt(0.7, 0.68), offset: 0.7 },
		{ transform: transformAt(1, 1.08) },
	], { duration: isSingleCard ? SINGLE_CARD_DROP_SHIMMER_MS : CARD_DROP_SHIMMER_MS, easing: "cubic-bezier(0.42, 0, 0.9, 1)", fill: "forwards" });
	return { animation, restore: () => {
		stopped = true;
		cancelAnimationFrame(frame);
		svg.remove();
	} };
}

/** Animate real cards in their final slots; the transaction has already committed. */
export function animateIssueSolitaireDrop(root: HTMLElement, columnTitle: string, codes: readonly string[], reducedMotion: boolean, onComplete: () => void, glowColors?: Readonly<Record<string, string>>): () => void {
	if (reducedMotion) { onComplete(); return () => {}; }
	const elements = [...root.querySelectorAll<HTMLElement>("[data-issue-key]")];
	const cards: DropCard[] = codes.flatMap((code) => {
		const issue = elements.find((node) => node.dataset.issueKey === code && node.dataset.boardColumnTitle === columnTitle);
		// The outer slot has FLIP disabled by this arrival and no card-hover transform.
		const node = issue?.parentElement;
		const surface = issue?.querySelector<HTMLElement>('[data-slot="jira-issue-surface"]');
		return node && surface ? [{ code, node, surface, rect: node.getBoundingClientRect(), surfaceRect: surface.getBoundingClientRect(), radius: getComputedStyle(surface).borderTopLeftRadius }] : [];
	});
	if (!cards.length) { onComplete(); return () => {}; }
	const effects: { animation: Animation; restore: () => void }[] = [];
	if (glowColors) {
		for (const card of cards) {
			effects.push(...createJiraLinkingCardGlow({
				haloRoot: card.surface,
				backdropRoot: card.node.querySelector('[data-slot="jira-issue-agent-backdrop"]'),
				color: glowColors[card.code] ?? JIRA_LINKING_GLOW_DEFAULT_COLOR,
			}));
		}
	} else effects.push(createCollectionTrace(cards, root.ownerDocument, columnTitle));
	const first = cards[0];
	const priorFirstZ = first.node.style.zIndex;
	let moving = cards.length - 1;
	if (moving) first.node.style.zIndex = "2";
	for (const [index, card] of cards.slice(1).entries()) {
		const { zIndex, willChange } = card.node.style;
		card.node.style.zIndex = "1";
		card.node.style.willChange = "transform";
		const delay = Math.min((index + 1) * 24, 72);
		const animation = card.node.animate([
			{ transform: `translate3d(0, ${first.rect.top - card.rect.top}px, 0)` },
			{ transform: "translate3d(0, 0, 0)" },
		], { delay, duration: Math.max(1, CARD_DROP_STACK_EXPAND_MS - delay), easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "backwards" });
		effects.push({ animation, restore: () => {
			card.node.style.zIndex = zIndex;
			card.node.style.willChange = willChange;
			if (--moving === 0) first.node.style.zIndex = priorFirstZ;
		} });
	}
	let remaining = effects.length;
	let completed = false;
	const complete = () => { if (!completed) { completed = true; onComplete(); } };
	const disposers = effects.map(({ animation, restore }) => {
		let restored = false;
		const settle = () => {
			if (restored) return;
			restored = true;
			restore();
			if (--remaining === 0) complete();
		};
		animation.onfinish = settle;
		animation.oncancel = settle;
		return () => { animation.cancel(); settle(); };
	});
	const stop = () => disposers.forEach((dispose) => dispose());
	if (!remaining) complete();
	return stop;
}
