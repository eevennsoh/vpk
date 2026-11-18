"use client";

import { useState, type ReactNode } from "react";
import { useChat } from "@ai-sdk/react";
import type { UIDataTypes, UIMessage } from "ai";
import CheckCircleIcon from "@atlaskit/icon/core/check-circle";
import StatusErrorIcon from "@atlaskit/icon/core/status-error";

import { createChat, getMessageText } from "@/lib/ai";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
	ChainOfThought,
	ChainOfThoughtContent,
	ChainOfThoughtHeader,
	ChainOfThoughtSearchResult,
	ChainOfThoughtSearchResults,
	ChainOfThoughtStep,
} from "@/components/ui/chain-of-thought";
import { CodeBlock, CodeBlockContent } from "@/components/ui/code-block";
import { Message, MessageContent } from "@/components/ui/message";
import { Spinner } from "@/components/ui/spinner";

type ChatMessage = UIMessage<
	unknown,
	UIDataTypes,
	{
		searchWeb: {
			input: { query: string };
			output: { results: { title: string; url: string }[] };
		};
		readBuildLog: {
			input: { deployment: string };
			output: { log: string };
		};
		searchCode: {
			input: { query: string };
			output: { files: string[] };
		};
	}
>;

type StepPart = Extract<
	ChatMessage["parts"][number],
	{ type: "tool-searchWeb" | "tool-readBuildLog" | "tool-searchCode" }
>;

type StepState = "running" | "error" | "done";

const chat = createChat<ChatMessage>()
	.user("Why is the checkout deploy so slow?")
	.assistant(({ writer }) => {
		writer
			.tool("readBuildLog", { input: { deployment: "dpl_8Kx2" } })
			.sleep(900)
			.output({ log: "install    41s\ncompile    38s\nimages   3m 52s" });
		writer
			.tool("searchWeb", { input: { query: "next.js image cache key" } })
			.sleep(900)
			.output({
				results: [
					{
						title: "Image component | nextjs.org",
						url: "https://nextjs.org/docs/app/api-reference/components/image",
					},
					{
						title: "Build cache | vercel.com",
						url: "https://vercel.com/docs/deployments/troubleshoot-a-build",
					},
				],
			});
		writer
			.tool("searchCode", { input: { query: "cacheKey" } })
			.sleep(900)
			.output({ files: ["next.config.ts", "scripts/optimize-images.ts"] });
		writer.text(
			"Image optimization takes almost four minutes because its cache key includes the commit hash. Key it on the image directory instead.",
		);
	});

const transcript = chat.get();
const [question] = chat.get(1);
const transport = chat.transport({ delayMs: 20 });

function Step({
	title,
	state,
	defaultOpen,
	children,
}: Readonly<{
	title: string;
	state: StepState;
	defaultOpen?: boolean;
	children?: ReactNode;
}>) {
	return (
		<ChainOfThoughtStep
			collapsible={children != null}
			defaultOpen={defaultOpen}
			description={null}
			icon={state === "error" ? StatusErrorIcon : CheckCircleIcon}
			iconRender={state === "running" ? <Spinner label={title} /> : undefined}
			label={title}
			status={state === "running" ? "active" : "complete"}
		>
			{children}
		</ChainOfThoughtStep>
	);
}

function getStepState(part: StepPart, streaming: boolean): StepState {
	if (part.state === "output-available") {
		return "done";
	}
	return part.state === "output-error" || !streaming ? "error" : "running";
}

function StepRow({ part, streaming }: Readonly<{ part: StepPart; streaming: boolean }>) {
	const state = getStepState(part, streaming);
	const verb = (running: string, done: string, failed: string) =>
		state === "running" ? running : state === "error" ? failed : done;
	const error =
		part.state === "output-error" ? (
			<CodeBlock size="sm" variant="destructive">
				<CodeBlockContent wrap className="max-h-64">
					{part.errorText}
				</CodeBlockContent>
			</CodeBlock>
		) : null;

	if (part.type === "tool-searchWeb") {
		return (
			<Step state={state} title={`${verb("Searching", "Searched", "Failed to search")} the web for ${part.input?.query}`}>
				{error ??
					(part.state === "output-available" ? (
						<ChainOfThoughtSearchResults>
							{part.output.results.map((result) => (
								<ChainOfThoughtSearchResult key={result.url}>{new URL(result.url).hostname}</ChainOfThoughtSearchResult>
							))}
						</ChainOfThoughtSearchResults>
					) : null)}
			</Step>
		);
	}

	if (part.type === "tool-readBuildLog") {
		return (
			<Step
				defaultOpen
				state={state}
				title={`${verb("Reading", "Read", "Failed to read")} the build log for ${part.input?.deployment}`}
			>
				{error ??
					(part.state === "output-available" ? (
						<CodeBlock size="sm">
							<CodeBlockContent wrap className="max-h-64">
								{part.output.log}
							</CodeBlockContent>
						</CodeBlock>
					) : null)}
			</Step>
		);
	}

	return (
		<Step state={state} title={`${verb("Searching", "Searched", "Failed to search")} the code for ${part.input?.query}`}>
			{error ??
				(part.state === "output-available" ? (
					<ChainOfThoughtSearchResults>
						{part.output.files.map((file) => (
							<ChainOfThoughtSearchResult key={file} className="font-mono">
								{file}
							</ChainOfThoughtSearchResult>
						))}
					</ChainOfThoughtSearchResults>
				) : null)}
		</Step>
	);
}

function ResearchTrace({
	steps,
	streaming,
	answering,
}: Readonly<{
	steps: StepPart[];
	streaming: boolean;
	answering: boolean;
}>) {
	const [open, setOpen] = useState<boolean>();
	const running = streaming && !answering;
	const failed = steps.filter((part) => part.state === "output-error").length;

	return (
		<ChainOfThought open={open ?? running} onOpenChange={setOpen}>
			<ChainOfThoughtHeader state={running ? "thinking" : "completed"}>
				{running
					? "Researching"
					: `Researched in ${steps.length} steps${failed > 0 ? `, ${failed} failed` : ""}`}
			</ChainOfThoughtHeader>
			<ChainOfThoughtContent>
				{steps.map((part) => (
					<StepRow key={part.toolCallId} part={part} streaming={streaming} />
				))}
			</ChainOfThoughtContent>
		</ChainOfThought>
	);
}

export default function ChainOfThoughtDemo() {
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
								<Bubble align="end" variant="muted">
									<BubbleContent>{getMessageText(message)}</BubbleContent>
								</Bubble>
							</MessageContent>
						</Message>
					);
				}

				const streaming = busy && message === messages.at(-1);
				const steps = message.parts.filter(
					(part): part is StepPart =>
						part.type === "tool-searchWeb" ||
						part.type === "tool-readBuildLog" ||
						part.type === "tool-searchCode",
				);
				const text = getMessageText(message);

				return (
					<Message key={message.id}>
						<MessageContent className="gap-4">
							{steps.length > 0 ? (
								<ResearchTrace steps={steps} streaming={streaming} answering={text.length > 0} />
							) : null}
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

export function ChainOfThoughtDemoUsage() {
	return (
		<div className="w-full max-w-sm py-6">
			<ChainOfThought defaultOpen>
				<ChainOfThoughtHeader state="completed">Researched in 3 steps</ChainOfThoughtHeader>
				<ChainOfThoughtContent>
					<ChainOfThoughtStep icon={CheckCircleIcon} label="Read the build log for dpl_8Kx2" description={null} />
					<ChainOfThoughtStep icon={CheckCircleIcon} label="Searched the web for next.js image cache key" description={null} />
					<ChainOfThoughtStep icon={CheckCircleIcon} label="Searched the code for cacheKey" description={null} />
				</ChainOfThoughtContent>
			</ChainOfThought>
		</div>
	);
}

export function ChainOfThoughtDemoSteps() {
	return (
		<div className="w-full max-w-sm py-6">
			<ChainOfThought defaultOpen>
				<ChainOfThoughtHeader state="thinking">Researching</ChainOfThoughtHeader>
				<ChainOfThoughtContent>
					<Step state="running" title="Searching for next.js image cache key" />
					<Step state="done" title="Searched for cacheKey">
						<ChainOfThoughtSearchResults>
							<ChainOfThoughtSearchResult className="font-mono">next.config.ts</ChainOfThoughtSearchResult>
						</ChainOfThoughtSearchResults>
					</Step>
					<ChainOfThoughtStep
						description={null}
						icon={CheckCircleIcon}
						label={
							<a
								className="underline-offset-3 hover:underline"
								href="https://nextjs.org/docs/app/api-reference/components/image"
								rel="noreferrer"
								target="_blank"
							>
								Read the Image component docs
								<span className="sr-only"> (opens in a new tab)</span>
							</a>
						}
					/>
					<Step state="error" title="Failed to search for build cache docs" />
				</ChainOfThoughtContent>
			</ChainOfThought>
		</div>
	);
}
