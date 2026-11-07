"use client";

import { StandardJiraKanban, type JiraKanbanProps } from "./index";
import { ExperimentalJiraKanban, type ExperimentalJiraKanbanProps } from "./experimental/experimental-jira-kanban";

type JiraKanbanVariantProps =
	| (ExperimentalJiraKanbanProps & { variant?: "project-butter" })
	| (JiraKanbanProps & { variant: "standard" });

export function JiraKanban({ variant = "project-butter", ...props }: Readonly<JiraKanbanVariantProps>) {
	if (variant === "standard") return <StandardJiraKanban {...props} />;
	return (
		<ExperimentalJiraKanban
			cardAppearance="project-butter"
			iconScale="comfortable"
			columnSizing="content"
			issueSelectionAppearance="fused-backdrop"
			{...props}
		/>
	);
}
