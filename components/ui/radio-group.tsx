"use client"

import { Radio as RadioPrimitive } from "@base-ui/react/radio"
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group"

import { cn } from "@/lib/utils"

export type RadioGroupProps = RadioGroupPrimitive.Props

function RadioGroup({ className, ...props }: Readonly<RadioGroupProps>) {
	return (
		<RadioGroupPrimitive
			data-slot="radio-group"
			className={cn("grid gap-0 w-full", className)}
			{...props}
		/>
	)
}

export type RadioGroupItemProps = RadioPrimitive.Root.Props

function RadioGroupItem({ className, ...props }: Readonly<RadioGroupItemProps>) {
	return (
		<RadioPrimitive.Root
			data-slot="radio-group-item"
			className={cn(
				"border-input bg-bg-input hover:bg-bg-input-hovered active:bg-bg-input-pressed data-checked:border-border-selected data-checked:bg-bg-selected-bold data-checked:text-text-inverse data-checked:hover:bg-bg-selected-bold-hovered data-checked:active:bg-bg-selected-bold-pressed focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 aria-invalid:border-destructive user-invalid:ring-destructive/20 user-invalid:border-destructive data-invalid:ring-destructive/20 data-invalid:border-destructive flex size-4 rounded-full border transition-colors focus-visible:ring-3 aria-invalid:ring-3 user-invalid:ring-3 data-invalid:ring-3 peer relative aspect-square shrink-0 outline-none after:absolute after:-inset-[5px] group-has-disabled/field:pointer-events-none group-has-disabled/field:opacity-(--opacity-disabled) disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-(--opacity-disabled)",
				className
			)}
			{...props}
		>
			<RadioPrimitive.Indicator
				data-slot="radio-group-indicator"
				className="flex size-full items-center justify-center"
			>
				<span className="size-1.5 rounded-full bg-current" />
			</RadioPrimitive.Indicator>
		</RadioPrimitive.Root>
	)
}

export {
	RadioGroup,
	RadioGroupItem,
}
