"use client";

import ChevronLeftIcon from "@atlaskit/icon/core/chevron-left";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import { useId } from "react";

import { JiraInsightSources } from "@/components/blocks/jira-insight/components/jira-insight-sources";
import { getJiraInsightEditorialSelection } from "@/components/blocks/jira-insight/components/jira-insight-editorial-model";
import { useJiraInsight } from "@/components/blocks/jira-insight/context-jira-insight";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
	dateStyle: "medium",
	timeZone: "Australia/Sydney",
});
const TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
	timeStyle: "short",
	timeZone: "Australia/Sydney",
});

function EditorialMetadata({
	category,
	capturedAtMs,
	position,
	sourceCount,
	total,
}: Readonly<{
	category: string;
	capturedAtMs: number;
	position: number;
	sourceCount: number;
	total: number;
}>) {
	return (
		<dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-y border-border py-5">
			<div className="min-w-0">
				<dt className="text-xs font-medium text-text-subtlest">Date</dt>
				<dd className="mt-1 text-sm text-text">
					<time dateTime={new Date(capturedAtMs).toISOString()}>{DATE_FORMATTER.format(capturedAtMs)}</time>
				</dd>
			</div>
			<div className="min-w-0">
				<dt className="text-xs font-medium text-text-subtlest">Sources</dt>
				<dd className="mt-1 text-sm text-text">{sourceCount} {sourceCount === 1 ? "source" : "sources"}</dd>
			</div>
			<div className="min-w-0">
				<dt className="text-xs font-medium text-text-subtlest">Position</dt>
				<dd className="mt-1 text-sm text-text">{position} of {total}</dd>
			</div>
			<div className="min-w-0">
				<dt className="text-xs font-medium text-text-subtlest">Category</dt>
				<dd className="mt-1 text-sm text-text">{category}</dd>
			</div>
		</dl>
	);
}

export function JiraInsightEditorialPane({ className }: Readonly<{ className?: string }>) {
	const { activeCheckpointId, checkpoints, onSourceSelect, selectCheckpoint, snapshot } = useJiraInsight();
	const selection = getJiraInsightEditorialSelection(checkpoints, activeCheckpointId);
	const titleId = `${useId()}-title`;
	const summaryId = `${useId()}-summary`;

	if (!selection) {
		return (
			<section aria-labelledby={titleId} className={cn("min-w-0 px-6 py-5 lg:px-8 lg:py-6", className)}>
				<Heading as="h2" id={titleId} size="medium">Insights</Heading>
				<p className="mt-2 text-sm leading-5 text-text-subtle">No captured decisions yet.</p>
				{snapshot.summary ? <p className="mt-6 text-sm leading-6 text-text">{snapshot.summary}</p> : null}
			</section>
		);
	}

	const capturedAt = new Date(selection.checkpoint.capturedAtMs);

	return (
		<article aria-labelledby={titleId} className={cn("min-w-0 px-6 py-5 lg:px-8 lg:py-6", className)} data-jira-insight-editorial-pane>
			<header className="min-w-0">
				<div className="flex min-w-0 items-center justify-between gap-4">
					<p className="min-w-0 text-xs font-medium text-text-subtle">
						Decision {selection.position} of {selection.total}
						<span aria-hidden> · </span>
						<time dateTime={capturedAt.toISOString()}>{TIME_FORMATTER.format(capturedAt)}</time>
					</p>
					<nav aria-label="Decision navigation" className="flex shrink-0 items-center gap-1">
						<Button
							aria-label="Show previous decision"
							disabled={selection.previousCheckpointId == null}
							onClick={() => {
								if (selection.previousCheckpointId) selectCheckpoint(selection.previousCheckpointId);
							}}
							size="icon-compact"
							variant="ghost"
						>
							<Icon aria-hidden render={<ChevronLeftIcon label="" size="small" />} />
						</Button>
						<Button
							aria-label="Show next decision"
							disabled={selection.nextCheckpointId == null}
							onClick={() => {
								if (selection.nextCheckpointId) selectCheckpoint(selection.nextCheckpointId);
							}}
							size="icon-compact"
							variant="ghost"
						>
							<Icon aria-hidden render={<ChevronRightIcon label="" size="small" />} />
						</Button>
					</nav>
				</div>
				<Heading as="h2" className="mt-7 text-balance" id={titleId} size="large">
					{selection.checkpoint.title}
				</Heading>
				<p className="mt-4 text-sm leading-6 text-text-subtle">
					{selection.checkpoint.description}
				</p>
			</header>

			{selection.sourceCount > 0 ? (
				<section aria-labelledby={`${titleId}-sources`} className="mt-7">
					<h3 className="mb-3 text-xs font-semibold text-text-subtle" id={`${titleId}-sources`}>Sources</h3>
					<JiraInsightSources onSourceSelect={onSourceSelect} sources={selection.checkpoint.sources} />
				</section>
			) : null}

			<div className="mt-7">
				<EditorialMetadata
					capturedAtMs={selection.checkpoint.capturedAtMs}
					category={selection.category}
					position={selection.position}
					sourceCount={selection.sourceCount}
					total={selection.total}
				/>
			</div>

			<section aria-labelledby={summaryId} className="mt-7">
				<h3 className="text-xs font-semibold text-text-subtle" id={summaryId}>Current summary</h3>
				<p className="mt-3 text-sm leading-6 text-text">{snapshot.summary || "No summary is available yet."}</p>
			</section>
		</article>
	);
}
