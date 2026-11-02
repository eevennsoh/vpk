"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

import { getShimmerWaveEndTime } from "@/components/ui-custom/lib/shimmer-wave-timing";
import { motionDuration } from "@/lib/motion";
import {
	applyProjectButterSuggestion,
	clearProjectButterSuggestion,
	listProjectButterSuggestions,
	type ProjectButterSuggestion,
	type ProjectButterSuggestionField,
} from "@/components/blocks/jira-work-item/project-butter/suggestion-model";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";

/** Time for the fill pill to travel onto a field before the value lands. */
const FILL_TRAVEL_MS = 220;
/** Pause after a value lands so the eye can register it before the next field. */
const FILL_HOLD_MS = 280;
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

export interface ProjectButterSuggestionFill {
	acceptAll: () => void;
	acceptField: (suggestion: ProjectButterSuggestion) => void;
	accepted: readonly ProjectButterSuggestion[] | null;
	activeField: ProjectButterSuggestionField | null;
	columnId: string;
	dismissAccepted: () => void;
	dismissField: (field: ProjectButterSuggestionField) => void;
	pillTop: number | null;
	running: boolean;
	shimmerText: Readonly<Partial<Record<ProjectButterSuggestionField, string>>>;
	suggestions: readonly ProjectButterSuggestion[];
	undoAccepted: () => void;
}

/**
 * Review and playback for the Butter suggestion state.
 * One field commits immediately. Accept all walks a pill down the details rail.
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
	const revealRef = useRef(onRevealMore);
	const reducedRef = useRef(shouldReduceMotion);
	const [running, setRunning] = useState(false);
	const [activeField, setActiveField] = useState<ProjectButterSuggestionField | null>(null);
	const [pillTop, setPillTop] = useState<number | null>(null);
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

	function placePill(field: ProjectButterSuggestionField) {
		const container = document.querySelector(`[data-project-butter-suggestion-fields="${CSS.escape(columnId)}"]`);
		if (!(container instanceof HTMLElement)) return;
		const node = container.querySelector(`[data-field-id="${field}"]`);
		if (!(node instanceof HTMLElement)) return;
		const top = node.getBoundingClientRect().bottom - container.getBoundingClientRect().top;
		setPillTop(Math.max(0, top - 16));
		node.scrollIntoView({ block: "nearest", behavior: reducedRef.current ? "auto" : "smooth" });
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

	function undoAccepted() {
		const batch = accepted;
		if (!batch) return;
		runId.current += 1;
		for (const suggestion of batch) clearProjectButterSuggestion(suggestion.field, contentRef.current);
		setAccepted(null);
		setRunning(false);
		setActiveField(null);
		setPillTop(null);
		setShimmerText({});
	}

	function dismissAccepted() {
		setAccepted(null);
	}

	async function acceptAll() {
		if (running || suggestions.length === 0 || accepted) return;
		const batch = suggestions;
		if (reducedRef.current) {
			for (const suggestion of batch) applyProjectButterSuggestion(suggestion, contentRef.current);
			setAccepted(batch);
			return;
		}
		const id = ++runId.current;
		setRunning(true);
		revealRef.current();
		await wait(motionDuration.slow * 1000);
		if (id !== runId.current) return;
		await settleLayout();
		for (const suggestion of batch) {
			if (id !== runId.current) return;
			setActiveField(suggestion.field);
			await settleLayout();
			placePill(suggestion.field);
			await wait(FILL_TRAVEL_MS);
			if (id !== runId.current) return;
			applyProjectButterSuggestion(suggestion, contentRef.current);
			shimmerField(suggestion);
			await settleLayout();
			placePill(suggestion.field);
			await wait(FILL_HOLD_MS);
		}
		if (id !== runId.current) return;
		setActiveField(null);
		setPillTop(null);
		setAccepted(batch);
		setRunning(false);
	}

	return {
		acceptAll: () => {
			void acceptAll();
		},
		acceptField,
		accepted,
		activeField,
		columnId,
		dismissAccepted,
		dismissField,
		pillTop,
		running,
		shimmerText,
		suggestions,
		undoAccepted,
	};
}
