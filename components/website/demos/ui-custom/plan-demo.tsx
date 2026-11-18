"use client";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
	Plan,
	PlanAvatar,
	PlanContent,
	PlanDescription,
	PlanFooter,
	PlanHeader,
	PlanTabContent,
	PlanTaskItem,
	PlanTaskList,
	PlanTitle,
	type PlanTask,
} from "@/components/ui-custom/plan";
import { formatPlanStepCount, resolvePlanVisualIdentity } from "@/components/projects/shared/lib/plan-identity";
import { useState, type ComponentProps } from "react";

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
			leading={<PlanAvatar visualIdentity={resolvePlanVisualIdentity("Plan title")} />}
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

const INLINE_TASK_STATUSES: NonNullable<ComponentProps<typeof PlanTaskItem>["status"]>[] = ["done", "done", "running"];

export function PlanDemoInline() {
	const tasks = PLAN_TASKS.slice(0, 5);
	const done = INLINE_TASK_STATUSES.filter((status) => status === "done").length;

	return (
		<Plan className="max-w-sm" defaultOpen isStreaming variant="inline">
			<PlanHeader
				leading={<PlanAvatar />}
				title={<PlanTitle>Plan: launch Flexible Fridays</PlanTitle>}
				description={<PlanDescription>{`${done} of ${tasks.length} done`}</PlanDescription>}
			/>
			<PlanContent>
				<PlanTaskList>
					{tasks.map((task, index) => (
						<PlanTaskItem key={task.id} index={index + 1} label={task.label} status={INLINE_TASK_STATUSES[index] ?? "pending"} />
					))}
				</PlanTaskList>
			</PlanContent>
		</Plan>
	);
}

export default function PlanDemo() {
	return <PlanDemoSummaryAndTasks />;
}
