import type { WorkItemData } from "@/app/contexts/context-work-item-modal";

export const PROJECT_BUTTER_DETAIL_FIELDS = {
	status: "Status",
	assignee: "Assignee",
	priority: "Priority",
	dueDate: "Due Date",
	parent: "Parent",
	labels: "Labels",
	components: "Components",
	fixVersion: "Fix Version",
	acceptanceCriteria: "Acceptance Criteria",
	reporter: "Reporter",
	costCenter: "Cost Center",
	campaignGoal: "Campaign goal",
	campaignBudget: "Campaign budget",
	targetPlatforms: "Target platforms",
	estimatedReach: "Estimated Reach",
	audienceSegment: "Audience segment",
	campaignRegion: "Campaign region",
	costPerReach: "Cost per reach",
	assetObject: "Assets single object field",
} as const;

export type ProjectButterDetailFieldId = keyof typeof PROJECT_BUTTER_DETAIL_FIELDS;
export type ProjectButterDetailFields = {
	order: ProjectButterDetailFieldId[];
	hidden: ProjectButterDetailFieldId[];
	parent: string;
	labels: string[];
	components: string[];
	fixVersion: string;
	acceptanceCriteria: string;
	costCenter: string;
	campaignGoal: string;
	campaignBudget: string;
	targetPlatforms: string[];
	estimatedReach: string;
	audienceSegment: string;
	campaignRegion: { region: string; market: string };
	assetObject: string;
};

export const PROJECT_BUTTER_REQUIRED_DETAIL_FIELDS: readonly ProjectButterDetailFieldId[] = ["status", "assignee", "priority"];

export function createProjectButterDetailFields(empty: boolean, workItem?: WorkItemData): ProjectButterDetailFields {
	const reference = !empty && !workItem;
	return {
		order: Object.keys(PROJECT_BUTTER_DETAIL_FIELDS) as ProjectButterDetailFieldId[],
		hidden: [],
		parent: workItem?.parent ? `${workItem.parent.code}${workItem.parent.title ? ` ${workItem.parent.title}` : ""}` : reference ? "VITA-22 User Experience Overhaul" : "",
		labels: workItem?.labels ?? (reference ? ["social-media", "website-traffic"] : []),
		components: reference ? ["Frontend", "Design System"] : [],
		fixVersion: reference ? "v2.0" : "",
		acceptanceCriteria: reference ? "90% of new users complete onboarding in 1 week" : "",
		costCenter: reference ? "RD-100-ENGINEERING" : "",
		campaignGoal: "",
		campaignBudget: "",
		targetPlatforms: [],
		estimatedReach: "",
		audienceSegment: "",
		campaignRegion: { region: "", market: "" },
		assetObject: "",
	};
}

export function reorderProjectButterDetailFields(order: readonly ProjectButterDetailFieldId[], activeId: string | number, overId: string | number | null): ProjectButterDetailFieldId[] {
	const from = order.indexOf(activeId as ProjectButterDetailFieldId);
	const to = overId === null ? -1 : order.indexOf(overId as ProjectButterDetailFieldId);
	if (from < 0 || to < 0 || from === to) return [...order];
	const next = [...order];
	const [field] = next.splice(from, 1);
	next.splice(to, 0, field);
	return next;
}

export function projectButterCostPerReach(fields: Pick<ProjectButterDetailFields, "campaignBudget" | "estimatedReach">): string {
	const budget = Number(fields.campaignBudget.replace(/[^0-9.]/gu, ""));
	const reach = Number(fields.estimatedReach.replace(/[^0-9.]/gu, ""));
	if (!Number.isFinite(budget) || !Number.isFinite(reach) || budget <= 0 || reach <= 0) return "";
	const result = budget / reach;
	return `$${result >= 0.01 ? result.toFixed(2) : result.toFixed(4).replace(/0+$/u, "").replace(/\.$/u, "")}`;
}

export const PROJECT_BUTTER_DETAIL_OPTIONS = {
	parent: ["VITA-22 User Experience Overhaul", "VITA-23 Improve product experience", "VITA-24 Platform improvements"],
	labels: ["social-media", "website-traffic", "marketing-campaign", "performance-optimization", "seo-strategy", "email-marketing", "content-creation", "lead-generation", "customer-retention", "brand-awareness", "paid-search", "influencer-outreach", "conversion-rate", "event-promotion", "product-launch"],
	components: ["Frontend", "Backend", "API", "Database", "Mobile", "Infrastructure", "Design System"],
	fixVersion: ["v1.0", "v1.1", "v1.2", "v2.0", "v2.1", "Unversioned"],
	costCenter: ["RD-100-ENGINEERING", "MKT-200-GROWTH", "OPS-300-CORE"],
	targetPlatforms: ["Instagram", "TikTok", "Facebook", "X (Twitter)", "LinkedIn", "YouTube", "Pinterest", "Threads"],
	assetObject: Array.from({ length: 16 }, (_, index) => `Asset ${index + 1}`),
} as const;

export const PROJECT_BUTTER_CAMPAIGN_MARKETS: Readonly<Record<string, readonly string[]>> = {
	Americas: ["United States", "Canada", "Brazil"],
	EMEA: ["United Kingdom", "Germany", "France"],
	APAC: ["Australia", "Japan", "Singapore"],
};
