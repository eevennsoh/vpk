import { projectButterPersonAvatar } from "../../jira-work-item/project-butter/people.ts";

/**
 * Synthetic suggestions for the empty PAY-999 work item. Every canvas variant renders this same list,
 * so design differences are never data differences. Values are deliberately long: no variant may truncate them.
 */

export type SuggestionEvidenceKind = "confluence" | "loom" | "jira" | "slack" | "history";

export interface SuggestionEvidence {
	id: string;
	kind: SuggestionEvidenceKind;
	title: string;
	/** Who and when, e.g. "Amira Badran · Updated 2 days ago". */
	meta: string;
	/** Quoted passage that supports the suggestion. */
	excerpt?: string;
	/** Loom only: recording length, e.g. "30 min". */
	duration?: string;
}

export interface SuggestionPerson {
	name: string;
	avatarUrl: string;
	role: string;
}

export interface SuggestionIssue {
	key: string;
	summary: string;
	type: "epic" | "story" | "task";
	status: "To do" | "In progress" | "Done";
}

export type SuggestionValue =
	| { kind: "paragraph"; text: string }
	| { kind: "date"; iso: string; display: string; relative: string }
	| { kind: "person"; person: SuggestionPerson }
	| { kind: "issue"; issue: SuggestionIssue }
	| { kind: "labels"; labels: readonly string[] }
	| { kind: "checklist"; items: readonly string[] };

export type SuggestionFieldId = "description" | "assignee" | "dueDate" | "parent" | "labels" | "acceptanceCriteria" | "components" | "fixVersion" | "storyPoints" | "reporter" | "costCenter";

export type SuggestionConfidence = "high" | "medium";

export interface WorkItemSuggestion {
	id: SuggestionFieldId;
	/** Details field label, e.g. "Due date". */
	label: string;
	/** What the field holds today. Every suggestion here targets an empty field. */
	currentDisplay: string;
	value: SuggestionValue;
	/** Plain-text rendering of the value for screen readers and compact summaries. Never truncate it. */
	valueText: string;
	confidence: SuggestionConfidence;
	reason: {
		/** One-sentence answer to "Why this value?" */
		headline: string;
		/** Two or three sentences of supporting reasoning. */
		detail: string;
		evidence: readonly SuggestionEvidence[];
	};
}

export interface SuggestionWorkItem {
	key: string;
	summary: string;
	agent: { name: string; ranAt: string };
}

export const SUGGESTION_WORK_ITEM: SuggestionWorkItem = {
	key: "PAY-999",
	summary: "Improve merchant onboarding for Payments SDK v2",
	agent: { name: "Jira Triage Agent", ranAt: "2m ago" },
};

const ROBI = { name: "Robi Lopez", avatarUrl: projectButterPersonAvatar("Robi Lopez"), role: "Senior engineer · Payments Platform" };
const AMIRA = "Amira Badran";

export const WORK_ITEM_SUGGESTIONS: readonly WorkItemSuggestion[] = [
	{
		id: "description",
		label: "Description",
		currentDisplay: "Add description",
		value: {
			kind: "paragraph",
			text: "Help merchants adopt Payments SDK v2 with a clear onboarding path, from initial setup to their first test payment. Replace the 14-step setup guide with a guided checklist, pre-fill sandbox credentials, and surface integration errors inline instead of in server logs.",
		},
		valueText: "Help merchants adopt Payments SDK v2 with a clear onboarding path, from initial setup to their first test payment. Replace the 14-step setup guide with a guided checklist, pre-fill sandbox credentials, and surface integration errors inline instead of in server logs.",
		confidence: "high",
		reason: {
			headline: "Summarised from the onboarding PRD and last week’s design review.",
			detail: "The PRD names time-to-first-payment as the primary goal, and the design review agreed on a checklist over a long guide. The wording mirrors the PRD’s problem statement so reviewers recognise it.",
			evidence: [
				{ id: "prd", kind: "confluence", title: "Payments SDK v2 — Merchant onboarding PRD", meta: `${AMIRA} · Updated 2 days ago`, excerpt: "Merchants abandon setup at step 9 of 14. Our goal is a first test payment in under 30 minutes." },
				{ id: "review", kind: "loom", title: "Onboarding design review", meta: "Marcus Kim · Recorded Oct 28", duration: "24 min", excerpt: "Let’s kill the long guide and ship a checklist with pre-filled sandbox keys." },
			],
		},
	},
	{
		id: "assignee",
		label: "Assignee",
		currentDisplay: "Automatic",
		value: { kind: "person", person: ROBI },
		valueText: "Robi Lopez",
		confidence: "high",
		reason: {
			headline: "Robi resolved 8 of the last 10 onboarding issues in this space.",
			detail: "Robi owns the SDK setup flow and is the listed component lead for Merchant Onboarding. Their current load is 3 open items, below the team average of 5.",
			evidence: [
				{ id: "history", kind: "history", title: "8 of 10 similar items resolved by Robi", meta: "PAY space · last 90 days", excerpt: "PAY-812, PAY-847, PAY-901 and 5 more share the Merchant Onboarding component." },
				{ id: "component", kind: "jira", title: "Component lead: Merchant Onboarding", meta: "Jira project settings" },
			],
		},
	},
	{
		id: "dueDate",
		label: "Due date",
		currentDisplay: "Add due date",
		value: { kind: "date", iso: "2026-12-15", display: "Dec 15, 2026", relative: "in 6 weeks" },
		valueText: "Dec 15, 2026",
		confidence: "medium",
		reason: {
			headline: "Lands three days before the SDK v2.0 general-availability release.",
			detail: "The parent epic targets GA on Dec 18. Onboarding work historically needs a short buffer for docs review, so the suggestion leaves three working days.",
			evidence: [
				{ id: "release", kind: "jira", title: "Release SDK v2.0 GA — Dec 18, 2026", meta: "PAY releases · 23 of 31 items done" },
				{ id: "weekly", kind: "loom", title: "Weekly sync 28 October 2026", meta: "Andrew Park · 30 min", duration: "30 min", excerpt: "Docs need onboarding frozen by mid-December to make GA." },
			],
		},
	},
	{
		id: "parent",
		label: "Parent",
		currentDisplay: "Add parent",
		value: { kind: "issue", issue: { key: "PAY-100", summary: "Payments SDK v2 migration for enterprise merchants", type: "epic", status: "In progress" } },
		valueText: "PAY-100 Payments SDK v2 migration for enterprise merchants",
		confidence: "high",
		reason: {
			headline: "Four sibling onboarding items already sit under this epic.",
			detail: "PAY-100 is the only open epic that covers SDK v2 adoption. Items with the same component and labels were all parented here during sprint planning.",
			evidence: [
				{ id: "siblings", kind: "jira", title: "PAY-100 has 4 related onboarding children", meta: "PAY-961, PAY-972, PAY-988, PAY-990" },
				{ id: "slack", kind: "slack", title: "#payments-sdk-v2", meta: "Priya Raman · Oct 30", excerpt: "Anything onboarding-related for v2 should roll up to PAY-100 please." },
			],
		},
	},
	{
		id: "labels",
		label: "Labels",
		currentDisplay: "Add label",
		value: { kind: "labels", labels: ["onboarding", "sdk-v2", "merchant-experience", "q4-ga"] },
		valueText: "onboarding, sdk-v2, merchant-experience, q4-ga",
		confidence: "medium",
		reason: {
			headline: "These labels appear on 12 similar items and power the GA dashboard.",
			detail: "The Q4 GA dashboard filters on sdk-v2 and q4-ga. Without them this item won’t show in release reporting.",
			evidence: [
				{ id: "similar", kind: "history", title: "12 similar items use these labels", meta: "PAY space · last 60 days" },
				{ id: "dashboard", kind: "confluence", title: "Q4 GA readiness dashboard", meta: "Priya Raman · Updated yesterday", excerpt: "Filter: labels in (sdk-v2, q4-ga) AND status != Done." },
			],
		},
	},
	{
		id: "acceptanceCriteria",
		label: "Acceptance criteria",
		currentDisplay: "Add acceptance criteria",
		value: {
			kind: "checklist",
			items: [
				"Merchants can complete sandbox setup and send a first test payment in under 30 minutes.",
				"Integration errors appear inline with a suggested fix and a link to the relevant docs.",
				"Setup completion rate is tracked per step in the onboarding analytics dashboard.",
			],
		},
		valueText: "Merchants can complete sandbox setup and send a first test payment in under 30 minutes. Integration errors appear inline with a suggested fix and a link to the relevant docs. Setup completion rate is tracked per step in the onboarding analytics dashboard.",
		confidence: "high",
		reason: {
			headline: "Derived from the PRD’s success metrics.",
			detail: "Each criterion maps to a measurable PRD goal: time to first payment, inline error recovery, and per-step funnel tracking.",
			evidence: [
				{ id: "metrics", kind: "confluence", title: "PRD § Success metrics", meta: `${AMIRA} · Updated 2 days ago`, excerpt: "P0: first test payment < 30 min. P1: inline error recovery. P1: step-level funnel." },
			],
		},
	},
];

/**
 * Suggestions are ongoing: the agent re-runs as the work item changes. This batch only arrives on the next run,
 * so every variant has to reveal new suggestions while earlier ones are already decided.
 */
export const FOLLOW_UP_SUGGESTIONS: readonly WorkItemSuggestion[] = [
	{
		id: "components",
		label: "Components",
		currentDisplay: "None",
		value: { kind: "labels", labels: ["Merchant Onboarding", "Payments SDK"] },
		valueText: "Merchant Onboarding, Payments SDK",
		confidence: "high",
		reason: {
			headline: "Matches the components on PAY-100 and every sibling item.",
			detail: "Once the parent was set, the agent re-checked related work. All four siblings under PAY-100 carry these two components, and Merchant Onboarding routes the item to the right board.",
			evidence: [
				{ id: "siblings-components", kind: "jira", title: "4 of 4 siblings use these components", meta: "PAY-961, PAY-972, PAY-988, PAY-990" },
			],
		},
	},
	{
		id: "fixVersion",
		label: "Fix version",
		currentDisplay: "None",
		value: { kind: "labels", labels: ["SDK v2.0 GA"] },
		valueText: "SDK v2.0 GA",
		confidence: "medium",
		reason: {
			headline: "The Dec 15 due date lands inside the SDK v2.0 GA release window.",
			detail: "Release SDK v2.0 GA ships on Dec 18 and already contains 23 related items. Assigning it keeps release notes and the readiness dashboard complete.",
			evidence: [
				{ id: "release-window", kind: "jira", title: "Release SDK v2.0 GA — Dec 18, 2026", meta: "PAY releases · 23 of 31 items done" },
				{ id: "notes", kind: "confluence", title: "SDK v2.0 release notes (draft)", meta: "Priya Raman · Updated today", excerpt: "Onboarding improvements: guided checklist, pre-filled sandbox keys." },
			],
		},
	},
];
