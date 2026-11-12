"use client";

import { AnimatePresence, motion } from "motion/react";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import SubtasksIcon from "@atlaskit/icon/core/subtasks";
import TaskIcon from "@atlaskit/icon/core/task";

import type { JiraIssueSubtask } from "@/components/blocks/jira-issue";
import { JiraIssueCountBadge } from "@/components/blocks/jira-issue/count-badge";
import {
	getIssueInitial,
	getJiraIssueLayoutTransition,
	getJiraIssuePresenceMotion,
	resolveJiraIssueIconMetrics,
	resolveJiraIssueSubtaskChrome,
	JIRA_ISSUE_MOTION_STYLE,
} from "@/components/blocks/jira-issue/lib";
import { Avatar, AvatarFallback, AvatarImage, AvatarUnassigned } from "@/components/ui/avatar";
import { IconTile } from "@/components/ui/icon-tile";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tag } from "@/components/ui/tag";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import { resolveJiraIssueChrome, type JiraIssueChromeStyles } from "./chrome";
import type { JiraIssueChrome, JiraIssueIconScale } from "./types";

function JiraIssueSubtaskCard({
	chromeStyles,
	iconScale,
	subtask,
	usesStrokeChrome,
}: Readonly<{
	chromeStyles: JiraIssueChromeStyles;
	iconScale: JiraIssueIconScale;
	subtask: JiraIssueSubtask;
	usesStrokeChrome: boolean;
}>) {
	const iconMetrics = resolveJiraIssueIconMetrics(iconScale);

	return (
		<div
			className={cn(
				"border bg-surface p-3",
				usesStrokeChrome ? undefined : "hover:bg-surface-hovered",
				chromeStyles.restClassName,
				chromeStyles.hoverClassName,
			)}
			data-slot="jira-issue-subtask-card"
			style={{
				borderRadius: token("radius.large"),
				boxShadow: chromeStyles.boxShadow,
			}}
		>
			<div className="flex min-w-0 flex-col gap-2">
				<p className="text-sm leading-5 text-text">{subtask.summary}</p>
				<div className="pt-0.5">
					<div className="flex min-w-0 items-center justify-between">
						<div className="flex min-w-0 items-center">
							<div className="flex shrink-0 items-center gap-1.5">
								<IconTile
									as="span"
									icon={<TaskIcon label="" color={token("color.icon.brand")} size="small" />}
									iconSize={iconMetrics.iconTileIconSize}
									label={subtask.issueTypeLabel ?? "Sub-task"}
									size={iconMetrics.iconTileSize}
									variant="transparent"
								/>
								<span className={iconMetrics.issueKeyClassName}>
									{subtask.issueKey}
								</span>
							</div>
						</div>
						<div className="flex shrink-0 items-center gap-1">
							<Tag className="self-center">{subtask.status ?? "To Do"}</Tag>
							<span
								className="flex size-6 shrink-0 items-center justify-center"
								data-slot="jira-issue-assignee-slot"
							>
								{subtask.assigneeUnassignedKind ? (
									<AvatarUnassigned kind={subtask.assigneeUnassignedKind} size={iconMetrics.assigneeSize} />
								) : (
									<Avatar label={subtask.assigneeAvatarLabel ?? subtask.issueKey} size={iconMetrics.assigneeSize}>
										{subtask.assigneeAvatarSrc ? <AvatarImage alt="" src={subtask.assigneeAvatarSrc} /> : null}
										<AvatarFallback>{getIssueInitial(subtask.issueKey)}</AvatarFallback>
									</Avatar>
								)}
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export function JiraIssueSeparator({
	inset = 0,
	usesStrokeChrome,
}: Readonly<{ inset?: number; usesStrokeChrome: boolean }>) {
	return (
		<Separator
			className={cn(
				"h-px motion-reduce:transition-none",
				usesStrokeChrome
					? "bg-border-disabled transition-[margin,width,background-color] duration-normal ease-out group-[&:hover:not(:has([data-slot=jira-issue-subtask-card]:hover))]/jira-issue:bg-border group-[&:hover:not(:has([data-slot=jira-issue-subtask-card]:hover))]/jira-issue-card:bg-border"
					: "transition-[margin,width] duration-medium ease-in-out",
			)}
			style={{
				marginLeft: `${inset - 1}px`,
				marginRight: `${inset - 1}px`,
				width: `calc(100% + ${2 - inset * 2}px)`,
			}}
		/>
	);
}

export function JiraIssueSubtasks({
	chrome,
	compact = false,
	completedCount,
	controlId,
	expanded,
	hasInsetSurface,
	iconScale = "compact",
	label,
	onToggle,
	shouldReduceMotion,
	subtaskChrome,
	subtasks,
}: Readonly<{
	chrome: JiraIssueChrome;
	compact?: boolean;
	completedCount: number;
	controlId: string;
	expanded: boolean;
	hasInsetSurface: boolean;
	iconScale?: JiraIssueIconScale;
	label: string;
	onToggle: () => void;
	shouldReduceMotion: boolean | null;
	subtaskChrome?: JiraIssueChrome;
	subtasks: readonly JiraIssueSubtask[];
}>) {
	const iconMetrics = resolveJiraIssueIconMetrics(iconScale);
	const comfortableIcons = iconScale === "comfortable";
	const nestedSubtaskChrome = resolveJiraIssueSubtaskChrome(chrome, subtaskChrome, compact);
	const chromeStyles = resolveJiraIssueChrome(nestedSubtaskChrome);
	const usesStrokeChrome = compact || chrome === "stroke";
	const totalCount = subtasks.length;
	const completedPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
	const showSubtaskProgress = totalCount > 0;
	const subtasksToggleLabel = `${expanded ? "Hide" : "Show"} ${label.toLowerCase()}`;
	const layoutTransition = getJiraIssueLayoutTransition(shouldReduceMotion);
	const presenceMotion = getJiraIssuePresenceMotion(shouldReduceMotion);
	const headerRowClassName = cn(
		"flex h-8 w-full items-center justify-between px-3 py-2",
		usesStrokeChrome && "-mx-px w-[calc(100%+2px)]",
	);
	const subtasksHeading = (
		<div
			className={
				usesStrokeChrome
					? "flex items-center gap-1.5 text-xs font-medium leading-4 text-text-subtle"
					: "flex items-center gap-2 text-sm font-medium leading-5 text-text-subtle"
			}
		>
			{usesStrokeChrome ? (
				<IconTile
					aria-hidden
					as="span"
					className="text-icon-subtle"
					icon={<SubtasksIcon label="" size="small" spacing="none" color="currentColor" />}
					iconSize={iconMetrics.iconTileIconSize}
					label=""
					size={iconMetrics.iconTileSize}
					variant="transparent"
				/>
			) : (
				<span
					className="grid size-4 shrink-0 place-items-center text-icon-subtle"
					aria-hidden="true"
				>
					<SubtasksIcon
						label=""
						size="medium"
						spacing="none"
						color="currentColor"
					/>
				</span>
			)}
			<span>{label}</span>
			<JiraIssueCountBadge compact={usesStrokeChrome}>{completedCount}/{totalCount}</JiraIssueCountBadge>
		</div>
	);

	return (
		<section aria-label={label}>
			<div className={headerRowClassName}>
				{subtasksHeading}
				<Tooltip>
					<TooltipTrigger
						render={
							<button
								type="button"
								aria-controls={controlId}
								aria-expanded={expanded}
								aria-label={subtasksToggleLabel}
								className={cn(
									"inline-flex items-center justify-center rounded-sm text-icon-subtle outline-none transition-colors duration-normal ease-out hover:bg-bg-neutral-subtle-hovered active:bg-bg-neutral-subtle-pressed focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
									usesStrokeChrome && !comfortableIcons ? "size-4" : "size-6",
								)}
								onClick={onToggle}
							>
								{expanded ? (
									<ChevronDownIcon label="" size="small" color="currentColor" />
								) : (
									<ChevronRightIcon label="" size="small" color="currentColor" />
								)}
							</button>
						}
					/>
					<TooltipContent>{subtasksToggleLabel}</TooltipContent>
				</Tooltip>
			</div>
			<AnimatePresence initial={false} mode="popLayout">
				{expanded ? (
					<motion.div
						id={controlId}
						key="subtasks-panel"
						animate={presenceMotion.animate}
						className={cn("flex flex-col gap-2 px-3 pt-1", hasInsetSurface ? "pb-2" : "pb-3")}
						exit={presenceMotion.exit}
						initial={presenceMotion.initial}
						layout={shouldReduceMotion ? false : "position"}
						style={shouldReduceMotion ? undefined : JIRA_ISSUE_MOTION_STYLE}
						transition={layoutTransition}
					>
						{showSubtaskProgress ? (
							<Progress
								aria-label={`${completedCount} of ${totalCount} ${label.toLowerCase()} done`}
								className="w-full"
								data-slot="jira-issue-subtask-progress"
								value={completedPercent}
								variant="success"
							/>
						) : null}
						{subtasks.map((subtask) => (
							<JiraIssueSubtaskCard
								chromeStyles={chromeStyles}
								iconScale={iconScale}
								key={subtask.issueKey}
								subtask={subtask}
								usesStrokeChrome={nestedSubtaskChrome === "stroke"}
							/>
						))}
					</motion.div>
				) : null}
			</AnimatePresence>
		</section>
	);
}
