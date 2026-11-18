"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";

import { createChat, getMessageText } from "@/lib/ai";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Message, MessageContent } from "@/components/ui/message";
import { Terminal, TerminalContent, TerminalHeader, TerminalTitle } from "@/components/ui/terminal";
import { Trace } from "@/components/ui/trace";

type ChatMessage = UIMessage<
	unknown,
	{
		terminal: { output: string };
	},
	{
		runCommand: {
			input: { command: string };
			output: { exitCode: number };
		};
	}
>;

type ToolPart = Extract<ChatMessage["parts"][number], { type: "tool-runCommand" }>;

const COMMANDS = [
	{
		id: "lint",
		command: "pnpm lint",
		output: ["> acme-chat@0.1.0 lint", "> eslint ."],
	},
	{
		id: "test",
		command: "pnpm test",
		output: [
			"> acme-chat@0.1.0 test",
			"> vitest run",
			"",
			" ✓ lib/ai.test.ts (6 tests) 41ms",
			" ✓ components/chat.test.tsx (9 tests) 212ms",
			"",
			" Test Files  2 passed (2)",
			"      Tests  15 passed (15)",
		],
	},
	{
		id: "build",
		command: "pnpm build",
		output: [
			"> acme-chat@0.1.0 build",
			"> next build",
			"",
			"   ▲ Next.js 16.3.0",
			"   Creating an optimized production build ...",
			" ✓ Compiled successfully in 4.2s",
			" ✓ Generating static pages (12/12)",
			"",
			"Route (app)                Size  First Load JS",
			"┌ ○ /                     1.9 kB       112 kB",
			"└ ƒ /api/chat              141 B       102 kB",
		],
	},
];

const chat = createChat<ChatMessage>()
	.user("Run the checks, then build the app.")
	.assistant(({ writer }) => {
		for (const { id, command, output } of COMMANDS) {
			const tool = writer.tool("runCommand", {
				toolCallId: id,
				input: { command },
			});

			// The tool streams its output as a data part with the tool call's id.
			output.forEach((_, index) => {
				writer
					.data({
						type: "data-terminal",
						id,
						data: { output: output.slice(0, index + 1).join("\n") },
					})
					.sleep(200);
			});

			tool.output({ exitCode: 0 });
		}

		writer.text("Lint and tests pass, and the build compiled both routes.");
	});

const transcript = chat.get();
const [question] = chat.get(1);
const transport = chat.transport({ delayMs: 20 });

function getTitle(part: ToolPart, running: boolean) {
	const command = part.input?.command;

	if (part.state === "output-available") {
		return part.output.exitCode === 0 ? `Ran ${command}` : `${command} exited with code ${part.output.exitCode}`;
	}

	return running ? `Running ${command}` : `Failed to run ${command}`;
}

function getOutput(message: ChatMessage, toolCallId: string) {
	for (const part of message.parts) {
		if (part.type === "data-terminal" && part.id === toolCallId) {
			return part.data.output;
		}
	}

	return "";
}

function CommandRow({
	part,
	output,
	streaming,
	defaultOpen,
}: Readonly<{
	part: ToolPart;
	output: string;
	streaming: boolean;
	defaultOpen?: boolean;
}>) {
	const running = streaming && (part.state === "input-streaming" || part.state === "input-available");
	const failed = !running && (part.state !== "output-available" || part.output.exitCode !== 0);

	return (
		<Terminal
			output={part.state === "output-error" ? part.errorText : output}
			isStreaming={running}
			defaultOpen={defaultOpen}
		>
			<TerminalHeader status={running ? "running" : failed ? "error" : undefined}>
				<TerminalTitle>{getTitle(part, running)}</TerminalTitle>
			</TerminalHeader>
			<TerminalContent />
		</Terminal>
	);
}

export default function TerminalDemo() {
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
										<CommandRow
											key={part.toolCallId}
											part={part}
											output={getOutput(message, part.toolCallId)}
											streaming={streaming}
											defaultOpen={busy ? undefined : part === tools.at(-1)}
										/>
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

const LINT_OUTPUT = `> acme-chat@0.1.0 lint
> eslint .

app/api/chat/route.ts
  14:7  error  'model' is assigned a value but never used  no-unused-vars

components/chat.tsx
  42:5  error  React Hook useEffect has a missing dependency: 'messages'  react-hooks/exhaustive-deps

✖ 2 problems (2 errors, 0 warnings)

 ELIFECYCLE  Command failed with exit code 1.`;

export function TerminalError() {
	return (
		<Trace className="max-w-sm">
			<Terminal output="">
				<TerminalHeader>
					<TerminalTitle>Ran pnpm install</TerminalTitle>
				</TerminalHeader>
			</Terminal>
			<Terminal output={LINT_OUTPUT} defaultOpen>
				<TerminalHeader status="error">
					<TerminalTitle>pnpm lint exited with code 1</TerminalTitle>
				</TerminalHeader>
				<TerminalContent />
			</Terminal>
		</Trace>
	);
}
