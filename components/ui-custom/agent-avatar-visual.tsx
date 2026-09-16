"use client";

import type { ReactNode } from "react";

import { Avatar, AvatarFallback, AvatarImage, type AvatarProps, type AvatarStatus } from "@/components/ui/avatar";
import { AtlassianLogo, RovoColorIcon, type AtlassianLogoName, type LogoProps } from "@/components/ui/logo";
import { LogoThirdParty } from "@/components/ui/logo-third-party";
import type { ThirdPartyLogoName } from "@/components/ui/data/logo-third-party-data";
import { cn } from "@/lib/utils";

/** Maps a square pixel size to the nearest ADS logo size token. */
const PX_TO_LOGO_SIZE: Record<number, LogoProps["size"]> = {
	16: "xxsmall",
	20: "xsmall",
	24: "small",
	32: "medium",
	40: "large",
	48: "xlarge",
};

/** Maps a square pixel size to the nearest Avatar size token. */
const PX_TO_AVATAR_SIZE: Record<number, NonNullable<AvatarProps["size"]>> = {
	12: "xxs",
	16: "xs",
	20: "sm",
	24: "sm",
	30: "default",
	32: "default",
	40: "lg",
	48: "xl",
};

/** Agent brand marks stay inset while the hexagon owns the visible frame. */
const PX_TO_INSET_LOGO_SIZE: Record<number, LogoProps["size"]> = {
	16: "xxsmall",
	20: "xxsmall",
	24: "xsmall",
	30: "xsmall",
	32: "xsmall",
	40: "xsmall",
	48: "small",
};

/** Third-party marks use a larger 24px glyph in directory and docs avatars. */
const PX_TO_EXTERNAL_LOGO_SIZE: Record<number, LogoProps["size"]> = {
	16: "xxsmall",
	20: "xxsmall",
	24: "small",
	30: "small",
	32: "small",
	40: "small",
	48: "small",
};

const PX_TO_INSET_IMAGE_CLASS_NAME: Record<number, string> = {
	12: "size-2",
	16: "size-3",
	20: "size-3",
	24: "size-5",
	30: "size-5",
	32: "size-5",
	40: "size-5",
	48: "size-5",
};

/** Pixel footprints between Avatar tokens retain their exact outer frame. */
const PX_TO_AVATAR_FRAME_CLASS_NAME: Partial<Record<number, string>> = {
	30: "size-7.5",
};

const avatarSizeFromPx = (px: number): NonNullable<AvatarProps["size"]> => PX_TO_AVATAR_SIZE[px] ?? "sm";

export interface AgentAvatarVisualProps {
	avatarSrc?: string;
	/** Disable the shared avatar enter and hover motion for instant surfaces. */
	animate?: boolean;
	/** Render a full-color VPK product mark instead of image-backed agent art. */
	vpkLogo?: "rovo";
	/** When set, renders the ADS brand logo instead of an `avatarSrc` image. */
	logoName?: AtlassianLogoName;
	/** When set, renders the upstream `@atlassian/logo-third-party` mark (3P brands). */
	brandName?: ThirdPartyLogoName;
	label?: string;
	/** Square pixel size for both the image and the logo. */
	sizePx: number;
	/** Inset an image mark instead of rendering it full-bleed. `/2p/` assets are inset automatically. */
	inset?: boolean;
	/** Initials shown when no visual source is available. */
	fallbackText?: string;
	/** Agent status overlay. Use `needs-input` or `finished`. */
	status?: AvatarStatus;
	/** Avatar overlays such as company or project badges. */
	children?: ReactNode;
	avatarClassName?: string;
	className?: string;
	loading?: "eager" | "lazy";
}

/**
 * Renders every agent identity through the shared hexagon avatar. 1P agent art
 * stays full-bleed; 2P partner marks are inset from `/public/2p`; and 3P marks
 * use the borderless glyph from `@atlassian/logo-third-party`.
 *
 * External marks sit on a themed `--ds-surface` backdrop rather than a hardcoded
 * white one, so the hexagon follows light/dark. Monochrome near-black glyphs are
 * inverted for contrast by the logo components themselves — this file must NOT
 * add its own inversion, because CSS filters on nested elements compose and a
 * second `invert` would return the glyph to near-black.
 */
export function AgentAvatarVisual({
	avatarSrc,
	animate,
	vpkLogo,
	logoName,
	brandName,
	label,
	sizePx,
	inset = false,
	fallbackText,
	status,
	children,
	avatarClassName,
	className,
	loading,
}: Readonly<AgentAvatarVisualProps>) {
	if (!avatarSrc && !vpkLogo && !logoName && !brandName && !fallbackText) return null;

	const isSecondPartyAgent = avatarSrc?.startsWith("/2p/") ?? false;
	const isThirdPartyAgent = Boolean(brandName);
	const isExternalAgent = isSecondPartyAgent || isThirdPartyAgent;
	const hasWhiteBackdrop = isExternalAgent || logoName === "atlassian" || Boolean(vpkLogo);
	const shouldInsetImage = inset || isExternalAgent;
	const insetImageClassName = PX_TO_INSET_IMAGE_CLASS_NAME[sizePx] ?? "size-4";
	const insetLogoSize = PX_TO_INSET_LOGO_SIZE[sizePx] ?? PX_TO_LOGO_SIZE[sizePx] ?? "xxsmall";
	const externalLogoSize = PX_TO_EXTERNAL_LOGO_SIZE[sizePx] ?? insetLogoSize;
	// The Rovo gem is authored at 16×16 (`ROVO_LOGO_VIEWBOX`). Hexagon avatars
	// keep that native mark so a tile/circle size token cannot enlarge it.
	const visual = vpkLogo === "rovo" ? (
		<RovoColorIcon label="" size="xxsmall" />
	) : logoName ? (
		<AtlassianLogo label="" name={logoName} size={insetLogoSize} themeAware />
	) : brandName ? (
		<LogoThirdParty borderless label="" name={brandName} size={externalLogoSize} />
	) : avatarSrc ? (
		<>
			<AvatarImage
				alt=""
				className={cn(shouldInsetImage ? insetImageClassName : "size-full", "object-contain", className)}
				loading={loading}
				src={avatarSrc}
			/>
			{fallbackText ? <AvatarFallback>{fallbackText}</AvatarFallback> : null}
		</>
	) : (
		<AvatarFallback>{fallbackText}</AvatarFallback>
	);

	return (
		<Avatar
			animate={animate}
			className={cn(PX_TO_AVATAR_FRAME_CLASS_NAME[sizePx], avatarClassName)}
			label={label}
			shape="hexagon"
			size={avatarSizeFromPx(sizePx)}
			status={status}
		>
			{hasWhiteBackdrop ? (
				<span className="flex size-full items-center justify-center bg-surface">{visual}</span>
			) : (
				visual
			)}
			{children}
		</Avatar>
	);
}
