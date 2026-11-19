"use client";

import { useEffect, useRef, type RefObject } from "react";

/** Distance from a scroll edge, in px, that still counts as being at that edge. */
const SCROLL_EDGE_TOLERANCE_PX = 10;
/** A message becomes active once its top crosses this fraction of the viewport height. */
const ACTIVE_LINE_RATIO = 0.3;

export interface ScrollActiveMessageNode {
	id: string;
	node: HTMLElement;
}

export interface ScrollActiveMessageOptions {
	/** Report the last message while the viewport sits at its scroll end. */
	snapToEnd?: boolean;
	/** What to report when no message has crossed the active line yet. */
	fallback?: "none" | "first";
}

/**
 * The message a scroll-linked navigator should highlight: the last one whose top has crossed 30% of the viewport,
 * the first one while the viewport sits at its scroll start, and optionally the last one at its scroll end.
 */
export function resolveScrollActiveMessageId(
	container: HTMLElement,
	messages: ReadonlyArray<ScrollActiveMessageNode>,
	{ snapToEnd = false, fallback = "none" }: Readonly<ScrollActiveMessageOptions> = {},
): string | null {
	if (container.scrollTop <= SCROLL_EDGE_TOLERANCE_PX) {
		return messages[0]?.id ?? null;
	}

	if (snapToEnd && container.scrollHeight - container.scrollTop - container.clientHeight <= SCROLL_EDGE_TOLERANCE_PX) {
		return messages.at(-1)?.id ?? null;
	}

	const containerRect = container.getBoundingClientRect();
	const activeLine = containerRect.top + containerRect.height * ACTIVE_LINE_RATIO;
	let activeId = fallback === "first" ? (messages[0]?.id ?? null) : null;
	for (const message of messages) {
		if (message.node.getBoundingClientRect().top <= activeLine) {
			activeId = message.id;
		}
	}
	return activeId;
}

export interface UseScrollActiveMessageOptions extends ScrollActiveMessageOptions {
	scrollRef: RefObject<HTMLElement | null>;
	/** Returns the navigable messages in document order. A new function re-attaches the listener and re-resolves. */
	getMessages: (container: HTMLElement) => ReadonlyArray<ScrollActiveMessageNode>;
	onActiveChange: (messageId: string | null) => void;
}

/** Reports the scroll-active message on mount and on every scroll of `scrollRef`. */
export function useScrollActiveMessage({
	scrollRef,
	getMessages,
	onActiveChange,
	snapToEnd,
	fallback,
}: Readonly<UseScrollActiveMessageOptions>): void {
	const onActiveChangeRef = useRef(onActiveChange);

	useEffect(() => {
		onActiveChangeRef.current = onActiveChange;
	});

	useEffect(() => {
		const scrollElement = scrollRef.current;
		if (!scrollElement) return;

		function handleScroll() {
			const container = scrollRef.current;
			if (!container) return;
			onActiveChangeRef.current(resolveScrollActiveMessageId(container, getMessages(container), { snapToEnd, fallback }));
		}

		handleScroll();
		scrollElement.addEventListener("scroll", handleScroll, { passive: true });
		return () => scrollElement.removeEventListener("scroll", handleScroll);
	}, [fallback, getMessages, scrollRef, snapToEnd]);
}
