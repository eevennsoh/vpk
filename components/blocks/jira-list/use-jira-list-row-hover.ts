import { createContext, useCallback, useEffect, useRef, useState, type PointerEvent, type SetStateAction } from "react";

import type { JiraListInsertionTarget, JiraListRowTarget } from "./jira-list-dnd";

export const JiraListAgentPickerContext = createContext<((issueKey: string, open: boolean) => void) | null>(null);

export function useJiraListAgentPicker(onOpen: () => void) {
	const [openAgentPickerKey, setOpenAgentPickerKey] = useState<string | null>(null);
	const handleAgentPickerChange = useCallback((issueKey: string, open: boolean) => {
		setOpenAgentPickerKey((current) => open ? issueKey : current === issueKey ? null : current);
		if (open) onOpen();
	}, [onOpen]);
	return { openAgentPickerKey, handleAgentPickerChange };
}

function createGripHover() {
	let issueKey: string | null = null;
	const listeners = new Set<() => void>();
	return {
		getSnapshot: () => issueKey,
		subscribe: (listener: () => void) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		set: (next: string | null) => {
			if (issueKey === next) return;
			issueKey = next;
			for (const listener of listeners) listener();
		},
	};
}

export type JiraListGripHover = ReturnType<typeof createGripHover>;

export function useJiraListRowHover() {
	const bodyRef = useRef<HTMLTableSectionElement>(null);
	const [overlay, setOverlay] = useState<HTMLDivElement | null>(null);
	const [hovered, setHoveredState] = useState<JiraListRowTarget | null>(null);
	const targetRef = useRef<JiraListRowTarget | null>(null);
	const shownRef = useRef<JiraListRowTarget | null>(null);
	const controlRef = useRef<HTMLElement | null>(null);
	const gripControlRef = useRef<HTMLElement | null>(null);
	const timerRef = useRef<number | null>(null);
	const [gripHover] = useState(createGripHover);

	useEffect(() => () => {
		if (timerRef.current !== null) window.clearTimeout(timerRef.current);
		controlRef.current?.removeAttribute("data-row-boundary-target");
		gripControlRef.current?.removeAttribute("data-row-drag-target");
	}, []);

	const setHovered = useCallback((update: SetStateAction<JiraListRowTarget | null>) => {
		const previous = targetRef.current;
		const next = typeof update === "function" ? update(previous) : update;
		if (previous?.issueKey === next?.issueKey && previous?.zone === next?.zone) return;
		targetRef.current = next;
		if (previous?.issueKey !== next?.issueKey) {
			gripControlRef.current?.removeAttribute("data-row-drag-target");
			gripControlRef.current = next
				? overlay?.querySelector<HTMLElement>(`[data-jira-list-drag-key="${CSS.escape(next.issueKey)}"]`) ?? null
				: null;
			gripControlRef.current?.setAttribute("data-row-drag-target", "");
			gripHover.set(next?.issueKey ?? null);
		}
		if (timerRef.current !== null) window.clearTimeout(timerRef.current);
		controlRef.current?.removeAttribute("data-row-boundary-target");
		controlRef.current = next && next.zone !== "drag"
			? overlay?.querySelector<HTMLElement>(`[data-insertion-issue-key="${CSS.escape(next.issueKey)}"][data-insertion-position="${next.zone}"]`) ?? null
			: null;
		controlRef.current?.setAttribute("data-row-boundary-target", "");
		if (shownRef.current) {
			shownRef.current = null;
			setHoveredState(null);
		}
		if (next) {
			timerRef.current = window.setTimeout(() => {
				timerRef.current = null;
				shownRef.current = next;
				setHoveredState(next);
			}, 120);
		}
	}, [gripHover, overlay]);

	function leave(event: PointerEvent<HTMLElement>) {
		const next = event.relatedTarget;
		if (next instanceof Node && (bodyRef.current?.contains(next) || overlay?.contains(next))) return;
		setHovered(null);
	}

	function setInsertionHover(target: JiraListInsertionTarget | null) {
		setHovered((current) => {
			if (!target) return null;
			return current?.issueKey === target.issueKey && current.zone === target.position
				? current : { issueKey: target.issueKey, zone: target.position };
		});
	}

	function leaveRow(event: PointerEvent<HTMLTableRowElement>) {
		const next = event.relatedTarget;
		if (next instanceof Element && bodyRef.current?.contains(next) && !next.closest("[data-jira-list-work-row]")) {
			setHovered((target) => target && target.zone !== "drag" ? { ...target, zone: "drag" } : target);
		}
	}

	return { bodyRef, overlay, setOverlay, hovered, gripHover, setHovered, setInsertionHover, leave, leaveRow };
}
