"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"

import { cn } from "@/lib/utils"

function Popover(props: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger(props: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverAnchorVisibility({
	anchorHidden,
	open,
	onAnchorHidden,
}: Readonly<{
	anchorHidden: boolean
	open: boolean
	onAnchorHidden: () => void
}>) {
	const dismiss = React.useEffectEvent(onAnchorHidden)
	React.useEffect(() => {
		if (open && anchorHidden) dismiss()
	}, [open, anchorHidden])
	return null
}

function PopoverContent({
	anchor,
	onAnchorHidden,
  className,
  positionerClassName,
  align = "center",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<
    PopoverPrimitive.Positioner.Props,
		"anchor" | "align" | "alignOffset" | "side" | "sideOffset"
  > & {
		/** Called when the anchor is fully clipped by its scroll ancestors or viewport. */
		onAnchorHidden?: () => void
    positionerClassName?: string
  }) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
				anchor={anchor}
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className={cn("isolate z-[200]", positionerClassName)}
				render={onAnchorHidden ? (positionerProps, state) => (
					<div {...positionerProps}>
						<PopoverAnchorVisibility
							anchorHidden={state.anchorHidden}
							open={state.open}
							onAnchorHidden={onAnchorHidden}
						/>
						{positionerProps.children}
					</div>
				) : undefined}
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            "bg-popover text-popover-foreground flex flex-col gap-2.5 rounded-lg p-2.5 text-sm shadow-xl z-[200] w-72 origin-(--transform-origin) outline-hidden transition-[opacity,translate] duration-normal ease-out-practical motion-reduce:transition-none data-ending-style:duration-fast data-ending-style:ease-in data-starting-style:opacity-0 data-ending-style:opacity-0 data-[side=bottom]:data-starting-style:-translate-y-2 data-[side=top]:data-starting-style:translate-y-2 data-[side=left]:data-starting-style:translate-x-2 data-[side=right]:data-starting-style:-translate-x-2 data-[side=inline-start]:data-starting-style:translate-x-2 data-[side=inline-end]:data-starting-style:-translate-x-2 data-[side=bottom]:data-ending-style:-translate-y-2 data-[side=top]:data-ending-style:translate-y-2 data-[side=left]:data-ending-style:translate-x-2 data-[side=right]:data-ending-style:-translate-x-2 data-[side=inline-start]:data-ending-style:translate-x-2 data-[side=inline-end]:data-ending-style:-translate-x-2",
            className
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

function PopoverHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="popover-header"
      className={cn("flex flex-col gap-0.5 text-sm", className)}
      {...props}
    />
  )
}

function PopoverTitle({ className, ...props }: PopoverPrimitive.Title.Props) {
  return (
    <PopoverPrimitive.Title
      data-slot="popover-title"
      className={cn("font-medium", className)}
      {...props}
    />
  )
}

function PopoverDescription({
  className,
  ...props
}: PopoverPrimitive.Description.Props) {
  return (
    <PopoverPrimitive.Description
      data-slot="popover-description"
      className={cn("text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
}
