import type { ComponentDetail } from "@/app/data/component-detail-types";

export const TASK_DETAIL: ComponentDetail = {
	description:
		"A unit of work the agent runs, with the steps it took. Task is a collapsible Trace: the title says what is happening, and the steps underneath update as the agent works.",
	usage: `import { Task, TaskContent, TaskItem, TaskTrigger } from "@/components/ui/task";

<Task>
  <TaskTrigger title="Found the project files" />
  <TaskContent>
    <TaskItem>Searched for generateMetadata</TaskItem>
    <TaskItem>Read app/layout.tsx</TaskItem>
  </TaskContent>
</Task>`,
	props: [
		{
			name: "title",
			type: "string",
			required: true,
			description: "TaskTrigger only. The task title; pass children to render a custom TraceLine.",
		},
		{
			name: "defaultOpen",
			type: "boolean",
			default: "true",
			description: "Task only. Whether the steps start expanded.",
		},
		{
			name: "status",
			type: '"running" | "error" | "pending"',
			description: "TaskItem only. Step status, passed to TraceLine.",
		},
	],
	subComponents: [
		{ name: "Task", description: "Trace with a TraceCollapsible." },
		{ name: "TaskTrigger", description: "TraceCollapsibleTrigger with the task title." },
		{ name: "TaskContent", description: "Kept-mounted TraceCollapsibleContent with a Trace of steps." },
		{ name: "TaskItem", description: "One step, as a TraceLine." },
		{ name: "TaskItemFile", description: "Inline file chip for a step." },
	],
};
