"use client";

import { useCallback, useMemo, useState } from "react";

import {
	AGENT_SESSION_ITEMS,
	type AgentSessionItem,
	type UntrackedWorkTriage,
} from "@/components/blocks/agent-session";
import { Button } from "@/components/ui/button";
import {
	PanelContainer,
	PanelContent,
} from "@/components/ui/panel";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import {
	AGENT_SESSION_COLUMN_COLLAPSED_WIDTH_PX,
	AgentSessionColumn,
	type AgentSessionColumnNotchShape,
} from "./index";

/**
 * Catalog stand-in for the docked rail's content-box width.
 *
 * Declared locally so this block demo does not import kanban internals.
 */
const AGENT_SESSION_PANEL_DEMO_WIDTH_PX = 360;

function readNotchShape(values: readonly string[]): AgentSessionColumnNotchShape | undefined {
	const next = values[0];
	return next === "circle" || next === "line" ? next : undefined;
}

const CODEX_AGENT = {
	brandName: "openai-codex",
	id: "codex",
	kind: "agent",
	name: "Codex",
} as const;

const CURSOR_AGENT = {
	brandName: "cursor",
	id: "cursor",
	kind: "agent",
	name: "Cursor",
} as const;

const ROVO_AGENT = {
	id: "rovo-dev",
	kind: "agent",
	name: "Rovo",
	vpkLogo: "rovo",
} as const;

/**
 * Work the next sync will discover, in the batches it arrives in.
 *
 * Two batches rather than one flat list, because the two sizes demonstrate
 * different halves of the design: the first shows arrivals stepping in one
 * after another, the second shows a single arrival landing on its own.
 */
const ARRIVAL_BATCHES: readonly (readonly AgentSessionItem[])[] = [
	[
		{
			id: "lw-sync-webhook-gap",
			title: "Challenge webhook gap note never made it out of the session",
			state: "needs-input",
			agent: CURSOR_AGENT,
			host: "local",
			invokedBy: {
				avatarSrc: "/avatar-user/chloe-lee/color/asow-dev-lime.png",
				name: "Maya Ferreira",
			},
			machineName: "MacBook-Pro.local",
			timeLabel: "Just now",
			sessionDetails: {
				host: "local",
				issueKey: "PAY-107",
				issueSummary: "Challenge webhook gap note never made it out of the session",
				worktreePath: ".worktrees/pay-107-webhook-gap",
			},
		},
		{
			id: "lw-sync-sandbox-root-cause",
			title: "Root cause of the sandbox 401 is still only in a local thread",
			state: "running",
			agent: CODEX_AGENT,
			host: "local",
			invokedBy: {
				avatarSrc: "/avatar-user/venn/venn.png",
				name: "Venn",
			},
			machineName: "H13XSGKLS1",
			timeLabel: "Just now",
			sessionDetails: {
				host: "local",
				issueKey: "PAY-112",
				issueSummary: "Root cause of the sandbox 401 is still only in a local thread",
				worktreePath: ".worktrees/pay-112-sandbox-401",
			},
		},
	],
	[
		{
			id: "lw-sync-replay-blast-radius",
			title: "Replay-risk blast radius still lives in an unsaved session",
			state: "attention",
			agent: ROVO_AGENT,
			host: "local",
			invokedBy: {
				avatarSrc: "/avatar-user/dev-rana/color/asow-product-purple.png",
				name: "Diego Santos",
			},
			machineName: "DESKTOP-7K2M9Q1",
			timeLabel: "Just now",
			sessionDetails: {
				host: "local",
				issueKey: "PAY-118",
				issueSummary: "Replay-risk blast radius still lives in an unsaved session",
				worktreePath: ".worktrees/pay-118-replay-risk",
			},
		},
	],
];

interface PanelDemoAttachTarget {
	readonly key: string;
}

export function AgentSessionColumnPanelDemo({
	showFilter = true,
	showOverflow = true,
}: Readonly<{
	showFilter?: boolean;
	showOverflow?: boolean;
}> = {}) {
	const [capturedIds, setCapturedIds] = useState<ReadonlySet<string>>(() => new Set());
	const [collapsed, setCollapsed] = useState(false);
	const [items, setItems] = useState<readonly AgentSessionItem[]>(AGENT_SESSION_ITEMS);
	const [multiSelect, setMultiSelect] = useState(true);
	const [newIds, setNewIds] = useState<ReadonlySet<string>>(() => new Set());
	const [notchShape, setNotchShape] = useState<AgentSessionColumnNotchShape>("circle");
	const [syncedBatches, setSyncedBatches] = useState(0);

	const handleCapture = useCallback((item: AgentSessionItem) => {
		setCapturedIds((current) => new Set(current).add(item.id));
	}, []);

	const triage = useMemo<UntrackedWorkTriage<PanelDemoAttachTarget>>(() => ({
		archive: (item) => {
			setItems((currentItems) => currentItems.filter((session) => session.id !== item.id));
		},
		attach: (item) => {
			handleCapture(item);
		},
		createFrom: (item) => {
			handleCapture(item);
		},
		locateTarget: (_session, workItemKey) => {
			if (workItemKey.length === 0) {
				return undefined;
			}

			return { key: workItemKey };
		},
	}), [handleCapture]);

	// Arrivals land at the top, under the header, because that is where sync sits.
	const handleSync = useCallback(() => {
		const batch = ARRIVAL_BATCHES[syncedBatches];
		if (batch === undefined) {
			return;
		}

		setItems((currentItems) => [...batch, ...currentItems]);
		setNewIds((currentNew) => {
			const next = new Set(currentNew);
			for (const item of batch) {
				next.add(item.id);
			}
			return next;
		});
		setSyncedBatches(syncedBatches + 1);
	}, [syncedBatches]);

	const handleMarkReviewed = useCallback(() => {
		setNewIds(new Set());
	}, []);

	const handleReset = useCallback(() => {
		setItems(AGENT_SESSION_ITEMS);
		setMultiSelect(true);
		setNewIds(new Set());
		setNotchShape("circle");
		setCapturedIds(new Set());
		setCollapsed(false);
		setSyncedBatches(0);
	}, []);

	const hasArrivals = newIds.size > 0;
	const canSync = syncedBatches < ARRIVAL_BATCHES.length;
	const hostWidthPx = collapsed
		? AGENT_SESSION_COLUMN_COLLAPSED_WIDTH_PX
		: AGENT_SESSION_PANEL_DEMO_WIDTH_PX;

	return (
		<div className="flex min-h-[560px] w-full flex-col gap-4">
			<div className="flex shrink-0 flex-wrap items-center gap-2">
				<Button disabled={!canSync} onClick={handleSync} size="compact" variant="default">
					{canSync ? "Sync new work" : "Nothing left to sync"}
				</Button>
				<Button
					disabled={!hasArrivals}
					onClick={handleMarkReviewed}
					size="compact"
					variant="outline"
				>
					Mark reviewed
				</Button>
				<Button onClick={handleReset} size="compact" variant="ghost">
					Reset
				</Button>
				<Toggle
					onPressedChange={setMultiSelect}
					pressed={multiSelect}
					size="sm"
					variant="outline"
				>
					Multi-select
				</Toggle>
				<ToggleGroup
					aria-label="Collapsed marker shape"
					className="ml-auto"
					onValueChange={(values) => {
						const nextShape = readNotchShape(values);
						if (nextShape !== undefined) {
							setNotchShape(nextShape);
						}
					}}
					size="sm"
					value={[notchShape]}
					variant="outline"
				>
					<ToggleGroupItem value="circle">Circle</ToggleGroupItem>
					<ToggleGroupItem value="line">Line</ToggleGroupItem>
				</ToggleGroup>
				<p className="text-xs text-text-subtlest">
					Sync prepends unattached sessions: the cards step in from above and hold a
					discovery-toned dash, while each new user dot reveals the same
					human avatar as its card, holds, then shrinks into a 4px rest in
					icon.disabled and pushes the ones below it down. Hovering or
					focusing a dot reveals that face again. Mark reviewed decays the mark, which
					is what the watermark does when the column is expanded. {multiSelect
						? "Select cards to reveal Link, Create, Archive, and Clear in the header."
						: "Multi-select is off. Each drag carries only the session it starts from."}
				</p>
			</div>

			<div
				className="flex h-[560px] min-h-[560px] shrink-0 flex-col"
				style={{ width: hostWidthPx }}
			>
				<PanelContainer
					aria-label="Unlink sessions panel"
					className="h-full"
				>
					<PanelContent className={collapsed ? "pt-1" : "pt-0"}>
						<AgentSessionColumn
							capturedItemIds={capturedIds}
							className="flex-1"
							collapsed={collapsed}
							expandedWidthPx={AGENT_SESSION_PANEL_DEMO_WIDTH_PX}
							hasScrollingEffect
							headerSurface="panel"
							items={items}
							listClassName="gap-1 p-1"
							multiSelect={multiSelect}
							newItemIds={newIds}
							notchShape={notchShape}
							onCollapsedChange={setCollapsed}
							onCreateWorkItem={handleCapture}
							onLinkWorkItem={handleCapture}
							onSubtasks={handleCapture}
							showFilter={showFilter}
							showOverflow={showOverflow}
							triage={triage}
						/>
					</PanelContent>
				</PanelContainer>
			</div>
		</div>
	);
}
