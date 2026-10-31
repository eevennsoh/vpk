import type { ProgressCircleSegment } from "@/components/ui-custom/progress-circle";

export function getButterSubtaskState(status: string | undefined): "todo" | "in-progress" | "done" {
	switch (status?.toLowerCase().replace(/[\s-]/gu, "")) {
		case "done":
			return "done";
		case "inprogress":
			return "in-progress";
		default:
			return "todo";
	}
}

export function formatButterDueDate(value: string | undefined): string | null {
	if (!value) return null;
	return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(
		new Date(`${value}T00:00:00Z`),
	);
}

export function getButterSubtaskProgress(subtasks: readonly { status?: string }[]) {
	let completed = 0;
	let inProgress = 0;
	for (const subtask of subtasks) {
		const status = getButterSubtaskState(subtask.status);
		if (status === "done") completed++;
		else if (status === "in-progress") inProgress++;
	}
	const segments: ProgressCircleSegment[] = [
		{ status: "pending", weight: subtasks.length - completed - inProgress },
		{ status: "in-progress", weight: inProgress },
		{ status: "passed", weight: completed },
	];
	return {
		completed,
		total: subtasks.length,
		segments: segments.filter((segment) => (segment.weight ?? 0) > 0),
	};
}
