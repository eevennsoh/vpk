// oxlint-disable react-doctor/no-multi-comp -- This module intentionally colocates coupled component parts as a compound component or demo surface API.

import { Tile, type TileProps } from "@/components/ui/tile";
import {
	getThirdPartyLogoIconFromSrc,
	THIRD_PARTY_LOGO_ICONS,
} from "@/components/ui/data/logo-third-party-icons";
import {
	isLocalAssetThirdPartyLogoName,
	thirdPartyLogoSrc,
	type ThirdPartyLogoName,
} from "@/components/ui/data/logo-third-party-data";
import { AtlassianLogo, type AtlassianLogoName } from "@/components/ui/logo";
import {
	darkModeGlyphContrastClassNameForSrc,
	isBackgroundlessAtlassianLogo,
	resolveAtlassianLogoBorder,
	resolveBrandLogoInsetScale,
	resolveBrandLogoPresentation,
} from "@/components/ui/data/logo-usage";
import { cn } from "@/lib/utils";

/**
 * Shared renderers for brand logo marks — the single source of truth for how a
 * brand asset is drawn inside a `Tile` (picker / suggestion-menu rows, e.g. the
 * editor-palette) or a `Tag` / inline chip (e.g. the agent config panel
 * reference chips).
 *
 * Border treatment + the borderless-variant swap are resolved from
 * `logo-usage.json` via {@link resolveBrandLogoPresentation} — never wire borders
 * per call site. Both consumers (the production `mention-visual` marks and the
 * `Logo` component doc demos) render through this component so they can never
 * drift.
 *
 * Two frames:
 *
 * - `frame="tile"` — renders a `Tile` at the given size. Solid-fill 3P marks
 *   already include their own tile/background, so they fill the full Tile box.
 *   Bordered marks (bare 2P PNGs, white-tile 3P) sit on a surface tile and
 *   follow `Tile`'s inset child scale.
 * - `frame="chip"` — renders a fixed 16px box for inline chips. Solid-fill 3P
 *   marks fill the box; bordered marks render as a centered 12px glyph with no
 *   tile/border so they read as a bare mark mid-sentence.
 */

export interface BrandLogoMarkProps {
	/**
	 * A 2P partner asset path (e.g. `/2p/appfire.png`). For third-party (3P)
	 * brands, prefer `name` — it renders the upstream `@atlassian/logo-third-party`
	 * mark and keeps `public/3p` paths out of call sites.
	 */
	src?: string;
	/**
	 * Third-party brand id (e.g. `"slack"`). Renders the upstream package mark via
	 * {@link THIRD_PARTY_LOGO_ICONS}. Use this for all 3P brands instead of `src`.
	 */
	name?: ThirdPartyLogoName;
	/** Accessible label forwarded to the underlying `Tile` (chips ignore it). */
	label: string;
	/**
	 * `"tile"` for picker / menu rows (default), `"chip"` for inline tag/pill
	 * chips.
	 */
	frame?: "tile" | "chip";
	/** `Tile` size when `frame="tile"`. Ignored for `"chip"`. */
	size?: NonNullable<TileProps["size"]>;
	/**
	 * Drop the border + surface fill so the mark sits in a bare transparent `Tile`
	 * (the `components/ui/tile#transparent` treatment). Still swaps white-tile 3P
	 * marks to their borderless glyph so no white square shows. For low-chrome
	 * attribution rows (skill / entity card publisher logos). `frame="tile"` only.
	 */
	transparent?: boolean;
	className?: string;
}

export interface AtlassianLogoMarkProps {
	/** Atlassian 1P product or company logo name. */
	name: AtlassianLogoName;
	/** Accessible label forwarded to the logo/tile wrapper. */
	label: string;
	/**
	 * `"tile"` (default) for picker / menu rows; `"chip"` for inline tag/pill
	 * chips. Mirrors {@link BrandLogoMarkProps.frame} so 1P and 2P/3P marks share
	 * one inline-chip API. `"chip"` ignores `size`/`transparent`.
	 */
	frame?: "tile" | "chip";
	/** `Tile`/logo size. Ignored for `frame="chip"`. */
	size?: NonNullable<TileProps["size"]>;
	/**
	 * Drop the border + surface fill so the mark sits in a bare transparent `Tile`
	 * (the `components/ui/tile#transparent` treatment). For low-chrome attribution
	 * rows (skill / entity card publisher logos). `frame="tile"` only.
	 */
	transparent?: boolean;
	className?: string;
}

export interface AtlassianLogoGlyphProps {
	/** Atlassian 1P product or company logo name. */
	name: AtlassianLogoName;
	/** Logo glyph size forwarded to `AtlassianLogo`. */
	size?: NonNullable<TileProps["size"]>;
	className?: string;
}

export function AtlassianLogoGlyph({
	name,
	size = "xlarge",
	className,
}: Readonly<AtlassianLogoGlyphProps>) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"inline-flex shrink-0 items-center justify-center [&>span]:!size-full [&_svg]:!size-full",
				className,
			)}
		>
			<AtlassianLogo label="" name={name} size={size} themeAware />
		</span>
	);
}

export function AtlassianLogoMark({
	name,
	label,
	frame = "tile",
	size = "medium",
	className,
	transparent = false,
}: Readonly<AtlassianLogoMarkProps>) {
	if (frame === "chip") {
		// Mirrors BrandLogoMark frame="chip": a fixed 16px box. Backgroundless 1P
		// marks (the Atlassian master logo + the Rovo family) inset to a centered
		// 12px glyph — the IconTile-transparent treatment — while solid product
		// marks (Jira, Confluence, …) fill the full box. No tile/border so they
		// read as a bare mark mid-sentence.
		//
		// The mark always renders at its native `xxsmall` (16px); only the
		// backgroundless case is clamped down to 12px. Rendering a larger size and
		// shrinking it via CSS left the glyph overflowing/misaligned in the chip, so
		// we let the native 16px mark fill the box and clamp only when inset.
		const isBackgroundless = isBackgroundlessAtlassianLogo(name);
		return (
			<span
				aria-hidden="true"
				className={cn(
					"inline-flex size-4 shrink-0 items-center justify-center",
					// Clamp the inset glyph to 12px. `AtlassianLogo` nests its sized span
					// one level below its own wrapper, so a direct-child `[&>span]`
					// selector misses it and the glyph keeps atlaskit's native 16px
					// height (rendering 12×16 and sitting off-center). Use a descendant
					// selector so every wrapper span is squared to 12.
					isBackgroundless && "[&_span]:size-3! [&_svg]:size-3!",
					className,
				)}
			>
				<AtlassianLogo label="" name={name} size="xxsmall" themeAware />
			</span>
		);
	}

	if (transparent) {
		return (
			<Tile
				aria-hidden
				className={className}
				label={label}
				size={size}
				variant="transparent"
			>
				<AtlassianLogo label="" name={name} size={size} themeAware />
			</Tile>
		);
	}

	const hasBorder = resolveAtlassianLogoBorder(name);

	if (!hasBorder) {
		const logo = (
			<AtlassianLogo
				label={label}
				name={name}
				size={size}
				themeAware
			/>
		);

		return className ? <span className={cn("inline-flex", className)}>{logo}</span> : logo;
	}

	return (
		<Tile
			aria-hidden
			className={cn("bg-surface", className)}
			hasBorder
			label={label}
			size={size}
			variant="transparent"
		>
			<AtlassianLogo label="" name={name} size={size} themeAware />
		</Tile>
	);
}

export function BrandLogoMark({
	src,
	name,
	label,
	frame = "tile",
	size = "medium",
	className,
	transparent = false,
}: Readonly<BrandLogoMarkProps>) {
	// Prefer the upstream `@atlassian/logo-third-party` mark: by `name` for 3P
	// brands, or resolved from a legacy `/3p` `src`. The package always renders a
	// white bordered `Tile`, so it maps cleanly onto the tile/chip frames but NOT
	// the borderless `transparent` low-chrome treatment — that keeps the local
	// `public/3p` asset below (asset path only; package brands have no such variant).
	const ThirdPartyIcon = name
		? THIRD_PARTY_LOGO_ICONS[name]
		: transparent
			? undefined
			: getThirdPartyLogoIconFromSrc(src ?? "");
	const packageGlyphContrastClassName = name === "github" ? "dark:[&_svg]:invert" : undefined;
	if (ThirdPartyIcon) {
		if (frame === "chip") {
			// A 3P mark reads as a bare inline glyph filling the 16px chip box — no
			// white tile/border — so it doesn't double up borders inside a bordered
			// container. The package mark is a transparent glyph wrapped in an
			// `@atlaskit/tile` at `xxsmall` (16px); its `@compiled` chrome is unlayered,
			// so strip the background + border with `!important` and let the glyph fill
			// the box at its native 16px (no inset).
			return (
				<span
					aria-hidden="true"
					className={cn(
						"inline-flex size-4 shrink-0 items-center justify-center align-middle",
						"[&>span]:bg-transparent! [&>span]:border-0!",
						packageGlyphContrastClassName,
						className,
					)}
				>
					<ThirdPartyIcon label="" size="xxsmall" />
				</span>
			);
		}

		const icon = <ThirdPartyIcon label={label} size={size} />;
		return className ? <span className={cn("inline-flex", className)}>{icon}</span> : icon;
	}

	// Asset path: an explicit `src`, or the local `public/3p` fallback for a
	// package-less 3P `name` (the only brands without an upstream icon).
	const assetSrc =
		src ?? (name && isLocalAssetThirdPartyLogoName(name) ? thirdPartyLogoSrc(name) : undefined);
	if (!assetSrc) {
		return null;
	}

	const presentation = resolveBrandLogoPresentation(assetSrc);
	// Monochrome near-black marks vanish on the themed `bg-surface` tile below and
	// on whatever surface a bare chip sits on, so invert the glyph itself in dark
	// mode. Never the Tile — that would flip the surface back to near-white.
	const glyphContrastClassName = darkModeGlyphContrastClassNameForSrc(presentation.src);

	if (frame === "chip") {
		return (
			<span
				aria-hidden="true"
				className={cn(
					"inline-flex size-4 shrink-0 items-center justify-center align-middle",
					className,
				)}
			>
				{/* eslint-disable-next-line @next/next/no-img-element -- brand asset; alignment-critical sizing handled here */}
				<img
					alt=""
					aria-hidden
					src={presentation.src}
					className={cn(
						"block object-contain",
						presentation.hasBorder ? "size-3" : "size-4",
						glyphContrastClassName,
					)}
				/>
			</span>
		);
	}

	const bordered = presentation.hasBorder && !transparent;

	return (
		<Tile
			aria-hidden
			label={label}
			size={size}
			variant="transparent"
			isInset={presentation.hasBorder && resolveBrandLogoInsetScale(assetSrc) === 1}
			hasBorder={bordered}
			className={cn(
				bordered && "bg-surface",
				className,
			)}
		>
			{/* eslint-disable-next-line @next/next/no-img-element -- Tile child-sizing CSS targets [&_img]; mirrors mention-visual.tsx */}
			<img alt="" aria-hidden className={cn("object-contain", glyphContrastClassName)} src={presentation.src} />
		</Tile>
	);
}
