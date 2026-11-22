import type { KeyboardEvent } from "react";
import type { JiraListRowData } from "./jira-list-types";

export function getInlineDraftParent(row?: Pick<JiraListRowData, "issueKey" | "parentIssueKey" | "issueType">) {
	if (!row) return undefined;
	if (row.issueType === "subtask") return row.parentIssueKey;
	return row.issueType === "epic" ? undefined : row.issueKey;
}

export function handleInlineDraftKey(
	event: KeyboardEvent<HTMLInputElement>,
	{ parent, previous, onParentChange, onSubmit, onCancel }: Readonly<{
		parent?: string;
		previous?: Pick<JiraListRowData, "issueKey" | "parentIssueKey" | "issueType">;
		onParentChange?: (parent: string | undefined) => void;
		onSubmit?: () => void;
		onCancel?: () => void;
	}>,
) {
	if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
	const indent = event.key === "Tab" && !event.altKey && !event.ctrlKey && !event.metaKey
		? !event.shiftKey
		: (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key === "]"
			? true
			: undefined;
	const outdent = (event.key === "Tab" && event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey)
		|| ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key === "[");
	if ((indent || outdent) && onParentChange) {
		const candidate = getInlineDraftParent(previous);
		if (outdent ? parent !== undefined : parent === undefined && candidate !== undefined) {
			event.preventDefault();
			onParentChange(outdent ? undefined : candidate);
		}
	} else if (event.key === "Enter" && onSubmit) {
		event.preventDefault();
		onSubmit();
	} else if (event.key === "Escape" && onCancel) {
		event.preventDefault();
		event.stopPropagation();
		onCancel();
	}
}
