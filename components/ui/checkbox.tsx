"use client"

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"

import { cn } from "@/lib/utils"
import CheckMarkIcon from "@atlaskit/icon/core/check-mark"
import MinusIcon from "@atlaskit/icon/core/minus"

export interface CheckboxProps extends CheckboxPrimitive.Root.Props {
	isIndeterminate?: boolean
}

function Checkbox({
	className,
	indeterminate,
	isIndeterminate,
	...props
}: Readonly<CheckboxProps>) {
	return (
		<CheckboxPrimitive.Root
			data-slot="checkbox"
			indeterminate={indeterminate ?? isIndeterminate}
			className={cn(
				"border-input bg-bg-input hover:bg-bg-input-hovered active:bg-bg-input-pressed data-checked:border-border-selected data-checked:bg-bg-selected-bold data-checked:text-text-inverse data-checked:hover:bg-bg-selected-bold-hovered data-checked:active:bg-bg-selected-bold-pressed data-indeterminate:border-border-selected data-indeterminate:bg-bg-selected-bold data-indeterminate:text-text-inverse data-indeterminate:hover:bg-bg-selected-bold-hovered data-indeterminate:active:bg-bg-selected-bold-pressed aria-invalid:border-destructive user-invalid:border-destructive focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 user-invalid:ring-destructive/20 flex size-4 items-center justify-center rounded-sm border transition-colors group-has-disabled/field:pointer-events-none group-has-disabled/field:opacity-(--opacity-disabled) focus-visible:ring-3 aria-invalid:ring-3 user-invalid:ring-3 peer relative shrink-0 outline-none after:absolute after:-inset-[5px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-(--opacity-disabled)",
				className
			)}
			{...props}
		>
			<CheckboxPrimitive.Indicator
				data-slot="checkbox-indicator"
				className="[&>svg]:size-3.5 grid place-content-center text-current transition-none"
			>
				{(indeterminate ?? isIndeterminate) ? (
					<MinusIcon label="" size="small" />
				) : (
					<CheckMarkIcon label="" size="small" />
				)}
			</CheckboxPrimitive.Indicator>
		</CheckboxPrimitive.Root>
	)
}

export { Checkbox }
