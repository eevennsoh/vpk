"use client"

// oxlint-disable react-doctor/no-multi-comp -- Checkpoint parts compose one Marker pattern.

import * as React from "react"

import { Button, type ButtonProps } from "@/components/ui/button"
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker"
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip"
import { BookmarkIcon } from "@/components/ui/vpk-icons"
import { cn } from "@/lib/utils"

export type CheckpointProps = React.ComponentProps<"div">

function Checkpoint({ className, children, ...props }: Readonly<CheckpointProps>) {
	return (
		<Marker data-slot="checkpoint" variant="separator" {...props}>
			<MarkerContent className={cn("inline-flex items-center gap-2", className)}>
				{children}
			</MarkerContent>
		</Marker>
	)
}

export type CheckpointIconProps = React.ComponentProps<"span">

function CheckpointIcon({ children, ...props }: Readonly<CheckpointIconProps>) {
	return <MarkerIcon {...props}>{children ?? <BookmarkIcon label="" />}</MarkerIcon>
}

export type CheckpointTriggerProps = ButtonProps & {
	tooltip?: string
}

function CheckpointTrigger({
	variant = "outline",
	size = "compact",
	tooltip,
	children,
	...props
}: Readonly<CheckpointTriggerProps>) {
	const button = <Button size={size} type="button" variant={variant} {...props} />

	if (!tooltip) {
		return React.cloneElement(button, undefined, children)
	}

	return (
		<Tooltip>
			<TooltipTrigger render={button}>{children}</TooltipTrigger>
			<TooltipContent>{tooltip}</TooltipContent>
		</Tooltip>
	)
}

export { Checkpoint, CheckpointIcon, CheckpointTrigger }
