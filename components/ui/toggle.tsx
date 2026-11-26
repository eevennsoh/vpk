"use client"

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const toggleVariants = cva(
	"focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 aria-invalid:border-destructive user-invalid:ring-destructive/20 user-invalid:border-destructive gap-1.5 rounded-md border border-transparent bg-clip-padding text-sm font-medium transition-[background-color,border-color,box-shadow,color,opacity] [&_svg:not([class*='size-'])]:size-4 group/toggle inline-flex items-center justify-center whitespace-nowrap outline-none select-none shrink-0 focus-visible:ring-3 user-invalid:ring-3 disabled:pointer-events-none disabled:opacity-(--opacity-disabled) [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:text-icon-subtle",
	{
		variants: {
			variant: {
				default:
					"bg-transparent text-foreground hover:bg-bg-neutral-subtle-hovered hover:text-foreground active:bg-bg-neutral-subtle-pressed data-pressed:bg-bg-selected data-pressed:text-text-selected data-pressed:hover:bg-bg-selected-hovered data-pressed:active:bg-bg-selected-pressed data-pressed:[&_svg]:text-icon-selected disabled:text-text-disabled",
				subtle:
					"bg-transparent text-text-subtlest hover:bg-bg-neutral-subtle-hovered active:bg-bg-neutral-subtle-pressed data-pressed:text-foreground [&_svg]:text-icon-subtlest data-pressed:[&_svg]:text-icon disabled:text-text-disabled",
				outline:
					"border-border border bg-transparent text-foreground hover:bg-bg-neutral-hovered active:bg-bg-neutral-pressed data-pressed:border-border-selected data-pressed:bg-bg-selected data-pressed:text-text-selected data-pressed:hover:bg-bg-selected-hovered data-pressed:active:bg-bg-selected-pressed data-pressed:[&_svg]:text-icon-selected disabled:text-text-disabled",
			},
			size: {
				default: "h-8 min-w-8 px-2",
				icon: "size-8 p-0",
				sm: "h-6 min-w-6 rounded-md px-1.5 text-[0.8rem]",
				lg: "h-9 min-w-9 px-2.5",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	}
)

export interface ToggleProps
	extends TogglePrimitive.Props,
		VariantProps<typeof toggleVariants> {}

function Toggle({
	className,
	variant = "default",
	size = "default",
	...props
}: Readonly<ToggleProps>) {
	return (
		<TogglePrimitive
			data-slot="toggle"
			className={cn(toggleVariants({ variant, size, className }))}
			{...props}
		/>
	)
}

// react-doctor-disable-next-line react-doctor/only-export-components -- This component module intentionally exports colocated non-component API used by consumers.
export { Toggle, toggleVariants }
