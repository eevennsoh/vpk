"use client"

// oxlint-disable react-doctor/no-multi-comp -- Chain of Thought parts compose one Trace pattern.

import * as React from "react"
import type { NewCoreIconProps } from "@atlaskit/icon/base-new"
import RovoIconGlyph from "@atlaskit/icon-lab/core/rovo"
import NodeIcon from "@atlaskit/icon/core/node"
import { motion, useReducedMotion, type MotionProps } from "motion/react"

import { useControllableState } from "@/hooks/use-controllable-state"
import { CyclingByline } from "@/components/ui/cycling-byline"
import { Icon } from "@/components/ui/icon"
import { Lozenge, type LozengeProps } from "@/components/ui/lozenge"
import { MorphingRovo } from "@/components/ui/morphing-rovo"
import {
	Trace,
	TraceCollapsible,
	TraceCollapsibleContent,
	TraceCollapsibleTrigger,
	TraceIcon,
	TraceLine,
	TraceTitle,
	type TraceCollapsibleContentProps,
	type TraceCollapsibleProps,
	type TraceCollapsibleTriggerProps,
} from "@/components/ui/trace"
import { getDefaultThinkingLabel, getPreloadShimmerLabel, getReasoningCompletedLabel } from "@/lib/reasoning-labels"
import { token } from "@/lib/tokens"
import { cn } from "@/lib/utils"

/*
 * Trace's collapsible panels keep `overflow-hidden` for the height transition.
 * Release it while a descendant holds focus so focus rings (4px outside the
 * button box) are not sheared by the panel edge.
 */
const PANEL_FOCUS_RING_CLEARANCE =
	"[&_[data-slot=trace-collapsible-content]:has(:focus-visible)]:overflow-visible"

/*
 * Chain of Thought draws its own icon-to-icon connector in the step rail, so the
 * Trace content rule (left border, indent and padding) is turned off here.
 */
const CONTENT_RULE_OFF = "mb-0 ml-0 border-l-0 pr-0 pl-0 leading-[inherit] text-inherit"

/* Steps reveal Trace's chevron on hover or keyboard focus only. */
const STEP_TRIGGER_CHEVRON =
	"[&>[data-slot=trace-icon]]:opacity-0 [&>[data-slot=trace-icon]]:transition-[transform,opacity] [&:hover>[data-slot=trace-icon]]:opacity-100 [&:focus-visible>[data-slot=trace-icon]]:opacity-100"

export type ChainOfThoughtProps = Omit<TraceCollapsibleProps, "open" | "defaultOpen" | "onOpenChange"> & {
	open?: boolean
	defaultOpen?: boolean
	onOpenChange?: (open: boolean) => void
}

function ChainOfThought({
	className,
	open,
	defaultOpen = false,
	onOpenChange,
	children,
	...props
}: Readonly<ChainOfThoughtProps>) {
	const [isOpen, setIsOpen] = useControllableState({
		defaultProp: defaultOpen,
		onChange: onOpenChange,
		prop: open,
	})

	return (
		<Trace data-slot="chain-of-thought" className={cn("not-prose", PANEL_FOCUS_RING_CLEARANCE, className)}>
			<TraceCollapsible open={isOpen} onOpenChange={setIsOpen} {...props}>
				{children}
			</TraceCollapsible>
		</Trace>
	)
}

export type ChainOfThoughtHeaderState = "preload" | "thinking" | "completed"

export type ChainOfThoughtHeaderProps = TraceCollapsibleTriggerProps & {
	/** When false, renders the header line without a trigger. */
	showChevron?: boolean
	/** Shimmers the title without a state; resolves to the preload state. */
	shimmer?: boolean
	state?: ChainOfThoughtHeaderState
	/** Seconds, for the completed label. */
	duration?: number
}

function getHeaderLabel(state: ChainOfThoughtHeaderState | undefined, duration: number | undefined) {
	if (state === "preload") {
		return getPreloadShimmerLabel()
	}
	if (state === "thinking") {
		return getDefaultThinkingLabel()
	}
	if (state === "completed") {
		return getReasoningCompletedLabel(duration)
	}
	return "Chain of Thought"
}

function ChainOfThoughtHeader({
	className,
	children,
	showChevron = true,
	shimmer = false,
	state,
	duration,
	...props
}: Readonly<ChainOfThoughtHeaderProps>) {
	const resolvedState = state ?? (shimmer ? "preload" : undefined)
	const isCompleted = resolvedState === "completed"
	const isRunning = !isCompleted && (shimmer || resolvedState === "preload" || resolvedState === "thinking")

	const line = (
		<TraceLine status={isRunning ? "running" : undefined}>
			<TraceIcon>
				{isCompleted ? (
					<RovoIconGlyph color={token("color.icon.subtlest")} label="" size="small" />
				) : (
					<MorphingRovo.Shape size={16} duration={0.8} blur={1.25} />
				)}
			</TraceIcon>
			<TraceTitle>{children ?? getHeaderLabel(resolvedState, duration)}</TraceTitle>
		</TraceLine>
	)

	if (!showChevron) {
		return (
			<div data-slot="chain-of-thought-header" className={cn("flex min-w-0", className)}>
				{line}
			</div>
		)
	}

	return (
		<TraceCollapsibleTrigger data-slot="chain-of-thought-header" className={className} {...props}>
			{line}
		</TraceCollapsibleTrigger>
	)
}

export type ChainOfThoughtContentProps = TraceCollapsibleContentProps

function ChainOfThoughtContent({ className, children, ...props }: Readonly<ChainOfThoughtContentProps>) {
	return (
		<TraceCollapsibleContent className={CONTENT_RULE_OFF} {...props}>
			<Trace data-slot="chain-of-thought-content" className={cn("gap-3", className)}>
				{children}
			</Trace>
		</TraceCollapsibleContent>
	)
}

export type ChainOfThoughtStepStatus = "complete" | "active" | "pending"

export interface ChainOfThoughtStepHeaderRenderContext {
	hasExpandableContent: boolean
	isOpen: boolean
	resolvedDescription: React.ReactNode
	shouldShowDescription: boolean
	toggleOpen: () => void
}

export type ChainOfThoughtStepProps = React.ComponentProps<"div"> &
	MotionProps & {
		animateOnMount?: boolean
		entranceDelay?: number
		icon?: React.ComponentType<NewCoreIconProps>
		iconRender?: React.ReactNode
		iconContainerClassName?: string
		iconContainerStyle?: React.CSSProperties
		/** Sweeps a light wash over the step icon. Defaults to on for the active step. */
		iconShimmer?: boolean
		label: React.ReactNode
		/** Byline under the label. `null` hides it; `undefined` shows the status default. */
		description?: React.ReactNode
		status?: ChainOfThoughtStepStatus
		collapsible?: boolean
		defaultOpen?: boolean
		open?: boolean
		onOpenChange?: (open: boolean) => void
		headerRender?: (context: ChainOfThoughtStepHeaderRenderContext) => React.ReactNode
	}

// Step icons take the ADS icon roles: subtle once a step has started, subtlest while it is queued.
const stepIconStyles: Record<ChainOfThoughtStepStatus, string> = {
	active: "text-icon-subtle",
	complete: "text-icon-subtle",
	pending: "text-icon-subtlest",
}

function ChainOfThoughtIconSlot({ children, shimmer }: Readonly<{ children: React.ReactNode; shimmer: boolean }>) {
	return (
		<span
			data-cot-icon-slot={shimmer ? "active" : undefined}
			className={cn("inline-flex size-4 shrink-0 items-center justify-center", shimmer ? "relative" : null)}
		>
			{children}
			{shimmer ? (
				<span
					aria-hidden="true"
					className="cot-icon-wash pointer-events-none absolute inset-0 inline-flex items-center justify-center motion-safe:animate-cot-icon-shimmer motion-reduce:hidden"
				>
					{children}
				</span>
			) : null}
		</span>
	)
}

const stepStatusStyles: Record<ChainOfThoughtStepStatus, string> = {
	active: "text-text",
	complete: "text-text-subtle",
	pending: "text-text-subtlest",
}

const defaultStepDescriptions: Record<ChainOfThoughtStepStatus, string> = {
	active: "In progress",
	complete: "Complete",
	pending: "Queued",
}

function ChainOfThoughtStep({
	className,
	icon: IconComponent = NodeIcon,
	iconRender,
	iconContainerClassName,
	iconContainerStyle,
	iconShimmer,
	label,
	description,
	status = "complete",
	collapsible = false,
	defaultOpen = false,
	animateOnMount = false,
	entranceDelay = 0,
	open,
	onOpenChange,
	headerRender,
	style,
	children,
	...props
}: Readonly<ChainOfThoughtStepProps>) {
	const shouldReduceMotion = useReducedMotion()
	const shouldAnimateEntrance = animateOnMount && !shouldReduceMotion
	const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
	const isControlled = open !== undefined
	const isOpen = isControlled ? open : uncontrolledOpen
	const hasExpandableContent = collapsible && children != null
	const shouldShowDescription = description !== null
	const shouldShowHeaderDescription = shouldShowDescription && (!hasExpandableContent || !isOpen)
	const resolvedDescription = description === undefined ? defaultStepDescriptions[status] : description
	const iconNode = iconRender ?? (
		<Icon render={<IconComponent label="" size="small" spacing="none" />} className="size-4" />
	)

	const handleOpenChange = (nextOpen: boolean) => {
		if (!isControlled) {
			setUncontrolledOpen(nextOpen)
		}
		onOpenChange?.(nextOpen)
	}

	// A new defaultOpen resets an uncontrolled step (data-driven steps open while active).
	const [previousDefaultOpen, setPreviousDefaultOpen] = React.useState(defaultOpen)
	if (previousDefaultOpen !== defaultOpen) {
		setPreviousDefaultOpen(defaultOpen)
		if (!isControlled) {
			setUncontrolledOpen(defaultOpen)
		}
	}

	const titleLine = (
		<TraceLine status={status === "active" ? "running" : undefined} className="text-inherit">
			<TraceTitle>{label}</TraceTitle>
		</TraceLine>
	)
	const byline = (
		<CyclingByline className="mt-0.5 text-xs leading-4 text-text-subtle">
			{shouldShowHeaderDescription ? resolvedDescription : null}
		</CyclingByline>
	)
	const customHeader = headerRender?.({
		hasExpandableContent,
		isOpen,
		resolvedDescription,
		shouldShowDescription: shouldShowHeaderDescription,
		toggleOpen: () => handleOpenChange(!isOpen),
	})

	return (
		<motion.div
			data-slot="chain-of-thought-step"
			data-status={status}
			className={cn("group/cot-step flex items-stretch gap-2 text-sm [&_a]:text-inherit", stepStatusStyles[status], className)}
			initial={shouldAnimateEntrance ? { opacity: 0, y: -6 } : false}
			animate={shouldAnimateEntrance ? { opacity: 1, y: 0 } : undefined}
			transition={shouldAnimateEntrance ? { duration: 0.22, ease: "easeOut", delay: entranceDelay } : undefined}
			style={{
				...style,
				...(shouldAnimateEntrance ? { willChange: "opacity, transform" } : {}),
			}}
			{...props}
		>
			<div
				data-slot="chain-of-thought-step-rail"
				className={cn("relative mt-0.5 self-stretch", iconContainerClassName)}
				style={iconContainerStyle}
			>
				<TraceIcon className={stepIconStyles[status]}>
					<ChainOfThoughtIconSlot shimmer={iconShimmer ?? status === "active"}>{iconNode}</ChainOfThoughtIconSlot>
				</TraceIcon>
				<div
					data-slot="chain-of-thought-step-connector"
					aria-hidden="true"
					className={cn(
						"absolute top-5 -bottom-3 left-1/2 -mx-px w-px bg-border",
						hasExpandableContent && isOpen ? null : "group-last/cot-step:hidden"
					)}
				/>
			</div>
			{hasExpandableContent ? (
				<TraceCollapsible open={isOpen} onOpenChange={handleOpenChange} className="min-w-0 flex-1">
					{customHeader ?? (
						<>
							<TraceCollapsibleTrigger className={STEP_TRIGGER_CHEVRON}>{titleLine}</TraceCollapsibleTrigger>
							{byline}
						</>
					)}
					<TraceCollapsibleContent className={cn(CONTENT_RULE_OFF, "space-y-2")}>{children}</TraceCollapsibleContent>
				</TraceCollapsible>
			) : (
				<div className="flex min-w-0 flex-1 flex-col">
					{customHeader ?? (
						<>
							{titleLine}
							{byline}
						</>
					)}
					{children != null ? <div className="mt-2 space-y-2">{children}</div> : null}
				</div>
			)}
		</motion.div>
	)
}

export type ChainOfThoughtSearchResultsProps = React.ComponentProps<"div">

function ChainOfThoughtSearchResults({ className, ...props }: Readonly<ChainOfThoughtSearchResultsProps>) {
	return (
		<div
			data-slot="chain-of-thought-search-results"
			className={cn("flex flex-wrap items-center gap-1.5", className)}
			{...props}
		/>
	)
}

export type ChainOfThoughtSearchResultProps = LozengeProps

function ChainOfThoughtSearchResult({ className, ...props }: Readonly<ChainOfThoughtSearchResultProps>) {
	return <Lozenge className={cn("max-w-none", className)} variant="neutral" {...props} />
}

export type ChainOfThoughtImageProps = React.ComponentProps<"div"> & {
	caption?: string
}

function ChainOfThoughtImage({ className, children, caption, ...props }: Readonly<ChainOfThoughtImageProps>) {
	return (
		<div data-slot="chain-of-thought-image" className={cn("mt-2 space-y-2", className)} {...props}>
			<div className="relative flex max-h-[22rem] items-center justify-start overflow-hidden rounded-lg bg-surface-raised">
				{children}
			</div>
			{caption ? <p className="text-xs text-text-subtle">{caption}</p> : null}
		</div>
	)
}

export type ChainOfThoughtScenarioState = ChainOfThoughtHeaderState

export interface ChainOfThoughtScenarioStep {
	id: string
	label: React.ReactNode
	description?: React.ReactNode
	status: ChainOfThoughtStepStatus
	icon?: React.ComponentType<NewCoreIconProps>
	iconRender?: React.ReactNode
	collapsible?: boolean
	defaultOpen?: boolean
	className?: string
	children?: React.ReactNode
}

export interface ChainOfThoughtScenarioProps extends Omit<ChainOfThoughtProps, "children"> {
	animateStepEntrance?: boolean
	state: ChainOfThoughtScenarioState
	duration?: number
	steps: readonly ChainOfThoughtScenarioStep[]
	headerLabel?: React.ReactNode
	contentClassName?: string
}

/** Data-driven Chain of Thought: a header from `state` and one step per entry. */
function ChainOfThoughtScenario({
	contentClassName,
	defaultOpen,
	animateStepEntrance = false,
	duration,
	headerLabel,
	state,
	steps,
	...props
}: Readonly<ChainOfThoughtScenarioProps>) {
	return (
		<ChainOfThought defaultOpen={defaultOpen ?? state === "thinking"} {...props}>
			<ChainOfThoughtHeader duration={duration} showChevron={state !== "preload" && steps.length > 0} state={state}>
				{headerLabel}
			</ChainOfThoughtHeader>
			<ChainOfThoughtContent className={contentClassName}>
				{steps.map((step, index) => (
					<ChainOfThoughtStep
						key={step.id}
						className={step.className}
						collapsible={step.collapsible}
						defaultOpen={step.defaultOpen}
						description={step.description}
						animateOnMount={animateStepEntrance}
						entranceDelay={animateStepEntrance ? Math.min(index * 0.045, 0.18) : 0}
						icon={step.icon}
						iconRender={step.iconRender}
						label={step.label}
						status={step.status}
					>
						{step.children}
					</ChainOfThoughtStep>
				))}
			</ChainOfThoughtContent>
		</ChainOfThought>
	)
}

export {
	ChainOfThought,
	ChainOfThoughtHeader,
	ChainOfThoughtContent,
	ChainOfThoughtStep,
	ChainOfThoughtSearchResults,
	ChainOfThoughtSearchResult,
	ChainOfThoughtImage,
	ChainOfThoughtScenario,
}
