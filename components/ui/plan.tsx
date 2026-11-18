"use client"

// oxlint-disable react-doctor/no-multi-comp -- Plan parts are one compound component with a card and an inline variant.

// oxlint-disable react-doctor/jsx-no-jsx-as-prop -- These components intentionally use slot/render-node props for icons, triggers, and adornments.

import type { ComponentProps, CSSProperties, ReactNode, RefObject } from "react"
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right"
import PeopleGroupIcon from "@atlaskit/icon/core/people-group"
import { motion } from "motion/react"
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { GenerativeCardFooter, GenerativeCardHeader } from "@/components/ui/generative-card-header"
import {
	Plan as InlinePlan,
	PlanAction as InlinePlanAction,
	PlanContent as InlinePlanContent,
	PlanDescription as InlinePlanDescription,
	PlanFooter as InlinePlanFooter,
	PlanHeader as InlinePlanHeader,
	PlanIcon,
	PlanStep,
	PlanSteps,
	PlanTitle as InlinePlanTitle,
	PlanTrigger as InlinePlanTrigger,
	type PlanIconProps,
	type PlanStepProps,
	type PlanStepStatus,
	type PlanStepsProps,
} from "@/components/ui/plan-inline"
import { Tag } from "@/components/ui/tag"
import { ChevronsUpDownIcon } from "@/components/ui/vpk-icons"
import { token } from "@/lib/tokens"
import { cn } from "@/lib/utils"

/**
 * The agent's plan. `variant="card"` (default) is VPK's generative plan card;
 * `variant="inline"` renders the same parts as shadcn's collapsible Trace line
 * (`./plan-inline`). PlanIcon, PlanSteps and PlanStep are the inline parts.
 */

export interface PlanTask {
	id: string
	label: string
	blockedBy: string[]
	agent?: string
	agentAvatarSrc?: string
}

export type PlanVariant = "card" | "inline"

interface PlanContextValue {
	variant: PlanVariant
	isStreaming: boolean
	isOpen: boolean
	setIsOpen: (next: boolean) => void
	isContentExpanded: boolean
	setIsContentExpanded: (next: boolean) => void
}

const PlanContext = createContext<PlanContextValue | null>(null)

/** The Plan's live state, for parts composed outside this file (such as a markdown summary body). */
export function usePlan(): PlanContextValue {
	const context = use(PlanContext)
	if (!context) {
		throw new Error("Plan components must be used within Plan")
	}
	return context
}

/* ----- Plan (root) ----- */

export type PlanProps = Omit<ComponentProps<typeof Collapsible>, "className" | "open" | "defaultOpen" | "onOpenChange"> & {
	className?: string
	/** Shimmers the title and description (card) or the header line and running step (inline). */
	isStreaming?: boolean
	open?: boolean
	defaultOpen?: boolean
	/** Card only: starts the summary and task list without the collapsed "Show more" treatment. */
	defaultContentExpanded?: boolean
	onOpenChange?: (open: boolean) => void
	variant?: PlanVariant
}

export function Plan({ className, isStreaming = false, open, defaultOpen = false, defaultContentExpanded = false, onOpenChange, variant = "card", children, ...props }: Readonly<PlanProps>) {
	const isControlled = open !== undefined
	const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
	const [isContentExpanded, setIsContentExpanded] = useState(defaultContentExpanded)
	const isOpen = isControlled ? open : uncontrolledOpen

	const setIsOpen = useCallback(
		(next: boolean) => {
			if (!isControlled) {
				setUncontrolledOpen(next)
			}
			onOpenChange?.(next)
		},
		[isControlled, onOpenChange]
	)

	const contextValue = useMemo(
		() => ({ variant, isStreaming, isOpen, setIsOpen, isContentExpanded, setIsContentExpanded }),
		[variant, isStreaming, isOpen, setIsOpen, isContentExpanded]
	)

	if (variant === "inline") {
		return (
			<PlanContext value={contextValue}>
				<InlinePlan className={className} isStreaming={isStreaming} open={isOpen} onOpenChange={setIsOpen} {...props}>
					{children}
				</InlinePlan>
			</PlanContext>
		)
	}

	return (
		<PlanContext value={contextValue}>
			<Collapsible data-slot="plan" open={isOpen} onOpenChange={setIsOpen} {...props} render={<Card className={cn("shadow-none", "data-closed:gap-0", "transition-[opacity,transform] duration-normal ease-out data-starting-style:opacity-0 data-starting-style:-translate-y-1", className)} />}>
				{children}
			</Collapsible>
		</PlanContext>
	)
}

/* ----- PlanHeader ----- */

export type PlanHeaderProps = Omit<ComponentProps<typeof GenerativeCardHeader>, "expanded" | "onExpandedChange" | "leading" | "title"> & {
	leading?: ReactNode
	title?: ReactNode
}

export function PlanHeader({ className, ...props }: Readonly<PlanHeaderProps>) {
	const { variant, isOpen, setIsOpen } = usePlan()

	if (variant === "inline") {
		const { leading, title, description, children } = props
		return (
			<InlinePlanHeader className={className}>
				{leading}
				{title}
				{description}
				{children}
			</InlinePlanHeader>
		)
	}

	const { leading, title, ...rest } = props
	return (
		<GenerativeCardHeader
			expanded={isOpen}
			onExpandedChange={setIsOpen}
			className={className}
			data-slot="plan-header"
			leading={leading}
			title={title}
			{...rest}
		/>
	)
}

/* ----- PlanAvatar ----- */

/** Card: a slot for the plan's tile (pass a VisualIdentityTile or IconTile). Inline: PlanIcon. */
export type PlanAvatarProps = ComponentProps<"div">

export function PlanAvatar({ className, children, ...props }: Readonly<PlanAvatarProps>) {
	const { variant } = usePlan()

	if (variant === "inline") {
		return <PlanIcon className={className} />
	}

	return (
		<div className={cn("shrink-0", className)} data-slot="plan-avatar" {...props}>
			{children}
		</div>
	)
}

/* ----- PlanTitle / PlanDescription ----- */

function PlanShimmerText({ children }: Readonly<{ children: ReactNode }>) {
	const { isStreaming } = usePlan()

	return isStreaming && typeof children === "string" ? <p className="shimmer relative inline-block text-muted-foreground">{children}</p> : children
}

export type PlanTitleProps = Omit<ComponentProps<typeof CardTitle>, "children"> & {
	children: ReactNode
}

export function PlanTitle({ children, ...props }: Readonly<PlanTitleProps>) {
	const { variant } = usePlan()

	if (variant === "inline") {
		return <InlinePlanTitle className={props.className}>{children}</InlinePlanTitle>
	}

	return (
		<CardTitle data-slot="plan-title" {...props}>
			<PlanShimmerText>{children}</PlanShimmerText>
		</CardTitle>
	)
}

export type PlanDescriptionProps = Omit<ComponentProps<typeof CardDescription>, "children"> & {
	children: ReactNode
}

export function PlanDescription({ className, children, ...props }: Readonly<PlanDescriptionProps>) {
	const { variant } = usePlan()

	if (variant === "inline") {
		return <InlinePlanDescription className={className}>{children}</InlinePlanDescription>
	}

	return (
		<CardDescription className={className} data-slot="plan-description" {...props}>
			<PlanShimmerText>{children}</PlanShimmerText>
		</CardDescription>
	)
}

/* ----- PlanAction ----- */

export type PlanActionProps = ComponentProps<typeof CardAction>

export function PlanAction(props: Readonly<PlanActionProps>) {
	const { variant } = usePlan()

	if (variant === "inline") {
		return <InlinePlanAction className={props.className}>{props.children}</InlinePlanAction>
	}

	return <CardAction data-slot="plan-action" {...props} />
}

/* ----- PlanContent ----- */

export type PlanContentProps = ComponentProps<typeof CardContent>

export function PlanContent({ className, ...props }: Readonly<PlanContentProps>) {
	const { variant } = usePlan()

	if (variant === "inline") {
		return <InlinePlanContent className={className}>{props.children}</InlinePlanContent>
	}

	return (
		<CollapsibleContent
			render={<CardContent data-slot="plan-content" className={cn("data-closed:h-0 data-closed:overflow-hidden data-closed:py-0", className)} {...props} />}
		/>
	)
}

/* ----- Collapsed overflow (card summary and task list) ----- */

const COLLAPSED_CONTENT_MAX_HEIGHT_PX = 240
const COLLAPSED_CONTENT_HEIGHT_CLASS = "max-h-[240px]"
const COLLAPSED_CONTENT_FADE_HEIGHT_PX = 72
const collapsedContentFadeMask = {
	WebkitMaskImage: `linear-gradient(to bottom, black calc(100% - ${COLLAPSED_CONTENT_FADE_HEIGHT_PX}px), transparent)`,
	maskImage: `linear-gradient(to bottom, black calc(100% - ${COLLAPSED_CONTENT_FADE_HEIGHT_PX}px), transparent)`,
} satisfies CSSProperties

/** Measures whether the collapsed body overflows 240px; the plan's summary and task list share the expanded state. */
function useCollapsedOverflow(ref: RefObject<HTMLElement | null>, content: unknown) {
	const { isContentExpanded, setIsContentExpanded } = usePlan()
	const [hasOverflow, setHasOverflow] = useState(false)
	const [hasMeasured, setHasMeasured] = useState(false)

	// oxlint-disable react-doctor/no-adjust-state-on-prop-change -- overflow is measured from rendered DOM after content changes.
	useEffect(() => {
		if (isContentExpanded || !ref.current) return

		const element = ref.current
		const updateOverflow = () => {
			const overflowsVisible = element.scrollHeight - element.clientHeight > 1
			const overflowsCollapsed = element.scrollHeight - COLLAPSED_CONTENT_MAX_HEIGHT_PX > 1
			setHasOverflow(overflowsVisible || overflowsCollapsed)
			setHasMeasured(true)
		}

		const rafId = requestAnimationFrame(updateOverflow)

		if (typeof ResizeObserver === "undefined") {
			return () => cancelAnimationFrame(rafId)
		}

		const resizeObserver = new ResizeObserver(() => {
			updateOverflow()
		})

		resizeObserver.observe(element)

		return () => {
			cancelAnimationFrame(rafId)
			resizeObserver.disconnect()
		}
	}, [ref, content, isContentExpanded])
	// oxlint-enable react-doctor/no-adjust-state-on-prop-change

	const isCollapsed = !isContentExpanded
	const showControls = isCollapsed && (hasMeasured ? hasOverflow : false)

	return {
		collapsedClassName: isCollapsed ? `${COLLAPSED_CONTENT_HEIGHT_CLASS} overflow-hidden` : undefined,
		maskStyle: showControls ? collapsedContentFadeMask : undefined,
		showControls,
		expand: () => setIsContentExpanded(true),
	}
}

function PlanShowMoreButton({ label, onClick }: Readonly<{ label: string; onClick: () => void }>) {
	return (
		<div className="absolute inset-x-0 bottom-2 flex justify-center">
			<Button
				size="compact"
				variant="ghost"
				className="h-7 rounded-full border-0 bg-surface px-3 text-sm leading-5 font-normal text-text-subtle hover:bg-surface-hovered"
				style={{ boxShadow: token("elevation.shadow.overlay") }}
				onClick={onClick}
			>
				{label}
			</Button>
		</div>
	)
}

/* ----- PlanSummary ----- */

/** Card only: a summary body capped at 240px with a "Show more" button. Pass the rendered summary (for example MessageResponse markdown) as children. */
export type PlanSummaryProps = ComponentProps<"div"> & {
	showMoreLabel?: string
}

export function PlanSummary({ children, className, showMoreLabel = "Show more", ...props }: Readonly<PlanSummaryProps>) {
	const contentRef = useRef<HTMLDivElement | null>(null)
	const overflow = useCollapsedOverflow(contentRef, children)

	return (
		<div className="relative" data-slot="plan-summary">
			<div ref={contentRef} className={cn(overflow.collapsedClassName, className)} style={overflow.maskStyle} {...props}>
				{children}
			</div>
			{overflow.showControls ? <PlanShowMoreButton label={showMoreLabel} onClick={overflow.expand} /> : null}
		</div>
	)
}

/* ----- PlanFooter ----- */

export type PlanFooterProps = ComponentProps<typeof GenerativeCardFooter>

export function PlanFooter(props: Readonly<PlanFooterProps>) {
	const { variant } = usePlan()

	if (variant === "inline") {
		return (
			<InlinePlanFooter className={props.className}>
				{props.children}
				{props.action}
			</InlinePlanFooter>
		)
	}

	return <GenerativeCardFooter data-slot="plan-footer" {...props} />
}

/* ----- PlanTrigger ----- */

export type PlanTriggerProps = ComponentProps<typeof CollapsibleTrigger>

export function PlanTrigger({ className, ...props }: Readonly<PlanTriggerProps>) {
	const { variant } = usePlan()

	// Inline: the whole header line opens the plan, so the trigger renders only its children.
	if (variant === "inline") {
		return <InlinePlanTrigger>{props.children as ReactNode}</InlinePlanTrigger>
	}

	return (
		<CollapsibleTrigger
			{...props}
			render={
				<Button
					className={cn("size-8", className)}
					data-slot="plan-trigger"
					size="icon"
					variant="ghost"
				/>
			}
		>
			<ChevronsUpDownIcon className="size-4" />
			<span className="sr-only">Toggle plan</span>
		</CollapsibleTrigger>
	)
}

/* ----- PlanAgentBar ----- */

export type PlanAgentBarProps = ComponentProps<"div"> & {
	agents: string[]
}

export function PlanAgentBar({ agents, className, ...props }: Readonly<PlanAgentBarProps>) {
	if (agents.length === 0) return null

	return (
		<div className={cn("flex items-center gap-2 rounded-lg bg-bg-neutral px-3 py-2", className)} data-slot="plan-agent-bar" {...props}>
			<PeopleGroupIcon label="" size="small" color="currentColor" />
			<span className="text-xs leading-4 font-medium text-text-subtle">
				{agents.length} {agents.length === 1 ? "agent" : "agents"}
			</span>
			<span className="text-xs leading-4 text-text-subtlest">{agents.join(" · ")}</span>
		</div>
	)
}

/* ----- PlanTaskList ----- */

export type PlanTaskListProps = ComponentProps<"ol"> & {
	showMoreLabel?: string
}

export function PlanTaskList({ children, className, showMoreLabel = "Show more", ...props }: Readonly<PlanTaskListProps>) {
	const { variant } = usePlan()
	const listRef = useRef<HTMLOListElement | null>(null)
	const overflow = useCollapsedOverflow(listRef, children)

	if (variant === "inline") {
		return <PlanSteps className={className}>{children}</PlanSteps>
	}

	return (
		<div className="relative" data-slot="plan-task-list">
			<ol ref={listRef} className={cn("flex flex-col gap-0", overflow.collapsedClassName, className)} style={overflow.maskStyle} {...props}>
				{children}
			</ol>
			{overflow.showControls ? <PlanShowMoreButton label={showMoreLabel} onClick={overflow.expand} /> : null}
		</div>
	)
}

/* ----- PlanTaskItem ----- */

export type PlanTaskItemProps = {
	index: number
	label: string
	blockedByLabels?: string[]
	blockedByText?: string
	agent?: string
	agentAvatarSrc?: string
	className?: string
	/** Inline variant only: the step's progress. Defaults to pending. */
	status?: PlanStepStatus
}

export function PlanTaskItem({ index, label, blockedByLabels, blockedByText, agent, agentAvatarSrc, className, status = "pending" }: Readonly<PlanTaskItemProps>) {
	const { variant } = usePlan()

	if (variant === "inline") {
		return (
			<PlanStep className={className} status={status}>
				{label}
			</PlanStep>
		)
	}

	return (
		<motion.li
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.25, ease: "easeOut" }}
			className={cn("flex min-h-8 shrink-0 items-center gap-4 rounded-lg px-2 py-1.5", className)}
			data-slot="plan-task-item"
		>
			<span className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm bg-surface text-sm leading-5 font-medium text-text">{index}.</span>
			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<span className="text-sm leading-5 font-medium text-text">{label}</span>
				{blockedByText ? <span className="text-xs leading-4 text-text-subtlest">{blockedByText}</span> : null}
				{!blockedByText && blockedByLabels && blockedByLabels.length > 0 ? <span className="text-xs leading-4 text-text-subtlest">Blocked by: Step {blockedByLabels.join(", ")}</span> : null}
			</div>
			{agent ? (
				<Tag
					type="agent"
					elemBefore={
						<Avatar size="xs" shape="hexagon">
							{agentAvatarSrc ? <AvatarImage src={agentAvatarSrc} alt={agent} /> : null}
							<AvatarFallback>{agent.slice(0, 2).toUpperCase()}</AvatarFallback>
						</Avatar>
					}
				>
					{agent}
				</Tag>
			) : null}
		</motion.li>
	)
}

/* ----- PlanChevronTrigger ----- */

export type PlanChevronTriggerProps = ComponentProps<typeof Button> & {
	isOpen?: boolean
}

export function PlanChevronTrigger({ isOpen = true, className, ...props }: Readonly<PlanChevronTriggerProps>) {
	return (
		<Button
			aria-label={isOpen ? "Collapse plan" : "Expand plan"}
			size="icon"
			variant="ghost"
			className={cn("rounded-full [&_svg]:transition-transform [&_svg]:duration-normal", isOpen ? "[&_svg]:rotate-90" : "[&_svg]:rotate-0", className)}
			data-slot="plan-chevron-trigger"
			{...props}
		>
			<ChevronRightIcon label="" size="small" />
		</Button>
	)
}

export { PlanIcon, PlanStep, PlanSteps, type PlanIconProps, type PlanStepProps, type PlanStepStatus, type PlanStepsProps }
