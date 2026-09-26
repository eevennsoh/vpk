"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

const defaultButtonSize =
	"h-8 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2"
const compactIconSize =
	"[&_[data-slot=icon]:not([class*='size-'])]:size-3! [&_[data-slot=icon]:not([class*='size-'])>span]:size-3! [&_svg:not([class*='size-'])]:size-3!"
const defaultIconSize =
	"[&_[data-slot=icon]:not([class*='size-'])]:size-4! [&_[data-slot=icon]:not([class*='size-'])>span]:size-4! [&_svg:not([class*='size-'])]:size-4!"
const compactButtonSize =
	`h-6 gap-1.5 rounded-md px-3 in-data-[slot=button-group]:rounded-md ${compactIconSize}`
const defaultIconButtonSize = "size-8"
const compactIconButtonSize =
	`size-6 rounded-md in-data-[slot=button-group]:rounded-md ${compactIconSize}`

// Selected/disclosure styling belongs to the shared base so every current and
// future variant keeps the same state contract, including inside ButtonGroup.
const selectedButtonState =
	"aria-pressed:bg-bg-selected aria-pressed:text-text-selected aria-pressed:border-border-selected aria-pressed:hover:bg-bg-selected-hovered aria-pressed:active:bg-bg-selected-pressed aria-pressed:[&_[data-slot=icon]]:text-icon-selected aria-pressed:[&_svg]:text-icon-selected aria-expanded:bg-bg-selected aria-expanded:text-text-selected aria-expanded:border-border-selected aria-expanded:hover:bg-bg-selected-hovered aria-expanded:active:bg-bg-selected-pressed aria-expanded:[&_[data-slot=icon]]:text-icon-selected aria-expanded:[&_svg]:text-icon-selected"

const buttonVariants = cva(
	`${selectedButtonState} focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 aria-invalid:border-destructive rounded-md border border-transparent bg-clip-padding text-sm font-medium focus-visible:ring-3 aria-invalid:ring-3 [&_svg:not([class*='size-'])]:size-4 inline-flex items-center justify-center whitespace-nowrap transition-[background-color,border-color,box-shadow,color,opacity] [&_svg]:pointer-events-none shrink-0 [&_svg]:shrink-0 outline-none group/button select-none`,
	{
		variants: {
			selectedAppearance: {
				default: "",
				"icon-only": "aria-pressed:bg-transparent aria-pressed:border-transparent aria-pressed:focus-visible:border-ring aria-pressed:hover:bg-bg-neutral-subtle-hovered aria-pressed:active:bg-bg-neutral-subtle-pressed [&_svg]:text-inherit",
			},
			variant: {
				default:
					"bg-primary text-primary-foreground hover:bg-primary-hovered active:bg-primary-pressed disabled:pointer-events-none disabled:bg-bg-disabled disabled:text-text-disabled",
				outline:
					"border-border bg-bg-neutral-subtle text-text-subtle [&_svg]:text-icon-subtle hover:bg-bg-neutral-subtle-hovered active:bg-bg-neutral-subtle-pressed disabled:pointer-events-none disabled:opacity-(--opacity-disabled)",
				secondary:
					"bg-secondary text-text-subtle [&_svg]:text-icon-subtle hover:bg-secondary/80 active:bg-secondary/70 disabled:pointer-events-none disabled:opacity-(--opacity-disabled)",
				ghost:
					"text-text-subtle [&_svg]:text-icon-subtle hover:bg-bg-neutral-subtle-hovered active:bg-bg-neutral-subtle-pressed disabled:pointer-events-none disabled:opacity-(--opacity-disabled)",
				destructive:
					"bg-bg-danger text-text-danger hover:bg-bg-danger-hovered active:bg-bg-danger-pressed focus-visible:ring-destructive/20 focus-visible:border-border-danger disabled:pointer-events-none disabled:opacity-(--opacity-disabled)",
				link: "text-primary underline-offset-4 hover:underline active:text-link-pressed disabled:pointer-events-none disabled:opacity-(--opacity-disabled)",
				warning:
					"bg-warning text-warning-foreground hover:bg-warning-hovered active:bg-warning-pressed disabled:pointer-events-none disabled:bg-bg-disabled disabled:text-text-disabled",
				discovery:
					"bg-discovery text-discovery-foreground hover:bg-discovery-hovered active:bg-discovery-pressed disabled:pointer-events-none disabled:bg-bg-disabled disabled:text-text-disabled",
			},
			size: {
				default: defaultButtonSize,
				compact: compactButtonSize,
				icon: defaultIconButtonSize,
				"icon-compact": compactIconButtonSize,
			},
			iconSize: {
				default: defaultIconSize,
				compact: compactIconSize,
			},
			shape: {
				square: "",
				circle: "rounded-full!",
			},
		},
		defaultVariants: {
			selectedAppearance: "default",
			variant: "default",
			size: "default",
			shape: "square",
		},
	}
)

interface ButtonProps
	extends ButtonPrimitive.Props,
		VariantProps<typeof buttonVariants> {
	isLoading?: boolean
}

function Button({
	className,
	variant,
	size,
	iconSize,
	shape,
	selectedAppearance,
	isLoading = false,
	children,
	...props
}: Readonly<ButtonProps>) {
	return (
		<ButtonPrimitive
			data-slot="button"
			data-variant={variant ?? "default"}
			aria-busy={isLoading || undefined}
			className={cn(
				buttonVariants({ variant, size, iconSize, shape, selectedAppearance }),
				isLoading && "pointer-events-none opacity-(--opacity-loading)",
				className
			)}
			{...props}
		>
			{isLoading && <Spinner variant="inherit" />}
			{children}
		</ButtonPrimitive>
	)
}

// react-doctor-disable-next-line react-doctor/only-export-components -- This component module intentionally exports colocated non-component API used by consumers.
export { Button, buttonVariants, type ButtonProps }
