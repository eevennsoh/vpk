"use client";

import type { ReactNode } from "react";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Marker, MarkerContent } from "@/components/ui/marker";
import { Message, MessageContent, MessageHeader } from "@/components/ui/message";
import { MessageScroller, MessageScrollerButton, MessageScrollerContent, MessageScrollerItem, MessageScrollerViewport } from "@/components/ui/message-scroller";
import { MotionMessageScrollerItem, slideUpEntrance } from "@/components/website/demos/ui/message-scroller-examples-motion";

export type ExampleMessage = {
	id: string;
	role: "user" | "assistant" | "marker";
	text: string;
	anchor?: boolean;
	name?: string;
};

export const savedMessages: ExampleMessage[] = [
	{ id: "prompt-1", role: "user", text: "Review the incident handoff and tell me what to read first.", anchor: true },
	{ id: "reply-1", role: "assistant", text: "Start with the summary and impact. Processing was delayed, but every queued job recovered." },
	{ id: "prompt-2", role: "user", text: "What was the customer impact?", anchor: true },
	{ id: "reply-2", role: "assistant", text: "Two customers reported delayed downloads. No records were lost, and the retry batches completed successfully." },
	{ id: "prompt-3", role: "user", text: "What actions are still open?", anchor: true },
	{ id: "reply-3", role: "assistant", text: "Keep the retry window enabled until the next deploy. Then add a queue-depth alert and update the support guidance. Assign an owner to each follow-up so the handoff remains clear." },
	{ id: "prompt-4", role: "user", text: "Give me the follow-up checklist.", anchor: true },
	{ id: "reply-4", role: "assistant", text: "Compare recovery with the deploy timeline and confirm the retry settings. Record when processing returned to normal so support and engineering can answer the same questions.\n\nAdd a queue-depth alert that responds to sustained growth. Include a link to the dashboard and name an owner who can adjust the threshold.\n\nShare an update with support, including the symptoms customers might still see and the expected time for the backlog to clear.\n\nAfter the next batch completes, review the outcome with the team. Keep the retry window in place until the deployment is verified, then close the handoff with a short summary of the results.\n\nCheck the support queue again the following day and record whether any delayed downloads remain. If the alert fires, compare the queue graph with worker availability before changing the threshold." },
];

export function ExampleMessageContent({ message }: Readonly<{ message: ExampleMessage }>) {
	if (message.role === "marker") {
		return <Marker variant="separator"><MarkerContent>{message.text}</MarkerContent></Marker>;
	}
	const user = message.role === "user";
	return (
		<Message align={user ? "end" : "start"}>
			<MessageContent>
				{message.name ? <MessageHeader>{message.name}</MessageHeader> : null}
				<Bubble align={user ? "end" : "start"} variant={user ? "default" : "ghost"}>
					<BubbleContent className="whitespace-pre-wrap">{message.text}</BubbleContent>
				</Bubble>
			</MessageContent>
		</Message>
	);
}

/** The person's turns rise in from the live edge; replies and markers render in place. */
export function ExampleRows({ messages }: Readonly<{ messages: ReadonlyArray<ExampleMessage> }>) {
	return messages.map((message) =>
		message.role === "user" ? (
			<MotionMessageScrollerItem key={message.id} messageId={message.id} scrollAnchor={message.anchor} {...slideUpEntrance}>
				<ExampleMessageContent message={message} />
			</MotionMessageScrollerItem>
		) : (
			<MessageScrollerItem key={message.id} messageId={message.id} scrollAnchor={message.anchor}>
				<ExampleMessageContent message={message} />
			</MessageScrollerItem>
		),
	);
}

export function ExampleFrame({
	title,
	description,
	children,
	controls,
	autoScroll = false,
	busy = false,
	defaultScrollPosition = "end",
	scrollPreviousItemPeek,
}: Readonly<{
	title: string;
	description: string;
	children: ReactNode;
	controls?: ReactNode;
	autoScroll?: boolean;
	busy?: boolean;
	defaultScrollPosition?: "start" | "end" | "last-anchor";
	scrollPreviousItemPeek?: number;
}>) {
	return (
		<Card className="mx-auto h-[30rem] w-full max-w-xl">
			<CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader>
			<CardContent className="min-h-0 flex-1 overflow-hidden p-0">
				<MessageScroller autoScroll={autoScroll} defaultScrollPosition={defaultScrollPosition} scrollPreviousItemPeek={scrollPreviousItemPeek}>
					<div className="relative min-h-0 flex-1">
						<MessageScrollerViewport aria-label={`${title} messages`}>
							<MessageScrollerContent aria-busy={busy || undefined} className="gap-4 px-4 py-6">{children}</MessageScrollerContent>
						</MessageScrollerViewport>
						<MessageScrollerButton />
					</div>
					{controls ? <div className="flex shrink-0 flex-wrap items-center gap-3 border-t px-4 py-3">{controls}</div> : null}
				</MessageScroller>
			</CardContent>
		</Card>
	);
}
