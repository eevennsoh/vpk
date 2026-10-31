"use client";

import { useMemo, useState } from "react";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import TaskIcon from "@atlaskit/icon/core/task";
import { JiraActivity, jiraActivitySegmentsToPlainText, type JiraActivityEntry, type JiraActivityFilter } from "@/components/blocks/jira-activity";
import { ScrubberRail } from "@/components/blocks/scrubber/components/scrubber-rail";
import type { ScrubberEntry } from "@/components/blocks/scrubber/lib/scrubber-entries";
import { activityDateLabel, PROJECT_BUTTER_CURRENT_USER, PROJECT_BUTTER_SUMMARY_ID } from "@/components/blocks/jira-work-item/project-butter/activity-data";
import { ProjectButterSessionSummary } from "@/components/blocks/jira-work-item/project-butter/activity-session-summary";
import { useProjectButterActivityNavigation } from "@/components/blocks/jira-work-item/project-butter/use-activity-navigation";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
import { Button } from "@/components/ui/button";
import { PROJECT_BUTTER_REFERENCE_COMMENTS, PROJECT_BUTTER_REFERENCE_HISTORY } from "@/components/blocks/jira-work-item/project-butter/reference-data";
import { ProjectButterHistoryChange, ProjectButterReferenceCommentBody } from "@/components/blocks/jira-work-item/project-butter/reference-activity-body";
import { filterJiraActivityEntries } from "@/components/blocks/jira-activity/lib/jira-activity-filter";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

function entryLabel(entry: JiraActivityEntry): string {
	return `${entry.actor.name}: ${entry.kind === "comment" ? jiraActivitySegmentsToPlainText(entry.body) : entry.kind === "event" ? jiraActivitySegmentsToPlainText(entry.segments) : "Files changed"}`;
}

const REFERENCE_HISTORY = new Map(PROJECT_BUTTER_REFERENCE_HISTORY.map((item) => [item.id, item]));
const REFERENCE_COMMENTS = new Map(PROJECT_BUTTER_REFERENCE_COMMENTS.map((item) => [item.id, item]));

export function ProjectButterActivity({ content, sidePanel }: Readonly<{ content: ProjectButterContent; sidePanel: boolean }>) {
	const [collapsed, setCollapsed] = useState(false);
	const [newestFirst, setNewestFirst] = useState(true);
	const [filter, setFilter] = useState<JiraActivityFilter>("all");
	const [hoverId, setHoverId] = useState<string | null>(null);
	const ordered = useMemo(() => newestFirst ? [...content.activityEntries].reverse() : content.activityEntries, [content.activityEntries, newestFirst]);
	const visible = useMemo(() => filterJiraActivityEntries(ordered, filter), [ordered, filter]);
	const { feedRef, scrollToEntry, visibleId } = useProjectButterActivityNavigation(visible, sidePanel, content.activityFocusId);
	const activeIndex = Math.max(0, visible.findIndex((entry) => entry.id === visibleId));
	const railEntries: ScrubberEntry[] = visible.map((entry, index) => ({ id: entry.id, kind: "minor", offset: visible.length <= 1 ? 0.02 : 0.02 + (index / (visible.length - 1)) * 0.96, heading: activityDateLabel(entry), label: `Go to step ${index + 1}: ${entryLabel(entry)}` }));
	const previewIndex = Math.max(0, visible.findIndex((entry) => entry.id === (hoverId ?? visibleId)));
	const preview = visible[previewIndex];
	return (
		<section aria-label="Activity" className="min-w-0" data-collapsed={collapsed} data-project-butter-activity>
			<div className="sticky top-0 z-20 -mx-1 flex min-h-14 items-center gap-4 bg-surface px-1 py-3">
				<h2><button aria-expanded={!collapsed} className="group flex items-center gap-1 rounded-sm text-sm font-medium text-text outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setCollapsed((value) => !value)} type="button">Activity<ChevronDownIcon label="" size="small" /></button></h2>
				{!collapsed && visible.length > 1 ? <div className="relative min-w-0 flex-1 pt-2">
					{preview && hoverId ? <span className="pointer-events-none absolute -top-4 flex items-center gap-1 whitespace-nowrap rounded-md bg-surface px-1 text-xs text-text-subtle" style={{ left: `${railEntries[previewIndex].offset * 100}%`, transform: `translateX(-${railEntries[previewIndex].offset * 100}%)` }}><TaskIcon label="" size="small" />{activityDateLabel(preview)}</span> : null}
					<ScrubberRail activeIndex={activeIndex} appearance="dots" ariaLabel="Navigate activity" entries={railEntries} onFocusChange={setHoverId} onHoverChange={setHoverId} onSelect={scrollToEntry} selectionMode="drag" showPill={false} />
				</div> : <span className="flex-1" />}
				<DropdownMenu><DropdownMenuTrigger render={<Button aria-label="More activity actions" size="icon-compact" type="button" variant="ghost" />}><ShowMoreHorizontalIcon label="" size="small" /></DropdownMenuTrigger><DropdownMenuContent align="end" positionerClassName="z-[650]"><DropdownMenuCheckboxItem checked={newestFirst} onCheckedChange={setNewestFirst}>Newest first</DropdownMenuCheckboxItem><DropdownMenuRadioGroup onValueChange={(value) => { if (value === "all" || value === "comments-only" || value === "history-only") setFilter(value); }} value={filter}><DropdownMenuRadioItem value="all">All activity</DropdownMenuRadioItem><DropdownMenuRadioItem value="comments-only">Comments</DropdownMenuRadioItem><DropdownMenuRadioItem value="history-only">History</DropdownMenuRadioItem></DropdownMenuRadioGroup></DropdownMenuContent></DropdownMenu>
			</div>
			<div className="[&_[data-jira-activity-entry-id]]:scroll-mt-16" ref={feedRef}>
				<JiraActivity
					activeEntryId={visible[activeIndex]?.id} collapsed={collapsed} composer={null} currentUser={PROJECT_BUTTER_CURRENT_USER} entries={ordered} filter={filter} hideHeader
					onEntriesChange={(entries) => content.setActivityEntries(newestFirst ? [...entries].reverse() : entries)}
					renderEntry={(entry) => { const item = REFERENCE_HISTORY.get(entry.id); return item && item.changes.length > 0 ? <ProjectButterHistoryChange item={item} timestamp={entry.timestamp} /> : undefined; }}
					renderCommentBody={(entry) => { const item = REFERENCE_COMMENTS.get(entry.id); return entry.id === PROJECT_BUTTER_SUMMARY_ID ? <ProjectButterSessionSummary /> : <ProjectButterReferenceCommentBody markdown={item?.markdown ?? jiraActivitySegmentsToPlainText(entry.body)} />; }}
				/>
			</div>
		</section>
	);
}
