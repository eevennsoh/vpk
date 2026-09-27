"use client";

// oxlint-disable react-doctor/no-multi-comp -- This module intentionally colocates coupled component parts as a compound component or demo surface API.

// oxlint-disable react-doctor/prefer-tag-over-role -- This file uses ARIA roles for custom generated visuals or composite widgets where the suggested native tag would change semantics or behavior.

import * as React from "react";
import Image from "next/image";
import { type LogoProps as AtlaskitLogoProps } from "@atlaskit/logo";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/utils/theme-wrapper";
import { useIsMounted } from "@/components/hooks/use-is-mounted";
import {
	type AtlassianLogoName,
	LOGO_ICON_COMPONENTS,
	LOGO_LOCKUP_COMPONENTS,
	LOGO_TILE_SIZES,
	CUSTOM_LOGO_SIZES,
} from "@/components/ui/data/logo-data";
import {
	darkModeGlyphContrastClassNameForSrc,
	resolveAtlassianLogoBorder,
	resolveBrandLogoInsetScale,
	resolveBrandLogoPresentation,
} from "@/components/ui/data/logo-usage";
import { ROVO_LOGO_PATHS, ROVO_LOGO_VIEWBOX } from "@/components/ui/data/rovo-logo";
import { Tile, type TileProps } from "@/components/ui/tile";

export { ROVO_LOGO_DATA_URI } from "@/components/ui/data/rovo-logo";
export { ATLASSIAN_LOGO_SOURCE, LOGO_TILE_SIZES, isAtlassianLogoSource } from "@/components/ui/data/logo-data";
export type { AtlassianLogoName };
export type LogoVariant = "icon" | "lockup";
export type LogoSize = NonNullable<TileProps["size"]>;

export interface LogoProps extends Omit<AtlaskitLogoProps, "size"> {
	color?: string;
	size?: LogoSize;
	themeAware?: boolean;
	variant?: LogoVariant;
	shouldUseHexLogo?: boolean;
	/**
	 * Draws a 1px hairline directly on the logo mark's edge (inset ring, no
	 * added size) so adjacent same-color marks stay visually separated — e.g.
	 * blue Jira over blue Confluence in an overlapping stack. Defaults to off.
	 */
	hasBorder?: boolean;
	/**
	 * Opt in to the centralized usage metadata's border treatment
	 * (logo-usage.json): the Atlassian master logo gets a bordered tile while
	 * solid-background product logos stay bare. Use this for standalone brand
	 * tiles; leave it off when the logo is already wrapped in an avatar/cover.
	 * An explicit `hasBorder` always wins. Defaults to off.
	 */
	withUsageBorder?: boolean;
}

export interface AtlassianLogoProps extends LogoProps {
	name: AtlassianLogoName;
}

function getThemeAwareAppearance(
	appearance: AtlaskitLogoProps["appearance"],
	themeAware: boolean,
	actualTheme: "light" | "dark"
): AtlaskitLogoProps["appearance"] {
	if (appearance) {
		return appearance;
	}

	if (!themeAware) {
		return undefined;
	}

	return actualTheme === "dark" ? "inverse" : "brand";
}

function getLogoSizePx(size: LogoSize | undefined): number {
	return size ? CUSTOM_LOGO_SIZES[size] ?? CUSTOM_LOGO_SIZES.small : CUSTOM_LOGO_SIZES.small;
}

export function AtlassianLogo({
	name,
	themeAware = true,
	appearance,
	size = "small",
	variant = "icon",
	shouldUseNewLogoDesign = true,
	hasBorder,
	withUsageBorder = false,
	color,
	...props
}: Readonly<AtlassianLogoProps>) {
	const isMounted = useIsMounted();
	const { actualTheme } = useTheme();
	const components = variant === "lockup" ? LOGO_LOCKUP_COMPONENTS : LOGO_ICON_COMPONENTS;
	const Component = components[name];
	const resolvedAppearance = getThemeAwareAppearance(appearance, themeAware, actualTheme);
	void color;

	// Border treatment is documented in the centralized usage metadata
	// (logo-usage.json, via `resolveAtlassianLogoBorder`): solid-background
	// product marks render bare, the Atlassian master logo wants a bordered tile.
	// We only apply it when the caller opts in via `withUsageBorder` (or sets
	// `hasBorder` explicitly) — many call sites already wrap the logo in their own
	// avatar/hexagon/cover, where an unconditional square tile would be wrong.
	// Lockups (icon + wordmark) are never tiled.
	const resolvedHasBorder =
		hasBorder ?? (withUsageBorder && variant !== "lockup" ? resolveAtlassianLogoBorder(name) : false);

	const needsDarkFix = !appearance && actualTheme === "dark" && resolvedAppearance === "inverse";
	const placeholderSize = getLogoSizePx(size);
	// Hairline drawn as an outline with a negative offset: it sits 1px inside the
	// mark's edge and — unlike an inset ring/box-shadow, which renders *behind*
	// content — outlines paint on top of the filled logo svg, so it stays visible.
	const borderClassName = resolvedHasBorder && "rounded-tile [outline:1px_solid_var(--color-border)] [outline-offset:-1px]";

	if (!isMounted) {
		return (
			<span className={cn("inline-flex shrink-0 items-center", borderClassName, needsDarkFix && "ads-logo-inverse")}>
				<span
					aria-hidden
					className="inline-block shrink-0"
					style={{ width: placeholderSize, height: placeholderSize }}
				/>
			</span>
		);
	}

	return (
		<span className={cn("inline-flex shrink-0 items-center", borderClassName, needsDarkFix && "ads-logo-inverse")}>
			<Component
				{...props}
				size={size}
				appearance={resolvedAppearance}
				shouldUseNewLogoDesign={shouldUseNewLogoDesign}
			/>
		</span>
	);
}

/* -- Custom Logo ------------------------------------------------- */

export interface CustomLogoProps {
	/**
	 * Custom SVG or image element to render as the logo icon. Provide either
	 * `svg` (an inline element you control) or `src` (a 2P/3P brand asset path
	 * that gets auto-resolved against `logo-usage.json`).
	 */
	svg?: React.ReactElement<{ width?: number; height?: number; "aria-hidden"?: boolean }>;
	/**
	 * Brand asset path for a 2P partner mark (e.g. `/2p/appfire.png`) or a custom
	 * project avatar (`/avatar-project/…`). Border treatment and any borderless
	 * variant swap are applied automatically from the centralized usage metadata.
	 *
	 * Third-party (3P) brands do NOT flow through here from app code — render them
	 * with `LogoThirdParty` (package-backed). `LogoThirdParty` alone reuses this
	 * component for its package-less `public/3p` fallback.
	 */
	src?: string;
	/** Optional wordmark text displayed beside the icon */
	wordmark?: string;
	/** Logo size */
	size?: LogoProps["size"];
	/** Accessible label */
	label?: string;
	/** Render only the mark, without a containing tile or outline. */
	borderless?: boolean;
	/** Additional CSS classes */
	className?: string;
}

function isTileLogoSize(size: LogoProps["size"]): size is NonNullable<TileProps["size"]> {
	return typeof size === "string" && LOGO_TILE_SIZES.includes(size);
}

export function CustomLogo({
	svg,
	src,
	wordmark,
	size = "small",
	label,
	borderless = false,
	className,
}: Readonly<CustomLogoProps>) {
	const px = getLogoSizePx(size ?? "small");

	// `src` brand assets resolve their variant + border treatment from the
	// centralized usage metadata (logo-usage.json): bare 2P PNGs and white-tile
	// 3P marks get a bordered tile (swapping to the borderless glyph so borders
	// don't double up); solid-fill 3P marks render bare.
	const brand = src ? resolveBrandLogoPresentation(src) : null;
	// Some full-bleed 3P marks are tagged to render inset inside their box (e.g.
	// VS Code: a 20px glyph centered in the 24px box). The wrapper keeps the full
	// `px` footprint so it aligns with sibling logos; only the glyph shrinks.
	const insetScale = src ? resolveBrandLogoInsetScale(src) : 1;
	const insetPx = Math.round(px * insetScale);
	// Custom-app art (project avatars) are full-bleed square tiles, so soften the
	// corners with the 8px (radius.large) tile radius. Brand marks are unaffected.
	const isCustomAvatar = Boolean(src && src.startsWith("/avatar-project/"));
	// A monochrome near-black 3P mark is invisible on the themed `bg-surface`
	// tile below (and on any dark surface when rendered bare), so invert just the
	// glyph image in dark mode. The Tile keeps its own fill — inverting the Tile
	// instead would flip the surface back to near-white.
	const glyphContrastClassName = darkModeGlyphContrastClassNameForSrc(brand?.src ?? src);
	const shouldRenderBorderedTile = Boolean(!borderless && brand?.hasBorder && isTileLogoSize(size));
	const borderedTileSrc = shouldRenderBorderedTile ? brand?.src : undefined;
	const borderClassName =
		!borderless && brand?.hasBorder && !shouldRenderBorderedTile &&
		"rounded-tile [outline:1px_solid_var(--color-border)] [outline-offset:-1px]";

	const icon = borderedTileSrc ? (
		<Tile
			aria-hidden
			className="bg-surface"
			hasBorder
			label={label ?? ""}
			size={size}
			variant="transparent"
		>
			<Image
				src={borderedTileSrc}
				alt=""
				aria-hidden
				width={px}
				height={px}
				className={cn("object-contain", glyphContrastClassName)}
			/>
		</Tile>
	) : brand ? (
		<Image
			src={brand.src}
			alt=""
			aria-hidden
			width={insetPx}
			height={insetPx}
			className={cn("object-contain", isCustomAvatar && "rounded-lg", glyphContrastClassName)}
			style={{ width: insetPx, height: insetPx }}
		/>
	) : svg ? (
		React.cloneElement(svg, { width: px, height: px, "aria-hidden": true })
	) : null;

	return (
		<span
			role="img"
			aria-label={label}
			className={cn("inline-flex items-center gap-1", className)}
		>
			<span
				className={cn(
					"inline-flex shrink-0 items-center justify-center",
					borderClassName,
				)}
				style={{ width: px, height: px }}
			>
				{icon}
			</span>
			{wordmark ? (
				<span
					className="font-semibold leading-none text-text"
					style={{ fontSize: Math.max(12, px * 0.6) }}
				>
					{wordmark}
				</span>
			) : null}
		</span>
	);
}

/* -- Rovo color mark --------------------------------------------- */

export interface RovoColorIconProps extends Omit<React.ComponentProps<"svg">, "size"> {
	/** Logo size — same scale as the other logo components. */
	size?: LogoProps["size"];
	/**
	 * Accessible label. When provided the svg is exposed as an image with this
	 * name; when omitted it is hidden from assistive tech (decorative).
	 */
	label?: string;
}

/**
 * The special multi-color Rovo brand mark (yellow / blue / purple / green),
 * inlined from `data/rovo-logo.ts`. Unlike `RovoIcon`/`RovoLogo` (the ADS
 * single-tone marks from `@atlaskit/logo`), this renders the full-color brand
 * artwork that used to live at `public/1p/rovo.svg`.
 */
export function RovoColorIcon({
	size = "small",
	label,
	className,
	...props
}: Readonly<RovoColorIconProps>) {
	const px = getLogoSizePx(size);

	return (
		<svg
			width={px}
			height={px}
			viewBox={ROVO_LOGO_VIEWBOX}
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			role={label ? "img" : undefined}
			aria-label={label}
			aria-hidden={label ? undefined : true}
			className={cn("inline-block shrink-0", className)}
			{...props}
		>
			{ROVO_LOGO_PATHS.map((path) => (
				<path
					key={path.fill + path.d}
					d={path.d}
					fill={path.fill}
					fillRule={path.evenOdd ? "evenodd" : undefined}
					clipRule={path.evenOdd ? "evenodd" : undefined}
				/>
			))}
		</svg>
	);
}

export function RovoColorLogo(props: Readonly<RovoColorIconProps>) { return <RovoColorIcon {...props} />; }

export interface RovoAppIconProps extends Omit<TileProps, "children" | "label" | "variant" | "isInset" | "isSnug" | "hasBorder"> {
	/** Accessible name; omit for a decorative app icon. */
	label?: string;
}

/** Full-color Rovo mark in an app tile, using the Rovo button's background. */
export function RovoAppIcon({
	size = "small",
	label,
	className,
	...props
}: Readonly<RovoAppIconProps>) {
	return (
		<Tile
			{...props}
			label={label ?? ""}
			role={label ? "img" : undefined}
			aria-hidden={label ? undefined : true}
			size={size}
			variant="transparent"
			className={cn("bg-bg-neutral-bold", className)}
		>
			<RovoColorIcon size={size ?? "small"} />
		</Tile>
	);
}

/* -- Named product exports --------------------------------------- */

export function AdminIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="admin" {...props} />; }
export function AlignIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="align" {...props} />; }
export function AnalyticsIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="analytics" {...props} />; }
export function AssetsIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="assets" {...props} />; }
export function AtlassianBrandIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="atlassian" {...props} />; }
export function AtlassianAdministrationIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="atlassian-administration" {...props} />; }
export function AtlassianAnalyticsIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="atlassian-analytics" {...props} />; }
export function BambooIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="bamboo" {...props} />; }
export function BitbucketIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="bitbucket" {...props} />; }
export function BitbucketDataCenterIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="bitbucket-data-center" {...props} />; }
export function ChatIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="chat" {...props} />; }
export function CompassIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="compass" {...props} />; }
export function ConfluenceIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="confluence" {...props} />; }
export function ConfluenceDataCenterIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="confluence-data-center" {...props} />; }
export function CrowdIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="crowd" {...props} />; }
export function CustomerServiceManagementIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="customer-service-management" {...props} />; }
export function DxIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="dx" {...props} />; }
export function FeedbackIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="feedback" {...props} />; }
export function FocusIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="focus" {...props} />; }
export function GoalsIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="goals" {...props} />; }
export function GuardIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="guard" {...props} />; }
export function HomeIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="home" {...props} />; }
export function HubIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="hub" {...props} />; }
export function JiraIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="jira" {...props} />; }
export function JiraAlignIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="jira-align" {...props} />; }
export function JiraDataCenterIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="jira-data-center" {...props} />; }
export function JiraProductDiscoveryIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="jira-product-discovery" {...props} />; }
export function JiraServiceManagementIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="jira-service-management" {...props} />; }
export function JiraServiceManagementDataCenterIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="jira-service-management-data-center" {...props} />; }
export function LoomIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="loom" {...props} />; }
export function LoomAttributionIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="loom-attribution" {...props} />; }
export function OpsgenieIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="opsgenie" {...props} />; }
export function ProjectsIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="projects" {...props} />; }
export function RovoIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="rovo" {...props} />; }
export function RovoDevIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="rovo-dev" {...props} />; }
export function RovoDevAgentIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="rovo-dev-agent" {...props} />; }
export function SearchIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="search" {...props} />; }
export function StatuspageIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="statuspage" {...props} />; }
export function StudioIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="studio" {...props} />; }
export function TalentIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="talent" {...props} />; }
export function TeamsIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="teams" {...props} />; }
export function TrelloIcon(props: Readonly<LogoProps>) { return <AtlassianLogo name="trello" {...props} />; }

export function AdminLogo(props: Readonly<LogoProps>) { return <AdminIcon {...props} />; }
export function AlignLogo(props: Readonly<LogoProps>) { return <AlignIcon {...props} />; }
export function AnalyticsLogo(props: Readonly<LogoProps>) { return <AnalyticsIcon {...props} />; }
export function AssetsLogo(props: Readonly<LogoProps>) { return <AssetsIcon {...props} />; }
export function AtlassianBrandLogo(props: Readonly<LogoProps>) { return <AtlassianBrandIcon {...props} />; }
export function AtlassianAdministrationLogo(props: Readonly<LogoProps>) { return <AtlassianAdministrationIcon {...props} />; }
export function AtlassianAnalyticsLogo(props: Readonly<LogoProps>) { return <AtlassianAnalyticsIcon {...props} />; }
export function BambooLogo(props: Readonly<LogoProps>) { return <BambooIcon {...props} />; }
export function BitbucketLogo(props: Readonly<LogoProps>) { return <BitbucketIcon {...props} />; }
export function BitbucketDataCenterLogo(props: Readonly<LogoProps>) { return <BitbucketDataCenterIcon {...props} />; }
export function ChatLogo(props: Readonly<LogoProps>) { return <ChatIcon {...props} />; }
export function CompassLogo(props: Readonly<LogoProps>) { return <CompassIcon {...props} />; }
export function ConfluenceLogo(props: Readonly<LogoProps>) { return <ConfluenceIcon {...props} />; }
export function ConfluenceDataCenterLogo(props: Readonly<LogoProps>) { return <ConfluenceDataCenterIcon {...props} />; }
export function CrowdLogo(props: Readonly<LogoProps>) { return <CrowdIcon {...props} />; }
export function CustomerServiceManagementLogo(props: Readonly<LogoProps>) { return <CustomerServiceManagementIcon {...props} />; }
export function FeedbackLogo(props: Readonly<LogoProps>) { return <FeedbackIcon {...props} />; }
export function FocusLogo(props: Readonly<LogoProps>) { return <FocusIcon {...props} />; }
export function GoalsLogo(props: Readonly<LogoProps>) { return <GoalsIcon {...props} />; }
export function GuardLogo(props: Readonly<LogoProps>) { return <GuardIcon {...props} />; }
export function HomeLogo(props: Readonly<LogoProps>) { return <HomeIcon {...props} />; }
export function HubLogo(props: Readonly<LogoProps>) { return <HubIcon {...props} />; }
export function JiraLogo(props: Readonly<LogoProps>) { return <JiraIcon {...props} />; }
export function JiraAlignLogo(props: Readonly<LogoProps>) { return <JiraAlignIcon {...props} />; }
export function JiraDataCenterLogo(props: Readonly<LogoProps>) { return <JiraDataCenterIcon {...props} />; }
export function JiraProductDiscoveryLogo(props: Readonly<LogoProps>) { return <JiraProductDiscoveryIcon {...props} />; }
export function JiraServiceManagementLogo(props: Readonly<LogoProps>) { return <JiraServiceManagementIcon {...props} />; }
export function JiraServiceManagementDataCenterLogo(props: Readonly<LogoProps>) { return <JiraServiceManagementDataCenterIcon {...props} />; }
export function LoomLogo(props: Readonly<LogoProps>) { return <LoomIcon {...props} />; }
export function LoomAttributionLogo(props: Readonly<LogoProps>) { return <LoomAttributionIcon {...props} />; }
export function OpsgenieLogo(props: Readonly<LogoProps>) { return <OpsgenieIcon {...props} />; }
export function ProjectsLogo(props: Readonly<LogoProps>) { return <ProjectsIcon {...props} />; }
export function RovoLogo(props: Readonly<LogoProps>) { return <RovoIcon {...props} />; }
export function RovoDevLogo(props: Readonly<LogoProps>) { return <RovoDevIcon {...props} />; }
export function RovoDevAgentLogo(props: Readonly<LogoProps>) { return <RovoDevAgentIcon {...props} />; }
export function SearchLogo(props: Readonly<LogoProps>) { return <SearchIcon {...props} />; }
export function StatuspageLogo(props: Readonly<LogoProps>) { return <StatuspageIcon {...props} />; }
export function StudioLogo(props: Readonly<LogoProps>) { return <StudioIcon {...props} />; }
export function TalentLogo(props: Readonly<LogoProps>) { return <TalentIcon {...props} />; }
export function TeamsLogo(props: Readonly<LogoProps>) { return <TeamsIcon {...props} />; }
export function TrelloLogo(props: Readonly<LogoProps>) { return <TrelloIcon {...props} />; }
