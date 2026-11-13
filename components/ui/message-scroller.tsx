"use client"

import * as React from "react"
import ArrowDownIcon from "@atlaskit/icon/core/arrow-down"
import {
	MessageScroller as MessageScrollerPrimitive,
	useMessageScroller,
	useMessageScrollerScrollable,
	useMessageScrollerVisibility,
} from "@shadcn/react/message-scroller"

import { Button, type ButtonProps } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { cn } from "@/lib/utils"

export type MessageScrollerProviderProps = React.ComponentProps<
	typeof MessageScrollerPrimitive.Provider
>

function MessageScrollerProvider(
	props: Readonly<MessageScrollerProviderProps>
) {
	return <MessageScrollerPrimitive.Provider {...props} />
}

export interface MessageScrollerProps
	extends React.ComponentProps<typeof MessageScrollerPrimitive.Root>,
		Omit<MessageScrollerProviderProps, "children"> {}

function MessageScroller({
	autoScroll,
	children,
	className,
	defaultScrollPosition,
	scrollEdgeThreshold,
	scrollMargin,
	scrollPreviousItemPeek,
	...props
}: Readonly<MessageScrollerProps>) {
	return (
		<MessageScrollerPrimitive.Provider
			autoScroll={autoScroll}
			defaultScrollPosition={defaultScrollPosition}
			scrollEdgeThreshold={scrollEdgeThreshold}
			scrollMargin={scrollMargin}
			scrollPreviousItemPeek={scrollPreviousItemPeek}
		>
			<MessageScrollerPrimitive.Root
				data-slot="message-scroller"
				className={cn(
					"group/message-scroller relative flex size-full min-h-0 flex-col overflow-hidden",
					className
				)}
				{...props}
			>
				{children}
			</MessageScrollerPrimitive.Root>
		</MessageScrollerPrimitive.Provider>
	)
}

export type MessageScrollerViewportProps = React.ComponentProps<
	typeof MessageScrollerPrimitive.Viewport
>

function MessageScrollerViewport({
	className,
	...props
}: Readonly<MessageScrollerViewportProps>) {
	return (
		<MessageScrollerPrimitive.Viewport
			data-slot="message-scroller-viewport"
			className={cn(
				"scroll-fade-b scrollbar-thin scrollbar-gutter-stable size-full min-h-0 min-w-0 overflow-y-auto overscroll-contain contain-content data-autoscrolling:scrollbar-none",
				className
			)}
			{...props}
		/>
	)
}

export type MessageScrollerContentProps = React.ComponentProps<
	typeof MessageScrollerPrimitive.Content
>

function MessageScrollerContent({
	className,
	...props
}: Readonly<MessageScrollerContentProps>) {
	return (
		<MessageScrollerPrimitive.Content
			data-slot="message-scroller-content"
			className={cn("flex h-max min-h-full flex-col gap-6", className)}
			{...props}
		/>
	)
}

export type MessageScrollerItemProps = React.ComponentProps<
	typeof MessageScrollerPrimitive.Item
>

function MessageScrollerItem({
	className,
	scrollAnchor = false,
	...props
}: Readonly<MessageScrollerItemProps>) {
	return (
		<MessageScrollerPrimitive.Item
			data-slot="message-scroller-item"
			scrollAnchor={scrollAnchor}
			className={cn(
				"min-w-0 shrink-0 [contain-intrinsic-size:auto_10rem] [content-visibility:auto]",
				className
			)}
			{...props}
		/>
	)
}

export interface MessageScrollerButtonProps
	extends React.ComponentProps<typeof MessageScrollerPrimitive.Button>,
		Pick<ButtonProps, "variant" | "size" | "shape"> {}

function MessageScrollerButton({
	direction = "end",
	className,
	children,
	render,
	variant = "secondary",
	size = "icon",
	shape = "circle",
	...props
}: Readonly<MessageScrollerButtonProps>) {
	return (
		<MessageScrollerPrimitive.Button
			data-slot="message-scroller-button"
			data-direction={direction}
			data-variant={variant}
			data-size={size}
			direction={direction}
			className={cn(
				"absolute inset-s-1/2 -translate-x-1/2 border-border bg-surface text-text transition-[translate,scale,opacity] duration-medium hover:bg-bg-neutral-subtle-hovered data-[active=false]:pointer-events-none data-[active=false]:scale-95 data-[active=false]:opacity-0 data-[active=false]:duration-slower data-[active=false]:ease-[cubic-bezier(0.7,0,0.84,0)] data-[active=true]:translate-y-0 data-[active=true]:scale-100 data-[active=true]:opacity-100 data-[active=true]:ease-[cubic-bezier(0.23,1,0.32,1)] data-[direction=end]:bottom-4 data-[direction=end]:data-[active=false]:translate-y-full data-[direction=start]:top-4 data-[direction=start]:data-[active=false]:-translate-y-full rtl:translate-x-1/2 data-[direction=start]:[&_[data-slot=icon]]:rotate-180",
				className
			)}
			render={render ?? <Button variant={variant} size={size} shape={shape} />}
			{...props}
		>
			{children ?? (
				<>
					<Icon render={<ArrowDownIcon label="" size="small" />} label="" />
					<span className="sr-only">
						{direction === "end" ? "Scroll to end" : "Scroll to start"}
					</span>
				</>
			)}
		</MessageScrollerPrimitive.Button>
	)
}

export {
	MessageScrollerProvider,
	MessageScroller,
	MessageScrollerViewport,
	MessageScrollerContent,
	MessageScrollerItem,
	MessageScrollerButton,
	useMessageScroller,
	useMessageScrollerScrollable,
	useMessageScrollerVisibility,
}
