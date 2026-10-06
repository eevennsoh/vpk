"use client";

import { useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import Image from "next/image";
import { motion, useReducedMotion, type Transition } from "motion/react";

import { AtlassianLogo, RovoAppIcon, type AtlassianLogoName } from "@/components/ui/logo";
import { LogoThirdParty } from "@/components/ui/logo-third-party";
import type { ThirdPartyLogoName } from "@/components/ui/data/logo-third-party-data";
import { Tile } from "@/components/ui/tile";
import { TeamworkGraphMark } from "@/components/ui-custom/teamwork-graph-mark";
import { cn } from "@/lib/utils";
import { motionEase } from "@/lib/motion";

/**
 * Shared with `components/ui/tile` — the names resolve to the same box on the
 * `Tile`, `AtlassianLogo`, and `LogoThirdParty` scale, so the size is passed
 * straight through rather than translated.
 */
export type TwgToolSourceIconSize = "xxsmall" | "xsmall" | "small" | "medium";
export type TwgToolThirdPartyProvider = "google-drive" | "salesforce";
export type TwgToolSourceProvider =
	| "twg"
	| "teamwork-graph"
	| "code-search"
	| TwgToolThirdPartyProvider
	| AtlassianLogoName;

export interface TwgToolSource {
	id: string;
	label: string;
	provider: TwgToolSourceProvider;
	icon?: ReactNode;
	/**
	 * Third-party brand id — renders the upstream `@atlassian/logo-third-party`
	 * mark. Preferred over `provider` for arbitrary 3P brands.
	 */
	name?: ThirdPartyLogoName;
	/**
	 * Non-brand image source (e.g. an `/avatar-agent/…` SVG). Do NOT use this for
	 * 3P brand logos — use `name` instead so `public/3p` paths stay out of data.
	 */
	iconSrc?: string;
}

export type TwgToolSourceIconProps = Omit<ComponentProps<typeof Tile>, "children" | "label" | "size"> & {
	source: TwgToolSource;
	size?: TwgToolSourceIconSize;
};

export type TwgAppstackAnimationDirection = "left-to-right" | "right-to-left";

export type TWGAppstackProps = Omit<ComponentProps<"div">, "children"> & {
	children?: never;
	sources: ReadonlyArray<TwgToolSource>;
	iconSize?: TwgToolSourceIconSize;
	maxVisible?: number;
	animated?: boolean;
	direction?: TwgAppstackAnimationDirection;
};

export type TwgToolSourceStackProps = TWGAppstackProps;

const APPSTACK_STAGGER_SECONDS = 0.18;
const APPSTACK_ENTER_OFFSET = 10;
const APPSTACK_ENTER_ROTATION_OFFSET = 18;
const APPSTACK_TILE_FILL_CLASS = "bg-surface";
const APPSTACK_ROTATIONS = [
	0,
	6,
	0,
	-8,
] as const;

function getAppstackRotation(index: number) {
	return APPSTACK_ROTATIONS[index % APPSTACK_ROTATIONS.length];
}

function getAppstackDelay(index: number, itemCount: number, direction: TwgAppstackAnimationDirection) {
	const order = direction === "left-to-right" ? index : itemCount - index - 1;
	return order * APPSTACK_STAGGER_SECONDS;
}

function getAppstackInitialRotation(rotation: number) {
	return rotation + (rotation < 0 ? APPSTACK_ENTER_ROTATION_OFFSET : -APPSTACK_ENTER_ROTATION_OFFSET);
}

function getAppstackTransition(delay: number): Transition {
	return {
		filter: { duration: 0.36, ease: motionEase.out, delay },
		layout: { duration: 0.25, ease: motionEase.inOut },
		opacity: { duration: 0.32, ease: motionEase.out, delay },
		rotate: { type: "spring", stiffness: 260, damping: 30, mass: 0.85, delay: delay + 0.08 },
		scale: { type: "spring", stiffness: 260, damping: 28, mass: 0.85, delay },
		x: { type: "spring", stiffness: 260, damping: 28, mass: 0.85, delay },
	};
}

/**
 * Per-size geometry. `box` matches the `Tile` size class so source icons stay
 * square. `overflowBox` locks that same height (`h-* max-h-* min-h-0`) so the
 * count cannot grow taller than the icons, then uses min-width + `w-auto` so
 * short counts stay square-ish and `+48` / `+100` grow sideways. `overflowRadius`
 * is the fixed ADS radius of a *square* tile at this size (25% of height as
 * `rounded-sm` / `rounded-md` / `rounded-lg`). Never use `rounded-tile` here —
 * that token is 25% per axis and stretches into ellipses when width grows.
 * The `!` beats Tile's `rounded-tile`. `imagePx` sizes the `next/image`
 * fallback; `overlap` scales the negative inline margin; `countText` keeps
 * the `+N` label legible; `countPad` is horizontal token spacing only.
 */
const APPSTACK_SIZES = {
	xxsmall: {
		box: "size-4",
		overflowBox: "h-4 max-h-4 min-h-0 min-w-4 w-auto",
		overflowRadius: "rounded-sm!",
		imagePx: 16,
		overlap: "-ml-0.5",
		countText: "text-[10px]",
		countPad: "px-0.5",
	},
	xsmall: {
		box: "size-5",
		overflowBox: "h-5 max-h-5 min-h-0 min-w-5 w-auto",
		overflowRadius: "rounded-sm!",
		imagePx: 20,
		overlap: "-ml-1",
		countText: "text-[10px]",
		countPad: "px-0.5",
	},
	small: {
		box: "size-6",
		overflowBox: "h-6 max-h-6 min-h-0 min-w-6 w-auto",
		overflowRadius: "rounded-md!",
		imagePx: 24,
		overlap: "-ml-1",
		countText: "text-xs",
		countPad: "px-1",
	},
	medium: {
		box: "size-8",
		overflowBox: "h-8 max-h-8 min-h-0 min-w-8 w-auto",
		overflowRadius: "rounded-lg!",
		imagePx: 32,
		overlap: "-ml-1.5",
		countText: "text-xs",
		countPad: "px-1",
	},
} as const satisfies Record<TwgToolSourceIconSize, {
	box: string;
	overflowBox: string;
	overflowRadius: string;
	imagePx: number;
	overlap: string;
	countText: string;
	countPad: string;
}>;

function isThirdPartyProvider(
	provider: TwgToolSourceProvider
): provider is TwgToolThirdPartyProvider {
	return provider === "google-drive" || provider === "salesforce";
}

export function TwgToolSourceIcon({
	className,
	source,
	size = "small",
	...props
}: TwgToolSourceIconProps) {
	if (source.icon) {
		return (
			<Tile
				className={cn("shrink-0", APPSTACK_TILE_FILL_CLASS, className)}
				isInset={false}
				label={source.label}
				size={size}
				variant="transparent"
				{...props}
			>
				{source.icon}
			</Tile>
		);
	}

	if (source.name) {
		// 3P brand → upstream package mark (its own white tile replaces the appstack
		// tile at the same size). No `public/3p` asset path. `LogoThirdParty` does
		// not take leftover Tile props, so `aria-hidden` has to wrap the labeled
		// `role="img"` rather than being spread onto it.
		const logo = (
			<LogoThirdParty
				className={cn("shrink-0", className)}
				label={source.label}
				name={source.name}
				size={size}
			/>
		);
		return props["aria-hidden"] ? <span aria-hidden>{logo}</span> : logo;
	}

	if (source.iconSrc) {
		// Non-brand image (e.g. an `/avatar-agent/…` SVG). 3P brands use `name`.
		return (
			<Tile
				className={cn("shrink-0", APPSTACK_TILE_FILL_CLASS, className)}
				isInset={false}
				label={source.label}
				role={props["aria-hidden"] ? undefined : "img"}
				size={size}
				variant="transparent"
				{...props}
			>
				<Image
					alt=""
					aria-hidden
					height={APPSTACK_SIZES[size].imagePx}
					src={source.iconSrc}
					width={APPSTACK_SIZES[size].imagePx}
				/>
			</Tile>
		);
	}

	if (source.provider === "rovo") {
		return (
			<RovoAppIcon
				{...props}
				className={cn("shrink-0", className)}
				label={props["aria-hidden"] ? undefined : source.label}
				size={size}
			/>
		);
	}

	if (source.provider === "teamwork-graph") {
		return (
			<Tile
				{...props}
				className={cn("bg-bg-neutral-bold", className)}
				label={source.label}
				role={props["aria-hidden"] ? undefined : "img"}
				size={size}
				variant="transparent"
			>
				<TeamworkGraphMark className="text-icon-inverse" />
			</Tile>
		);
	}

	if (source.provider === "code-search") {
		return (
			<Tile
				{...props}
				className={cn("bg-lime-300", className)}
				isInset={false}
				label={source.label}
				role={props["aria-hidden"] ? undefined : "img"}
				size={size}
				variant="transparent"
			>
				<Image
					alt=""
					aria-hidden
					height={APPSTACK_SIZES[size].imagePx}
					src="/brand-icons/rovo-search.svg"
					width={APPSTACK_SIZES[size].imagePx}
				/>
			</Tile>
		);
	}

	if (source.provider === "twg") {
		return (
			<Tile
				className={cn("shrink-0", APPSTACK_TILE_FILL_CLASS, className)}
				isInset={false}
				label={source.label}
				size={size}
				variant="transparent"
				{...props}
			>
				<span className="inline-flex size-full items-center justify-center">
					<AtlassianLogo
						name="jira-service-management"
						hasBorder
						label={source.label}
						size={size}
						themeAware={false}
					/>
				</span>
			</Tile>
		);
	}

	if (isThirdPartyProvider(source.provider)) {
		// Provider is itself a 3P brand id (`google-drive` / `salesforce`).
		const logo = (
			<LogoThirdParty
				className={cn("shrink-0", className)}
				label={source.label}
				name={source.provider}
				size={size}
			/>
		);
		return props["aria-hidden"] ? <span aria-hidden>{logo}</span> : logo;
	}

	return (
		<Tile
			className={cn("shrink-0 text-icon-subtle", APPSTACK_TILE_FILL_CLASS, className)}
			isInset={false}
			label={source.label}
			size={size}
			variant="transparent"
			{...props}
		>
			<span className="inline-flex size-full items-center justify-center">
				<AtlassianLogo
					name={source.provider}
					hasBorder
					label={source.label}
					size={size}
					themeAware={false}
				/>
			</span>
		</Tile>
	);
}

export function TWGAppstack({
	animated = true,
	className,
	direction = "right-to-left",
	iconSize = "small",
	maxVisible = 6,
	sources,
	...props
}: TWGAppstackProps) {
	const shouldReduceMotion = useReducedMotion();
	const shouldAnimate = animated && !shouldReduceMotion;
	const hasRenderedSources = useRef(false);
	const shouldStaggerEntrance = !hasRenderedSources.current;
	const sizing = APPSTACK_SIZES[iconSize];

	useEffect(() => {
		if (sources.length > 0) hasRenderedSources.current = true;
	}, [sources.length]);

	if (sources.length === 0) {
		return null;
	}

	const visibleSources = sources.slice(0, maxVisible);
	const hiddenCount = Math.max(0, sources.length - visibleSources.length);
	const itemCount = visibleSources.length + (hiddenCount > 0 ? 1 : 0);

	const renderItem = (
		key: string,
		index: number,
		children: ReactNode,
		rotation = getAppstackRotation(index),
		boxClassName: string = sizing.box,
	) => {
		const itemClassName = cn(
			"relative flex shrink-0 items-center justify-center",
			boxClassName,
			index > 0 && sizing.overlap
		);

		if (!shouldAnimate) {
			return (
				<div key={key} className={itemClassName} style={{ transform: `rotate(${rotation}deg)` }}>
					{children}
				</div>
			);
		}

		const delay = shouldStaggerEntrance
			? getAppstackDelay(index, itemCount, direction)
			: 0;

		return (
			<motion.div
				key={key}
				animate={{ filter: "blur(0px)", opacity: 1, rotate: rotation, scale: 1, x: 0 }}
				className={itemClassName}
				layout={shouldReduceMotion ? false : "position"}
				initial={{
					filter: "blur(6px)",
					opacity: 0,
					rotate: getAppstackInitialRotation(rotation),
					scale: 0.96,
					x: APPSTACK_ENTER_OFFSET,
				}}
				style={{ willChange: "filter, transform, opacity" }}
				transition={getAppstackTransition(delay)}
			>
				{children}
			</motion.div>
		);
	};

	return (
		<div className={cn("flex shrink-0 items-center justify-end overflow-visible", className)} {...props}>
			{visibleSources.map((source, index) => (
				renderItem(
					source.id,
					index,
					<TwgToolSourceIcon
						source={source}
						size={iconSize}
						className="relative"
					/>
				)
			))}
			{hiddenCount > 0 ? (
				renderItem(
					"hidden-source-count",
					visibleSources.length,
					<Tile
						className={cn(
							"box-border w-auto shrink-0 overflow-hidden bg-surface py-0 leading-none text-text-subtlest [&_span]:h-full [&_span]:w-auto",
							sizing.overflowBox,
							sizing.overflowRadius,
							sizing.countPad,
						)}
						data-appstack-overflow={hiddenCount}
						hasBorder
						isInset={false}
						label={`${hiddenCount} more sources`}
						size={iconSize}
						variant="transparent"
					>
						<span className={cn("whitespace-nowrap font-medium leading-none tabular-nums", sizing.countText)}>
							+{hiddenCount}
						</span>
					</Tile>,
					0,
					sizing.overflowBox,
				)
			) : null}
		</div>
	);
}

export function TwgToolSourceStack(props: TWGAppstackProps) {
	return <TWGAppstack {...props} />;
}
