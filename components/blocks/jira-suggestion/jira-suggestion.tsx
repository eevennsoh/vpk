"use client";

import { useCallback, useEffect, useId, useImperativeHandle, useRef, useState, type Ref } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, cancelFrame, frame, motion, useReducedMotion } from "motion/react";

import { useRovoChatControls } from "@/app/contexts/context-rovo-chat-controls";
import FloatingRovoButton, { type FloatingRovoButtonSuggestion } from "@/components/blocks/rovo-button";
import { motionRecipe } from "@/lib/motion";
import { cn } from "@/lib/utils";

import { CHROME_HEIGHT, LIST_HEADER_TOP_INSET } from "./components/constants";
import { MockDetailsRail } from "./components/mock-details-rail";
import { reconcileFloatingPanelStage, settleMeasuredStage, type FloatingPanelStage } from "./floating-panel-stage";
import { SUGGESTIONS_ICON_RESOLVE_MS, SuggestionsStatusIcon } from "./components/suggestions-status-icon";
import { useSuggestionFeed } from "./hooks/use-suggestion-feed";
import { WorkItemPreviewShell } from "./components/work-item-preview-shell";
import { StackMain } from "./components/stack-main";
import { StackPanel } from "./components/stack-panel";
import { StackTrigger } from "./components/stack-trigger";
import { useDeck } from "./components/use-deck";
import { useJustFilled } from "./components/use-just-filled";
import { useOverlayPlacement } from "./components/use-overlay-placement";
import { Popover, PopoverContent } from "@/components/ui/popover";
import type { SuggestionFeed } from "./hooks/use-suggestion-feed";
import type { TwgToolSource } from "@/components/ui-custom/twg-tool";

const FLOATING_PANEL_MAX_HEIGHT = 500;
const REVIEW_ACTION_ID = "review-suggestions";
/** How long the landing intro shows the agent still finding suggestions. */
export const SUGGESTION_ANALYSIS_MS = 2600;

/** How long cards found while the panel is already open (Undo, Check again) rest as a stack before unpacking. */
const IN_PLACE_UNPACK_MS = 260;
/** How long the panel takes to grow back with the stack after a check, matching its height transition (slower). */
const CHECK_REOPEN_MS = 420;
/** The folded panel during a check: the list header's inset, the header and the footer. */
const CHECK_FOLDED_HEIGHT = CHROME_HEIGHT + LIST_HEADER_TOP_INSET;

/** Landing intro for the review action: finding suggestions, resolving into the icon, then ready with dot and nudge. */
type IntroPhase = "analyzing" | "resolving" | "ready";

export function JiraFloatingSuggestions({ analyzeOnMount = false, feed, notification, panelTransition, portalContainer, ref, workItemKey }: Readonly<{ analyzeOnMount?: boolean; feed: SuggestionFeed; notification?: FloatingRovoButtonSuggestion | null; panelTransition?: "button" | "dot"; portalContainer?: HTMLElement; ref?: Ref<{ reopen: () => true }>; workItemKey: string }>) {
	const { closeChat } = useRovoChatControls();
	const [panelStage, setPanelStage] = useState<FloatingPanelStage>({ phase: "closed" });
	const [openFromIndicator, setOpenFromIndicator] = useState(false);
	const [openRequested, setOpenRequested] = useState(false);
	const reduceMotion = useReducedMotion();
	const panelId = useId();
	const panelRef = useRef<HTMLDivElement>(null);
	const deckRef = useRef<HTMLDivElement>(null);
	const deck = useDeck(feed, () => {});
	const count = feed.review.pending.length;
	const label = `${count} ${count === 1 ? "suggestion" : "suggestions"}`;
	const [intro, setIntro] = useState<IntroPhase>(analyzeOnMount ? "analyzing" : "ready");
	// The dot means "unseen": opening the panel clears it, even without deciding, until a later run finds more.
	const [seenRuns, setSeenRuns] = useState(0);
	const hasNotification = count > 0 && intro === "ready" && feed.runs.length > seenRuns;
	useEffect(() => {
		if (intro === "ready") return undefined;
		const timer = window.setTimeout(() => setIntro(intro === "analyzing" ? "resolving" : "ready"), intro === "analyzing" ? SUGGESTION_ANALYSIS_MS : SUGGESTIONS_ICON_RESOLVE_MS);
		return () => window.clearTimeout(timer);
	}, [intro]);
	const openingStage: FloatingPanelStage = reduceMotion ? { phase: "list" } : feed.runs.length === 1
		? { phase: "expanding", height: FLOATING_PANEL_MAX_HEIGHT }
		: { phase: "measuring", then: "expanding" };
	const { phase } = panelStage;
	const isMeasuring = phase === "measuring" && !reduceMotion;
	const isExpanding = phase === "expanding" && !reduceMotion;
	// "unpacking" replays the open's stack→list beat in place, since no open animation will come to finish it.
	const isUnpacking = phase === "unpacking";
	// A check gathers the list into an inert stack as the panel folds to its header and footer, and reopens once it ends.
	const isChecking = phase === "checking";
	const isReopening = phase === "reopening";
	const introHeight = isChecking ? CHECK_FOLDED_HEIGHT : panelStage.phase === "expanding" || panelStage.phase === "unpacking" || panelStage.phase === "checking" || panelStage.phase === "reopening" ? panelStage.height : undefined;
	const listStage = isMeasuring ? "measuring" : isExpanding || isUnpacking || isChecking || isReopening ? "intro" : "list";
	useEffect(() => {
		if (!isReopening) return undefined;
		const timer = window.setTimeout(() => setPanelStage((stage) => stage.phase === "reopening" ? { phase: "unpacking", height: stage.height } : stage), CHECK_REOPEN_MS);
		return () => window.clearTimeout(timer);
	}, [isReopening]);
	useEffect(() => {
		if (!isUnpacking) return undefined;
		const timer = window.setTimeout(() => setPanelStage((stage) => stage.phase === "unpacking" ? { phase: "list" } : stage), IN_PLACE_UNPACK_MS);
		return () => window.clearTimeout(timer);
	}, [isUnpacking]);
	useEffect(() => {
		if (!isMeasuring) return;
		const revealWhenSettled = () => {
			const panel = panelRef.current;
			if (!panel?.offsetHeight) return;
			const height = panel.offsetHeight;
			cancelFrame(revealWhenSettled);
			setPanelStage((stage) => settleMeasuredStage(stage, height) ?? stage);
		};
		frame.postRender(revealWhenSettled, true);
		return () => cancelFrame(revealWhenSettled);
	}, [isMeasuring]);

	const running = feed.status === "running";
	const nextStage = reconcileFloatingPanelStage(panelStage, count, reduceMotion ?? false, running);
	if (nextStage) setPanelStage(nextStage);
	const show = () => {
		feed.onOpenReview?.(panelId);
		setPanelStage(openingStage);
	};
	/** Check again from the header: the list folds back into a stack and waits there until the check ends or is cancelled. */
	const recheck = () => {
		if (running) return;
		feed.rerun();
		if (phase === "list" || phase === "unpacking") setPanelStage({ phase: "checking", height: panelRef.current?.offsetHeight || FLOATING_PANEL_MAX_HEIGHT });
	};
	const finishClose = useCallback(() => {
		setPanelStage({ phase: "closed" });
		setOpenFromIndicator(false);
	}, []);
	const close = () => {
		feed.acknowledgeNew();
		// Anything a check found while the panel was open has been seen too.
		setSeenRuns(feed.runs.length);
		// Every close, including the caught-up state, flies the panel back into the button it opened from.
		if (!reduceMotion) setPanelStage({ phase: "closing" });
		else finishClose();
	};
	/**
	 * Opens the review from Rovo chat. The chat closes and, once the review action is back on screen, the panel opens
	 * from it exactly as a click would, so it grows out of and closes into the action like any other open.
	 */
	const reopen = (): true => {
		deck.restoreDismissed();
		closeChat();
		setOpenRequested(true);
		return true;
	};
	useImperativeHandle(ref, () => ({ reopen }));
	const openReview = () => {
		setIntro("ready");
		setSeenRuns(feed.runs.length);
		setOpenRequested(false);
		setOpenFromIndicator(true);
		if (count > 0) show();
		else {
			feed.onOpenReview?.(panelId);
			setPanelStage({ phase: "caught-up" });
		}
	};

	if (typeof document === "undefined") return null;
	return createPortal(
		<>
			<span className="sr-only" role="status">{intro === "analyzing" ? "Finding suggestions" : count === 0 ? deck.announcement : label}</span>
			<FloatingRovoButton
				animateLogoOnMount
				// The Rovo button always opens Rovo chat; the review action is the one way into suggestions.
				ariaLabel="Open Rovo chat"
				panel={{
					id: panelId,
					open: phase !== "closed",
					indicatorActionId: REVIEW_ACTION_ID,
					openFromIndicator,
					openRequested,
					closingToIndicator: phase === "closing",
					onOpenComplete: () => setPanelStage((stage) => stage.phase === "expanding" ? { phase: "list" } : stage),
					onCloseComplete: finishClose,
					content: (
						<StackPanel
							className={cn(
								"max-w-[calc(100vw-3rem)] rounded-none bg-transparent shadow-none",
								listStage === "measuring" ? "[&_[data-scrollport]]:invisible" : null,
							)}
							deck={deck}
							deckRef={deckRef}
							feed={feed}
							focusOnMount
							id={panelId}
							animateHeight={isChecking || isReopening || isUnpacking}
							checking={isChecking}
							folded={isChecking}
							introHeight={isExpanding || isUnpacking || isChecking || isReopening ? introHeight : undefined}
							listStage={listStage}
							maxHeight={FLOATING_PANEL_MAX_HEIGHT}
							onClose={close}
							onRerun={recheck}
							overlay={null}
							panelRef={panelRef}
							title={`Review suggestions for ${workItemKey}`}
						/>
					),
				}}
				positioning={portalContainer ? "container" : "viewport"}
				product="jira"
				persistentBar={{ panelTransition, items: [{
					id: REVIEW_ACTION_ID,
					ariaLabel: "Review suggestions",
					busy: intro === "analyzing",
					tooltipLabel: intro === "analyzing" ? "Finding suggestions…" : count > 0 ? label : "Review suggestions",
					icon: <SuggestionsStatusIcon state={intro === "analyzing" ? "loading" : "done"} />,
					indicator: hasNotification,
					nudge: analyzeOnMount && hasNotification ? 1 : undefined,
					onClick: openReview,
				}] }}
				suggestion={notification}
			/>
		</>,
		portalContainer ?? document.body,
	);
}

/** The same review stack embedded beside a real work item's details. */
export function JiraSuggestionControl({ feed, sources, showIntroLoading = false }: Readonly<{ feed: SuggestionFeed; sources?: readonly TwgToolSource[]; showIntroLoading?: boolean }>) {
	const [open, setOpen] = useState(false);
	const interacted = useRef(false);
	const autoOpened = useRef(false);
	const panelId = useId();
	const anchorRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);
	const deckRef = useRef<HTMLDivElement>(null);
	const deck = useDeck(feed, () => {});
	const openAfterIntro = () => {
		if (interacted.current || autoOpened.current || feed.status === "running" || feed.review.pending.length === 0) return;
		autoOpened.current = true;
		setOpen(true);
	};
	const close = () => {
		setOpen(false);
		feed.acknowledgeNew();
		triggerRef.current?.focus();
	};

	return (
		<Popover onOpenChange={setOpen} open={open}>
			<div ref={anchorRef}>
				<StackTrigger animateIntro feed={feed} onIntroComplete={showIntroLoading ? openAfterIntro : undefined} onToggle={() => { interacted.current = true; setOpen((current) => !current); }} open={open} panelId={panelId} showIntroLoading={showIntroLoading} sources={sources} triggerRef={triggerRef} />
			</div>
			<PopoverContent anchor={anchorRef} align="start" aria-label="Work item suggestions" className="w-auto max-w-[calc(100vw-1rem)] gap-0 overflow-visible bg-transparent p-0 shadow-none" initialFocus={false} positionerClassName="z-[650]" side="left" sideOffset={8}>
				<StackPanel deck={deck} deckRef={deckRef} feed={feed} id={panelId} maxHeight={500} onClose={close} overlay={null} panelRef={panelRef} />
			</PopoverContent>
		</Popover>
	);
}

/**
 * Card stack: one suggestion at a time on a swipeable, randomly fanned stack inside a popover over the work item.
 * Swipe or press → to accept, ← to dismiss; click the stack (or the list toggle) to unpack it into a scrolling list
 * and gather it back. Re-runs put their finds on top, marked New.
 */
export function JiraSuggestion() {
	const feed = useSuggestionFeed();
	const [open, setOpen] = useState(true);
	const panelId = useId();
	const panelRef = useRef<HTMLDivElement>(null);
	const deckRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const { overlayRef, overlay, anchorRef, style } = useOverlayPlacement(open);
	const { filled, waiting, cursor, flash, finish, cancel } = useJustFilled();
	const finishDescription = useCallback(() => finish("description"), [finish]);
	const deck = useDeck(feed, flash, cancel);
	const slide = useReducedMotion() ? 0 : 8;

	const close = () => {
		setOpen(false);
		feed.acknowledgeNew();
		triggerRef.current?.focus();
	};
	const toggle = () => {
		if (open) {
			close();
			return;
		}
		setOpen(true);
		requestAnimationFrame(() => deckRef.current?.focus({ preventScroll: true }));
	};

	return (
		<WorkItemPreviewShell
			main={<StackMain highlighted={filled.has("description")} onRevealComplete={finishDescription} review={feed.review} />}
			overlay={(
				<div className="pointer-events-none absolute inset-0 z-30" ref={overlayRef}>
					<AnimatePresence initial={false}>
						{open && style ? (
							<motion.div
								animate={{ opacity: 1, x: 0, transition: motionRecipe.popup.enter }}
								className="pointer-events-auto absolute flex"
								exit={{ opacity: 0, x: slide, transition: motionRecipe.popup.exit }}
								initial={{ opacity: 0, x: slide }}
								key="deck"
								style={{ ...style, willChange: "transform, opacity" }}
							>
								<StackPanel deck={deck} deckRef={deckRef} feed={feed} id={panelId} maxHeight={Number(style.maxHeight)} onClose={close} overlay={overlay} panelRef={panelRef} />
							</motion.div>
						) : null}
					</AnimatePresence>
				</div>
			)}
			rail={(
				<>
					<div ref={anchorRef}>
						<StackTrigger feed={feed} onToggle={toggle} open={open} panelId={panelId} triggerRef={triggerRef} />
					</div>
					<MockDetailsRail cursor={cursor} highlighted={filled} review={feed.review} waiting={waiting} />
				</>
			)}
		/>
	);
}
