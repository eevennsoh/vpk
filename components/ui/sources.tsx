"use client"

// oxlint-disable react-doctor/no-multi-comp -- Sources parts compose one Trace pattern.

import * as React from "react"

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
import { ArrowUpRightIcon, GlobeIcon } from "@/components/ui/vpk-icons"

export type SourcesProps = TraceCollapsibleProps

function Sources(props: Readonly<SourcesProps>) {
	return (
		<Trace data-slot="sources">
			<TraceCollapsible {...props} />
		</Trace>
	)
}

export type SourcesTriggerProps = TraceCollapsibleTriggerProps & {
	count: number
}

function SourcesTrigger({ count, children, ...props }: Readonly<SourcesTriggerProps>) {
	return (
		<TraceCollapsibleTrigger {...props}>
			{children ?? (
				<TraceLine>
					<TraceIcon>
						<GlobeIcon label="" />
					</TraceIcon>
					<TraceTitle>Used {count} sources</TraceTitle>
				</TraceLine>
			)}
		</TraceCollapsibleTrigger>
	)
}

export type SourcesContentProps = TraceCollapsibleContentProps

function SourcesContent({ children, ...props }: Readonly<SourcesContentProps>) {
	return (
		<TraceCollapsibleContent {...props}>
			<Trace>{children}</Trace>
		</TraceCollapsibleContent>
	)
}

export type SourceProps = React.ComponentProps<"a">

function Source({ href, title, children, ...props }: Readonly<SourceProps>) {
	return (
		<a data-slot="source" href={href} target="_blank" rel="noreferrer" {...props}>
			{children ?? (
				<TraceLine>
					<TraceIcon>
						<GlobeIcon label="" />
					</TraceIcon>
					<TraceTitle>
						{title}
						<span className="sr-only"> (opens in a new tab)</span>
					</TraceTitle>
					<TraceIcon>
						<ArrowUpRightIcon label="" />
					</TraceIcon>
				</TraceLine>
			)}
		</a>
	)
}

export { Sources, SourcesTrigger, SourcesContent, Source }
