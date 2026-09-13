"use client";

import {
	useCallback,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type RefCallback,
} from "react";
import { animate, useMotionValue, useReducedMotion } from "motion/react";

import {
	isAgentSessionDeckActive,
	resolveAgentSessionDeckCollapse,
	resolveAgentSessionDeckMotion,
	type AgentSessionDeck,
} from "./deck-model";
import {
	clearAgentSessionDeck,
	measureAgentSessionDeck,
	writeMeasuredAgentSessionDeck,
	type MeasuredDeckItem,
} from "./deck-write";
import { subscribeToAgentSessionDeckScrollActivity } from "./deck-scroll-activity";

const ENTRANCE_WILL_CHANGE = "transform, opacity";

/**
 * Drives fan / depth from native scroll geometry. Returns a ref for the column
 * scrollport. Scroll stays off React state. A setState per frame would
 * re-render every card.
 *
 * Row geometry is measured on layout, resize, and mutation. Scroll only reads
 * `scrollTop` / `clientHeight` and writes transforms, matching Ticker's
 * static start plus live offset, so native overflow and depth land in the
 * same frame.
 */
export function useAgentSessionDeck(deck: AgentSessionDeck): RefCallback<HTMLElement> {
	const shouldReduceMotion = useReducedMotion();
	const reduceEntrance = shouldReduceMotion === true;
	const active = isAgentSessionDeckActive(deck);
	const presentationDeck = useMemo(
		() => resolveAgentSessionDeckMotion(deck, reduceEntrance),
		[deck, reduceEntrance],
	);
	const collapse = useMotionValue(resolveAgentSessionDeckCollapse(presentationDeck, false));
	const willChange = useMotionValue("auto");
	const playedRef = useRef(false);
	const itemsRef = useRef<MeasuredDeckItem[]>([]);
	const rafRef = useRef<number | null>(null);
	const [port, setPort] = useState<HTMLElement | null>(null);

	const ref = useCallback<RefCallback<HTMLElement>>(
		(node) => {
			setPort(node);
		},
		[],
	);

	useLayoutEffect(() => {
		if (port === null) {
			return undefined;
		}
		const unsubscribeScrollActivity =
			subscribeToAgentSessionDeckScrollActivity(port);
		if (!active) {
			clearAgentSessionDeck(port);
			return unsubscribeScrollActivity;
		}

		const paint = () => {
			writeMeasuredAgentSessionDeck(
				itemsRef.current,
				port.clientHeight,
				port.scrollTop,
				collapse.get(),
				willChange.get(),
				presentationDeck,
			);
		};

		const remeasure = () => {
			itemsRef.current = measureAgentSessionDeck(port);
			paint();
		};

		let entranceControls: { stop: () => void } | null = null;
		const startEntrance = () => {
			if (
				playedRef.current
				|| presentationDeck.entrance === null
				|| entranceControls !== null
			) {
				return;
			}
			if (port.clientHeight <= 0 || port.querySelector(":scope > ul > li") === null) {
				return;
			}
			willChange.set(ENTRANCE_WILL_CHANGE);
			entranceControls = animate(collapse, 0, {
				...presentationDeck.entrance.transition,
				onComplete: () => {
					playedRef.current = true;
					willChange.set("auto");
					// Expand width can still be settling when the first measure ran.
					remeasure();
				},
			});
		};

		const scheduleRemeasure = () => {
			if (rafRef.current !== null) {
				return;
			}
			rafRef.current = window.requestAnimationFrame(() => {
				rafRef.current = null;
				remeasure();
				startEntrance();
			});
		};

		remeasure();
		startEntrance();

		const onScroll = () => {
			paint();
		};
		port.addEventListener("scroll", onScroll, { passive: true });
		const uncollapse = collapse.on("change", paint);
		const resizeObserver = typeof ResizeObserver === "undefined"
			? null
			: new ResizeObserver(scheduleRemeasure);
		resizeObserver?.observe(port);
		const column = port.closest("[data-agent-session-column]");
		if (column !== null) {
			resizeObserver?.observe(column);
		}
		const mutationObserver = typeof MutationObserver === "undefined"
			? null
			: new MutationObserver(scheduleRemeasure);
		mutationObserver?.observe(port, {
			attributeFilter: ["data-marked", "data-session-drag-placeholder"],
			attributes: true,
			childList: true,
			subtree: true,
		});

		return () => {
			port.removeEventListener("scroll", onScroll);
			unsubscribeScrollActivity();
			uncollapse();
			resizeObserver?.disconnect();
			mutationObserver?.disconnect();
			if (rafRef.current !== null) {
				window.cancelAnimationFrame(rafRef.current);
				rafRef.current = null;
			}
			entranceControls?.stop();
			clearAgentSessionDeck(port);
			itemsRef.current = [];
			collapse.set(resolveAgentSessionDeckCollapse(presentationDeck, playedRef.current));
			willChange.set("auto");
		};
	}, [active, collapse, port, presentationDeck, willChange]);

	return ref;
}
