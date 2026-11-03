import type { SuggestionEvidenceKind, WorkItemSuggestion } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";

export interface SourceMeta {
	/** Product or system the evidence lives in. */
	name: string;
	/** What kind of artifact inside that product, shown after the name. */
	detail: string;
}

export const SOURCE_META: Readonly<Record<SuggestionEvidenceKind, SourceMeta>> = {
	confluence: { name: "Confluence", detail: "Onboarding PRD and GA dashboard" },
	loom: { name: "Loom", detail: "Recorded meetings" },
	jira: { name: "Jira", detail: "Releases and epics" },
	slack: { name: "Slack", detail: "Channel messages" },
	history: { name: "Jira history", detail: "Similar work in PAY" },
};

export interface SourceGroup {
	kind: SuggestionEvidenceKind;
	suggestions: readonly WorkItemSuggestion[];
}

/** Groups suggestions by their primary (first) evidence source, keeping first-seen order. */
export function groupByPrimarySource(suggestions: readonly WorkItemSuggestion[]): readonly SourceGroup[] {
	const groups = new Map<SuggestionEvidenceKind, WorkItemSuggestion[]>();
	for (const suggestion of suggestions) {
		const kind = suggestion.reason.evidence[0]?.kind ?? "history";
		const bucket = groups.get(kind);
		if (bucket) bucket.push(suggestion);
		else groups.set(kind, [suggestion]);
	}
	return [...groups].map(([kind, items]) => ({ kind, suggestions: items }));
}

/** "Why we suggested Robi Lopez" for short values, "Why we suggested this description" for long ones. */
export function whyTitle(suggestion: WorkItemSuggestion): string {
	switch (suggestion.value.kind) {
		case "person":
			return `Why we suggested ${suggestion.value.person.name}`;
		case "date":
			return `Why we suggested ${suggestion.value.display}`;
		case "issue":
			return `Why we suggested ${suggestion.value.issue.key}`;
		case "labels":
			return "Why we suggested these labels";
		default:
			return `Why we suggested this ${suggestion.label.toLowerCase()}`;
	}
}

export const CONFIDENCE_LABEL = { high: "High confidence", medium: "Medium confidence" } as const;

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
	return `${count} ${count === 1 ? singular : plural}`;
}
