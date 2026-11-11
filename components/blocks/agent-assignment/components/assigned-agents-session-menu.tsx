"use client";

import { use, useEffect, useRef } from "react";

import {
	type AgentAssignmentAgent,
} from "@/components/blocks/agent-assignment/components/agent-assignment";
import { toAssignmentSessionItem } from "@/components/blocks/agent-assignment/components/assignment-session";
import { TeammateSessionsDisclosure } from "@/components/blocks/agent-assignment/components/teammate-sessions-disclosure";
import { AgentSessionCard } from "@/components/blocks/agent-session/agent-session-card";
import { AgentSessionAvatarPreviewContext } from "@/components/blocks/agent-session/agent-session-avatar-preview";
import type { AgentSessionItem } from "@/components/blocks/agent-session/agent-session-types";

export function AssignedAgentsSessionMenu({
	onContinueInAgent,
	onDeleteSession,
	onMoreMenuOpenChange,
	onRenameSession,
	onSelectAgent,
	onToggleVisibility,
	rows,
}: Readonly<{
	onContinueInAgent?: (item: AgentSessionItem) => void;
	onDeleteSession?: (item: AgentSessionItem) => void;
	onMoreMenuOpenChange?: (open: boolean) => void;
	onRenameSession?: (item: AgentSessionItem) => void;
	onSelectAgent: (agent: AgentAssignmentAgent) => void;
	onToggleVisibility?: (item: AgentSessionItem) => void;
	rows: readonly AgentAssignmentAgent[];
}>) {
	return <AgentSessionsMenu
		items={rows.map(toAssignmentSessionItem)}
		onContinueInAgent={onContinueInAgent}
		onDeleteSession={onDeleteSession}
		onMoreMenuOpenChange={onMoreMenuOpenChange}
		onRenameSession={onRenameSession}
		onSelectSession={(item) => {
			const row = rows.find((candidate) => candidate.id === item.id);
			if (row) onSelectAgent(row);
		}}
		onToggleVisibility={onToggleVisibility}
	/>;
}

export function AgentSessionsMenu({
	items,
	localSessionAction = "continue",
	overlayPositionerClassName = "z-[600]",
	onContinueInAgent,
	onDeleteSession,
	onMoreMenuOpenChange,
	onRenameSession,
	onSelectSession,
	onToggleVisibility,
}: Readonly<{
	items: readonly AgentSessionItem[];
	localSessionAction?: "continue" | "view";
	overlayPositionerClassName?: string;
	onContinueInAgent?: (item: AgentSessionItem) => void;
	onDeleteSession?: (item: AgentSessionItem) => void;
	onMoreMenuOpenChange?: (open: boolean) => void;
	onRenameSession?: (item: AgentSessionItem) => void;
	onSelectSession: (item: AgentSessionItem) => void;
	onToggleVisibility?: (item: AgentSessionItem) => void;
}>) {
	const containerRef = useRef<HTMLDivElement>(null);
	const renderAgentAvatar = use(AgentSessionAvatarPreviewContext);
	const personalItems = items.filter((item) => item.role !== "viewer");
	const teammateItems = items.filter((item) => item.role === "viewer");
	const hasActionableSession = items.some((item) => item.role === undefined || item.role === "owner");

	useEffect(() => {
		const frameId = window.requestAnimationFrame(() => {
			containerRef.current?.focus();
		});
		return () => window.cancelAnimationFrame(frameId);
	}, []);

	const renderSession = (item: AgentSessionItem) => (
		<AgentSessionCard
			key={item.id}
			density="long"
			hoverTone="menu"
			item={item}
			localSessionAction={localSessionAction}
			moreMenuPortalled={true}
			moreMenuPositionerClassName={overlayPositionerClassName}
			tooltipPositionerClassName={overlayPositionerClassName}
			onContinueInAgent={onContinueInAgent}
			onDeleteSession={onDeleteSession}
			onMoreMenuOpenChange={onMoreMenuOpenChange}
			onRenameSession={onRenameSession}
			onToggleVisibility={onToggleVisibility}
			onView={item.host === "local" && localSessionAction === "continue" ? undefined : () => onSelectSession(item)}
			padding="compact"
			renderAgentAvatar={renderAgentAvatar ?? undefined}
			showLifecycleLabel={false}
			trailingAlign="center"
		/>
	);

	return (
		<div className="flex w-full flex-col gap-1 p-1 outline-none" ref={containerRef} tabIndex={-1}>
			{items.length === 0 ? (
				<p className="px-3 py-2 text-sm text-text-subtle">No agents assigned</p>
			) : personalItems.length ? <ul className="flex w-full flex-col gap-0">{personalItems.map(renderSession)}</ul> : null}
			{teammateItems.length ? (
				<div>
					{hasActionableSession ? <hr className="my-1 border-border" /> : null}
					{personalItems.length ? (
						<TeammateSessionsDisclosure items={teammateItems}>
							<ul className="flex w-full flex-col gap-0">{teammateItems.map(renderSession)}</ul>
						</TeammateSessionsDisclosure>
					) : (
						<>
							<p className="px-3 py-1 text-xs font-medium text-text-subtle">Sessions from your teammates</p>
							<ul className="flex w-full flex-col gap-0">{teammateItems.map(renderSession)}</ul>
						</>
					)}
				</div>
			) : null}
		</div>
	);
}
