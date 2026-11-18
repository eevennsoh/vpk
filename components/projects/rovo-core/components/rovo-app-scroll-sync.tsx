"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef } from "react";
import { useMessageScroller } from "@/components/ui/message-scroller";

export function RovoAppScrollAnchorSync({
	scrollAnchorMessageId,
}: Readonly<{
	scrollAnchorMessageId: string | null;
}>) {
	const { scrollToMessage } = useMessageScroller();
	const shouldReduceMotion = useReducedMotion();
	const didInitialScrollRef = useRef(false);
	useLayoutEffect(() => {
		if (!scrollAnchorMessageId) return;
		const behavior = !didInitialScrollRef.current || shouldReduceMotion ? "instant" : "smooth";
		didInitialScrollRef.current = true;
		scrollToMessage(scrollAnchorMessageId, { behavior, scrollMargin: 24 });
	}, [scrollAnchorMessageId, scrollToMessage, shouldReduceMotion]);

	return null;
}

export function RovoAppScrollActiveTracker({
	onActiveChange,
	scrollRef,
}: Readonly<{
	onActiveChange: (messageId: string | null) => void;
	scrollRef: React.RefObject<HTMLDivElement | null>;
}>) {
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

			const containerRect = container.getBoundingClientRect();
			const threshold = containerRect.top + containerRect.height * 0.3;
			const userMessageNodes = container.querySelectorAll<HTMLElement>("[data-message-id][data-role='user']");

			let activeId: string | null = null;
			for (const node of userMessageNodes) {
				const nodeRect = node.getBoundingClientRect();
				if (nodeRect.top <= threshold) {
					activeId = node.getAttribute("data-message-id");
				}
			}

			// When scrolled to top, prefer the first user message so it can still
			// become active when several messages sit above the threshold.
			if (userMessageNodes.length > 0 && container.scrollTop <= 10) {
				activeId = userMessageNodes[0].getAttribute("data-message-id");
			}

			onActiveChangeRef.current(activeId);
		}

		handleScroll();
		scrollElement.addEventListener("scroll", handleScroll, { passive: true });
		return () => scrollElement.removeEventListener("scroll", handleScroll);
	}, [scrollRef]);

	return null;
}
