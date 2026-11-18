"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";

import { createChat, getMessageText } from "@/lib/ai";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Message, MessageContent } from "@/components/ui/message";
import {
	Plan,
	PlanContent,
	PlanDescription,
	PlanHeader,
	PlanIcon,
	PlanStep,
	PlanSteps,
	PlanTitle,
	type PlanStepStatus,
} from "@/components/ui/plan";

type PlanData = {
	title: string;
	steps: { title: string; status: PlanStepStatus }[];
};

type ChatMessage = UIMessage<unknown, { plan: PlanData }>;

const STEPS = [
	"Install @base-ui/react",
	"Replace the Radix imports",
	"Rename asChild to render",
	"Run the type checker",
];

function planAt(current: number): PlanData {
	return {
		title: "Plan: migrate to Base UI",
		steps: STEPS.map((title, index) => ({
			title,
			status: index < current ? "done" : index === current ? "running" : "pending",
		})),
	};
}

const chat = createChat<ChatMessage>()
	.user("Migrate the dialog components to Base UI.")
	.assistant(({ writer }) => {
		STEPS.forEach((_, index) => {
			writer.data({ type: "data-plan", id: "plan", data: planAt(index) }).sleep(1200);
		});
		writer.data({ type: "data-plan", id: "plan", data: planAt(STEPS.length) });
		writer.text("Migrated Dialog and AlertDialog. The type checker passes.");
	});

const transcript = chat.get();
const [question] = chat.get(1);
const transport = chat.transport({ delayMs: 20 });

function PlanRow({ plan, streaming }: Readonly<{ plan: PlanData; streaming: boolean }>) {
	const done = plan.steps.filter((step) => step.status === "done").length;
	const running = streaming && done < plan.steps.length;

	return (
		<Plan defaultOpen isStreaming={running}>
			<PlanHeader>
				<PlanIcon />
				<PlanTitle>{plan.title}</PlanTitle>
				<PlanDescription>
					{done} of {plan.steps.length} done
				</PlanDescription>
			</PlanHeader>
			<PlanContent>
				<PlanSteps>
					{plan.steps.map((step) => (
						<PlanStep key={step.title} status={step.status}>
							{step.title}
						</PlanStep>
					))}
				</PlanSteps>
			</PlanContent>
		</Plan>
	);
}

export default function PlanDemo() {
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
				const plan = message.parts.find((part) => part.type === "data-plan");
				const text = getMessageText(message);

				return (
					<Message key={message.id}>
						<MessageContent className="gap-4">
							{plan ? <PlanRow plan={plan.data} streaming={streaming} /> : null}
							{text ? <p>{text}</p> : null}
						</MessageContent>
					</Message>
				);
			})}
			{busy ? null : (
				<Button
					className="mt-auto self-start"
					onClick={() => {
						setMessages([]);
						void sendMessage(question);
					}}
					variant="outline"
				>
					Replay
				</Button>
			)}
		</div>
	);
}

const USAGE_STEPS: PlanData["steps"] = [
	{ title: "Replace the Radix imports", status: "done" },
	{ title: "Rename asChild to render", status: "running" },
	{ title: "Run the type checker", status: "pending" },
];

export function PlanDemoUsage() {
	return (
		<Plan className="max-w-sm" defaultOpen isStreaming>
			<PlanHeader>
				<PlanIcon />
				<PlanTitle>Plan: migrate to Base UI</PlanTitle>
				<PlanDescription>2 of 5 done</PlanDescription>
			</PlanHeader>
			<PlanContent>
				<PlanSteps>
					{USAGE_STEPS.map((step) => (
						<PlanStep key={step.title} status={step.status}>
							{step.title}
						</PlanStep>
					))}
				</PlanSteps>
			</PlanContent>
		</Plan>
	);
}

const DESCRIPTION_STEPS = [
	"Add a dark variant to the theme tokens",
	"Read the theme from a cookie on the server",
	"Add a toggle to the settings page",
	"Check contrast on the charts",
];

export function PlanDemoDescription() {
	return (
		<Plan className="max-w-sm" defaultOpen>
			<PlanHeader>
				<PlanIcon />
				<PlanTitle>Plan: add dark mode</PlanTitle>
				<PlanDescription>1 of {DESCRIPTION_STEPS.length} done</PlanDescription>
			</PlanHeader>
			<PlanContent className="flex flex-col gap-3">
				<p>Store the theme in a cookie so the server renders the right one and the page does not flash on load.</p>
				<PlanSteps>
					{DESCRIPTION_STEPS.map((step, index) => (
						<PlanStep key={step} status={index === 0 ? "done" : "pending"}>
							{step}
						</PlanStep>
					))}
				</PlanSteps>
			</PlanContent>
		</Plan>
	);
}
