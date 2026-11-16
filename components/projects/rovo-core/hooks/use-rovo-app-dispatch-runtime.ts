"use client";

import {
	useCallback,
	useMemo,
	useRef,
	type MutableRefObject,
} from "react";
import {
	createRovoAppImmediateDispatchLifecycle,
	type RovoAppImmediateDispatchLifecycle,
} from "@/components/projects/rovo-core/lib/rovo-app-dispatch-lifecycle";
import type { RovoAppInterruptActiveTurn } from "@/components/projects/rovo-core/lib/rovo-app-run-lifecycle";

interface UseRovoAppDispatchRuntimeResult {
	immediateDispatchInProgressRef: MutableRefObject<boolean>;
	immediateDispatchLifecycle: RovoAppImmediateDispatchLifecycle;
	interruptActiveTurnRef: MutableRefObject<RovoAppInterruptActiveTurn>;
	kickQueue: () => void;
	processQueueRef: MutableRefObject<() => Promise<void>>;
	queueProcessorRunningRef: MutableRefObject<boolean>;
}

export function useRovoAppDispatchRuntime(): UseRovoAppDispatchRuntimeResult {
	const queueProcessorRunningRef = useRef(false);
	const immediateDispatchInProgressRef = useRef(false);
	const processQueueRef = useRef<() => Promise<void>>(async () => {});
	const interruptActiveTurnRef = useRef<RovoAppInterruptActiveTurn>(async () => {});
	const immediateDispatchLifecycle = useMemo(
		() =>
			createRovoAppImmediateDispatchLifecycle({
				immediateDispatchInProgressRef,
				interruptActiveTurnRef,
				queueProcessorRunningRef,
			}),
		[],
	);
	const kickQueue = useCallback(() => {
		void processQueueRef.current();
	}, []);

	return {
		immediateDispatchInProgressRef,
		immediateDispatchLifecycle,
		interruptActiveTurnRef,
		kickQueue,
		processQueueRef,
		queueProcessorRunningRef,
	};
}
