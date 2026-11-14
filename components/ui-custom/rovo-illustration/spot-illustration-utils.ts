export function easeOutCubic(t: number) {
	return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
}

export function springEase(t: number) {
	const c = Math.max(0, Math.min(1, t));
	if (c === 0) return 0;
	if (c === 1) return 1;
	const damping = 0.72;
	const frequency = 2.2;
	const decay = Math.exp(-damping * frequency * c * 2 * Math.PI);
	return 1 - decay * Math.cos(frequency * c * 2 * Math.PI);
}

export function easeInCubic(t: number) {
	const c = Math.max(0, Math.min(1, t));
	return c * c * c;
}

export function easeInBack(t: number) {
	const c = Math.max(0, Math.min(1, t));
	const s = 1.4;
	const s1 = s + 1;
	return s1 * c * c * c - s * c * c;
}

export function easeOutQuart(t: number) {
	const c = Math.max(0, Math.min(1, t));
	return 1 - Math.pow(1 - c, 4);
}

export function easeInQuart(t: number) {
	const c = Math.max(0, Math.min(1, t));
	return c * c * c * c;
}

export { lerp } from "@/lib/utils";

export function getSpotIllustrationUrl(id: string, theme: "light" | "dark", baseUrl: string): string {
	return `${baseUrl}spot-illustrations/${theme}/${id}.svg`;
}

export function applyOverlapClipPath(svgElement: SVGSVGElement): void {
	void svgElement;
}

const UNSAFE_SVG_ELEMENTS = "script, foreignObject, iframe, object, embed, audio, video, link, meta";
const UNSAFE_SVG_REFERENCE = /^\s*(?:javascript:|data:text\/html|https?:)/iu;

/**
 * Parse processed illustration markup as SVG, remove executable or remote
 * content, and mount the resulting node without using an HTML injection sink.
 */
export function mountProcessedIllustrationSvg(
	container: HTMLElement,
	svgText: string,
): SVGSVGElement | null {
	const parsedDocument = new DOMParser().parseFromString(svgText, "image/svg+xml");
	const parsedSvg = parsedDocument.documentElement;
	if (parsedSvg.localName !== "svg" || parsedDocument.querySelector("parsererror")) {
		container.replaceChildren();
		return null;
	}

	parsedSvg.querySelectorAll(UNSAFE_SVG_ELEMENTS).forEach((element) => element.remove());
	for (const element of [parsedSvg, ...Array.from(parsedSvg.querySelectorAll("*"))]) {
		for (const attribute of Array.from(element.attributes)) {
			const attributeName = attribute.name.toLowerCase();
			if (attributeName.startsWith("on")) {
				element.removeAttribute(attribute.name);
				continue;
			}

			if (
				(attributeName === "href" || attributeName === "xlink:href" || attributeName === "src") &&
				UNSAFE_SVG_REFERENCE.test(attribute.value)
			) {
				element.removeAttribute(attribute.name);
			}
		}
	}

	const mountedSvg = container.ownerDocument.importNode(parsedSvg, true) as unknown as SVGSVGElement;
	container.replaceChildren(mountedSvg);
	return mountedSvg;
}
