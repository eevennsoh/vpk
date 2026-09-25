export const ACTIVE_WORK_ITEM_CONTEXT_END: string;
export const ACTIVE_WORK_ITEM_CONTEXT_START: string;
export const VPK_HTML_SKILL_ID: string;
export const WORK_ITEM_REPORT_REQUEST_END: string;
export const WORK_ITEM_REPORT_REQUEST_START: string;

export function buildWorkItemReportRequestContext(input?: {
	contextDescription?: string | null;
	promptText?: string | null;
	skillId?: string;
}): string | null;

export function extractActiveWorkItemContext(contextDescription?: string | null): string | null;
export function extractWorkItemReportTitle(contextDescription?: string | null): string;
export function findVpkHtmlSkillId(skills?: unknown[]): string;
export function hasActiveWorkItemContext(contextDescription?: string | null): boolean;
export function isWorkItemReportIntent(promptText?: string | null): boolean;
export function resolveWorkItemReportRequest(input?: {
	contextDescription?: string | null;
	promptText?: string | null;
	skills?: unknown[];
}): {
	artifactBackendPreference: "ai-gateway" | null;
	contextBlock: string | null;
	hasContext: boolean;
	isIntent: boolean;
	shouldCreateArtifact: boolean;
	shouldLoadSkill: boolean;
	skillId: string;
	title: string;
};
