"use client";

import type { ReactNode } from "react";
import AutomationIcon from "@atlaskit/icon/core/automation";
import PriorityMajorIcon from "@atlaskit/icon/core/priority-major";
import PriorityMediumIcon from "@atlaskit/icon/core/priority-medium";
import PriorityMinorIcon from "@atlaskit/icon/core/priority-minor";
import TaskIcon from "@atlaskit/icon/core/task";

import {
	Avatar,
	AvatarFallback,
	AvatarImage,
	AvatarUnassigned,
	type AvatarProps,
	type AvatarUnassignedKind,
} from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IconTile } from "@/components/ui/icon-tile";
import { Tag, TagGroup } from "@/components/ui/tag";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import {
	getIssueInitial,
	resolveIssueAssigneeUnassignedKind,
	resolveJiraIssueIconMetrics,
} from "@/components/blocks/jira-issue/lib";
import { JiraIssuePullRequestCluster } from "@/components/blocks/jira-issue/pull-request-cluster";
import type {
	JiraIssueIconScale,
	JiraIssuePriority,
	JiraIssuePullRequestPreview,
	JiraIssuePullRequestStatus,
	JiraIssueTag,
} from "@/components/blocks/jira-issue/types";

const PRIORITY_ICONS = {
	major: PriorityMajorIcon,
	medium: PriorityMediumIcon,
	minor: PriorityMinorIcon,
} as const;

/** Rest as the default gray Tag; reveal the label color while the issue card is hovered or focused. */
const ISSUE_TAG_IDLE_BORDER_CLASS =
	"duration-fast ease-out-practical motion-reduce:transition-none [@media(hover:hover)]:group-[:not(:hover):not(:focus-within)]/jira-issue:border-border-accent-gray-subtle";

const PRIORITY_COLORS = {
	major: token("color.icon.danger"),
	medium: token("color.icon.information"),
	minor: token("color.icon.success"),
} as const;

function JiraIssueAssignee({
	assigneeAvatarLabel,
	assigneeAvatarShape,
	assigneeAvatarSrc,
	assigneePulse,
	assigneeUnassignedKind,
	issueKey,
	size = "sm",
}: Readonly<{
	assigneeAvatarLabel?: string;
	assigneeAvatarShape: NonNullable<AvatarProps["shape"]>;
	assigneeAvatarSrc?: string;
	assigneePulse: boolean;
	assigneeUnassignedKind?: AvatarUnassignedKind;
	issueKey: string;
	size?: NonNullable<AvatarProps["size"]>;
}>) {
	const unassignedKind = resolveIssueAssigneeUnassignedKind(
		assigneeAvatarSrc,
		assigneeUnassignedKind,
	);
	if (unassignedKind) {
		return (
			<AvatarUnassigned
				className={cn(
					assigneePulse && "motion-safe:animate-pulse ring-2 ring-border-focused ring-offset-2 ring-offset-surface",
				)}
				kind={unassignedKind}
				size={size}
			/>
		);
	}

	return (
		<Avatar
			className={cn(
				assigneePulse && "motion-safe:animate-pulse ring-2 ring-border-focused ring-offset-2 ring-offset-surface",
			)}
			label={assigneeAvatarLabel ?? issueKey}
			shape={assigneeAvatarShape}
			size={size}
		>
			{assigneeAvatarSrc ? <AvatarImage src={assigneeAvatarSrc} alt="" /> : null}
			<AvatarFallback>{getIssueInitial(issueKey)}</AvatarFallback>
		</Avatar>
	);
}

export function JiraIssueSummary({
	assigneeAvatarLabel,
	assigneeAvatarShape,
	assigneeAvatarSrc,
	assigneePulse,
	assigneeUnassignedKind,
	iconScale = "compact",
	issueKey,
	issueTypeLabel,
	isMounted,
	parentEpicControl,
	priority,
	pullRequestNumber,
	pullRequestPreview,
	pullRequestStatus,
	pullRequestTitle,
	showAutomationIndicator,
	showPriorityIndicator,
	summary,
	tags,
	usesStrokeChrome,
}: Readonly<{
	assigneeAvatarLabel?: string;
	assigneeAvatarShape: NonNullable<AvatarProps["shape"]>;
	assigneeAvatarSrc?: string;
	assigneePulse: boolean;
	assigneeUnassignedKind?: AvatarUnassignedKind;
	iconScale?: JiraIssueIconScale;
	issueKey: string;
	issueTypeLabel: string;
	isMounted: boolean;
	parentEpicControl?: ReactNode;
	priority: JiraIssuePriority;
	pullRequestNumber?: number;
	pullRequestPreview?: JiraIssuePullRequestPreview;
	pullRequestStatus?: JiraIssuePullRequestStatus;
	pullRequestTitle?: string;
	showAutomationIndicator: boolean;
	showPriorityIndicator: boolean;
	summary: string;
	tags?: readonly JiraIssueTag[];
	usesStrokeChrome: boolean;
}>) {
	const PriorityIcon = PRIORITY_ICONS[priority];
	const priorityColor = PRIORITY_COLORS[priority];
	const iconMetrics = resolveJiraIssueIconMetrics(iconScale);
	const comfortableIcons = iconScale === "comfortable";
	const compactIconClassName = iconMetrics.compactIconClassName;
	const pullRequestCluster = pullRequestNumber ? (
		<JiraIssuePullRequestCluster
			iconScale={iconScale}
			pullRequestNumber={pullRequestNumber}
			pullRequestPreview={pullRequestPreview}
			pullRequestStatus={pullRequestStatus}
			pullRequestTitle={pullRequestTitle ?? summary}
			usesStrokeChrome={usesStrokeChrome}
		/>
	) : null;
	const metadataCluster = showAutomationIndicator ? (
		usesStrokeChrome ? (
			<span
				aria-label="Automation linked"
				className={cn(
					buttonVariants({ size: "icon-compact", variant: "ghost" }),
					"text-icon-accent-orange [&_svg]:text-current",
					compactIconClassName,
				)}
			>
				<Icon render={<AutomationIcon label="" size="small" color="currentColor" />} />
			</span>
		) : (
			<span className="grid size-6 place-items-center text-icon-accent-orange" aria-label="Automation linked">
				<AutomationIcon label="" size="small" color="currentColor" />
			</span>
		)
	) : (
		<div className={cn("flex shrink-0 items-center", usesStrokeChrome ? (comfortableIcons ? "gap-1" : "gap-0") : "gap-1.5")}>
			{showPriorityIndicator ? (
				usesStrokeChrome ? (
					<span
						aria-label={`${priority} priority`}
						role="img"
						className={cn(
							buttonVariants({ size: "icon-compact", variant: "ghost" }),
							"[&_svg]:text-current",
							compactIconClassName,
						)}
						style={{ color: priorityColor }}
					>
						<Icon render={<PriorityIcon label="" size="small" color="currentColor" />} />
					</span>
				) : (
					<PriorityIcon
						label={`${priority} priority`}
						color={priorityColor}
					/>
				)
			) : null}
			{isMounted ? (
				usesStrokeChrome ? (
					<span
						className={cn(
							"flex size-6 shrink-0 items-center justify-center",
							comfortableIcons ? undefined : "-mr-1",
						)}
						data-slot="jira-issue-assignee-slot"
					>
						<JiraIssueAssignee
							assigneeAvatarLabel={assigneeAvatarLabel}
							assigneeAvatarShape={assigneeAvatarShape}
							assigneeAvatarSrc={assigneeAvatarSrc}
							assigneePulse={assigneePulse}
							assigneeUnassignedKind={assigneeUnassignedKind}
							issueKey={issueKey}
							size={iconMetrics.assigneeSize}
						/>
					</span>
				) : (
					<JiraIssueAssignee
						assigneeAvatarLabel={assigneeAvatarLabel}
						assigneeAvatarShape={assigneeAvatarShape}
						assigneeAvatarSrc={assigneeAvatarSrc}
						assigneePulse={assigneePulse}
						assigneeUnassignedKind={assigneeUnassignedKind}
						issueKey={issueKey}
						size="sm"
					/>
				)
			) : null}
		</div>
	);

	return (
		<div className="flex min-w-0 flex-col gap-2">
			<div className="flex min-w-0 items-start gap-2">
				<span className={cn("min-w-0 flex-1", usesStrokeChrome ? "line-clamp-2 text-sm leading-5" : "text-sm")}>{summary}</span>
				<div className="size-6 shrink-0" data-slot="jira-issue-more-action" />
			</div>

			{parentEpicControl ? (
				<div className="flex min-w-0 flex-col items-start gap-1">
					<p className="text-sm font-semibold leading-5 text-text-subtle">Parent</p>
					{parentEpicControl}
				</div>
			) : null}

			{tags && tags.length > 0 ? (
				<TagGroup className="min-w-0 gap-1 overflow-hidden">
					{tags.map((tag, index) => (
						<Tag
							key={`${tag.text}-${index}`}
							className={ISSUE_TAG_IDLE_BORDER_CLASS}
							color={tag.color}
						>
							{tag.text}
						</Tag>
					))}
				</TagGroup>
			) : null}

			<div className="pt-0.5">
				<div className="flex min-w-0 items-center justify-between">
					<div className={usesStrokeChrome ? "flex min-w-0 items-center" : "flex min-w-0 items-center gap-2"}>
						<div
							className={
								usesStrokeChrome
									? "flex shrink-0 items-center gap-1.5"
									: "flex shrink-0 items-center gap-1"
							}
						>
							{usesStrokeChrome ? (
								<IconTile
									as="span"
									icon={<TaskIcon label="" color={token("color.icon.brand")} size="small" />}
									iconSize={iconMetrics.iconTileIconSize}
									label={issueTypeLabel}
									size={iconMetrics.iconTileSize}
									variant="transparent"
								/>
							) : (
								<TaskIcon
									label={issueTypeLabel}
									color={token("color.icon.brand")}
								/>
							)}
							<span
								className={
									usesStrokeChrome
										? iconMetrics.issueKeyClassName
										: "text-xs font-semibold text-text-subtlest"
								}
							>
								{issueKey}
							</span>
						</div>
						{usesStrokeChrome ? null : pullRequestCluster}
					</div>

					{usesStrokeChrome && pullRequestCluster ? (
						<div className="flex shrink-0 items-center gap-0">
							{pullRequestCluster}
							{metadataCluster}
						</div>
					) : (
						metadataCluster
					)}
				</div>
			</div>
		</div>
	);
}
