import { buildOverlay } from "./overlay.ts";
import { drawFrame, type ContentStyle } from "./frame.ts";
import { measure } from "./measure.ts";
import { DEFAULT_DURATION, END, MIN_DURATION } from "./timeline.ts";

export interface GenerationOptions {
	/** ms of drawing; the whole build is about `duration × 1.09`. */
	readonly duration?: number;
	/** ms before the build starts. */
	readonly delay?: number;
	/** Most parts traced; the largest are kept. */
	readonly maxParts?: number;
	/** Key elements that get their own guides, handles and size label. */
	readonly keys?: number;
	readonly onDone?: () => void;
}

export const GENERATION_DEFAULTS = {
	duration: DEFAULT_DURATION,
	delay: 0,
	maxParts: 60,
	keys: 5,
} as const;

/**
 * Plays the build over `content`, drawing into `host` (an absolutely positioned
 * layer exactly over it, in the same parent). The content is hidden, inert and
 * `aria-hidden` until the build is over, and its inline `opacity`, `clip-path`
 * and `filter` are restored afterwards. Focus inside the content waits on the
 * shared parent and goes back once the build ends. Returns a cancel function
 * that stops at once and shows the content as it is.
 */
export function startGeneration(content: HTMLElement, host: HTMLElement, options: GenerationOptions = {}): () => void {
	const duration = Math.max(MIN_DURATION, options.duration ?? GENERATION_DEFAULTS.duration);
	const rest: ContentStyle = {
		opacity: content.style.opacity,
		clipPath: content.style.clipPath,
		filter: content.style.filter,
	};
	const restInert = content.inert;
	const restHidden = content.getAttribute("aria-hidden");
	const frame = content.parentElement;
	const restTabIndex = frame?.getAttribute("tabindex") ?? null;
	const active = document.activeElement;
	const focused = frame && active instanceof HTMLElement && content.contains(active) ? active : null;
	let stopped = false;
	let raf = 0;
	let timer = 0;
	let resized = false;
	const observer = typeof ResizeObserver === "function" ? new ResizeObserver(() => (resized = true)) : null;

	const stop = (done: boolean) => {
		if (stopped) return;
		stopped = true;
		cancelAnimationFrame(raf);
		window.clearTimeout(timer);
		observer?.disconnect();
		host.replaceChildren();
		content.style.opacity = rest.opacity;
		content.style.clipPath = rest.clipPath;
		content.style.filter = rest.filter;
		content.inert = restInert;
		if (restHidden === null) content.removeAttribute("aria-hidden");
		else content.setAttribute("aria-hidden", restHidden);
		if (focused && frame) {
			// Only if nobody moved focus elsewhere in the meantime.
			const waiting = document.activeElement === frame || document.activeElement === document.body;
			if (waiting && focused.isConnected) focused.focus({ preventScroll: true });
			if (restTabIndex === null) frame.removeAttribute("tabindex");
			else frame.setAttribute("tabindex", restTabIndex);
		}
		if (done) options.onDone?.();
	};

	// A replay over focused content would drop focus to the page: park it on the parent instead.
	if (focused && frame) {
		if (restTabIndex === null) frame.tabIndex = -1;
		frame.focus({ preventScroll: true });
	}
	// Unreachable until fully in: nothing can be focused or read while it is still being drawn.
	content.style.opacity = "0";
	content.inert = true;
	content.setAttribute("aria-hidden", "true");
	timer = window.setTimeout(async () => {
		// Text lines are measured from the rendered glyphs, so wait for the real font.
		await document.fonts?.ready;
		if (stopped) return;
		raf = requestAnimationFrame(() => {
			if (stopped) return;
			const size = { w: content.offsetWidth, h: content.offsetHeight };
			let overlay;
			try {
				overlay = buildOverlay(
					host,
					measure(content, {
						maxParts: options.maxParts ?? GENERATION_DEFAULTS.maxParts,
						keys: options.keys ?? GENERATION_DEFAULTS.keys,
					}),
				);
				// Drawn at progress 0 before this frame paints, so the finished wireframe never flashes.
				drawFrame(overlay, content, 0, 0, duration, rest);
			} catch (error) {
				// A drawing that cannot be built must never leave the real UI hidden.
				console.warn("UIGeneration: could not build the overlay, showing the content", error);
				stop(true);
				return;
			}
			observer?.observe(content);
			// The clock starts once the drawing exists, so building it never eats into the first phase.
			const start = performance.now();
			const tick = (now: number) => {
				if (stopped) return;
				// Resizes are checked once per frame, before any writes. The drawing is measured
				// once, so a new size settles the build instead of tracing stale geometry.
				if (resized) {
					resized = false;
					if (Math.abs(content.offsetWidth - size.w) > 1 || Math.abs(content.offsetHeight - size.h) > 1) {
						stop(true);
						return;
					}
				}
				const t = now - start;
				const p = t / duration;
				drawFrame(overlay, content, p, t, duration, rest);
				if (p >= END) {
					stop(true);
					return;
				}
				raf = requestAnimationFrame(tick);
			};
			raf = requestAnimationFrame(tick);
		});
	}, options.delay ?? GENERATION_DEFAULTS.delay);

	return () => stop(false);
}
