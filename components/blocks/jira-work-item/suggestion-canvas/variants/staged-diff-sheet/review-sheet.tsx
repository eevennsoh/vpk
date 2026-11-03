"use client";

import { type RefObject, useEffect, useEffectEvent } from "react";
import CrossIcon from "@atlaskit/icon/core/cross";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { TeamworkGraphMark } from "@/components/ui-custom/teamwork-graph-mark";
import { token } from "@/lib/tokens";

import { SUGGESTION_WORK_ITEM, type SuggestionFieldId } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import type { SuggestionReview } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-review";
import { DiffRow } from "./diff-row";
import { groupByPrimarySource, pluralize, SOURCE_META } from "./model";
import { SourceIcon } from "./source-icon";

export interface ReviewSheetProps {
	id: string;
	review: SuggestionReview;
	isIncluded: (id: SuggestionFieldId) => boolean;
	setIncluded: (ids: readonly SuggestionFieldId[], included: boolean) => void;
	onAccept: (id: SuggestionFieldId) => void;
	onApply: () => void;
	onDismissRemaining: () => void;
	onClose: () => void;
	ref: RefObject<HTMLElement | null>;
}

function SheetHeader({ titleId, onClose }: Readonly<{ titleId: string; onClose: () => void }>) {
	return (
		<header className="flex items-start gap-3 px-5 pt-4 pb-3.5">
			<span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface">
				<TeamworkGraphMark className="size-4" />
			</span>
			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<h2 className="text-base/6 font-semibold text-text" id={titleId}>Review suggested changes</h2>
				<p className="text-xs text-text-subtlest">
					{SUGGESTION_WORK_ITEM.agent.name} · {SUGGESTION_WORK_ITEM.agent.ranAt} · via Teamwork Graph
				</p>
			</div>
			<Button aria-label="Close review" className="-mt-0.5 -mr-1.5" onClick={onClose} size="icon" variant="ghost">
				<CrossIcon color="currentColor" label="" size="small" />
			</Button>
		</header>
	);
}

/** Commit-style staged review of every suggestion, grouped by where the evidence came from. */
export function ReviewSheet({ id, review, isIncluded, setIncluded, onAccept, onApply, onDismissRemaining, onClose, ref }: Readonly<ReviewSheetProps>) {
	const titleId = `${id}-title`;
	const pendingIds = review.pending.map((suggestion) => suggestion.id);
	const stagedCount = pendingIds.filter(isIncluded).length;
	const pendingCount = pendingIds.length;
	const allStaged = pendingCount > 0 && stagedCount === pendingCount;
	const groups = groupByPrimarySource(review.suggestions);
	const canApply = stagedCount > 0;

	const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
		if (event.key === "Escape") {
			event.preventDefault();
			onClose();
		} else if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && canApply) {
			event.preventDefault();
			onApply();
		}
	});

	// A native listener (not onKeyDown) so keys from portaled popovers, which bubble through the React tree
	// but not the DOM, never close the sheet or apply changes.
	useEffect(() => {
		const node = ref.current;
		if (!node) return;
		const listener = (event: KeyboardEvent) => handleKeyDown(event);
		node.addEventListener("keydown", listener);
		return () => node.removeEventListener("keydown", listener);
	}, [ref]);

	return (
		<section
			aria-labelledby={titleId}
			aria-modal="false"
			className="flex h-full flex-col rounded-xl bg-surface-overlay outline-none"
			id={id}
			ref={ref}
			role="dialog"
			style={{ boxShadow: token("elevation.shadow.overlay") }}
			tabIndex={-1}
		>
			<SheetHeader onClose={onClose} titleId={titleId} />

			<div className="flex min-h-10 items-center gap-3 border-y border-border bg-surface-sunken px-5 py-2">
				{pendingCount > 0 ? (
					<Checkbox
						aria-label={allStaged ? "Deselect all pending changes" : "Select all pending changes"}
						checked={allStaged}
						indeterminate={stagedCount > 0 && !allStaged}
						onCheckedChange={() => setIncluded(pendingIds, !allStaged)}
					/>
				) : null}
				<span className="text-xs font-medium text-text-subtle">
					{pendingCount > 0 ? `${stagedCount} of ${pendingCount} pending selected` : "Nothing left to stage"}
				</span>
				<span className="flex-1" />
				<span className="flex items-center gap-2 font-mono text-xs text-text-subtlest">
					<span>{SUGGESTION_WORK_ITEM.key}</span>
					<span aria-hidden="true">·</span>
					<span className="text-text-success">+{review.suggestions.length} fields</span>
					<span className="text-text-subtlest">−0</span>
				</span>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto">
				{groups.map((group) => {
					const meta = SOURCE_META[group.kind];
					const headingId = `${id}-group-${group.kind}`;
					return (
						<section aria-labelledby={headingId} key={group.kind}>
							<h3 className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-surface-overlay px-5 py-2 text-xs" id={headingId}>
								<SourceIcon kind={group.kind} />
								<span className="font-semibold text-text">{meta.name}</span>
								<span className="text-text-subtlest">{meta.detail}</span>
								<span className="flex-1" />
								<span className="text-text-subtlest tabular-nums">{pluralize(group.suggestions.length, "change")}</span>
							</h3>
							<ul className="flex flex-col">
								{group.suggestions.map((suggestion) => (
									<DiffRow
										decision={review.decisionOf(suggestion.id)}
										included={isIncluded(suggestion.id)}
										key={suggestion.id}
										onAccept={() => onAccept(suggestion.id)}
										onDismiss={() => review.dismiss(suggestion.id)}
										onIncludedChange={(included) => setIncluded([suggestion.id], included)}
										onUndo={() => review.undo(suggestion.id)}
										suggestion={suggestion}
									/>
								))}
							</ul>
						</section>
					);
				})}
			</div>

			<footer className="flex items-center gap-3 rounded-b-xl border-t border-border px-5 py-3">
				{pendingCount > 0 ? (
					<>
						<span className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-text-subtlest">
							<KbdGroup><Kbd>⌘</Kbd><Kbd>↵</Kbd></KbdGroup>
							to apply
						</span>
						<Button onClick={onDismissRemaining} variant="ghost">Dismiss remaining</Button>
						<Button aria-keyshortcuts="Meta+Enter Control+Enter" disabled={!canApply} onClick={onApply}>
							Apply {stagedCount} of {pluralize(pendingCount, "change")}
						</Button>
					</>
				) : (
					<>
						<span aria-live="polite" className="min-w-0 flex-1 text-sm text-text-subtle">
							All {review.suggestions.length} reviewed · {review.accepted.length} accepted · {review.dismissed.length} dismissed
						</span>
						<Button onClick={onClose}>Done</Button>
					</>
				)}
			</footer>
		</section>
	);
}
