"use client"

import type { ComponentProps, ReactNode } from "react"
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right"
import { createContext, memo, use } from "react"

import { Button } from "@/components/ui/button"
import {
	CardAction,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

/**
 * The disclosure header and the action footer of a generative card. They live
 * in ui so ui-level cards (Plan) can share them with the GenerativeCard block,
 * which re-exports them alongside its root.
 */

export type GenerativeCardContextValue = {
	expanded: boolean
	setExpanded: (next: boolean) => void
}

export const GenerativeCardContext = createContext<GenerativeCardContextValue | null>(null)

export function useGenerativeCardContext(optional: true): GenerativeCardContextValue | null
export function useGenerativeCardContext(optional?: false): GenerativeCardContextValue
export function useGenerativeCardContext(optional = false) {
	const context = use(GenerativeCardContext)

	if (context === null && !optional) {
		throw new Error("GenerativeCard components must be used within <GenerativeCard>.")
	}

	return context
}

export type GenerativeCardHeaderProps = Omit<ComponentProps<typeof CardHeader>, "title"> & {
	leading: ReactNode
	title: ReactNode
	description?: ReactNode
	action?: ReactNode
	showToggle?: boolean
	expandLabel?: string
	collapseLabel?: string
	expanded?: boolean
	onExpandedChange?: (expanded: boolean) => void
}

export const GenerativeCardHeader = memo(function GenerativeCardHeader({
	className,
	title,
	description,
	leading,
	action,
	showToggle = true,
	expandLabel = "Expand card details",
	collapseLabel = "Collapse card details",
	expanded,
	onExpandedChange,
	...props
}: Readonly<GenerativeCardHeaderProps>) {
	const context = useGenerativeCardContext(true)
	const isExpanded = expanded ?? context?.expanded ?? true
	const setExpanded = onExpandedChange ?? context?.setExpanded
	const shouldShowToggle = showToggle && typeof setExpanded === "function"

	return (
		<CardHeader className={cn("items-center gap-x-3 gap-y-0 px-4 py-3", isExpanded ? "border-b" : null, className)} {...props}>
			<div className="flex min-w-0 items-center gap-3">
				{leading}
				<div className="min-w-0 flex-1">
					<CardTitle className="truncate text-sm leading-5 font-semibold">{title}</CardTitle>
					{description ? (
						<CardDescription className="line-clamp-2 text-xs leading-4">
							{description}
						</CardDescription>
					) : null}
				</div>
			</div>
			{action || shouldShowToggle ? (
				<CardAction className="self-center">
					<div className="flex items-center gap-1">
						{action}
						{shouldShowToggle ? (
							<Button
								variant="ghost"
								size="icon"
								type="button"
								className="text-text-subtle"
								aria-label={isExpanded ? collapseLabel : expandLabel}
								onClick={() => setExpanded(!isExpanded)}
							>
								<span
									className="transition-transform duration-medium ease-in-out"
									style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}
								>
									<ChevronRightIcon label="" size="small" />
								</span>
							</Button>
						) : null}
					</div>
				</CardAction>
			) : null}
		</CardHeader>
	)
})

export type GenerativeCardFooterProps = ComponentProps<typeof CardFooter> & {
	/** Optional primary action rendered to the right of children (e.g. a "Send" button). */
	action?: ReactNode
}

export const GenerativeCardFooter = memo(function GenerativeCardFooter({
	className,
	action,
	children,
	...props
}: Readonly<GenerativeCardFooterProps>) {
	return (
		<CardFooter
			className={cn("justify-end gap-2 px-4 py-4", className)}
			{...props}
		>
			{children}
			{action}
		</CardFooter>
	)
})
