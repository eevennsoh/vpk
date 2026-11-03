import ClockIcon from "@atlaskit/icon/core/clock";

import type { TwgToolSource } from "@/components/ui-custom/twg-tool";

import type { SuggestionEvidence, SuggestionEvidenceKind, WorkItemSuggestion } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";

const KIND_LABEL: Record<SuggestionEvidenceKind, string> = {
	confluence: "Confluence",
	loom: "Loom",
	jira: "Jira",
	slack: "Slack",
	history: "Work history",
};

/** One app-stack source per evidence kind, so a logo maps to where the evidence lives. */
export function evidenceSource(kind: SuggestionEvidenceKind): TwgToolSource {
	switch (kind) {
		case "confluence":
			return { id: kind, label: KIND_LABEL[kind], provider: "confluence" };
		case "loom":
			return { id: kind, label: KIND_LABEL[kind], provider: "loom" };
		case "jira":
			return { id: kind, label: KIND_LABEL[kind], provider: "jira" };
		case "slack":
			return { id: kind, label: KIND_LABEL[kind], provider: "twg", name: "slack" };
		case "history":
			return {
				id: kind,
				label: KIND_LABEL[kind],
				provider: "twg",
				icon: <span className="flex size-full items-center justify-center rounded-[inherit] bg-bg-neutral text-icon-subtle"><ClockIcon color="currentColor" label="" size="small" /></span>,
			};
		default: {
			const unreachable: never = kind;
			return unreachable;
		}
	}
}

export function evidenceKindLabel(kind: SuggestionEvidenceKind): string {
	return KIND_LABEL[kind];
}

/** Every distinct evidence item across the suggestions, for the "from N sources" summary. */
export function allEvidence(suggestions: readonly WorkItemSuggestion[]): readonly SuggestionEvidence[] {
	const seen = new Map<string, SuggestionEvidence>();
	for (const suggestion of suggestions) {
		for (const evidence of suggestion.reason.evidence) seen.set(`${suggestion.id}:${evidence.id}`, evidence);
	}
	return [...seen.values()];
}

/** Distinct app sources in first-seen order, for the review bar's app stack. */
export function distinctSources(evidence: readonly SuggestionEvidence[]): readonly TwgToolSource[] {
	const kinds = [...new Set(evidence.map((item) => item.kind))];
	return kinds.map(evidenceSource);
}
