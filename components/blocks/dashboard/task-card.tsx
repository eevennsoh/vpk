import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lozenge } from "@/components/ui/lozenge";
import { Tag } from "@/components/ui/tag";
import type { Task, TaskStatus } from "@/app/data/dashboard-sample";
import { getTeamMember } from "@/app/data/dashboard-sample";

interface TaskCardProps {
	task: Task;
	/**
	 * Optional callback when card is clicked
	 */
	onClick?: () => void;
}

/**
 * Maps task status to Lozenge variant
 */
function getStatusVariant(status: TaskStatus): "neutral" | "information" | "success" | "danger" {
	switch (status) {
		case "todo":
			return "neutral";
		case "inprogress":
			return "information";
		case "done":
			return "success";
		default:
			return "neutral";
	}
}

/**
 * Maps task priority to Badge variant
 */
function getPriorityVariant(priority: string): "neutral" | "danger" | "warning" {
	switch (priority) {
		case "High":
			return "danger";
		case "Medium":
			return "warning";
		case "Low":
			return "neutral";
		default:
			return "neutral";
	}
}

/**
 * TaskCard component displays a single task with all metadata
 *
 * Renders:
 * - Task summary as Card title
 * - Status as Lozenge indicator
 * - Priority as Badge (color-coded by priority level)
 * - Task type as Tag
 * - Assignee as Avatar with name
 */
export function TaskCard({ task, onClick }: TaskCardProps) {
	const assignee = getTeamMember(task.assigneeId);
	const statusText = task.status === "inprogress" ? "In Progress" : task.status === "todo" ? "To Do" : "Done";

	return (
		<Card
			className="cursor-pointer transition-shadow hover:shadow-md"
			onClick={onClick}
		>
			<CardHeader>
				<CardTitle className="text-sm leading-snug">{task.summary}</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="flex flex-col gap-3">
					{/* Status, Priority, Type row */}
					<div className="flex flex-wrap items-center gap-2">
						<Lozenge
							variant={getStatusVariant(task.status)}
							isBold={task.status !== "todo"}
						>
							{statusText}
						</Lozenge>
						<Badge variant={getPriorityVariant(task.priority)}>{task.priority}</Badge>
						<Tag color="standard">{task.type}</Tag>
					</div>

					{/* Assignee row */}
					{assignee ? <div className="flex items-center gap-2">
							<Avatar size="xs" shape="circle">
								<AvatarFallback>{assignee.initials}</AvatarFallback>
							</Avatar>
							<span className="text-xs text-text-subtle">{assignee.name}</span>
						</div> : null}

					{/* Task ID and dates */}
					<div className="flex justify-between text-xs text-text-subtle">
						<span>{task.id}</span>
						<span>Updated {formatDate(task.updatedAt)}</span>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

/**
 * Helper function to format date as relative time (e.g., "2d ago")
 * Falls back to short date format if date is outside recent range
 */
function formatDate(dateString: string): string {
	try {
		const date = new Date(dateString);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffDays === 0) return "today";
		if (diffDays === 1) return "yesterday";
		if (diffDays < 7) return `${diffDays}d ago`;
		if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;

		// Fallback to short date format
		return date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
		});
	} catch {
		return "unknown";
	}
}
