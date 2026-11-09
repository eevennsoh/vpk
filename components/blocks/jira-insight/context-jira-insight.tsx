"use client";

import {
	createContext,
	use,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from "react";
import { useReducedMotion } from "motion/react";

import type {
	JiraInsightSource,
	JiraInsightSnapshot,
} from "@/components/blocks/jira-insight/jira-insight-types";
import {
	createJiraInsightSelectionState,
	getUnreadCheckpointIds,
	reconcileJiraInsightSelectionState,
	selectLatestUnreadCheckpoint,
	sortJiraInsightCheckpoints,
} from "@/components/blocks/jira-insight/lib/jira-insight-model";

interface JiraInsightContextValue {
	activeCheckpointId: string | null;
	checkpoints: JiraInsightSnapshot["checkpoints"];
	onSourceSelect?: (source: JiraInsightSource) => void;
	registerCheckpoint: (id: string, node: HTMLElement | null) => void;
	selectCheckpoint: (id: string, scroll?: boolean) => void;
	selectCheckpointFromScroll: (id: string) => void;
	selectLatestUnread: () => void;
	snapshot: JiraInsightSnapshot;
	unreadCheckpointIds: readonly string[];
}

const JiraInsightContext = createContext<JiraInsightContextValue | null>(null);
const SCROLL_LOCK_MS = 600;

export function JiraInsightProvider({
	children,
	onSourceSelect,
	snapshot,
}: Readonly<{
	children: ReactNode;
	onSourceSelect?: (source: JiraInsightSource) => void;
	snapshot: JiraInsightSnapshot;
}>) {
	const shouldReduceMotion = Boolean(useReducedMotion());
	const [selection, setSelection] = useState(() => createJiraInsightSelectionState(snapshot));
	const resolvedSelection = useMemo(
		() => reconcileJiraInsightSelectionState(snapshot, selection),
		[selection, snapshot],
	);
	const checkpoints = useMemo(
		() => sortJiraInsightCheckpoints(snapshot.checkpoints),
		[snapshot.checkpoints],
	);
	const unreadCheckpointIds = useMemo(
		() => getUnreadCheckpointIds(snapshot, resolvedSelection),
		[resolvedSelection, snapshot],
	);
	const checkpointElementsRef = useRef(new Map<string, HTMLElement>());
	const pendingScrollIdRef = useRef<string | null>(null);
	const scrollLockIdRef = useRef<string | null>(null);
	const unlockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const scrollToCheckpoint = useCallback((id: string) => {
		const node = checkpointElementsRef.current.get(id);
		if (!node) {
			pendingScrollIdRef.current = id;
			return;
		}
		pendingScrollIdRef.current = null;
		scrollLockIdRef.current = id;
		if (unlockTimeoutRef.current != null) clearTimeout(unlockTimeoutRef.current);
		node.scrollIntoView({
			behavior: shouldReduceMotion ? "auto" : "smooth",
			block: "center",
		});
		unlockTimeoutRef.current = setTimeout(() => {
			scrollLockIdRef.current = null;
			unlockTimeoutRef.current = null;
		}, shouldReduceMotion ? 0 : SCROLL_LOCK_MS);
	}, [shouldReduceMotion]);

	const selectCheckpoint = useCallback((id: string, scroll = true) => {
		if (!checkpoints.some((checkpoint) => checkpoint.id === id)) return;
		setSelection({ ...resolvedSelection, activeCheckpointId: id });
		if (scroll) scrollToCheckpoint(id);
	}, [checkpoints, resolvedSelection, scrollToCheckpoint]);

	const selectCheckpointFromScroll = useCallback((id: string) => {
		if (scrollLockIdRef.current != null || resolvedSelection.activeCheckpointId === id) return;
		setSelection({ ...resolvedSelection, activeCheckpointId: id });
	}, [resolvedSelection]);

	const selectLatestUnread = useCallback(() => {
		const next = selectLatestUnreadCheckpoint(snapshot, resolvedSelection);
		setSelection(next);
		if (next.activeCheckpointId) scrollToCheckpoint(next.activeCheckpointId);
	}, [resolvedSelection, scrollToCheckpoint, snapshot]);

	const registerCheckpoint = useCallback((id: string, node: HTMLElement | null) => {
		if (node) {
			checkpointElementsRef.current.set(id, node);
			if (pendingScrollIdRef.current === id) {
				window.requestAnimationFrame(() => scrollToCheckpoint(id));
			}
			return;
		}
		checkpointElementsRef.current.delete(id);
	}, [scrollToCheckpoint]);

	useEffect(() => () => {
		if (unlockTimeoutRef.current != null) clearTimeout(unlockTimeoutRef.current);
	}, []);

	const value = useMemo<JiraInsightContextValue>(() => ({
		activeCheckpointId: resolvedSelection.activeCheckpointId,
		checkpoints,
		onSourceSelect,
		registerCheckpoint,
		selectCheckpoint,
		selectCheckpointFromScroll,
		selectLatestUnread,
		snapshot,
		unreadCheckpointIds,
	}), [checkpoints, onSourceSelect, registerCheckpoint, resolvedSelection.activeCheckpointId, selectCheckpoint, selectCheckpointFromScroll, selectLatestUnread, snapshot, unreadCheckpointIds]);

	return <JiraInsightContext value={value}>{children}</JiraInsightContext>;
}

export function useJiraInsight(): JiraInsightContextValue {
	const value = use(JiraInsightContext);
	if (!value) throw new Error("useJiraInsight must be used within JiraInsightProvider");
	return value;
}
