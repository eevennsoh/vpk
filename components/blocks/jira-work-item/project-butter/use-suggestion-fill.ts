"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

import { getShimmerWaveEndTime } from "@/components/ui-custom/lib/shimmer-wave-timing";
import { motionDuration } from "@/lib/motion";
import {
	applyProjectButterSuggestion,
	listProjectButterSuggestions,
	nextProjectButterDemoCheck,
	projectButterSuggestionSnapshot,
	revertMatchingProjectButterSuggestions,
	type ProjectButterSuggestion,
	type ProjectButterSuggestionField,
	type ProjectButterSuggestionProfile,
} from "@/components/blocks/jira-work-item/project-butter/suggestion-model";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
import { FILL_LANDING, FILL_LIFT, fillCursorTravel, SUGGESTION_REVEAL_DURATION, SUGGESTION_REVEAL_SPREAD, type FillCursorPosition } from "@/components/blocks/jira-work-item/project-butter/details-rail";
import type { ProjectButterDetailFieldId } from "@/components/blocks/jira-work-item/project-butter/details-model";

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

function isMainSuggestionField(field: ProjectButterSuggestionField): field is "description" | "acceptanceCriteria" {
	return field === "description" || field === "acceptanceCriteria";
}

export interface DetailSuggestionReveal {
	key: number;
	text: string;
	finish: () => void;
}

export interface ProjectButterSuggestionFill {
	acceptAll: (batch?: readonly ProjectButterSuggestion[]) => void;
	acceptField: (suggestion: ProjectButterSuggestion) => void;
	accepted: readonly ProjectButterSuggestion[] | null;
	activeField: ProjectButterSuggestionField | null;
	cursor: FillCursorPosition | null;
	columnId: string;
	dismissAccepted: () => void;
	dismissField: (field: ProjectButterSuggestionField) => void;
	checkForSuggestions: (() => readonly ProjectButterSuggestionField[]) | undefined;
	hasMoreSuggestions: boolean;
	restoreDismissedField: (field: ProjectButterSuggestionField) => void;
	undoField: (suggestion: ProjectButterSuggestion) => void;
	running: boolean;
	fieldReveals: Readonly<Partial<Record<ProjectButterDetailFieldId, DetailSuggestionReveal>>>;
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
	onRevealMore: () => boolean,
	profile: ProjectButterSuggestionProfile = "default",
	onDescriptionSuggested?: (text: string) => void,
	traverseBatch = true,
): ProjectButterSuggestionFill {
	const shouldReduceMotion = useReducedMotion() ?? false;
	const columnId = useId();
	const runId = useRef(0);
	const activeBatch = useRef<readonly ProjectButterSuggestion[]>([]);
	const undoneFields = useRef(new Set<ProjectButterSuggestionField>());
	const shimmerTimers = useRef(new Map<ProjectButterDetailFieldId, number>());
	const contentRef = useRef(content);
	const acceptedTarget = useRef<ProjectButterContent | null>(null);
	const revealRef = useRef(onRevealMore);
	const descriptionRevealRef = useRef(onDescriptionSuggested);
	const reducedRef = useRef(shouldReduceMotion);
	const [running, setRunning] = useState(false);
	const [cursor, setCursor] = useState<FillCursorPosition | null>(null);
	const [activeField, setActiveField] = useState<ProjectButterSuggestionField | null>(null);
	const [dismissed, setDismissed] = useState<ReadonlySet<ProjectButterSuggestionField>>(() => new Set());
	const [demoChecks, setDemoChecks] = useState(0);
	const [accepted, setAccepted] = useState<readonly ProjectButterSuggestion[] | null>(null);
	const [fieldReveals, setFieldReveals] = useState<ProjectButterSuggestionFill["fieldReveals"]>({});

	useEffect(() => {
		contentRef.current = content;
		revealRef.current = onRevealMore;
		descriptionRevealRef.current = onDescriptionSuggested;
		reducedRef.current = shouldReduceMotion;
	});

	useEffect(() => () => {
		runId.current += 1;
		for (const timer of shimmerTimers.current.values()) window.clearTimeout(timer);
	}, []);

	const snapshot = enabled ? projectButterSuggestionSnapshot(content) : null;
	const demo = enabled && profile === "jira-demo";
	const hasMoreSuggestions = demo && snapshot !== null && nextProjectButterDemoCheck(snapshot, content.detailFields.hidden, demoChecks) !== null;
	const suggestions = snapshot
		? listProjectButterSuggestions(snapshot, profile, demoChecks)
			.filter((suggestion) => !dismissed.has(suggestion.field) && (isMainSuggestionField(suggestion.field) || (content.detailFields.order.includes(suggestion.field) && !content.detailFields.hidden.includes(suggestion.field))))
		: [];
	const railIndex = (field: ProjectButterSuggestionField) => isMainSuggestionField(field) ? -1 : content.detailFields.order.indexOf(field);
	if (profile !== "jira-demo") suggestions.sort((a, b) => railIndex(a.field) - railIndex(b.field));

	function checkForSuggestions(): readonly ProjectButterSuggestionField[] {
		const live = contentRef.current;
		const next = nextProjectButterDemoCheck(projectButterSuggestionSnapshot(live), live.detailFields.hidden, demoChecks);
		if (!next) return [];

		live.setDetailFields((current) => {
			const added = next.fields.filter((field) => !current.order.includes(field));
			return added.length ? { ...current, order: [...current.order, ...added] } : current;
		});
		setDemoChecks(next.completedChecks);
		return next.fields;
	}

	function settleField(field: ProjectButterDetailFieldId) {
		const timer = shimmerTimers.current.get(field);
		if (timer !== undefined) window.clearTimeout(timer);
		shimmerTimers.current.delete(field);
		setFieldReveals((current) => {
			if (!(field in current)) return current;
			const next = { ...current };
			delete next[field];
			return next;
		});
	}

	function shimmerField(suggestion: ProjectButterSuggestion) {
		const { field, preview } = suggestion;
		if (isMainSuggestionField(field)) return;
		const previous = shimmerTimers.current.get(field);
		if (previous !== undefined) window.clearTimeout(previous);
		const finish = () => {
			if (shimmerTimers.current.get(field) === timer) settleField(field);
		};
		// A collapsed or unmounted row cannot report animation completion.
		const fallbackMs = (getShimmerWaveEndTime(preview, SUGGESTION_REVEAL_DURATION, SUGGESTION_REVEAL_SPREAD) + motionDuration.slower) * 1000;
		const timer = window.setTimeout(finish, fallbackMs);
		shimmerTimers.current.set(field, timer);
		setFieldReveals((current) => ({ ...current, [field]: { key: timer, text: preview, finish } }));
	}

	function applyInline(suggestion: ProjectButterSuggestion, target: ProjectButterContent) {
		if (suggestion.field === "description" && (contentRef.current.description.trim() || contentRef.current.descriptionDraft.trim())) return false;
		applyProjectButterSuggestion(suggestion, target);
		if (suggestion.field === "description" && !reducedRef.current) descriptionRevealRef.current?.(suggestion.text);
		if (!reducedRef.current) shimmerField(suggestion);
		return true;
	}

	function acceptField(suggestion: ProjectButterSuggestion) {
		undoneFields.current.delete(suggestion.field);
		if (!isMainSuggestionField(suggestion.field)) revealRef.current();
		applyInline(suggestion, contentRef.current);
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
			revertMatchingProjectButterSuggestions(batch, projectButterSuggestionSnapshot(live), target);
		}
		acceptedTarget.current = null;
		setAccepted(null);
		setRunning(false);
		setCursor(null);
		setActiveField(null);
		for (const timer of shimmerTimers.current.values()) window.clearTimeout(timer);
		shimmerTimers.current.clear();
		setFieldReveals({});
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
		const target = contentRef.current;
		const applied: ProjectButterSuggestion[] = [];
		activeBatch.current = batch;
		undoneFields.current.clear();
		const expanding = batch.some((item) => !isMainSuggestionField(item.field)) && revealRef.current();
		if (!traverseBatch || reducedRef.current) {
			for (const suggestion of batch) {
				if (applyInline(suggestion, target)) applied.push(suggestion);
			}
			if (applied.length) rememberAccepted(applied, target);
			activeBatch.current = [];
			return;
		}
		const id = ++runId.current;
		setRunning(true);
		await settleLayout();
		if (expanding) await wait(motionDuration.slow * 1000);
		if (id !== runId.current) return;
		const description = batch.find((suggestion) => suggestion.field === "description");
		if (description && !undoneFields.current.has("description") && !contentRef.current.description.trim() && !contentRef.current.descriptionDraft.trim()) {
			setActiveField("description");
			applyProjectButterSuggestion(description, target);
			if (!reducedRef.current) descriptionRevealRef.current?.(description.text);
			applied.push(description);
		}
		const criteria = batch.find((suggestion) => suggestion.field === "acceptanceCriteria");
		if (criteria && !undoneFields.current.has(criteria.field)) {
			applyProjectButterSuggestion(criteria, target);
			applied.push(criteria);
		}
		const { order, hidden } = contentRef.current.detailFields;
		const steps = order.flatMap((field) => {
			if (field === "agents" || hidden.includes(field)) return [];
			const suggestion = batch.find((item) => item.field === field && !undoneFields.current.has(item.field));
			return suggestion ? [{ field, suggestion }] : [];
		});
		const first = steps.at(0);
		if (first) {
			const rail = document.querySelector(`[data-project-butter-suggestion-fields="${CSS.escape(columnId)}"]`);
			const rowFor = (field: ProjectButterDetailFieldId) => rail?.querySelector<HTMLElement>(`[data-field-id="${field}"]`);
			rowFor(first.field)?.scrollIntoView({ block: "nearest", behavior: "instant" });
			setCursor({ field: first.field, phase: "lift" });
			await settleLayout();
			if (id !== runId.current) return;
			await wait(FILL_LIFT.duration * 1000);
			for (const [index, { field, suggestion }] of steps.entries()) {
				if (id !== runId.current) return;
				if (undoneFields.current.has(suggestion.field)) continue;
				const phase = steps.slice(index + 1).some((step) => !undoneFields.current.has(step.suggestion.field)) ? "travel" : "land";
				setActiveField(suggestion.field);
				applyProjectButterSuggestion(suggestion, target);
				if (!reducedRef.current) shimmerField(suggestion);
				applied.push(suggestion);
				await settleLayout();
				if (id !== runId.current) return;
				const row = rowFor(field);
				const indicator = rail?.querySelector<HTMLElement>("[data-project-butter-suggestion-cursor]");
				if (row && indicator) {
					const travel = fillCursorTravel(row, indicator, phase);
					setCursor({ field, phase, travel });
					row.scrollIntoView({ block: "nearest", behavior: "smooth" });
					await wait((phase === "land" ? Math.max(FILL_LANDING.duration, travel.duration) : travel.duration) * 1000);
				}
			}
			await settleLayout();
		}
		if (id !== runId.current) return;
		setActiveField(null);
		setCursor(null);
		if (applied.length) rememberAccepted(applied, target);
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
		cursor,
		columnId,
		dismissAccepted,
		dismissField,
		checkForSuggestions: demo ? checkForSuggestions : undefined,
		hasMoreSuggestions,
		restoreDismissedField: (field) => setDismissed((current) => {
			const next = new Set(current);
			next.delete(field);
			return next;
		}),
		running,
		fieldReveals,
		suggestions,
		undoAccepted,
		undoField: (suggestion) => {
			if (!isMainSuggestionField(suggestion.field)) {
				settleField(suggestion.field);
			}
			if (activeBatch.current.some((item) => item.field === suggestion.field)) {
				undoneFields.current.add(suggestion.field);
				if (activeBatch.current.every((item) => undoneFields.current.has(item.field))) {
					runId.current += 1;
					activeBatch.current = [];
					setRunning(false);
					setCursor(null);
					setActiveField(null);
				}
			}
			revertMatchingProjectButterSuggestions([suggestion], projectButterSuggestionSnapshot(contentRef.current), contentRef.current);
		},
	};
}
