import type { JiraActivityEventIcon } from "@/components/blocks/jira-activity";

export interface ProjectButterReferenceChange {
	id: string;
	actor: string;
	timestamp: string;
	icon: JiraActivityEventIcon;
	action: string;
	changes: readonly { label: string; before?: string; after?: string }[];
	pinned?: boolean;
}

export interface ProjectButterReferenceComment {
	id: string;
	author: string;
	agent?: string;
	isAgent: boolean;
	timestamp: string;
	markdown: string;
	replies?: readonly ProjectButterReferenceComment[];
}
