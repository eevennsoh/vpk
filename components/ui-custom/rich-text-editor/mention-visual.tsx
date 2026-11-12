"use client";

import type { DOMOutputSpec } from "@tiptap/pm/model";

import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { IconTile } from "@/components/ui/icon-tile";
import { AtlassianLogo, type AtlassianLogoName } from "@/components/ui/logo";
import { AtlassianLogoMark, BrandLogoMark } from "@/components/ui/logo-mark";
import type { ThirdPartyLogoName } from "@/components/ui/data/logo-third-party-data";
import type { TagColor } from "@/components/ui/tag";
import { resolveBrandLogoPresentation } from "@/app/data/directory/brand-logos";
import { getDirectoryIcon } from "@/app/data/directory/visual";
import type { DirectoryIconKey } from "@/app/data/directory/types";
import { cn } from "@/lib/utils";

import type {
	RichTextMentionCategory,
	RichTextMentionVisual,
} from "./types";

/**
 * Single source of truth for the front-slot visual tile size in suggestion-menu
 * rows (both the `RichTextMentionVisualMark` paths here and the fallback
 * `IconTile` in `suggestion-menu.tsx`). Change this one value to resize every
 * menu-row avatar, image, logo tile, and icon tile together.
 */
export const MENU_VISUAL_TILE_SIZE = "medium" as const;

// Maps an icon's ADS color token to the closest `Tag` color so that mention
// tokens in the TipTap editor and reference chips in the agent config panel
// render with the same accent. Keep this the single source of truth — both
// surfaces resolve their tag color through `getRichTextMentionTagColor`.
const ICON_COLOR_TO_TAG_COLOR: Readonly<Record<string, TagColor>> = {
	"text-icon-brand": "blue",
	"text-icon-information": "blue",
	"text-icon-success": "green",
	"text-icon-discovery": "discovery",
	"text-icon-warning": "yellow",
	"text-icon-danger": "red",
	"text-icon-accent-red": "red",
	"text-icon-accent-orange": "orange",
	"text-icon-accent-yellow": "yellow",
	"text-icon-accent-lime": "lime",
	"text-icon-accent-green": "green",
	"text-icon-accent-teal": "teal",
	"text-icon-accent-blue": "blue",
	"text-icon-accent-purple": "purple",
	"text-icon-accent-magenta": "magenta",
	"text-icon-accent-gray": "gray",
	"text-yellow-400": "yellow",
};

/**
 * Resolves the `Tag` color for a mention visual. Returns the visual-derived
 * accent when available (icon color token), falling back to `"blue"` so the
 * mention reads as an interactive reference rather than a neutral gray chip —
 * matching the agent config panel reference chips.
 */
// react-doctor-disable-next-line react-doctor/only-export-components -- This component module intentionally exports colocated non-component API used by consumers.
export function getRichTextMentionTagColor(
	visual: RichTextMentionVisual | undefined,
): TagColor {
	if (visual?.kind === "icon" && visual.iconColor) {
		return ICON_COLOR_TO_TAG_COLOR[visual.iconColor] ?? "blue";
	}

	return "blue";
}

export interface RichTextMentionVisualAttrs {
	visualIconColor?: string | null;
	visualIconKey?: string | null;
	visualKind?: RichTextMentionVisual["kind"] | null;
	visualLogoName?: string | null;
	visualShape?: "circle" | "square" | "hexagon" | null;
	visualSrc?: string | null;
}

// react-doctor-disable-next-line react-doctor/only-export-components -- This component module intentionally exports colocated non-component API used by consumers.
export function getRichTextMentionVisualAttrs(
	visual: RichTextMentionVisual | undefined,
): RichTextMentionVisualAttrs {
	if (!visual) {
		return {};
	}

	if (visual.kind === "third-party") {
		return {
			visualKind: visual.kind,
			visualLogoName: visual.name,
		};
	}

	if (visual.kind === "logo") {
		return {
			visualKind: visual.kind,
			visualLogoName: visual.logoName,
		};
	}

	if (visual.kind === "icon") {
		return {
			visualIconColor: visual.iconColor,
			visualIconKey: visual.iconKey,
			visualKind: visual.kind,
		};
	}

	return {
		visualKind: visual.kind,
		visualShape: visual.shape,
		visualSrc: visual.src,
	};
}

// react-doctor-disable-next-line react-doctor/only-export-components -- This component module intentionally exports colocated non-component API used by consumers.
export function getRichTextMentionVisualFromAttrs(
	attrs: RichTextMentionVisualAttrs,
): RichTextMentionVisual | undefined {
	if (attrs.visualKind === "avatar" || attrs.visualKind === "image") {
		return attrs.visualSrc
			? {
					kind: attrs.visualKind,
					shape: attrs.visualShape ?? undefined,
					src: attrs.visualSrc,
				}
			: undefined;
	}

	if (attrs.visualKind === "third-party" && attrs.visualLogoName) {
		return {
			kind: "third-party",
			name: attrs.visualLogoName as ThirdPartyLogoName,
		};
	}

	if (attrs.visualKind === "logo" && attrs.visualLogoName) {
		return {
			kind: "logo",
			logoName: attrs.visualLogoName as AtlassianLogoName,
		};
	}

	if (attrs.visualKind === "icon" && attrs.visualIconKey) {
		return {
			kind: "icon",
			icon: getDirectoryIcon(attrs.visualIconKey as DirectoryIconKey),
			iconColor: attrs.visualIconColor ?? undefined,
			iconKey: attrs.visualIconKey,
		};
	}

	return undefined;
}

// react-doctor-disable-next-line react-doctor/only-export-components -- This component module intentionally exports colocated non-component API used by consumers.
export function getRichTextMentionTagType(
	visual: RichTextMentionVisual | undefined,
): "agent" | "default" | "other" | "user" {
	if (!visual) {
		return "default";
	}

	if (visual.kind === "avatar" && visual.shape === "circle") {
		return "user";
	}

	if (visual.kind === "avatar" && visual.shape === "hexagon") {
		return "agent";
	}

	return visual.kind === "icon" ? "default" : "other";
}

export function RichTextMentionVisualMark({
	category,
	className,
	label,
	size = "tag",
	visual,
}: Readonly<{
	category?: RichTextMentionCategory;
	className?: string;
	label: string;
	size?: "menu" | "menu-compact" | "pill" | "tag";
	visual: RichTextMentionVisual;
}>) {
	// Inside a "tag" (mention token) every visual kind must occupy the SAME 16px
	// box so avatars, images, logos, and icons line up — previously avatar=24px,
	// image=20px, icon=12px, which misaligned the chips. "pill" already matches at
	// 16px. "menu" (directory rows / autocomplete) renders the full 32px mark.
	// "menu-compact" renders a native 24px `small` mark for the 24px front slot in
	// suggestion-menu / trigger picker rows — drawn natively, NOT a scaled-down
	// 32px tile, so the glyph follows ADS's `small` Tile inset (14px) to match
	// /components/ui/logo. Scaling a 32px tile to 75% freezes the `medium` inset
	// and renders the glyph at 12px instead.
	const isMenu = size === "menu" || size === "menu-compact";
	const isCompactMenu = size === "menu-compact";
	const avatarSize = isCompactMenu ? "sm" : size === "menu" ? "default" : "xs";
	const menuTileSize = isCompactMenu ? "small" : MENU_VISUAL_TILE_SIZE;
	const menuLogoBoxClassName = isCompactMenu ? "size-6" : "size-8";

	if (visual.kind === "avatar") {
		// Menu rows keep the avatar's semi-opaque border (matching the avatar demo);
		// inline tag/pill chips strip it so the border doesn't clutter mid-sentence.
		return (
			<Avatar
				animate={!isCompactMenu}
				aria-hidden={true}
				className={cn(!isMenu && "after:border-0", className)}
				shape={visual.shape ?? (category === "subagent" ? "hexagon" : "circle")}
				size={avatarSize}
			>
				<AvatarImage alt="" aria-hidden={true} src={visual.src} />
			</Avatar>
		);
	}

	if (visual.kind === "image") {
		// 2P/3P brand logos — rendered through the shared `BrandLogoMark` so border
		// treatment, the borderless-variant swap (resolved from `logo-usage.json`),
		// and the size-scaled glyph fill stay identical to the `Logo` doc demos and
		// can never drift. Menu rows use the `Tile` frame: solid-fill logos fill
		// the tile, while bordered marks follow Tile's inset content scale. Inline
		// chips (tag/pill) use the 16px `chip` frame where bordered 2P/3P marks
		// read as a bare centered glyph.
		return isMenu ? (
			<BrandLogoMark
				className={className}
				frame="tile"
				label={label}
				size={menuTileSize}
				src={visual.src}
			/>
		) : (
			<BrandLogoMark className={className} frame="chip" label={label} src={visual.src} />
		);
	}

	if (visual.kind === "third-party") {
		// 3P brand → upstream package mark via the shared `BrandLogoMark` `name`
		// path. Menu rows use the tile frame; inline chips use the 16px chip frame.
		return isMenu ? (
			<BrandLogoMark className={className} frame="tile" label={label} name={visual.name} size={menuTileSize} />
		) : (
			<BrandLogoMark className={className} frame="chip" label={label} name={visual.name} />
		);
	}

	if (visual.kind === "logo") {
		// Most 1p product logos ship their own colored background, so in menu rows
		// they render as the bare lockup with no surface tile. The plain
		// "atlassian" mark has no background fill, so it keeps a bordered
		// `IconTile` whose glyph follows the tile's inset scale (14px in a 24px
		// `small` tile, 16px in a 32px `medium` tile), matching every other menu
		// tile and /components/ui/logo. Tags/pills keep the bare inline 16px logo.
		if (isMenu) {
			if (visual.logoName === "atlassian") {
				return (
					<IconTile
						aria-hidden={true}
						// IconTile clamps inner spans/svgs to the tile's inset size; the
						// Atlassian logo wraps its svg in spans, so this keeps the glyph at
						// the inset scale (14px small / 16px medium) inside the stroked tile.
						className={cn("border border-border bg-surface", className)}
						icon={
							<AtlassianLogo
								name={visual.logoName}
								size={menuTileSize}
								themeAware
								label={label}
							/>
						}
						label={label}
						size={menuTileSize}
					/>
				);
			}

			return (
				<span
					aria-hidden="true"
					className={cn(
						"inline-flex shrink-0 items-center justify-center [&>span]:size-full! [&_svg]:size-full!",
						menuLogoBoxClassName,
						className,
					)}
				>
					<AtlassianLogo name={visual.logoName} size={menuTileSize} themeAware label={label} />
				</span>
			);
		}

		// Inline tag/pill chips route 1P logos through the shared AtlassianLogoMark
		// chip frame — the same single-source-of-truth treatment as 2P/3P marks
		// (BrandLogoMark frame="chip"): backgroundless marks (the Atlassian master
		// logo + the Rovo family) inset to a centered 12px glyph, while solid product
		// logos fill the 16px box bare.
		return <AtlassianLogoMark className={className} frame="chip" label={label} name={visual.logoName} />;
	}

	if (visual.kind === "icon") {
		if (isMenu) {
			return (
				<IconTile
					aria-hidden={true}
					className={cn("border border-border bg-surface", visual.iconColor ?? "text-icon-subtle", className)}
					icon={visual.icon}
					label={label}
					size={menuTileSize}
				/>
			);
		}

		return (
			<IconTile
				aria-hidden={true}
				className={cn(visual.iconColor ?? "text-icon-subtle", className)}
				icon={<Icon aria-hidden render={visual.icon} />}
				label={label}
				size="xxsmall"
				variant="transparent"
			/>
		);
	}

	return null;
}

// react-doctor-disable-next-line react-doctor/only-export-components -- This component module intentionally exports colocated non-component API used by consumers.
export function getRichTextMentionVisualDOMSpec(
	visual: RichTextMentionVisual | undefined,
): DOMOutputSpec | null {
	if (!visual) {
		return null;
	}

	if (visual.kind === "avatar" || visual.kind === "image") {
		// Image (2P/3P brand) logos use the borderless variant in the fallback too,
		// so the non-React serialization matches the React mark. Avatars are not
		// brand logos, so their src is passed through unchanged.
		const src =
			visual.kind === "image"
				? resolveBrandLogoPresentation(visual.src).src
				: visual.src;
		return [
			"span",
			{
				"aria-hidden": "true",
				class: "rich-text-mention-visual",
				"data-visual-kind": visual.kind,
				"data-visual-shape": visual.shape ?? undefined,
			},
			["img", { alt: "", src }],
		];
	}

	if (visual.kind === "third-party") {
		return [
			"span",
			{
				"aria-hidden": "true",
				class: "rich-text-mention-visual rich-text-mention-logo-fallback",
				"data-visual-kind": visual.kind,
			},
			visual.name.slice(0, 1).toUpperCase(),
		];
	}

	if (visual.kind === "logo") {
		return [
			"span",
			{
				"aria-hidden": "true",
				class: "rich-text-mention-visual rich-text-mention-logo-fallback",
				"data-visual-kind": visual.kind,
			},
			visual.logoName.slice(0, 1).toUpperCase(),
		];
	}

	return [
		"span",
		{
			"aria-hidden": "true",
			class: "rich-text-mention-visual rich-text-mention-icon-fallback",
			"data-visual-kind": visual.kind,
		},
		"",
	];
}
