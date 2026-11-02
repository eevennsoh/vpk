"use client";

import { startTransition, useEffect, useId, useRef, useState } from "react";
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
import { DETAILS_RAIL_GLIDE } from "@/components/blocks/jira-work-item/project-butter/details-rail";
import type { ProjectButterDetailFieldId } from "@/components/blocks/jira-work-item/project-butter/details-model";

/**
 * One rail step: the next field fills as the bar slides below it. Each step starts just before the previous
 * glide lands, so render latency on a step never shows up as the bar parking between rows.
 */
const FILL_STEP_MS = (DETAILS_RAIL_GLIDE.layout.duration - motionDuration.xxshort) * 1000;
const WAVE_DURATION = 0.9;
const WAVE_SPREAD = 2;

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
		dueDate: content.dueDate,
		reporter: content.reporter,
		parent: content.detailFields.parent,
		labels: content.detailFields.labels,
		components: content.detailFields.components,
		fixVersion: content.detailFields.fixVersion,
		acceptanceCriteria: content.detailFields.acceptanceCriteria,
		costCenter: content.detailFields.costCenter,
	};
}

export interface ProjectButterSuggestionFill {
	acceptAll: () => void;
	acceptField: (suggestion: ProjectButterSuggestion) => void;
	accepted: readonly ProjectButterSuggestion[] | null;
	activeField: ProjectButterSuggestionField | null;
	/** Details row the filling bar sits below while Accept all runs. */
	barAfter: ProjectButterDetailFieldId | null;
	columnId: string;
	dismissAccepted: () => void;
	dismissField: (field: ProjectButterSuggestionField) => void;
	running: boolean;
	shimmerText: Readonly<Partial<Record<ProjectButterSuggestionField, string>>>;
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
): ProjectButterSuggestionFill {
	const shouldReduceMotion = useReducedMotion() ?? false;
	const columnId = useId();
	const runId = useRef(0);
	const shimmerTimers = useRef<number[]>([]);
	const contentRef = useRef(content);
	const acceptedTarget = useRef<ProjectButterContent | null>(null);
	const revealRef = useRef(onRevealMore);
	const reducedRef = useRef(shouldReduceMotion);
	const [running, setRunning] = useState(false);
	const [activeField, setActiveField] = useState<ProjectButterSuggestionField | null>(null);
	const [barAfter, setBarAfter] = useState<ProjectButterDetailFieldId | null>(null);
	const [dismissed, setDismissed] = useState<ReadonlySet<ProjectButterSuggestionField>>(() => new Set());
	const [accepted, setAccepted] = useState<readonly ProjectButterSuggestion[] | null>(null);
	const [shimmerText, setShimmerText] = useState<Readonly<Partial<Record<ProjectButterSuggestionField, string>>>>({});

	useEffect(() => {
		contentRef.current = content;
		revealRef.current = onRevealMore;
		reducedRef.current = shouldReduceMotion;
	});

	useEffect(() => () => {
		runId.current += 1;
		for (const timer of shimmerTimers.current) window.clearTimeout(timer);
	}, []);

	const suggestions = enabled
		? listProjectButterSuggestions({
			dueDate: content.dueDate,
			reporter: content.reporter,
			parent: content.detailFields.parent,
			labels: content.detailFields.labels,
			components: content.detailFields.components,
			fixVersion: content.detailFields.fixVersion,
			acceptanceCriteria: content.detailFields.acceptanceCriteria,
			costCenter: content.detailFields.costCenter,
		}).filter((suggestion) => !dismissed.has(suggestion.field))
		: [];

	function shimmerField(suggestion: ProjectButterSuggestion) {
		setShimmerText((current) => ({ ...current, [suggestion.field]: suggestion.preview }));
		const holdMs = getShimmerWaveEndTime(suggestion.preview, WAVE_DURATION, WAVE_SPREAD) * 1000 + 40;
		const timer = window.setTimeout(() => {
			setShimmerText((current) => {
				if (!(suggestion.field in current)) return current;
				const next = { ...current };
				delete next[suggestion.field];
				return next;
			});
		}, holdMs);
		shimmerTimers.current.push(timer);
	}

	/** Rows' outer boxes carry no layout transform, so this scrolls to where the bar is heading, not where it is mid-glide. */
	function revealRow(field: ProjectButterDetailFieldId) {
		const container = document.querySelector(`[data-project-butter-suggestion-fields="${CSS.escape(columnId)}"]`);
		const row = container?.querySelector(`[data-field-id="${field}"]`);
		if (row instanceof HTMLElement) row.scrollIntoView({ block: "nearest", behavior: "smooth" });
	}

	function acceptField(suggestion: ProjectButterSuggestion) {
		if (running) return;
		revealRef.current();
		applyProjectButterSuggestion(suggestion, contentRef.current);
		if (!reducedRef.current) shimmerField(suggestion);
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
		setShimmerText({});
	}

	function dismissAccepted() {
		acceptedTarget.current = null;
		setAccepted(null);
	}

	async function acceptAll() {
		if (running || suggestions.length === 0 || accepted) return;
		const batch = suggestions;
		const target = contentRef.current;
		if (reducedRef.current) {
			for (const suggestion of batch) applyProjectButterSuggestion(suggestion, target);
			rememberAccepted(batch, target);
			return;
		}
		const id = ++runId.current;
		setRunning(true);
		revealRef.current();
		await wait(motionDuration.slow * 1000);
		if (id !== runId.current) return;
		const rail = target.detailFields.order.filter((field) => !target.detailFields.hidden.includes(field));
		setBarAfter(rail[rail.indexOf(batch[0].field) - 1] ?? null);
		await wait(motionDuration.medium * 1000);
		for (const [index, suggestion] of batch.entries()) {
			if (id !== runId.current) return;
			const stepStart = performance.now();
			startTransition(() => {
				setActiveField(suggestion.field);
				setBarAfter(suggestion.field);
				applyProjectButterSuggestion(suggestion, target);
				shimmerField(suggestion);
			});
			await settleLayout();
			revealRow(batch[index + 1]?.field ?? suggestion.field);
			await wait(Math.max(0, FILL_STEP_MS - (performance.now() - stepStart)));
		}
		if (id !== runId.current) return;
		setActiveField(null);
		setBarAfter(null);
		await wait(FILL_STEP_MS);
		if (id !== runId.current) return;
		rememberAccepted(batch, target);
		setRunning(false);
	}

	return {
		acceptAll: () => {
			void acceptAll();
		},
		acceptField,
		accepted,
		activeField,
		barAfter,
		columnId,
		dismissAccepted,
		dismissField,
		running,
		shimmerText,
		suggestions,
		undoAccepted,
	};
}
