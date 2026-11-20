"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

import type { SuggestionFieldId } from "@/components/blocks/jira-suggestion/data/suggestions";

import { DETAILS_RAIL_GLIDE } from "@/components/blocks/jira-work-item/project-butter/details-rail";
import { motionDuration } from "@/lib/motion";

const RAIL_STEPS: readonly SuggestionFieldId[] = ["assignee", "dueDate", "parent", "labels", "components", "fixVersion", "acceptanceCriteria"];

/** Coordinates the preview's text reveals and the batch cursor's journey through Details. */
export function useJustFilled() {
	const [filled, setFilled] = useState<ReadonlySet<SuggestionFieldId>>(new Set());
	const [waiting, setWaiting] = useState<ReadonlySet<SuggestionFieldId>>(new Set());
	const [barAfter, setBarAfter] = useState<string | null>(null);
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
		setBarAfter(null);
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
		setBarAfter("top");
		const step = DETAILS_RAIL_GLIDE.layout.duration * 1000;
		RAIL_STEPS.forEach((id, index) => {
			timers.current.push(window.setTimeout(() => {
				setBarAfter(id);
				if (ids.includes(id)) {
					setWaiting((current) => new Set([...current].filter((entry) => entry !== id)));
					setFilled((current) => new Set([...current, id]));
				}
			}, motionDuration.slow * 1000 + index * step));
		});
		timers.current.push(window.setTimeout(() => setBarAfter(null), motionDuration.slow * 1000 + RAIL_STEPS.length * step));
	}, [cancel, reduced]);
	return { filled, waiting, barAfter, flash, finish, cancel };
}
