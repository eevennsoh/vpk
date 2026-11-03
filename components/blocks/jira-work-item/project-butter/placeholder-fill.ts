import type { WorkItemPerson } from "@/app/contexts/context-work-item-modal";
import type { JiraActivityActor, JiraActivityCommentEntry } from "@/components/blocks/jira-activity/jira-activity-types";
import type { ProjectButterAttachment } from "@/components/blocks/jira-work-item/project-butter/attachment-data";
import { splitFileName } from "@/components/blocks/jira-work-item/project-butter/attachment-model";
import { PROJECT_BUTTER_SESSION_EPOCH } from "@/components/blocks/jira-work-item/project-butter/data";
import type { ProjectButterDetailFields } from "@/components/blocks/jira-work-item/project-butter/details-model";
import { projectButterPersonAvatar } from "@/components/blocks/jira-work-item/project-butter/people";
import type { ProjectButterRelatedItem, ProjectButterRelatedStatus } from "@/components/blocks/jira-work-item/project-butter/related-model";

export interface ProjectButterWorkItemPlaceholder {
	description: string;
	reporter: string;
	parent?: { code: string; title: string };
	labels: readonly string[];
	components: readonly string[];
	fixVersion: string;
	acceptanceCriteria: string;
	costCenter: "RD-100-ENGINEERING" | "MKT-200-GROWTH" | "OPS-300-CORE";
	children: readonly {
		key: string;
		summary: string;
		status: "To do" | "In progress" | "In review" | "Done";
		priority: "Highest" | "High" | "Medium" | "Low" | "Lowest";
		assignee: string;
		estimate?: string;
		dueDate?: string;
	}[];
	linked: readonly {
		key: string;
		summary: string;
		status: "To do" | "In progress" | "In review" | "Done";
		priority: "Highest" | "High" | "Medium" | "Low" | "Lowest";
		assignee: string;
		relationship: "Blocks" | "Relates to" | "Blocked by" | "Clones";
	}[];
	attachments: readonly {
		id: string;
		kind: ProjectButterAttachment["kind"];
		name: string;
		addedBy: string;
		dateAdded: string;
		url?: string;
		previewSrc?: string;
	}[];
	comments: readonly {
		id: string;
		author: string;
		markdown: string;
		timestamp: string;
		ageMs: number;
		replies?: readonly { id: string; author: string; markdown: string }[];
	}[];
}

export type ProjectButterPlaceholderMap = Readonly<Record<string, ProjectButterWorkItemPlaceholder>>;

function personActor(name: string): JiraActivityActor {
	return {
		id: `butter-person-${name.toLowerCase().replaceAll(" ", "-")}`,
		name,
		kind: "person",
		avatarSrc: projectButterPersonAvatar(name),
	};
}

function formatParent(parent: ProjectButterWorkItemPlaceholder["parent"]): string {
	if (!parent) return "";
	return parent.title ? `${parent.code} ${parent.title}` : parent.code;
}

export function projectButterPlaceholderReporter(placeholder: ProjectButterWorkItemPlaceholder): WorkItemPerson {
	return { name: placeholder.reporter, avatarUrl: projectButterPersonAvatar(placeholder.reporter) };
}

/** Placeholder dates read "16 Aug 2026"; attachments store ISO timestamps (noon UTC keeps the day stable). */
function placeholderIsoDate(value: string): string {
	const parsed = Date.parse(`${value} 12:00 UTC`);
	return Number.isNaN(parsed) ? value : new Date(parsed).toISOString();
}

export function projectButterPlaceholderAttachments(placeholder: ProjectButterWorkItemPlaceholder): ProjectButterAttachment[] {
	return placeholder.attachments.map((item) => {
		const date = placeholderIsoDate(item.dateAdded);
		const named = item.kind === "file" || item.kind === "image" || item.kind === "video" ? splitFileName(item.name) : { name: item.name };
		return { id: item.id, kind: item.kind, ...named, addedBy: item.addedBy, dateAdded: date, updatedAt: date, url: item.url, previewSrc: item.previewSrc };
	});
}

/** Butter related rows have no "In review" status; board placeholders that use it read as in progress. */
export function relatedStatusFromPlaceholder(status: ProjectButterWorkItemPlaceholder["children"][number]["status"]): ProjectButterRelatedStatus {
	return status === "In review" ? "In progress" : status;
}

export function projectButterPlaceholderRelated(placeholder: ProjectButterWorkItemPlaceholder): {
	children: ProjectButterRelatedItem[];
	linked: ProjectButterRelatedItem[];
} {
	return {
		children: placeholder.children.map((item) => ({
			id: item.key,
			key: item.key,
			summary: item.summary,
			priority: item.priority,
			assignee: item.assignee,
			status: relatedStatusFromPlaceholder(item.status),
			estimate: item.estimate,
			dueDate: item.dueDate,
		})),
		linked: placeholder.linked.map((item) => ({
			id: `linked-${item.key}`,
			key: item.key,
			summary: item.summary,
			priority: item.priority,
			assignee: item.assignee,
			status: relatedStatusFromPlaceholder(item.status),
			relationship: item.relationship,
		})),
	};
}

export function projectButterPlaceholderComments(placeholder: ProjectButterWorkItemPlaceholder): JiraActivityCommentEntry[] {
	return placeholder.comments.map((comment) => {
		const createdAtMs = PROJECT_BUTTER_SESSION_EPOCH - comment.ageMs;
		return {
			id: comment.id,
			kind: "comment",
			actor: personActor(comment.author),
			timestamp: comment.timestamp,
			createdAtMs,
			body: [{ type: "text", text: comment.markdown }],
			defaultRepliesExpanded: false,
			replyPreviewCount: 1,
			replies: comment.replies?.map((reply, index) => ({
				id: reply.id,
				actor: personActor(reply.author),
				timestamp: comment.timestamp,
				createdAtMs: createdAtMs + (index + 1) * 60_000,
				body: reply.markdown,
			})),
		};
	});
}

export function projectButterPlaceholderDetails(
	fields: ProjectButterDetailFields,
	placeholder: ProjectButterWorkItemPlaceholder,
): ProjectButterDetailFields {
	return {
		...fields,
		parent: fields.parent || formatParent(placeholder.parent),
		labels: fields.labels.length > 0 ? fields.labels : [...placeholder.labels],
		components: fields.components.length > 0 ? fields.components : [...placeholder.components],
		fixVersion: fields.fixVersion || placeholder.fixVersion,
		costCenter: fields.costCenter || placeholder.costCenter,
	};
}
