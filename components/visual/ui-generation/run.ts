import { buildOverlay } from "./overlay.ts";
import { drawFrame, type ContentStyle } from "./frame.ts";
import { measure } from "./measure.ts";
import { DEFAULT_DURATION, END, MIN_DURATION, PHASES } from "./timeline.ts";

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
 * layer exactly over it). The content is hidden until its reveal and its inline
 * `opacity`, `clip-path` and `filter` are restored afterwards. Returns a cancel
 * function that stops at once and shows the content as it is.
 */
export function startGeneration(content: HTMLElement, host: HTMLElement, options: GenerationOptions = {}): () => void {
	const duration = Math.max(MIN_DURATION, options.duration ?? GENERATION_DEFAULTS.duration);
	const rest: ContentStyle = {
		opacity: content.style.opacity,
		clipPath: content.style.clipPath,
		filter: content.style.filter,
	};
	const restInert = content.inert;
	let stopped = false;
	let raf = 0;
	let timer = 0;

	const clear = () => {
		host.replaceChildren();
		content.style.opacity = rest.opacity;
		content.style.clipPath = rest.clipPath;
		content.style.filter = rest.filter;
		content.inert = restInert;
	};
	const finish = () => {
		if (stopped) return;
		stopped = true;
		cancelAnimationFrame(raf);
		window.clearTimeout(timer);
		clear();
		options.onDone?.();
	};

	// Hidden means unreachable: no focus lands on controls nobody can see yet.
	content.style.opacity = "0";
	content.inert = true;
	timer = window.setTimeout(async () => {
		// Text lines are measured from the rendered glyphs, so wait for the real font.
		await document.fonts?.ready;
		if (stopped) return;
		raf = requestAnimationFrame(() => {
			if (stopped) return;
			let overlay;
			try {
				overlay = buildOverlay(
					host,
					measure(content, {
						maxParts: options.maxParts ?? GENERATION_DEFAULTS.maxParts,
						keys: options.keys ?? GENERATION_DEFAULTS.keys,
					}),
				);
			} catch (error) {
				// A drawing that cannot be built must never leave the real UI hidden.
				console.warn("UIGeneration: could not build the overlay, showing the content", error);
				finish();
				return;
			}
			const start = performance.now();
			const tick = (now: number) => {
				if (stopped) return;
				const t = now - start;
				const p = t / duration;
				drawFrame(overlay, content, p, t, duration, rest);
				if (p >= PHASES.reveal[0]) content.inert = restInert;
				if (p >= END) {
					finish();
					return;
				}
				raf = requestAnimationFrame(tick);
			};
			raf = requestAnimationFrame(tick);
		});
	}, options.delay ?? GENERATION_DEFAULTS.delay);

	return () => {
		if (stopped) return;
		stopped = true;
		cancelAnimationFrame(raf);
		window.clearTimeout(timer);
		clear();
	};
}
