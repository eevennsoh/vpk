import * as React from "react"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

export type BubbleGroupProps = React.ComponentProps<"div">

function BubbleGroup({ className, ...props }: Readonly<BubbleGroupProps>) {
	return (
		<div
			data-slot="bubble-group"
			className={cn("flex min-w-0 flex-col gap-2", className)}
			{...props}
		/>
	)
}

const bubbleVariants = cva(
	"group/bubble relative flex w-fit max-w-[80%] min-w-0 flex-col gap-1 group-[.is-user]/message:max-w-full group-data-[align=end]/message:self-end data-[align=end]:self-end data-[variant=ghost]:max-w-full",
	{
		variants: {
			variant: {
				default:
					"*:data-[slot=bubble-content]:border-0 *:data-[slot=bubble-content]:bg-bg-neutral *:data-[slot=bubble-content]:text-text *:data-[slot=bubble-content]:hover:bg-bg-neutral-hovered",
				primary:
					"*:data-[slot=bubble-content]:bg-primary *:data-[slot=bubble-content]:text-primary-foreground [&>[data-slot=bubble-content]:is(button,a):hover]:bg-primary-hovered [&>[data-slot=bubble-content]:is(button,a):active]:bg-primary-pressed",
				secondary:
					"*:data-[slot=bubble-content]:bg-secondary *:data-[slot=bubble-content]:text-text-subtle [&>[data-slot=bubble-content]:is(button,a):hover]:bg-bg-neutral-subtle-hovered [&>[data-slot=bubble-content]:is(button,a):active]:bg-bg-neutral-subtle-pressed",
				muted:
					"*:data-[slot=bubble-content]:bg-bg-neutral-subtle *:data-[slot=bubble-content]:text-text [&>[data-slot=bubble-content]:is(button,a):hover]:bg-bg-neutral-subtle-hovered [&>[data-slot=bubble-content]:is(button,a):active]:bg-bg-neutral-subtle-pressed",
				tinted:
					"*:data-[slot=bubble-content]:bg-bg-discovery-subtler *:data-[slot=bubble-content]:text-text-discovery-bolder [&>[data-slot=bubble-content]:is(button,a):hover]:bg-bg-discovery-subtler-hovered [&>[data-slot=bubble-content]:is(button,a):active]:bg-bg-discovery-subtler-pressed",
				outline:
					"*:data-[slot=bubble-content]:border-border *:data-[slot=bubble-content]:bg-surface *:data-[slot=bubble-content]:text-text [&>[data-slot=bubble-content]:is(button,a):hover]:bg-bg-neutral-subtle-hovered [&>[data-slot=bubble-content]:is(button,a):active]:bg-bg-neutral-subtle-pressed",
				ghost:
					"border-none *:data-[slot=bubble-content]:rounded-none *:data-[slot=bubble-content]:bg-transparent *:data-[slot=bubble-content]:p-0 [&>[data-slot=bubble-content]:is(button,a):hover]:bg-bg-neutral-subtle-hovered [&>[data-slot=bubble-content]:is(button,a):active]:bg-bg-neutral-subtle-pressed",
				destructive:
					"*:data-[slot=bubble-content]:bg-bg-danger-subtler *:data-[slot=bubble-content]:text-text-danger-bolder [&>[data-slot=bubble-content]:is(button,a):hover]:bg-bg-danger-subtler-hovered [&>[data-slot=bubble-content]:is(button,a):active]:bg-bg-danger-subtler-pressed",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	}
)

export interface BubbleProps
	extends React.ComponentProps<"div">,
		VariantProps<typeof bubbleVariants> {
	align?: "start" | "end"
}

function Bubble({
	variant = "default",
	align = "start",
	className,
	...props
}: Readonly<BubbleProps>) {
	return (
		<div
			data-slot="bubble"
			data-variant={variant}
			data-align={align}
			className={cn(bubbleVariants({ variant }), className)}
			{...props}
		/>
	)
}

export type BubbleContentProps = useRender.ComponentProps<"div">

function BubbleContent({
	className,
	render,
	...props
}: Readonly<BubbleContentProps>) {
	return useRender({
		defaultTagName: "div",
		props: mergeProps<"div">(
			{
				className: cn(
					"w-fit max-w-full min-w-0 overflow-hidden rounded-xl border border-transparent px-3 py-2 text-sm leading-relaxed wrap-break-word group-data-[align=end]/bubble:self-end group-data-[variant=default]/bubble:px-4 group-data-[variant=default]/bubble:py-3 group-data-[variant=default]/bubble:leading-5 group-data-[variant=default]/bubble:font-medium group-data-[variant=default]/bubble:group-data-[align=end]/bubble:rounded-br-none group-data-[variant=default]/bubble:group-data-[align=end]/message:rounded-br-none [button]:text-left [button,a]:transition-colors [button,a]:outline-none [button,a]:focus-visible:border-ring [button,a]:focus-visible:ring-3 [button,a]:focus-visible:ring-ring/50",
					className
				),
			},
			props
		),
		render,
		state: {
			slot: "bubble-content",
		},
	})
}

const bubbleReactionsVariants = cva(
	"absolute z-10 flex w-fit shrink-0 items-center justify-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-sm text-foreground ring-3 ring-card has-[button]:p-0",
	{
		variants: {
			side: {
				top: "top-0 -translate-y-3/4",
				bottom: "bottom-0 translate-y-3/4",
			},
			align: {
				start: "left-3",
				end: "right-3",
			},
		},
		defaultVariants: {
			side: "bottom",
			align: "end",
		},
	}
)

export interface BubbleReactionsProps extends React.ComponentProps<"div"> {
	align?: "start" | "end"
	side?: "top" | "bottom"
}

function BubbleReactions({
	side = "bottom",
	align = "end",
	className,
	...props
}: Readonly<BubbleReactionsProps>) {
	return (
		<div
			data-slot="bubble-reactions"
			data-align={align}
			data-side={side}
			className={cn(bubbleReactionsVariants({ side, align }), className)}
			{...props}
		/>
	)
}

// react-doctor-disable-next-line react-doctor/only-export-components -- This component module intentionally exports colocated variant API used by consumers.
export { BubbleGroup, Bubble, BubbleContent, BubbleReactions, bubbleVariants }
