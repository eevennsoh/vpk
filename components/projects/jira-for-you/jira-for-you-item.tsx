"use client";

import type { MouseEvent as ReactMouseEvent, Ref } from "react";
import BugIcon from "@atlaskit/icon/core/bug";
import EpicIcon from "@atlaskit/icon/core/epic";
import StoryIcon from "@atlaskit/icon/core/story";
import SubtasksIcon from "@atlaskit/icon/core/subtasks";
import TaskIcon from "@atlaskit/icon/core/task";

import { JiraIssueGenerativeActionMenu } from "@/components/blocks/jira-issue/generative-action-menu";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { RovoSparkleButton } from "@/components/ui-custom/rovo-sparkle";
import { Shimmer } from "@/components/ui/shimmer";
import { AvatarGroup } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ElapsedTime } from "@/components/ui/elapsed-time";
import { Icon } from "@/components/ui/icon";
import { IconTile, type IconTileVariant } from "@/components/ui/icon-tile";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

import {
	JiraForYouStatusLozenge,
	JiraForYouStatusLozengeDropdown,
} from "./jira-for-you-status";
import type {
	JiraForYouAgent,
	JiraForYouIssueType,
	JiraForYouItem,
} from "./jira-for-you-types";

const ISSUE_TYPE_META: Record<
	JiraForYouIssueType,
	{
		Glyph: typeof TaskIcon;
		iconClassName: string;
		label: string;
		variant: IconTileVariant;
	}
> = {
	task: {
		Glyph: TaskIcon,
		iconClassName: "text-icon-accent-blue",
		label: "Task",
		variant: "blue",
	},
	bug: {
		Glyph: BugIcon,
		iconClassName: "text-icon-accent-red",
		label: "Bug",
		variant: "red",
	},
	subtask: {
		Glyph: SubtasksIcon,
		iconClassName: "text-icon-accent-blue",
		label: "Subtask",
		variant: "blue",
	},
	epic: {
		Glyph: EpicIcon,
		iconClassName: "text-icon-accent-purple",
		label: "Epic",
		variant: "purple",
	},
	story: {
		Glyph: StoryIcon,
		iconClassName: "text-icon-accent-green",
		label: "Story",
		variant: "green",
	},
};

export function JiraForYouIssueTypeIcon({
	className,
	issueType,
}: Readonly<{ className?: string; issueType: JiraForYouIssueType }>) {
	const meta = ISSUE_TYPE_META[issueType];
	const Glyph = meta.Glyph;

	return (
		<Icon
			aria-hidden
			className={cn("shrink-0", meta.iconClassName, className)}
			render={<Glyph label="" />}
		/>
	);
}

function MetadataDot() {
	return (
		<span
			aria-hidden="true"
			className="mx-1 text-text-subtlest"
			data-slot="jira-for-you-metadata-separator"
		>
			·
		</span>
	);
}

/**
 * Visual rule (shared with jira-issue agent activity): text shimmer is reserved
 * for "needs input" states; in-progress work uses the rainbow spinner instead.
 * A status can combine both (e.g. "1 Needs input, 2 In progress"),
 * so each comma-separated segment is classified and rendered independently.
 */
function isAwaitingInputStatus(status: string): boolean {
	return /awaiting user|needs input/i.test(status);
}

function JiraForYouStatusSegment({
	segment,
	trailingComma = false,
}: Readonly<{ segment: string; trailingComma?: boolean }>) {
	// The comma is punctuation, not status text, so it stays outside the shimmer
	// while still hugging the segment (no leading space): "Needs input, …".
	const comma = trailingComma ? <span aria-hidden="true">,</span> : null;

	if (isAwaitingInputStatus(segment)) {
		return (
			<span
				className={cn(
					"inline text-xs leading-4",
					trailingComma && "mr-1",
				)}
				data-slot="jira-for-you-status-segment"
			>
				<Shimmer as="span" duration={1.6} spread={2}>
					{segment}
				</Shimmer>
				{comma}
			</span>
		);
	}

	return (
		<span
			className={cn(
				"inline text-xs leading-4",
				trailingComma && "mr-1",
			)}
			data-slot="jira-for-you-status-segment"
		>
			<span className="inline">
				{segment}
				{comma}
			</span>
			<Spinner
				className="ml-1 inline-block align-middle"
				label=""
				size="xs"
				variant="rainbow"
			/>
		</span>
	);
}

function JiraForYouItemStatus({ status }: Readonly<{ status: string }>) {
	const segments = status
		.split(",")
		.map((segment) => segment.trim())
		.filter(Boolean);

	return (
		<span className="inline text-xs leading-4">
			{segments.map((segment, index) => (
				<JiraForYouStatusSegment
					key={segment}
					segment={segment}
					trailingComma={index < segments.length - 1}
				/>
			))}
		</span>
	);
}

function AgentAvatarCluster({
	agents,
}: Readonly<{ agents: readonly JiraForYouAgent[] }>) {
	const label = agents.map((agent) => agent.name).join(", ");
	return (
		<AvatarGroup
			className="shrink-0 -space-x-1 *:data-[slot=avatar]:ring-0!"
			label={`Agents: ${label}`}
		>
			{agents.map((agent) => (
				<AgentAvatarVisual
					avatarSrc={agent.avatarSrc}
					brandName={agent.brandName}
					fallbackText={agent.name.slice(0, 2)}
					key={agent.name}
					label={agent.name}
					sizePx={16}
				/>
			))}
		</AvatarGroup>
	);
}

function ItemActions({
	forceVisible = false,
	item,
	onView,
	viewButtonRef,
}: Readonly<{
	forceVisible?: boolean;
	item: JiraForYouItem;
	onView?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
	viewButtonRef?: Ref<HTMLButtonElement>;
}>) {
	const generativeTrigger = (
		<RovoSparkleButton
			aria-label="Ask Rovo about this work item"
			onClick={(event) => event.stopPropagation()}
			size="compact"
		/>
	);

	return (
		<div
			className={cn(
				"pointer-events-none invisible flex w-0 items-center gap-1 overflow-hidden opacity-0 transition-opacity duration-fast ease-out-practical group-hover:pointer-events-auto group-hover:visible group-hover:w-auto group-hover:overflow-visible group-hover:opacity-100 group-has-[:focus-visible]:pointer-events-auto group-has-[:focus-visible]:visible group-has-[:focus-visible]:w-auto group-has-[:focus-visible]:overflow-visible group-has-[:focus-visible]:opacity-100 has-[:focus-visible]:pointer-events-auto has-[:focus-visible]:visible has-[:focus-visible]:w-auto has-[:focus-visible]:overflow-visible has-[:focus-visible]:opacity-100 has-[button[aria-expanded=true]]:pointer-events-auto has-[button[aria-expanded=true]]:visible has-[button[aria-expanded=true]]:w-auto has-[button[aria-expanded=true]]:overflow-visible has-[button[aria-expanded=true]]:opacity-100 motion-reduce:transition-none",
				forceVisible && "pointer-events-auto visible w-auto overflow-visible opacity-100",
			)}
			data-slot="jira-for-you-actions"
		>
			<JiraIssueGenerativeActionMenu
				action={{ onSubmit: () => undefined }}
				issue={{ issueKey: item.issueKey, summary: item.title }}
				triggerElement={generativeTrigger}
			/>
			<JiraForYouStatusLozengeDropdown value={item.jiraStatus} />
			<Button onClick={onView} ref={viewButtonRef} size="compact" variant="outline">
				View
			</Button>
		</div>
	);
}

export function JiraForYouItemRow({
	isSelected = false,
	isViewActionForcedVisible = false,
	item,
	onItemClick,
	onRowButtonRef,
	onView,
	onViewButtonRef,
}: Readonly<{
	isSelected?: boolean;
	isViewActionForcedVisible?: boolean;
	item: JiraForYouItem;
	onItemClick?: (item: JiraForYouItem, event: ReactMouseEvent<HTMLButtonElement>) => void;
	onRowButtonRef?: (item: JiraForYouItem, node: HTMLButtonElement | null) => void;
	onView?: (item: JiraForYouItem, event: ReactMouseEvent<HTMLButtonElement>) => void;
	onViewButtonRef?: (item: JiraForYouItem, node: HTMLButtonElement | null) => void;
}>) {
	const meta = ISSUE_TYPE_META[item.issueType];
	const Glyph = meta.Glyph;
	const hasActivity = Boolean(item.agents?.length || item.status || item.elapsedSeconds);

	return (
		<li
			aria-current={isSelected ? "true" : undefined}
			className={cn(
				"group relative flex items-center p-3 transition-colors duration-xxshort ease-out-practical hover:bg-bg-neutral-subtle-hovered",
				isSelected && "bg-bg-selected hover:bg-bg-selected-hovered",
			)}
		>
			<IconTile
				aria-hidden
				className="mr-3"
				icon={<Glyph label="" />}
				label={meta.label}
				shape="square"
				size="medium"
				variant={meta.variant}
			/>
			<button
				className={cn(
					"flex min-w-0 flex-1 flex-col items-start justify-center rounded-xs text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
					isSelected && "text-text-selected",
				)}
				data-slot="jira-for-you-row-button"
				onClick={(event) => onItemClick?.(item, event)}
				ref={(node) => onRowButtonRef?.(item, node)}
				type="button"
			>
				<span className="flex w-full min-w-0 items-center gap-1">
					<span className="truncate text-sm font-medium text-text">
						{item.title}
					</span>
				</span>
				<span
					className="flex w-full min-w-0 items-center gap-1 text-xs leading-4 text-text-subtlest"
					data-slot="jira-for-you-metadata"
				>
					{item.agents?.length ? (
						<AgentAvatarCluster agents={item.agents} />
					) : null}
					<span
						className="min-w-0 flex-1 truncate"
						data-slot="jira-for-you-metadata-text"
					>
						{item.status ? (
							<JiraForYouItemStatus status={item.status} />
						) : null}
						<ElapsedTime
							elapsedSeconds={item.elapsedSeconds}
							prefix={item.status ? <MetadataDot /> : null}
						/>
						{hasActivity ? <MetadataDot /> : null}
						<span>{meta.label}</span>
						<MetadataDot />
						<span>{item.issueKey}</span>
						<MetadataDot />
						<span>{item.spaceName}</span>
					</span>
				</span>
			</button>
			<div
				className={cn(
					"relative ml-0 flex w-0 shrink-0 items-center group-hover:ml-3 group-hover:w-auto group-has-[:focus-visible]:ml-3 group-has-[:focus-visible]:w-auto has-[button[aria-expanded=true]]:ml-3 has-[button[aria-expanded=true]]:w-auto @[560px]/jira-for-you-items:ml-3 @[560px]/jira-for-you-items:w-auto",
					isViewActionForcedVisible && "ml-3 w-auto",
				)}
				data-slot="jira-for-you-trailing"
			>
				<ItemActions
					forceVisible={isViewActionForcedVisible}
					item={item}
					onView={(event) => (onView ?? onItemClick)?.(item, event)}
					viewButtonRef={(node) => onViewButtonRef?.(item, node)}
				/>
				<div
					className={cn(
						"hidden transition-opacity duration-fast ease-out-practical @[560px]/jira-for-you-items:block group-hover:hidden group-has-[:focus-visible]:hidden group-has-[[data-slot=jira-for-you-actions]_button[aria-expanded=true]]:hidden motion-reduce:transition-none",
						isViewActionForcedVisible && "hidden",
					)}
				>
					<JiraForYouStatusLozenge value={item.jiraStatus} />
				</div>
			</div>
		</li>
	);
}
