"use client";

import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { useReducedMotion } from "motion/react";

import ArchiveBoxIcon from "@atlaskit/icon/core/archive-box";
import StatusInformationIcon from "@atlaskit/icon/core/status-information";
import StatusSuccessIcon from "@atlaskit/icon/core/status-success";
import AiAgentAddIcon from "@atlaskit/icon-lab/core/ai-agent-add";

import {
	type AgentAssignmentAgent,
	type AgentAssignmentStatusKind,
} from "@/components/blocks/agent-assignment/components/agent-assignment";
import { resolveAssignedAgentStatusKind } from "@/components/blocks/agent-assignment/components/assigned-agent-status";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { CyclingByline } from "@/components/ui-custom/chain-of-thought";
import {
	RichTextSuggestionMenu,
	type RichTextSuggestionMenuItem,
} from "@/components/ui-custom/rich-text-editor";

interface AssignedAgentsMenuProps {
	addAgentLabel: string;
	onAddAgent?: () => void;
	onArchiveAgent?: (agent: AgentAssignmentAgent) => void;
	onSelectAgent: (agent: AgentAssignmentAgent) => void;
	rows: readonly AgentAssignmentAgent[];
}

const ASSIGNED_AGENT_STATUS_CYCLE_INTERVAL_MS = 1800;
const ASSIGNED_AGENT_STATUS_CYCLE_JITTER_MS = 1600;
const ASSIGNED_AGENT_STATUS_INITIAL_STAGGER_MS = 320;

function getAssignedAgentStatusLabels(agent: AgentAssignmentAgent): readonly string[] {
	const sequence = agent.statusSequence
		?.map((label) => label.trim())
		.filter((label, index, labels) => label.length > 0 && labels.indexOf(label) === index);
	if (sequence?.length) {
		return sequence;
	}

	return typeof agent.status === "string" && agent.status.trim()
		? [agent.status.trim()]
		: [];
}

function getAssignedAgentStatusCycleDelay(intervalMs: number, jitterMs: number): number {
	return Math.max(1000, intervalMs) + Math.round(Math.random() * Math.max(0, jitterMs));
}

function getAssignedAgentStaticByline(
	agent: AgentAssignmentAgent,
	fallback: string,
): string {
	if (typeof agent.status === "string" && agent.status.trim()) {
		return agent.status.trim();
	}

	return agent.statusLabel.trim() || fallback;
}

function getAssignedAgentHoverByline(
	agent: AgentAssignmentAgent,
	kind: AgentAssignmentStatusKind,
	rowIndex: number,
) {
	switch (kind) {
		case "working":
			return <AssignedAgentStatus agent={agent} rowIndex={rowIndex} />;
		case "needs-input":
			return getAssignedAgentStaticByline(agent, "Needs input");
		case "finished":
			return getAssignedAgentStaticByline(agent, "Finished");
		case "idle":
			return agent.status ?? undefined;
		default: {
			const exhaustiveKind: never = kind;
			return exhaustiveKind;
		}
	}
}

function AssignedAgentTrailingStatus({
	agent,
	kind,
}: Readonly<{
	agent: AgentAssignmentAgent;
	kind: AgentAssignmentStatusKind;
}>) {
	switch (kind) {
		case "working":
			return (
				<span className="grid size-6 shrink-0 place-items-center">
					<Spinner label={`${agent.name} running`} size="sm" />
				</span>
			);
		case "needs-input":
			return (
				<span className="grid size-6 shrink-0 place-items-center text-icon-information">
					<StatusInformationIcon label={`${agent.name} needs input`} size="small" />
				</span>
			);
		case "finished":
			return (
				<span className="grid size-6 shrink-0 place-items-center text-icon-success">
					<StatusSuccessIcon label={`${agent.name} finished`} size="small" />
				</span>
			);
		case "idle":
			return null;
		default: {
			const exhaustiveKind: never = kind;
			return exhaustiveKind;
		}
	}
}

function AssignedAgentStatus({
	agent,
	rowIndex,
}: Readonly<{
	agent: AgentAssignmentAgent;
	rowIndex: number;
}>) {
	const shouldReduceMotion = useReducedMotion();
	const [statusIndex, setStatusIndex] = useState(0);
	const labels = getAssignedAgentStatusLabels(agent);
	const label = labels[statusIndex % labels.length];
	const intervalMs = agent.statusCycleIntervalMs ?? ASSIGNED_AGENT_STATUS_CYCLE_INTERVAL_MS;
	const jitterMs = agent.statusCycleJitterMs ?? ASSIGNED_AGENT_STATUS_CYCLE_JITTER_MS;
	const statusKey = labels.join("\n");

	useEffect(() => {
		if (shouldReduceMotion || labels.length <= 1) {
			return undefined;
		}

		let timeoutId: number | undefined;
		const queueNextStatus = (delayMs: number) => {
			timeoutId = window.setTimeout(() => {
				setStatusIndex((index) => (index + 1) % labels.length);
				queueNextStatus(getAssignedAgentStatusCycleDelay(intervalMs, jitterMs));
			}, delayMs);
		};
		queueNextStatus(
			getAssignedAgentStatusCycleDelay(intervalMs, jitterMs)
				+ rowIndex * ASSIGNED_AGENT_STATUS_INITIAL_STAGGER_MS,
		);

		return () => {
			if (timeoutId !== undefined) {
				window.clearTimeout(timeoutId);
			}
		};
	}, [intervalMs, jitterMs, labels.length, rowIndex, shouldReduceMotion, statusKey]);

	if (label === undefined) {
		return agent.status;
	}

	return (
		<CyclingByline className="menu-row-byline">
			{label}
		</CyclingByline>
	);
}

function toAgentItem(
	row: AgentAssignmentAgent,
	rowIndex: number,
	onArchiveAgent: ((agent: AgentAssignmentAgent) => void) | undefined,
	onSelectAgent: (agent: AgentAssignmentAgent) => void,
): RichTextSuggestionMenuItem {
	const statusKind = resolveAssignedAgentStatusKind(row);
	const trailing = statusKind === "idle"
		? undefined
		: <AssignedAgentTrailingStatus agent={row} kind={statusKind} />;

	return {
		icon: null,
		id: row.id,
		inlineMetadata: getAssignedAgentHoverByline(row, statusKind, rowIndex),
		hoverActions: onArchiveAgent ? {
			onPrimary: () => onSelectAgent(row),
			onSecondary: () => onArchiveAgent(row),
			primaryLabel: "View",
			secondaryIcon: <ArchiveBoxIcon label="" size="small" />,
			secondaryLabel: "Archive",
		} : undefined,
		label: row.name,
		trailing,
		leadingVisual: (
			<AgentAvatarVisual
				avatarClassName="shrink-0"
				avatarSrc={row.avatarSrc}
				brandName={row.brandName}
				vpkLogo={row.vpkLogo}
				fallbackText={row.name.slice(0, 2).toUpperCase()}
				logoName={row.logoName}
				sizePx={24}
			/>
		),
	};
}

export function AssignedAgentsMenu({
	addAgentLabel,
	onAddAgent,
	onArchiveAgent,
	onSelectAgent,
	rows,
}: Readonly<AssignedAgentsMenuProps>) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [selectedIndex, setSelectedIndex] = useState(-1);
	const items: readonly RichTextSuggestionMenuItem[] = rows.map((row, rowIndex) =>
		toAgentItem(row, rowIndex, onArchiveAgent, onSelectAgent)
	);

	const focusOptionAt = (index: number) => {
		containerRef.current
			?.querySelectorAll<HTMLButtonElement>("[data-suggestion-option]")
			.item(index)
			?.focus();
	};

	useEffect(() => {
		const frameId = window.requestAnimationFrame(() => {
			containerRef.current?.focus();
		});
		return () => window.cancelAnimationFrame(frameId);
	}, []);

	const handleSelect = (item: RichTextSuggestionMenuItem) => {
		const row = rows.find((candidate) => candidate.id === item.id);
		if (row) {
			onSelectAgent(row);
		}
	};

	const moveSelection = (step: number) => {
		const nextIndex = selectedIndex === -1
			? (step > 0 ? 0 : items.length - 1)
			: (selectedIndex + step + items.length) % items.length;
		focusOptionAt(nextIndex);
	};

	const handleFocus = (event: FocusEvent<HTMLDivElement>) => {
		const options = containerRef.current?.querySelectorAll<HTMLButtonElement>("[data-suggestion-option]");
		if (options && event.target instanceof HTMLButtonElement) {
			const index = [...options].indexOf(event.target);
			if (index !== -1) {
				setSelectedIndex(index);
				return;
			}
		}
		const actionsRow = event.target instanceof Element
			? event.target.closest("[data-suggestion-actions]")
			: null;
		if (actionsRow && containerRef.current?.contains(actionsRow) && options) {
			const option = actionsRow.querySelector<HTMLButtonElement>("[data-suggestion-option]");
			const index = option ? [...options].indexOf(option) : -1;
			if (index !== -1) {
				setSelectedIndex(index);
				return;
			}
		}
		setSelectedIndex(-1);
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			moveSelection(event.key === "ArrowDown" ? 1 : -1);
		}
	};

	return (
		<div
			className="flex w-full flex-col gap-1 p-1 outline-none"
			onFocus={handleFocus}
			onKeyDown={handleKeyDown}
			ref={containerRef}
			tabIndex={-1}
		>
			<>
				<RichTextSuggestionMenu
					className="rich-text-command-menu-embedded w-full! [&_.rich-text-command-menu-list]:p-0"
					emptyLabel="No agents assigned"
					items={items}
					onHover={setSelectedIndex}
					onHoverEnd={() => setSelectedIndex(-1)}
					onSelect={handleSelect}
					selectedIndex={selectedIndex}
					title="Assigned agents"
				/>
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
							<span className="text-text-subtle">{addAgentLabel}</span>
						</Button>
					</div>
				) : null}
			</>
		</div>
	);
}
