"use client";

import type { JiraInsightCheckpoint, JiraInsightSource } from "@/components/blocks/jira-insight/jira-insight-types";
import { JiraInsightSources } from "@/components/blocks/jira-insight/components/jira-insight-sources";
import { useJiraInsight } from "@/components/blocks/jira-insight/context-jira-insight";
import { cn } from "@/lib/utils";

const TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
	hour: "numeric",
	minute: "2-digit",
	timeZone: "Australia/Sydney",
});

function formatJiraInsightTime(capturedAtMs: number): string {
	return TIME_FORMATTER.format(new Date(capturedAtMs));
}

export function JiraInsightCheckpoint({
	checkpoint,
	isActive,
	onSourceSelect,
}: Readonly<{
	checkpoint: JiraInsightCheckpoint;
	isActive: boolean;
	onSourceSelect?: (source: JiraInsightSource) => void;
}>) {
	const { onSourceSelect: contextSourceSelect, registerCheckpoint } = useJiraInsight();
	const sourceSelect = onSourceSelect ?? contextSourceSelect;
	return (
		<article
			className={cn(
				"mb-4 min-w-0 rounded-lg px-3 py-3 transition-colors duration-xxshort ease-out-practical motion-reduce:transition-none",
				isActive ? "bg-bg-selected ring-1 ring-border-selected" : "hover:bg-bg-neutral-subtle-hovered",
			)}
			data-jira-insight-checkpoint-id={checkpoint.id}
			ref={(node) => registerCheckpoint(checkpoint.id, node)}
		>
			<div className="flex min-w-0 items-baseline justify-between gap-3">
				<h3 className="min-w-0 text-base font-semibold leading-5 text-text">
					{checkpoint.title}
				</h3>
				<time
					className="shrink-0 text-xs tabular-nums text-text-subtlest"
					dateTime={new Date(checkpoint.capturedAtMs).toISOString()}
				>
					{formatJiraInsightTime(checkpoint.capturedAtMs)}
				</time>
			</div>
			<p className="mt-1 text-sm leading-5 text-text-subtle">
				{checkpoint.description}
			</p>
			{checkpoint.sources.length > 0 ? (
				<div className="mt-3">
					<JiraInsightSources onSourceSelect={sourceSelect} sources={checkpoint.sources} />
				</div>
			) : null}
		</article>
	);
}
