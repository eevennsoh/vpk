"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { Message, MessageContent } from "@/components/ui/message";
import { MessageUserBubble } from "@/components/ui-custom/message-user-bubble";
import { ChatTimelineNavigator } from "@/components/blocks/chat-timeline/chat-timeline-navigator";
import { cn } from "@/lib/utils";
import {
	CHAT_TIMELINE_DEMO_MESSAGES,
	type ChatTimelineMessage,
} from "@/components/blocks/chat-timeline/data/mock-thread";

export interface ChatTimelineProps {
	className?: string;
	messages?: ReadonlyArray<ChatTimelineMessage>;
}

function buildJumpTarget(container: HTMLElement, element: HTMLElement): number {
	const containerRect = container.getBoundingClientRect();
	const elementRect = element.getBoundingClientRect();
	const targetTop =
		container.scrollTop +
		(elementRect.top - containerRect.top) -
		Math.max(40, container.clientHeight * 0.18);

	return Math.max(0, Math.min(targetTop, container.scrollHeight - container.clientHeight));
}

export default function ChatTimeline({
	className,
	messages = CHAT_TIMELINE_DEMO_MESSAGES,
}: Readonly<ChatTimelineProps>) {
	const userMessages = useMemo(
		() => messages.filter((message) => message.role === "user"),
		[messages],
	);
	const timelineItems = [...userMessages].reverse().map((message, index) => ({
		id: message.id,
		label: `Prompt ${userMessages.length - index}`,
		text: message.text,
		timestampLabel: message.timestamp,
	}));
	const latestUserMessageId = userMessages.at(-1)?.id ?? null;
	const showTimeline = userMessages.length > 1;
	const shouldReduceMotion = useReducedMotion();
	const scrollContainerRef = useRef<HTMLDivElement | null>(null);
	const messageNodesRef = useRef<Record<string, HTMLDivElement | null>>({});
	const [scrollActiveId, setScrollActiveId] = useState<string | null>(() => userMessages[0]?.id ?? null);
	const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
	const activeSelectionId = scrollActiveId ?? latestUserMessageId;

	useEffect(() => {
		const container = scrollContainerRef.current;
		if (!container) return;

		function detectActiveMessage() {
			// Snap to first message at scroll top
			if (container!.scrollTop <= 10) {
				const firstId = userMessages[0]?.id ?? null;
				setScrollActiveId((prev) => (prev === firstId ? prev : firstId));
				return;
			}

			// Snap to last message at scroll bottom
			if (container!.scrollHeight - container!.scrollTop - container!.clientHeight <= 10) {
				const lastId = userMessages.at(-1)?.id ?? null;
				setScrollActiveId((prev) => (prev === lastId ? prev : lastId));
				return;
			}

			const containerRect = container!.getBoundingClientRect();
			const threshold = containerRect.top + containerRect.height * 0.3;

			let activeId = userMessages[0]?.id ?? null;
			for (const message of userMessages) {
				const node = messageNodesRef.current[message.id];
				if (!node) continue;

				const nodeRect = node.getBoundingClientRect();
				if (nodeRect.top <= threshold) {
					activeId = message.id;
				}
			}

			setScrollActiveId((prev) => (prev === activeId ? prev : activeId));
		}

		detectActiveMessage();

		container.addEventListener("scroll", detectActiveMessage, { passive: true });
		return () => container.removeEventListener("scroll", detectActiveMessage);
	}, [userMessages]);

	useEffect(() => {
		if (!highlightedMessageId) {
			return;
		}

		const timeoutId = window.setTimeout(() => {
			setHighlightedMessageId((current) =>
				current === highlightedMessageId ? null : current
			);
		}, 1800);

		return () => window.clearTimeout(timeoutId);
	}, [highlightedMessageId]);

	function handleSelectMessage(messageId: string) {
		const scrollContainer = scrollContainerRef.current;
		const messageNode = messageNodesRef.current[messageId];

		startTransition(() => {
			setHighlightedMessageId(messageId);
			setScrollActiveId(messageId);
		});

		if (!scrollContainer || !messageNode) {
			return;
		}

		scrollContainer.scrollTo({
			top: buildJumpTarget(scrollContainer, messageNode),
			behavior: shouldReduceMotion ? "auto" : "smooth",
		});
	}

	return (
		<div
			className={cn(
				"relative flex h-full flex-col overflow-hidden rounded-xl bg-background",
				className,
			)}
		>
			{showTimeline ? (
				<ChatTimelineNavigator
					activeItemId={activeSelectionId}
					className="absolute right-4 top-4 z-20 hidden md:block"
					items={timelineItems}
					onSelectItem={handleSelectMessage}
				/>
			) : null}

			<div
				className="flex-1 overflow-y-auto p-4 pb-20 pr-16"
				ref={scrollContainerRef}
			>
				<div className="mx-auto flex max-w-3xl flex-col gap-6">
					{messages.map((message) => {
						const isHighlighted = message.id === highlightedMessageId;

						return (
							<div
								className={cn(
									"transition-all duration-normal ease-out",
									isHighlighted
										? "rounded-xl ring-2 ring-border-selected ring-offset-2 ring-offset-background"
										: null,
								)}
								data-chat-timeline-message-id={message.id}
								key={message.id}
								ref={(node) => {
									messageNodesRef.current[message.id] = node;
								}}
							>
								<Message align={message.role === "user" ? "end" : "start"} className="cv-auto">
									{message.role === "user" ? (
										<MessageContent>
											<MessageUserBubble>{message.text}</MessageUserBubble>
										</MessageContent>
									) : (
										<MessageContent className="max-w-[80%]">{message.text}</MessageContent>
									)}
								</Message>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}

export type { ChatTimelineMessage } from "@/components/blocks/chat-timeline/data/mock-thread";
