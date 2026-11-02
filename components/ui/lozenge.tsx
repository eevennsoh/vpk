import {
	cloneElement,
	isValidElement,
	type ReactElement,
	type ReactNode,
} from "react"
import { cva, type VariantProps } from "class-variance-authority"
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down"

import { Badge, type BadgeProps } from "@/components/ui/badge"
import { Icon } from "@/components/ui/icon"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

const lozengeToneClasses = {
	neutral: "border-border bg-bg-neutral text-text",
	success: "border-border-success-subtle bg-bg-success-subtler text-text-success-bolder",
	danger: "border-border-danger-subtle bg-bg-danger-subtler text-text-danger-bolder",
	information: "border-border-information-subtle bg-bg-information-subtler text-text-information-bolder",
	discovery: "border-border-discovery-subtle bg-bg-discovery-subtler text-text-discovery-bolder",
	warning: "border-border-warning-subtle bg-bg-warning-subtler text-text-warning-bolder",
	"accent-red":
		"border-border-accent-red-subtle bg-bg-accent-red-subtler text-text-accent-red-bolder",
	"accent-orange":
		"border-border-accent-orange-subtle bg-bg-accent-orange-subtler text-text-accent-orange-bolder",
	"accent-yellow":
		"border-border-accent-yellow-subtle bg-bg-accent-yellow-subtler text-text-accent-yellow-bolder",
	"accent-lime":
		"border-border-accent-lime-subtle bg-bg-accent-lime-subtler text-text-accent-lime-bolder",
	"accent-green":
		"border-border-accent-green-subtle bg-bg-accent-green-subtler text-text-accent-green-bolder",
	"accent-teal":
		"border-border-accent-teal-subtle bg-bg-accent-teal-subtler text-text-accent-teal-bolder",
	"accent-blue":
		"border-border-accent-blue-subtle bg-bg-accent-blue-subtler text-text-accent-blue-bolder",
	"accent-purple":
		"border-border-accent-purple-subtle bg-bg-accent-purple-subtler text-text-accent-purple-bolder",
	"accent-magenta":
		"border-border-accent-magenta-subtle bg-bg-accent-magenta-subtler text-text-accent-magenta-bolder",
	"accent-gray":
		"border-border bg-bg-accent-gray-subtlest text-text-accent-gray-bolder",
} as const

const lozengeLeadingIconToneClasses = {
	neutral: "text-icon-subtlest",
	success: "text-icon-success",
	danger: "text-icon-danger",
	information: "text-icon-information",
	discovery: "text-icon-discovery",
	warning: "text-icon-warning",
	"accent-red": "text-icon-accent-red",
	"accent-orange": "text-icon-accent-orange",
	"accent-yellow": "text-icon-accent-yellow",
	"accent-lime": "text-icon-accent-lime",
	"accent-green": "text-icon-accent-green",
	"accent-teal": "text-icon-accent-teal",
	"accent-blue": "text-icon-accent-blue",
	"accent-purple": "text-icon-accent-purple",
	"accent-magenta": "text-icon-accent-magenta",
	"accent-gray": "text-icon-accent-gray",
} as const

const lozengeTriggerToneClasses = {
	neutral:
		"border-border bg-bg-neutral text-text hover:bg-bg-neutral-hovered active:bg-bg-neutral-pressed data-[selected=true]:bg-bg-neutral-pressed",
	success:
		"border-border-success-subtle bg-bg-success-subtler text-text-success-bolder hover:bg-bg-success-subtler-hovered active:bg-bg-success-subtler-pressed data-[selected=true]:bg-bg-success-subtler-pressed",
	danger:
		"border-border-danger-subtle bg-bg-danger-subtler text-text-danger-bolder hover:bg-bg-danger-subtler-hovered active:bg-bg-danger-subtler-pressed data-[selected=true]:bg-bg-danger-subtler-pressed",
	information:
		"border-border-information-subtle bg-bg-information-subtler text-text-information-bolder hover:bg-bg-information-subtler-hovered active:bg-bg-information-subtler-pressed data-[selected=true]:bg-bg-information-subtler-pressed",
	discovery:
		"border-border-discovery-subtle bg-bg-discovery-subtler text-text-discovery-bolder hover:bg-bg-discovery-subtler-hovered active:bg-bg-discovery-subtler-pressed data-[selected=true]:bg-bg-discovery-subtler-pressed",
	warning:
		"border-border-warning-subtle bg-bg-warning-subtler text-text-warning-bolder hover:bg-bg-warning-subtler-hovered active:bg-bg-warning-subtler-pressed data-[selected=true]:bg-bg-warning-subtler-pressed",
	"accent-red":
		"border-border-accent-red-subtle bg-bg-accent-red-subtler text-text-accent-red-bolder hover:bg-bg-accent-red-subtler-hovered active:bg-bg-accent-red-subtler-pressed data-[selected=true]:bg-bg-accent-red-subtler-pressed",
	"accent-orange":
		"border-border-accent-orange-subtle bg-bg-accent-orange-subtler text-text-accent-orange-bolder hover:bg-bg-accent-orange-subtler-hovered active:bg-bg-accent-orange-subtler-pressed data-[selected=true]:bg-bg-accent-orange-subtler-pressed",
	"accent-yellow":
		"border-border-accent-yellow-subtle bg-bg-accent-yellow-subtler text-text-accent-yellow-bolder hover:bg-bg-accent-yellow-subtler-hovered active:bg-bg-accent-yellow-subtler-pressed data-[selected=true]:bg-bg-accent-yellow-subtler-pressed",
	"accent-lime":
		"border-border-accent-lime-subtle bg-bg-accent-lime-subtler text-text-accent-lime-bolder hover:bg-bg-accent-lime-subtler-hovered active:bg-bg-accent-lime-subtler-pressed data-[selected=true]:bg-bg-accent-lime-subtler-pressed",
	"accent-green":
		"border-border-accent-green-subtle bg-bg-accent-green-subtler text-text-accent-green-bolder hover:bg-bg-accent-green-subtler-hovered active:bg-bg-accent-green-subtler-pressed data-[selected=true]:bg-bg-accent-green-subtler-pressed",
	"accent-teal":
		"border-border-accent-teal-subtle bg-bg-accent-teal-subtler text-text-accent-teal-bolder hover:bg-bg-accent-teal-subtler-hovered active:bg-bg-accent-teal-subtler-pressed data-[selected=true]:bg-bg-accent-teal-subtler-pressed",
	"accent-blue":
		"border-border-accent-blue-subtle bg-bg-accent-blue-subtler text-text-accent-blue-bolder hover:bg-bg-accent-blue-subtler-hovered active:bg-bg-accent-blue-subtler-pressed data-[selected=true]:bg-bg-accent-blue-subtler-pressed",
	"accent-purple":
		"border-border-accent-purple-subtle bg-bg-accent-purple-subtler text-text-accent-purple-bolder hover:bg-bg-accent-purple-subtler-hovered active:bg-bg-accent-purple-subtler-pressed data-[selected=true]:bg-bg-accent-purple-subtler-pressed",
	"accent-magenta":
		"border-border-accent-magenta-subtle bg-bg-accent-magenta-subtler text-text-accent-magenta-bolder hover:bg-bg-accent-magenta-subtler-hovered active:bg-bg-accent-magenta-subtler-pressed data-[selected=true]:bg-bg-accent-magenta-subtler-pressed",
	"accent-gray":
		"border-border bg-bg-accent-gray-subtlest text-text-accent-gray-bolder hover:bg-bg-accent-gray-subtlest-hovered active:bg-bg-accent-gray-subtlest-pressed data-[selected=true]:bg-bg-accent-gray-subtlest-pressed",
} as const

const lozengeVariants = cva(
	"inline-flex w-fit max-w-[200px] shrink-0 items-center overflow-hidden whitespace-nowrap border font-normal select-none",
	{
		variants: {
			variant: lozengeToneClasses,
			size: {
				compact: "h-5 rounded-sm px-1 py-0.5 text-xs leading-4",
				spacious: "h-8 rounded-md px-3 py-1 text-sm leading-5",
			},
			// ADS now renders the filled visual by default, but the prop remains for compatibility.
			isBold: {
				true: "",
				false: "",
			},
		},
		defaultVariants: {
			variant: "neutral",
			size: "compact",
			isBold: false,
		},
	}
)

const lozengeTriggerVariants = cva(
	"inline-flex w-fit max-w-[200px] shrink-0 items-center overflow-hidden whitespace-nowrap border font-normal select-none outline-none transition-[background-color,border-color,color,opacity] duration-normal ease-out-practical motion-reduce:transition-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-(--opacity-disabled)",
	{
		variants: {
			variant: lozengeTriggerToneClasses,
			size: {
				compact: "h-5 rounded-sm px-1 py-0.5 text-xs leading-4",
				spacious: "h-8 rounded-md px-3 py-1 text-sm leading-5",
			},
			isBold: {
				true: "",
				false: "",
			},
		},
		defaultVariants: {
			variant: "neutral",
			size: "compact",
			isBold: false,
		},
	}
)

type LozengeVariant = NonNullable<VariantProps<typeof lozengeVariants>["variant"]>
type LozengeSize = NonNullable<VariantProps<typeof lozengeVariants>["size"]>
type BadgeVariant = NonNullable<BadgeProps["variant"]>

const lozengeMetricBadgeVariants: Record<LozengeVariant, BadgeVariant> = {
	neutral: "neutral",
	success: "successBold",
	danger: "dangerBold",
	information: "informationBold",
	discovery: "discoveryBold",
	warning: "warningBold",
	"accent-red": "neutral",
	"accent-orange": "neutral",
	"accent-yellow": "neutral",
	"accent-lime": "neutral",
	"accent-green": "neutral",
	"accent-teal": "neutral",
	"accent-blue": "neutral",
	"accent-purple": "neutral",
	"accent-magenta": "neutral",
	"accent-gray": "neutral",
}

// A "verbatim" leading element (product logo, IconTile, BrandLogoMark, avatar)
// keeps its own colors and is rendered as-is inside a fixed leading box —
// mirroring Tag's `elemBefore` front slot. Plain `<Icon>` / atlaskit icons are
// still routed through `<Icon>` and tinted with the variant tone.
function isPlainLozengeIcon(icon: ReactNode): boolean {
	if (!isValidElement(icon)) {
		return false
	}
	return (icon as ReactElement).type === Icon
}

function renderLozengeIcon(icon: ReactNode) {
	if (!isValidElement(icon)) {
		return icon
	}

	const iconElement = icon as ReactElement<{ className?: string }>

	if (iconElement.type === Icon) {
		return cloneElement(iconElement as ReactElement<React.ComponentProps<typeof Icon>>, {
			className: cn("leading-none", iconElement.props.className),
		})
	}

	return (
		<Icon
			render={iconElement}
			aria-hidden
			className="leading-none"
		/>
	)
}

function LozengeContent({
	variant,
	size,
	icon,
	metric,
	children,
	trailing,
}: Readonly<{
	variant: LozengeVariant
	size: LozengeSize
	icon?: ReactNode
	metric?: string | number
	children?: ReactNode
	trailing?: ReactNode
}>) {
	const hasLeadingElement = icon != null
	// Mirror Tag's front slot exactly: a fixed 16x16 leading box that the
	// element fills (`[&>*]:size-full [&>svg]:size-4`). Verbatim logos/avatars
	// keep their own colors; a plain tinted icon gets the tone color on the box
	// (same as Tag's `colorClasses.icon`) and fills the box at 16x16.
	const isPlainIcon = isPlainLozengeIcon(icon)
	return (
		<span
			className={cn(
				"flex min-w-0 items-center",
				size === "compact" ? "gap-1" : "gap-1.5"
			)}
		>
			{hasLeadingElement ? (
				<span
					data-slot="lozenge-leading-icon"
					className={cn(
						"flex size-4 shrink-0 items-center justify-center [&>*]:size-full [&>svg]:size-4",
						isPlainIcon && lozengeLeadingIconToneClasses[variant]
					)}
				>
					{renderLozengeIcon(icon)}
				</span>
			) : null}
			{children != null ? <span className="truncate">{children}</span> : null}
			{metric != null ? (
				<Badge
					variant={lozengeMetricBadgeVariants[variant]}
					max={false}
					className={cn(
						"min-w-0 shrink-0",
						size === "spacious" && "h-5 rounded-sm px-1.5 text-sm leading-5"
					)}
				>
					{metric}
				</Badge>
			) : null}
			{trailing}
		</span>
	)
}

export interface LozengeProps
	extends React.ComponentProps<"span">,
		VariantProps<typeof lozengeVariants> {
	maxWidth?: string | number
	/**
	 * Element rendered before the lozenge text. A plain `<Icon>` is tinted to the
	 * variant tone; a logo, `IconTile`, `BrandLogoMark`, or avatar is rendered
	 * verbatim (keeping its own colors) in a fixed leading box — mirroring Tag's
	 * `elemBefore` front slot.
	 */
	elemBefore?: ReactNode
	/** @deprecated Use `elemBefore`. Kept as an alias for back-compat. */
	icon?: ReactNode
	metric?: string | number
	trailingMetric?: string | number
}

function Lozenge({
	className,
	variant = "neutral",
	size = "compact",
	isBold = false,
	maxWidth,
	elemBefore,
	icon,
	metric,
	trailingMetric,
	children,
	style,
	...props
}: Readonly<LozengeProps>) {
	const resolvedVariant = variant ?? "neutral"
	const resolvedSize = size ?? "compact"
	const resolvedMetric = metric ?? trailingMetric
	const leading = elemBefore ?? icon
	// Any leading element (plain tinted icon, logo, tile, or avatar) tightens the
	// leading inset to match Tag's front slot: the leading box owns the spacing,
	// so the lozenge drops to a 1px left inset.
	const hasLeadingElement = leading != null

	return (
		<span
			data-slot="lozenge"
			data-variant={resolvedVariant}
			data-size={resolvedSize}
			className={cn(
				lozengeVariants({ variant: resolvedVariant, size: resolvedSize, isBold }),
				hasLeadingElement && (resolvedSize === "compact" ? "ps-px" : "ps-1.5"),
				resolvedMetric != null && (resolvedSize === "compact" ? "pr-px" : "pr-1"),
				className
			)}
			style={maxWidth != null ? { ...style, maxWidth } : style}
			{...props}
		>
			<LozengeContent
				variant={resolvedVariant}
				size={resolvedSize}
				icon={leading}
				metric={resolvedMetric}
			>
				{children}
			</LozengeContent>
		</span>
	)
}

export interface LozengeDropdownTriggerProps
	extends React.ComponentProps<"button">,
		VariantProps<typeof lozengeTriggerVariants> {
	icon?: ReactNode
	appearance?: "lozenge" | "icon" | "text"
	isLoading?: boolean
	isSelected?: boolean
	maxWidth?: string | number
	metric?: string | number
	trailingMetric?: string | number
}

function LozengeDropdownTrigger({
	className,
	variant = "neutral",
	size = "compact",
	isBold = false,
	icon,
	appearance = "lozenge",
	isLoading = false,
	isSelected,
	maxWidth,
	metric,
	trailingMetric,
	children,
	style,
	disabled,
	"aria-expanded": ariaExpanded,
	...props
}: Readonly<LozengeDropdownTriggerProps>) {
	const resolvedVariant = variant ?? "neutral"
	const resolvedSize = size ?? "compact"
	const resolvedMetric = metric ?? trailingMetric
	const isOpen = isSelected || ariaExpanded === true || ariaExpanded === "true"
	// A leading front-slot element (the `icon`) owns its own 16x16 box, so the
	// trigger tightens its left inset to match `Lozenge` (and Tag's front slot):
	// 1px for compact, 6px for spacious — instead of the default 4px / 12px.
	const hasLeadingElement = icon != null

	return (
		<button
			type="button"
			data-slot="lozenge-dropdown-trigger"
			data-variant={resolvedVariant}
			data-size={resolvedSize}
			data-selected={isOpen ? "true" : undefined}
			data-appearance={appearance}
			aria-busy={isLoading || undefined}
			aria-expanded={ariaExpanded}
			disabled={disabled || isLoading}
			className={cn(
				lozengeTriggerVariants({ variant: resolvedVariant, size: resolvedSize, isBold }),
				appearance === "icon" && "size-8 justify-center rounded-md border-0 p-0",
				appearance === "text" && "min-h-8 gap-2 rounded-sm border-0 bg-transparent px-0 text-sm font-normal text-text hover:bg-bg-neutral-subtle-hovered data-selected:bg-bg-neutral-subtle-hovered data-selected:text-text",
				isLoading && "opacity-(--opacity-loading)",
				appearance === "lozenge" && hasLeadingElement && (resolvedSize === "compact" ? "ps-px" : "ps-1.5"),
				appearance === "lozenge" && resolvedMetric != null && (resolvedSize === "compact" ? "pr-px" : "pr-1"),
				className
			)}
			style={maxWidth != null ? { ...style, maxWidth } : style}
			{...props}
		>
			{appearance === "icon" ? <span aria-hidden className="flex size-4 items-center justify-center">{isLoading ? <Spinner label="Loading" size="sm" /> : icon}</span> : appearance === "text" ? <>{icon}{children}</> : <LozengeContent
				variant={resolvedVariant}
				size={resolvedSize}
				icon={icon}
				metric={resolvedMetric}
				trailing={
					isLoading ? (
						<Spinner
							className="shrink-0 text-current"
							label="Loading"
							size={resolvedSize === "compact" ? "xs" : "sm"}
						/>
					) : (
						<Icon
							render={<ChevronDownIcon label="" size="small" />}
							aria-hidden
							className="shrink-0 text-current"
						/>
					)
				}
			>
				{children}
			</LozengeContent>}
		</button>
	)
}

export {
	Lozenge,
	LozengeDropdownTrigger,
	// react-doctor-disable-next-line react-doctor/only-export-components -- This component module intentionally exports colocated non-component API used by consumers.
	lozengeVariants,
}
