"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

import type { SuggestionFieldId } from "@/components/blocks/jira-suggestion/data/suggestions";

import { FILL_LANDING, type FillCursorPosition } from "@/components/blocks/jira-work-item/project-butter/details-rail";
import { motionDuration, motionEase } from "@/lib/motion";

const RAIL_STEPS: readonly Exclude<SuggestionFieldId, "description">[] = ["assignee", "dueDate", "parent", "labels", "components", "fixVersion", "acceptanceCriteria"];

/** Coordinates the preview's text reveals and the batch cursor's journey through Details. */
export function useJustFilled() {
	const [filled, setFilled] = useState<ReadonlySet<SuggestionFieldId>>(new Set());
	const [waiting, setWaiting] = useState<ReadonlySet<SuggestionFieldId>>(new Set());
	const [cursor, setCursor] = useState<FillCursorPosition | null>(null);
	const reduced = useReducedMotion();
	const timers = useRef<number[]>([]);
	useEffect(() => {
		const pending = timers.current;
		return () => pending.forEach((timer) => window.clearTimeout(timer));
	}, []);
	const cancel = useCallback(() => {
		timers.current.forEach((timer) => window.clearTimeout(timer));
		timers.current.length = 0;
		setWaiting(new Set());
		setFilled(new Set());
		setCursor(null);
	}, []);
	const finish = useCallback((id: SuggestionFieldId) => setFilled((current) => new Set([...current].filter((entry) => entry !== id))), []);
	const flash = useCallback((ids: readonly SuggestionFieldId[], bulk: boolean) => {
		if (reduced) return;
		if (!bulk) {
			setFilled((current) => new Set([...current, ...ids]));
			return;
		}
		cancel();
		const details = RAIL_STEPS.filter((id) => ids.includes(id));
		setFilled(new Set(ids.filter((id) => id === "description")));
		setWaiting(new Set(details));
		if (!details.length) return;
		setCursor({ field: details[0], phase: "lift" });
		let elapsed = motionDuration.slow * 1000;
		details.forEach((id, index) => {
			const phase = index === details.length - 1 ? "land" : "travel";
			const duration = phase === "land" ? FILL_LANDING.duration : motionDuration.slow;
			timers.current.push(window.setTimeout(() => {
				setCursor({ field: id, phase, travel: { duration, ease: phase === "land" ? FILL_LANDING.ease : motionEase.linear } });
				setWaiting((current) => new Set([...current].filter((entry) => entry !== id)));
				setFilled((current) => new Set([...current, id]));
			}, elapsed));
			elapsed += (duration + motionDuration.slowest) * 1000;
		});
		timers.current.push(window.setTimeout(() => setCursor(null), elapsed));
	}, [cancel, reduced]);
	return { filled, waiting, cursor, flash, finish, cancel };
}
