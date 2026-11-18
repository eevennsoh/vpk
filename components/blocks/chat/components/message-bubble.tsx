"use client";

import type { ReactNode } from "react";
import { Message, MessageContent } from "@/components/ui/message";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import type { ChatMessage } from "../hooks/use-chat-submit";

interface MessageBubbleProps {
	message: ChatMessage;
}

export default function MessageBubble({ message }: Readonly<MessageBubbleProps>): ReactNode {
	const isUserMessage = message.type === "user";

	return (
		<Message align={isUserMessage ? "end" : "start"}>
			<MessageContent>
				<Bubble align={isUserMessage ? "end" : "start"} variant={isUserMessage ? "primary" : "outline"} className="max-w-[85%]">
					<BubbleContent className="whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-6">{message.content}</BubbleContent>
				</Bubble>
			</MessageContent>
		</Message>
	);
}
