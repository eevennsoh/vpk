"use client";

import type { ReactElement } from "react";
import QuestionCircleFilledIcon from "@atlaskit/icon-lab/core/question-circle-filled";
import StatusErrorIcon from "@atlaskit/icon/core/status-error";
import StatusSuccessIcon from "@atlaskit/icon/core/status-success";

import {
	AgentAssignment,
	type AgentAssignmentAgent,
	type AgentAssignmentProps,
} from "@/components/blocks/agent-assignment";
import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";
import {
	JiraIssueAgentIntroLabel,
	JiraIssueShimmeringAgentLabel,
	useJiraIssueAgentStartupPhase,
} from "@/components/blocks/jira-issue/agent-activity-startup";
import type { JiraIssueAgentSessionDragBinding } from "@/components/blocks/jira-issue/agent-session-drag";
import { JiraIssueAgentLinkFlashOverlay, type JiraIssueAgentLinkFlash } from "@/components/blocks/jira-issue/agent-link-flash";
import { JiraIssueAgentSessionUnlinkButton } from "@/components/blocks/jira-issue/agent-session-unlink-button";
import type { JiraIssueIconScale } from "@/components/blocks/jira-issue/types";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { AgentLoading, type AgentLoadingAgent } from "@/components/ui-custom/agent-loading";
import { AnimatedDots } from "@/components/ui-custom/animated-dots";
import { Shimmer } from "@/components/ui-custom/shimmer";
import { TWGLoader } from "@/components/ui-custom/twg-loader";
import { AvatarGroup } from "@/components/ui/avatar";
import { IconTile } from "@/components/ui/icon-tile";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

import type {
	JiraIssueAgentActivity,
	JiraIssueAgentActivityAvatarLayout,
	JiraIssueAgentActivityIndicatorRenderer,
} from "./agent-activity";

export type JiraIssueAgentAssignment = Partial<
	Pick<
		AgentAssignmentProps,
		| "agents"
		| "addAgentLabel"
		| "assignedAgents"
		| "defaultPinnedAgentIds"
		| "onAgentAssign"
		| "onAssignedAgentIdsChange"
		| "onBrowseAgents"
		| "onContinueExistingSession"
		| "onCreateAgent"
		| "onRenameAssignedAgent"
		| "onStartNewSession"
		| "pinnedItemsLabel"
		| "usedAgentIds"
	>
>;

function getAgentInitial(name: string): string {
	return name.trim()[0]?.toUpperCase() ?? "A";
}

function toAgentLoadingAgent(activity: JiraIssueAgentActivity): AgentLoadingAgent {
	return {
		id: activity.id,
		name: activity.name,
		status: activity.state === "completed" ? "finished" : "working",
		avatar: {
			...(activity.avatarSrc ? { avatarSrc: activity.avatarSrc } : {}),
			...(activity.agentBrandName ? { brandName: activity.agentBrandName } : {}),
			fallbackText: getAgentInitial(activity.name),
		},
	};
}

/** 16px glyph in a 24px transparent IconTile — same recipe as completed-agent-runs. */
function JiraIssueAgentStatusIconTile({
	className,
	icon,
}: Readonly<{
	className?: string;
	icon: ReactElement;
}>): ReactElement {
	return (
		<IconTile
			aria-hidden
			as="span"
			className={className}
			icon={icon}
			iconSize="medium"
			label=""
			size="small"
			variant="transparent"
		/>
	);
}

function JiraIssueCompletedAgentStatusIcon({
	isFailed,
	renderAgentActivityIndicator,
}: Readonly<{
	isFailed: boolean;
	renderAgentActivityIndicator?: JiraIssueAgentActivityIndicatorRenderer;
}>): ReactElement {
	if (isFailed) {
		return (
			<JiraIssueAgentStatusIconTile
				className="text-icon-danger"
				icon={<StatusErrorIcon color="currentColor" label="" size="small" />}
			/>
		);
	}

	if (renderAgentActivityIndicator) {
		return (
			<span aria-hidden="true" className="grid size-6 shrink-0 place-items-center text-icon">
				{renderAgentActivityIndicator("finished")}
			</span>
		);
	}

	return (
		<JiraIssueAgentStatusIconTile
			className="text-icon-success"
			icon={<StatusSuccessIcon color="currentColor" label="" size="small" />}
		/>
	);
}

function JiraIssueActiveAgentStatusIcon({
	iconScale,
	isAwaitingInput,
	renderAgentActivityIndicator,
}: Readonly<{
	iconScale: JiraIssueIconScale;
	isAwaitingInput: boolean;
	renderAgentActivityIndicator?: JiraIssueAgentActivityIndicatorRenderer;
}>): ReactElement {
	if (renderAgentActivityIndicator) {
		return (
			<span aria-hidden="true" className="grid size-6 shrink-0 place-items-center text-icon">
				{renderAgentActivityIndicator(isAwaitingInput ? "awaiting-input" : "working")}
			</span>
		);
	}

	if (isAwaitingInput) {
		return (
			<JiraIssueAgentStatusIconTile
				className="text-icon-information"
				icon={<QuestionCircleFilledIcon color="currentColor" label="" size="small" />}
			/>
		);
	}

	return (
		<span
			aria-hidden="true"
			className="grid size-6 shrink-0 place-items-center text-icon"
		>
			{iconScale === "comfortable" ? (
				<Spinner label="" pulse size="xl" variant="experimental" />
			) : (
				<Spinner label="" />
			)}
		</span>
	);
}

export function JiraIssueAgentStatusIcon({
	iconScale,
	isAwaitingInput,
	isCompletedRow,
	isFailedRow,
	renderAgentActivityIndicator,
	startupPhase,
}: Readonly<{
	iconScale: JiraIssueIconScale;
	isAwaitingInput: boolean;
	isCompletedRow: boolean;
	isFailedRow: boolean;
	renderAgentActivityIndicator?: JiraIssueAgentActivityIndicatorRenderer;
	startupPhase: ReturnType<typeof useJiraIssueAgentStartupPhase>;
}>): ReactElement {
	if (isCompletedRow) {
		return (
			<JiraIssueCompletedAgentStatusIcon
				isFailed={isFailedRow}
				renderAgentActivityIndicator={renderAgentActivityIndicator}
			/>
		);
	}

	if (!isAwaitingInput && startupPhase === "intro") {
		return <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center" />;
	}

	if (!isAwaitingInput && startupPhase === "gathering-context") {
		return (
			<span aria-hidden="true" className="grid size-6 shrink-0 place-items-center">
				<TWGLoader label="" size="small" />
			</span>
		);
	}

	return (
		<JiraIssueActiveAgentStatusIcon
			iconScale={iconScale}
			isAwaitingInput={isAwaitingInput}
			renderAgentActivityIndicator={renderAgentActivityIndicator}
		/>
	);
}

function JiraIssueAgentRowLabel({
	isAwaitingInput,
	isWorking,
	rowLabel,
	startupPhase,
}: Readonly<{
	isAwaitingInput: boolean;
	isWorking: boolean;
	rowLabel: string;
	startupPhase: ReturnType<typeof useJiraIssueAgentStartupPhase>;
}>): ReactElement {
	if (isAwaitingInput) {
		return (
			<span className="flex min-w-0 flex-1 items-baseline overflow-hidden text-sm leading-5 text-text">
				<span className="block min-w-0 truncate text-sm leading-5">{rowLabel}</span>
				<AnimatedDots />
			</span>
		);
	}

	if (startupPhase === "intro") {
		return <JiraIssueAgentIntroLabel />;
	}

	if (startupPhase === "gathering-context") {
		return (
			<JiraIssueShimmeringAgentLabel
				label="Gathering context"
			/>
		);
	}

	if (isWorking) {
		return (
			<Shimmer
				as="span"
				className="block min-w-0 flex-1 truncate text-sm leading-5 text-text"
				duration={1.4}
				spread={2}
			>
				{rowLabel}
			</Shimmer>
		);
	}

	return (
		<span className="block min-w-0 flex-1 truncate text-sm leading-5 text-text">
			{rowLabel}
		</span>
	);
}

export function JiraIssueAgentRowContent({
	activities,
	avatarLayout,
	featuredActivity,
	isAwaitingInput,
	isWorking,
	rowLabel,
	showUnlinkControl,
	startupPhase,
	statusIcon,
}: Readonly<{
	activities: readonly JiraIssueAgentActivity[];
	avatarLayout: JiraIssueAgentActivityAvatarLayout;
	featuredActivity: JiraIssueAgentActivity | undefined;
	isAwaitingInput: boolean;
	isWorking: boolean;
	rowLabel: string;
	showUnlinkControl: boolean;
	startupPhase: ReturnType<typeof useJiraIssueAgentStartupPhase>;
	statusIcon: ReactElement;
}>): ReactElement {
	let avatar: ReactElement;
	if (featuredActivity !== undefined) {
		avatar = (
			<span className="grid size-6 shrink-0 place-items-center">
				<AgentAvatarVisual
					animate={false}
					avatarClassName="shrink-0"
					avatarSrc={featuredActivity.avatarSrc}
					brandName={featuredActivity.agentBrandName}
					fallbackText={getAgentInitial(featuredActivity.name)}
					label={featuredActivity.name}
					sizePx={24}
				/>
			</span>
		);
	} else if (avatarLayout === "horizontal-group") {
		avatar = (
			<AvatarGroup
				className="shrink-0 gap-1 space-x-0"
				label={`${activities.length} agents: ${rowLabel}`}
				size="sm"
			>
				{activities.map((activity) => (
					<AgentAvatarVisual
						animate={false}
						avatarSrc={activity.avatarSrc}
						brandName={activity.agentBrandName}
						fallbackText={getAgentInitial(activity.name)}
						key={activity.id}
						label=""
						sizePx={24}
					/>
				))}
			</AvatarGroup>
		);
	} else {
		avatar = (
			<span className="grid size-6 shrink-0 place-items-center">
				<AgentLoading
					agents={activities.map(toAgentLoadingAgent)}
					announce={false}
					className="shrink-0"
				/>
			</span>
		);
	}

	return (
		<>
			<div className="flex min-w-0 flex-1 items-center gap-2">
				{avatar}
				<JiraIssueAgentRowLabel
					isAwaitingInput={isAwaitingInput}
					isWorking={isWorking}
					rowLabel={rowLabel}
					startupPhase={startupPhase}
				/>
			</div>
			{showUnlinkControl ? null : statusIcon}
		</>
	);
}

export function JiraIssueAgentAssignmentHandle({
	activities,
	agents,
	assignedAgents,
	assignment,
	onOpenChange,
	onViewChat,
	rowHandle,
	showAssignmentFlyout,
}: Readonly<{
	activities: readonly JiraIssueAgentActivity[];
	agents: readonly AgentSelectorAgent[];
	assignedAgents: readonly AgentAssignmentAgent[];
	assignment?: JiraIssueAgentAssignment;
	onOpenChange?: (open: boolean) => void;
	onViewChat?: (activity: JiraIssueAgentActivity) => void;
	rowHandle: ReactElement<{ "aria-expanded"?: boolean }>;
	showAssignmentFlyout: boolean;
}>): ReactElement {
	// Session lifecycle changes the row's status, never access to its flyout.
	if (!showAssignmentFlyout) {
		return rowHandle;
	}

	return (
		<div className="flex h-full min-w-0 flex-1 items-center">
			<AgentAssignment
				addAgentLabel={assignment?.addAgentLabel}
				agents={agents}
				assignedAgents={assignedAgents}
				defaultPinnedAgentIds={assignment?.defaultPinnedAgentIds}
				onAgentAssign={assignment?.onAgentAssign}
				onAssignedAgentIdsChange={assignment?.onAssignedAgentIdsChange}
				onAssignedAgentSelect={(agent) => {
					const activity = activities.find((candidate) => (
						candidate.id === agent.id || candidate.id.endsWith(`:${agent.id}`)
					));
					if (activity) {
						onViewChat?.(activity);
					}
				}}
				onBrowseAgents={assignment?.onBrowseAgents}
				onContinueExistingSession={assignment?.onContinueExistingSession}
				onCreateAgent={assignment?.onCreateAgent}
				onRenameAssignedAgent={assignment?.onRenameAssignedAgent}
				onOpenChange={onOpenChange}
				onStartNewSession={assignment?.onStartNewSession}
				openMode="hover"
				pinnedItemsLabel={assignment?.pinnedItemsLabel}
				positionerClassName="z-[575]"
				trigger={rowHandle}
				usedAgentIds={assignment?.usedAgentIds}
			/>
		</div>
	);
}

export function JiraIssueAgentRowSurface({
	activities,
	assignedRowHandle,
	featuredActivity,
	flushContent,
	iconScale,
	inheritChinSurface,
	isDraggedOut,
	rowLinkFlash,
	sessionDrag,
	showUnlinkControl,
	startupPhase,
	startupSequenceKey,
	statusIcon,
}: Readonly<{
	activities: readonly JiraIssueAgentActivity[];
	assignedRowHandle: ReactElement;
	featuredActivity: JiraIssueAgentActivity | undefined;
	flushContent?: boolean;
	iconScale: JiraIssueIconScale;
	inheritChinSurface: boolean;
	isDraggedOut: boolean;
	rowLinkFlash: JiraIssueAgentLinkFlash | null;
	sessionDrag?: JiraIssueAgentSessionDragBinding;
	showUnlinkControl: boolean;
	startupPhase: ReturnType<typeof useJiraIssueAgentStartupPhase>;
	startupSequenceKey: string | null;
	statusIcon: ReactElement;
}>): ReactElement {
	return (
		<div
			className={cn(
				"group/agent-chin-row relative flex min-w-0 items-center",
				isDraggedOut
					? "h-auto w-fit max-w-full justify-start bg-transparent p-0"
					: cn(
						"h-8 w-full justify-between rounded-md py-1 hover:bg-bg-neutral-subtle-hovered has-[[aria-expanded=true]]:bg-bg-neutral-subtle-hovered active:bg-bg-neutral-subtle-pressed",
						flushContent ? "px-0" : iconScale === "comfortable" ? "pr-2 pl-1" : "px-2",
						inheritChinSurface ? "bg-transparent" : "bg-bg-neutral",
					),
			)}
			data-agent-startup-phase={startupSequenceKey ? startupPhase : undefined}
			data-session-chin=""
			data-slot="jira-issue-agent-row"
		>
			{rowLinkFlash ? <JiraIssueAgentLinkFlashOverlay flash={rowLinkFlash} /> : null}
			{assignedRowHandle}
			{showUnlinkControl ? (
				<div className="flex shrink-0 items-center gap-0">
					<JiraIssueAgentSessionUnlinkButton
						onUnlink={() => sessionDrag?.onUnlink?.({
							id: featuredActivity?.id ?? activities[0]?.id ?? "",
							name: featuredActivity?.name ?? activities[0]?.name ?? "Agent",
						})}
					/>
					<span
						className="flex size-6 shrink-0 items-center justify-center -mr-1"
						data-slot="jira-issue-assignee-slot"
					>
						{statusIcon}
					</span>
				</div>
			) : null}
		</div>
	);
}
