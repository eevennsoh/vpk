"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import type { UIDataTypes, UIMessage } from "ai";

import { createChat, getMessageText } from "@/lib/ai";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Message, MessageContent } from "@/components/ui/message";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ui/tool";
import { TerminalIcon } from "@/components/ui/vpk-icons";

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

type ToolPart = Extract<ChatMessage["parts"][number], { type: "tool-runCommand" }>;

const chat = createChat<ChatMessage>()
	.user("Which package managers are installed?")
	.assistant(({ writer }) => {
		writer.tool("runCommand", { input: { command: "node --version" } }).sleep(900).output({ stdout: "v24.18.0" });
		writer.tool("runCommand", { input: { command: "npm --version" } }).sleep(900).output({ stdout: "11.6.2" });
		writer.tool("runCommand", { input: { command: "pnpm --version" } }).sleep(900).error("command not found: pnpm");
		writer.text("Node 24 and npm 11 are installed. pnpm is not.");
	});

const transcript = chat.get();
const [question] = chat.get(1);
const transport = chat.transport({ delayMs: 20 });

function getRowState(part: ToolPart, streaming: boolean): ToolPart["state"] {
	if (part.state === "output-available" || part.state === "output-error" || streaming) {
		return part.state;
	}

	// A call still waiting on input when the chat stops did not finish.
	return "output-error";
}

function ToolRow({ part, streaming, defaultOpen }: Readonly<{ part: ToolPart; streaming: boolean; defaultOpen?: boolean }>) {
	// Controlled: defaultOpen changes once the reply finishes, and an uncontrolled
	// Collapsible only reads its default on mount.
	const [open, setOpen] = useState<boolean>();

	return (
		<Tool open={open ?? defaultOpen ?? false} onOpenChange={setOpen}>
			<ToolHeader
				type={part.type}
				state={getRowState(part, streaming)}
				title={part.input?.command}
				leadingIcon={<TerminalIcon label="" />}
			/>
			<ToolContent>
				{part.state === "output-available" ? (
					<ToolOutput output={part.output.stdout} errorText={undefined} />
				) : part.state === "output-error" ? (
					<ToolOutput output={undefined} errorText={part.errorText} />
				) : (
					<ToolInput input={part.input} />
				)}
			</ToolContent>
		</Tool>
	);
}

export default function ToolDemo() {
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
				const tools = message.parts.filter((part) => part.type === "tool-runCommand");
				const text = getMessageText(message);

				return (
					<Message key={message.id}>
						<MessageContent className="gap-4">
							{tools.length > 0 ? (
								<div className="flex flex-col gap-2">
									{tools.map((part) => (
										<ToolRow
											key={part.toolCallId}
											part={part}
											streaming={streaming}
											defaultOpen={busy ? undefined : part.state === "output-error"}
										/>
									))}
								</div>
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

export function ToolDemoStates() {
	return (
		<div className="flex w-full max-w-sm flex-col gap-2">
			<Tool>
				<ToolHeader type="tool-runCommand" state="output-available" title="git status --short" leadingIcon={<TerminalIcon label="" />} />
				<ToolContent>
					<ToolOutput output={" M app/api/chat/route.ts\n M components/chat.tsx"} errorText={undefined} />
				</ToolContent>
			</Tool>
			<Tool>
				<ToolHeader type="tool-runCommand" state="output-error" title="pnpm dev" leadingIcon={<TerminalIcon label="" />} />
				<ToolContent>
					<ToolOutput output={undefined} errorText="Command timed out after 120 seconds." />
				</ToolContent>
			</Tool>
			<Tool>
				<ToolHeader type="tool-runCommand" state="output-denied" title="rm -rf dist" leadingIcon={<TerminalIcon label="" />} />
				<ToolContent>
					<ToolInput input={{ command: "rm -rf dist" }} />
				</ToolContent>
			</Tool>
			<Tool>
				<ToolHeader type="tool-runCommand" state="input-available" title="pnpm test" leadingIcon={<TerminalIcon label="" />} />
				<ToolContent>
					<ToolInput input={{ command: "pnpm test" }} />
				</ToolContent>
			</Tool>
		</div>
	);
}

export function ToolDemoInputOutput() {
	return (
		<div className="w-full max-w-sm">
			<Tool defaultOpen>
				<ToolHeader type="dynamic-tool" toolName="searchConfluence" title="Search Confluence" state="output-available" />
				<ToolContent>
					<ToolInput input={{ query: "deploy cache key", spaces: ["ENG"], limit: 3 }} />
					<ToolOutput
						output={{ results: [{ title: "Image optimization cache", space: "ENG" }], total: 1 }}
						errorText={undefined}
					/>
				</ToolContent>
			</Tool>
		</div>
	);
}

export function ToolDemoLabel() {
	return (
		<div className="w-full max-w-sm">
			<Tool>
				<ToolHeader type="dynamic-tool" toolName="search" label="Searching Confluence for deploy notes" state="input-available" />
				<ToolContent>
					<ToolInput input={{ query: "deploy notes" }} />
				</ToolContent>
			</Tool>
		</div>
	);
}
