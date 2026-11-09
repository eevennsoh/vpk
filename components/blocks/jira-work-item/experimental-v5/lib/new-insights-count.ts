import type { JiraWorkItemContextResources } from "@/components/blocks/jira-work-item/data/session-state";

/** Seeded count for filled / Golden Journey surfaces so the notification is visible. */
export const DEFAULT_NEW_INSIGHTS_COUNT = 2;

/**
 * Optional notification count for the Insights tab (same source the composer
 * "new insights" pill used).
 *
 * An explicit `override` always wins (including 0, which hides the number).
 * Otherwise a filled context (TL;DR, next steps, or attachments) seeds the
 * default count; empty work items stay at 0.
 */
export function resolveNewInsightsCount(
	context: Pick<JiraWorkItemContextResources, "attachments" | "nextSteps" | "tldr">,
	override?: number,
): number {
	if (override != null) {
		return Math.max(0, override);
	}
	const hasSeed = context.tldr.length > 0
		|| context.nextSteps.length > 0
		|| context.attachments.length > 0;
	return hasSeed ? DEFAULT_NEW_INSIGHTS_COUNT : 0;
}
