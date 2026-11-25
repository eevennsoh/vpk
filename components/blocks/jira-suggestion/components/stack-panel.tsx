"use client";

import { useEffect, useEffectEvent, useLayoutEffect, useId, useRef, useState, type RefObject } from "react";
import { AnimatePresence, cancelFrame, frame, LayoutGroup, type MotionValue } from "motion/react";

import type { SuggestionFieldId } from "@/components/blocks/jira-suggestion/data/suggestions";
import type { SuggestionFeed } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-feed";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { CHROME_HEIGHT, LIST_HEADER_TOP_INSET } from "./constants";
import { PanelBody } from "./panel-body";
import { PanelHeader } from "./panel-header";
import { StackFooter } from "./stack-footer";
import type { BodyMode } from "./use-body-height";
import type { Deck, SwipeDirection } from "./use-deck";
import { useDeckView } from "./use-deck-view";
import { usePanelFocus } from "./use-panel-focus";

export interface StackPanelProps {
	id: string;
	className?: string;
	title?: string;
	listStage?: "measuring" | "intro" | "list";
	introHeight?: number;
	focusOnMount?: boolean;
	feed: SuggestionFeed;
	deck: Deck;
	panelRef: RefObject<HTMLDivElement | null>;
	deckRef: RefObject<HTMLDivElement | null>;
	/** The preview's overlay layer, where the why card renders. */
	overlay: HTMLElement | null;
	/** The popover's height budget inside the frame. */
	maxHeight: number;
	onClose: () => void;
	/** Replaces the header's default check (inline popovers only) with the host's, e.g. one that gathers the cards first. */
	onRerun?: () => void;
	/** A check is running over an inert stack: the footer offers only Cancel. */
	checking?: boolean;
	/** Ease height changes, so the panel follows the cards as they gather for a check and unpack after it. */
	animateHeight?: boolean;
}

/**
 * The suggestions popover: heading with view · re-run · close, a body that is the stack, the unpacked
 * list or the caught-up state, and the progress footer.
 */
export function StackPanel({ id, className, title, listStage, introHeight, focusOnMount = false, feed, deck, panelRef, deckRef, overlay, maxHeight, onClose, onRerun, checking = false, animateHeight = false }: Readonly<StackPanelProps>) {
	const [whyId, setWhyId] = useState<SuggestionFieldId | null>(null);
	const [grab, setGrab] = useState<{ id: SuggestionFieldId; progress: MotionValue<number> } | null>(null);
	const checkRef = useRef<HTMLButtonElement>(null);
	const toggleRef = useRef<HTMLButtonElement>(null);
	const rerunRef = useRef<HTMLButtonElement>(null);
	const layoutGroup = useId();
	const titleId = `${id}-title`;
	const view = useDeckView(feed, deck, listStage === "intro" ? "stack" : listStage === undefined ? undefined : "list");
	const headerView = view.listed || listStage !== undefined ? "list" : "stack";
	// A check from the caught-up state runs in place there: the stack and footer only come back for real finds.
	const mode: BodyMode = deck.order.length === 0 ? "caught-up" : view.listed ? "list" : "stack";
	const stackInteractive = mode === "stack" && listStage === undefined;
	const shortcuts = [
		...(stackInteractive ? ["ArrowLeft", "ArrowRight"] : []),
		...(deck.lastDecision && feed.status !== "running" ? ["Meta+Z", "Control+Z"] : []),
	].join(" ") || undefined;

	const commit = (direction: SwipeDirection) => {
		const top = deck.order.at(0);
		if (!top) return;
		setGrab(null);
		setWhyId(null);
		deck.decide(top.id, direction);
	};
	const toggleView = () => {
		setWhyId(null);
		if (view.listed) view.collapse();
		else view.unpack();
	};
	const undo = () => {
		if (mode === "caught-up" && panelRef.current?.contains(document.activeElement)) panelRef.current.focus({ preventScroll: true });
		// Undoing the only decision removes the Undo button; hand focus to the stack rather than dropping it.
		if (deck.undoDepth === 1 && panelRef.current?.contains(document.activeElement) && document.activeElement?.closest("[data-deck-controls]")) deckRef.current?.focus({ preventScroll: true });
		view.undo();
	};
	// Cancel leaves with the check, whichever ends it; keep focus on the action that started the check.
	// A height transition needs a length to start from: hold the list's height for a frame, then fit the stack.
	const [fitStack, setFitStack] = useState(false);
	useEffect(() => {
		if (!checking) return undefined;
		const raf = requestAnimationFrame(() => setFitStack(true));
		return () => {
			cancelAnimationFrame(raf);
			setFitStack(false);
		};
	}, [checking]);
	// The check's finds can swap in a shorter top card in the same commit that ends it, so the unpack would start from
	// that height and dip first. Remember the stack's last height and start the unpack from there instead.
	const stackHeight = useRef(0);
	useEffect(() => {
		const panel = panelRef.current;
		if (!checking || !fitStack || !panel) return undefined;
		const observer = new ResizeObserver(() => { stackHeight.current = panel.offsetHeight; });
		observer.observe(panel);
		return () => observer.disconnect();
	}, [checking, fitStack, panelRef]);
	useLayoutEffect(() => {
		const panel = panelRef.current;
		const from = stackHeight.current;
		if (checking || !panel || from === 0) return;
		stackHeight.current = 0;
		const target = panel.style.height;
		panel.style.transition = "none";
		panel.style.height = `${from}px`;
		void panel.offsetHeight;
		panel.style.transition = "";
		panel.style.height = target;
	}, [checking, panelRef]);
	const wasChecking = useRef(checking);
	useEffect(() => {
		const ended = wasChecking.current && !checking;
		wasChecking.current = checking;
		if (!ended) return;
		const active = document.activeElement;
		if (active === document.body || active === null) rerunRef.current?.focus({ preventScroll: true });
	}, [checking]);
	const cancelCheck = () => {
		rerunRef.current?.focus({ preventScroll: true });
		feed.cancelRerun();
	};
	usePanelFocus({ panelRef, deckRef, checkRef, toggleRef, mode, pendingCount: deck.order.length });
	useEffect(() => {
		if (!focusOnMount) return;
		const focusWhenVisible = () => {
			const panel = panelRef.current;
			if (!panel || getComputedStyle(panel).visibility !== "visible") return;
			panel.focus({ preventScroll: true });
			cancelFrame(focusWhenVisible);
		};
		frame.postRender(focusWhenVisible, true);
		return () => cancelFrame(focusWhenVisible);
	}, [focusOnMount, panelRef]);

	const onPanelKeyDown = useEffectEvent((event: KeyboardEvent) => {
		if (event.defaultPrevented) return;
		if (event.key === "Escape") {
			event.preventDefault();
			if (whyId) { event.stopPropagation(); setWhyId(null); }
			else onClose();
			return;
		}
		if (event.isComposing || event.altKey || event.shiftKey || whyId) return;
		const target = event.target;
		if (!(target instanceof Element) || target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], [role="menu"], [role="listbox"], [role="slider"], [role="spinbutton"]')) return;
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
			if (!deck.lastDecision || feed.status === "running") return;
			event.preventDefault();
			event.stopPropagation();
			undo();
		} else if (!event.metaKey && !event.ctrlKey && stackInteractive && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
			event.preventDefault();
			event.stopPropagation();
			commit(event.key === "ArrowRight" ? "accept" : "dismiss");
		}
	});
	useEffect(() => {
		const panel = panelRef.current;
		if (!panel) return undefined;
		const listener = (event: KeyboardEvent) => onPanelKeyDown(event);
		panel.addEventListener("keydown", listener);
		return () => panel.removeEventListener("keydown", listener);
	}, [panelRef]);

	const panel = (
		<div
			aria-keyshortcuts={shortcuts}
			aria-labelledby={titleId}
			className={cn(
				"flex max-h-full w-96 max-w-[calc(100vw-1rem)] flex-col rounded-xl bg-surface-overlay shadow-2xl outline-none",
				animateHeight ? "transition-[height] duration-medium ease-in-out" : null,
				className,
			)}
			id={id}
			ref={panelRef}
			role="dialog"
			style={listStage !== undefined ? {
				// While checking, the panel fits the gathered stack instead of holding the list's height.
				height: mode === "caught-up" ? undefined : checking && fitStack ? "auto" : introHeight ?? (feed.runs.length === 1 ? maxHeight : undefined),
				maxHeight: `min(${maxHeight}px, ${feed.onPreviewCard ? "56dvh" : "calc(100dvh - 3rem)"})`,
			} : undefined}
			tabIndex={-1}
		>
			<PanelHeader
				feed={feed}
				floating={listStage !== undefined}
				onClose={onClose}
				onRerun={onRerun ?? (listStage === undefined ? feed.rerun : undefined)}
				onToggleView={listStage === undefined && feed.review.suggestions.length > 0 ? toggleView : undefined}
				rerunRef={rerunRef}
				title={title}
				titleId={titleId}
				toggleRef={toggleRef}
				view={headerView}
			/>
			<LayoutGroup id={layoutGroup}>
				<PanelBody
					key={listStage === "measuring" ? "measure" : "review"}
					checkRef={checkRef}
					checking={checking}
					deck={deck}
					deckRef={deckRef}
					feed={feed}
					floating={listStage !== undefined}
					grab={grab}
					maxHeight={maxHeight - CHROME_HEIGHT - (headerView === "list" ? LIST_HEADER_TOP_INSET : 0)}
					mode={mode}
					stackInteractive={stackInteractive}
					onCommit={commit}
					onGrab={setGrab}
					onUndo={undo}
					onUnpack={toggleView}
					onWhyIdChange={setWhyId}
					view={view}
					whyAnchor={panelRef}
					whyContainer={overlay}
					whyId={whyId}
				/>
			</LayoutGroup>
			<AnimatePresence initial={false}>
				{mode === "caught-up" ? null : <StackFooter animateEntrance={listStage === undefined} deck={deck} key="footer" onCancel={checking ? cancelCheck : undefined} />}
			</AnimatePresence>
			<p aria-live="polite" className="sr-only">{deck.announcement}</p>
		</div>
	);
	return <TooltipProvider portalContainer={panelRef}>{panel}</TooltipProvider>;
}
