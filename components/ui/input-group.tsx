"use client"

// oxlint-disable react-doctor/prefer-tag-over-role -- This file uses ARIA roles for custom generated visuals or composite widgets where the suggested native tag would change semantics or behavior.

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="input-group"
			role="group"
			className={cn(
				"group/input-group border-input relative flex w-full min-w-0 items-center rounded-lg border transition-colors outline-none",
				"h-8 has-[>textarea]:h-auto has-[>[data-slot=input-group-control-container]]:h-auto",
				// Alignment variants.
				"has-[>[data-align=inline-start]]:[&>input]:pl-2 has-[>[data-align=inline-end]]:[&>input]:pr-2",
				"has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-start]]:[&>input]:pb-3",
				"has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-end]]:[&>input]:pt-3",
				// Focus state.
				"has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 has-[[data-slot=input-group-control]:focus-visible]:ring-3",
				// Error state.
				"has-[[data-slot][aria-invalid=true]]:ring-destructive/20 has-[[data-slot][aria-invalid=true]]:border-destructive has-[[data-slot][aria-invalid=true]]:ring-3 has-[[data-slot]:user-invalid]:ring-destructive/20 has-[[data-slot]:user-invalid]:border-destructive has-[[data-slot]:user-invalid]:ring-3",
				// Disabled state.
				"has-[[data-slot=input-group-control]:disabled]:bg-input/50 has-[[data-slot=input-group-control]:disabled]:opacity-50",
				// Combobox integration.
				"in-data-[slot=combobox-content]:focus-within:border-inherit in-data-[slot=combobox-content]:focus-within:ring-0",
				className
			)}
			{...props}
		/>
	)
}

const inputGroupAddonVariants = cva(
  "text-muted-foreground flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-sm font-medium select-none [&>svg:not([class*='size-'])]:size-4 [&_svg]:text-icon-subtle [&_button_svg]:text-inherit [&>kbd]:rounded-[calc(var(--radius)-5px)] group-data-[disabled=true]/input-group:opacity-50",
  {
    variants: {
      align: {
        "inline-start":
          "order-first pl-2.5 has-[>button]:ml-[-0.45rem] has-[>kbd]:ml-[-0.35rem]",
        "inline-end":
          "order-last pr-2.5 has-[>button]:mr-[-0.45rem] has-[>kbd]:mr-[-0.35rem]",
        "block-start":
          "order-first w-full justify-start px-2.5 pt-2.5 [.border-b]:pb-2.5 group-has-[>input]/input-group:pt-2",
        "block-end":
          "order-last w-full justify-start px-2.5 pb-2.5 [.border-t]:pt-2.5 group-has-[>input]/input-group:pb-2",
      },
    },
    defaultVariants: {
      align: "inline-start",
    },
  }
)

function InputGroupAddon({
  className,
  align = "inline-start",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
	return (
		<div
			role="group"
			data-slot="input-group-addon"
			data-align={align}
			className={cn(inputGroupAddonVariants({ align }), className)}
			onClick={(e) => {
				if ((e.target as HTMLElement).closest("button")) {
					return
				}

				e.currentTarget.parentElement
					?.querySelector<HTMLElement>("[data-slot=input-group-control]")
					?.focus()
			}}
			{...props}
		/>
	)
}

const inputGroupButtonVariants = cva(
  "text-sm shadow-none flex gap-2 items-center",
  {
    variants: {
      size: {
        xs: "h-6 gap-1 px-2 rounded-[calc(var(--radius)-5px)] [&>svg:not([class*='size-'])]:size-3.5 has-[>svg]:px-2",
        sm: "h-8 px-2.5 gap-1.5 rounded-md has-[>svg]:px-2.5",
        "icon-xs": "size-6 rounded-md p-0 has-[>svg]:p-0",
        "icon-sm": "size-8 p-0 has-[>svg]:p-0",
      },
      shape: {
        default: "",
        circle: "rounded-full",
      },
    },
    defaultVariants: {
      size: "xs",
      shape: "default",
    },
  }
)

function InputGroupButton({
  className,
  type = "button",
  variant = "ghost",
  size = "xs",
  shape,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size" | "type"> &
  VariantProps<typeof inputGroupButtonVariants> & {
    type?: "button" | "submit" | "reset"
  }) {
  return (
    <Button
      type={type}
      data-size={size}
      variant={variant}
      size={size === "icon-xs" ? "icon-compact" : undefined}
      className={cn(inputGroupButtonVariants({ size, shape }), className)}
      {...props}
    />
  )
}

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "text-muted-foreground flex items-center gap-2 text-sm [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function InputGroupInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <Input
      data-slot="input-group-control"
      variant="none"
      className={cn(
        "flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0",
        // Keep the field transparent even while the browser previews an
        // autocomplete suggestion (which otherwise paints a UA blue block).
        // bg-clip-text strips the autofill background; the transparent inset
        // shadow (with !important to beat utility `shadow-none`) keeps it clear.
        "[&:-webkit-autofill]:[-webkit-background-clip:text] [&:-webkit-autofill]:[box-shadow:0_0_0_1000px_transparent_inset!important] [&:-webkit-autofill]:[-webkit-text-fill-color:var(--color-foreground)]",
        className
      )}
      {...props}
    />
  )
}

function InputGroupTextarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
	return (
		<div
			data-slot="input-group-control-container"
			className="flex min-w-0 flex-1 self-stretch cursor-text px-2.5 has-disabled:cursor-not-allowed"
			onClick={(event) => {
				event.currentTarget
					.querySelector<HTMLElement>("[data-slot=input-group-control]")
					?.focus()
			}}
		>
			<Textarea
				data-slot="input-group-control"
				variant="none"
				className={cn(
					"block min-w-0 w-full resize-none rounded-none border-0 bg-transparent px-0 py-2 shadow-none focus-visible:ring-0",
					className
				)}
				{...props}
			/>
		</div>
	)
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
}
