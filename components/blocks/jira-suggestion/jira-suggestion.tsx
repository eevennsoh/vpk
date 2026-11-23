"use client";

import TextReviewIcon from "@atlaskit/icon-lab/core/text-review";
import { useCallback, useEffect, useId, useImperativeHandle, useRef, useState, type Ref } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, cancelFrame, frame, motion, useReducedMotion } from "motion/react";

import { useRovoChatControls } from "@/app/contexts/context-rovo-chat-controls";
import FloatingRovoButton, { type FloatingRovoButtonSuggestion } from "@/components/blocks/rovo-button";
import { motionRecipe } from "@/lib/motion";
import { cn } from "@/lib/utils";

import { MockDetailsRail } from "./components/mock-details-rail";
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

type FloatingPanelStage =
	| { phase: "closed" | "reopening" | "measuring" | "list" | "caught-up" | "closing" }
	| { phase: "expanding"; height: number };

export function JiraFloatingSuggestions({ feed, notification, panelTransition, portalContainer, ref, workItemKey }: Readonly<{ feed: SuggestionFeed; notification?: FloatingRovoButtonSuggestion | null; panelTransition?: "button" | "dot"; portalContainer?: HTMLElement; ref?: Ref<{ reopen: () => true }>; workItemKey: string }>) {
	const { closeChat } = useRovoChatControls();
	const [panelStage, setPanelStage] = useState<FloatingPanelStage>({ phase: "closed" });
	const [openFromIndicator, setOpenFromIndicator] = useState(false);
	const reduceMotion = useReducedMotion();
	const panelId = useId();
	const panelRef = useRef<HTMLDivElement>(null);
	const deckRef = useRef<HTMLDivElement>(null);
	const deck = useDeck(feed, () => {});
	const count = feed.review.pending.length;
	const label = `${count} ${count === 1 ? "suggestion" : "suggestions"}`;
	const hasNotification = count > 0;
	const openingStage: FloatingPanelStage = reduceMotion ? { phase: "list" } : feed.runs.length === 1
		? { phase: "expanding", height: FLOATING_PANEL_MAX_HEIGHT }
		: { phase: "measuring" };
	const { phase } = panelStage;
	const isMeasuring = phase === "measuring" && !reduceMotion;
	const isExpanding = phase === "expanding" && !reduceMotion;
	const listStage = isMeasuring ? "measuring" : isExpanding ? "intro" : "list";
	useEffect(() => {
		if (!isMeasuring) return;
		const revealWhenSettled = () => {
			const panel = panelRef.current;
			if (!panel?.offsetHeight) return;
			const height = panel.offsetHeight;
			cancelFrame(revealWhenSettled);
			setPanelStage((stage) => stage.phase === "measuring" ? { phase: "expanding", height } : stage);
		};
		frame.postRender(revealWhenSettled, true);
		return () => cancelFrame(revealWhenSettled);
	}, [isMeasuring]);

	if (phase === "reopening") setPanelStage(count > 0 ? openingStage : { phase: "caught-up" });
	else if (count === 0 && phase !== "closed" && phase !== "caught-up") setPanelStage({ phase: "closed" });
	else if (count > 0 && phase === "caught-up") setPanelStage(openingStage);
	const show = () => {
		feed.onOpenReview?.(panelId);
		setPanelStage(openingStage);
	};
	const finishClose = useCallback(() => {
		setPanelStage({ phase: "closed" });
		setOpenFromIndicator(false);
	}, []);
	const close = () => {
		feed.acknowledgeNew();
		if (count > 0 && !reduceMotion) setPanelStage({ phase: "closing" });
		else finishClose();
	};
	const reopen = (): true => {
		feed.onOpenReview?.(panelId);
		setOpenFromIndicator(false);
		deck.restoreDismissed();
		closeChat();
		setPanelStage((stage) => stage.phase === "closed" ? { phase: "reopening" } : stage);
		return true;
	};
	useImperativeHandle(ref, () => ({ reopen }));
	const openReview = () => {
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
			<span className="sr-only" role="status">{count === 0 ? deck.announcement : label}</span>
			<FloatingRovoButton
				animateLogoOnMount
				ariaLabel={count > 0 ? "Review AI suggestions" : "Open Rovo chat"}
				onButtonClick={count > 0 ? () => { setOpenFromIndicator(false); show(); } : undefined}
				panel={{
					id: panelId,
					open: phase !== "closed",
					indicatorActionId: "review-suggestions",
					openFromIndicator,
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
							introHeight={isExpanding && panelStage.phase === "expanding" ? panelStage.height : undefined}
							listStage={listStage}
							maxHeight={FLOATING_PANEL_MAX_HEIGHT}
							onClose={close}
							overlay={null}
							panelRef={panelRef}
							title={`Suggestions for ${workItemKey}`}
						/>
					),
				}}
				positioning={portalContainer ? "container" : "viewport"}
				product="jira"
				persistentBar={{ panelTransition, items: [{ id: "review-suggestions", ariaLabel: "Review suggestions", tooltipLabel: count > 0 ? label : "Review suggestions", icon: <TextReviewIcon color="currentColor" label="" />, indicator: hasNotification, onClick: openReview }] }}
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
