"use client";

import { useEffect, useId, useMemo, useRef } from "react";

import { JiraActivity, type JiraActivityEntry } from "@/components/blocks/jira-activity";
import { JiraInsightCheckpoint } from "@/components/blocks/jira-insight/components/jira-insight-checkpoint";
import { useJiraInsight } from "@/components/blocks/jira-insight/context-jira-insight";
import { cn } from "@/lib/utils";
import type { JiraInsightSource } from "@/components/blocks/jira-insight/jira-insight-types";

const INSIGHTS_ACTOR = {
	id: "jira-insight-rovo",
	name: "Rovo",
	kind: "agent" as const,
	vpkLogo: "rovo" as const,
};

export function JiraInsightContent({
	className,
	onSourceSelect,
}: Readonly<{
	className?: string;
	onSourceSelect?: (source: JiraInsightSource) => void;
}>) {
	const {
		activeCheckpointId,
		checkpoints,
		selectCheckpointFromScroll,
		snapshot,
	} = useJiraInsight();
	const rootRef = useRef<HTMLDivElement>(null);
	const summaryHeadingId = `${useId()}-summary`;
	const decisionsHeadingId = `${useId()}-decisions`;
	const checkpointById = useMemo(
		() => new Map(checkpoints.map((checkpoint) => [checkpoint.id, checkpoint])),
		[checkpoints],
	);
	const entries = useMemo<readonly JiraActivityEntry[]>(() => checkpoints.map((checkpoint) => ({
		actor: INSIGHTS_ACTOR,
		id: checkpoint.id,
		kind: "event",
		segments: [],
		showActor: false,
		showTimestamp: false,
		timestamp: "",
	})), [checkpoints]);

	useEffect(() => {
		const root = rootRef.current;
		if (!root || typeof IntersectionObserver === "undefined") return;
		const visible = new Map<string, IntersectionObserverEntry>();
		const observer = new IntersectionObserver((changes) => {
			for (const change of changes) {
				const id = (change.target as HTMLElement).dataset.jiraInsightCheckpointId;
				if (!id) continue;
				if (change.isIntersecting) visible.set(id, change);
				else visible.delete(id);
			}
			const closest = [...visible.entries()].sort(([, a], [, b]) => (
				b.intersectionRatio - a.intersectionRatio
				|| Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top)
			))[0];
			if (closest) selectCheckpointFromScroll(closest[0]);
		}, { threshold: [0.25, 0.5, 0.75, 1] });
		const nodes = root.querySelectorAll<HTMLElement>("[data-jira-insight-checkpoint-id]");
		for (const node of nodes) observer.observe(node);
		return () => observer.disconnect();
	}, [checkpoints, selectCheckpointFromScroll]);

	return (
		<div className={cn("flex min-w-0 flex-col gap-6", className)} data-jira-insight-content ref={rootRef}>
			<section aria-labelledby={summaryHeadingId} className="rounded-lg border border-border bg-surface-raised p-4">
				<h2 className="text-sm font-semibold text-text" id={summaryHeadingId}>Summary</h2>
				<p className="mt-2 text-sm leading-5 text-text-subtle">{snapshot.summary}</p>
			</section>
			<section aria-labelledby={decisionsHeadingId}>
				<h2 className="mb-3 text-sm font-semibold text-text" id={decisionsHeadingId}>Key decisions</h2>
				{entries.length > 0 ? (
					<JiraActivity
						activeEntryId={activeCheckpointId ?? undefined}
						className="gap-0"
						composer={null}
						entries={entries}
						hideHeader
						renderEntry={(entry) => {
							const checkpoint = checkpointById.get(entry.id);
							return checkpoint ? (
								<JiraInsightCheckpoint
									checkpoint={checkpoint}
									isActive={checkpoint.id === activeCheckpointId}
									onSourceSelect={onSourceSelect}
								/>
							) : undefined;
						}}
						sortOrder="descending"
					/>
				) : (
					<div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-text-subtle">
						No captured decisions yet.
					</div>
				)}
			</section>
		</div>
	);
}
