"use client";

import { useState } from "react";

import { JiraSuggestionControl } from "@/components/blocks/jira-suggestion";
import type { SuggestionFieldId, SuggestionValue, WorkItemSuggestion } from "@/components/blocks/jira-suggestion/data/suggestions";
import type { SuggestionFeed, SuggestionRun } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-feed";
import { useSuggestionReview } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-review";
import type { ProjectButterSuggestion } from "@/components/blocks/jira-work-item/project-butter/suggestion-model";
import type { ProjectButterSuggestionFill } from "@/components/blocks/jira-work-item/project-butter/use-suggestion-fill";
import type { TwgToolSource } from "@/components/ui-custom/twg-tool";

const SOURCES = [
	{ id: "twg", label: "Teamwork Graph", provider: "twg" },
	{ id: "jira", label: "Jira", provider: "jira" },
	{ id: "confluence", label: "Confluence", provider: "confluence" },
	{ id: "google-drive", label: "Google Drive", provider: "google-drive" },
] as const satisfies readonly TwgToolSource[];

function suggestionValue(suggestion: ProjectButterSuggestion): SuggestionValue {
	switch (suggestion.field) {
		case "description": return { kind: "paragraph", text: suggestion.text };
		case "dueDate": return { kind: "date", iso: suggestion.date.toISOString(), display: suggestion.preview, relative: "" };
		case "reporter": return { kind: "person", person: { ...suggestion.person, role: "" } };
		case "labels":
		case "components": return { kind: "labels", labels: suggestion.values };
		default: return { kind: "paragraph", text: suggestion.text };
	}
}

function toCard(suggestion: ProjectButterSuggestion): WorkItemSuggestion {
	return {
		id: suggestion.field,
		label: suggestion.label,
		currentDisplay: `Add ${suggestion.label.toLowerCase()}`,
		value: suggestionValue(suggestion),
		valueText: suggestion.field === "description" ? suggestion.text : suggestion.preview,
		confidence: "medium",
		reason: { headline: "Suggested for this empty field.", detail: "", evidence: [] },
	};
}

/** Connect the shared suggestion stack to Butter's editable fields. */
export function ProjectButterSuggestionPanel({ fill }: Readonly<{ fill: ProjectButterSuggestionFill; showIntroLoading?: boolean }>) {
	const [saved, setSaved] = useState<readonly ProjectButterSuggestion[]>(fill.suggestions);
	const additions = fill.suggestions.filter((suggestion) => !saved.some((item) => item.field === suggestion.field));
	const suggestions = additions.length ? [...saved, ...additions] : saved;
	if (additions.length) setSaved(suggestions);
	const cards = [...fill.suggestions, ...suggestions.filter((item) => !fill.suggestions.some((current) => current.field === item.field))].map(toCard);
	const review = useSuggestionReview(cards);
	const [runs, setRuns] = useState<readonly SuggestionRun[]>([{ number: 1, ranAt: "Just now", ids: [] }]);
	const available = new Set(fill.suggestions.map((suggestion) => suggestion.field));
	const pending = review.pending.filter((suggestion) => fill.suggestions.some((item) => item.field === suggestion.id));
	const find = (id: SuggestionFieldId) => suggestions.find((suggestion) => suggestion.field === id);
	const accept = (id: SuggestionFieldId) => {
		const suggestion = find(id);
		if (!suggestion || !available.has(suggestion.field)) return;
		fill.acceptField(suggestion);
		review.accept(id);
	};
	const dismiss = (id: SuggestionFieldId) => review.dismiss(id);
	const undo = (id: SuggestionFieldId) => {
		const suggestion = find(id);
		if (suggestion && review.decisionOf(id) === "accepted") fill.undoField(suggestion);
		review.undo(id);
	};
	const feed: SuggestionFeed = {
		review: {
			...review,
			suggestions: cards.filter((suggestion) => review.decisionOf(suggestion.id) !== "pending" || fill.suggestions.some((item) => item.field === suggestion.id)),
			pending,
			accept,
			dismiss,
			undo,
			acceptAll: () => pending.forEach((suggestion) => accept(suggestion.id)),
			dismissAll: () => pending.forEach((suggestion) => dismiss(suggestion.id)),
		},
		status: "idle",
		runs,
		newIds: new Set(),
		acknowledgeNew: () => {},
		rerun: () => setRuns((current) => [...current, { number: current.length + 1, ranAt: "Just now", ids: [] }]),
		hasMore: false,
	};

	if (!suggestions.length) return null;
	return (
		<div className="sticky top-0 z-40 -mx-6 w-[calc(100%+3rem)] bg-surface px-6 pb-3">
			<JiraSuggestionControl feed={feed} sources={SOURCES} />
		</div>
	);
}
