import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

type InputVariant = "default" | "subtle" | "none"

export interface InputProps extends InputPrimitive.Props {
	variant?: InputVariant
	isCompact?: boolean
	isMonospaced?: boolean
}

function Input({
	className,
	variant = "default",
	isCompact = false,
	isMonospaced = false,
	...props
}: Readonly<InputProps>) {
	return (
		<InputPrimitive
			data-slot="input"
			data-variant={variant}
			className={cn(
				"placeholder:text-muted-foreground [&[type=search]]:placeholder:text-text-subtle focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 aria-invalid:border-destructive user-invalid:ring-destructive/20 user-invalid:border-destructive h-8 w-full min-w-0 rounded-lg border border-transparent bg-transparent px-2.5 py-1 text-sm transition-colors file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground focus-visible:ring-3 aria-invalid:ring-3 user-invalid:ring-3 outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-(--opacity-disabled) read-only:cursor-default read-only:border-transparent read-only:bg-transparent read-only:hover:border-transparent read-only:hover:bg-transparent read-only:focus-visible:border-transparent read-only:focus-visible:ring-0",
				"data-[variant=default]:border-input data-[variant=default]:bg-bg-input data-[variant=default]:hover:bg-bg-input-hovered data-[variant=default]:active:bg-bg-input-pressed",
				"data-[variant=subtle]:border-transparent data-[variant=subtle]:hover:bg-bg-input-hovered data-[variant=subtle]:active:bg-bg-input-pressed data-[variant=subtle]:focus-visible:bg-bg-input",
				"data-[variant=none]:border-0 data-[variant=none]:hover:bg-transparent data-[variant=none]:active:bg-transparent",
				// Border state overrides must be variant-scoped. The resting
				// `data-[variant=*]:border-*` rules above have the same specificity as the
				// unscoped `focus-visible:` / `aria-invalid:` borders and Tailwind emits
				// data-attribute variants last, so the resting border would otherwise win.
				// (`none` needs no entry — `border-0` leaves nothing to colour.)
				"data-[variant=default]:focus-visible:border-ring data-[variant=default]:aria-invalid:border-destructive data-[variant=default]:user-invalid:border-destructive",
				"data-[variant=subtle]:focus-visible:border-ring data-[variant=subtle]:aria-invalid:border-destructive data-[variant=subtle]:user-invalid:border-destructive",
				// Read-only fields stay inert on focus, each holding its own resting
				// border rather than picking up the focus ring above.
				"data-[variant=default]:read-only:focus-visible:border-input data-[variant=subtle]:read-only:focus-visible:border-transparent",
				isCompact && "h-7 px-2 file:h-5",
				isMonospaced && "font-mono",
				className
			)}
			{...props}
		/>
	)
}

export { Input }
