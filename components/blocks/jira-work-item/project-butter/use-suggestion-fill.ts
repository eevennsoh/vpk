"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

import { getShimmerWaveEndTime } from "@/components/ui-custom/lib/shimmer-wave-timing";
import { motionDuration } from "@/lib/motion";
import {
	applyProjectButterSuggestion,
	listProjectButterSuggestions,
	revertMatchingProjectButterSuggestions,
	type ProjectButterSuggestion,
	type ProjectButterSuggestionField,
	type ProjectButterSuggestionSnapshot,
} from "@/components/blocks/jira-work-item/project-butter/suggestion-model";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
import { DETAILS_RAIL_GLIDE, SUGGESTION_REVEAL_DURATION, SUGGESTION_REVEAL_SPREAD } from "@/components/blocks/jira-work-item/project-butter/details-rail";
import type { ProjectButterDetailFieldId } from "@/components/blocks/jira-work-item/project-butter/details-model";

const FILL_STEP_MS = DETAILS_RAIL_GLIDE.layout.duration * 1000;

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => {
		window.setTimeout(resolve, ms);
	});
}

function settleLayout(): Promise<void> {
	return new Promise((resolve) => {
		window.requestAnimationFrame(() => {
			window.requestAnimationFrame(() => resolve());
		});
	});
}

function suggestionSnapshot(content: ProjectButterContent): ProjectButterSuggestionSnapshot {
	return {
		description: content.description,
		descriptionDraft: content.descriptionDraft,
		dueDate: content.dueDate,
		reporter: content.reporter,
		parent: content.detailFields.parent,
		labels: content.detailFields.labels,
		components: content.detailFields.components,
		fixVersion: content.detailFields.fixVersion,
		storyPoints: content.detailFields.storyPoints,
		costCenter: content.detailFields.costCenter,
	};
}

export interface ProjectButterSuggestionFill {
	acceptAll: (batch?: readonly ProjectButterSuggestion[]) => void;
	acceptField: (suggestion: ProjectButterSuggestion) => void;
	accepted: readonly ProjectButterSuggestion[] | null;
	activeField: ProjectButterSuggestionField | null;
	/** Details row the filling bar sits below while Accept all runs. */
	barAfter: ProjectButterDetailFieldId | "top" | null;
	columnId: string;
	dismissAccepted: () => void;
	dismissField: (field: ProjectButterSuggestionField) => void;
	restoreDismissedField: (field: ProjectButterSuggestionField) => void;
	undoField: (suggestion: ProjectButterSuggestion) => void;
	running: boolean;
	settleField: (field: ProjectButterDetailFieldId) => void;
	shimmerText: Readonly<Partial<Record<ProjectButterDetailFieldId, string>>>;
	suggestions: readonly ProjectButterSuggestion[];
	undoAccepted: () => void;
}

/**
 * Review and playback for the Butter suggestion state.
 * One field commits immediately. Accept all slides the filling bar down the details rail.
 */
export function useProjectButterSuggestionFill(
	content: ProjectButterContent,
	enabled: boolean,
	onRevealMore: () => void,
	profile: "default" | "payments" = "default",
	onDescriptionSuggested?: (text: string) => void,
): ProjectButterSuggestionFill {
	const shouldReduceMotion = useReducedMotion() ?? false;
	const columnId = useId();
	const runId = useRef(0);
	const activeBatch = useRef<readonly ProjectButterSuggestion[]>([]);
	const undoneFields = useRef(new Set<ProjectButterSuggestionField>());
	const shimmerTimers = useRef(new Map<ProjectButterDetailFieldId, number>());
	const batchHandoffTimer = useRef<number | undefined>(undefined);
	const batchHandoffFields = useRef(new Map<ProjectButterDetailFieldId, string>());
	const contentRef = useRef(content);
	const acceptedTarget = useRef<ProjectButterContent | null>(null);
	const revealRef = useRef(onRevealMore);
	const descriptionRevealRef = useRef(onDescriptionSuggested);
	const reducedRef = useRef(shouldReduceMotion);
	const [running, setRunning] = useState(false);
	const [activeField, setActiveField] = useState<ProjectButterSuggestionField | null>(null);
	const [barAfter, setBarAfter] = useState<ProjectButterDetailFieldId | "top" | null>(null);
	const [dismissed, setDismissed] = useState<ReadonlySet<ProjectButterSuggestionField>>(() => new Set());
	const [accepted, setAccepted] = useState<readonly ProjectButterSuggestion[] | null>(null);
	const [shimmerText, setShimmerText] = useState<Readonly<Partial<Record<ProjectButterDetailFieldId, string>>>>({});

	useEffect(() => {
		contentRef.current = content;
		revealRef.current = onRevealMore;
		descriptionRevealRef.current = onDescriptionSuggested;
		reducedRef.current = shouldReduceMotion;
	});

	useEffect(() => () => {
		runId.current += 1;
		for (const timer of shimmerTimers.current.values()) window.clearTimeout(timer);
		if (batchHandoffTimer.current !== undefined) window.clearTimeout(batchHandoffTimer.current);
	}, []);

	const suggestions = enabled
		? listProjectButterSuggestions({
			description: content.description,
			descriptionDraft: content.descriptionDraft,
			dueDate: content.dueDate,
			reporter: content.reporter,
			parent: content.detailFields.parent,
			labels: content.detailFields.labels,
			components: content.detailFields.components,
			fixVersion: content.detailFields.fixVersion,
			storyPoints: content.detailFields.storyPoints,
			costCenter: content.detailFields.costCenter,
		}, profile)
			.filter((suggestion) => !dismissed.has(suggestion.field) && (suggestion.field === "description" || (content.detailFields.order.includes(suggestion.field) && !content.detailFields.hidden.includes(suggestion.field))))
			.sort((a, b) => (a.field === "description" ? -1 : content.detailFields.order.indexOf(a.field)) - (b.field === "description" ? -1 : content.detailFields.order.indexOf(b.field)))
		: [];

	function finishShimmer(field: ProjectButterDetailFieldId, text: string) {
		const timer = shimmerTimers.current.get(field);
		if (timer !== undefined) window.clearTimeout(timer);
		shimmerTimers.current.delete(field);
		setShimmerText((current) => {
			if (current[field] !== text) return current;
			const next = { ...current };
			delete next[field];
			return next;
		});
	}

	function settleField(field: ProjectButterDetailFieldId) {
		const timer = shimmerTimers.current.get(field);
		if (timer !== undefined) window.clearTimeout(timer);
		shimmerTimers.current.delete(field);
		batchHandoffFields.current.delete(field);
		setShimmerText((current) => {
			if (!(field in current)) return current;
			const next = { ...current };
			delete next[field];
			return next;
		});
	}

	function finishBatchHandoff() {
		if (batchHandoffTimer.current !== undefined) window.clearTimeout(batchHandoffTimer.current);
		batchHandoffTimer.current = undefined;
		const fields = new Map(batchHandoffFields.current);
		batchHandoffFields.current.clear();
		setShimmerText((current) => {
			const next = { ...current };
			for (const [field, text] of fields) if (next[field] === text) delete next[field];
			return next;
		});
	}

	function shimmerField(suggestion: ProjectButterSuggestion, batch = false): number {
		if (suggestion.field === "description") return 0;
		const previous = shimmerTimers.current.get(suggestion.field);
		if (previous !== undefined) window.clearTimeout(previous);
		shimmerTimers.current.delete(suggestion.field);
		batchHandoffFields.current.delete(suggestion.field);
		setShimmerText((current) => ({ ...current, [suggestion.field]: suggestion.preview }));
		const holdMs = getShimmerWaveEndTime(suggestion.preview, SUGGESTION_REVEAL_DURATION, SUGGESTION_REVEAL_SPREAD) * 1000 + 40;
		if (batch) {
			batchHandoffFields.current.set(suggestion.field, suggestion.preview);
			return holdMs;
		}
		const timer = window.setTimeout(() => finishShimmer(suggestion.field, suggestion.preview), holdMs);
		shimmerTimers.current.set(suggestion.field, timer);
		return holdMs;
	}

	/** Rows' outer boxes carry no layout transform, so this scrolls to where the bar is heading, not where it is mid-glide. */
	function revealRow(field: ProjectButterDetailFieldId) {
		const container = document.querySelector(`[data-project-butter-suggestion-fields="${CSS.escape(columnId)}"]`);
		const row = container?.querySelector(`[data-field-id="${field}"]`);
		if (row instanceof HTMLElement) row.scrollIntoView({ block: "nearest", behavior: "smooth" });
	}

	function acceptField(suggestion: ProjectButterSuggestion) {
		undoneFields.current.delete(suggestion.field);
		revealRef.current();
		if (suggestion.field === "description" && (contentRef.current.description.trim() || contentRef.current.descriptionDraft.trim())) return;
		applyProjectButterSuggestion(suggestion, contentRef.current);
		if (suggestion.field === "description" && !reducedRef.current) descriptionRevealRef.current?.(suggestion.text);
		if (suggestion.field !== "description" && !reducedRef.current) shimmerField(suggestion);
	}

	function dismissField(field: ProjectButterSuggestionField) {
		if (running) return;
		setDismissed((current) => {
			const next = new Set(current);
			next.add(field);
			return next;
		});
	}

	function rememberAccepted(batch: readonly ProjectButterSuggestion[], target: ProjectButterContent) {
		acceptedTarget.current = target;
		setAccepted(batch);
	}

	function undoAccepted() {
		const batch = accepted;
		const target = acceptedTarget.current;
		if (!batch || !target) return;
		runId.current += 1;
		const live = contentRef.current;
		if (live.setDueDate === target.setDueDate) {
			revertMatchingProjectButterSuggestions(batch, suggestionSnapshot(live), target);
		}
		acceptedTarget.current = null;
		setAccepted(null);
		setRunning(false);
		setActiveField(null);
		setBarAfter(null);
		for (const timer of shimmerTimers.current.values()) window.clearTimeout(timer);
		shimmerTimers.current.clear();
		if (batchHandoffTimer.current !== undefined) window.clearTimeout(batchHandoffTimer.current);
		batchHandoffTimer.current = undefined;
		batchHandoffFields.current.clear();
		setShimmerText({});
	}

	function dismissAccepted() {
		acceptedTarget.current = null;
		setAccepted(null);
	}

	async function acceptAll(selected: readonly ProjectButterSuggestion[] = suggestions) {
		const batch = selected.filter((suggestion) => suggestions.some((item) => item.field === suggestion.field));
		if (batch.length === 0) return;
		if (running) {
			for (const suggestion of batch) acceptField(suggestion);
			return;
		}
		if (batchHandoffTimer.current !== undefined) finishBatchHandoff();
		const target = contentRef.current;
		const applied: ProjectButterSuggestion[] = [];
		let revealFinishesAt = 0;
		activeBatch.current = batch;
		undoneFields.current.clear();
		revealRef.current();
		if (reducedRef.current) {
			for (const suggestion of batch) {
				if (suggestion.field === "description" && (contentRef.current.description.trim() || contentRef.current.descriptionDraft.trim())) continue;
				applyProjectButterSuggestion(suggestion, target);
				applied.push(suggestion);
			}
			if (applied.length) rememberAccepted(applied, target);
			activeBatch.current = [];
			return;
		}
		const id = ++runId.current;
		setRunning(true);
		await wait(motionDuration.slow * 1000);
		if (id !== runId.current) return;
		const description = batch.find((suggestion) => suggestion.field === "description");
		if (description && !undoneFields.current.has("description") && !contentRef.current.description.trim() && !contentRef.current.descriptionDraft.trim()) {
			setActiveField("description");
			applyProjectButterSuggestion(description, target);
			if (!reducedRef.current) descriptionRevealRef.current?.(description.text);
			applied.push(description);
		}
		const detailSuggestions = batch.filter((suggestion) => suggestion.field !== "description");
		const rail = target.detailFields.order.filter((field) => !target.detailFields.hidden.includes(field));
		if (detailSuggestions.length && rail.length) {
			setBarAfter("top");
			await settleLayout();
			if (id !== runId.current) return;
			await wait(motionDuration.fast * 1000);
			for (const [index, field] of rail.entries()) {
				if (id !== runId.current) return;
				const stepStart = performance.now();
				const suggestion = detailSuggestions.find((item) => item.field === field && !undoneFields.current.has(item.field));
				setActiveField(suggestion?.field ?? null);
				setBarAfter(field);
				if (suggestion) {
					applyProjectButterSuggestion(suggestion, target);
					revealFinishesAt = Math.max(revealFinishesAt, performance.now() + shimmerField(suggestion, true));
				}
				if (suggestion) applied.push(suggestion);
				await settleLayout();
				if (id !== runId.current) return;
				revealRow(rail[index + 1] ?? field);
				await wait(Math.max(0, FILL_STEP_MS - (performance.now() - stepStart)));
			}
			await wait(DETAILS_RAIL_GLIDE.layout.duration * 1000);
		}
		if (id !== runId.current) return;
		setActiveField(null);
		setBarAfter(null);
		if (applied.length) rememberAccepted(applied, target);
		if (batchHandoffFields.current.size) {
			batchHandoffTimer.current = window.setTimeout(finishBatchHandoff, Math.max(0, revealFinishesAt - performance.now()));
		}
		activeBatch.current = [];
		setRunning(false);
	}

	return {
		acceptAll: (batch) => {
			void acceptAll(batch);
		},
		acceptField,
		accepted,
		activeField,
		barAfter,
		columnId,
		dismissAccepted,
		dismissField,
		restoreDismissedField: (field) => setDismissed((current) => {
			const next = new Set(current);
			next.delete(field);
			return next;
		}),
		running,
		settleField,
		shimmerText,
		suggestions,
		undoAccepted,
		undoField: (suggestion) => {
			if (suggestion.field !== "description") {
				settleField(suggestion.field);
			}
			if (activeBatch.current.some((item) => item.field === suggestion.field)) {
				undoneFields.current.add(suggestion.field);
				if (activeBatch.current.every((item) => undoneFields.current.has(item.field))) {
					runId.current += 1;
					activeBatch.current = [];
					setRunning(false);
					setActiveField(null);
					setBarAfter(null);
				}
			}
			revertMatchingProjectButterSuggestions([suggestion], suggestionSnapshot(contentRef.current), contentRef.current);
		},
	};
}
