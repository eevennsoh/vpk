"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { useState } from "react";

import { VisualIdentityTile } from "@/components/projects/shared/components/visual-identity-tile";
import { PlanTabContent } from "@/components/projects/shared/lib/plan-card-utils";
import { formatPlanStepCount, resolvePlanVisualIdentity } from "@/components/projects/shared/lib/plan-identity";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Message, MessageContent } from "@/components/ui/message";
import {
	Plan,
	PlanAvatar,
	PlanContent,
	PlanDescription,
	PlanFooter,
	PlanHeader,
	PlanIcon,
	PlanStep,
	PlanSteps,
	PlanTaskItem,
	PlanTaskList,
	PlanTitle,
	type PlanStepStatus,
	type PlanTask,
} from "@/components/ui/plan";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createChat, getMessageText } from "@/lib/ai";

/* ----- Card (default variant) ----- */

const PLAN_TASKS: PlanTask[] = [
	{ id: "1", label: "Create Flexible Fridays Work-back Plan", blockedBy: [] },
	{ id: "2", label: "Finalize Flexible Fridays policy wording", blockedBy: ["1"] },
	{ id: "3", label: "Create Manager toolkit content", blockedBy: ["1"] },
	{ id: "4", label: "Record Manager toolkit Loom walkthrough", blockedBy: [] },
	{ id: "5", label: "Schedule and run Manager training sessions", blockedBy: [] },
	{ id: "6", label: "Draft CEO company-wide announcement email", blockedBy: [] },
	{ id: "7", label: "Review and approve CEO announcement", blockedBy: [] },
	{ id: "8", label: "Create Intranet FAQ & Flexible Fridays landing page", blockedBy: [] },
	{ id: "9", label: "Send internal launch email + Slack announcement", blockedBy: [] },
	{ id: "10", label: "Launch Flexible Fridays Pilot (May 3)", blockedBy: [] },
];

const PLAN_SUMMARY = `# Plan summary

The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan.

## Heading

The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan.

### Sub heading

The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan. The content about the plan.`;

function resolveBlockedByLabels(task: PlanTask): string[] {
	return task.blockedBy
		.map((blockedById) => {
			const taskIndex = PLAN_TASKS.findIndex((t) => t.id === blockedById);
			return taskIndex >= 0 ? `Task ${taskIndex + 1}` : null;
		})
		.filter((label): label is string => label !== null);
}

function PlanDemoHeader() {
	return (
		<PlanHeader
			leading={<PlanAvatar><VisualIdentityTile decorative label="Plan" visualIdentity={resolvePlanVisualIdentity("Plan title")} /></PlanAvatar>}
			title={<PlanTitle className="truncate text-sm leading-5 font-semibold text-text">Plan title</PlanTitle>}
			description={<PlanDescription className="text-xs leading-4 text-text-subtlest">{`${formatPlanStepCount(PLAN_TASKS.length)} • Description`}</PlanDescription>}
		/>
	);
}

// Sonnet 5 pricing: $3/MTok input, $15/MTok output
// 10 tasks, ~2K input + ~1K output per task, +~1K input overhead per extra agent
const AGENT_ESTIMATES: Record<string, { cost: string; time: string }> = {
	"1": { cost: "$0.32", time: "~5 min" },
	"2": { cost: "$0.38", time: "~3 min" },
	"3": { cost: "$0.45", time: "~2 min" },
	"4": { cost: "$0.52", time: "~1.5 min" },
};

function PlanDemoFooter() {
	const [agentCount, setAgentCount] = useState("1");
	const estimate = AGENT_ESTIMATES[agentCount] ?? AGENT_ESTIMATES["1"];

	return (
		<PlanFooter className="items-center justify-between">
			<div className="flex items-center gap-6">
				<div className="flex flex-col gap-0.5">
					<span className="text-xs leading-4 text-text-subtlest">Estimated cost and time</span>
					<span className="text-xs leading-4 font-medium text-text">{estimate.cost} • {estimate.time}</span>
				</div>
				<div className="flex flex-col gap-0.5">
					<span className="text-xs leading-4 text-text-subtlest">{`Build with ${agentCount} ${agentCount === "1" ? "agent" : "agents"}`}</span>
					<Select value={agentCount} onValueChange={(v) => { if (v) setAgentCount(v); }}>
						<SelectTrigger aria-label="Select agent count" variant="none" size="sm" className="!h-auto gap-1 !p-0 text-xs leading-4 font-medium text-text">
							<SelectValue />
						</SelectTrigger>
						<SelectContent alignItemWithTrigger={false} align="start" className="min-w-0">
							<SelectGroup>
								<SelectItem value="1" className="py-1.5 pl-7 pr-2.5 text-xs">1</SelectItem>
								<SelectItem value="2" className="py-1.5 pl-7 pr-2.5 text-xs">2</SelectItem>
								<SelectItem value="3" className="py-1.5 pl-7 pr-2.5 text-xs">3</SelectItem>
								<SelectItem value="4" className="py-1.5 pl-7 pr-2.5 text-xs">4</SelectItem>
							</SelectGroup>
						</SelectContent>
					</Select>
				</div>
			</div>
			<div className="flex items-center gap-2">
				<Button variant="outline">Open preview</Button>
				<Button>Build</Button>
			</div>
		</PlanFooter>
	);
}

export function PlanDemoTasksOnly() {
	const [isOpen, setIsOpen] = useState(true);

	return (
		<Plan className="w-[776px] max-w-full gap-0 py-0 shadow-xs" open={isOpen} onOpenChange={setIsOpen}>
			<PlanDemoHeader />

			<PlanContent className="px-0 pb-0 pt-4">
				<div className="px-3 pb-4">
					<PlanTaskList>
						{PLAN_TASKS.map((task, index) => (
							<PlanTaskItem key={task.id} index={index + 1} label={task.label} blockedByLabels={resolveBlockedByLabels(task)} />
						))}
					</PlanTaskList>
				</div>

				<PlanDemoFooter />
			</PlanContent>
		</Plan>
	);
}

export function PlanDemoSummaryAndTasks() {
	const [isOpen, setIsOpen] = useState(true);

	return (
		<Plan className="w-[776px] max-w-full gap-0 py-0 shadow-xs" open={isOpen} onOpenChange={setIsOpen}>
			<PlanDemoHeader />

			<PlanContent className="px-0 pb-0 pt-4">
				<PlanTabContent
					description={PLAN_SUMMARY}
				/>

				<PlanDemoFooter />
			</PlanContent>
		</Plan>
	);
}

export default function PlanDemo() {
	return <PlanDemoSummaryAndTasks />;
}

/* ----- Inline variant ----- */

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
		<Plan defaultOpen isStreaming={running} variant="inline">
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

/** The inline variant as an agent streams it: shadcn's demo, with Replay. */
export function PlanDemoInline() {
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

const DESCRIPTION_STEPS = [
	"Add a dark variant to the theme tokens",
	"Read the theme from a cookie on the server",
	"Add a toggle to the settings page",
	"Check contrast on the charts",
];

export function PlanDemoDescription() {
	return (
		<Plan className="max-w-sm" defaultOpen variant="inline">
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
