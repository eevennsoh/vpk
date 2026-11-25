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

const butterFields: JiraFilterField[] = [
	{
		id: "agentStatus",
		label: "Agent status",
		multiple: true,
		options: [
			{ value: "working", label: "Working" },
			{ value: "needsInput", label: "Needs input" },
			{ value: "finished", label: "Complete" },
		],
	},
	{
		id: "prStatus",
		label: "Pull request",
		multiple: true,
		options: [
			{ value: "open", label: "Open" },
			{ value: "merged", label: "Merged" },
			{ value: "closed", label: "Closed" },
			{ value: "none", label: "No PR" },
		],
	},
	{
		id: "assignee",
		label: "Assignee",
		multiple: true,
		options: [
			{ value: "imani", label: "Imani Okafor" },
			{ value: "issac", label: "Issac Varghese" },
			{ value: "priya", label: "Priya Hansra" },
			{ value: "liam", label: "Liam Estrada" },
			{ value: "kayla", label: "Kayla Parajuli" },
			{ value: "raul", label: "Raul Gonzalez" },
			{ value: "olivia", label: "Olivia Yang" },
		],
	},
	{
		id: "epic",
		label: "Epic",
		multiple: true,
		options: [
			{ value: "hmi", label: "R1S HMI redesign" },
			{ value: "interior", label: "R1S interior experience" },
			{ value: "lighting", label: "R1S lighting experience" },
		],
	},
	{
		id: "sprint",
		label: "Sprint",
		multiple: true,
		options: [
			{ value: "backlog", label: "Backlog" },
			{ value: "planning", label: "Planning" },
			{ value: "in-progress", label: "In progress" },
			{ value: "in-review", label: "In review" },
			{ value: "done", label: "Done" },
		],
	},
	{
		id: "type",
		label: "Work type",
		multiple: true,
		options: [
			{ value: "task", label: "Task" },
			{ value: "story", label: "Story" },
			{ value: "epic", label: "Epic" },
		],
	},
	{
		id: "label",
		label: "Labels",
		multiple: true,
		options: [
			{ value: "hmi", label: "HMI" },
			{ value: "accessibility", label: "Accessibility" },
			{ value: "animation", label: "Animation" },
			{ value: "camera", label: "Camera" },
			{ value: "exterior", label: "Exterior" },
			{ value: "interior", label: "Interior" },
			{ value: "lighting", label: "Lighting" },
			{ value: "off-road", label: "Off-road" },
		],
	},
	{
		id: "status",
		label: "Status",
		multiple: true,
		options: [
			{ value: "to-do", label: "To do" },
			{ value: "planning", label: "Planning" },
			{ value: "in-progress", label: "In progress" },
			{ value: "in-review", label: "In review" },
			{ value: "done", label: "Done" },
		],
	},
	...fields.filter((field) =>
		[
			"priority",
			"project",
			"dueDate",
			"agent",
			"sessionType",
			"untracked",
		].includes(field.id),
	),
];

export default function JiraFilterPage({
	variant = "default",
	headingAs = "h1",
}: Readonly<{ variant?: "default" | "project-butter"; headingAs?: "h1" | "h4" }>) {
	const [value, setValue] = useState<JiraFilterCondition[]>([]);
	const [savedView, setSavedView] = useState("");
	return (
		<div className="min-h-[520px] w-full p-8">
			<div className="mx-auto max-w-4xl">
				<Heading as={headingAs} size="small" className="mb-2">
					Work items
				</Heading>
				<p className="mb-5 text-sm text-text-subtle">
					Choose a filter to narrow your board.
				</p>
				<JiraFilter
					variant={variant}
					fields={variant === "project-butter" ? butterFields : fields}
					value={value}
					onChange={setValue}
					initialSavedFilters={saved}
					initialRecentFilterIds={["reviews", "backlog", "prs"]}
					onSaveView={() => setSavedView("View saved")}
					onSaveAsView={(name) => setSavedView(`View saved: ${name}`)}
				/>
				<p className="mt-4 text-sm text-text-subtlest">
					{value.length
						? `${value.length} active filter ${value.length === 1 ? "field" : "fields"}`
						: "No filters applied"}
				</p>
				{savedView ? (
					<p role="status" className="mt-2 text-sm text-text-subtle">
						{savedView}
					</p>
				) : null}
			</div>
		</div>
	);
}
