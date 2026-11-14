"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { ConversationFollowMode } from "@/components/ui-custom/conversation";
import type { ScrollActiveTimelineSelection, TypedScrollAnchorSource } from "@/components/projects/rovo-core/lib/rovo-app-shell-types";
import { deriveRovoAppTimelineItems } from "@/components/projects/rovo-core/lib/rovo-app-timeline";
import { getLatestUserMessageId, type RovoUIMessage } from "@/lib/rovo-ui-messages";

/**
 * Where a Rovo app shell's conversation scrolls after a typed turn. A submit queues an anchor on the
 * user message it is about to add; once that message appears the conversation scrolls to it
 * ("target"), and it returns to following the bottom when the reply finishes, the thread changes,
 * or a realtime (voice) reply completes.
 *
 * Two hooks because the shells run their submit and realtime code, which queue and reset the
 * anchor, between them: `useRovoAppShellScrollAnchor` holds the anchor and its actions (called where
 * the shells declared that state), and `useRovoAppShellScrollFollow` (called where the follow
 * effects were, once realtime state exists) runs those effects and derives the timeline
 * navigator's active item.
 */
export function useRovoAppShellScrollAnchor() {
	const [scrollAnchorMessageId, setScrollAnchorMessageId] = useState<string | null>(null);
	const [scrollFollowMode, setScrollFollowMode] = useState<ConversationFollowMode>("bottom");
	const pendingTypedScrollAnchorRef = useRef(false);
	const previousTypedAnchorUserMessageIdRef = useRef<string | null>(null);
	const typedScrollAnchorSourceRef = useRef<TypedScrollAnchorSource>("none");
	const realtimeTypedResponseStartedRef = useRef(false);

	const resetTypedScrollAnchorState = useCallback(() => {
		pendingTypedScrollAnchorRef.current = false;
		previousTypedAnchorUserMessageIdRef.current = null;
		typedScrollAnchorSourceRef.current = "none";
		realtimeTypedResponseStartedRef.current = false;
	}, []);

	const activateTailFollowMode = useCallback(() => {
		resetTypedScrollAnchorState();
		setScrollAnchorMessageId(null);
		setScrollFollowMode("bottom");
	}, [resetTypedScrollAnchorState]);

	const queueTypedScrollAnchor = useCallback((source: Exclude<TypedScrollAnchorSource, "none">, latestUserMessageId: string | null) => {
		pendingTypedScrollAnchorRef.current = true;
		previousTypedAnchorUserMessageIdRef.current = latestUserMessageId;
		typedScrollAnchorSourceRef.current = source;
		realtimeTypedResponseStartedRef.current = false;
	}, []);

	return {
		activateTailFollowMode,
		pendingTypedScrollAnchorRef,
		previousTypedAnchorUserMessageIdRef,
		queueTypedScrollAnchor,
		realtimeTypedResponseStartedRef,
		resetTypedScrollAnchorState,
		scrollAnchorMessageId,
		scrollFollowMode,
		setScrollAnchorMessageId,
		setScrollFollowMode,
		typedScrollAnchorSourceRef,
	};
}

export type RovoAppShellScrollAnchor = ReturnType<typeof useRovoAppShellScrollAnchor>;

export interface RovoAppShellScrollFollowOptions {
	anchor: RovoAppShellScrollAnchor;
	/** The timeline item the user scrolled to; the shell owns it (Studio's demo reset clears it). */
	scrollActiveTimelineSelection: ScrollActiveTimelineSelection | null;
	setScrollActiveTimelineSelection: Dispatch<SetStateAction<ScrollActiveTimelineSelection | null>>;
	/** The messages the conversation shows (the timeline is derived from these). */
	displayMessages: ReadonlyArray<RovoUIMessage>;
	/** The thread's messages (the anchor waits for the queued user message to appear here). */
	messages: ReadonlyArray<RovoUIMessage>;
	isStreaming: boolean;
	runtimeThreadId: string | null;
	realtimeGenerationState: string;
}

export function useRovoAppShellScrollFollow({
	anchor,
	displayMessages,
	isStreaming,
	messages,
	realtimeGenerationState,
	runtimeThreadId,
	scrollActiveTimelineSelection,
	setScrollActiveTimelineSelection,
}: Readonly<RovoAppShellScrollFollowOptions>) {
	const {
		activateTailFollowMode,
		pendingTypedScrollAnchorRef,
		previousTypedAnchorUserMessageIdRef,
		realtimeTypedResponseStartedRef,
		setScrollAnchorMessageId,
		setScrollFollowMode,
		typedScrollAnchorSourceRef,
	} = anchor;

	const timelineItems = useMemo(() => {
		return deriveRovoAppTimelineItems(displayMessages);
	}, [displayMessages]);
	const latestTimelineMessageId = timelineItems[0]?.id ?? null;
	const scrollActiveTimelineId = scrollActiveTimelineSelection
		&& scrollActiveTimelineSelection.runtimeThreadId === runtimeThreadId
		&& scrollActiveTimelineSelection.latestTimelineMessageId === latestTimelineMessageId
		? scrollActiveTimelineSelection.messageId
		: null;
	const activeTimelineMessageId = scrollActiveTimelineId ?? latestTimelineMessageId;
	const handleScrollActiveTimelineChange = useCallback((messageId: string | null) => {
		setScrollActiveTimelineSelection(
			messageId
				? {
					latestTimelineMessageId,
					messageId,
					runtimeThreadId,
				}
				: null,
		);
	}, [runtimeThreadId, latestTimelineMessageId, setScrollActiveTimelineSelection]);

	useEffect(() => {
		const latestUserMessageId = getLatestUserMessageId(messages);
		if (pendingTypedScrollAnchorRef.current && latestUserMessageId && latestUserMessageId !== previousTypedAnchorUserMessageIdRef.current) {
			pendingTypedScrollAnchorRef.current = false;
			previousTypedAnchorUserMessageIdRef.current = null;
			setScrollAnchorMessageId(latestUserMessageId);
			setScrollFollowMode("target");
		}
	}, [messages, pendingTypedScrollAnchorRef, previousTypedAnchorUserMessageIdRef, setScrollAnchorMessageId, setScrollFollowMode]);

	useEffect(() => {
		activateTailFollowMode();
	}, [activateTailFollowMode, runtimeThreadId]);

	useEffect(() => {
		if (typedScrollAnchorSourceRef.current !== "realtime" || !realtimeTypedResponseStartedRef.current) {
			return;
		}

		if (realtimeGenerationState !== "complete" && realtimeGenerationState !== "idle") {
			return;
		}

		activateTailFollowMode();
	}, [activateTailFollowMode, realtimeGenerationState, realtimeTypedResponseStartedRef, typedScrollAnchorSourceRef]);

	useEffect(() => {
		if (typedScrollAnchorSourceRef.current !== "standard" || isStreaming) {
			return;
		}

		activateTailFollowMode();
	}, [activateTailFollowMode, isStreaming, typedScrollAnchorSourceRef]);

	return {
		activeTimelineMessageId,
		handleScrollActiveTimelineChange,
		timelineItems,
	};
}
