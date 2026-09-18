"use client"

import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area"

import { cn } from "@/lib/utils"

function ScrollAreaRoot({
	className,
	...props
}: ScrollAreaPrimitive.Root.Props) {
	return (
		<ScrollAreaPrimitive.Root
			data-slot="scroll-area"
			className={cn("group/scroll-area relative", className)}
			{...props}
		/>
	)
}

function ScrollAreaViewport({
	className,
	...props
}: ScrollAreaPrimitive.Viewport.Props) {
	return (
		<ScrollAreaPrimitive.Viewport
			data-slot="scroll-area-viewport"
			className={cn("rounded-[inherit] outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-1", className)}
			{...props}
		/>
	)
}

const ScrollAreaContent = ScrollAreaPrimitive.Content

function ScrollArea({
	className,
	children,
	...props
}: ScrollAreaPrimitive.Root.Props) {
	return (
		<ScrollAreaRoot
			className={cn(className)}
			{...props}
		>
			<ScrollAreaViewport
				className="size-full transition-[color,box-shadow]"
			>
				{children}
			</ScrollAreaViewport>
			<ScrollBar />
			<ScrollAreaPrimitive.Corner />
		</ScrollAreaRoot>
	)
}

function ScrollBar({
	className,
	orientation = "vertical",
	visibility = "always",
	...props
}: ScrollAreaPrimitive.Scrollbar.Props & { visibility?: "always" | "auto" }) {
	return (
		<ScrollAreaPrimitive.Scrollbar
			data-slot="scroll-area-scrollbar"
			data-orientation={orientation}
			orientation={orientation}
			className={cn(
				"data-horizontal:h-2.5 data-horizontal:flex-col data-horizontal:border-t data-horizontal:border-t-transparent data-vertical:h-full data-vertical:w-2.5 data-vertical:border-l data-vertical:border-l-transparent flex touch-none p-px transition-colors select-none",
				visibility === "auto" ? "pointer-events-none opacity-0 data-hovering:pointer-events-auto data-hovering:opacity-100 data-scrolling:pointer-events-auto data-scrolling:opacity-100 group-has-[:focus-visible]/scroll-area:pointer-events-auto group-has-[:focus-visible]/scroll-area:opacity-100" : null,
				className
			)}
			{...props}
		>
			<ScrollAreaPrimitive.Thumb
				data-slot="scroll-area-thumb"
				className={cn("rounded-full bg-border relative flex-1", visibility === "auto" ? "bg-muted-foreground/50" : null)}
			/>
		</ScrollAreaPrimitive.Scrollbar>
	)
}

export { ScrollArea, ScrollAreaRoot, ScrollAreaViewport, ScrollAreaContent, ScrollBar }
