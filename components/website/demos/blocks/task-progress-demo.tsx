"use client";

import TaskProgress from "@/components/blocks/task-progress/page";
import { useTimestampAgo } from "@/hooks/use-timestamp-ago";
import { resolvePlanVisualIdentity } from "@/components/projects/shared/lib/plan-identity";
import type { ProgressStatusGroups } from "@/components/blocks/task-progress/data/mock-tasks";

const TASKS_MIXED: ProgressStatusGroups = {
	done: [
		{ id: "d1", label: "#1 Set up CI pipeline", description: "GitHub Actions workflow configured" },
		{ id: "d2", label: "#2 Configure linting rules", description: "" },
	],
	inReview: [
		{ id: "r1", label: "#3 Implement search API", description: "Full-text search with Elasticsearch", agentName: "Backend Agent" },
		{ id: "r2", label: "#4 Add pagination component", description: "" },
	],
	inProgress: [
		{ id: "p1", label: "#5 Build dashboard widgets", description: "Charts, stats cards, and activity feed", agentName: "Frontend Agent" },
		{ id: "p2", label: "#6 Integrate analytics SDK", description: "" },
	],
	failed: [
		{ id: "f1", label: "#7 Recover failed analytics migration", description: "Schema conflict on events table" },
	],
	todo: [
		{ id: "t1", label: "#8 Write integration tests", description: "API and E2E coverage" },
		{ id: "t2", label: "#9 Update documentation", description: "" },
		{ id: "t3", label: "#10 Deploy to staging", description: "" },
	],
};

const TASKS_ALL_DONE: ProgressStatusGroups = {
	done: [
		{ id: "d1", label: "#1 Set up CI pipeline", description: "" },
		{ id: "d2", label: "#2 Configure linting rules", description: "" },
		{ id: "d3", label: "#3 Implement search API", description: "", agentName: "Backend Agent" },
		{ id: "d4", label: "#4 Write integration tests", description: "" },
	],
	inReview: [],
	inProgress: [],
	failed: [],
	todo: [],
};

const TASKS_EARLY: ProgressStatusGroups = {
	done: [],
	inReview: [],
	inProgress: [{ id: "p1", label: "#1 Analyze codebase structure", description: "Mapping dependencies and conventions", agentName: "Explorer Agent" }],
	failed: [],
	todo: [
		{ id: "t1", label: "#2 Set up CI pipeline", description: "" },
		{ id: "t2", label: "#3 Configure linting rules", description: "ESLint + Prettier" },
		{ id: "t3", label: "#4 Implement search API", description: "" },
		{ id: "t4", label: "#5 Write integration tests", description: "" },
		{ id: "t5", label: "#6 Update documentation", description: "README and API reference" },
	],
};

const TASKS_WITH_AGENTS: ProgressStatusGroups = {
	done: [{ id: "d1", label: "#1 Set up CI pipeline", description: "", agentName: "DevOps Agent" }],
	inReview: [
		{ id: "r1", label: "#2 Implement search API", description: "", agentName: "Backend Agent" },
		{ id: "r2", label: "#3 Build search UI", description: "", agentName: "Frontend Agent" },
	],
	inProgress: [{ id: "p1", label: "#4 Write integration tests", description: "", agentName: "QA Agent" }],
	failed: [],
	todo: [{ id: "t1", label: "#5 Deploy to staging", description: "", agentName: "DevOps Agent" }],
};

export default function TaskProgressDemo() {
	return (
		<div className="flex w-full flex-col items-center gap-8 p-8">
			<div className="flex w-full max-w-[800px] flex-col gap-2">
				<span className="text-xs font-medium text-text-subtlest">Running</span>
				<TaskProgress taskStatusGroups={TASKS_MIXED} />
			</div>
			<div className="flex w-full max-w-[800px] flex-col gap-2">
				<span className="text-xs font-medium text-text-subtlest">Completed (collapsed — click to expand)</span>
				<TaskProgress taskStatusGroups={TASKS_ALL_DONE} runStatus="completed" runCompletedAt="2025-01-15T10:10:51Z" runCreatedAt="2025-01-15T10:00:00Z" defaultCollapsed onDelete={() => {}} />
			</div>
		</div>
	);
}

export function TaskProgressDemoRunning() {
	return (
		<div className="flex w-full items-center justify-center p-6">
			<TaskProgress planTitle="Sprint Planning" planVisualIdentity={resolvePlanVisualIdentity("Sprint Planning")} taskStatusGroups={TASKS_MIXED} runStatus="running" agentCount={6} />
		</div>
	);
}

export function TaskProgressDemoCompleted() {
	return (
		<div className="flex w-full items-center justify-center p-6">
			<TaskProgress
				planTitle="Code Review Sweep"
				planVisualIdentity={resolvePlanVisualIdentity("Code Review Sweep")}
				taskStatusGroups={TASKS_ALL_DONE}
				runStatus="completed"
				runCreatedAt="2025-01-15T10:00:00Z"
				runCompletedAt="2025-01-15T10:10:51Z"
				agentCount={4}
				onDelete={() => {}}
			/>
		</div>
	);
}

export function TaskProgressDemoFailed() {
	return (
		<div className="flex w-full items-center justify-center p-6">
			<TaskProgress
				planTitle="Deploy Pipeline"
				planVisualIdentity={resolvePlanVisualIdentity("Deploy Pipeline")}
				taskStatusGroups={{
					done: [{ id: "d1", label: "#1 Build artifacts", description: "Docker image pushed to registry" }],
					inReview: [],
					inProgress: [],
					failed: [
						{ id: "f1", label: "#2 Run smoke tests", description: "Timeout on health check endpoint" },
						{ id: "f2", label: "#3 Deploy to production", description: "" },
					],
					todo: [
						{ id: "t1", label: "#4 Prepare rollback plan", description: "" },
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

export function TaskProgressDemoCollapsed() {
	return (
		<div className="flex w-full items-center justify-center p-6">
			<TaskProgress planTitle="Flexible Friday Plan" planVisualIdentity={resolvePlanVisualIdentity("Flexible Friday Plan")} taskStatusGroups={TASKS_ALL_DONE} runStatus="completed" runCreatedAt="2025-01-15T10:00:00Z" runCompletedAt="2025-01-15T10:10:51Z" defaultCollapsed onDelete={() => {}} />
		</div>
	);
}

export function TaskProgressDemoCollapsedRunning() {
	return (
		<div className="flex w-full items-center justify-center p-6">
			<TaskProgress planTitle="Background Tasks" planVisualIdentity={resolvePlanVisualIdentity("Background Tasks")} runStatus="running" agentCount={8} defaultCollapsed />
		</div>
	);
}

export function TaskProgressDemoWithAgents() {
	return (
		<div className="flex w-full items-center justify-center p-6">
			<TaskProgress planTitle="Multi-Agent Sprint" planVisualIdentity={resolvePlanVisualIdentity("Multi-Agent Sprint")} taskStatusGroups={TASKS_WITH_AGENTS} runStatus="running" agentCount={4} />
		</div>
	);
}

export function TaskProgressDemoEarlyProgress() {
	return (
		<div className="flex w-full items-center justify-center p-6">
			<TaskProgress planTitle="New Feature Build" planVisualIdentity={resolvePlanVisualIdentity("New Feature Build")} taskStatusGroups={TASKS_EARLY} runStatus="running" agentCount={1} />
		</div>
	);
}

export function TaskProgressDemoMultipleRuns() {
	return (
		<div className="flex w-full items-center justify-center p-6">
			<TaskProgress planTitle="Iterative Refinement" planVisualIdentity={resolvePlanVisualIdentity("Iterative Refinement")} taskStatusGroups={TASKS_MIXED} runStatus="running" runCount={3} agentCount={5} />
		</div>
	);
}

export function TaskProgressDemoAllStates() {
	return (
		<div className="flex w-full flex-col items-center gap-6 p-6">
			<TaskProgress planTitle="Running Plan" planVisualIdentity={resolvePlanVisualIdentity("Running Plan")} taskStatusGroups={TASKS_MIXED} runStatus="running" agentCount={6} />
			<TaskProgress
				planTitle="Completed Plan"
				planVisualIdentity={resolvePlanVisualIdentity("Completed Plan")}
				taskStatusGroups={TASKS_ALL_DONE}
				runStatus="completed"
				runCreatedAt="2025-01-15T10:00:00Z"
				runCompletedAt="2025-01-15T10:10:51Z"
				agentCount={4}
				onDelete={() => {}}
			/>
			<TaskProgress
				planTitle="Failed Plan"
				planVisualIdentity={resolvePlanVisualIdentity("Failed Plan")}
				taskStatusGroups={TASKS_EARLY}
				runStatus="failed"
				runCreatedAt="2025-01-15T10:00:00Z"
				runCompletedAt="2025-01-15T10:03:22Z"
				agentCount={3}
				onDelete={() => {}}
			/>
		</div>
	);
}

// The header timer (`• {elapsed}`) is driven by the shared @/lib/elapsed-time helpers
// via runCreatedAt / runCompletedAt. This example documents those three states in place
// of a standalone elapsed-time page.
export function TaskProgressDemoElapsedTime() {
	const runningStartedAt = useTimestampAgo(243_000); // started ~4m 03s before the demo mounted
	return (
		<div className="flex w-full flex-col items-center gap-6 p-6">
			<div className="flex w-full max-w-[800px] flex-col gap-2">
				<span className="text-xs font-medium text-text-subtlest">Running — live timer counts up from runCreatedAt</span>
				<TaskProgress planTitle="Live Run" planVisualIdentity={resolvePlanVisualIdentity("Live Run")} taskStatusGroups={TASKS_MIXED} runStatus="running" runCreatedAt={runningStartedAt} agentCount={6} />
			</div>
			<div className="flex w-full max-w-[800px] flex-col gap-2">
				<span className="text-xs font-medium text-text-subtlest">Completed — frozen at runCompletedAt − runCreatedAt</span>
				<TaskProgress planTitle="Finished Run" planVisualIdentity={resolvePlanVisualIdentity("Finished Run")} taskStatusGroups={TASKS_ALL_DONE} runStatus="completed" runCreatedAt="2025-01-15T10:00:00Z" runCompletedAt="2025-01-15T10:05:29Z" agentCount={4} onDelete={() => {}} />
			</div>
			<div className="flex w-full max-w-[800px] flex-col gap-2">
				<span className="text-xs font-medium text-text-subtlest">Missing start — falls back to 0m 00s</span>
				<TaskProgress planTitle="Unknown Start" planVisualIdentity={resolvePlanVisualIdentity("Unknown Start")} taskStatusGroups={TASKS_EARLY} runStatus="running" runCreatedAt={null} agentCount={2} />
			</div>
		</div>
	);
}
