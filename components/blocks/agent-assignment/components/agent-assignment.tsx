"use client";

import { cloneElement, useRef, useState, type ComponentProps, type ReactElement, type ReactNode } from "react";

import type { AgentListHost, AgentListInvoker } from "@/components/blocks/agent-list/agent-list-types";
import type { AgentSessionRole } from "@/components/blocks/agent-session/agent-session-types";
import {
	AgentSelector,
	type AgentSelectorAgent,
} from "@/components/blocks/agent-selector";
import {
	AgentSessionTargetMenu,
	type AgentSessionTargetChoice,
} from "@/components/blocks/agent-assignment/components/agent-session-target-menu";
import { AgentAssignmentDefaultField } from "@/components/blocks/agent-assignment/components/agent-assignment-default-field";
import { AssignedAgentsMenu } from "@/components/blocks/agent-assignment/components/assigned-agents-menu";
import { AssignedAgentsSessionMenu } from "@/components/blocks/agent-assignment/components/assigned-agents-session-menu";
import type { AgentAssignmentVariant } from "@/components/blocks/agent-assignment/components/assignment-session";
import type { JiraIssueIconScale } from "@/components/blocks/jira-issue/types";
import { AssignmentAvatar } from "@/components/blocks/agent-assignment/components/assignment-avatar";
import {
	resolveAssignedAgentStatusKind,
	type AgentAssignmentStatusKind,
} from "@/components/blocks/agent-assignment/components/assigned-agent-status";
import {
	isAssignedAgentAttentionKind,
	useAssignedAgentAttention,
} from "@/components/blocks/agent-assignment/components/use-assigned-agent-attention";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { TooltipProvider } from "@/components/ui/tooltip";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

export type { AgentAssignmentStatusKind } from "@/components/blocks/agent-assignment/components/assigned-agent-status";

export interface AgentAssignmentAgent extends AgentSelectorAgent {
	status?: ReactNode;
	/** Minimum time a status remains visible before advancing. */
	statusCycleIntervalMs?: number;
	/** Random time added independently to every status step. */
	statusCycleJitterMs?: number;
	/**
	 * Rest-state trailing treatment. When omitted, a cycling `statusSequence`
	 * defaults to working so existing adapters keep a spinner; otherwise idle.
	 */
	statusKind?: AgentAssignmentStatusKind;
	statusLabel: string;
	/** Human who invoked this assigned session, shown for owner rows in the Default presenters. */
	invokedBy?: AgentListInvoker;
	/** Where the assigned session runs. Defaults to cloud in the session mapper. */
	host?: AgentListHost;
	/**
	 * Owner sees the session more-menu; viewer sees the information hint.
	 * Omit to keep the owner menu.
	 */
	role?: AgentSessionRole;
	/** Agent-specific tool-call narration. Avoid sharing one sequence across agents. */
	statusSequence?: readonly string[];
	/**
	 * Stable elapsed stamp for the Default picker row. Omit only for a session
	 * that just started; demo placeholders must set this so the clock is not 0s.
	 */
	timeLabel?: string;
}

export interface AgentAssignmentProps {
	agents: readonly AgentSelectorAgent[];
	assignedAgents: readonly AgentAssignmentAgent[];
	/** Whether assigned rows expose Archive. Disable when the owning state model
	 * cannot remove a session-backed assignment without immediately restoring it. */
	allowArchive?: boolean;
	/** Comfortable scale uses the experimental working spinner; compact keeps the shared default. */
	activityIconScale?: JiraIssueIconScale;
	/** Copy for the empty field and the action in the assigned-agents menu. */
	addAgentLabel?: string;
	/** Let attached activity identities begin at the empty Assign agent label's edge. */
	activityRowFlush?: boolean;
	/** Override the flyout's anchor when its trigger is inset within a row. */
	hoverAnchor?: ComponentProps<typeof HoverCardContent>["anchor"];
	className?: string;
	defaultPinnedAgentIds?: readonly string[];
	maxVisibleAgents?: number;
	onAgentAssign?: (agent: AgentSelectorAgent) => void;
	/** Enables assignment and archive controls. Omit for a display-only session list. */
	onAssignedAgentIdsChange?: (agentIds: readonly string[]) => void;
	onAssignedAgentSelect: (agent: AgentAssignmentAgent) => void;
	onBrowseAgents?: () => void;
	onContinueExistingSession?: (agent: AgentSelectorAgent) => void;
	/** Rename a cloud assigned session from the Default picker more-menu. */
	onRenameAssignedAgent?: (agent: AgentAssignmentAgent) => void;
	onCreateAgent?: () => void;
	onOpenChange?: (open: boolean) => void;
	onStartNewSession?: (agent: AgentSelectorAgent) => void;
	openMode?: "click" | "hover";
	moreItemsLabel?: string;
	pinnedItemsLabel?: string;
	positionerClassName?: string;
	side?: "top" | "right" | "bottom" | "left";
	trigger?: ReactElement<{ "aria-expanded"?: boolean }>;
	triggerLabel?: string;
	/**
	 * Agents that already have a session the user can continue. Selecting one
	 * from the directory opens Continue / Start new instead of toggling assign.
	 */
	usedAgentIds?: readonly string[];
	/**
	 * `default` is the attached activity-row field plus long session-card picker.
	 * `simple` keeps the facepile trigger and suggestion-menu rows.
	 */
	variant?: AgentAssignmentVariant;
}

function runAssignedSessionAction(
	agents: readonly AgentAssignmentAgent[],
	itemId: string,
	action: ((agent: AgentAssignmentAgent) => void) | undefined,
) {
	if (action === undefined) {
		return;
	}
	const agent = agents.find((candidate) => candidate.id === itemId);
	if (agent !== undefined) {
		action(agent);
	}
}

export function AgentAssignment({
	agents,
	assignedAgents,
	allowArchive = true,
	activityIconScale,
	addAgentLabel = "Assign agent",
	activityRowFlush,
	hoverAnchor,
	className,
	defaultPinnedAgentIds = [],
	maxVisibleAgents = 4,
	onAgentAssign,
	onAssignedAgentIdsChange,
	onAssignedAgentSelect,
	onBrowseAgents,
	onContinueExistingSession,
	onRenameAssignedAgent,
	onCreateAgent,
	onOpenChange,
	onStartNewSession,
	openMode = "click",
	moreItemsLabel = "More agents",
	pinnedItemsLabel = "Pinned by space",
	positionerClassName = "z-[502]",
	side,
	trigger,
	triggerLabel = "Edit agents",
	usedAgentIds = [],
	variant = "default",
}: Readonly<AgentAssignmentProps>) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [view, setView] = useState<"assigned" | "selector" | "session">("assigned");
	const [pendingSessionAgent, setPendingSessionAgent] = useState<AgentSelectorAgent | null>(null);
	const [pinnedAgentIds, setPinnedAgentIds] = useState<readonly string[]>(defaultPinnedAgentIds);
	const hoverPopupRef = useRef<HTMLDivElement>(null);
	const menuRootRef = useRef<HTMLDivElement>(null);
	const moreMenuOpenRef = useRef(false);
	const retainPopoverOpenRef = useRef(false);
	const assignedAgentIds = assignedAgents.map((agent) => agent.id);
	const showSessionView = view === "session" && pendingSessionAgent !== null;
	const effectiveView = showSessionView
		? "session"
		: assignedAgents.length === 0 || view === "session"
			? "selector"
			: view;
	const shown = assignedAgents.slice(0, maxVisibleAgents);
	const attentionAgents = assignedAgents.map((agent) => ({
		id: agent.id,
		statusKind: resolveAssignedAgentStatusKind(agent),
	}));
	const {
		acknowledgeAttention,
		isAttentionAcknowledged,
	} = useAssignedAgentAttention(attentionAgents);
	const overlayPositionerClassName = openMode === "hover"
		? cn(
			positionerClassName,
			"after:pointer-events-auto after:absolute after:-inset-2 after:-z-10 after:content-['']",
		)
		: positionerClassName;
	const resolvedTrigger = trigger
		? cloneElement(trigger, { "aria-expanded": open })
		: undefined;

	const handleOpenChange = (
		nextOpen: boolean,
		eventDetails?: {
			cancel?: () => void;
			preventUnmountOnClose?: () => void;
			reason?: string;
		},
	) => {
		// Once a hover preview becomes an interactive selector or session menu, a
		// popup resize can leave the pointer outside its new bounds. Keep that view
		// open for keyboard/pointer interaction; Escape and outside presses still
		// flow through the ordinary close path.
		if (
			!nextOpen
			&& openMode === "hover"
			&& view !== "assigned"
			&& eventDetails?.reason === "trigger-hover"
		) {
			eventDetails.cancel?.();
			return;
		}
		// The owner more-menu portals to the document. Focusing it looks like
		// leaving the picker, which would close the list before Rename / Continue
		// in can be used. Escape still closes.
		if (
			!nextOpen
			&& variant === "default"
			&& view === "assigned"
			&& eventDetails?.reason === "focus-out"
		) {
			eventDetails.cancel?.();
			return;
		}
		// Hovering or pressing that portalled menu looks like leaving the hover
		// card or clicking outside the picker. Keep the assignment surface mounted
		// until the more-menu itself closes.
		if (
			!nextOpen
			&& moreMenuOpenRef.current
			&& (
				eventDetails?.reason === "outside-press"
				|| eventDetails?.reason === "trigger-hover"
			)
		) {
			eventDetails.cancel?.();
			return;
		}
		// Replacing the selector with the session menu unmounts the focused search
		// field. Base UI treats that blur as focus-out and would close the popover
		// before the session options can paint.
		if (
			!nextOpen
			&& retainPopoverOpenRef.current
			&& eventDetails?.reason === "focus-out"
		) {
			retainPopoverOpenRef.current = false;
			eventDetails.preventUnmountOnClose?.();
			return;
		}
		retainPopoverOpenRef.current = false;
		if (!nextOpen) {
			moreMenuOpenRef.current = false;
		}
		setOpen(nextOpen);
		onOpenChange?.(nextOpen);
		if (!nextOpen) {
			setQuery("");
			setPendingSessionAgent(null);
			setView("assigned");
		}
	};

	const handleFooterAction = (action?: () => void) => {
		handleOpenChange(false);
		action?.();
	};

	const handleShowSelector = () => {
		// The assigned list owns focus until its button is activated. Move focus to
		// the stable menu root before replacing that list so hover-open previews do
		// not interpret the unmounted button as leaving the popup.
		retainPopoverOpenRef.current = true;
		menuRootRef.current?.focus();
		setView("selector");
		queueMicrotask(() => {
			retainPopoverOpenRef.current = false;
		});
	};

	const ensureAssigned = (agent: AgentSelectorAgent) => {
		if (!assignedAgentIds.includes(agent.id)) {
			onAssignedAgentIdsChange?.([...assignedAgentIds, agent.id]);
		}
	};

	const handleSessionChoice = (
		agent: AgentSelectorAgent,
		choice: AgentSessionTargetChoice,
	) => {
		ensureAssigned(agent);
		handleOpenChange(false);
		switch (choice) {
			case "continue":
				if (onContinueExistingSession) {
					onContinueExistingSession(agent);
					return;
				}
				onAssignedAgentSelect(
					assignedAgents.find((candidate) => candidate.id === agent.id)
						?? { ...agent, statusLabel: "Assigned" },
				);
				return;
			case "new":
				if (onStartNewSession) {
					onStartNewSession(agent);
					return;
				}
				onAgentAssign?.(agent);
				return;
			default: {
				const _exhaustive: never = choice;
				return _exhaustive;
			}
		}
	};

	const handleAgentToggle = (agentId: string) => {
		if (!onAssignedAgentIdsChange) {
			return;
		}
		const agent = agents.find((candidate) => candidate.id === agentId);
		if (!agent) {
			return;
		}
		if (usedAgentIds.includes(agentId)) {
			retainPopoverOpenRef.current = true;
			menuRootRef.current?.focus();
			setPendingSessionAgent(agent);
			setView("session");
			queueMicrotask(() => {
				retainPopoverOpenRef.current = false;
			});
			return;
		}
		const isAssigned = assignedAgentIds.includes(agentId);
		if (!isAssigned) {
			onAgentAssign?.(agent);
		}
		const nextAssignedAgentIds = isAssigned
			? assignedAgentIds.filter((id) => id !== agentId)
			: [...assignedAgentIds, agentId];
		onAssignedAgentIdsChange(nextAssignedAgentIds);
		handleOpenChange(false);
	};

	const handleArchiveAgent = (agent: AgentAssignmentAgent) => {
		onAssignedAgentIdsChange?.(assignedAgentIds.filter((agentId) => agentId !== agent.id));
	};

	const handleAssignedAgentSelect = (agent: AgentAssignmentAgent) => {
		acknowledgeAttention(agent.id);
		handleOpenChange(false);
		onAssignedAgentSelect?.(agent);
	};

	const assignedMenu = variant === "simple" ? (
		<AssignedAgentsMenu
			addAgentLabel={addAgentLabel}
			onAddAgent={onAssignedAgentIdsChange ? handleShowSelector : undefined}
			onArchiveAgent={allowArchive && onAssignedAgentIdsChange ? handleArchiveAgent : undefined}
			onSelectAgent={handleAssignedAgentSelect}
			rows={assignedAgents}
		/>
	) : (
		<AssignedAgentsSessionMenu
			addAgentLabel={addAgentLabel}
			onAddAgent={onAssignedAgentIdsChange ? handleShowSelector : undefined}
			onContinueInAgent={onContinueExistingSession
				? (item) => runAssignedSessionAction(assignedAgents, item.id, onContinueExistingSession)
				: undefined}
			onDeleteSession={undefined}
			onMoreMenuOpenChange={(open) => {
				moreMenuOpenRef.current = open;
			}}
			onRenameSession={onRenameAssignedAgent
				? (item) => runAssignedSessionAction(assignedAgents, item.id, onRenameAssignedAgent)
				: undefined}
			onSelectAgent={handleAssignedAgentSelect}
			onToggleVisibility={onAssignedAgentIdsChange
				? (item) => runAssignedSessionAction(assignedAgents, item.id, handleArchiveAgent)
				: undefined}
			rows={assignedAgents}
		/>
	);
	const menu = effectiveView === "assigned" ? assignedMenu : effectiveView === "session" && pendingSessionAgent ? (
		<AgentSessionTargetMenu
			onBack={() => {
				setPendingSessionAgent(null);
				setView("selector");
			}}
			onChoose={(choice) => handleSessionChoice(pendingSessionAgent, choice)}
		/>
	) : (
		<AgentSelector
			agents={agents}
			className="min-w-0 w-full"
			onAgentToggle={handleAgentToggle}
			onBrowseAgents={onBrowseAgents ? () => handleFooterAction(onBrowseAgents) : undefined}
			onCreateAgent={onCreateAgent ? () => handleFooterAction(onCreateAgent) : undefined}
			moreItemsLabel={moreItemsLabel}
			onPinnedAgentIdsChange={setPinnedAgentIds}
			onQueryChange={setQuery}
			pinnedAgentIds={pinnedAgentIds}
			pinnedItemsLabel={pinnedItemsLabel}
			pinningEnabled
			query={query}
			searchVariant="palette"
			selectionMode="single"
			selectedAgentIds={assignedAgentIds}
			showSelectedTickInSingleSelect={false}
			submenuAgentIds={usedAgentIds}
		/>
	);
	const menuSurface = (
		<div
			className={cn(
				"w-full outline-none",
				openMode === "hover" && "overflow-hidden rounded-xl",
			)}
			ref={menuRootRef}
			tabIndex={-1}
		>
			{menu}
		</div>
	);

	if (openMode === "hover") {
		return (
			<TooltipProvider portalContainer={hoverPopupRef}>
				<HoverCard onOpenChange={handleOpenChange} open={open}>
					<HoverCardTrigger
						closeDelay={80}
						delay={120}
						render={resolvedTrigger ?? (
							<button
								aria-expanded={open}
								aria-label={triggerLabel}
								className="rounded-md outline-none"
								type="button"
							/>
						)}
					/>
					<HoverCardContent
						align="start"
						alignOffset={0}
						anchor={hoverAnchor}
						aria-label="Agent assignment"
						role="group"
						className="max-h-none w-[280px] max-w-[280px] gap-0 overflow-visible rounded-xl p-0 shadow-none"
						positionerClassName={overlayPositionerClassName}
						ref={hoverPopupRef}
						side={side ?? "right"}
						sideOffset={8}
						style={{ boxShadow: token("elevation.shadow.overlay") }}
					>
						{menuSurface}
					</HoverCardContent>
				</HoverCard>
			</TooltipProvider>
		);
	}

	return (
		<TooltipProvider>
			<Popover onOpenChange={handleOpenChange} open={open}>
				{resolvedTrigger ? (
					<PopoverTrigger render={resolvedTrigger} />
				) : variant === "default" ? (
					<div className={cn("relative w-full min-w-0 overflow-visible", className)}>
						<PopoverTrigger
							render={
								<button
									aria-label={shown.length === 0 ? addAgentLabel : triggerLabel}
									className="absolute inset-0 z-0 rounded-md outline-none"
									type="button"
								/>
							}
						/>
						<AgentAssignmentDefaultField
							addAgentLabel={addAgentLabel}
							activityIconScale={activityIconScale}
							activityRowFlush={activityRowFlush}
							assignedAgents={assignedAgents}
						/>
					</div>
				) : (
					<div className={cn("relative flex min-h-8 w-full min-w-0 items-center gap-0.5 overflow-visible px-2", className)}>
						<PopoverTrigger
							render={
								<button
									aria-label={shown.length === 0 ? addAgentLabel : triggerLabel}
									className="absolute inset-0 z-0 rounded-md outline-none"
									type="button"
								/>
							}
						/>
						{shown.length === 0 ? (
							<span className="pointer-events-none relative z-10 text-sm text-text-subtlest">
								{addAgentLabel}
							</span>
						) : shown.map((agent, index) => {
							const statusKind = resolveAssignedAgentStatusKind(agent);
							const attentionAcknowledged = isAttentionAcknowledged(agent.id);
							const seeksAttention = isAssignedAgentAttentionKind(statusKind)
								&& !attentionAcknowledged;
							return (
								<AssignmentAvatar
									agent={agent}
									attentionAcknowledged={attentionAcknowledged}
									key={agent.id}
									menuOpen={open}
									onOpen={() => handleOpenChange(true)}
									positionerClassName={positionerClassName}
									stackZIndex={seeksAttention ? 30 - index : 10}
									statusKind={statusKind}
								/>
							);
						})}
					</div>
				)}
				<PopoverContent
					align="start"
					anchor={hoverAnchor}
					aria-label="Agent assignment"
					className="max-h-none w-[280px] max-w-[280px] gap-0 overflow-hidden rounded-xl p-0"
					positionerClassName={positionerClassName}
					side={side}
					sideOffset={8}
					style={{ boxShadow: token("elevation.shadow.overlay") }}
				>
					{menuSurface}
				</PopoverContent>
			</Popover>
		</TooltipProvider>
	);
}
