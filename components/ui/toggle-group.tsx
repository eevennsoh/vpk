"use client"

// oxlint-disable react-doctor/jsx-no-constructed-context-values -- Context values in this file intentionally combine live state and setters; extracting them would not reduce meaningful consumer churn.

import * as React from "react"
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group"
import { type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { toggleVariants } from "@/components/ui/toggle"

const ToggleGroupContext = React.createContext<
	VariantProps<typeof toggleVariants> & {
		spacing?: number
		orientation?: "horizontal" | "vertical"
	}
>({
	size: "default",
	variant: "default",
	spacing: 0,
	orientation: "horizontal",
})

interface ToggleGroupProps
	extends ToggleGroupPrimitive.Props,
		VariantProps<typeof toggleVariants> {
	spacing?: number
	orientation?: "horizontal" | "vertical"
}

function ToggleGroup({
	className,
	variant,
	size,
	spacing = 0,
	orientation = "horizontal",
	children,
	...props
}: Readonly<ToggleGroupProps>) {
	return (
		<ToggleGroupPrimitive
			data-slot="toggle-group"
			data-variant={variant}
			data-size={size}
			data-spacing={spacing}
			data-orientation={orientation}
			style={{ "--gap": spacing } as React.CSSProperties}
			className={cn(
				"rounded-md group/toggle-group flex w-fit flex-row items-center gap-[--spacing(var(--gap))] data-vertical:flex-col data-vertical:items-stretch",
				spacing === 0 && [
					"*:data-slot:rounded-none *:data-slot:px-3",
					"[&>[data-slot][data-size=icon]]:p-0!",
					orientation === "horizontal" &&
						"[&>[data-slot]:first-child]:rounded-l-md! [&>[data-slot]:not(:has(~[data-slot]))]:rounded-r-md!",
					orientation === "vertical" &&
						"[&>[data-slot]:first-child]:rounded-t-md! [&>[data-slot]:not(:has(~[data-slot]))]:rounded-b-md!",
					variant === "outline" && orientation === "horizontal" &&
						"[&>[data-slot]~[data-slot]]:-ml-px",
					variant === "outline" && orientation === "vertical" &&
						"[&>[data-slot]~[data-slot]]:-mt-px",
				],
				className
			)}
			{...props}
		>
			<ToggleGroupContext value={{ variant, size, spacing, orientation }}>
				{children}
			</ToggleGroupContext>
		</ToggleGroupPrimitive>
	)
}

interface ToggleGroupItemProps
	extends TogglePrimitive.Props,
		VariantProps<typeof toggleVariants> {}

function ToggleGroupItem({
	className,
	children,
	variant = "default",
	size = "default",
	...props
}: Readonly<ToggleGroupItemProps>) {
	const context = React.use(ToggleGroupContext)

	return (
		<TogglePrimitive
			data-slot="toggle-group-item"
			data-variant={context.variant || variant}
			data-size={context.size || size}
			data-spacing={context.spacing}
			className={cn(
				toggleVariants({
					variant: context.variant || variant,
					size: context.size || size,
				}),
				"relative shrink-0 focus:z-10 focus-visible:z-10 data-pressed:z-10",
				className
			)}
			{...props}
		>
			{children}
		</TogglePrimitive>
	)
}

export {
	ToggleGroup,
	ToggleGroupItem,
	type ToggleGroupProps,
	type ToggleGroupItemProps,
}
