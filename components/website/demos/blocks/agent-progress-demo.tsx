"use client";

import AgentsProgress from "@/components/blocks/agent-progress/page";
import { useTimestampAgo } from "@/hooks/use-timestamp-ago";
import { resolvePlanVisualIdentity } from "@/components/projects/shared/lib/plan-identity";
import type { ProgressStatusGroups } from "@/components/blocks/agent-progress/data/mock-tasks";

const TASKS_MIXED: ProgressStatusGroups = {
	done: [
		{ id: "d1", label: "Task 1", description: "Set up CI pipeline" },
		{ id: "d2", label: "Task 2", description: "Configure linting rules" },
	],
	inReview: [
		{ id: "r1", label: "Task 3", description: "Implement search API", agentName: "Backend Agent" },
		{ id: "r2", label: "Task 4", description: "Add pagination component" },
	],
	inProgress: [
		{ id: "p1", label: "Task 5", description: "Build dashboard widgets", agentName: "Frontend Agent" },
		{ id: "p2", label: "Task 6", description: "Integrate analytics SDK" },
	],
	failed: [
		{ id: "f1", label: "Task 6b", description: "Recover failed analytics migration" },
	],
	todo: [
		{ id: "t1", label: "Task 7", description: "Write integration tests" },
		{ id: "t2", label: "Task 8", description: "Update documentation" },
		{ id: "t3", label: "Task 9", description: "Deploy to staging" },
	],
};

const TASKS_ALL_DONE: ProgressStatusGroups = {
	done: [
		{ id: "d1", label: "Task 1", description: "Set up CI pipeline" },
		{ id: "d2", label: "Task 2", description: "Configure linting rules" },
		{ id: "d3", label: "Task 3", description: "Implement search API", agentName: "Backend Agent" },
		{ id: "d4", label: "Task 4", description: "Write integration tests" },
	],
	inReview: [],
	inProgress: [],
	failed: [],
	todo: [],
};

const TASKS_EARLY: ProgressStatusGroups = {
	done: [],
	inReview: [],
	inProgress: [{ id: "p1", label: "Task 1", description: "Analyze codebase structure", agentName: "Explorer Agent" }],
	failed: [],
	todo: [
		{ id: "t1", label: "Task 2", description: "Set up CI pipeline" },
		{ id: "t2", label: "Task 3", description: "Configure linting rules" },
		{ id: "t3", label: "Task 4", description: "Implement search API" },
		{ id: "t4", label: "Task 5", description: "Write integration tests" },
		{ id: "t5", label: "Task 6", description: "Update documentation" },
	],
};

const TASKS_WITH_AGENTS: ProgressStatusGroups = {
	done: [{ id: "d1", label: "Task 1", description: "Set up CI pipeline", agentName: "DevOps Agent" }],
	inReview: [
		{ id: "r1", label: "Task 2", description: "Implement search API", agentName: "Backend Agent" },
		{ id: "r2", label: "Task 3", description: "Build search UI", agentName: "Frontend Agent" },
	],
	inProgress: [{ id: "p1", label: "Task 4", description: "Write integration tests", agentName: "QA Agent" }],
	failed: [],
	todo: [{ id: "t1", label: "Task 5", description: "Deploy to staging", agentName: "DevOps Agent" }],
};

export default function AgentProgressDemo() {
	return (
		<div className="flex flex-col items-center gap-8 p-8">
			<div className="flex w-full max-w-sm flex-col gap-2">
				<span className="text-xs font-medium text-text-subtlest">Running</span>
				<AgentsProgress taskStatusGroups={TASKS_MIXED} />
			</div>
			<div className="flex w-full max-w-sm flex-col gap-2">
				<span className="text-xs font-medium text-text-subtlest">Completed (collapsed — click to expand)</span>
				<AgentsProgress runStatus="completed" runCompletedAt="2025-01-15T10:10:51Z" runCreatedAt="2025-01-15T10:00:00Z" defaultCollapsed />
			</div>
		</div>
	);
}

export function AgentProgressDemoRunning() {
	return (
		<div className="flex items-center justify-center p-6">
			<AgentsProgress planTitle="Sprint Planning" planVisualIdentity={resolvePlanVisualIdentity("Sprint Planning")} taskStatusGroups={TASKS_MIXED} runStatus="running" agentCount={6} />
		</div>
	);
}

export function AgentProgressDemoCompleted() {
	return (
		<div className="flex items-center justify-center p-6">
			<AgentsProgress
				planTitle="Code Review Sweep"
				planVisualIdentity={resolvePlanVisualIdentity("Code Review Sweep")}
				taskStatusGroups={TASKS_ALL_DONE}
				runStatus="completed"
				runCreatedAt="2025-01-15T10:00:00Z"
				runCompletedAt="2025-01-15T10:10:51Z"
				agentCount={4}
			/>
		</div>
	);
}

export function AgentProgressDemoFailed() {
	return (
		<div className="flex items-center justify-center p-6">
			<AgentsProgress
				planTitle="Deploy Pipeline"
				planVisualIdentity={resolvePlanVisualIdentity("Deploy Pipeline")}
				taskStatusGroups={{
					done: [{ id: "d1", label: "Task 1", description: "Build artifacts" }],
					inReview: [],
					inProgress: [],
					failed: [
						{ id: "f1", label: "Task 2", description: "Run smoke tests" },
						{ id: "f2", label: "Task 3", description: "Deploy to production" },
					],
					todo: [
						{ id: "t1", label: "Task 4", description: "Prepare rollback plan" },
					],
				}}
				runStatus="failed"
				runCreatedAt="2025-01-15T10:00:00Z"
				runCompletedAt="2025-01-15T10:03:22Z"
				agentCount={3}
				onDelete={() => {}}
			/>
		</div>
	);
}

export function AgentProgressDemoCollapsed() {
	return (
		<div className="flex items-center justify-center p-6">
			<AgentsProgress planTitle="Flexible Friday Plan" planVisualIdentity={resolvePlanVisualIdentity("Flexible Friday Plan")} runStatus="completed" runCreatedAt="2025-01-15T10:00:00Z" runCompletedAt="2025-01-15T10:10:51Z" defaultCollapsed />
		</div>
	);
}

export function AgentProgressDemoCollapsedRunning() {
	return (
		<div className="flex items-center justify-center p-6">
			<AgentsProgress planTitle="Background Tasks" planVisualIdentity={resolvePlanVisualIdentity("Background Tasks")} runStatus="running" agentCount={8} defaultCollapsed />
		</div>
	);
}

export function AgentProgressDemoWithAgents() {
	return (
		<div className="flex items-center justify-center p-6">
			<AgentsProgress planTitle="Multi-Agent Sprint" planVisualIdentity={resolvePlanVisualIdentity("Multi-Agent Sprint")} taskStatusGroups={TASKS_WITH_AGENTS} runStatus="running" agentCount={4} />
		</div>
	);
}

export function AgentProgressDemoEarlyProgress() {
	return (
		<div className="flex items-center justify-center p-6">
			<AgentsProgress planTitle="New Feature Build" planVisualIdentity={resolvePlanVisualIdentity("New Feature Build")} taskStatusGroups={TASKS_EARLY} runStatus="running" agentCount={1} />
		</div>
	);
}

export function AgentProgressDemoMultipleRuns() {
	return (
		<div className="flex items-center justify-center p-6">
			<AgentsProgress planTitle="Iterative Refinement" planVisualIdentity={resolvePlanVisualIdentity("Iterative Refinement")} taskStatusGroups={TASKS_MIXED} runStatus="running" runCount={3} agentCount={5} />
		</div>
	);
}

export function AgentProgressDemoAllStates() {
	return (
		<div className="flex flex-col items-center gap-6 p-6">
			<AgentsProgress planTitle="Running Plan" planVisualIdentity={resolvePlanVisualIdentity("Running Plan")} taskStatusGroups={TASKS_MIXED} runStatus="running" agentCount={6} />
			<AgentsProgress
				planTitle="Completed Plan"
				planVisualIdentity={resolvePlanVisualIdentity("Completed Plan")}
				taskStatusGroups={TASKS_ALL_DONE}
				runStatus="completed"
				runCreatedAt="2025-01-15T10:00:00Z"
				runCompletedAt="2025-01-15T10:10:51Z"
				agentCount={4}
			/>
			<AgentsProgress
				planTitle="Failed Plan"
				planVisualIdentity={resolvePlanVisualIdentity("Failed Plan")}
				taskStatusGroups={TASKS_EARLY}
				runStatus="failed"
				runCreatedAt="2025-01-15T10:00:00Z"
				runCompletedAt="2025-01-15T10:03:22Z"
				agentCount={3}
			/>
		</div>
	);
}

// The header timer (`• {elapsed}`) is driven by the shared @/lib/elapsed-time helpers
// via runCreatedAt / runCompletedAt. This example documents those three states in place
// of a standalone elapsed-time page.
export function AgentProgressDemoElapsedTime() {
	const runningStartedAt = useTimestampAgo(243_000); // started ~4m 03s before the demo mounted
	return (
		<div className="flex flex-col items-center gap-6 p-6">
			<div className="flex w-full max-w-sm flex-col gap-2">
				<span className="text-xs font-medium text-text-subtlest">Running — live timer counts up from runCreatedAt</span>
				<AgentsProgress planTitle="Live Run" planVisualIdentity={resolvePlanVisualIdentity("Live Run")} taskStatusGroups={TASKS_MIXED} runStatus="running" runCreatedAt={runningStartedAt} agentCount={6} />
			</div>
			<div className="flex w-full max-w-sm flex-col gap-2">
				<span className="text-xs font-medium text-text-subtlest">Completed — frozen at runCompletedAt − runCreatedAt</span>
				<AgentsProgress planTitle="Finished Run" planVisualIdentity={resolvePlanVisualIdentity("Finished Run")} taskStatusGroups={TASKS_ALL_DONE} runStatus="completed" runCreatedAt="2025-01-15T10:00:00Z" runCompletedAt="2025-01-15T10:05:29Z" agentCount={4} />
			</div>
			<div className="flex w-full max-w-sm flex-col gap-2">
				<span className="text-xs font-medium text-text-subtlest">Missing start — falls back to 0m 00s</span>
				<AgentsProgress planTitle="Unknown Start" planVisualIdentity={resolvePlanVisualIdentity("Unknown Start")} taskStatusGroups={TASKS_EARLY} runStatus="running" runCreatedAt={null} agentCount={2} />
			</div>
		</div>
	);
}
