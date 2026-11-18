"use client";

import { useChat } from "@ai-sdk/react";
import type { UIDataTypes, UIMessage } from "ai";

import { createChat, getMessageText } from "@/lib/ai";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Message, MessageContent } from "@/components/ui/message";
import {
	StackTrace,
	StackTraceContent,
	StackTraceError,
	StackTraceFrameLinks,
	StackTraceHeader,
} from "@/components/ui/stack-trace";
import { Terminal, TerminalContent, TerminalHeader, TerminalTitle } from "@/components/ui/terminal";
import { Trace } from "@/components/ui/trace";
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

const STACK = `TypeError: Cannot read properties of undefined (reading 'email')
    at seedUsers (prisma/seed.ts:27:34)
    at main (prisma/seed.ts:51:9)
    at Module._compile (node:internal/modules/cjs/loader:1554:14)
    at Object.transformer (node_modules/tsx/dist/register.cjs:3:1104)
    at Module.load (node:internal/modules/cjs/loader:1289:32)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)`;

const chat = createChat<ChatMessage>()
	.user("Reset the database and seed it.")
	.assistant(({ writer }) => {
		writer
			.tool("runCommand", {
				input: { command: "pnpm prisma migrate reset --skip-seed" },
			})
			.sleep(900)
			.output({
				stdout: `Database reset successful

The following migrations have been applied:

migrations/
  └─ 20260912_init/
  └─ 20260920_add_profiles/`,
			});
		writer.tool("runCommand", { input: { command: "pnpm prisma db seed" } }).sleep(1200).error(STACK);
		writer.text(
			"The migrations ran, but the seed failed in seedUsers. One fixture has no profile, so profile.email is undefined.",
		);
	});

const transcript = chat.get();
const [question] = chat.get(1);
const transport = chat.transport({ delayMs: 20 });

function CommandRow({ part, streaming }: Readonly<{ part: ToolPart; streaming: boolean }>) {
	const command = part.input?.command;

	if (part.state === "output-error") {
		return (
			<StackTrace trace={part.errorText} defaultOpen>
				<StackTraceHeader icon={<TerminalIcon label="" />}>
					<StackTraceError />
				</StackTraceHeader>
				<StackTraceContent>
					<StackTraceFrameLinks />
				</StackTraceContent>
			</StackTrace>
		);
	}

	if (part.state === "output-available") {
		return (
			<Terminal output={part.output.stdout}>
				<TerminalHeader>
					<TerminalTitle>Ran {command}</TerminalTitle>
				</TerminalHeader>
				<TerminalContent />
			</Terminal>
		);
	}

	return (
		<Terminal output="" isStreaming={streaming}>
			<TerminalHeader status={streaming ? "running" : "error"}>
				<TerminalTitle>
					{streaming ? "Running" : "Failed to run"} {command}
				</TerminalTitle>
			</TerminalHeader>
		</Terminal>
	);
}

export default function StackTraceDemo() {
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
								<Trace>
									{tools.map((part) => (
										<CommandRow key={part.toolCallId} part={part} streaming={streaming} />
									))}
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
						void sendMessage(question);
					}}
				>
					Replay
				</Button>
			)}
		</div>
	);
}

const FRAMES_STACK = `TypeError: Cannot read properties of undefined (reading 'total')
    at formatInvoice (app/lib/billing.ts:42:31)
    at InvoiceRow (app/components/invoice-row.tsx:18:12)
    at renderWithHooks (node_modules/react-dom/cjs/react-dom.development.js:14985:18)
    at beginWork (node_modules/react-dom/cjs/react-dom.development.js:19049:16)
    at performUnitOfWork (node_modules/react-dom/cjs/react-dom.development.js:22776:12)
    at workLoopSync (node_modules/react-dom/cjs/react-dom.development.js:22707:5)`;

export function StackTraceFrames() {
	return (
		<StackTrace trace={FRAMES_STACK} defaultOpen className="max-w-sm">
			<StackTraceHeader>
				<StackTraceError />
			</StackTraceHeader>
			<StackTraceContent keepMounted>
				<StackTraceFrameLinks />
			</StackTraceContent>
		</StackTrace>
	);
}
