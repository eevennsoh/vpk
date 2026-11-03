"use client";

import CheckCircleIcon from "@atlaskit/icon/core/check-circle";
import CrossIcon from "@atlaskit/icon/core/cross";
import UndoIcon from "@atlaskit/icon/core/undo";

import { Button } from "@/components/ui/button";
import { TeamworkGraphMark } from "@/components/ui-custom/teamwork-graph-mark";
import { TwgToolBannerBackground } from "@/components/ui-custom/twg-tool";

import { SUGGESTION_WORK_ITEM } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import { pluralize } from "./model";

export interface Receipt {
	kind: "applied" | "dismissed";
	count: number;
}

export interface RailStatusProps {
	sheetId: string;
	sheetOpen: boolean;
	pendingCount: number;
	receipt: Receipt | null;
	onToggleSheet: () => void;
	onUndoReceipt: () => void;
	onCloseReceipt: () => void;
	onReset: () => void;
}

function AgentMark() {
	return (
		<span aria-hidden="true" className="relative flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface">
			<TeamworkGraphMark className="size-3.5" />
		</span>
	);
}

/** Slim status line above the Details card: ready banner, post-apply receipt, or all-reviewed note. */
export function RailStatus({ sheetId, sheetOpen, pendingCount, receipt, onToggleSheet, onUndoReceipt, onCloseReceipt, onReset }: Readonly<RailStatusProps>) {
	if (receipt) {
		return (
			<div aria-live="polite" className="flex shrink-0 flex-col gap-2 rounded-xl border border-border-success-subtle bg-green-50 py-2.5 pr-2 pl-3" role="status">
				<div className="flex items-center gap-2.5">
					<span className="flex text-icon-success"><CheckCircleIcon color="currentColor" label="" /></span>
					<span className="min-w-0 flex-1 text-sm font-medium text-text">
						{receipt.kind === "applied" ? `Applied ${pluralize(receipt.count, "change")}` : `Dismissed ${pluralize(receipt.count, "suggestion")}`}
						<span className="font-normal text-text-subtle"> to {SUGGESTION_WORK_ITEM.key}</span>
					</span>
					<Button onClick={onUndoReceipt} size="compact" variant="ghost">
						<UndoIcon color="currentColor" label="" size="small" />
						Undo
					</Button>
					<Button aria-label="Close confirmation" onClick={onCloseReceipt} size="icon-compact" variant="ghost">
						<CrossIcon color="currentColor" label="" size="small" />
					</Button>
				</div>
				{pendingCount > 0 ? (
					<div className="flex items-center justify-between gap-2 border-t border-border-success-subtle pt-2 pl-[30px]">
						<span className="text-xs text-text-subtle">{pluralize(pendingCount, "suggestion")} still to review</span>
						<Button aria-controls={sheetId} aria-expanded={sheetOpen} onClick={onToggleSheet} size="compact" variant="outline">Review</Button>
					</div>
				) : null}
			</div>
		);
	}

	if (pendingCount === 0) {
		return (
			<div className="flex shrink-0 items-center gap-2.5 rounded-xl border border-border py-2 pr-2 pl-3">
				<span className="flex text-icon-success"><CheckCircleIcon color="currentColor" label="" size="small" /></span>
				<span className="min-w-0 flex-1 text-sm text-text-subtle">All suggestions reviewed</span>
				<Button onClick={onReset} size="compact" variant="ghost">Replay demo</Button>
			</div>
		);
	}

	return (
		<div className="relative flex shrink-0 items-center gap-2.5 overflow-hidden rounded-xl border border-border bg-surface-raised py-2 pr-2 pl-2.5">
			<TwgToolBannerBackground />
			<span className="relative"><AgentMark /></span>
			<span className="relative flex min-w-0 flex-1 flex-col">
				<span className="text-sm font-semibold text-text">{pluralize(pendingCount, "suggestion")} ready</span>
				<span className="text-xs text-text-subtlest">{SUGGESTION_WORK_ITEM.agent.name} · {SUGGESTION_WORK_ITEM.agent.ranAt}</span>
			</span>
			<Button aria-controls={sheetId} aria-expanded={sheetOpen} className="relative" onClick={onToggleSheet} size="compact" variant="outline">
				{sheetOpen ? "Reviewing" : "Review"}
			</Button>
		</div>
	);
}
