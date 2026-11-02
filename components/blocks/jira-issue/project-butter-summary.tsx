"use client";

import type { ReactNode } from "react";
import EpicIcon from "@atlaskit/icon/core/epic";
import BugIcon from "@atlaskit/icon/core/bug";
import SubtasksIcon from "@atlaskit/icon/core/subtasks";
import FlagIcon from "@atlaskit/icon/core/flag";
import StoryIcon from "@atlaskit/icon/core/story";
import TaskIcon from "@atlaskit/icon/core/task";
import StatusWorkflowWarningIcon from "@atlaskit/icon-lab/core/status-workflow-warning";
import { Tag, TagGroup } from "@/components/ui/tag";
import { cn } from "@/lib/utils";
import type { JiraIssueDefaultProps } from "./index";
import { ButterPriorityIcon } from "./priority";
import { formatButterDueDate } from "./project-butter-model";
import { ProjectButterSubtasks } from "./project-butter-subtasks";
import { ProjectButterAddAgent } from "./project-butter-add-agent";
import { JiraIssuePullRequestCluster } from "./pull-request-cluster";

type ProjectButterSummaryProps = Pick<
	JiraIssueDefaultProps,
	| "issueKey"
	| "summary"
	| "priority"
	| "metadata"
	| "parentEpicControl"
	| "tags"
	| "subtasks"
	| "onSubtaskOpen"
	| "pullRequestNumber"
	| "pullRequestPreview"
	| "pullRequestStatus"
	| "pullRequestTitle"
	| "showPriorityIndicator"
	| "showFooterMetadata"
	| "assignment"
> & { assignee?: ReactNode; moreAction?: ReactNode; allowAddAgent?: boolean };

const WORK_TYPE_ICONS = { task: TaskIcon, story: StoryIcon, epic: EpicIcon, bug: BugIcon, subtask: SubtasksIcon };
const WORK_TYPE_HOVER_CLASSES = {
	task: "group-hover/jira-issue:text-icon-brand",
	story: "group-hover/jira-issue:text-icon-accent-lime",
	epic: "group-hover/jira-issue:text-icon-accent-purple",
	bug: "group-hover/jira-issue:text-icon-danger",
	subtask: "group-hover/jira-issue:text-icon-brand",
};

export function ProjectButterSummary({
	issueKey,
	summary,
	priority = "major",
	metadata,
	parentEpicControl,
	tags,
	subtasks = [],
	onSubtaskOpen,
	assignee,
	moreAction,
	pullRequestNumber,
	pullRequestPreview,
	pullRequestStatus,
	pullRequestTitle,
	showPriorityIndicator = true,
	showFooterMetadata = true,
	assignment,
	allowAddAgent = true,
}: Readonly<ProjectButterSummaryProps>) {
	const issueType = metadata?.issueType ?? "task";
	const WorkTypeIcon = WORK_TYPE_ICONS[issueType];
	return (
		<div className="flex min-w-0 flex-col gap-3" data-slot="jira-issue-project-butter">
			<div className="min-w-0">
				<div className="flex min-h-6 items-center justify-between gap-2">
					<span className="flex min-w-0 items-center gap-1 text-xs leading-4 text-text-subtle">
						<span
							className={cn(
								"shrink-0 text-icon-subtle transition-colors duration-fast ease-out-practical motion-reduce:transition-none",
								WORK_TYPE_HOVER_CLASSES[issueType],
							)}
						>
							<WorkTypeIcon label={issueType} size="small" color="currentColor" />
						</span>
						<span className="truncate">{issueKey}</span>
					</span>
					<div className="size-6 shrink-0">{moreAction}</div>
				</div>
				<p className="mt-0.5 line-clamp-2 break-words text-sm leading-5 text-text">{summary}</p>
			</div>
			<div className="flex min-w-0 flex-col items-start gap-1">
				{parentEpicControl}
				{tags?.length || subtasks.length ? (
					<TagGroup className="min-w-0 gap-1">
						{tags?.map((tag, index) => (
							<Tag
								key={`${tag.text}-${index}`}
								color={tag.color}
								className="duration-fast ease-out-practical motion-reduce:transition-none [@media(hover:hover)]:group-[:not(:hover):not(:focus-within)]/jira-issue:border-border-accent-gray-subtle"
							>
								{tag.text}
							</Tag>
						))}
						<ProjectButterSubtasks subtasks={subtasks} onSubtaskOpen={onSubtaskOpen} />
					</TagGroup>
				) : null}
			</div>
			{showFooterMetadata ? (
				<ProjectButterFooter
					issueKey={issueKey}
					assignment={assignment}
					allowAddAgent={allowAddAgent}
					metadata={metadata}
					priority={priority}
					assignee={assignee}
					pullRequestNumber={pullRequestNumber}
					pullRequestPreview={pullRequestPreview}
					pullRequestStatus={pullRequestStatus}
					pullRequestTitle={pullRequestTitle ?? summary}
					showPriorityIndicator={showPriorityIndicator}
				/>
			) : null}
		</div>
	);
}

function ProjectButterFooter({
	issueKey,
	assignment,
	allowAddAgent,
	metadata,
	priority = "major",
	assignee,
	pullRequestNumber,
	pullRequestPreview,
	pullRequestStatus,
	pullRequestTitle,
	showPriorityIndicator,
}: Readonly<
	Pick<
		ProjectButterSummaryProps,
		| "metadata"
		| "priority"
		| "assignee"
		| "pullRequestNumber"
		| "pullRequestPreview"
		| "pullRequestStatus"
		| "showPriorityIndicator"
		| "issueKey"
		| "assignment"
		| "allowAddAgent"
	> & { pullRequestTitle: string }
>) {
	const dueDate = formatButterDueDate(metadata?.dueDate);
	return (
		<div className="flex min-h-6 min-w-0 items-center justify-between gap-1">
			<div className={cn("flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 text-xs leading-4 text-text-subtle", !dueDate && "-ml-1")}>
				{dueDate ? (
					<span className="mr-1 inline-flex shrink-0 items-center gap-1">
						<span className="sr-only">{metadata?.dueDateWarning ? "Critical due date " : "Due "}</span>
						{metadata?.dueDateWarning ? (
							<StatusWorkflowWarningIcon label="" size="small" color="currentColor" />
						) : null}
						<time dateTime={metadata?.dueDate}>{dueDate}</time>
					</span>
				) : null}
				{pullRequestNumber ? (
					<JiraIssuePullRequestCluster
						pullRequestNumber={pullRequestNumber}
						pullRequestPreview={pullRequestPreview}
						pullRequestStatus={pullRequestStatus}
						pullRequestTitle={pullRequestTitle}
						usesStrokeChrome
						tone="subtle"
					/>
				) : null}
				{showPriorityIndicator ? (
					<span className="grid size-6 shrink-0 place-items-center">
						<ButterPriorityIcon priority={priority} />
					</span>
				) : null}
				{metadata?.flagged ? (
					<span className="grid size-6 shrink-0 place-items-center text-icon-danger">
						<FlagIcon label="Flagged" size="small" color="currentColor" />
					</span>
				) : null}
				{metadata?.storyPoints !== undefined ? (
					<span className="grid size-6 shrink-0 place-items-center text-text-subtlest">
						{metadata.storyPoints}
						<span className="sr-only"> story points</span>
					</span>
				) : null}
			</div>
			<ProjectButterFooterActions
				issueKey={issueKey}
				assignment={assignment}
				allowAddAgent={allowAddAgent}
				assignee={assignee}
			/>
		</div>
	);
}

function ProjectButterFooterActions({
	issueKey,
	assignment,
	allowAddAgent,
	assignee,
}: Readonly<Pick<ProjectButterSummaryProps, "issueKey" | "assignment" | "allowAddAgent" | "assignee">>) {
	const showAgentAdd = allowAddAgent && Boolean(assignment?.onAgentAssign || assignment?.onAssignedAgentIdsChange);
	if (!assignee && !showAgentAdd) return null;
	return (
		<div className="flex shrink-0 items-center gap-1" data-slot="jira-issue-footer-actions">
			{showAgentAdd ? <ProjectButterAddAgent issueKey={issueKey} assignment={assignment} /> : null}
			{assignee ? (
				<div
					className="flex size-6 shrink-0 items-center justify-center"
					data-slot="jira-issue-assignee-slot"
				>
					{assignee}
				</div>
			) : null}
		</div>
	);
}
