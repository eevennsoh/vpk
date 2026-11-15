export function createBoardSummaryEditStore() {
	let activeIssueKey: string | null = null;
	const listeners = new Set<() => void>();

	return {
		subscribe(listener: () => void) {
			listeners.add(listener);
			return () => { listeners.delete(listener); };
		},
		isMuted(issueKey: string) {
			return activeIssueKey !== null && activeIssueKey !== issueKey;
		},
		setEditing(issueKey: string, editing: boolean) {
			const next = editing ? issueKey : activeIssueKey === issueKey ? null : activeIssueKey;
			if (next === activeIssueKey) return;
			activeIssueKey = next;
			for (const listener of listeners) listener();
		},
	};
}

export type BoardSummaryEditStore = ReturnType<typeof createBoardSummaryEditStore>;
