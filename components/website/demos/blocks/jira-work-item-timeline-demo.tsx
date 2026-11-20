"use client";

import { useMemo, useState } from "react";
import { JiraActivity, type JiraActivityEntry } from "@/components/blocks/jira-activity";
import { JiraWorkItemTimeline, useJiraWorkItemTimelineNavigation } from "@/components/blocks/jira-work-item-timeline";
import { activityDateLabel, activityDayLabel, activityHeaderTimeLabel, createProjectButterActivity } from "@/components/blocks/jira-work-item/project-butter/activity-data";
import { PROJECT_BUTTER_ACTIVITY_FILTERS_ALL, projectButterSessionInvocation, selectProjectButterActivity, type ProjectButterActivitySort } from "@/components/blocks/jira-work-item/project-butter/activity-feed-model";
import { ProjectButterActivityFilterMenu } from "@/components/blocks/jira-work-item/project-butter/activity-filter-menu";
import { ProjectButterSessionStart } from "@/components/blocks/jira-work-item/project-butter/activity-session-start";
import { BUTTER_WORK_ITEM_SESSIONS } from "@/components/projects/butter-v1/data/gallery-work-item-sessions";

const cursor = BUTTER_WORK_ITEM_SESSIONS.find((session) => session.id === "butter-cursor-forecast");
const SAMPLE_ENTRIES = [...createProjectButterActivity(false), ...(cursor ? [projectButterSessionInvocation(cursor)] : [])];

export default function JiraWorkItemTimelineDemo() {
	const [entries, setEntries] = useState<readonly JiraActivityEntry[]>(SAMPLE_ENTRIES);
	const [filters, setFilters] = useState(PROJECT_BUTTER_ACTIVITY_FILTERS_ALL);
	const [sort, setSort] = useState<ProjectButterActivitySort>("newest");
	const rows = useMemo(() => selectProjectButterActivity(entries, filters, sort).slice(0, 10), [entries, filters, sort]);
	const { feedRef, headerRef, progress, scrollToEntry, seekToProgress, stuck, visibleId } = useJiraWorkItemTimelineNavigation(rows);
	const visibleRow = rows.find((row) => row.id === visibleId) ?? rows[0];
	const time = visibleRow ? activityHeaderTimeLabel(visibleRow.timestamp || activityDayLabel(visibleRow)) : "";

	return (
		<div className="flex w-full justify-center bg-surface p-6">
			<div aria-label="Activity feed" className="h-96 w-full max-w-3xl overflow-y-auto px-2" role="region" tabIndex={0}>
				<div aria-hidden className="h-8" />
				<JiraWorkItemTimeline
					actions={<div className="ml-auto flex items-center gap-1"><ProjectButterActivityFilterMenu filters={filters} onFiltersChange={setFilters} onSortChange={setSort} sort={sort} /></div>}
					getPreviewLabel={activityDateLabel}
					headerTime={time.charAt(0).toUpperCase() + time.slice(1)}
					onSeek={seekToProgress}
					onSelect={scrollToEntry}
					progress={progress}
					ref={headerRef}
					rows={rows}
					stuck={stuck}
					visibleId={visibleId}
				/>
				<div ref={feedRef}>
					<JiraActivity
						activeEntryId={visibleId ?? undefined}
						commentActionsPlacement="hover"
						commentHeaderLayout="inline"
						composer={null}
						connectorStyle="thread"
						entries={rows}
						hideHeader
						onEntriesChange={(updated) => {
							const byId = new Map(updated.map((entry) => [entry.id, entry]));
							setEntries((current) => current.map((entry) => byId.get(entry.id) ?? entry));
						}}
						renderCommentBody={(entry) => cursor && entry.id === `invocation-${cursor.id}` ? <ProjectButterSessionStart onOpen={() => {}} session={cursor} /> : undefined}
					/>
					{rows.length === 0 ? <p className="text-sm text-text-subtle">No activity matches the selected filters.</p> : null}
				</div>
			</div>
		</div>
	);
}
