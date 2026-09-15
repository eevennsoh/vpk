"use client";

import type { CSSProperties, ReactNode } from "react";

import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

export type CardGlowCSSProperties = CSSProperties & Record<`--card-glow-${string}`, string | number>;

/**
 * How far the bloom travels from centre at full pointer deflection.
 *
 * `percent` measures the glow layer's own box (`absolute inset-0`), so it works
 * on content-sized surfaces such as a list row. `container` keeps the original
 * bento reading, which measures the tile's *content* box — consumers that pick
 * it must also set `container-type: size` on the surface.
 */
export type CardGlowTravel = "percent" | "container";

/**
 * Tuned in the card-glow showcase (`components/website/demos/visual/card-glow-demo.tsx`).
 * That demo is the parameter lab; these are the values it settled on, and every
 * product consumer reads them from here instead of restating the numbers.
 */
export const CARD_GLOW_DEFAULTS = {
	borderCore: 36,
	borderSpread: 120,
	borderWidth: 1,
	iconBlur: 28,
	iconBrightness: 1.3,
	iconContrast: 1.4,
	iconOpacity: 0.25,
	iconSaturate: 5,
	iconScale: 3.4,
} as const;

/**
 * Put this on the ancestor that owns a set of glow surfaces. The per-surface
 * accent goes on the surface itself via {@link cardGlowSurfaceStyle}; keeping
 * the tuning vars on a shared ancestor means one declaration for a whole grid
 * or list rather than one per card.
 */
export const CARD_GLOW_EFFECT_STYLE: CardGlowCSSProperties = {
	"--card-glow-border-core": CARD_GLOW_DEFAULTS.borderCore,
	"--card-glow-border-spread": CARD_GLOW_DEFAULTS.borderSpread,
	"--card-glow-border-width": CARD_GLOW_DEFAULTS.borderWidth,
	"--card-glow-icon-blur": CARD_GLOW_DEFAULTS.iconBlur,
	"--card-glow-icon-brightness": CARD_GLOW_DEFAULTS.iconBrightness,
	"--card-glow-icon-contrast": CARD_GLOW_DEFAULTS.iconContrast,
	"--card-glow-icon-opacity": CARD_GLOW_DEFAULTS.iconOpacity,
	"--card-glow-icon-saturate": CARD_GLOW_DEFAULTS.iconSaturate,
	"--card-glow-icon-scale": CARD_GLOW_DEFAULTS.iconScale,
};

/**
 * Per-surface style: the accent the stroke and bloom are painted in, plus the
 * travel basis. Spread it onto the element that hosts {@link CardGlowLayers}.
 */
export function cardGlowSurfaceStyle(
	accent: string,
	travel: CardGlowTravel = "percent",
): CardGlowCSSProperties {
	if (travel === "container") {
		return {
			"--card-glow-tile-accent": accent,
			"--card-glow-travel-x": "50cqi",
			"--card-glow-travel-y": "50cqh",
		};
	}

	return { "--card-glow-tile-accent": accent };
}

const CARD_GLOW_BLOOM_STYLE: CSSProperties = {
	filter: [
		"blur(calc(var(--card-glow-icon-blur) * 1px))",
		"saturate(var(--card-glow-icon-saturate))",
		"brightness(var(--card-glow-icon-brightness))",
		"contrast(var(--card-glow-icon-contrast))",
	].join(" "),
	scale: "var(--card-glow-icon-scale)",
	translate: [
		"calc(var(--card-glow-pointer-x, -10) * var(--card-glow-travel-x, 50%))",
		"calc(var(--card-glow-pointer-y, -10) * var(--card-glow-travel-y, 50%))",
	].join(" "),
	willChange: "translate, scale, filter, opacity",
};

const CARD_GLOW_BASE_BORDER_STYLE: CSSProperties = {
	boxShadow: `inset 0 0 0 calc(var(--card-glow-border-width) * 1px) ${token("color.border")}`,
};

// The hover stroke is a plain accent radial-gradient painted onto the same 1px
// ring as the base grey border (same border-box geometry + radius). It is fully
// transparent away from the pointer, so the grey stroke shows through everywhere
// except where the accent overlays it — and a surface with no resting border
// shows nothing at all until the pointer arrives. Deliberately no glass filter
// here: an always-on filter recolors the ring even where the gradient is
// transparent, which crushes the grey border underneath and breaks coexistence.
const CARD_GLOW_BORDER_STYLE: CSSProperties = {
	background: [
		"radial-gradient(",
		"circle at ",
		"calc((var(--card-glow-pointer-x, -10) + 1) * 50%) ",
		"calc((var(--card-glow-pointer-y, -10) + 1) * 50%), ",
		"var(--card-glow-tile-accent) 0 calc(var(--card-glow-border-core) * 1px), ",
		"transparent calc(var(--card-glow-border-spread) * 1px)",
		") border-box",
	].join(""),
	borderColor: "transparent",
	borderWidth: "calc(var(--card-glow-border-width) * 1px)",
	mask: "linear-gradient(#fff 0 100%) border-box, linear-gradient(#fff 0 100%) padding-box",
	maskComposite: "exclude",
	// How near the pointer this surface is, 1 at the surface and 0 at the edge
	// of its plane's reach. Unset — every consumer that does not opt into
	// proximity — resolves to 1 and the stroke behaves exactly as before.
	//
	// This is what lets reach and tracing coexist on a small surface. Widening
	// the gradient far enough to be seen from across a column also lights that
	// surface's whole ring, turning a traced arc into a plain border. Keeping
	// the gradient tight and fading the entire layer by distance instead means a
	// far row shows a faint arc and a near row a bright one.
	opacity: "var(--card-glow-proximity, 1)",
	WebkitMask: "linear-gradient(#fff 0 100%) border-box, linear-gradient(#fff 0 100%) padding-box",
	WebkitMaskComposite: "xor",
};

const CARD_GLOW_ACCENT_BLOOM_STYLE: CSSProperties = {
	backgroundColor: "var(--card-glow-tile-accent)",
	opacity: "var(--card-glow-icon-opacity)",
};

/**
 * The pointer-traced accent stroke plus the soft bloom behind it.
 *
 * Render inside a surface that is `relative isolate` and carries
 * {@link cardGlowSurfaceStyle}; every layer sits at `-z-[1]`, above the
 * surface's own background but below its in-flow content, so a consumer does
 * not have to lift each child into a positive stacking layer.
 *
 * `art` is the bloom source — pass the card's own artwork to duplicate it the
 * way the agent bento does. Omit it for identities whose mark is a monochrome
 * brand glyph: blurring near-black on white yields grey, so the fallback blooms
 * the accent itself and keeps the brand hue.
 *
 * The bloom never needs `overflow-hidden` on the surface; its own clip span
 * owns that, so hover-revealed controls inside the surface keep their focus
 * rings.
 */
export function CardGlowLayers({
	art,
	baseBorder = true,
	bloom = true,
	borderMaskStyle,
	className,
	stroke = true,
}: Readonly<{
	/** Bloom source, duplicated and blurred. Omit to bloom the accent colour instead. */
	art?: ReactNode;
	/** Paint the resting 1px grey ring the accent stroke traces over. */
	baseBorder?: boolean;
	/**
	 * Draw the soft accent wash behind the stroke. Turn it off for a surface
	 * that already owns its own fill feedback — a second wash on top of one
	 * fights it, and the traced stroke alone still carries the accent.
	 */
	bloom?: boolean;
	/**
	 * Mask applied to both ring layers together — for a surface whose own
	 * content fades out at an edge and whose border must fade with it.
	 */
	borderMaskStyle?: CSSProperties;
	className?: string;
	/**
	 * Draw the pointer-traced accent ring. The two layers are independent so a
	 * surface can carry the wash alone, the stroke alone, or both — turning the
	 * stroke off leaves the resting grey border (when `baseBorder`) untouched.
	 */
	stroke?: boolean;
}>) {
	const rings = (
		<>
			{baseBorder ? (
				<span
					aria-hidden
					className={cn(
						"pointer-events-none absolute inset-0 rounded-[inherit]",
						borderMaskStyle === undefined ? "-z-[1]" : null,
					)}
					data-card-glow-base-border
					style={CARD_GLOW_BASE_BORDER_STYLE}
				/>
			) : null}
			{stroke ? (
				<span
					aria-hidden
					className={cn(
						"pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] border border-transparent",
						borderMaskStyle === undefined ? "-z-[1]" : null,
					)}
					data-card-glow-border
					style={CARD_GLOW_BORDER_STYLE}
				/>
			) : null}
		</>
	);

	return (
		<>
			{bloom ? (
				<span
					aria-hidden
					className={cn(
						"pointer-events-none absolute inset-0 -z-[1] overflow-hidden rounded-[inherit]",
						className,
					)}
					data-card-glow-bloom
				>
					<span
						className="grid size-full transform-gpu place-items-center"
						style={CARD_GLOW_BLOOM_STYLE}
					>
						{art ?? (
							<span
								className="size-12 rounded-full"
								style={CARD_GLOW_ACCENT_BLOOM_STYLE}
							/>
						)}
					</span>
				</span>
			) : null}
			{borderMaskStyle === undefined ? rings : (
				<span
					aria-hidden
					className="pointer-events-none absolute inset-0 -z-[1] rounded-[inherit]"
					data-card-glow-border-mask
					style={borderMaskStyle}
				>
					{rings}
				</span>
			)}
		</>
	);
}
