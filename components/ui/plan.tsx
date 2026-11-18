"use client"

// oxlint-disable react-doctor/no-multi-comp -- Plan parts are one compound component on Trace.

import * as React from "react"

import {
	Trace,
	TraceCollapsible,
	TraceCollapsibleContent,
	TraceCollapsibleTrigger,
	TraceDescription,
	TraceIcon,
	TraceLine,
	TraceTitle,
	type TraceCollapsibleProps,
} from "@/components/ui/trace"
import {
	CircleCheckIcon,
	CircleDotIcon,
	CircleIcon,
	RouteIcon,
} from "@/components/ui/vpk-icons"
import { cn } from "@/lib/utils"

/**
 * shadcn's Plan: the steps the agent plans to take, as a collapsible Trace
 * line ("Plan: … · 2 of 4 done") with one line per step.
 */

const PlanStreamingContext = React.createContext(false)

function usePlanStreaming(): boolean {
	return React.use(PlanStreamingContext)
}

export type PlanProps = TraceCollapsibleProps & {
	/** Applied to the outer Trace. */
	className?: string
	/** Shimmers the header title and the running step while the plan streams. */
	isStreaming?: boolean
}

function Plan({ className, isStreaming = false, ...props }: Readonly<PlanProps>) {
	return (
		<PlanStreamingContext value={isStreaming}>
			<Trace data-slot="plan" className={className}>
				<TraceCollapsible {...props} />
			</Trace>
		</PlanStreamingContext>
	)
}

export type PlanHeaderProps = React.ComponentProps<typeof TraceCollapsibleTrigger>

function PlanHeader({ className, children, ...props }: Readonly<PlanHeaderProps>) {
	const isStreaming = usePlanStreaming()

	return (
		<TraceCollapsibleTrigger data-slot="plan-header" className={className} {...props}>
			<TraceLine status={isStreaming ? "running" : undefined}>{children}</TraceLine>
		</TraceCollapsibleTrigger>
	)
}

export type PlanIconProps = React.ComponentProps<typeof TraceIcon>

function PlanIcon({ children, ...props }: Readonly<PlanIconProps>) {
	return (
		<TraceIcon data-slot="plan-icon" {...props}>
			{children ?? <RouteIcon label="" />}
		</TraceIcon>
	)
}

export type PlanTitleProps = React.ComponentProps<typeof TraceTitle>

function PlanTitle(props: Readonly<PlanTitleProps>) {
	return <TraceTitle data-slot="plan-title" {...props} />
}

export type PlanDescriptionProps = React.ComponentProps<typeof TraceDescription>

function PlanDescription(props: Readonly<PlanDescriptionProps>) {
	return <TraceDescription data-slot="plan-description" {...props} />
}

/** Buttons cannot sit inside the header trigger; render actions next to it. */
export type PlanActionProps = React.ComponentProps<"div">

function PlanAction({ className, ...props }: Readonly<PlanActionProps>) {
	return <div data-slot="plan-action" className={cn("flex items-center gap-1", className)} {...props} />
}

export type PlanContentProps = React.ComponentProps<typeof TraceCollapsibleContent>

function PlanContent(props: Readonly<PlanContentProps>) {
	return <TraceCollapsibleContent data-slot="plan-content" {...props} />
}

export type PlanStepsProps = React.ComponentProps<typeof Trace>

function PlanSteps(props: Readonly<PlanStepsProps>) {
	return <Trace data-slot="plan-steps" {...props} />
}

export type PlanStepStatus = "done" | "running" | "pending"

export type PlanStepProps = Omit<React.ComponentProps<typeof TraceLine>, "status"> & {
	status: PlanStepStatus
}

const PLAN_STEP_ICONS = {
	done: CircleCheckIcon,
	running: CircleDotIcon,
	pending: CircleIcon,
} satisfies Record<PlanStepStatus, React.ComponentType<{ label: string }>>

function PlanStep({ status, children, ...props }: Readonly<PlanStepProps>) {
	const isStreaming = usePlanStreaming()
	const StepIcon = PLAN_STEP_ICONS[status]
	const lineStatus = status === "pending" ? "pending" : isStreaming && status === "running" ? "running" : undefined

	return (
		<TraceLine data-slot="plan-step" data-step-status={status} status={lineStatus} {...props}>
			<TraceIcon>
				<StepIcon label="" />
			</TraceIcon>
			<TraceTitle>{children}</TraceTitle>
		</TraceLine>
	)
}

/** The whole header line opens the plan, so the trigger renders only its children. */
export type PlanTriggerProps = { children?: React.ReactNode }

function PlanTrigger({ children }: Readonly<PlanTriggerProps>) {
	return <>{children}</>
}

export type PlanFooterProps = React.ComponentProps<"div">

function PlanFooter({ className, ...props }: Readonly<PlanFooterProps>) {
	return <div data-slot="plan-footer" className={cn("flex items-center gap-2", className)} {...props} />
}

export {
	Plan,
	PlanHeader,
	PlanIcon,
	PlanTitle,
	PlanDescription,
	PlanAction,
	PlanContent,
	PlanSteps,
	PlanStep,
	PlanTrigger,
	PlanFooter,
}
