"use client";

import { useEffect, useRef } from "react";

import AiAgentAddIcon from "@atlaskit/icon-lab/core/ai-agent-add";

import {
	type AgentAssignmentAgent,
} from "@/components/blocks/agent-assignment/components/agent-assignment";
import { toAssignmentSessionItem } from "@/components/blocks/agent-assignment/components/assignment-session";
import { AgentSessionCard } from "@/components/blocks/agent-session/agent-session-card";
import type { AgentSessionItem } from "@/components/blocks/agent-session/agent-session-types";
import { Button } from "@/components/ui/button";

export function AssignedAgentsSessionMenu({
	onAddAgent,
	onContinueInAgent,
	onDeleteSession,
	onMoreMenuOpenChange,
	onRenameSession,
	onSelectAgent,
	onToggleVisibility,
	rows,
}: Readonly<{
	onAddAgent?: () => void;
	onContinueInAgent?: (item: AgentSessionItem) => void;
	onDeleteSession?: (item: AgentSessionItem) => void;
	onMoreMenuOpenChange?: (open: boolean) => void;
	onRenameSession?: (item: AgentSessionItem) => void;
	onSelectAgent: (agent: AgentAssignmentAgent) => void;
	onToggleVisibility?: (item: AgentSessionItem) => void;
	rows: readonly AgentAssignmentAgent[];
}>) {
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const frameId = window.requestAnimationFrame(() => {
			containerRef.current?.focus();
		});
		return () => window.cancelAnimationFrame(frameId);
	}, []);

	return (
		<div className="flex w-full flex-col gap-1 p-1 outline-none" ref={containerRef} tabIndex={-1}>
			{rows.length === 0 ? (
				<p className="px-3 py-2 text-sm text-text-subtle">No agents assigned</p>
			) : (
				<ul className="flex w-full flex-col gap-0">
					{rows.map((row) => (
						<AgentSessionCard
							density="long"
							item={toAssignmentSessionItem(row)}
							key={row.id}
							moreMenuPortalled={true}
							moreMenuPositionerClassName="z-[600]"
							onContinueInAgent={onContinueInAgent}
							onDeleteSession={onDeleteSession}
							onMoreMenuOpenChange={onMoreMenuOpenChange}
							onRenameSession={onRenameSession}
							onToggleVisibility={onToggleVisibility}
							onView={() => onSelectAgent(row)}
							padding="compact"
							showLifecycleLabel={false}
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
							<AiAgentAddIcon label="" />
						</span>
						<span className="text-text-subtle">Assign agent</span>
					</Button>
				</div>
			) : null}
		</div>
	);
}
