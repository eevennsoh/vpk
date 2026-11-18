"use client";

import { Fragment, useState } from "react";

import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Checkpoint, CheckpointTrigger } from "@/components/ui/checkpoint";
import { Message, MessageContent } from "@/components/ui/message";

type DemoMessage = {
	id: string;
	role: "user" | "assistant";
	text: string;
	checkpoint?: string;
};

const TRANSCRIPT: ReadonlyArray<DemoMessage> = [
	{ id: "u1", role: "user", text: "Rename the button component to action." },
	{
		id: "a1",
		role: "assistant",
		text: "Renamed Button to Action in components/ui/button.tsx.",
		checkpoint: "Button renamed",
	},
	{ id: "u2", role: "user", text: "Update the docs to match." },
	{ id: "a2", role: "assistant", text: "Updated the Button page to say Action." },
];

export default function CheckpointDemo() {
	const [messages, setMessages] = useState<ReadonlyArray<DemoMessage>>(TRANSCRIPT);
	const nextTurn = TRANSCRIPT.slice(messages.length, messages.length + 2);

	const restore = (messageId: string) => {
		const index = messages.findIndex((message) => message.id === messageId);
		if (index === -1) {
			return;
		}
		setMessages(messages.slice(0, index + 1));
	};

	return (
		<div className="flex min-h-72 w-full max-w-sm flex-col gap-4 py-6 text-sm">
			{messages.map((message, index) => {
				const canRestore = index < messages.length - 1;

				return (
					<Fragment key={message.id}>
						{message.role === "user" ? (
							<Message align="end">
								<MessageContent>
									<Bubble align="end" variant="muted">
										<BubbleContent>{message.text}</BubbleContent>
									</Bubble>
								</MessageContent>
							</Message>
						) : (
							<Message>
								<MessageContent>
									<p>{message.text}</p>
								</MessageContent>
							</Message>
						)}
						{message.checkpoint ? (
							<Checkpoint>
								{message.checkpoint}
								{canRestore ? (
									<CheckpointTrigger
										aria-label={`Restore to ${message.checkpoint}`}
										onClick={() => restore(message.id)}
									>
										Restore
									</CheckpointTrigger>
								) : null}
							</Checkpoint>
						) : null}
					</Fragment>
				);
			})}
			{nextTurn.length > 0 ? (
				<Button
					variant="outline"
					className="mt-auto self-start"
					onClick={() => setMessages([...messages, ...nextTurn])}
				>
					Continue
				</Button>
			) : null}
		</div>
	);
}
