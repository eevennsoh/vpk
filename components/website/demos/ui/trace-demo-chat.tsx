"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import type { DynamicToolUIPart, UIDataTypes, UIMessage } from "ai";

import { createChat, getMessageText } from "@/lib/ai";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { CodeBlock, CodeBlockContent } from "@/components/ui/code-block";
import { Message, MessageContent } from "@/components/ui/message";
import {
	Trace,
	TraceCollapsible,
	TraceCollapsibleContent,
	TraceCollapsibleTrigger,
	TraceIcon,
	TraceLine,
	TraceTitle,
} from "@/components/ui/trace";
import {
	ArrowUpRightIcon,
	BrainIcon,
	CircleAlertIcon,
	CircleCheckIcon,
	GlobeIcon,
	LoaderCircleIcon,
	TerminalIcon,
} from "@/components/ui/vpk-icons";

type ChatMessage = UIMessage<
	unknown,
	UIDataTypes,
	{
		runCommand: {
			input: { command: string };
			output: { stdout: string };
		};
	}
>;

type Part = ChatMessage["parts"][number];

const mainChat = createChat<ChatMessage>()
	.user("Why does pnpm install fail in CI?")
	.assistant(({ writer }) => {
		writer.reasoning(
			"CI installs with a frozen lockfile, so the install stops when package.json and pnpm-lock.yaml disagree. I should check what the last commit changed, then reproduce the install.",
			{ delayMs: 40 },
		);
		writer
			.tool("runCommand", { input: { command: "pnpm --version" } })
			.sleep(700)
			.output({ stdout: "10.18.0" });
		writer
			.tool("runCommand", {
				input: {
					command: "git diff --stat HEAD~1 -- package.json pnpm-lock.yaml",
				},
			})
			.sleep(900)
			.output({
				stdout: " package.json | 2 +-\n 1 file changed, 1 insertion(+), 1 deletion(-)",
			});
		writer
			.tool("runCommand", {
				input: { command: "pnpm install --frozen-lockfile" },
			})
			.sleep(1200)
			.error(
				'ERR_PNPM_OUTDATED_LOCKFILE  Cannot install with "frozen-lockfile" because pnpm-lock.yaml is not up to date with package.json',
			);
		writer.sourceUrl({
			url: "https://pnpm.io/cli/install#--frozen-lockfile",
			title: "pnpm install | pnpm.io",
		});
		writer.sourceUrl({
			url: "https://pnpm.io/continuous-integration",
			title: "Continuous Integration | pnpm.io",
		});
		writer.sleep(1000);
		writer.text(
			"The last commit bumped a version in package.json without updating pnpm-lock.yaml, so the frozen install fails. Run pnpm install locally and commit the lockfile.",
		);
	});

const mainTranscript = mainChat.get();
const [mainQuestion] = mainChat.get(1);
const mainTransport = mainChat.transport({ delayMs: 20 });

function ThinkingRow({ text, running }: Readonly<{ text: string; running: boolean }>) {
	const [open, setOpen] = useState<boolean>();

	const line = (
		<TraceLine status={running ? "running" : undefined}>
			<TraceIcon>
				{running ? <LoaderCircleIcon label="" className="animate-spin" /> : <CircleCheckIcon label="" />}
			</TraceIcon>
			<TraceTitle>{running ? "Thinking" : "Thought for 5s"}</TraceTitle>
		</TraceLine>
	);

	if (text.length === 0) {
		return line;
	}

	return (
		<TraceCollapsible open={open ?? running} onOpenChange={setOpen}>
			<TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
			<TraceCollapsibleContent className="whitespace-pre-wrap">{text}</TraceCollapsibleContent>
		</TraceCollapsible>
	);
}

function ToolRow({
	part,
	streaming,
	defaultOpen,
}: Readonly<{
	part: Extract<Part, { type: "tool-runCommand" }>;
	streaming: boolean;
	defaultOpen?: boolean;
}>) {
	const command = part.input?.command;

	if (part.state === "output-available" || part.state === "output-error") {
		const failed = part.state === "output-error";

		return (
			<TraceCollapsible defaultOpen={defaultOpen}>
				<TraceCollapsibleTrigger>
					<TraceLine status={failed ? "error" : undefined}>
						<TraceIcon>{failed ? <CircleAlertIcon label="" /> : <CircleCheckIcon label="" />}</TraceIcon>
						<TraceTitle>
							{failed ? "Failed to run" : "Ran"} {command}
						</TraceTitle>
					</TraceLine>
				</TraceCollapsibleTrigger>
				<TraceCollapsibleContent>
					{failed ? (
						<CodeBlock size="sm" variant="destructive">
							<CodeBlockContent wrap className="max-h-64">
								{part.errorText}
							</CodeBlockContent>
						</CodeBlock>
					) : (
						<CodeBlock size="sm">
							<CodeBlockContent wrap className="max-h-64">
								{part.output.stdout}
							</CodeBlockContent>
						</CodeBlock>
					)}
				</TraceCollapsibleContent>
			</TraceCollapsible>
		);
	}

	return (
		<TraceLine status={streaming ? "running" : "error"}>
			<TraceIcon>
				{streaming ? <LoaderCircleIcon label="" className="animate-spin" /> : <CircleAlertIcon label="" />}
			</TraceIcon>
			<TraceTitle>
				{streaming ? "Running" : "Failed to run"} {command}
			</TraceTitle>
		</TraceLine>
	);
}

function SourcesRow({
	sources: sourceParts,
	running,
}: Readonly<{
	sources: Extract<Part, { type: "source-url" }>[];
	running: boolean;
}>) {
	return (
		<TraceCollapsible>
			<TraceCollapsibleTrigger>
				<TraceLine status={running ? "running" : undefined}>
					<TraceIcon>
						{running ? <LoaderCircleIcon label="" className="animate-spin" /> : <GlobeIcon label="" />}
					</TraceIcon>
					<TraceTitle>
						{running ? "Using" : "Used"} {sourceParts.length} sources
					</TraceTitle>
				</TraceLine>
			</TraceCollapsibleTrigger>
			<TraceCollapsibleContent>
				<Trace>
					{sourceParts.map((source) => (
						<a key={source.url} href={source.url} target="_blank" rel="noreferrer">
							<TraceLine>
								<TraceIcon>
									<GlobeIcon label="" />
								</TraceIcon>
								<TraceTitle>
									{source.title ?? new URL(source.url).hostname}
									<span className="sr-only"> (opens in a new tab)</span>
								</TraceTitle>
								<TraceIcon>
									<ArrowUpRightIcon label="" />
								</TraceIcon>
							</TraceLine>
						</a>
					))}
				</Trace>
			</TraceCollapsibleContent>
		</TraceCollapsible>
	);
}

export default function TraceDemo() {
	const { messages, sendMessage, setMessages, status } = useChat({
		messages: mainTranscript,
		transport: mainTransport,
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

				const streaming = busy && message === messages.at(-1);
				const rows = message.parts.filter(
					(part) => part.type === "reasoning" || part.type === "tool-runCommand",
				);
				const sourceParts = message.parts.filter((part) => part.type === "source-url");
				const text = getMessageText(message);

				return (
					<Message key={message.id}>
						<MessageContent className="gap-4">
							{rows.length + sourceParts.length > 0 ? (
								<Trace>
									{rows.map((part, index) =>
										part.type === "reasoning" ? (
											<ThinkingRow
												key={index}
												text={part.text}
												running={streaming && part.state === "streaming"}
											/>
										) : part.type === "tool-runCommand" ? (
											<ToolRow
												key={part.toolCallId}
												part={part}
												streaming={streaming}
												defaultOpen={index === 2}
											/>
										) : null,
									)}
									{sourceParts.length > 0 ? (
										<SourcesRow sources={sourceParts} running={streaming && text.length === 0} />
									) : null}
								</Trace>
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
						void sendMessage(mainQuestion);
					}}
				>
					Replay
				</Button>
			)}
		</div>
	);
}

const chat = createChat()
	.user("Why is the checkout deploy so slow?")
	.assistant(({ writer }) => {
		writer.reasoning(
			"The build log shows install and compile finish in under a minute. Image optimization takes almost four, and it reruns on every deploy because the cache key includes the commit hash.",
			{ delayMs: 60 },
		);
		writer.sleep(400);
		writer.text(
			"Image optimization is the bottleneck. Key its cache on the lockfile and the image directory instead of the commit hash.",
		);
	});

const initialMessages = chat.get(0);
const transport = chat.transport({ delayMs: 20 });

function ThinkingTrace({ text, running }: Readonly<{ text: string; running: boolean }>) {
	const [open, setOpen] = useState<boolean>();

	const line = (
		<TraceLine status={running ? "running" : undefined}>
			<TraceIcon>
				<BrainIcon label="" />
			</TraceIcon>
			<TraceTitle>{running ? "Thinking" : "Thought"}</TraceTitle>
		</TraceLine>
	);

	if (text.length === 0) {
		return line;
	}

	return (
		<TraceCollapsible open={open ?? running} onOpenChange={setOpen}>
			<TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
			<TraceCollapsibleContent className="whitespace-pre-wrap">{text}</TraceCollapsibleContent>
		</TraceCollapsible>
	);
}

function groupParts(parts: UIMessage["parts"], traceType: "reasoning" | "dynamic-tool") {
	const runs: { trace: boolean; parts: UIMessage["parts"] }[] = [];

	for (const part of parts) {
		const trace = part.type === traceType;

		if (!trace && part.type !== "text") {
			continue;
		}

		const last = runs.at(-1);

		if (last?.trace === trace) {
			last.parts.push(part);
		} else {
			runs.push({ trace, parts: [part] });
		}
	}

	return runs;
}

export function TraceThinking() {
	const { messages, sendMessage, setMessages, status } = useChat({
		messages: initialMessages,
		transport,
	});
	const nextMessage = chat.next(messages);
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

				const live = status === "streaming" && message === messages.at(-1);

				return (
					<Message key={message.id}>
						<MessageContent className="gap-4">
							{groupParts(message.parts, "reasoning").map((run, runIndex) =>
								run.trace ? (
									<Trace key={runIndex}>
										{run.parts.map((part, index) =>
											part.type === "reasoning" ? (
												<ThinkingTrace
													key={index}
													text={part.text}
													running={live && part.state === "streaming"}
												/>
											) : null,
										)}
									</Trace>
								) : (
									run.parts.map((part, index) =>
										part.type === "text" ? <p key={`${runIndex}-${index}`}>{part.text}</p> : null,
									)
								),
							)}
						</MessageContent>
					</Message>
				);
			})}
			{busy ? null : (
				<Button
					variant="outline"
					className="mt-auto self-start"
					onClick={() => (nextMessage ? sendMessage(nextMessage) : setMessages(initialMessages))}
				>
					{nextMessage ? "Send message" : "Reset"}
				</Button>
			)}
		</div>
	);
}

const toolChat = createChat()
	.user("Which package managers are installed?")
	.assistant(({ writer }) => {
		writer
			.tool("runCommand", {
				dynamic: true,
				input: { command: "node --version" },
			})
			.sleep(900)
			.output({ stdout: "v24.18.0" });
		writer
			.tool("runCommand", {
				dynamic: true,
				input: { command: "npm --version" },
			})
			.sleep(900)
			.output({ stdout: "11.6.2" });
		writer
			.tool("runCommand", {
				dynamic: true,
				input: { command: "pnpm --version" },
			})
			.sleep(900)
			.error("command not found: pnpm");
		writer.text("Node 24 and npm 11 are installed. pnpm is not.");
	});

const toolInitialMessages = toolChat.get(0);
const toolTransport = toolChat.transport({ delayMs: 20 });

function ToolTrace({ part, live }: Readonly<{ part: DynamicToolUIPart; live: boolean }>) {
	const command = (part.input as { command?: string } | undefined)?.command;

	if (part.state === "output-available" || part.state === "output-error") {
		const failed = part.state === "output-error";

		return (
			<TraceCollapsible>
				<TraceCollapsibleTrigger>
					<TraceLine status={failed ? "error" : undefined}>
						<TraceIcon>
							<TerminalIcon label="" />
						</TraceIcon>
						<TraceTitle>
							{failed ? "Failed to run" : "Ran"} {command}
						</TraceTitle>
					</TraceLine>
				</TraceCollapsibleTrigger>
				<TraceCollapsibleContent>
					<CodeBlock size="sm">
						<CodeBlockContent wrap className="max-h-64">
							{failed ? part.errorText : (part.output as { stdout: string }).stdout}
						</CodeBlockContent>
					</CodeBlock>
				</TraceCollapsibleContent>
			</TraceCollapsible>
		);
	}

	if (part.state === "output-denied") {
		return (
			<TraceLine>
				<TraceIcon>
					<TerminalIcon label="" />
				</TraceIcon>
				<TraceTitle>Denied {command}</TraceTitle>
			</TraceLine>
		);
	}

	return (
		<TraceLine status={live ? "running" : "error"}>
			<TraceIcon>
				<TerminalIcon label="" />
			</TraceIcon>
			<TraceTitle>
				{live ? "Running" : "Failed to run"} {command}
			</TraceTitle>
		</TraceLine>
	);
}

export function TraceToolCalls() {
	const { messages, sendMessage, setMessages, status } = useChat({
		messages: toolInitialMessages,
		transport: toolTransport,
	});
	const nextMessage = toolChat.next(messages);
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

				const live = status === "streaming" && message === messages.at(-1);

				return (
					<Message key={message.id}>
						<MessageContent className="gap-4">
							{groupParts(message.parts, "dynamic-tool").map((run, runIndex) =>
								run.trace ? (
									<Trace key={runIndex}>
										{run.parts.map((part) =>
											part.type === "dynamic-tool" ? (
												<ToolTrace key={part.toolCallId} part={part} live={live} />
											) : null,
										)}
									</Trace>
								) : (
									run.parts.map((part, index) =>
										part.type === "text" ? <p key={`${runIndex}-${index}`}>{part.text}</p> : null,
									)
								),
							)}
						</MessageContent>
					</Message>
				);
			})}
			{busy ? null : (
				<Button
					variant="outline"
					className="mt-auto self-start"
					onClick={() => (nextMessage ? sendMessage(nextMessage) : setMessages(toolInitialMessages))}
				>
					{nextMessage ? "Send message" : "Reset"}
				</Button>
			)}
		</div>
	);
}
