"use client";

import { useReducedMotion } from "motion/react";
import { useLayoutEffect, useRef } from "react";
import { useMessageScroller } from "@/components/ui/message-scroller";
import { type ScrollActiveMessageNode, useScrollActiveMessage } from "@/components/projects/shared/hooks/use-scroll-active-message";

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
	useScrollActiveMessage({ getMessages: getRovoUserMessageNodes, onActiveChange, scrollRef });

	return null;
}

function getRovoUserMessageNodes(container: HTMLElement): ScrollActiveMessageNode[] {
	return Array.from(container.querySelectorAll<HTMLElement>("[data-message-id][data-role='user']"), (node) => ({
		id: node.getAttribute("data-message-id") ?? "",
		node,
	}));
}
