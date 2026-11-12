"use client"

// oxlint-disable react-doctor/no-multi-comp -- This module intentionally colocates coupled component parts as a compound component or demo surface API.

import * as React from "react"
import { PreviewCard as PreviewCardPrimitive } from "@base-ui/react/preview-card"

import { cn } from "@/lib/utils"

type HoverCardProps<Payload = unknown> = PreviewCardPrimitive.Root.Props<Payload> & {
  openDelay?: number
  closeDelay?: number
}

type HoverCardHandle<Payload = unknown> = PreviewCardPrimitive.Handle<Payload>
type HoverCardTriggerProps<Payload = unknown> = PreviewCardPrimitive.Trigger.Props<Payload>

// Base UI's PreviewCard reads hover delays on the Trigger (`delay`/`closeDelay`),
// not the Root. Bridge the Root-level `openDelay`/`closeDelay` props down to the
// Trigger via context so existing call sites keep their intended delays.
const HoverCardDelayContext = React.createContext<{
  openDelay?: number
  closeDelay?: number
}>({})

function HoverCard<Payload = unknown>({
  openDelay,
  closeDelay,
  ...props
}: HoverCardProps<Payload>) {
  const delays = React.useMemo(() => ({ openDelay, closeDelay }), [openDelay, closeDelay])
  return (
    <HoverCardDelayContext value={delays}>
      <PreviewCardPrimitive.Root data-slot="hover-card" {...props} />
    </HoverCardDelayContext>
  )
}

function HoverCardTrigger<Payload = unknown>({
  delay,
  closeDelay,
  ...props
}: HoverCardTriggerProps<Payload>) {
  const contextDelays = React.use(HoverCardDelayContext)
  return (
    <PreviewCardPrimitive.Trigger<Payload>
      data-slot="hover-card-trigger"
      closeDelay={closeDelay ?? contextDelays.closeDelay}
      delay={delay ?? contextDelays.openDelay}
      {...props}
    />
  )
}

function HoverCardContent({
  className,
  positionerClassName,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 4,
  anchor,
  collisionAvoidance,
  positionMethod,
  ...props
}: PreviewCardPrimitive.Popup.Props &
  Pick<
    PreviewCardPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "anchor" | "collisionAvoidance" | "positionMethod"
  > & {
    positionerClassName?: string
  }) {
  return (
    <PreviewCardPrimitive.Portal data-slot="hover-card-portal">
      <PreviewCardPrimitive.Positioner
        anchor={anchor}
        collisionAvoidance={collisionAvoidance}
        positionMethod={positionMethod}
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className={cn("isolate z-[200]", positionerClassName)}
      >
        <PreviewCardPrimitive.Popup
          data-slot="hover-card-content"
          className={cn(
            "bg-popover text-popover-foreground w-64 rounded-lg p-2.5 text-sm shadow-xl z-[200] origin-(--transform-origin) outline-hidden transition-[opacity,scale,translate] duration-fast ease-out motion-reduce:transition-none data-starting-style:opacity-0 data-starting-style:scale-95 data-ending-style:opacity-0 data-ending-style:scale-95 data-[side=bottom]:data-starting-style:-translate-y-1 data-[side=top]:data-starting-style:translate-y-1 data-[side=left]:data-starting-style:translate-x-1 data-[side=right]:data-starting-style:-translate-x-1 data-[side=inline-start]:data-starting-style:translate-x-1 data-[side=inline-end]:data-starting-style:-translate-x-1 data-[side=bottom]:data-ending-style:-translate-y-1 data-[side=top]:data-ending-style:translate-y-1 data-[side=left]:data-ending-style:translate-x-1 data-[side=right]:data-ending-style:-translate-x-1 data-[side=inline-start]:data-ending-style:translate-x-1 data-[side=inline-end]:data-ending-style:-translate-x-1",
            className
          )}
          {...props}
        />
      </PreviewCardPrimitive.Positioner>
    </PreviewCardPrimitive.Portal>
  )
}

function HoverCardViewport({
  className,
  ...props
}: PreviewCardPrimitive.Viewport.Props) {
  return (
    <PreviewCardPrimitive.Viewport
      data-slot="hover-card-viewport"
      className={className}
      {...props}
    />
  )
}

export {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
  HoverCardViewport,
  type HoverCardHandle,
  type HoverCardProps,
  type HoverCardTriggerProps,
}

export { createHoverCardHandle } from "@/components/ui/hover-card-handle"
