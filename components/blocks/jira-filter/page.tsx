"use client";

import { useState } from "react";
import { Heading } from "@/components/ui/heading";
import {
	JiraFilter,
	type JiraFilterCondition,
	type JiraFilterField,
	type JiraSavedFilter,
} from "@/components/blocks/jira-filter";

const fields: JiraFilterField[] = [
	{
		id: "assignee",
		label: "Assignee",
		multiple: true,
		options: [
			{ value: "imani", label: "Imani" },
			{ value: "priya", label: "Priya" },
			{ value: "unassigned", label: "Unassigned" },
		],
	},
	{
		id: "type",
		label: "Type",
		multiple: true,
		options: [
			{ value: "story", label: "Story" },
			{ value: "task", label: "Task" },
			{ value: "bug", label: "Bug" },
			{ value: "epic", label: "Epic" },
		],
	},
	{
		id: "priority",
		label: "Priority",
		multiple: true,
		options: [
			{ value: "highest", label: "Highest" },
			{ value: "high", label: "High" },
			{ value: "medium", label: "Medium" },
			{ value: "low", label: "Low" },
		],
	},
	{
		id: "status",
		label: "Status",
		multiple: true,
		options: [
			{ value: "to-do", label: "To do" },
			{ value: "in-progress", label: "In progress" },
			{ value: "in-review", label: "In review" },
			{ value: "done", label: "Done" },
		],
	},
	{
		id: "project",
		label: "Project",
		multiple: true,
		options: [
			{ value: "payments", label: "Payments" },
			{ value: "platform", label: "Platform" },
		],
	},
	{
		id: "label",
		label: "Label",
		multiple: true,
		options: [
			{ value: "frontend", label: "Frontend" },
			{ value: "backend", label: "Backend" },
		],
	},
	{
		id: "prStatus",
		label: "Pull request",
		multiple: true,
		options: [
			{ value: "open", label: "Open" },
			{ value: "merged", label: "Merged" },
			{ value: "none", label: "No PR" },
		],
	},
	{
		id: "agentStatus",
		label: "Agent status",
		multiple: true,
		options: [
			{ value: "working", label: "Working" },
			{ value: "needsInput", label: "Needs input" },
			{ value: "finished", label: "Finished" },
		],
	},
	{
		id: "boardColumn",
		label: "Board column",
		multiple: true,
		options: [
			{ value: "backlog", label: "Backlog" },
			{ value: "in-progress", label: "In progress" },
			{ value: "done", label: "Done" },
		],
	},
	{
		id: "dueDate",
		label: "Date",
		multiple: true,
		options: [
			{ value: "overdue", label: "Overdue" },
			{ value: "this-week", label: "This week" },
		],
	},
	{
		id: "agent",
		label: "Agent",
		multiple: true,
		options: [
			{ value: "rovo", label: "Rovo" },
			{ value: "code-agent", label: "Code agent" },
		],
	},
	{
		id: "untracked",
		label: "Untracked",
		options: [
			{ value: "true", label: "Show" },
			{ value: "false", label: "Hide" },
		],
	},
	{
		id: "sessionType",
		label: "Session type",
		options: [
			{ value: "cloud", label: "Cloud" },
			{ value: "local", label: "Local" },
		],
	},
];
const saved: JiraSavedFilter[] = [
	{
		id: "reviews",
		name: "High-priority reviews",
		group: "personal",
		conditions: [
			{ field: "status", operator: "is", values: ["in-review"] },
			{ field: "priority", operator: "is", values: ["high", "highest"] },
		],
	},
	{
		id: "backlog",
		name: "High-priority backlog",
		group: "team",
		conditions: [
			{ field: "status", operator: "is", values: ["to-do"] },
			{ field: "priority", operator: "is", values: ["high"] },
		],
	},
	{
		id: "planning",
		name: "Planning stories",
		group: "team",
		conditions: [
			{ field: "type", operator: "is", values: ["story"] },
			{ field: "status", operator: "is", values: ["to-do"] },
		],
	},
	{
		id: "imani",
		name: "Imani’s open work",
		group: "personal",
		conditions: [{ field: "assignee", operator: "is", values: ["imani"] }],
	},
	{
		id: "prs",
		name: "Open pull requests",
		group: "default",
		conditions: [{ field: "prStatus", operator: "is", values: ["open"] }],
	},
	{
		id: "bugs",
		name: "Bugs",
		group: "default",
		conditions: [{ field: "type", operator: "is", values: ["bug"] }],
	},
];

export default function JiraFilterPage() {
	const [value, setValue] = useState<JiraFilterCondition[]>([]);
	return (
		<div className="min-h-[520px] w-full p-8">
			<div className="mx-auto max-w-4xl">
				<Heading as="h1" size="small" className="mb-2">
					Work items
				</Heading>
				<p className="mb-5 text-sm text-text-subtle">
					Choose a filter to narrow your board.
				</p>
				<JiraFilter
					fields={fields}
					value={value}
					onChange={setValue}
					initialSavedFilters={saved}
					initialRecentFilterIds={["reviews", "backlog", "prs"]}
				/>
				<p className="mt-4 text-sm text-text-subtlest">
					{value.length
						? `${value.length} active filter ${value.length === 1 ? "field" : "fields"}`
						: "No filters applied"}
				</p>
			</div>
		</div>
	);
}
