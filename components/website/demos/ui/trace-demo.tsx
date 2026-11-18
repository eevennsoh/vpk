"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";

import { createChat, getMessageText } from "@/lib/ai";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Message, MessageContent } from "@/components/ui/message";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import {
	Trace,
	TraceCollapsible,
	TraceCollapsibleContent,
	TraceCollapsibleTrigger,
	TraceDescription,
	TraceIcon,
	TraceLine,
	TraceTitle,
} from "@/components/ui/trace";
import {
	ArrowUpRightIcon,
	BrainIcon,
	ChevronRightIcon,
	CircleAlertIcon,
	CircleCheckIcon,
	CircleIcon,
	FilePenIcon,
	FileTextIcon,
	FolderSearchIcon,
	GitBranchIcon,
	GlobeIcon,
	LoaderCircleIcon,
	SearchIcon,
	TerminalIcon,
} from "@/components/ui/vpk-icons";

export default function TraceDemo() {
	return <TraceStatus />;
}

export function TraceStatic() {
	return (
		<Trace className="max-w-sm">
			<TraceLine>
				<TraceIcon>
					<GitBranchIcon label="" />
				</TraceIcon>
				<TraceTitle>Created branch fix/frozen-lockfile</TraceTitle>
			</TraceLine>
		</Trace>
	);
}

export function TraceStatus() {
	return (
		<Trace className="max-w-sm">
			<TraceLine>
				<TraceIcon>
					<CircleCheckIcon label="" />
				</TraceIcon>
				<TraceTitle>Ran pnpm install</TraceTitle>
			</TraceLine>
			<TraceLine status="error">
				<TraceIcon>
					<CircleAlertIcon label="" />
				</TraceIcon>
				<TraceTitle>Failed to run pnpm lint</TraceTitle>
			</TraceLine>
			<TraceLine status="running">
				<TraceIcon>
					<LoaderCircleIcon label="" className="animate-spin" />
				</TraceIcon>
				<TraceTitle>Running pnpm build</TraceTitle>
			</TraceLine>
			<TraceLine status="pending">
				<TraceIcon>
					<CircleIcon label="" />
				</TraceIcon>
				<TraceTitle>Run pnpm test</TraceTitle>
			</TraceLine>
		</Trace>
	);
}

export function TraceDescriptionDemo() {
	return (
		<Trace className="max-w-sm">
			<TraceLine>
				<TraceIcon>
					<FilePenIcon label="" />
				</TraceIcon>
				<TraceTitle>Edited components/settings/notification-preferences-form.tsx</TraceTitle>
				<TraceDescription className="font-mono">+48 −12</TraceDescription>
			</TraceLine>
			<TraceLine>
				<TraceIcon>
					<TerminalIcon label="" />
				</TraceIcon>
				<TraceTitle>Ran pnpm test</TraceTitle>
				<TraceDescription>14s</TraceDescription>
			</TraceLine>
			<TraceLine>
				<TraceIcon>
					<SearchIcon label="" />
				</TraceIcon>
				<TraceTitle>Searched for useChat</TraceTitle>
				<TraceDescription>8 results</TraceDescription>
			</TraceLine>
		</Trace>
	);
}

export function TraceLink() {
	return (
		<Trace className="max-w-sm">
			<a href="#link">
				<TraceLine>
					<TraceIcon>
						<FileTextIcon label="" />
					</TraceIcon>
					<TraceTitle>Read apps/v4/lib/docs.ts</TraceTitle>
					<TraceIcon>
						<ChevronRightIcon label="" />
					</TraceIcon>
				</TraceLine>
			</a>
			<a href="https://docs.astro.build/en/install-and-setup/" target="_blank" rel="noreferrer">
				<TraceLine>
					<TraceIcon>
						<GlobeIcon label="" />
					</TraceIcon>
					<TraceTitle>
						Install Astro | docs.astro.build
						<span className="sr-only"> (opens in a new tab)</span>
					</TraceTitle>
					<TraceIcon>
						<ArrowUpRightIcon label="" />
					</TraceIcon>
				</TraceLine>
			</a>
		</Trace>
	);
}

const results = [
	{
		title: "Caching build outputs",
		url: "https://nextjs.org/docs/app/guides/caching",
	},
	{
		title: "Image optimization reference",
		url: "https://nextjs.org/docs/app/api-reference/components/image",
	},
	{
		title: "Deploy hooks and cache keys",
		url: "https://vercel.com/docs/deploy-hooks",
	},
];

export function TraceDialog() {
	return (
		<Trace className="max-w-sm">
			<Dialog>
				<DialogTrigger>
					<TraceLine>
						<TraceIcon>
							<GlobeIcon label="" />
						</TraceIcon>
						<TraceTitle>Searched the web for cache keys</TraceTitle>
						<TraceIcon>
							<ChevronRightIcon label="" />
						</TraceIcon>
					</TraceLine>
				</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Searched the web for cache keys</DialogTitle>
						<DialogDescription>Three results were used in the response.</DialogDescription>
					</DialogHeader>
					<Trace>
						{results.map((result) => (
							<a key={result.url} href={result.url} target="_blank" rel="noreferrer">
								<TraceLine>
									<TraceIcon>
										<GlobeIcon label="" />
									</TraceIcon>
									<TraceTitle>
										{result.title}
										<span className="sr-only"> (opens in a new tab)</span>
									</TraceTitle>
									<TraceIcon>
										<ArrowUpRightIcon label="" />
									</TraceIcon>
								</TraceLine>
							</a>
						))}
					</Trace>
				</DialogContent>
			</Dialog>
		</Trace>
	);
}

export function TraceSheet() {
	return (
		<Trace className="max-w-sm">
			<Sheet>
				<SheetTrigger>
					<TraceLine>
						<TraceIcon>
							<FolderSearchIcon label="" />
						</TraceIcon>
						<TraceTitle>Explored 4 files</TraceTitle>
						<TraceIcon>
							<ChevronRightIcon label="" />
						</TraceIcon>
					</TraceLine>
				</SheetTrigger>
				<SheetContent>
					<SheetHeader>
						<SheetTitle>Explored 4 files</SheetTitle>
						<SheetDescription>Files read while preparing the response.</SheetDescription>
					</SheetHeader>
					<ul className="flex flex-col gap-2 px-6 font-mono text-xs">
						<li>apps/v4/lib/docs.ts</li>
						<li>apps/v4/lib/components.ts</li>
						<li>apps/v4/next.config.mjs</li>
						<li>apps/v4/package.json</li>
					</ul>
				</SheetContent>
			</Sheet>
		</Trace>
	);
}

export function TraceGroupDemo() {
	return (
		<Trace className="max-w-sm">
			<TraceLine>
				<TraceIcon>
					<SearchIcon label="" />
				</TraceIcon>
				<TraceTitle>Searched for minimumReleaseAge</TraceTitle>
			</TraceLine>
			<TraceLine>
				<TraceIcon>
					<FileTextIcon label="" />
				</TraceIcon>
				<TraceTitle>Read pnpm-workspace.yaml</TraceTitle>
			</TraceLine>
			<TraceLine>
				<TraceIcon>
					<TerminalIcon label="" />
				</TraceIcon>
				<TraceTitle>Ran pnpm install</TraceTitle>
			</TraceLine>
		</Trace>
	);
}

const sources = [
	{
		title: "Install Astro | docs.astro.build",
		href: "https://docs.astro.build/en/install-and-setup/",
	},
	{
		title: "create-astro | npmjs.com",
		href: "https://www.npmjs.com/package/create-astro",
	},
	{
		title: "Settings: minimumReleaseAge | pnpm.io",
		href: "https://pnpm.io/settings#minimumreleaseage",
	},
];

export function TraceSources() {
	return (
		<div className="w-full max-w-sm">
			<TraceCollapsible defaultOpen>
				<TraceCollapsibleTrigger>
					<TraceLine>
						<TraceIcon>
							<GlobeIcon label="" />
						</TraceIcon>
						<TraceTitle>Used {sources.length} sources</TraceTitle>
					</TraceLine>
				</TraceCollapsibleTrigger>
				<TraceCollapsibleContent>
					<Trace>
						{sources.map((source) => (
							<a key={source.href} href={source.href} target="_blank" rel="noreferrer">
								<TraceLine>
									<TraceIcon>
										<GlobeIcon label="" />
									</TraceIcon>
									<TraceTitle>
										{source.title}
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

function groupParts(parts: UIMessage["parts"]) {
	const runs: { trace: boolean; parts: UIMessage["parts"] }[] = [];

	for (const part of parts) {
		const trace = part.type === "reasoning";

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
								<Bubble align="end" variant="muted">
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
							{groupParts(message.parts).map((run, runIndex) =>
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
