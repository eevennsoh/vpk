"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";

import { Popover, PopoverContent } from "@/components/ui/popover";
import { motionDuration, motionEase } from "@/lib/motion";
import { token } from "@/lib/tokens";

import type { SuggestionFieldId } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import type { SuggestionFeed } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-feed";
import { CaughtUp, GroupDivider, MenuFooter, MenuHeader, MenuStatusLine, RUNNING_COPY, type FooterUndo, type MenuStatus } from "./menu-chrome";
import { QuietRow, type DecideVia, type RowMove } from "./quiet-row";
import { ReviewedGroup } from "./reviewed-group";
import { useElementEvents } from "./use-element-events";
import { MENU_WIDTH, useLastAction, useReceipts, type LastAction } from "./use-menu-state";
import { useWhyCard, WHY_OFFSET } from "./use-why-card";
import { QuietWhyCard } from "./why-card";

const NOTHING_NEW_MS = 3200;
const ROW_ENTER = { duration: motionDuration.medium, ease: motionEase.inOut };
const ROW_EXIT = { duration: motionDuration.normal, ease: motionEase.in };

export interface QuietPanelProps {
	id: string;
	feed: SuggestionFeed;
	panelRef: RefObject<HTMLDivElement | null>;
	/** Ids from the latest run that still sit under the "New" divider. */
	newGroup: ReadonlySet<SuggestionFieldId>;
	onAccept: (ids: readonly SuggestionFieldId[]) => void;
	onClose: () => void;
}

type ListItem = { key: string; kind: "divider"; label: string } | { key: string; kind: "row"; id: SuggestionFieldId };

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export function QuietPanel({ id, feed, panelRef, newGroup, onAccept, onClose }: Readonly<QuietPanelProps>) {
	const { review } = feed;
	const titleId = `${id}-title`;
	const whyPopupId = `${id}-why`;
	const hintId = `${id}-hint`;
	const running = feed.status === "running";
	const why = useWhyCard(whyPopupId);
	const receipts = useReceipts();
	const lastAction = useLastAction();
	const [quietRun, setQuietRun] = useState(1);
	const [activeId, setActiveId] = useState<SuggestionFieldId | null>(null);
	const [showReviewed, setShowReviewed] = useState(false);
	/** Set while focus moves because of a decision, so the next row takes focus without covering the result with a why card. */
	const quietFocus = useRef(false);
	const focusQuietly = (element: HTMLElement | null | undefined, options?: FocusOptions) => {
		if (!element) return;
		quietFocus.current = true;
		element.focus(options);
		quietFocus.current = false;
	};

	const lastRun = feed.runs.at(-1);
	const checkedNothingNew = lastRun != null && lastRun.number > 1 && lastRun.ids.length === 0;
	const nothingNew = checkedNothingNew && quietRun !== lastRun.number;
	useEffect(() => {
		if (!nothingNew || lastRun == null) return undefined;
		const timer = window.setTimeout(() => setQuietRun(lastRun.number), NOTHING_NEW_MS);
		return () => window.clearTimeout(timer);
	}, [lastRun, nothingNew]);

	const visible = review.suggestions.filter((suggestion) => review.decisionOf(suggestion.id) === "pending" || receipts.receipts.has(suggestion.id));
	const fresh = visible.filter((suggestion) => newGroup.has(suggestion.id));
	const earlier = visible.filter((suggestion) => !newGroup.has(suggestion.id));
	const toRow = (suggestion: { id: SuggestionFieldId }): ListItem => ({ key: suggestion.id, kind: "row", id: suggestion.id });
	const items: ListItem[] = fresh.length > 0
		? [{ key: "new", kind: "divider", label: "New" }, ...fresh.map(toRow), ...(earlier.length > 0 ? [{ key: "earlier", kind: "divider" as const, label: "Earlier" }] : []), ...earlier.map(toRow)]
		: earlier.map(toRow);
	const rowIds = items.flatMap((item) => (item.kind === "row" ? [item.id] : []));
	const pendingIds = rowIds.filter((rowId) => review.decisionOf(rowId) === "pending");
	const tabStop = activeId != null && rowIds.includes(activeId) ? activeId : (pendingIds[0] ?? rowIds[0]);
	const byId = new Map(review.suggestions.map((suggestion) => [suggestion.id, suggestion]));
	const caughtUp = items.length === 0;
	/** Listed rows get one quiet inline run signal; the caught-up block carries its own. */
	const status: MenuStatus = caughtUp ? null : running ? "running" : nothingNew ? "nothing-new" : null;

	const rowElement = (rowId: SuggestionFieldId) => panelRef.current?.querySelector<HTMLElement>(`[data-row-id="${rowId}"]`);
	const moveFocus = (from: SuggestionFieldId, move: RowMove) => {
		const index = rowIds.indexOf(from);
		const target = move === "first" ? rowIds[0] : move === "last" ? rowIds.at(-1) : rowIds[index + (move === "next" ? 1 : -1)];
		if (target) rowElement(target)?.focus();
	};
	/** Keyboard reviewers continue to the next pending row; pointer users keep their place without a focus jump. */
	const settleFocus = (decided: SuggestionFieldId, via: DecideVia) => {
		if (via === "pointer") {
			if (panelRef.current?.contains(document.activeElement)) panelRef.current.focus({ preventScroll: true });
			return;
		}
		const index = rowIds.indexOf(decided);
		const next = [...pendingIds.filter((rowId) => rowIds.indexOf(rowId) > index), ...pendingIds.filter((rowId) => rowIds.indexOf(rowId) < index)][0];
		focusQuietly(next ? rowElement(next) : panelRef.current);
	};

	const decide = (target: SuggestionFieldId, decision: LastAction["decision"], via: DecideVia) => {
		if (why.openId === target) why.close();
		if (decision === "accepted") onAccept([target]);
		else review.dismiss(target);
		receipts.add(target);
		lastAction.record({ ids: [target], decision, bulk: false });
		settleFocus(target, via);
	};
	const decideAll = (decision: LastAction["decision"]) => {
		const ids = review.pending.map((suggestion) => suggestion.id);
		if (ids.length === 0) return;
		why.close();
		if (decision === "accepted") onAccept(ids);
		else review.dismissAll();
		lastAction.record({ ids, decision, bulk: true });
	};
	const undoOne = (target: SuggestionFieldId, via: DecideVia) => {
		review.undo(target);
		receipts.drop(target);
		if (lastAction.last?.ids.includes(target)) lastAction.clear();
		if (via === "keyboard") requestAnimationFrame(() => focusQuietly(rowElement(target)));
	};
	/** Re-running keeps the last Undo and lets receipts fold on their own timers; only a newer action or expiry retires them. */
	const rerun = () => {
		why.close();
		feed.rerun();
	};
	const reviewedIds = review.suggestions.filter((suggestion) => review.decisionOf(suggestion.id) !== "pending" && !receipts.receipts.has(suggestion.id)).map((suggestion) => suggestion.id);
	const reviewedOpen = showReviewed && reviewedIds.length > 0;
	const reviewedId = `${id}-reviewed`;

	const { last } = lastAction;
	const footerUndo: FooterUndo | null = last && (last.bulk || !last.ids.some((target) => receipts.receipts.has(target)))
		? (() => {
			const verb = last.decision === "accepted" ? "Accepted" : "Dismissed";
			const single = `${byId.get(last.ids[0])?.label ?? "Suggestion"} ${last.decision === "accepted" ? "added" : "dismissed"}`;
			/** The footer slot is narrow, so it shows a count; the Undo button's name carries the field. */
			const summary = `${last.ids.length} ${last.decision === "accepted" ? "added" : "dismissed"}`;
			return {
				decision: last.decision,
				summary,
				label: last.bulk ? `Undo: ${verb} ${plural(last.ids.length, "suggestion")}` : `Undo: ${single}`,
				onHold: lastAction.hold,
				onUndo: () => {
					last.ids.forEach((target) => review.undo(target));
					lastAction.clear();
				},
			};
		})()
		: null;

	const focusInside = useRef(false);
	const insideWhy = (node: EventTarget | null) => node instanceof Node && document.getElementById(whyPopupId)?.contains(node) === true;
	useElementEvents(panelRef, {
		keydown: (event) => {
			if (event.key !== "Escape" || event.defaultPrevented) return;
			event.preventDefault();
			if (why.openId) why.close();
			else onClose();
		},
		/**
		 * A keyboard ring left on one row while the mouse works another reads as two active rows. Once the pointer
		 * moves onto a different row, drop the ring quietly and hand that row the roving tab stop.
		 */
		pointermove: (event) => {
			if (event.pointerType !== "mouse" || !(event.target instanceof Element)) return;
			const active = document.activeElement;
			const focusedRow = active instanceof HTMLElement ? active.closest<HTMLElement>("[data-row-id]") : null;
			const hoveredRow = event.target.closest<HTMLElement>("[data-row-id]");
			if (!focusedRow || !hoveredRow || focusedRow === hoveredRow || !panelRef.current?.contains(focusedRow)) return;
			focusQuietly(panelRef.current, { preventScroll: true });
			setActiveId(hoveredRow.dataset.rowId as SuggestionFieldId);
		},
		focusin: (event) => {
			focusInside.current = true;
			if (quietFocus.current) return;
			if (event.target instanceof Element && event.target.closest("[data-row-id]")) return;
			why.close();
		},
		focusout: (event) => {
			const next = event.relatedTarget;
			if (next instanceof Node && (panelRef.current?.contains(next) || insideWhy(next))) return;
			if (next != null) focusInside.current = false;
			why.close();
		},
	});

	/**
	 * Controls unmount as the list changes (Check again when new rows arrive, a receipt folding away). If focus was
	 * inside and fell to the document, land it on the first pending row, or the menu itself, never the page.
	 */
	const listKey = rowIds.join(" ");
	const firstPending = pendingIds[0];
	useEffect(() => {
		const active = document.activeElement;
		if (!focusInside.current || (active != null && active !== document.body)) return;
		const target = firstPending ? panelRef.current?.querySelector<HTMLElement>(`[data-row-id="${firstPending}"]`) : null;
		focusQuietly(target ?? panelRef.current, { preventScroll: true });
	}, [firstPending, listKey, panelRef, caughtUp]);

	const whySuggestion = why.state ? byId.get(why.state.id) : undefined;
	const announcement = running ? RUNNING_COPY : nothingNew ? "No new suggestions" : fresh.length > 0 ? `${plural(fresh.length, "new suggestion")}` : "";

	return (
		<div
			aria-labelledby={titleId}
			className="flex max-h-full flex-col rounded-xl bg-surface-overlay outline-none"
			id={id}
			ref={panelRef}
			role="dialog"
			style={{ width: MENU_WIDTH, boxShadow: token("elevation.shadow.overlay") }}
			tabIndex={-1}
		>
			<MenuHeader onRerun={rerun} ranAt={lastRun?.ranAt ?? ""} running={running} titleId={titleId} />
			<div className="scroll-fade-y min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 pb-1.5" data-why-scrollport="">
				<MenuStatusLine status={status} />
				<div aria-label="Suggested field values" role="list">
					<AnimatePresence initial={false}>
						{items.map((item) => {
							const suggestion = item.kind === "row" ? byId.get(item.id) : undefined;
							return (
								<motion.div
									animate={{ height: "auto", opacity: 1, transition: ROW_ENTER }}
									exit={{ height: 0, opacity: 0, transition: ROW_EXIT }}
									initial={{ height: 0, opacity: 0 }}
									key={item.key}
									role={item.kind === "row" ? "listitem" : undefined}
									style={{ overflow: "clip", overflowClipMargin: 4 }}
								>
									{item.kind === "divider" ? <GroupDivider fresh={item.key === "new"} label={item.label} /> : suggestion ? (
										<QuietRow
											decision={review.decisionOf(item.id)}
											hintId={hintId}
											isNew={newGroup.has(item.id)}
											onAccept={(via) => decide(item.id, "accepted", via)}
											onDismiss={(via) => decide(item.id, "dismissed", via)}
											onFocusRow={() => {
												setActiveId(item.id);
												if (why.openId != null && why.openId !== item.id) why.close();
											}}
											onHold={(holding) => receipts.hold(item.id, holding)}
											onHoverCancel={why.cancelPending}
											onHoverEnd={why.hoverEnd}
											onHoverStart={(anchor, via) => {
												if (via === "focus" && quietFocus.current) return;
												why.hoverStart(item.id, anchor, via);
											}}
											onMove={(move) => moveFocus(item.id, move)}
											onUndo={(via) => undoOne(item.id, via)}
											onWhyToggle={(anchor) => why.toggle(item.id, anchor)}
											suggestion={suggestion}
											tabbable={tabStop === item.id}
											whyOpen={why.openId === item.id}
											whyPopupId={whyPopupId}
										/>
									) : null}
								</motion.div>
							);
						})}
					</AnimatePresence>
				</div>
				{caughtUp ? (
					<CaughtUp accepted={review.accepted.length} checkedNothingNew={checkedNothingNew} dismissed={review.dismissed.length} onRerun={rerun} running={running} />
				) : null}
				<ReviewedGroup byId={byId} decisionOf={review.decisionOf} id={reviewedId} ids={reviewedIds} onUndo={undoOne} open={reviewedOpen} />
			</div>
			<MenuFooter
				onAcceptAll={() => decideAll("accepted")}
				onDismissAll={() => decideAll("dismissed")}
				onDone={onClose}
				pending={review.pending.length}
				reviewed={{
					count: review.suggestions.length - review.pending.length,
					total: review.suggestions.length,
					expanded: reviewedOpen,
					controls: reviewedId,
					onToggle: () => setShowReviewed(!reviewedOpen),
				}}
				undo={footerUndo}
			/>
			<Popover onOpenChange={(open) => (open ? null : why.close())} open={why.state?.open ?? false}>
				{whySuggestion && why.state ? (
					<PopoverContent
						align="start"
						anchor={why.state.anchor}
						className="max-h-(--available-height) w-70 gap-0 overflow-hidden rounded-xl bg-surface-overlay p-0"
						finalFocus={false}
						id={whyPopupId}
						initialFocus={false}
						onPointerEnter={why.cardHold}
						onPointerLeave={why.hoverEnd}
						side="left"
						sideOffset={WHY_OFFSET}
						style={{ boxShadow: token("elevation.shadow.overlay") }}
					>
						<QuietWhyCard suggestion={whySuggestion} />
					</PopoverContent>
				) : null}
			</Popover>
			<p className="sr-only" id={hintId}>Enter or Right arrow to accept, Delete or Left arrow to dismiss, I for why. Up and Down arrows move between suggestions.</p>
			<p aria-live="polite" className="sr-only">{announcement}</p>
		</div>
	);
}
