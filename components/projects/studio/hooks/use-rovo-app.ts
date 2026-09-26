"use client";

import { useRovoAppQueue } from "@/app/studio/rovo-queue-provider";
import { usePersistentState } from "@/lib/use-persistent-state";
import { studioAppAdapter } from "@/components/projects/studio/studio-app-adapter";
import {
	useRovoAppCore,
	type RovoAppHookOptions,
	type RovoAppHookResult,
} from "@/components/projects/rovo-core/hooks/use-rovo-app-core";
import type { RovoAppSendMode } from "@/components/projects/rovo-core/lib/rovo-app-hook-helpers";

export type { RovoAppHookOptions, RovoAppHookResult };

const STUDIO_CLARIFICATION_BEHAVIOR = {
	dismissUsesPlanMode: true,
	includeDeferredToolPlanMode: false,
	rollbackFailedSend: true,
} as const;

export function useRovoApp(options: Readonly<RovoAppHookOptions>): RovoAppHookResult {
	const queue = useRovoAppQueue();
	const [sendMode, setSendMode] =
		usePersistentState<RovoAppSendMode>("rovo-app-send-mode", "queue");

	return useRovoAppCore({
		...options,
		clarificationBehavior: STUDIO_CLARIFICATION_BEHAVIOR,
		queue,
		routeAdapter: studioAppAdapter,
		sendMode,
		setSendMode,
	});
}
