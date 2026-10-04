export type WorkflowStatusKind =
	| "todo"
	| "in-progress"
	| "in-review"
	| "done"
	| "blocked"
	| "custom";

export type WorkflowLozengeVariant =
	| "neutral"
	| "success"
	| "danger"
	| "information"
	| "discovery"
	| "warning";

interface WorkflowStatusPreset {
	label: string;
	labelClassName: string;
	dotClassName: string;
	lozengeVariant: WorkflowLozengeVariant;
}

export interface WorkflowStatusPresentation extends WorkflowStatusPreset {
	kind: WorkflowStatusKind;
}

const DEFAULT_WORKFLOW_STATUS: WorkflowStatusPreset = {
	label: "Unknown",
	labelClassName: "text-text-subtle",
	dotClassName: "bg-bg-neutral-bold",
	lozengeVariant: "neutral",
};

const WORKFLOW_STATUS_PRESETS: Record<
	Exclude<WorkflowStatusKind, "custom">,
	WorkflowStatusPreset
> = {
	todo: {
		label: "To Do",
		labelClassName: "text-text-subtle",
		dotClassName: "bg-bg-neutral-bold",
		lozengeVariant: "neutral",
	},
	"in-progress": {
		label: "In Progress",
		labelClassName: "text-text",
		dotClassName: "bg-warning",
		lozengeVariant: "information",
	},
	"in-review": {
		label: "In Review",
		labelClassName: "text-text",
		dotClassName: "bg-info",
		lozengeVariant: "information",
	},
	done: {
		label: "Done",
		labelClassName: "text-text",
		dotClassName: "bg-success",
		lozengeVariant: "success",
	},
	blocked: {
		label: "Blocked",
		labelClassName: "text-text-danger",
		dotClassName: "bg-destructive",
		lozengeVariant: "danger",
	},
};

function normalizeStatusText(status: unknown) {
	if (typeof status !== "string") {
		return "";
	}

	return status
		.trim()
		.replace(/[_-]+/g, " ")
		.replace(/\s+/g, " ");
}

export function getWorkflowStatusKind(status: unknown): WorkflowStatusKind {
	const normalizedStatus = normalizeStatusText(status).toLowerCase();

	if (!normalizedStatus) {
		return "custom";
	}

	if (
		normalizedStatus.includes("done") ||
		normalizedStatus.includes("resolved") ||
		normalizedStatus.includes("closed") ||
		normalizedStatus.includes("complete")
	) {
		return "done";
	}

	if (
		normalizedStatus.includes("block") ||
		normalizedStatus.includes("stuck") ||
		normalizedStatus.includes("hold")
	) {
		return "blocked";
	}

	if (
		normalizedStatus.includes("review") ||
		normalizedStatus.includes("testing") ||
		normalizedStatus === "qa"
	) {
		return "in-review";
	}

	if (
		normalizedStatus.includes("progress") ||
		normalizedStatus.includes("active") ||
		normalizedStatus.includes("started") ||
		normalizedStatus.includes("wip")
	) {
		return "in-progress";
	}

	if (
		normalizedStatus.includes("todo") ||
		normalizedStatus === "to do" ||
		normalizedStatus.includes("backlog") ||
		normalizedStatus.includes("open") ||
		normalizedStatus.includes("selected for development") ||
		normalizedStatus.includes("planned") ||
		normalizedStatus.includes("queued")
	) {
		return "todo";
	}

	return "custom";
}

export function getWorkflowStatusPresentation(
	status: unknown,
): WorkflowStatusPresentation {
	const kind = getWorkflowStatusKind(status);
	const normalizedStatus = normalizeStatusText(status);
	const preset =
		kind === "custom"
			? DEFAULT_WORKFLOW_STATUS
			: WORKFLOW_STATUS_PRESETS[kind];

	return {
		kind,
		label: normalizedStatus || preset.label,
		labelClassName: preset.labelClassName,
		dotClassName: preset.dotClassName,
		lozengeVariant: preset.lozengeVariant,
	};
}

export function getWorkflowLozengeVariant(
	status: unknown,
	fallback: WorkflowLozengeVariant = "neutral",
): WorkflowLozengeVariant {
	const kind = getWorkflowStatusKind(status);
	if (kind === "custom") {
		return fallback;
	}

	return WORKFLOW_STATUS_PRESETS[kind].lozengeVariant;
}

/** Known workflow tones take precedence; custom phases follow their board order. */
export function getWorkflowPhaseLozengeVariant(
	status: string,
	phases: readonly string[],
): WorkflowLozengeVariant {
	const index = phases.indexOf(status);
	const fallback = index <= 0 ? "neutral" : index === phases.length - 1 ? "success" : "information";
	return getWorkflowLozengeVariant(status, fallback);
}
