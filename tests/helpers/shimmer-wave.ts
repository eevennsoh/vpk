/**
 * Reads a rendered `ShimmerWave` (components/ui-custom/shimmer-wave.tsx) from its root,
 * the `as` element. With motion allowed the root holds one track span whose children are
 * one span per character: an animated letter holds the visible glyph then an
 * `aria-hidden` highlight copy, and a space is a bare span holding U+00A0. With reduced
 * motion the root holds the plain text and no elements.
 */
import type { Locator } from "@playwright/test";

export type ShimmerWaveState = Readonly<{
	/** Lower-case tag of the root, the `as` element. */
	tagName: string;
	/** Per-character spans in the track; 0 when the plain element rendered. */
	letters: number;
	/** The text a reader sees, once per character. */
	text: string;
}>;

export function readShimmerWave(root: Locator): Promise<ShimmerWaveState> {
	return root.evaluate((node): ShimmerWaveState => {
		const track = node.childElementCount === 1 ? node.firstElementChild : null;
		const letters = track?.tagName === "SPAN" ? [...track.children] : [];
		const text = letters.length > 0
			? letters.map((letter) => (letter.firstElementChild ?? letter).textContent ?? "").join("").replaceAll("\u00A0", " ")
			: node.textContent ?? "";
		return { tagName: node.tagName.toLowerCase(), letters: letters.length, text };
	});
}

/**
 * One string holding each animated letter's computed transform and its highlight's
 * computed opacity. Two samples differ only if at least one letter moved or faded between them.
 */
export function sampleShimmerWaveMotion(root: Locator): Promise<string> {
	return root.evaluate((node) => {
		const letters = [...(node.firstElementChild?.children ?? [])];
		return letters
			.filter((letter) => letter.lastElementChild?.getAttribute("aria-hidden") === "true")
			.map((letter) => `${getComputedStyle(letter).transform}|${getComputedStyle(letter.lastElementChild!).opacity}`)
			.join(";");
	});
}
