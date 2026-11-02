export const PROJECT_BUTTER_STATUSES: readonly string[] = ["To do", "In progress", "Done"];

export function projectButterStatusVariant(status: string) {
	return status === "Done" ? "success" : status === "To do" ? "neutral" : status === "In review" ? "discovery" : "information";
}

export function projectButterStatusProgress(status: string): number {
	return status === "Done" ? 100 : status === "To do" ? 0 : status === "In review" ? 75 : 50;
}

export function createProjectButterStatusOptions(status: string): readonly string[] {
	return PROJECT_BUTTER_STATUSES.includes(status) ? PROJECT_BUTTER_STATUSES : [...PROJECT_BUTTER_STATUSES, status];
}
