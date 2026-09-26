import type { CSSProperties } from "react";

/** Undefined keeps the usual issue-card selection; defined modes select its well. */
export type JiraIssueSelectionBackdrop = "rest" | "single" | "start" | "middle" | "end";

export const JIRA_ISSUE_BACKDROP_STYLE: CSSProperties = {
	borderRadius: "10px",
	transformOrigin: "top center",
};

export function resolveJiraIssueSelectionBackdrop(mode?: JiraIssueSelectionBackdrop) {
	const joinsBefore = mode === "middle" || mode === "end";
	const joinsAfter = mode === "start" || mode === "middle";
	return {
		active: mode !== undefined && mode !== "rest",
		selected: mode !== undefined && mode !== "rest",
		joinsBefore,
		joinsAfter,
		// Joined cards close the stack gap, so their wells meet without overlap.
		top: 0,
		style: {
			...JIRA_ISSUE_BACKDROP_STYLE,
			borderTopLeftRadius: joinsBefore ? 0 : "10px",
			borderTopRightRadius: joinsBefore ? 0 : "10px",
			borderBottomLeftRadius: joinsAfter ? 0 : "10px",
			borderBottomRightRadius: joinsAfter ? 0 : "10px",
		},
	};
}
