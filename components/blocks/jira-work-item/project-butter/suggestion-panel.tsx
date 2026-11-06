"use client";

import { useState } from "react";

import { JiraSuggestionControl } from "@/components/blocks/jira-suggestion";
import { FOLLOW_UP_SUGGESTIONS, WORK_ITEM_SUGGESTIONS, type SuggestionFieldId, type SuggestionValue, type WorkItemSuggestion } from "@/components/blocks/jira-suggestion/data/suggestions";
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

function suggestionReason(suggestion: ProjectButterSuggestion, profile: "default" | "payments"): Pick<WorkItemSuggestion, "confidence" | "reason"> {
	const example = profile === "payments" ? [...WORK_ITEM_SUGGESTIONS, ...FOLLOW_UP_SUGGESTIONS].find((item) => item.id === suggestion.field) : undefined;
	if (example) {
		const detail = suggestion.field === "description"
			? "The onboarding PRD and design review focus on helping merchants get from setup to a first test payment. The suggestion turns that context into a practical SDK quickstart."
			: suggestion.field === "labels"
				? "The onboarding and sdk-v2 labels connect this item to related SDK adoption work."
				: suggestion.field === "components"
					? "Related work under PAY-100 uses the Payments SDK component."
					: example.reason.detail;
		return { confidence: example.confidence, reason: { ...example.reason, detail } };
	}
	const source = profile === "payments" ? "Payments SDK v2 planning" : "Similar work items";
	const headline = suggestion.field === "storyPoints" && profile === "payments"
		? "A five-point estimate fits the onboarding quickstart."
		: `${suggestion.label} is suggested from related work.`;
	const detail = suggestion.field === "storyPoints" && profile === "payments"
		? "The estimate accounts for setup guidance, sandbox payment examples, and error handling."
		: `The suggested value, ${suggestion.preview}, is a starting point based on this example project's context.`;
	return { confidence: "medium", reason: { headline, detail, evidence: [{ id: `butter-${suggestion.field}`, kind: "history", title: source, meta: "Example project context" }] } };
}

function toCard(suggestion: ProjectButterSuggestion, profile: "default" | "payments"): WorkItemSuggestion {
	return {
		id: suggestion.field,
		label: suggestion.label,
		currentDisplay: `Add ${suggestion.label.toLowerCase()}`,
		value: suggestionValue(suggestion),
		valueText: suggestion.field === "description" ? suggestion.text : suggestion.preview,
		...suggestionReason(suggestion, profile),
	};
}

/** Connect the shared suggestion stack to Butter's editable fields. */
export function ProjectButterSuggestionPanel({ fill, profile = "default", showIntroLoading = false }: Readonly<{ fill: ProjectButterSuggestionFill; profile?: "default" | "payments"; showIntroLoading?: boolean }>) {
	const [saved, setSaved] = useState<readonly ProjectButterSuggestion[]>(fill.suggestions);
	const additions = fill.suggestions.filter((suggestion) => !saved.some((item) => item.field === suggestion.field));
	const suggestions = additions.length ? [...saved, ...additions] : saved;
	if (additions.length) setSaved(suggestions);
	const cards = [...fill.suggestions, ...suggestions.filter((item) => !fill.suggestions.some((current) => current.field === item.field))].map((suggestion) => toCard(suggestion, profile));
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
	const dismiss = (id: SuggestionFieldId) => {
		const suggestion = find(id);
		if (!suggestion) return;
		fill.dismissField(suggestion.field);
		review.dismiss(id);
	};
	const undo = (id: SuggestionFieldId) => {
		const suggestion = find(id);
		if (suggestion && review.decisionOf(id) === "accepted") fill.undoField(suggestion);
		if (suggestion && review.decisionOf(id) === "dismissed") fill.restoreDismissedField(suggestion.field);
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
			acceptAll: () => {
				if (!pending.length) return;
				fill.acceptAll(fill.suggestions.filter((suggestion) => pending.some((item) => item.id === suggestion.field)));
				pending.forEach((suggestion) => review.accept(suggestion.id));
			},
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
			<JiraSuggestionControl feed={feed} showIntroLoading={showIntroLoading} sources={SOURCES} />
		</div>
	);
}
