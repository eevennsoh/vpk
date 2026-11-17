"use client";

import { useCallback, useRef } from "react";
import { createRovoAppThread } from "@/components/projects/rovo-core/lib/api";
import { createRovoAppId, type RovoAppThread } from "@/lib/rovo-app-types";
import { deriveCompactThreadTitle } from "@/app/contexts/rovo-chat-helpers";
import type { RovoChatTurnState } from "@/app/contexts/rovo-chat-turn-machine";

interface ThreadCreation {
	readonly version: number;
	readonly promise: Promise<RovoAppThread>;
	readonly starterSignal?: AbortSignal;
}

/** One server creation per transcript, independent of the operation awaiting it. */
export function useRovoChatThreadCreation({ turnRef, activeThreadIdRef, adopt }: Readonly<{
	turnRef: { readonly current: RovoChatTurnState };
	activeThreadIdRef: { readonly current: string | null };
	adopt: (thread: RovoAppThread, seed: string) => void;
}>) {
	const creationRef = useRef<ThreadCreation | null>(null);
	const dropThreadCreation = useCallback(() => { creationRef.current = null; }, []);
	const ensureCompactThread = useCallback(async (seed: string, signal?: AbortSignal) => {
		const version = turnRef.current.transcriptVersion;
		let canRetryCancelledStarter = true;
		while (true) {
			signal?.throwIfAborted();
			if (turnRef.current.disposed || turnRef.current.transcriptVersion !== version) {
				throw new DOMException("Transcript replaced", "AbortError");
			}
			if (activeThreadIdRef.current) return activeThreadIdRef.current;
			let creation = creationRef.current;
			const joined = creation?.version === version;
			if (!creation || !joined) {
				creation = { version, starterSignal: signal, promise: createRovoAppThread({
					id: createRovoAppId(), title: deriveCompactThreadTitle(seed), messages: [],
					realtimeMessages: [], visibility: "private", activeDocumentId: null,
				}) };
				creationRef.current = creation;
			}
			let thread;
			try {
				thread = await creation.promise;
			} catch (error) {
				if (creationRef.current === creation) dropThreadCreation();
				if (canRetryCancelledStarter && joined && creation.starterSignal?.aborted) {
					canRetryCancelledStarter = false;
					continue;
				}
				throw error;
			}
			signal?.throwIfAborted();
			if (turnRef.current.disposed || turnRef.current.transcriptVersion !== version) {
				throw new DOMException("Transcript replaced", "AbortError");
			}
			if (!activeThreadIdRef.current) adopt(thread, seed);
			return thread.id;
		}
	}, [activeThreadIdRef, adopt, dropThreadCreation, turnRef]);
	return { ensureCompactThread, dropThreadCreation };
}
