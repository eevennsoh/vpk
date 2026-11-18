"use client";

import * as React from "react";
import ArrowUpIcon from "@atlaskit/icon/core/arrow-up";
import VideoStopIcon from "@atlaskit/icon/core/video-stop";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { UserMessageBubble } from "@/components/projects/shared/components/user-message-bubble";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Icon } from "@/components/ui/icon";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
import { Message, MessageContent } from "@/components/ui/message";
import {
	Marker,
	MarkerContent,
	MarkerIcon,
} from "@/components/ui/marker";
import {
	MessageScroller,
	MessageScrollerButton,
	MessageScrollerContent,
	MessageScrollerItem,
	MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Spinner } from "@/components/ui/spinner";
import { MotionMessageScrollerItem, slideUpEntrance } from "@/components/website/demos/ui/message-scroller-examples-shared";

type ChatStatus = "ready" | "submitted" | "streaming";

type ChatMessage = {
	id: string;
	role: "user" | "assistant";
	text: string;
};

const initialMessages: ChatMessage[] = [
	{
		id: "user-1",
		role: "user",
		text: "Hello there!",
	},
	{
		id: "assistant-1",
		role: "assistant",
		text: "Hey, how's it going?",
	},
	{
		id: "user-2",
		role: "user",
		text: `I'm prototyping an AI chat surface for our product docs.

Can you sketch a sensible component breakdown and call out anything I'd regret baking into v1?`,
	},
	{
		id: "assistant-2",
		role: "assistant",
		text: `Recommended layout

Treat the chat as three layers so scrolling and the composer never fight each other:

- Shell: card or page frame, title, status indicator
- Transcript: overflow-y-auto message list
- Composer: input group, send, stop

For v1, keep transport logic beside the example instead of in the shared components, make the transcript parent clip overflow, and pin the viewport to the bottom only while the user has not scrolled away.`,
	},
	{
		id: "user-3",
		role: "user",
		text: "What about message spacing when one reply is short and the next is really long?",
	},
	{
		id: "assistant-3",
		role: "assistant",
		text: `Good question. The scroll container should own vertical rhythm, not individual bubbles.

Use a consistent gap on the message list so short and long messages sit on the same grid. For assistant replies that span many paragraphs, keep everything in one bubble rather than splitting on every line break.

When a long reply streams in, pin the viewport to the bottom until the user scrolls up. If they've scrolled away, show a scroll-to-bottom affordance instead of yanking them back mid-read.`,
	},
];

const scriptedUserMessage: ChatMessage = {
	id: "user-4",
	role: "user",
	text: "Thanks, that helps.",
};

const scriptedAssistantMessage: ChatMessage = {
	id: "assistant-4",
	role: "assistant",
	text: "Happy to help. Send another message when you're ready to keep stepping through the demo.",
};

export default function MessageScrollerDemo() {
	return <MessageScrollerDemoChat />;
}

export function MessageScrollerDemoChat() {
	const [messages, setMessages] = React.useState<ChatMessage[]>(initialMessages);
	const [status, setStatus] = React.useState<ChatStatus>("ready");
	const isBusy = status === "submitted" || status === "streaming";
	const hasNextMessage = messages.length === initialMessages.length;

	React.useEffect(() => {
		if (status === "submitted") {
			const timer = window.setTimeout(() => setStatus("streaming"), 500);
			return () => window.clearTimeout(timer);
		}
		if (status === "streaming") {
			const timer = window.setTimeout(() => {
				setMessages((currentMessages) => [...currentMessages, scriptedAssistantMessage]);
				setStatus("ready");
			}, 600);
			return () => window.clearTimeout(timer);
		}
	}, [status]);

	function handleFormSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();

		if (!hasNextMessage || isBusy) {
			return;
		}

		setMessages((currentMessages) => [
			...currentMessages,
			scriptedUserMessage,
		]);
		setStatus("submitted");
	}

	function stop() {
		setStatus("ready");
	}

	return (
		<Card className="mx-auto h-[35rem] w-full max-w-xl gap-0">
			<CardHeader className="pb-4">
				<CardTitle>Chat</CardTitle>
			</CardHeader>
			<CardContent className="min-h-0 flex-1 overflow-hidden p-0">
				<MessageScroller autoScroll scrollPreviousItemPeek={0}>
					<MessageScrollerViewport role="group" aria-label="Chat messages">
						<MessageScrollerContent className="gap-6 px-4 py-6">
							{messages.map((message) =>
								message.role === "user" ? (
									<MotionMessageScrollerItem key={message.id} messageId={message.id} scrollAnchor {...slideUpEntrance}>
										<UserMessageBubble messageText={message.text} />
									</MotionMessageScrollerItem>
								) : (
									<MessageScrollerItem key={message.id} messageId={message.id}>
										<Message align="start">
											<MessageContent className="px-3">
												<Bubble variant="ghost">
													<BubbleContent className="whitespace-pre-wrap break-words text-sm leading-6 text-text">{message.text}</BubbleContent>
												</Bubble>
											</MessageContent>
										</Message>
									</MessageScrollerItem>
								),
							)}
							{status === "submitted" ? (
								<MessageScrollerItem scrollAnchor={false}>
									<Marker role="status">
										<MarkerIcon>
											<Spinner />
										</MarkerIcon>
										<MarkerContent>Thinking...</MarkerContent>
									</Marker>
								</MessageScrollerItem>
							) : null}
						</MessageScrollerContent>
					</MessageScrollerViewport>
					<MessageScrollerButton />
				</MessageScroller>
			</CardContent>
			<CardFooter>
				<form onSubmit={handleFormSubmit} className="w-full" id="chat-form">
					<InputGroup>
						<InputGroupTextarea
							placeholder="Ask me anything..."
							className="h-10 min-h-10 overflow-y-auto"
							value={isBusy || !hasNextMessage ? "" : scriptedUserMessage.text}
							readOnly
						/>
						<InputGroupAddon align="block-end" className="p-2">
							<InputGroupButton
								variant="default"
								size="icon-sm"
								type="submit"
								disabled={!hasNextMessage || isBusy}
								className="ml-auto data-[hidden=true]:hidden"
								data-hidden={isBusy}
							>
								<Icon className="size-4" render={<ArrowUpIcon label="" />} label="" />
								<span className="sr-only">Send</span>
							</InputGroupButton>
							<InputGroupButton
								size="icon-sm"
								type="button"
								data-hidden={!isBusy}
								className="ml-auto data-[hidden=true]:hidden"
								onClick={stop}
							>
								<Icon className="size-4" render={<VideoStopIcon label="" />} label="" />
								<span className="sr-only">Stop</span>
							</InputGroupButton>
						</InputGroupAddon>
					</InputGroup>
				</form>
			</CardFooter>
		</Card>
	);
}
