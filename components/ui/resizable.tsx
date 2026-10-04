"use client"

// oxlint-disable react-doctor/no-multi-comp -- This module intentionally colocates coupled component parts as a compound component or demo surface API.

import * as ResizablePrimitive from "react-resizable-panels"

import { cn } from "@/lib/utils"

function ResizablePanelGroup({
  className,
  ...props
}: ResizablePrimitive.GroupProps) {
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      className={cn(
        "flex h-full w-full aria-[orientation=vertical]:flex-col",
        className
      )}
      {...props}
    />
  )
}

function ResizablePanel(props: ResizablePrimitive.PanelProps) {
  return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: ResizablePrimitive.SeparatorProps & {
  withHandle?: boolean
}) {
  return (
    <ResizablePrimitive.Separator
      data-slot="resizable-handle"
      className={cn(
        // react-resizable-panels sets data-separator="inactive" | "hover" | "active" (not data-resize-handle-active)
        "group bg-border transition-colors data-[separator=hover]:bg-bg-selected-bold data-[separator=active]:bg-bg-selected-bold focus-visible:ring-ring ring-offset-background relative flex w-px cursor-col-resize items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:outline-hidden aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:cursor-row-resize aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 [&[aria-orientation=horizontal]>div]:rotate-90",
        className
      )}
      {...props}
    >
      {withHandle ? <div
          aria-hidden
          className="pointer-events-none z-10 h-6 w-1 shrink-0 rounded-lg bg-neutral-100 transition-[opacity,background-color] duration-medium ease-out opacity-0 group-data-[separator=hover]:opacity-100 group-data-[separator=active]:opacity-100 group-data-[separator=hover]:bg-bg-selected-bold group-data-[separator=active]:bg-bg-selected-bold"
        /> : null}
    </ResizablePrimitive.Separator>
  )
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup }
