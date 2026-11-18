"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";

import { createChat, getMessageText } from "@/lib/ai";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Message, MessageContent } from "@/components/ui/message";
import { Source, Sources, SourcesContent, SourcesTrigger } from "@/components/ui/sources";
import { TraceIcon, TraceLine, TraceTitle } from "@/components/ui/trace";
import { ArrowUpRightIcon } from "@/components/ui/vpk-icons";

const chat = createChat()
	.user("How do I start an Astro project with pnpm?")
	.assistant(({ writer }) => {
		writer.text(
			"Run pnpm create astro@latest and follow the prompts. It scaffolds the project and installs the dependencies.",
		);
		writer.sourceUrl({
			url: "https://docs.astro.build/en/install-and-setup/",
			title: "Install Astro | docs.astro.build",
		});
		writer.sourceUrl({
			url: "https://www.npmjs.com/package/create-astro",
			title: "create-astro | npmjs.com",
		});
		writer.sourceUrl({
			url: "https://docs.astro.build/en/install-and-setup/",
			title: "Install Astro | docs.astro.build",
		});
		writer.sourceUrl({
			url: "https://pnpm.io/cli/create",
			title: "pnpm create | pnpm.io",
		});
	});

const transcript = chat.get();
const [question] = chat.get(1);
const transport = chat.transport({ delayMs: 20 });

type SourcePart = Extract<UIMessage["parts"][number], { type: "source-url" }>;

function SourceList({ sources }: Readonly<{ sources: SourcePart[] }>) {
	return (
		<Sources defaultOpen>
			<SourcesTrigger count={sources.length} />
			<SourcesContent>
				{sources.map((source) => (
					<Source key={source.url} href={source.url}>
						<TraceLine>
							<TraceTitle>
								{source.title ?? new URL(source.url).hostname}
								<span className="sr-only"> (opens in a new tab)</span>
							</TraceTitle>
							<TraceIcon>
								<ArrowUpRightIcon label="" />
							</TraceIcon>
						</TraceLine>
					</Source>
				))}
			</SourcesContent>
		</Sources>
	);
}

export default function SourcesDemo() {
	const { messages, sendMessage, setMessages, status } = useChat({
		messages: transcript,
		transport,
	});
	const busy = status === "submitted" || status === "streaming";

	return (
		<div className="flex min-h-72 w-full max-w-sm flex-col gap-4 py-6 text-sm">
			{messages.map((message) => {
				if (message.role === "user") {
					return (
						<Message key={message.id} align="end">
							<MessageContent>
								<Bubble align="end">
									<BubbleContent>{getMessageText(message)}</BubbleContent>
								</Bubble>
							</MessageContent>
						</Message>
					);
				}

				const sources = message.parts
					.filter((part) => part.type === "source-url")
					.filter((part, index, all) => all.findIndex((other) => other.url === part.url) === index);
				const text = getMessageText(message);

				return (
					<Message key={message.id}>
						<MessageContent className="gap-4">
							{text ? <p>{text}</p> : null}
							{sources.length > 0 ? <SourceList sources={sources} /> : null}
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
