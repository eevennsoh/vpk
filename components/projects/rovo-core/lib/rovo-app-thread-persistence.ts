import type {
	RovoAppThread,
	RovoAppVisibility,
} from "@/lib/rovo-app-types";
import { getMessageText, type RovoUIMessage } from "@/lib/rovo-ui-messages";
import { deriveThreadTitle } from "@/components/projects/rovo-core/lib/rovo-app-hook-helpers";
import { shouldDeferRovoAppTitlePersistence } from "@/components/projects/rovo-core/lib/rovo-app-title-generation";
import {
	buildRovoAppThreadPersistKey,
	shouldReplaceRovoAppRouteAfterPersistence,
} from "@/components/projects/rovo-core/lib/rovo-app-thread-route-sync";
import { shouldHydratePersistedRealtimeMessages } from "@/components/projects/rovo-core/lib/rovo-app-realtime-persistence";
import { areRovoAppMessagesEqual } from "@/components/projects/rovo-core/lib/rovo-app-message-normalization";
import { upsertRovoAppThreadRecord } from "@/components/projects/rovo-core/lib/rovo-app-thread-state";

interface MutableRef<T> {
	current: T;
}

type SetState<T> = (value: T | ((previousValue: T) => T)) => void;

export interface RovoAppThreadPersistenceUpdateInput {
	activeDocumentId: string | null;
	messages: ReadonlyArray<RovoUIMessage>;
	realtimeMessages: ReadonlyArray<RovoUIMessage>;
	title?: string;
	visibility: RovoAppVisibility;
}

export interface RovoAppThreadPersistencePlan {
	nextPersistKey: string;
	nextThreadUpdate: RovoAppThreadPersistenceUpdateInput;
	recoveryState: RecoverableRovoAppThreadState & { threadId: string };
	title: string;
}

export interface RunRovoAppThreadPersistenceLifecycleInput {
	activeDocumentId: string | null;
	activeThreadId: string;
	activeThreadIdRef: MutableRef<string | null>;
	beginThreadHydration: () => void;
	completeThreadHydration: () => void;
	createThread: (input: ReturnType<typeof buildRecoverableRovoAppThreadInput>) => Promise<RovoAppThread>;
	deletedThreadIdsRef: MutableRef<Set<string>>;
	embedded: boolean;
	flushPendingRouteReplacement: (threadId: string) => boolean;
	lastPersistedKeyRef: MutableRef<string | null>;
	normalizedMessages: ReadonlyArray<RovoUIMessage>;
	pendingRouteReadyRef: MutableRef<boolean>;
	pendingRouteThreadIdRef: MutableRef<string | null>;
	persistencePlan: RovoAppThreadPersistencePlan;
	realtimeMessages: ReadonlyArray<RovoUIMessage>;
	realtimeMessagesRef: MutableRef<ReadonlyArray<RovoUIMessage>>;
	realtimeMessagesVersionRef: MutableRef<number>;
	reconcileThreadWithLocalTitle: (thread: RovoAppThread) => RovoAppThread;
	replaceRealtimeMessagesState: (
		messages: RovoUIMessage[],
		options?: { incrementVersion?: boolean },
	) => unknown;
	requestVersion: number;
	scheduleComplete?: (callback: () => void) => void;
	setInputError: (message: string | null) => void;
	setMessages: SetState<RovoUIMessage[]>;
	setThreads: SetState<RovoAppThread[]>;
	threadVisibility: RovoAppVisibility;
	toUserErrorMessage: (error: unknown) => string;
	updateThread: (
		threadId: string,
		input: RovoAppThreadPersistenceUpdateInput,
	) => Promise<RovoAppThread>;
}

export interface RecoverableRovoAppThreadState {
	activeDocumentId: string | null;
	messages: ReadonlyArray<RovoUIMessage>;
	realtimeMessages: ReadonlyArray<RovoUIMessage>;
	threadId: string | null;
	title: string;
	visibility: RovoAppVisibility;
}

export function buildRovoAppThreadPersistencePlan(input: {
	activeDocumentId: string | null;
	activeThreadId: string;
	isGeneratingTitle: boolean;
	messages: ReadonlyArray<RovoUIMessage>;
	normalizedMessages: ReadonlyArray<RovoUIMessage>;
	pendingTitleThreadId: string | null;
	realtimeMessages: ReadonlyArray<RovoUIMessage>;
	threadVisibility: RovoAppVisibility;
	threads: ReadonlyArray<RovoAppThread>;
}): RovoAppThreadPersistencePlan {
	const currentThread =
		input.threads.find((thread) => thread.id === input.activeThreadId) ?? null;
	const firstUserMessage = input.messages.find((message) => message.role === "user");
	const title =
		currentThread?.title && currentThread.title.trim() !== "New chat"
			? currentThread.title
			: deriveThreadTitle(getMessageText(firstUserMessage ?? { parts: [] }));
	const nextThreadUpdate: RovoAppThreadPersistenceUpdateInput = {
		messages: input.normalizedMessages,
		realtimeMessages: input.realtimeMessages,
		visibility: input.threadVisibility,
		activeDocumentId: input.activeDocumentId,
	};

	if (!shouldDeferRovoAppTitlePersistence({
		activeThreadId: input.activeThreadId,
		isGeneratingTitle: input.isGeneratingTitle,
		pendingTitleThreadId: input.pendingTitleThreadId,
	})) {
		nextThreadUpdate.title = title;
	}

	return {
		nextPersistKey: buildRovoAppThreadPersistKey({
			messages: input.normalizedMessages,
			realtimeMessages: input.realtimeMessages,
			visibility: input.threadVisibility,
			activeDocumentId: input.activeDocumentId,
			title,
		}),
		nextThreadUpdate,
		recoveryState: {
			activeDocumentId: input.activeDocumentId,
			messages: input.normalizedMessages,
			realtimeMessages: input.realtimeMessages,
			threadId: input.activeThreadId,
			title,
			visibility: input.threadVisibility,
		},
		title,
	};
}

export function buildRovoAppPersistedThreadKey(
	thread: Readonly<RovoAppThread>,
): string {

	return buildRovoAppThreadPersistKey({
		messages: thread.messages,
		realtimeMessages: thread.realtimeMessages ?? [],
		visibility: thread.visibility,
		activeDocumentId: thread.activeDocumentId,
		title: thread.title,
	});
}

export function runRovoAppThreadPersistenceLifecycle({
	activeDocumentId,
	activeThreadId,
	activeThreadIdRef,
	beginThreadHydration,
	completeThreadHydration,
	createThread,
	deletedThreadIdsRef,
	embedded,
	flushPendingRouteReplacement,
	lastPersistedKeyRef,
	normalizedMessages,
	pendingRouteReadyRef,
	pendingRouteThreadIdRef,
	persistencePlan,
	realtimeMessages,
	realtimeMessagesRef,
	realtimeMessagesVersionRef,
	reconcileThreadWithLocalTitle,
	replaceRealtimeMessagesState,
	requestVersion,
	scheduleComplete = (callback) => window.setTimeout(callback, 0),
	setInputError,
	setMessages,
	setThreads,
	threadVisibility,
	toUserErrorMessage,
	updateThread,
}: RunRovoAppThreadPersistenceLifecycleInput): () => void {
	let cancelled = false;

	void updateThread(activeThreadId, persistencePlan.nextThreadUpdate)
		.then((thread) => {
			if (cancelled) {
				return;
			}

			const resolvedThread = reconcileThreadWithLocalTitle(thread);
			lastPersistedKeyRef.current = buildRovoAppPersistedThreadKey(resolvedThread);
			setThreads((previousThreads) =>
				upsertRovoAppThreadRecord(previousThreads, resolvedThread, {
					deletedThreadIds: deletedThreadIdsRef.current,
				}),
			);
			if (
				shouldReplaceRovoAppRouteAfterPersistence({
					pendingThreadId: pendingRouteThreadIdRef.current,
					thread: resolvedThread,
					messages: normalizedMessages,
					realtimeMessages,
					visibility: threadVisibility,
					activeDocumentId,
					title: resolvedThread.title,
				})
			) {
				pendingRouteReadyRef.current = true;
				flushPendingRouteReplacement(resolvedThread.id);
			}
			if (!areRovoAppMessagesEqual(resolvedThread.messages, normalizedMessages)) {
				beginThreadHydration();
				setMessages(resolvedThread.messages);
				scheduleComplete(completeThreadHydration);
			}
			if (
				!areRovoAppMessagesEqual(
					resolvedThread.realtimeMessages ?? [],
					realtimeMessagesRef.current,
				)
				&& shouldHydratePersistedRealtimeMessages({
					currentMessages: realtimeMessagesRef.current,
					currentVersion: realtimeMessagesVersionRef.current,
					requestVersion,
				})
			) {
				beginThreadHydration();
				replaceRealtimeMessagesState(resolvedThread.realtimeMessages ?? [], {
					incrementVersion: false,
				});
				scheduleComplete(completeThreadHydration);
			}
		})
		.catch((error) => {
			if (cancelled) {
				return;
			}

			if (
				shouldRecoverRovoAppThreadAfterPersistenceFailure({
					error,
					state: persistencePlan.recoveryState,
				})
			) {
				const recoveryInput =
					buildRecoverableRovoAppThreadInput(persistencePlan.recoveryState);
				void createThread(recoveryInput)
					.then((thread) => {
						if (
							cancelled ||
							activeThreadIdRef.current !== recoveryInput.id
						) {
							return;
						}

						const resolvedThread = reconcileThreadWithLocalTitle(thread);
						lastPersistedKeyRef.current = buildRovoAppPersistedThreadKey(
							resolvedThread,
						);
						setThreads((previousThreads) =>
							upsertRovoAppThreadRecord(previousThreads, resolvedThread, {
								deletedThreadIds: deletedThreadIdsRef.current,
							}),
						);
						if (!embedded) {
							pendingRouteThreadIdRef.current = resolvedThread.id;
							pendingRouteReadyRef.current = true;
							flushPendingRouteReplacement(resolvedThread.id);
						}
					})
					.catch((recoveryError) => {
						if (!cancelled) {
							setInputError(toUserErrorMessage(recoveryError));
						}
					});
				return;
			}

			setInputError(toUserErrorMessage(error));
		});

	return () => {
		cancelled = true;
	};
}

export function hasRecoverableRovoAppThreadState(
	state: Readonly<RecoverableRovoAppThreadState>,
): state is RecoverableRovoAppThreadState & { threadId: string } {
	if (typeof state.threadId !== "string" || !state.threadId.trim()) {
		return false;
	}

	return (
		state.messages.length > 0 ||
		state.realtimeMessages.length > 0 ||
		state.activeDocumentId !== null
	);
}

export function isRovoAppThreadNotFoundError(error: unknown): boolean {
	return error instanceof Error && error.message === "Thread not found";
}

export function shouldPersistResolvedRovoAppTitle(input: {
	deletedThreadIds: ReadonlySet<string>;
	threadId: string;
	threads: ReadonlyArray<{ id: string }>;
}): boolean {
	if (input.deletedThreadIds.has(input.threadId)) {
		return false;
	}

	return input.threads.some((thread) => thread.id === input.threadId);
}

export function shouldRecoverRovoAppThreadAfterPersistenceFailure(input: {
	error: unknown;
	state: Readonly<RecoverableRovoAppThreadState>;
}): boolean {
	return (
		isRovoAppThreadNotFoundError(input.error) &&
		hasRecoverableRovoAppThreadState(input.state)
	);
}

export function buildRecoverableRovoAppThreadInput(
	state: Readonly<RecoverableRovoAppThreadState>,
): {
	activeDocumentId: string | null;
	id: string;
	messages: ReadonlyArray<RovoUIMessage>;
	realtimeMessages: ReadonlyArray<RovoUIMessage>;
	title: string;
	visibility: RovoAppVisibility;
} {
	const threadId = state.threadId?.trim();
	if (!threadId) {
		throw new Error("Cannot recover Rovo thread without an id.");
	}

	return {
		id: threadId,
		title: state.title,
		messages: state.messages,
		realtimeMessages: state.realtimeMessages,
		visibility: state.visibility,
		activeDocumentId: state.activeDocumentId,
	};
}
