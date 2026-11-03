import * as React from "react"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { Button, type ButtonProps } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { token } from "@/lib/tokens"

const attachmentVariants = cva(
	"group/attachment relative flex w-fit max-w-full min-w-0 shrink-0 flex-wrap rounded-xl border bg-card text-card-foreground transition-colors focus-within:ring-1 focus-within:ring-ring/50 has-[>a,>button]:hover:bg-bg-neutral-subtle-hovered data-[state=error]:border-border-danger data-[state=idle]:border-dashed",
	{
		variants: {
			size: {
				default:
					"gap-2 text-sm has-data-[slot=attachment-content]:px-2.5 has-data-[slot=attachment-content]:py-2 has-data-[slot=attachment-media]:p-2",
				sm: "gap-2.5 text-xs has-data-[slot=attachment-content]:px-2 has-data-[slot=attachment-content]:py-1.5 has-data-[slot=attachment-media]:p-1.5",
				xs: "gap-1.5 rounded-lg text-xs has-data-[slot=attachment-content]:px-1.5 has-data-[slot=attachment-content]:py-1 has-data-[slot=attachment-media]:p-1",
			},
			orientation: {
				horizontal: "min-w-40 items-center",
				vertical: "w-24 flex-col has-data-[slot=attachment-content]:w-30",
			},
			variant: {
				default: "",
				// Header and media cover the whole root, so the root never shows its hover fill. Keep it static:
				// Chromium composites the fade without the rounded clip, flashing a dark edge on hover.
				preview: "w-full flex-col flex-nowrap gap-0 rounded-lg border-0 p-0 text-xs transition-none has-[>a,>button]:hover:bg-card",
			},
		},
	}
)

export interface AttachmentProps
	extends React.ComponentProps<"div">,
		VariantProps<typeof attachmentVariants> {
	state?: "idle" | "uploading" | "processing" | "error" | "done"
}

function Attachment({
	className,
	state = "done",
	size = "default",
	orientation = "horizontal",
	variant = "default",
	style,
	...props
}: Readonly<AttachmentProps>) {
	const resolvedOrientation = variant === "preview" ? "vertical" : orientation ?? "horizontal"

	return (
		<div
			data-slot="attachment"
			data-state={state}
			data-size={size}
			data-orientation={resolvedOrientation}
			data-variant={variant}
			className={cn(attachmentVariants({ size: variant === "preview" ? null : size, orientation: variant === "preview" ? null : orientation, variant }), className)}
			style={{ ...(variant === "preview" ? { boxShadow: token("elevation.shadow.raised") } : undefined), ...style }}
			{...props}
		/>
	)
}

const attachmentMediaVariants = cva(
	"relative flex aspect-square w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-bg-neutral text-icon-subtle group-data-[orientation=vertical]/attachment:w-full group-data-[size=sm]/attachment:w-8 group-data-[size=xs]/attachment:w-7 group-data-[size=xs]/attachment:rounded-md group-data-[state=error]/attachment:bg-bg-danger-subtler group-data-[state=error]/attachment:text-icon-danger group-data-[orientation=vertical]/attachment:*:data-[slot=spinner]:size-6! [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 group-data-[orientation=vertical]/attachment:[&_svg:not([class*='size-'])]:size-6 group-data-[size=xs]/attachment:[&_svg:not([class*='size-'])]:size-3.5",
	{
		variants: {
			variant: {
				icon: "",
				image:
					"opacity-60 group-data-[state=done]/attachment:opacity-100 group-data-[state=idle]/attachment:opacity-100 *:[img]:aspect-square *:[img]:w-full *:[img]:object-cover",
				preview: "aspect-auto h-20 w-full rounded-t-none rounded-b-lg bg-surface-sunken [&_img]:h-full [&_img]:w-full [&_img]:object-cover",
			},
		},
		defaultVariants: {
			variant: "icon",
		},
	}
)

export type AttachmentMediaProps = React.ComponentProps<"div"> &
	VariantProps<typeof attachmentMediaVariants>

function AttachmentMedia({
	className,
	variant = "icon",
	...props
}: Readonly<AttachmentMediaProps>) {
	return (
		<div
			data-slot="attachment-media"
			data-variant={variant}
			className={cn(attachmentMediaVariants({ variant }), className)}
			{...props}
		/>
	)
}

export type AttachmentContentProps = React.ComponentProps<"div">

function AttachmentContent({
	className,
	...props
}: Readonly<AttachmentContentProps>) {
	return (
		<div
			data-slot="attachment-content"
			className={cn(
				"max-w-full min-w-0 flex-1 leading-tight group-data-[orientation=vertical]/attachment:px-1",
				className
			)}
			{...props}
		/>
	)
}

export type AttachmentTitleProps = React.ComponentProps<"span">

function AttachmentHeader({ className, ...props }: Readonly<React.ComponentProps<"div">>) {
	return <div data-slot="attachment-header" className={cn("relative flex h-9 min-w-0 items-center gap-2 rounded-t-lg bg-card p-2.5 text-xs group-hover/attachment:bg-bg-neutral group-focus-within/attachment:bg-bg-neutral", className)} {...props} />
}

function AttachmentTitle({ className, ...props }: Readonly<AttachmentTitleProps>) {
	return (
		<span
			data-slot="attachment-title"
			className={cn(
				"block max-w-full min-w-0 truncate font-medium group-data-[variant=preview]/attachment:font-normal group-data-[state=processing]/attachment:animate-pulse group-data-[state=uploading]/attachment:animate-pulse",
				className
			)}
			{...props}
		/>
	)
}

export type AttachmentDescriptionProps = React.ComponentProps<"span">

function AttachmentDescription({
	className,
	...props
}: Readonly<AttachmentDescriptionProps>) {
	return (
		<span
			data-slot="attachment-description"
			className={cn(
				"mt-0.5 block max-w-full min-w-0 truncate text-xs text-text-subtlest group-data-[state=error]/attachment:text-text-danger",
				className
			)}
			{...props}
		/>
	)
}

export type AttachmentActionsProps = React.ComponentProps<"div">

function AttachmentActions({
	className,
	...props
}: Readonly<AttachmentActionsProps>) {
	return (
		<div
			data-slot="attachment-actions"
			className={cn(
				"relative z-20 flex shrink-0 items-center group-data-[orientation=vertical]/attachment:absolute group-data-[orientation=vertical]/attachment:top-3 group-data-[orientation=vertical]/attachment:right-3 group-data-[orientation=vertical]/attachment:gap-1 group-data-[variant=preview]/attachment:top-1.5 group-data-[variant=preview]/attachment:right-1.5",
				className
			)}
			{...props}
		/>
	)
}

export type AttachmentActionProps = ButtonProps

function AttachmentAction({
	className,
	variant,
	size = "icon-compact",
	...props
}: Readonly<AttachmentActionProps>) {
	return (
		<Button
			data-slot="attachment-action"
			variant={variant ?? "ghost"}
			size={size}
			className={cn(className)}
			{...props}
		/>
	)
}

export type AttachmentTriggerProps = useRender.ComponentProps<"button">

function AttachmentTrigger({
	className,
	render,
	type,
	...props
}: Readonly<AttachmentTriggerProps>) {
	return useRender({
		defaultTagName: "button",
		props: mergeProps<"button">(
			{
				type: render ? type : (type ?? "button"),
				className: cn("absolute inset-0 z-10 outline-none", className),
			},
			props
		),
		render,
		state: {
			slot: "attachment-trigger",
		},
	})
}

export type AttachmentGroupProps = React.ComponentProps<"div">

function AttachmentGroup({ className, ...props }: Readonly<AttachmentGroupProps>) {
	return (
		<div
			data-slot="attachment-group"
			className={cn(
				"scroll-fade-x scrollbar-none flex min-w-0 snap-x snap-mandatory scroll-px-1 gap-3 overflow-x-auto overscroll-x-contain p-1 *:data-[slot=attachment]:flex-none *:data-[slot=attachment]:snap-start",
				className
			)}
			{...props}
		/>
	)
}

// react-doctor-disable-next-line react-doctor/only-export-components -- This component module intentionally exports colocated variant API used by consumers.
export {
	Attachment,
	AttachmentGroup,
	AttachmentMedia,
	AttachmentContent,
	AttachmentHeader,
	AttachmentTitle,
	AttachmentDescription,
	AttachmentActions,
	AttachmentAction,
	AttachmentTrigger,
}
