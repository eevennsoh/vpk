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
