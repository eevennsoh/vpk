import { clamp } from "./finale-math";

export const FINALE_INK = "#101214";

/**
 * How far the gradient's painting box reaches past the line boxes, above and
 * below. `background-clip: text` only paints glyph ink inside the element's
 * border box, and at the finale's tight line heights (1.05–1.1) accented caps
 * rise ~0.11em above the first line box and descenders drop ~0.06em below the
 * last one, so "g", "y", "É" were cut off. The padding is cancelled by an equal
 * negative margin, so the text itself does not move.
 */
export const FINALE_INK_BLEED = "0.25em";

/**
 * Figma "Type behavior": while building, a blue → purple → amber → green band
 * trails the reveal edge; after building, the line settles to solid ink.
 * The gradient spans 300% of the text box and slides from right to left, so
 * ink enters from the left and the unrevealed right third stays transparent.
 */
export function finaleBuildGradient(ink: string): string {
	return [
		"linear-gradient(90deg",
		`${ink} 0%`,
		// A settled word shows the first third (0–33.3%): it must be solid ink.
		`${ink} 34%`,
		"rgb(31, 105, 218) 41%",
		"rgb(193, 108, 212) 48%",
		"rgb(245, 161, 23) 55%",
		"rgba(121, 174, 68, 0.85) 61%",
		"rgba(121, 174, 68, 0) 66.6%",
		"transparent 100%)",
	].join(", ");
}

/**
 * Writes the build state for progress `amount` (0 hidden → 1 settled ink).
 * The sweep is an even smoothstep rather than a bold ease-out: a bold curve
 * spends its first frames racing, so the colour band flashed past unseen.
 *
 * The lift is a 2D translate, cleared once built: the band repaints the text
 * every frame anyway, and a 3D transform would make each word its own
 * compositor layer, which on the mega bento's hundreds of words ran the GPU
 * out of tile memory and blinked whole cards out for a frame.
 */
export function applyFinaleBuild(element: HTMLElement, amount: number, lift = 0.12): void {
	const x = clamp(amount);
	const eased = x * x * (3 - 2 * x);
	element.style.backgroundPosition = `${(100 - eased * 100).toFixed(2)}% 0`;
	element.style.transform = eased >= 1 ? "" : `translate(0, ${((1 - eased) * lift).toFixed(3)}em)`;
}
