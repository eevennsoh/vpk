"use client";

import { useState } from "react";

import { ContextDescriptionEditor } from "@/components/blocks/jira-work-item/team-eu26/components/context-description-editor";
import { token } from "@/lib/tokens";

import type { PullRequestDetailData } from "@/components/blocks/jira-work-item/team-eu26/lib/pull-request-detail-data";

export function PullRequestOverview({ data }: Readonly<{ data: PullRequestDetailData }>) {
	const review = data.guidedReview;
	const [description, setDescription] = useState(data.description);

	if (!review) {
		return (
			<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.6fr)]">
				<section className="rounded-lg border border-border p-4">
					<h2 className="text-text" style={{ font: token("font.heading.small") }}>
						Pull request details
					</h2>
					<dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm">
						<dt className="text-text-subtle">Repository</dt>
						<dd className="min-w-0 truncate text-text">{data.repository}</dd>
						<dt className="text-text-subtle">Status</dt>
						<dd className="text-text">{data.status}</dd>
						<dt className="text-text-subtle">Changes</dt>
						<dd className="flex gap-2">
							<span className="text-text-success">+{data.additions}</span>
							<span className="text-text-danger">-{data.deletions}</span>
						</dd>
					</dl>
				</section>
				<aside className="rounded-lg border border-border p-4">
					<h2 className="text-sm font-semibold text-text">Guided review unavailable</h2>
					<p className="mt-1 text-sm text-text-subtle">
						This pull request has metadata only. Open it in GitHub to review its changes.
					</p>
				</aside>
			</div>
		);
	}

	return (
		<section aria-label="Description">
			<ContextDescriptionEditor
				aria-label="Pull request description"
				value={description}
				viewMode="rendered"
				onMarkdownChange={setDescription}
			/>
		</section>
	);
}
