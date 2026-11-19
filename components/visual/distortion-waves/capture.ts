import { snapshot, type CaptureFunction } from "distortion-waves";

const SIDES = ["top", "right", "bottom", "left"] as const;
const canvases = new WeakMap<HTMLElement, Partial<Record<"content" | "revealed", HTMLCanvasElement>>>();

/**
 * Tailwind's preflight gives every element `border: 0 solid`. Upstream's
 * snapshot writes only styles that differ from a blank baseline, so it keeps
 * `border-style: solid` but drops the `0px` width, and the picture then draws
 * the initial `medium` (3px) border around every element. Writing the zero
 * width back restores the page as it looks.
 */
export function zeroWidthBorders(el: Element): Record<string, string> | undefined {
	const style = getComputedStyle(el);
	let fixes: Record<string, string> | undefined;
	for (const side of SIDES) {
		if (style.getPropertyValue(`border-${side}-width`) === "0px" && style.getPropertyValue(`border-${side}-style`) !== "none") {
			fixes ??= {};
			fixes[`border-${side}-width`] = "0px";
		}
	}
	return fixes;
}

/**
 * Upstream's built-in capture (distortion-waves 0.1.0 `WaveController.capture`)
 * plus `zeroWidthBorders`. Root and layer overrides mirror upstream exactly.
 */
export const captureWithTailwindBorders: CaptureFunction = async ({ element, slot, width, height, scale, background, ignore }) => {
	const rootStyle = getComputedStyle(element);
	const layer = element.querySelector(`:scope > [data-dw-layer="${slot}"]`);
	const root: Record<string, string> = {
		"border-radius": "0",
		position: "absolute",
		left: `${-Number.parseFloat(rootStyle.borderLeftWidth)}px`,
		top: `${-Number.parseFloat(rootStyle.borderTopWidth)}px`,
		right: "auto",
		bottom: "auto",
		margin: "0",
		transform: "none",
		translate: "none",
		rotate: "none",
		scale: "none",
		opacity: "1",
		visibility: "visible",
		width: `${element.offsetWidth}px`,
		height: `${element.offsetHeight}px`,
		"box-sizing": "border-box",
		"min-width": "0",
		"min-height": "0",
		"max-width": "none",
		"max-height": "none",
	};
	const shown = { opacity: "1", visibility: "visible" };
	const cache = canvases.get(element) ?? {};
	canvases.set(element, cache);

	const picture = await snapshot(element, {
		width,
		height,
		scale,
		background,
		skip: ignore,
		into: cache[slot],
		force: (el) => {
			const base = el === element ? root : el === layer ? shown : undefined;
			const fixes = zeroWidthBorders(el);
			return base && fixes ? { ...fixes, ...base } : base ?? fixes;
		},
	});
	cache[slot] = picture.canvas;
	return picture.canvas;
};
