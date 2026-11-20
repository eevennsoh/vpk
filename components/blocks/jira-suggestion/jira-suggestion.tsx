"use client";

import LightbulbIcon from "@atlaskit/icon/core/lightbulb";
import { useCallback, useEffect, useId, useImperativeHandle, useRef, useState, type Ref } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, cancelFrame, frame, motion, useReducedMotion } from "motion/react";

import { useRovoChatControls } from "@/app/contexts/context-rovo-chat-controls";
import FloatingRovoButton from "@/components/blocks/rovo-button";
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

export function JiraFloatingSuggestions({ feed, portalContainer, ref, workItemKey }: Readonly<{ feed: SuggestionFeed; portalContainer?: HTMLElement; ref?: Ref<{ reopen: () => true }>; workItemKey: string }>) {
	const { closeChat } = useRovoChatControls();
	const [panelStage, setPanelStage] = useState<"closed" | "reopening" | "expanding" | "list" | "caught-up">("closed");
	const [showNudge, setShowNudge] = useState(true);
	const reduceMotion = useReducedMotion();
	const panelId = useId();
	const panelRef = useRef<HTMLDivElement>(null);
	const deckRef = useRef<HTMLDivElement>(null);
	const deck = useDeck(feed, () => {});
	const count = feed.review.pending.length;
	const label = `${count} ${count === 1 ? "suggestion" : "suggestions"}`;
	const openingStage = reduceMotion ? "list" : "expanding";
	const isExpanding = panelStage === "expanding" && !reduceMotion;
	useEffect(() => {
		if (!isExpanding) return;
		let previous: DOMRect | undefined;
		const revealWhenSettled = () => {
			const panel = panelRef.current;
			if (!panel?.offsetHeight) {
				previous = undefined;
				return;
			}

			const bounds = panel.getBoundingClientRect();
			const settled = previous?.x === bounds.x && previous.y === bounds.y
				&& previous.width === bounds.width && previous.height === bounds.height
				&& Math.abs(bounds.width - panel.offsetWidth) <= 0.5
				&& Math.abs(bounds.height - panel.offsetHeight) <= 0.5;
			previous = bounds;
			if (!settled) return;
			cancelFrame(revealWhenSettled);
			setPanelStage((stage) => stage === "expanding" ? "list" : stage);
		};
		frame.postRender(revealWhenSettled, true);
		return () => cancelFrame(revealWhenSettled);
	}, [isExpanding]);

	if (panelStage === "reopening") setPanelStage(count > 0 ? openingStage : "caught-up");
	else if (count === 0 && panelStage !== "closed" && panelStage !== "caught-up") setPanelStage("closed");
	else if (count > 0 && panelStage === "caught-up") setPanelStage("list");
	const show = () => {
		setShowNudge(false);
		setPanelStage(openingStage);
	};
	const close = () => {
		setPanelStage("closed");
		feed.acknowledgeNew();
	};
	useImperativeHandle(ref, () => ({
		reopen: () => {
			deck.restoreDismissed();
			closeChat();
			setShowNudge(false);
			setPanelStage((stage) => stage === "closed" ? "reopening" : stage);
			return true;
		},
	}));

	if (typeof document === "undefined") return null;
	return createPortal(
		<>
			<span className="sr-only" role="status">{count === 0 ? deck.announcement : showNudge ? label : ""}</span>
			<FloatingRovoButton
				animateLogoOnMount
				ariaLabel={count > 0 ? "Review AI suggestions" : "Open Rovo chat"}
				onButtonClick={count > 0 ? show : undefined}
				panel={count > 0 || panelStage !== "closed" ? {
					id: panelId,
					open: panelStage !== "closed",
					content: (
						<StackPanel
							className={cn(
								"max-h-[calc(100dvh-3rem)] max-w-[calc(100vw-3rem)] rounded-none bg-transparent shadow-none",
								isExpanding ? "[&_[data-scrollport]]:invisible" : null,
							)}
							deck={deck}
							deckRef={deckRef}
							feed={feed}
							focusOnMount
							id={panelId}
							listStage={isExpanding ? "intro" : "list"}
							maxHeight={500}
							onClose={close}
							overlay={null}
							panelRef={panelRef}
							title={`Suggestions for ${workItemKey}`}
						/>
					),
				} : undefined}
				positioning={portalContainer ? "container" : "viewport"}
				product="jira"
				suggestion={showNudge && count > 0 ? {
					id: panelId,
					label,
					icon: (
						<span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center text-icon-inverse">
							<LightbulbIcon color="currentColor" label="" size="small" />
						</span>
					),
					onSelect: show,
					onDismiss: () => setShowNudge(false),
				} : null}
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
	const { filled, waiting, barAfter, flash, finish, cancel } = useJustFilled();
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
					<MockDetailsRail barAfter={barAfter} highlighted={filled} review={feed.review} waiting={waiting} />
				</>
			)}
		/>
	);
}
