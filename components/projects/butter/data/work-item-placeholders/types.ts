export interface ButterWorkItemPlaceholder {
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
		kind: "file" | "confluence" | "link" | "image" | "loom" | "google-drive" | "video";
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

export type ButterPlaceholderMap = Readonly<Record<string, ButterWorkItemPlaceholder>>;
