"use client";

import { useState } from "react";

import {
	JiraActivity,
	JiraActivityViewControl,
	type JiraActivityFilter,
	type JiraActivitySortOrder,
} from "@/components/blocks/jira-activity";
import { jiraActivitySegmentsToPlainText } from "@/components/blocks/jira-activity/lib/jira-activity-comment-text";
import { jiraActivityReducer } from "@/components/blocks/jira-activity/lib/jira-activity-reducer";
import { WorkItemSection } from "@/components/blocks/jira-work-item/experimental-v3/components/work-item-section";
import { useActivityChatComments } from "@/components/blocks/jira-work-item/experimental-v3/context-activity-chat-comments";
import { usePublishActivityCount } from "@/components/blocks/jira-work-item/experimental-v3/context-section-navigation";
import {
	adaptPullRequestActivity,
	getPullRequestActivityRevision,
} from "@/components/blocks/jira-work-item/experimental-v3/lib/pull-request-activity-adapter";
import type { PullRequestActivity } from "@/components/blocks/jira-work-item/experimental-v3/lib/pull-request-detail-data";
import { GUIDED_REVIEW_CURRENT_REVIEWER } from "@/components/blocks/jira-work-item/experimental-v3/lib/pull-request-review-submit";
import { usePullRequestActivityEntries } from "@/components/blocks/jira-work-item/lib/use-pull-request-activity-entries";

/**
 * SCM Activity timeline for a pull request. Reuses Jira Activity's chronological
 * feed with PR-scoped filters (Latest / Oldest / Comments) and review-thread
 * Reply + Resolve.
 *
 * Renders as the `activity` section of the stacked pull-request body, so a
 * review conversation reads in the same place as a work item's, and owns its
 * heading row so the filter/sort control sits beside the title.
 */
export function PullRequestActivityPanel({
	activity,
}: Readonly<{
	activity: readonly PullRequestActivity[];
}>) {
	const { addComment: addActivityChatComment } = useActivityChatComments();
	const [sortOrder, setSortOrder] = useState<JiraActivitySortOrder>("ascending");
	const [filter, setFilter] = useState<JiraActivityFilter>("all");
	const { activityKey, entries, setEntries } = usePullRequestActivityEntries({
		activity,
		adaptActivity: adaptPullRequestActivity,
		getRevision: getPullRequestActivityRevision,
	});

	usePublishActivityCount(entries.length);

	return (
		<WorkItemSection
			headingAction={(
				<JiraActivityViewControl
					filter={filter}
					filterMode="pull-request"
					menuAlign="end"
					onFilterChange={setFilter}
					onSortOrderChange={setSortOrder}
					sortOrder={sortOrder}
				/>
			)}
			headingVisible
			id="activity"
			label="Activity"
		>
			<div data-jira-work-item-pull-request-activity>
			<JiraActivity
				className="gap-2"
				composer={null}
				currentUser={GUIDED_REVIEW_CURRENT_REVIEWER}
				entries={entries}
				filter={filter}
				hideHeader
				key={activityKey}
				onAddCommentToChat={(entry) => {
					addActivityChatComment({
						id: entry.id,
						actorName: entry.actor.name,
						timestamp: entry.timestamp,
						body: jiraActivitySegmentsToPlainText(entry.body),
					});
				}}
				onAddReplyToChat={(reply) => {
					addActivityChatComment({
						id: reply.id,
						actorName: reply.actor.name,
						timestamp: reply.timestamp,
						body: reply.body,
					});
				}}
				onEntriesChange={setEntries}
				onResolveComment={(entry) => {
					setEntries((current) => (
						jiraActivityReducer(
							{ entries: current },
							{ type: "toggle-resolved", entryId: entry.id },
						).entries
					));
				}}
				onSubmitReply={(entry, body) => {
					setEntries((current) => (
						jiraActivityReducer(
							{ entries: current },
							{
								type: "add-reply",
								entryId: entry.id,
								reply: {
									id: crypto.randomUUID(),
									actor: GUIDED_REVIEW_CURRENT_REVIEWER,
									timestamp: "Just now",
									body,
								},
							},
						).entries
					));
				}}
				sortOrder={sortOrder}
			/>
			</div>
		</WorkItemSection>
	);
}
