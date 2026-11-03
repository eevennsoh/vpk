import type { SuggestionEvidenceKind, SuggestionFieldId, WorkItemSuggestion } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";

/**
 * The provenance map groups evidence into the distinct places it came from, so two pieces of evidence
 * from the same PRD share one source node. Order follows first use down the suggestion list, which keeps
 * connector curves short and mostly parallel.
 */
export type ProvenanceSourceId = "prd" | "review" | "history" | "epic" | "weekly" | "slack" | "dashboard";

export interface ProvenanceSource {
	id: ProvenanceSourceId;
	kind: SuggestionEvidenceKind;
	title: string;
	/** Product or place, shown before the meta, e.g. "Confluence". */
	place: string;
	meta: string;
}

export const PROVENANCE_SOURCES: readonly ProvenanceSource[] = [
	{ id: "prd", kind: "confluence", title: "Onboarding PRD", place: "Confluence", meta: "2d ago" },
	{ id: "review", kind: "loom", title: "Design review", place: "Loom", meta: "Oct 28 · 24 min" },
	{ id: "history", kind: "history", title: "Onboarding history", place: "Jira", meta: "90 days" },
	{ id: "epic", kind: "jira", title: "PAY-100 epic", place: "Jira", meta: "GA Dec 18" },
	{ id: "weekly", kind: "loom", title: "Weekly sync", place: "Loom", meta: "Oct 28 · 30 min" },
	{ id: "slack", kind: "slack", title: "#payments-sdk-v2", place: "Slack", meta: "Oct 30" },
	{ id: "dashboard", kind: "confluence", title: "Q4 GA dashboard", place: "Confluence", meta: "Yesterday" },
];

const EVIDENCE_SOURCE: Readonly<Record<string, ProvenanceSourceId>> = {
	prd: "prd",
	metrics: "prd",
	review: "review",
	history: "history",
	component: "history",
	similar: "history",
	release: "epic",
	siblings: "epic",
	weekly: "weekly",
	slack: "slack",
	dashboard: "dashboard",
};

export function sourceOfEvidence(evidenceId: string): ProvenanceSourceId | undefined {
	return EVIDENCE_SOURCE[evidenceId];
}

/** Distinct sources behind one suggestion, in source-column order. */
export function sourcesForSuggestion(suggestion: WorkItemSuggestion): readonly ProvenanceSource[] {
	const ids = new Set(suggestion.reason.evidence.map((item) => sourceOfEvidence(item.id)));
	return PROVENANCE_SOURCES.filter((source) => ids.has(source.id));
}

export interface ProvenanceEdge {
	suggestionId: SuggestionFieldId;
	sourceId: ProvenanceSourceId;
}

export function provenanceEdges(suggestions: readonly WorkItemSuggestion[]): readonly ProvenanceEdge[] {
	return suggestions.flatMap((suggestion) =>
		sourcesForSuggestion(suggestion).map((source) => ({ suggestionId: suggestion.id, sourceId: source.id })),
	);
}

/** "Merchant onboarding PRD and Onboarding design review" for the row footer and screen readers. */
export function joinTitles(titles: readonly string[]): string {
	if (titles.length <= 1) return titles[0] ?? "";
	return `${titles.slice(0, -1).join(", ")} and ${titles.at(-1)}`;
}
