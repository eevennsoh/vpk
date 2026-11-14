"use client";

import { lazy, Suspense, type ComponentType } from "react";

/**
 * A glyph component (an icon or a logo) whose module downloads on first render, so a route pays
 * only for the glyphs it shows. Until the module arrives, an empty box of the glyph's size holds
 * its place, so a glyph that arrives late never moves the content around it. A module that fails
 * to load leaves the empty box instead of breaking the surface around it.
 */
export function createLazyGlyph<Props extends object>(
	load: () => Promise<ComponentType<Props>>,
	boxSize: (props: Readonly<Props>) => number,
): ComponentType<Props> {
	function GlyphBox(props: Readonly<Props>) {
		const size = boxSize(props);
		return <span aria-hidden className="inline-block shrink-0" style={{ height: size, width: size }} />;
	}

	const LoadedGlyph = lazy<ComponentType<Props>>(() => load().then(
		(Component) => ({ default: Component }),
		() => ({ default: GlyphBox as ComponentType<Props> }),
	));

	function LazyGlyph(props: Props) {
		return (
			<Suspense fallback={<GlyphBox {...props} />}>
				<LoadedGlyph {...props} />
			</Suspense>
		);
	}

	return LazyGlyph;
}
