"use client";

import { use, useEffect, useRef } from "react";

import AiAgentAddIcon from "@atlaskit/icon-lab/core/ai-agent-add";

import {
	type AgentAssignmentAgent,
} from "@/components/blocks/agent-assignment/components/agent-assignment";
import { toAssignmentSessionItem } from "@/components/blocks/agent-assignment/components/assignment-session";
import { AgentSessionCard } from "@/components/blocks/agent-session/agent-session-card";
import { AgentSessionAvatarPreviewContext } from "@/components/blocks/agent-session/agent-session-avatar-preview";
import type { AgentSessionItem } from "@/components/blocks/agent-session/agent-session-types";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export function AssignedAgentsSessionMenu({
	addAgentLabel,
	onAddAgent,
	onContinueInAgent,
	onDeleteSession,
	onMoreMenuOpenChange,
	onRenameSession,
	onSelectAgent,
	onToggleVisibility,
	rows,
}: Readonly<{
	addAgentLabel: string;
	onAddAgent?: () => void;
	onContinueInAgent?: (item: AgentSessionItem) => void;
	onDeleteSession?: (item: AgentSessionItem) => void;
	onMoreMenuOpenChange?: (open: boolean) => void;
	onRenameSession?: (item: AgentSessionItem) => void;
	onSelectAgent: (agent: AgentAssignmentAgent) => void;
	onToggleVisibility?: (item: AgentSessionItem) => void;
	rows: readonly AgentAssignmentAgent[];
}>) {
	return <AgentSessionsMenu
		addAgentLabel={addAgentLabel}
		items={rows.map(toAssignmentSessionItem)}
		onAddAgent={onAddAgent}
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
	addAgentLabel,
	items,
	localSessionAction = "continue",
	overlayPositionerClassName = "z-[600]",
	onAddAgent,
	onContinueInAgent,
	onDeleteSession,
	onMoreMenuOpenChange,
	onRenameSession,
	onSelectSession,
	onToggleVisibility,
}: Readonly<{
	addAgentLabel: string;
	items: readonly AgentSessionItem[];
	localSessionAction?: "continue" | "view";
	overlayPositionerClassName?: string;
	onAddAgent?: () => void;
	onContinueInAgent?: (item: AgentSessionItem) => void;
	onDeleteSession?: (item: AgentSessionItem) => void;
	onMoreMenuOpenChange?: (open: boolean) => void;
	onRenameSession?: (item: AgentSessionItem) => void;
	onSelectSession: (item: AgentSessionItem) => void;
	onToggleVisibility?: (item: AgentSessionItem) => void;
}>) {
	const containerRef = useRef<HTMLDivElement>(null);
	const renderAgentAvatar = use(AgentSessionAvatarPreviewContext);

	useEffect(() => {
		const frameId = window.requestAnimationFrame(() => {
			containerRef.current?.focus();
		});
		return () => window.cancelAnimationFrame(frameId);
	}, []);

	return (
		<div className="flex w-full flex-col gap-1 p-1 outline-none" ref={containerRef} tabIndex={-1}>
			{items.length === 0 ? (
				<p className="px-3 py-2 text-sm text-text-subtle">No agents assigned</p>
			) : (
				<ul className="flex w-full flex-col gap-0">
					{items.map((item) => (
						<AgentSessionCard
							density="long"
							hoverTone="menu"
							item={item}
							key={item.id}
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
					))}
				</ul>
			)}
			{onAddAgent ? (
				<div className="sticky bottom-0 z-10 flex shrink-0 flex-col border-t border-border bg-popover p-0 pt-1">
					<Button
						className="h-8 min-h-8 w-full justify-start gap-3 pl-2 pr-3 py-0 text-left text-sm font-normal"
						onClick={onAddAgent}
						type="button"
						variant="ghost"
					>
						<span className="grid size-6 shrink-0 place-items-center text-icon-subtle">
							<Icon className="size-4" render={<AiAgentAddIcon label="" />} />
						</span>
						<span className="min-w-0 truncate text-text-subtle">{addAgentLabel}</span>
					</Button>
				</div>
			) : null}
		</div>
	);
}
