"use client";

import { Fragment, useState } from "react";
import {
	Checkpoint,
	CheckpointIcon,
	CheckpointTrigger,
} from "@/components/ui-custom/checkpoint";
import {
	Message,
	MessageContent,
	MessageResponse,
} from "@/components/ui-custom/message";
import {
	Conversation,
	ConversationContent,
} from "@/components/ui-custom/conversation";
import { FlagIcon, HistoryIcon } from "@/components/ui/vpk-icons";

type CheckpointEntry = {
	id: string;
	messageIndex: number;
	label: string;
};

const SAMPLE_MESSAGES = [
	{ id: "1", role: "user" as const, content: "Can you help me refactor this authentication module?" },
	{ id: "2", role: "assistant" as const, content: "Sure! I'll start by reviewing the current auth flow and suggesting improvements to the token refresh logic." },
	{ id: "3", role: "user" as const, content: "Sounds good. Let's also add support for OAuth providers." },
	{ id: "4", role: "assistant" as const, content: "I've updated the module to support Google and GitHub OAuth. The token refresh now uses a sliding window strategy with automatic retry." },
	{ id: "5", role: "user" as const, content: "Can we add rate limiting to the login endpoint?" },
	{ id: "6", role: "assistant" as const, content: "Done. I've added a rate limiter using a token bucket algorithm — 5 attempts per minute per IP with exponential backoff." },
];

export default function CheckpointDemo() {
	return <CheckpointDemoConversation />;
}

export function CheckpointDemoConversation() {
	const [messages, setMessages] = useState(SAMPLE_MESSAGES);
	const [checkpoints] = useState<CheckpointEntry[]>([
		{ id: "cp-1", messageIndex: 1, label: "Initial review" },
		{ id: "cp-2", messageIndex: 3, label: "OAuth added" },
	]);

	const restoreToCheckpoint = (messageIndex: number) => {
		setMessages(SAMPLE_MESSAGES.slice(0, messageIndex + 1));
	};

	return (
		<div className="relative flex max-w-2xl flex-col rounded-lg border border-border h-[420px]">
			<Conversation>
				<ConversationContent>
					{messages.map((message, index) => {
						const checkpoint = checkpoints.find(
							(cp) => cp.messageIndex === index
						);

						return (
							<Fragment key={message.id}>
								<Message from={message.role}>
									<MessageContent>
										<MessageResponse>{message.content}</MessageResponse>
									</MessageContent>
								</Message>
								{checkpoint ? <Checkpoint>
										<CheckpointIcon />
										<CheckpointTrigger
											onClick={() => restoreToCheckpoint(checkpoint.messageIndex)}
											tooltip={`Restore to: ${checkpoint.label}`}
										>
											Restore to &ldquo;{checkpoint.label}&rdquo;
										</CheckpointTrigger>
									</Checkpoint> : null}
							</Fragment>
						);
					})}
				</ConversationContent>
			</Conversation>
		</div>
	);
}

export function CheckpointDemoBasic() {
	return (
		<div className="flex w-full max-w-2xl flex-col gap-4">
			<Checkpoint>
				<CheckpointIcon />
				<CheckpointTrigger>Restore checkpoint</CheckpointTrigger>
			</Checkpoint>
		</div>
	);
}

export function CheckpointDemoWithTooltip() {
	return (
		<div className="flex w-full max-w-2xl flex-col gap-4">
			<Checkpoint>
				<CheckpointIcon />
				<CheckpointTrigger tooltip="Revert conversation to this point">
					Restore checkpoint
				</CheckpointTrigger>
			</Checkpoint>
		</div>
	);
}

export function CheckpointDemoCustomIcon() {
	return (
		<div className="flex w-full max-w-2xl flex-col gap-6">
			<Checkpoint>
				<CheckpointIcon>
					<FlagIcon className="size-4 shrink-0" />
				</CheckpointIcon>
				<CheckpointTrigger>Milestone reached</CheckpointTrigger>
			</Checkpoint>

			<Checkpoint>
				<CheckpointIcon>
					<HistoryIcon className="size-4 shrink-0" />
				</CheckpointIcon>
				<CheckpointTrigger>Restore previous state</CheckpointTrigger>
			</Checkpoint>
		</div>
	);
}
