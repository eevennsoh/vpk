import { FINALE_STAGE } from "../data/finale-cues";

export interface FinaleStageFit {
	readonly scale: number;
	readonly x: number;
	readonly y: number;
	/** The live window, CSS px: the GL layers size and project to it. */
	readonly width: number;
	readonly height: number;
}

/** The Figma stage letterboxed into a `width` × `height` window (CSS px). */
export function finaleStageFit(width: number, height: number): FinaleStageFit {
	const scale = Math.min(width / FINALE_STAGE.width, height / FINALE_STAGE.height);
	return { scale, x: (width - FINALE_STAGE.width * scale) / 2, y: (height - FINALE_STAGE.height * scale) / 2, width, height };
}

/** The live window's fit (the 1920 stage itself while server rendering). */
export function currentFinaleStageFit(): FinaleStageFit {
	return typeof window === "undefined" ? finaleStageFit(FINALE_STAGE.width, FINALE_STAGE.height) : finaleStageFit(window.innerWidth, window.innerHeight);
}

/**
 * Most device pixels the card field may draw: a 4K frame. Its lens pass (a 4×
 * multisampled scene, then a 32-tap chromatic smear) runs over every pixel of
 * every frame from the toss to the bento. Measured on an M4 Pro at 120Hz, 8.3M
 * pixels hold every frame, while 10.9M (a 16" MacBook at "More Space") drops
 * the field to ~80fps.
 */
export const FINALE_FIELD_PIXEL_BUDGET = 3840 * 2160;

/**
 * The card field's canvas pixel ratio: the display's (at most 2×), eased just
 * enough past the budget. The sheets it softens are in flight and smeared, and
 * every tile hands over to its crisp DOM face on landing.
 */
export function finaleFieldPixelRatio(width: number, height: number, devicePixelRatio: number): number {
	const ratio = Math.min(devicePixelRatio || 1, 2);
	return Math.min(ratio, Math.sqrt(FINALE_FIELD_PIXEL_BUDGET / Math.max(1, width * height)));
}
