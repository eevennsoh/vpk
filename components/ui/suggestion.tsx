"use client"

// oxlint-disable react-doctor/no-multi-comp -- Suggestions and Suggestion are one compound pattern.

import * as React from "react"

import { Button, type ButtonProps } from "@/components/ui/button"
import { CornerDownRightIcon } from "@/components/ui/vpk-icons"
import { cn } from "@/lib/utils"

export type SuggestionsProps = React.ComponentProps<"div"> & {
	orientation?: "horizontal" | "vertical"
}

function Suggestions({
	className,
	orientation = "horizontal",
	...props
}: Readonly<SuggestionsProps>) {
	return (
		<div
			data-slot="suggestions"
			data-orientation={orientation}
			className={cn(
				orientation === "vertical"
					? "flex flex-col items-start gap-0.5"
					: "flex scroll-fade-x scrollbar-none gap-2 overflow-x-auto overscroll-x-contain",
				className
			)}
			{...props}
		/>
	)
}

export type SuggestionProps = Omit<ButtonProps, "onClick"> & {
	suggestion: string
	onClick?: (suggestion: string) => void
}

function Suggestion({
	suggestion,
	onClick,
	className,
	variant = "ghost",
	iconSize = "compact",
	children,
	...props
}: Readonly<SuggestionProps>) {
	return (
		<Button
			data-slot="suggestion"
			type="button"
			variant={variant}
			iconSize={iconSize}
			className={cn(
				"shrink-0 justify-start px-2 text-xs text-text-subtle",
				className
			)}
			onClick={() => onClick?.(suggestion)}
			{...props}
		>
			<CornerDownRightIcon label="" data-icon="inline-start" />
			{children ?? suggestion}
		</Button>
	)
}

export { Suggestions, Suggestion }
