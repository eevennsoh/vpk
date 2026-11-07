"use client";

import { useCallback, useId, useRef, type ReactElement } from "react";
import { useReducedMotion } from "motion/react";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import StrokeWeightLargeIcon from "@atlaskit/icon/core/stroke-weight-large";
import StatusErrorIcon from "@atlaskit/icon/core/status-error";
import StatusSuccessIcon from "@atlaskit/icon/core/status-success";

import {
	AgentAssignment,
	type AgentAssignmentAgent,
	type AgentAssignmentProps,
} from "@/components/blocks/agent-assignment";
import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";
import type { AgentSessionItem } from "@/components/blocks/agent-session";
import type { JiraIssueAgentSessionDragBinding } from "@/components/blocks/jira-issue/agent-session-drag";
import { JiraIssueAgentLinkFlashOverlay, type JiraIssueAgentLinkFlash } from "@/components/blocks/jira-issue/agent-link-flash";
import { useProjectButterInvocationActions, useProjectButterInvocationEnabled, useProjectButterInvocationPhase, useProjectButterInvocationPreview, useProjectButterInvocationSource } from "@/components/blocks/jira-issue/project-butter-invocation";
import { matchesInvocationAgent } from "@/components/blocks/jira-issue/project-butter-invocation-model";
import { ProjectButterMenuAgentPicker } from "@/components/blocks/jira-issue/project-butter-add-agent";
import { JiraIssueAgentHandoffLabel } from "@/components/blocks/jira-issue/project-butter-invocation-chin";
import { JiraIssueAgentSessionUnlinkButton } from "@/components/blocks/jira-issue/agent-session-unlink-button";
import type { JiraIssueIconScale } from "@/components/blocks/jira-issue/types";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { AgentLoading, type AgentLoadingAgent } from "@/components/ui-custom/agent-loading";
import { AnimatedDots } from "@/components/ui-custom/animated-dots";
import { Shimmer } from "@/components/ui-custom/shimmer";
import { AvatarGroup } from "@/components/ui/avatar";
import { IconTile } from "@/components/ui/icon-tile";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

import type {
	JiraIssueAgentActivity,
	JiraIssueAgentActivityAvatarLayout,
	JiraIssueAgentActivityIndicatorRenderer,
} from "./agent-activity";
import { getJiraIssueAgentAvatarSize, getJiraIssueAgentRowInset } from "./agent-activity-avatar";

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
		| "onDeleteAssignedAgent"
		| "onRenameAssignedAgent"
		| "onStartNewSession"
		| "pinnedItemsLabel"
		| "showSessionAddAgent"
		| "usedAgentIds"
	>
> & {
	sessions?: readonly (AgentSessionItem & { prompt?: string; invokedAtMs?: number })[];
	onOpenSession?: (session: AgentSessionItem) => void;
	onCreateCloudSession?: (agent: AgentSelectorAgent) => void;
};

function getAgentInitial(name: string): string {
	return name.trim()[0]?.toUpperCase() ?? "A";
}

function toAgentLoadingAgent(activity: JiraIssueAgentActivity): AgentLoadingAgent {
	return {
		id: activity.id,
		name: activity.name,
		status: activity.state === "completed" ? "finished" : "working",
		avatar: {
			appearance: "coding",
			...(activity.avatarSrc ? { avatarSrc: activity.avatarSrc } : {}),
			...(activity.agentBrandName ? { brandName: activity.agentBrandName } : {}),
			...(activity.agentVpkLogo ? { vpkLogo: activity.agentVpkLogo } : {}),
			fallbackText: getAgentInitial(activity.name),
		},
	};
}

/** Match the session column's 12px glyph while retaining the 24px status slot. */
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
			iconSize="small"
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
	workingSpinnerVariant,
}: Readonly<{
	iconScale: JiraIssueIconScale;
	isAwaitingInput: boolean;
	renderAgentActivityIndicator?: JiraIssueAgentActivityIndicatorRenderer;
	workingSpinnerVariant?: "default" | "bloom-avatar";
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
				icon={<StrokeWeightLargeIcon color="currentColor" label="" size="small" />}
			/>
		);
	}

	const spinnerVariant = workingSpinnerVariant ?? (iconScale === "comfortable" ? "bloom-avatar" : "default");

	return (
		<span
			aria-hidden="true"
			className="grid size-6 shrink-0 place-items-center text-icon"
		>
			{spinnerVariant === "bloom-avatar" ? (
				<Spinner className="size-[16.75px]" label="" pulse size="xl" variant="bloom-avatar" />
			) : (
				<Spinner label="" size="xs" />
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
	workingSpinnerVariant,
}: Readonly<{
	iconScale: JiraIssueIconScale;
	isAwaitingInput: boolean;
	isCompletedRow: boolean;
	isFailedRow: boolean;
	renderAgentActivityIndicator?: JiraIssueAgentActivityIndicatorRenderer;
	workingSpinnerVariant?: "default" | "bloom-avatar";
}>): ReactElement {
	if (isCompletedRow) {
		return (
			<JiraIssueCompletedAgentStatusIcon
				isFailed={isFailedRow}
				renderAgentActivityIndicator={renderAgentActivityIndicator}
			/>
		);
	}

	return (
		<JiraIssueActiveAgentStatusIcon
			iconScale={iconScale}
			isAwaitingInput={isAwaitingInput}
			renderAgentActivityIndicator={renderAgentActivityIndicator}
			workingSpinnerVariant={workingSpinnerVariant}
		/>
	);
}

export function JiraIssueAgentStatusAffordance({
	interactive,
	statusIcon,
}: Readonly<{
	interactive: boolean;
	statusIcon?: ReactElement;
}>): ReactElement | null {
	if (!interactive) return statusIcon ?? null;

	return (
		<span aria-hidden="true" className="grid size-6 shrink-0 place-items-center" data-slot="jira-issue-agent-status-affordance">
			<span className="col-start-1 row-start-1 grid size-6 place-items-center group-hover/agent-chin-row:invisible group-has-[:focus-visible]/agent-chin-row:invisible" data-slot="jira-issue-agent-status-icon">
				{statusIcon}
			</span>
			<span className="invisible col-start-1 row-start-1 grid size-6 place-items-center text-icon-subtle group-hover/agent-chin-row:visible group-has-[:focus-visible]/agent-chin-row:visible" data-slot="jira-issue-agent-chevron">
				<ChevronRightIcon color="currentColor" label="" size="small" />
			</span>
		</span>
	);
}

function JiraIssueAgentRowLabel({
	isAwaitingInput,
	isWorking,
	rowLabel,
}: Readonly<{
	isAwaitingInput: boolean;
	isWorking: boolean;
	rowLabel: string;
}>): ReactElement {
	if (isAwaitingInput) {
		return (
			<span className="flex min-w-0 flex-1 items-baseline overflow-hidden text-sm leading-5 text-text">
				<span className="block min-w-0 truncate text-sm leading-5">{rowLabel}</span>
				<AnimatedDots />
			</span>
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
	activities: incomingActivities,
	avatarLayout,
	featuredActivity,
	isAwaitingInput,
	isWorking,
	rowLabel,
	showUnlinkControl,
	isViewerRow = false,
	statusIcon,
	compactAvatarSlot = false,
}: Readonly<{
	activities: readonly JiraIssueAgentActivity[];
	avatarLayout: JiraIssueAgentActivityAvatarLayout;
	featuredActivity: JiraIssueAgentActivity | undefined;
	isAwaitingInput: boolean;
	isWorking: boolean;
	rowLabel: string;
	showUnlinkControl: boolean;
	isViewerRow?: boolean;
	statusIcon: ReactElement;
	compactAvatarSlot?: boolean;
}>): ReactElement {
	const phase = useProjectButterInvocationPhase();
	const preview = useProjectButterInvocationPreview();
	const reduce = useReducedMotion();
	const selectedAgent = phase === "handoff" || phase === "attached" ? preview.agent : null;
	const selectedActivity = selectedAgent ? incomingActivities.find((activity) => matchesInvocationAgent(activity, selectedAgent)) : undefined;
	const activities = selectedActivity ? [selectedActivity, ...incomingActivities.filter((activity) => activity !== selectedActivity)] : incomingActivities;
	const puzzleHandoff = phase === "handoff" && selectedActivity !== undefined && activities.length > 1 && avatarLayout === "animated";
	let avatar: ReactElement;
	if (featuredActivity !== undefined) {
		avatar = (
			<span className={cn("flex h-6 shrink-0 items-center justify-center", compactAvatarSlot ? "w-4" : "w-6")}>
				<AgentAvatarVisual
					appearance="coding"
					animate={false}
					avatarClassName="shrink-0"
					avatarSrc={featuredActivity.avatarSrc}
					brandName={featuredActivity.agentBrandName}
					vpkLogo={featuredActivity.agentVpkLogo}
					fallbackText={getAgentInitial(featuredActivity.name)}
					label={featuredActivity.name}
					sizePx={getJiraIssueAgentAvatarSize(featuredActivity.agentBrandName, featuredActivity.avatarSrc)}
				/>
			</span>
		);
	} else if (avatarLayout === "horizontal-group") {
		avatar = (
			<AvatarGroup
				className={cn("shrink-0", isViewerRow ? null : "gap-1 space-x-0")}
				label={`${activities.length} agents: ${rowLabel}`}
				size="sm"
			>
				{activities.map((activity) => (
					<AgentAvatarVisual
						appearance="coding"
						animate={false}
						avatarSrc={activity.avatarSrc}
						brandName={activity.agentBrandName}
						vpkLogo={activity.agentVpkLogo}
						fallbackText={getAgentInitial(activity.name)}
						key={activity.id}
						label=""
						sizePx={getJiraIssueAgentAvatarSize(activity.agentBrandName, activity.avatarSrc)}
					/>
				))}
			</AvatarGroup>
		);
	} else {
		avatar = (
			<span className={cn("flex h-6 shrink-0 items-center justify-center", compactAvatarSlot ? "w-4" : "w-6")}>
				<AgentLoading
					agents={activities.map(toAgentLoadingAgent)}
					announce={false}
					className="shrink-0"
					intro={puzzleHandoff && !reduce && selectedActivity ? { agentId: selectedActivity.id, avatarSize: getJiraIssueAgentAvatarSize(selectedActivity.agentBrandName, selectedActivity.avatarSrc) } : undefined}
					key={selectedAgent?.id ?? "default"}
				/>
			</span>
		);
	}

	return (
		<>
			<div className="flex min-w-0 flex-1 items-center gap-2">
				<span
					className={cn("flex shrink-0", phase === "handoff" && !puzzleHandoff && !reduce ? "opacity-0" : null)}
					data-slot="jira-issue-agent-avatar-handoff"
					key={selectedAgent?.id ?? "default"}
				>
					{avatar}
				</span>
				{phase === "handoff" && selectedAgent && isWorking && !reduce ? <JiraIssueAgentHandoffLabel name={selectedAgent.name}><JiraIssueAgentRowLabel
					isAwaitingInput={isAwaitingInput}
					isWorking={isWorking}
					rowLabel={rowLabel}
				/></JiraIssueAgentHandoffLabel> : <JiraIssueAgentRowLabel isAwaitingInput={isAwaitingInput} isWorking={isWorking} rowLabel={rowLabel} />}
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
	const assignmentHandleRef = useRef<HTMLDivElement>(null);
	const pickerId = useId();
	const invocation = useProjectButterInvocationActions();
	const invocationEnabled = useProjectButterInvocationEnabled();
	const phase = useProjectButterInvocationPhase();
	const source = useProjectButterInvocationSource();
	const pickerOpen = phase === "choosing" && source === "session";
	const resolveAssignmentAnchor = useCallback(() => (
		assignmentHandleRef.current?.closest<HTMLElement>('[data-slot="jira-issue-agent-row"]')
			?? assignmentHandleRef.current
	), []);

	// Session lifecycle changes the row's status, never access to its flyout.
	if (!showAssignmentFlyout) {
		return rowHandle;
	}

	return (
		<div aria-controls={invocationEnabled && assignment?.onAssignedAgentIdsChange && pickerOpen ? pickerId : undefined} className="flex h-full min-w-0 flex-1 items-center" ref={assignmentHandleRef}>
			<AgentAssignment
				addAgentLabel={assignment?.addAgentLabel ?? (activities.every((activity) => activity.role === "viewer") ? "New session" : undefined)}
				showSessionAddAgent={assignment?.showSessionAddAgent}
				agents={agents}
				assignedAgents={assignedAgents}
				defaultPinnedAgentIds={assignment?.defaultPinnedAgentIds}
				dismissWhenAnchorHidden
				hoverAnchor={resolveAssignmentAnchor}
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
				onDeleteAssignedAgent={assignment?.onDeleteAssignedAgent}
				onRenameAssignedAgent={assignment?.onRenameAssignedAgent}
				onOpenChange={onOpenChange}
				onRequestAddAgent={invocationEnabled && invocation && assignment?.onAssignedAgentIdsChange ? () => invocation.open("session") : undefined}
				onStartNewSession={assignment?.onStartNewSession}
				openMode="click"
				pinnedItemsLabel={assignment?.pinnedItemsLabel}
				positionerClassName="z-[575]"
				side="right"
				trigger={rowHandle}
				usedAgentIds={assignment?.usedAgentIds}
			/>
			{invocationEnabled && assignment?.onAssignedAgentIdsChange && assignment.showSessionAddAgent !== false ? <ProjectButterMenuAgentPicker assignment={assignment} id={pickerId} source="session" triggerRef={assignmentHandleRef} /> : null}
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
						// Outline paints on the full surface without shrinking its content box.
						"outline-1 outline-transparent has-[[data-jira-issue-agent-row-handle]:focus-visible]:outline-ring has-[[data-jira-issue-agent-row-handle]:focus-visible]:ring-3 has-[[data-jira-issue-agent-row-handle]:focus-visible]:ring-ring/50 transition-shadow duration-fast ease-out-practical motion-reduce:transition-none",
						flushContent ? "px-0" : getJiraIssueAgentRowInset(iconScale),
						inheritChinSurface ? "bg-transparent" : "bg-bg-neutral",
					),
			)}
			data-agent-startup-phase={startupSequenceKey ? "working" : undefined}
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
