"use client"

// oxlint-disable react-doctor/prefer-module-scope-pure-function -- These helpers are intentionally local to the component/demo because they depend on the surrounding interaction contract.

// oxlint-disable react-doctor/prefer-tag-over-role -- This file uses ARIA roles for custom generated visuals or composite widgets where the suggested native tag would change semantics or behavior.

import * as React from "react"
import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar"
import { motion, useReducedMotion, type MotionProps, type Transition } from "motion/react"
import { useAnimate } from "motion/react-mini"
import type { AnimationOptions } from "motion/react"
import type { NewCoreIconProps } from "@atlaskit/icon/base-new"
import AiAgentIcon from "@atlaskit/icon/core/ai-agent"
import CheckMarkIcon from "@atlaskit/icon/core/check-mark"
import CrossIcon from "@atlaskit/icon/core/cross"
import PersonIcon from "@atlaskit/icon/core/person"
import { cva, type VariantProps } from "class-variance-authority"

import { Icon } from "@/components/ui/icon"
import { cn } from "@/lib/utils"
import { useMediaQuery } from "@/hooks/use-media-query"

const HEXAGON_CLIP =
	"[clip-path:polygon(45%_1.34%,46.58%_0.6%,48.26%_0.15%,50%_0%,51.74%_0.15%,53.42%_0.6%,55%_1.34%,89.64%_21.34%,91.07%_22.34%,92.3%_23.57%,93.3%_25%,94.04%_26.58%,94.49%_28.26%,94.64%_30%,94.64%_70%,94.49%_71.74%,94.04%_73.42%,93.3%_75%,92.3%_76.43%,91.07%_77.66%,89.64%_78.66%,55%_98.66%,53.42%_99.4%,51.74%_99.85%,50%_100%,48.26%_99.85%,46.58%_99.4%,45%_98.66%,10.36%_78.66%,8.93%_77.66%,7.7%_76.43%,6.7%_75%,5.96%_73.42%,5.51%_71.74%,5.36%_70%,5.36%_30%,5.51%_28.26%,5.96%_26.58%,6.7%_25%,7.7%_23.57%,8.93%_22.34%,10.36%_21.34%)]"

const HEXAGON_POINTS =
	"45,1.34 46.58,0.6 48.26,0.15 50,0 51.74,0.15 53.42,0.6 55,1.34 89.64,21.34 91.07,22.34 92.3,23.57 93.3,25 94.04,26.58 94.49,28.26 94.64,30 94.64,70 94.49,71.74 94.04,73.42 93.3,75 92.3,76.43 91.07,77.66 89.64,78.66 55,98.66 53.42,99.4 51.74,99.85 50,100 48.26,99.85 46.58,99.4 45,98.66 10.36,78.66 8.93,77.66 7.7,76.43 6.7,75 5.96,73.42 5.51,71.74 5.36,70 5.36,30 5.51,28.26 5.96,26.58 6.7,25 7.7,23.57 8.93,22.34 10.36,21.34"

// Top-right hex vertex (89.64%, 21.34%). Circle/square status stays at the box corner;
// hexagon status centers on this vertex so the badge sits on the tile, not in empty space.
const HEXAGON_STATUS_POSITION_CLASS_NAME =
	"group-data-[shape=hexagon]/avatar:top-[21.34%] group-data-[shape=hexagon]/avatar:right-auto group-data-[shape=hexagon]/avatar:left-[89.64%] group-data-[shape=hexagon]/avatar:-translate-x-1/2 group-data-[shape=hexagon]/avatar:-translate-y-1/2"

// motion.avatar.* recipe expressed in vpk tokens (Motion for React can't read var(), so use the resolved values — see motion-decisions.md).
const AVATAR_ENTER_TRANSITION: Transition = { duration: 0.15, ease: [0.4, 1, 0.6, 1] } // duration-normal + ease-out-practical
const AVATAR_EXIT_TRANSITION: Transition = { duration: 0.1, ease: [0.6, 0, 0.8, 0.6] } // duration-fast + ease-in
const AVATAR_HOVER_SPRING: Transition = { type: "spring", stiffness: 300, damping: 18 } // mirrors ease-spring / motion.avatar.hovered

const avatarVariants = cva(
	"group/avatar relative flex shrink-0 select-none after:absolute after:inset-0 after:border after:mix-blend-darken dark:after:mix-blend-lighten after:border-border",
	{
		variants: {
			size: {
				xxs: "size-3",
				xs: "size-4",
				sm: "size-6",
				default: "size-8",
				lg: "size-10",
				xl: "size-12",
				"2xl": "size-24",
			},
			shape: {
				circle: "rounded-full after:rounded-full",
				square: "rounded-[6px] after:rounded-[6px]",
				hexagon: "isolate overflow-visible after:border-0",
			},
		},
		defaultVariants: {
			size: "default",
			shape: "circle",
		},
	}
)

type AvatarPresence = "online" | "busy" | "offline" | "focus"
type AvatarUnassignedKind = "person" | "agent"
type AvatarSize = NonNullable<VariantProps<typeof avatarVariants>["size"]>

const AvatarGroupContext = React.createContext(false)
const AvatarGroupSizeContext = React.createContext<AvatarSize | undefined>(undefined)

/** xs/sm (16/24) use the 12px small plus; 32px+ groups keep the default 16×16 medium plus. */
function avatarGroupCountIconSize(size: AvatarSize | undefined): "small" | "medium" {
	if (size === "xs" || size === "sm") {
		return "small"
	}
	return "medium"
}

function firstAvatarSize(children: React.ReactNode): AvatarSize | undefined {
	let resolved: AvatarSize | undefined
	React.Children.forEach(children, (child) => {
		if (resolved !== undefined || !React.isValidElement(child)) {
			return
		}
		if (child.type !== Avatar) {
			return
		}
		resolved = (child.props as AvatarProps).size ?? "default"
	})
	return resolved
}

interface AvatarOutlineMotion {
	scale: number | readonly number[]
	transition?: Pick<AnimationOptions, "duration" | "ease" | "times" | "repeat" | "delay">
	ring?: boolean
}

interface AvatarProps
	extends AvatarPrimitive.Root.Props,
		VariantProps<typeof avatarVariants> {
	animate?: boolean
	disabled?: boolean
	label?: string
	/** Match an ancestor scale animation while keeping circular outline strokes constant. */
	outline?: AvatarOutlineMotion
	/** Rendered as an unclipped sibling of hex artwork so the badge can hang past the tile. */
	status?: AvatarStatus
}

function avatarScaleAnimation(element: Element | null): Animation | undefined {
	for (let owner = element?.parentElement; owner; owner = owner.parentElement) {
		const animation = owner.getAnimations().find((candidate) =>
			candidate.effect instanceof KeyframeEffect && candidate.effect.getKeyframes().some((frame) =>
				typeof frame.transform === "string" && frame.transform.includes("scale(")))
		if (animation) return animation
	}
	return undefined
}

function AvatarCircleOutline({ scale, transition, ring = false }: Readonly<AvatarOutlineMotion>) {
	const [scope, animateOutline] = useAnimate<HTMLSpanElement>()
	const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)", true)
	React.useEffect(() => {
		const values = typeof scale === "number" ? [scale] : scale
		const scales = reducedMotion ? values.slice(0, 1) : values
		const { duration, ease, times, repeat, delay } = transition ?? {}
		const timing = reducedMotion ? { duration: 0 } : { duration, ease, times, repeat, delay }
		const border = animateOutline('[data-slot="avatar-circle-border"] circle', { strokeWidth: scales.map((value) => 1 / value) }, timing)
		const separator = ring ? animateOutline('[data-slot="avatar-circle-ring"] circle', { strokeWidth: scales.map((value) => 4 / value) }, timing) : undefined
		const currentTime = avatarScaleAnimation(scope.current)?.currentTime
		if (typeof currentTime === "number") {
			border.time = currentTime / 1000
			if (separator) separator.time = currentTime / 1000
		}
		return () => {
			border.stop()
			separator?.stop()
		}
	}, [scope, animateOutline, scale, transition, ring, reducedMotion])
	return (
		<span className="contents" ref={scope}>
			{ring ? (
				<svg
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 -z-10 size-full overflow-visible text-background"
					data-slot="avatar-circle-ring"
					focusable="false"
					viewBox="0 0 100 100"
				>
					<circle
						cx="50" cy="50" r="50" fill="none"
						stroke="currentColor" strokeWidth="4"
						vectorEffect="non-scaling-stroke"
					/>
				</svg>
			) : null}
			<svg
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 z-[1] size-full overflow-visible text-border! mix-blend-darken dark:mix-blend-lighten"
				data-slot="avatar-circle-border"
				focusable="false"
				viewBox="0 0 100 100"
			>
				<circle
					cx="50" cy="50" r="50" fill="none"
					stroke="currentColor" strokeWidth="1"
					vectorEffect="non-scaling-stroke"
				/>
			</svg>
		</span>
	)
}

function avatarOutline(shape: AvatarProps["shape"], outline: AvatarProps["outline"]) {
	const motion = shape === "circle" ? outline : undefined
	return { motion, className: motion ? "isolate after:border-0" : undefined }
}

function AvatarHexagonBorder() {
	return (
		<svg
			aria-hidden="true"
			className="pointer-events-none absolute inset-0 z-[1] size-full overflow-visible p-px text-border! mix-blend-darken dark:mix-blend-lighten"
			focusable="false"
			viewBox="0 0 100 100"
		>
			<polygon
				fill="none"
				points={HEXAGON_POINTS}
				stroke="currentColor"
				strokeWidth="1"
				vectorEffect="non-scaling-stroke"
			/>
		</svg>
	)
}

function Avatar({
	children,
	className,
	size = "default",
	shape = "circle",
	animate = true,
	disabled = false,
	label,
	status,
	outline: outlineMotion,
	...props
}: Readonly<AvatarProps>) {
	const isInAvatarGroup = React.use(AvatarGroupContext)
	const outline = avatarOutline(shape, outlineMotion)
	const rootClassName = cn(
		avatarVariants({ size, shape }),
		outline.className,
		disabled && "opacity-(--opacity-disabled) pointer-events-none grayscale",
		className
	)

	// avatar.enter (scale 80→100 + fade), avatar.exit (100→80 + fade), avatar.hovered (spring 100→112%).
	// Exit only plays when a consumer wraps keyed avatars in their own <AnimatePresence>; enter + hover
	// work everywhere. Pass `animate={false}` at a call site when a high-frequency
	// surface must reveal an avatar immediately.
	// Disabled avatars opt out entirely: animating opacity would write inline `opacity: 1` and override
	// the `opacity-(--opacity-disabled)` dim class, and a disabled avatar should not react to hover.
	const reduce = useReducedMotion()
	const motionProps: MotionProps =
		!animate || reduce || disabled
			? { initial: false }
			: {
					initial: { scale: 0.8, opacity: 0 },
					animate: { scale: 1, opacity: 1, transition: AVATAR_ENTER_TRANSITION },
					exit: { scale: 0.8, opacity: 0, transition: AVATAR_EXIT_TRANSITION },
					whileHover: { scale: 1.12, zIndex: 10, transition: AVATAR_HOVER_SPRING },
					style: { willChange: "transform, opacity" },
				}

	// Hexagon avatars shape their content with a clip-path. A clip-path also clips
	// every descendant, so corner overlays (badges, presence/status dots) would be
	// sliced along the hexagon edge. Apply the clip to an inner frame that holds the
	// content, and render overlays as unclipped siblings on the root.
	if (shape === "hexagon") {
		const childArray = React.Children.toArray(children)
		const isOverlay = (child: React.ReactNode) =>
			React.isValidElement(child) && AVATAR_OVERLAY_TYPES.has(child.type)

		return (
			<AvatarPrimitive.Root
				data-slot="avatar"
				data-size={size}
				data-shape={shape}
				aria-label={label}
				role={label ? "img" : undefined}
				aria-disabled={disabled || undefined}
				className={rootClassName}
				render={<motion.span {...motionProps} />}
				{...props}
			>
				{isInAvatarGroup ? (
					<span
						aria-hidden="true"
						className={cn("pointer-events-none absolute -inset-0.5 -z-10 bg-background", HEXAGON_CLIP)}
						data-slot="avatar-hexagon-group-border"
					/>
				) : null}
				<span
					className={cn("relative flex size-full items-center justify-center overflow-hidden", HEXAGON_CLIP)}
					data-slot="avatar-hexagon-artwork"
				>
					{childArray.filter((child) => !isOverlay(child))}
				</span>
				<AvatarHexagonBorder />
				{status ? <AvatarStatusIndicator status={status} /> : null}
				{childArray.filter(isOverlay)}
			</AvatarPrimitive.Root>
		)
	}

	return (
		<AvatarPrimitive.Root
			data-slot="avatar"
			data-size={size}
			data-shape={shape}
			aria-label={label}
			role={label ? "img" : undefined}
			aria-disabled={disabled || undefined}
			className={rootClassName}
			render={<motion.span {...motionProps} />}
			{...props}
		>
			{children}
			{outline.motion ? <AvatarCircleOutline {...outline.motion} /> : null}
			{status ? <AvatarStatusIndicator status={status} /> : null}
		</AvatarPrimitive.Root>
	)
}

type AvatarImageProps = AvatarPrimitive.Image.Props

function AvatarImage({ className, ...props }: Readonly<AvatarImageProps>) {
	return (
		<AvatarPrimitive.Image
			data-slot="avatar-image"
			className={cn(
				"rounded-full aspect-square size-full object-cover group-data-[shape=square]/avatar:rounded-[6px]",
				`group-data-[shape=hexagon]/avatar:rounded-none group-data-[shape=hexagon]/avatar:${HEXAGON_CLIP}`,
				className
			)}
			{...props}
		/>
	)
}

type AvatarFallbackProps = AvatarPrimitive.Fallback.Props

function AvatarFallback({
	className,
	...props
}: Readonly<AvatarFallbackProps>) {
	return (
		<AvatarPrimitive.Fallback
			data-slot="avatar-fallback"
			className={cn(
				"bg-muted text-foreground rounded-full flex size-full items-center justify-center text-sm group-data-[size=xxs]/avatar:text-[6px] group-data-[size=xs]/avatar:text-[8px] group-data-[size=sm]/avatar:text-xs group-data-[size=xl]/avatar:text-lg group-data-[size=2xl]/avatar:text-3xl group-data-[shape=square]/avatar:rounded-[6px]",
				`group-data-[shape=hexagon]/avatar:rounded-none group-data-[shape=hexagon]/avatar:${HEXAGON_CLIP}`,
				className
			)}
			{...props}
		/>
	)
}

const avatarUnassignedIconSizeMap: Record<AvatarSize, NewCoreIconProps["size"]> = {
	xxs: "small",
	xs: "small",
	sm: "small",
	default: "medium",
	lg: "medium",
	xl: "medium",
	"2xl": "medium",
}

interface AvatarUnassignedProps extends Omit<AvatarProps, "shape"> {
	kind?: AvatarUnassignedKind
}

function AvatarUnassigned({
	children,
	className,
	kind = "person",
	label,
	size = "default",
	...props
}: Readonly<AvatarUnassignedProps>) {
	const isAgent = kind === "agent"
	const IconComponent = isAgent ? AiAgentIcon : PersonIcon
	const resolvedLabel = label ?? (isAgent ? "Unassigned agent" : "Unassigned person")
	const resolvedSize = size ?? "default"

	return (
		<Avatar
			data-unassigned={kind}
			className={cn(
				"items-center justify-center text-icon-subtle after:border-border",
				!isAgent && "bg-muted",
				className
			)}
			label={resolvedLabel}
			shape={isAgent ? "hexagon" : "circle"}
			size={resolvedSize}
			{...props}
		>
			<span className={cn(
				"flex items-center justify-center text-icon-subtle",
				isAgent && "size-full bg-muted"
			)}>
				<Icon
					aria-hidden
					className="text-icon-subtle"
					render={
						<IconComponent
							color="currentColor"
							label=""
							size={avatarUnassignedIconSizeMap[resolvedSize]}
						/>
					}
				/>
			</span>
			{children}
		</Avatar>
	)
}

const presenceColorMap: Record<AvatarPresence, string> = {
	online: "bg-success",
	busy: "bg-destructive",
	offline: "bg-bg-neutral-bold",
	focus: "bg-discovery",
}

// Glyphs match ADS / Figma Avatar Presence: solid online, slash busy, target focus, hollow offline.
// Focus: thick discovery rim (parent fill) + large white disk + small discovery center dot.
// Cutouts use bg-background so they stay in sync with the outer ring-background separator.
function AvatarPresenceGlyph({ presence }: Readonly<{ presence: AvatarPresence }>) {
	switch (presence) {
		case "online":
			return null
		case "busy":
			return (
				<span
					aria-hidden
					className="absolute top-1/2 left-1/2 h-[22%] w-[72%] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-background"
				/>
			)
		case "focus":
			return (
				<>
					<span aria-hidden className="absolute inset-[18%] rounded-full bg-background" />
					{/* Center disc ~28% of badge diameter — matches Figma Focus target weight. */}
					<span
						aria-hidden
						className="absolute top-1/2 left-1/2 size-[28%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-discovery"
					/>
				</>
			)
		case "offline":
			return (
				<span aria-hidden className="absolute inset-1/4 rounded-full bg-background" />
			)
		default: {
			const _exhaustive: never = presence
			return _exhaustive
		}
	}
}

interface AvatarPresenceIndicatorProps extends React.ComponentProps<"span"> {
	presence: AvatarPresence
}

function AvatarPresenceIndicator({
	className,
	presence,
	...props
}: Readonly<AvatarPresenceIndicatorProps>) {
	return (
		<span
			data-slot="avatar-presence"
			role="img"
			aria-label={presence}
			className={cn(
				// overflow-hidden keeps busy/focus/offline glyphs inside the circular fill + ring.
				"ring-background absolute right-0 bottom-0 z-10 inline-flex items-center justify-center overflow-hidden rounded-full ring-2",
				"group-data-[size=xs]/avatar:size-1.5",
				"group-data-[size=sm]/avatar:size-2",
				"group-data-[size=default]/avatar:size-2.5",
				"group-data-[size=lg]/avatar:size-3",
				"group-data-[size=xl]/avatar:size-3.5",
				"group-data-[size=2xl]/avatar:size-6",
				presenceColorMap[presence],
				className
			)}
			{...props}
		>
			<AvatarPresenceGlyph presence={presence} />
		</span>
	)
}

type AvatarBadgeProps = React.ComponentProps<"span">

function AvatarBadge({ className, ...props }: Readonly<AvatarBadgeProps>) {
	return (
		<span
			data-slot="avatar-badge"
			className={cn(
				"bg-primary text-primary-foreground ring-background absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-blend-color ring-2 select-none",
				"group-data-[size=xs]/avatar:size-1.5 group-data-[size=xs]/avatar:[&>svg]:hidden group-data-[size=xs]/avatar:[&>[data-slot=icon]]:scale-[0.375]",
				"group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden group-data-[size=sm]/avatar:[&>[data-slot=icon]]:scale-50",
				"group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2 group-data-[size=default]/avatar:[&>[data-slot=icon]]:scale-75",
				"group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2 group-data-[size=lg]/avatar:[&>[data-slot=icon]]:scale-75",
				"group-data-[size=xl]/avatar:size-3.5 group-data-[size=xl]/avatar:[&>svg]:size-2.5 group-data-[size=xl]/avatar:[&>[data-slot=icon]]:scale-100",
				"group-data-[size=2xl]/avatar:size-6 group-data-[size=2xl]/avatar:[&>svg]:size-4 group-data-[size=2xl]/avatar:[&>[data-slot=icon]]:scale-125",
				className
			)}
			{...props}
		/>
	)
}

type AvatarCompanyBadgeProps = React.ComponentProps<"span">

function AvatarCompanyBadge({
	className,
	children,
	...props
}: Readonly<AvatarCompanyBadgeProps>) {
	return (
		<span
			data-slot="avatar-company-badge"
			className={cn(
				"absolute right-0 bottom-0 z-10 inline-flex items-center justify-center overflow-hidden rounded-lg ring-2 select-none",
				"bg-[#0C66E4] text-white ring-white",
				"group-data-[size=xs]/avatar:size-2 group-data-[size=xs]/avatar:[&_svg]:hidden",
				"group-data-[size=sm]/avatar:size-3 group-data-[size=sm]/avatar:[&_svg]:size-2",
				"group-data-[size=default]/avatar:size-3.5 group-data-[size=default]/avatar:[&_svg]:size-2",
				"group-data-[size=lg]/avatar:size-4 group-data-[size=lg]/avatar:[&_svg]:size-2.5",
				"group-data-[size=xl]/avatar:size-4 group-data-[size=xl]/avatar:[&_svg]:size-2.5",
				"group-data-[size=2xl]/avatar:size-6 group-data-[size=2xl]/avatar:[&_svg]:size-4",
				className,
				"bg-[#0C66E4] text-white"
			)}
			{...props}
		>
			{children}
		</span>
	)
}

type AvatarProjectBadgeProps = React.ComponentProps<"span">

function AvatarProjectBadge({
	className,
	children,
	...props
}: Readonly<AvatarProjectBadgeProps>) {
	return (
		<span
			data-slot="avatar-project-badge"
			className={cn(
				"bg-muted ring-background absolute right-0 bottom-0 z-10 inline-flex items-center justify-center overflow-hidden rounded-xs ring-2 select-none [&_img]:size-full [&_img]:object-cover",
				"group-data-[size=xs]/avatar:size-2 group-data-[size=xs]/avatar:[&_svg]:hidden",
				"group-data-[size=sm]/avatar:size-3 group-data-[size=sm]/avatar:[&_svg]:size-2",
				"group-data-[size=default]/avatar:size-3.5 group-data-[size=default]/avatar:[&_svg]:size-2",
				"group-data-[size=lg]/avatar:size-4 group-data-[size=lg]/avatar:[&_svg]:size-2.5",
				"group-data-[size=xl]/avatar:size-4 group-data-[size=xl]/avatar:[&_svg]:size-2.5",
				"group-data-[size=2xl]/avatar:size-6 group-data-[size=2xl]/avatar:[&_svg]:size-4",
				className
			)}
			{...props}
		>
			{children}
		</span>
	)
}

type AvatarStatus = "approved" | "declined" | "locked" | "warning" | "needs-input" | "finished"

// Bang-only glyph for warning status — Atlaskit WarningIcon includes a triangle; Figma wants "!" alone.
// Paths match the stem + dot from @atlaskit/icon/core/warning (16×16 viewBox), without the triangle.
function AvatarWarningBangIcon({
	label = "",
	size = "small",
	color = "currentColor",
	...props
}: Readonly<NewCoreIconProps>) {
	const px = size === "small" ? 16 : 24
	return (
		<svg
			width={px}
			height={px}
			viewBox="0 0 16 16"
			fill="none"
			aria-hidden={label ? undefined : true}
			aria-label={label || undefined}
			{...props}
		>
			<path fill={color} d="M7.25 4.5v5h1.5v-5z" />
			<path fill={color} d="M9 11.75a1 1 0 1 1-2 0 1 1 0 0 1 2 0" />
		</svg>
	)
}

// Lock silhouette for locked status — Atlaskit LockLockedIcon path with the keyhole bar
// subpath removed (too small/unclear at status-dot size). Keeps shackle hole + body frame.
function AvatarLockedIcon({
	label = "",
	size = "small",
	color = "currentColor",
	...props
}: Readonly<NewCoreIconProps>) {
	const px = size === "small" ? 16 : 24
	return (
		<svg
			width={px}
			height={px}
			viewBox="0 0 16 16"
			fill="none"
			aria-hidden={label ? undefined : true}
			aria-label={label || undefined}
			{...props}
		>
			<path
				fill={color}
				fillRule="evenodd"
				clipRule="evenodd"
				d="M8 1.5A2.5 2.5 0 0 0 5.5 4v3h5V4A2.5 2.5 0 0 0 8 1.5M12 7V4a4 4 0 0 0-8 0v3a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2M4 8.5a.5.5 0 0 0-.5.5v5a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5V9a.5.5 0 0 0-.5-.5z"
			/>
		</svg>
	)
}

// "i" mark for needs-input — filled information-disk icons read as nested seals
// at status-dot size. Paths match the stem + dot from the information glyph.
function AvatarInformationMarkIcon({
	label = "",
	size = "small",
	color = "currentColor",
	...props
}: Readonly<NewCoreIconProps>) {
	const px = size === "small" ? 16 : 24
	return (
		<svg
			width={px}
			height={px}
			viewBox="0 0 16 16"
			fill="none"
			aria-hidden={label ? undefined : true}
			aria-label={label || undefined}
			{...props}
		>
			<path fill={color} d="M9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0" />
			<path fill={color} d="M7.25 6.25v5h1.5v-5z" />
		</svg>
	)
}

// Optical fit via CSS transform on the Icon wrapper — slightly under AvatarBadge's
// 0.75/1/1.25 so glyphs leave a thin fill inset without looking wispy at 0.5.
const STATUS_ICON_CLASS_NAME =
	"group-data-[size=xs]/avatar:hidden group-data-[size=sm]/avatar:hidden group-data-[size=default]/avatar:scale-[0.65] group-data-[size=lg]/avatar:scale-[0.65] group-data-[size=xl]/avatar:scale-[0.85] group-data-[size=2xl]/avatar:scale-[1.1]"
const LOCKED_STATUS_ICON_CLASS_NAME =
	"group-data-[size=xs]/avatar:hidden group-data-[size=sm]/avatar:hidden group-data-[size=default]/avatar:scale-[0.45] group-data-[size=lg]/avatar:scale-[0.45] group-data-[size=xl]/avatar:scale-[0.65] group-data-[size=2xl]/avatar:scale-[0.85]"

// Simple glyphs on presence-style circular fills (seal/disk icons read jagged or solid at this size).
// Locked reuses offline presence fill so the grey stays in sync.
const statusConfig: Record<
	AvatarStatus,
	{ icon: React.ComponentType<NewCoreIconProps>; className: string; iconClassName: string; label: string }
> = {
	approved: { icon: CheckMarkIcon, className: "bg-success text-success-foreground", iconClassName: STATUS_ICON_CLASS_NAME, label: "Approved" },
	declined: { icon: CrossIcon, className: "bg-destructive text-destructive-foreground", iconClassName: STATUS_ICON_CLASS_NAME, label: "Declined" },
	locked: {
		icon: AvatarLockedIcon,
		className: `${presenceColorMap.offline} text-icon-inverse`,
		iconClassName: LOCKED_STATUS_ICON_CLASS_NAME,
		label: "Locked",
	},
	warning: {
		icon: AvatarWarningBangIcon,
		className: "bg-warning text-icon",
		iconClassName: STATUS_ICON_CLASS_NAME,
		label: "Warning",
	},
	"needs-input": {
		icon: AvatarInformationMarkIcon,
		className: "bg-info text-info-foreground",
		iconClassName: STATUS_ICON_CLASS_NAME,
		label: "Needs input",
	},
	// Agent alias of approved — same green fill, white check, and ring-background cutout.
	finished: { icon: CheckMarkIcon, className: "bg-success text-success-foreground", iconClassName: STATUS_ICON_CLASS_NAME, label: "Finished" },
}

interface AvatarStatusIndicatorProps extends React.ComponentProps<"span"> {
	status: AvatarStatus
}

function AvatarStatusIndicator({
	className,
	status,
	...props
}: Readonly<AvatarStatusIndicatorProps>) {
	const config = statusConfig[status]
	const StatusIcon = config.icon

	return (
		<span
			data-slot="avatar-status"
			role="img"
			aria-label={config.label}
			className={cn(
				// Same ring treatment as AvatarPresenceIndicator; overflow-hidden keeps glyphs
				// from painting over ring-2 (which made status borders look thinner).
				"ring-background absolute top-0 right-0 z-10 overflow-hidden rounded-full ring-2",
				"inline-flex items-center justify-center",
				HEXAGON_STATUS_POSITION_CLASS_NAME,
				config.className,
				"group-data-[size=xs]/avatar:size-1.5",
				"group-data-[size=sm]/avatar:size-2",
				"group-data-[size=default]/avatar:size-2.5",
				"group-data-[size=lg]/avatar:size-3",
				"group-data-[size=xl]/avatar:size-3.5",
				"group-data-[size=2xl]/avatar:size-6",
				className
			)}
			{...props}
		>
			<Icon
				aria-hidden
				className={config.iconClassName}
				render={<StatusIcon label="" size="small" color="currentColor" />}
			/>
		</span>
	)
}

interface AvatarGroupProps extends React.ComponentProps<"div"> {
	label?: string
	size?: AvatarSize
}

function AvatarGroup({ children, className, label, size, ...props }: Readonly<AvatarGroupProps>) {
	const resolvedSize = size ?? firstAvatarSize(children)
	return (
		<AvatarGroupContext value>
			<AvatarGroupSizeContext value={resolvedSize}>
				<div
					data-slot="avatar-group"
					role="group"
					aria-label={label}
					className={cn(
						"*:data-[slot=avatar]:ring-background group/avatar-group flex -space-x-2 has-data-[size=xs]:-space-x-1 has-data-[size=xxs]:-space-x-1 *:data-[slot=avatar]:ring-2 [&>[data-slot=avatar][data-shape=hexagon]]:ring-0",
						className
					)}
					{...props}
				>
					{children}
				</div>
			</AvatarGroupSizeContext>
		</AvatarGroupContext>
	)
}

type AvatarGroupCountProps = React.ComponentProps<"div">

function AvatarGroupCount({
	children,
	className,
	...props
}: Readonly<AvatarGroupCountProps>) {
	const groupSize = React.use(AvatarGroupSizeContext)
	const iconSize = avatarGroupCountIconSize(groupSize)
	const content = React.Children.map(children, (child) => {
		if (!React.isValidElement(child) || typeof child.type === "string") {
			return child
		}
		return React.cloneElement(child, { size: iconSize } as never)
	})

	return (
		<div
			data-slot="avatar-group-count"
			className={cn("bg-muted text-muted-foreground size-8 rounded-full text-xs group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=lg]/avatar-group:text-sm group-has-data-[size=sm]/avatar-group:size-6 group-has-data-[size=xs]/avatar-group:size-4 group-has-data-[size=xs]/avatar-group:text-[8px] [&_[data-slot=icon]]:size-4 [&_svg]:size-4 group-has-data-[size=sm]/avatar-group:[&_[data-slot=icon]]:size-3 group-has-data-[size=sm]/avatar-group:[&_svg]:size-3 group-has-data-[size=xs]/avatar-group:[&_[data-slot=icon]]:size-2 group-has-data-[size=xs]/avatar-group:[&_svg]:size-2 ring-background relative flex shrink-0 items-center justify-center ring-2", className)}
			{...props}
		>
			{content}
		</div>
	)
}

const AVATAR_OVERLAY_TYPES: ReadonlySet<unknown> = new Set([
	AvatarBadge,
	AvatarCompanyBadge,
	AvatarProjectBadge,
	AvatarPresenceIndicator,
	AvatarStatusIndicator,
])

export {
	Avatar,
	AvatarImage,
	AvatarFallback,
	AvatarUnassigned,
	AvatarGroup,
	AvatarGroupCount,
	AvatarBadge,
	AvatarCompanyBadge,
	AvatarProjectBadge,
	AvatarPresenceIndicator,
	AvatarStatusIndicator,
	type AvatarProps,
	type AvatarImageProps,
	type AvatarFallbackProps,
	type AvatarUnassignedProps,
	type AvatarUnassignedKind,
	type AvatarBadgeProps,
	type AvatarCompanyBadgeProps,
	type AvatarProjectBadgeProps,
	type AvatarGroupProps,
	type AvatarGroupCountProps,
	type AvatarPresenceIndicatorProps,
	type AvatarPresence,
	type AvatarStatusIndicatorProps,
	type AvatarStatus,
}
