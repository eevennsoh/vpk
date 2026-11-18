"use client";

import { useChat } from "@ai-sdk/react";
import type { UIDataTypes, UIMessage } from "ai";

import { createChat, getMessageText } from "@/lib/ai";
import { Badge } from "@/components/ui/badge";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Message, MessageContent } from "@/components/ui/message";
import {
	Agent,
	AgentContent,
	AgentHeader,
	AgentInstructions,
	AgentTool,
	AgentTools,
} from "@/components/ui/subagent";
import { Trace, TraceDescription } from "@/components/ui/trace";
import { CircleAlertIcon, CircleCheckIcon, LoaderCircleIcon } from "@/components/ui/vpk-icons";

type SubagentMessage = UIMessage<
	unknown,
	UIDataTypes,
	{
		runCommand: {
			input: { command: string };
			output: { stdout: string };
		};
	}
>;

type SubagentPart = SubagentMessage["parts"][number];

type ChatMessage = UIMessage<
	unknown,
	UIDataTypes,
	{
		researchAgent: {
			input: { task: string };
			output: SubagentMessage;
		};
	}
>;

type Part = ChatMessage["parts"][number];

const steps = [
	{
		command: "grep -rn cacheKey scripts",
		stdout: "scripts/optimize-images.ts:14:  const cacheKey = process.env.COMMIT_SHA",
	},
	{
		command: "sed -n 13,15p scripts/optimize-images.ts",
		stdout:
			'const cacheDir = ".next/cache/images"\nconst cacheKey = process.env.COMMIT_SHA\nconst cached = await restoreCache(cacheDir, cacheKey)',
	},
	{
		command: "ls public/images | wc -l",
		stdout: "1240",
	},
];

function getSubagentMessage(done: number, report?: string): SubagentMessage {
	const parts = steps.slice(0, done).map(
		(step, index): SubagentPart => ({
			type: "tool-runCommand",
			toolCallId: `step-${index}`,
			state: "output-available",
			input: { command: step.command },
			output: { stdout: step.stdout },
		}),
	);

	if (done < steps.length) {
		parts.push({
			type: "tool-runCommand",
			toolCallId: `step-${done}`,
			state: "input-available",
			input: { command: steps[done].command },
		});
	}

	if (report) {
		parts.push({ type: "text", text: report });
	}

	return { id: "research-agent", role: "assistant", parts };
}

const chat = createChat<ChatMessage>()
	.user("Why does image optimization rerun on every deploy?")
	.assistant(({ writer }) => {
		const subagent = writer
			.tool("researchAgent", {
				input: {
					task: "Find out why image optimization reruns on every deploy.",
				},
			})
			.sleep(600);
		steps.forEach((_, index) => {
			subagent.output(getSubagentMessage(index), { preliminary: true }).sleep(1000);
		});
		subagent
			.output(
				getSubagentMessage(
					steps.length,
					"The cache is keyed on the commit SHA, so every deploy misses it and optimizes all 1,240 images again.",
				),
			)
			.sleep(400);
		writer.text(
			"Image optimization reruns because its cache is keyed on the commit SHA, which changes on every deploy. Key the cache on a hash of public/images instead, and unchanged images will be skipped.",
		);
	});

const transcript = chat.get();
const [question] = chat.get(1);
const transport = chat.transport({ delayMs: 20 });

function StepRow({
	part,
	running,
}: Readonly<{
	part: Extract<SubagentPart, { type: "tool-runCommand" }>;
	running: boolean;
}>) {
	const command = part.input?.command;

	if (part.state === "output-available") {
		return <AgentTool output={part.output.stdout}>Ran {command}</AgentTool>;
	}

	return (
		<AgentTool
			status={running ? "running" : "error"}
			icon={running ? <LoaderCircleIcon label="" className="animate-spin" /> : <CircleAlertIcon label="" />}
		>
			{running ? "Running" : "Failed to run"} {command}
		</AgentTool>
	);
}

function getRunState(done: boolean, running: boolean) {
	if (done) {
		return { status: undefined, verb: "Ran", icon: <CircleCheckIcon label="" /> } as const;
	}

	return running
		? ({
				status: "running",
				verb: "Running",
				icon: <LoaderCircleIcon label="" className="animate-spin" />,
			} as const)
		: ({ status: "error", verb: "Failed to run", icon: <CircleAlertIcon label="" /> } as const);
}

function SubagentRow({
	part,
	streaming,
}: Readonly<{
	part: Extract<Part, { type: "tool-researchAgent" }>;
	streaming: boolean;
}>) {
	const done = part.state === "output-available" && !part.preliminary;
	const running = !done && part.state !== "output-error" && streaming;
	const parts = part.state === "output-available" ? part.output.parts : [];
	const report = parts.map((agentPart) => (agentPart.type === "text" ? agentPart.text : "")).join("");
	const run = getRunState(done, running);

	return (
		<Agent defaultOpen>
			<AgentHeader
				name={`${run.verb} the research subagent`}
				status={run.status}
				icon={run.icon}
				collapsible={parts.length > 0}
			/>
			{parts.length > 0 ? (
				<AgentContent>
					<AgentTools>
						{parts.map((agentPart) =>
							agentPart.type === "tool-runCommand" ? (
								<StepRow key={agentPart.toolCallId} part={agentPart} running={running} />
							) : null,
						)}
					</AgentTools>
					{report ? <p>{report}</p> : null}
				</AgentContent>
			) : null}
		</Agent>
	);
}

export default function SubagentDemo() {
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
				const agents = message.parts.filter((part) => part.type === "tool-researchAgent");
				const text = getMessageText(message);

				return (
					<Message key={message.id}>
						<MessageContent className="gap-4">
							{agents.length > 0 ? (
								<Trace>
									{agents.map((part) => (
										<SubagentRow key={part.toolCallId} part={part} streaming={streaming} />
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

export function SubagentRunning() {
	return (
		<Agent defaultOpen className="max-w-sm">
			<AgentHeader
				name="Running the research agent"
				status="running"
				icon={<LoaderCircleIcon label="" className="animate-spin" />}
			/>
			<AgentContent>
				<AgentTools>
					<AgentTool>Ran grep -rn cacheKey scripts</AgentTool>
					<AgentTool status="running" icon={<LoaderCircleIcon label="" className="animate-spin" />}>
						Running sed -n 13,15p scripts/optimize-images.ts
					</AgentTool>
				</AgentTools>
			</AgentContent>
		</Agent>
	);
}

export function SubagentDetails() {
	return (
		<Agent defaultOpen className="max-w-sm">
			<AgentHeader name="Ran the research agent" icon={<CircleCheckIcon label="" />}>
				<TraceDescription>48s</TraceDescription>
			</AgentHeader>
			<AgentContent>
				<div className="flex flex-wrap gap-1.5">
					<Badge variant="neutral">anthropic/claude-sonnet-4.5</Badge>
					<Badge variant="neutral" className="font-mono">
						runCommand
					</Badge>
				</div>
				<AgentInstructions>Find out why image optimization reruns on every deploy.</AgentInstructions>
				<AgentTools>
					<AgentTool>Ran grep -rn cacheKey scripts</AgentTool>
					<AgentTool>Ran sed -n 13,15p scripts/optimize-images.ts</AgentTool>
				</AgentTools>
				<p>The cache is keyed on the commit SHA.</p>
			</AgentContent>
		</Agent>
	);
}
