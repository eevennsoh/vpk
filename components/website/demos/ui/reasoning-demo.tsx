"use client";

import { useChat } from "@ai-sdk/react";

import { createChat, getMessageText } from "@/lib/ai";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Message, MessageContent } from "@/components/ui/message";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ui/reasoning";

const chat = createChat()
	.user("Why is the checkout deploy so slow?")
	.assistant(({ writer }) => {
		writer.reasoning(
			"The deploy log has three phases. Install takes 38s and next build takes 52s, both normal for this repo.\n\nImage optimization takes 3m 50s. It reruns on every deploy because its cache key includes the commit hash, so the cache never hits.",
			{ delayMs: 40 },
		);
		writer.sleep(400);
		writer.text(
			"Image optimization is the bottleneck. Key its cache on the lockfile and the image directory instead of the commit hash, and the deploy should take under two minutes.",
		);
	});

const transcript = chat.get();
const [question] = chat.get(1);
const transport = chat.transport({ delayMs: 20 });

function ReasoningRow({
	text,
	running,
	defaultOpen,
}: Readonly<{ text: string; running: boolean; defaultOpen?: boolean }>) {
	return (
		<Reasoning isStreaming={running} defaultOpen={defaultOpen} duration={running ? undefined : 5}>
			<ReasoningTrigger showChevron={text.length > 0} />
			{text ? <ReasoningContent>{text}</ReasoningContent> : null}
		</Reasoning>
	);
}

export default function ReasoningDemo() {
	const { messages, sendMessage, setMessages, status } = useChat({
		messages: transcript,
		transport,
	});
	const busy = status === "submitted" || status === "streaming";

	return (
		<div className="flex min-h-72 mx-auto w-full max-w-sm flex-col gap-4 py-6 text-sm">
			{messages.map((message) => {
				if (message.role === "user") {
					return (
						<Message key={message.id} align="end">
							<MessageContent>
								<Bubble align="end" variant="muted">
									<BubbleContent>{getMessageText(message)}</BubbleContent>
								</Bubble>
							</MessageContent>
						</Message>
					);
				}

				const streaming = busy && message === messages.at(-1);
				const reasoning = message.parts.filter((part) => part.type === "reasoning");
				const text = getMessageText(message);

				return (
					<Message key={message.id}>
						<MessageContent className="gap-4">
							{reasoning.map((part, index) => (
								<ReasoningRow
									// oxlint-disable-next-line react/no-array-index-key -- Reasoning parts have no id; their order is stable.
									key={index}
									text={part.text}
									running={streaming && part.state === "streaming"}
									defaultOpen={busy ? undefined : true}
								/>
							))}
							{text ? <p>{text}</p> : null}
						</MessageContent>
					</Message>
				);
			})}
			{busy ? null : (
				<Button
					variant="outline"
					className="mt-auto self-start"
					onClick={() => {
						setMessages([]);
						void sendMessage(question);
					}}
				>
					Replay
				</Button>
			)}
		</div>
	);
}

export function ReasoningDemoDuration() {
	return (
		<div className="mx-auto w-full max-w-sm">
			<Reasoning duration={12}>
				<ReasoningTrigger />
				<ReasoningContent>
					The build log shows install and compile finish in under a minute. Image optimization takes almost four, and it
					reruns on every deploy because the cache key includes the commit hash.
				</ReasoningContent>
			</Reasoning>
		</div>
	);
}

export function ReasoningDemoStreaming() {
	return (
		<div className="mx-auto w-full max-w-sm">
			<Reasoning isStreaming>
				<ReasoningTrigger />
				<ReasoningContent>
					{"The deploy log has three phases. Install and next build are normal for this repo.\n\nImage optimization reruns on every deploy"}
				</ReasoningContent>
			</Reasoning>
		</div>
	);
}

export function ReasoningDemoTimeline() {
	return (
		<div className="mx-auto w-full max-w-sm">
			<Reasoning defaultOpen duration={4}>
				<ReasoningTrigger />
				<ReasoningContent>
					{"Invoking search\nUsing Confluence search\nTool call failed: mcp_atlassian_mcp__invoke_tool"}
				</ReasoningContent>
			</Reasoning>
		</div>
	);
}
