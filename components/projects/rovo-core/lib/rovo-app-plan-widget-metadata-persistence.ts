import type { RovoAppThread } from "@/lib/rovo-app-types";
import type { RovoUIMessage } from "@/lib/rovo-ui-messages";
import { trimTitleText } from "@/lib/utils";
import { updatePlanWidgetMetadataInMessages } from "@/components/projects/shared/lib/plan-widget";
import { areRovoAppMessagesEqual } from "@/components/projects/rovo-core/lib/rovo-app-message-normalization";
import {
	isRovoAppThreadNotFoundError,
	shouldPersistResolvedRovoAppTitle,
} from "@/components/projects/rovo-core/lib/rovo-app-thread-persistence";
import { buildRovoAppThreadPersistKey } from "@/components/projects/rovo-core/lib/rovo-app-thread-route-sync";
import {
	updateRovoAppThreadMessagesRecord,
	upsertRovoAppThreadRecord,
} from "@/components/projects/rovo-core/lib/rovo-app-thread-state";

interface MutableRef<T> {
	current: T;
}

type SetRovoAppThreads = (
	threads: RovoAppThread[] | ((previousThreads: RovoAppThread[]) => RovoAppThread[]),
) => void;

export interface PersistRovoAppPlanWidgetMetadataInput {
	activeThreadIdRef: MutableRef<string | null>;
	beginThreadHydration: () => void;
	clearPendingPlanMetadataGeneration: (sourceMessageId?: string | null) => void;
	completeThreadHydration: () => void;
	deletedThreadIdsRef: MutableRef<Set<string>>;
	lastPersistedKeyRef: MutableRef<string>;
	messages: ReadonlyArray<RovoUIMessage>;
	reconcileThreadWithLocalTitle: (thread: RovoAppThread) => RovoAppThread;
	scheduleHydrationCompletion?: (callback: () => void) => void;
	setRovoMessages: (messages: RovoUIMessage[]) => void;
	setThreads: SetRovoAppThreads;
	shortDescription?: string;
	sourceMessageId?: string | null;
	threadId: string;
	threadsRef: MutableRef<ReadonlyArray<RovoAppThread>>;
	title?: string;
	updateThread: (
		threadId: string,
		patch: { messages: ReadonlyArray<RovoUIMessage> },
	) => Promise<RovoAppThread>;
	warn?: (message: string, error: unknown) => void;
}

function defaultScheduleHydrationCompletion(callback: () => void): void {
	window.setTimeout(callback, 0);
}

export async function persistRovoAppPlanWidgetMetadata({
	activeThreadIdRef,
	beginThreadHydration,
	clearPendingPlanMetadataGeneration,
	completeThreadHydration,
	deletedThreadIdsRef,
	lastPersistedKeyRef,
	messages,
	reconcileThreadWithLocalTitle,
	scheduleHydrationCompletion = defaultScheduleHydrationCompletion,
	setRovoMessages,
	setThreads,
	shortDescription,
	sourceMessageId: rawSourceMessageId,
	threadId,
	threadsRef,
	title,
	updateThread,
	warn = console.warn,
}: Readonly<PersistRovoAppPlanWidgetMetadataInput>): Promise<void> {
	const sourceMessageId = rawSourceMessageId ?? null;
	const normalizedTitle = title ? trimTitleText(title) : undefined;
	const normalizedShortDescription = shortDescription
		? trimTitleText(shortDescription)
		: undefined;
	if (!normalizedTitle && !normalizedShortDescription) {
		clearPendingPlanMetadataGeneration(sourceMessageId);
		return;
	}
	if (!shouldPersistResolvedRovoAppTitle({
		deletedThreadIds: deletedThreadIdsRef.current,
		threadId,
		threads: threadsRef.current,
	})) {
		clearPendingPlanMetadataGeneration(sourceMessageId);
		return;
	}

	const updatedMessages = updatePlanWidgetMetadataInMessages(
		messages,
		{
			sourceMessageId,
			title: normalizedTitle,
			shortDescription: normalizedShortDescription,
		},
	);
	if (areRovoAppMessagesEqual(updatedMessages, messages)) {
		clearPendingPlanMetadataGeneration(sourceMessageId);
		return;
	}

	const updatedAt = new Date().toISOString();
	setThreads((previousThreads) =>
		updateRovoAppThreadMessagesRecord(
			previousThreads,
			{
				threadId,
				messages: updatedMessages,
				updatedAt,
			},
			{ deletedThreadIds: deletedThreadIdsRef.current },
		).threads,
	);

	if (activeThreadIdRef.current === threadId) {
		setRovoMessages(updatedMessages);
	}
	clearPendingPlanMetadataGeneration(sourceMessageId);

	try {
		const thread = await updateThread(threadId, {
			messages: updatedMessages,
		});
		const resolvedThread = reconcileThreadWithLocalTitle(thread);
		const persistedKey = buildRovoAppThreadPersistKey({
			messages: resolvedThread.messages,
			realtimeMessages: resolvedThread.realtimeMessages ?? [],
			visibility: resolvedThread.visibility,
			activeDocumentId: resolvedThread.activeDocumentId,
			title: resolvedThread.title,
		});
		lastPersistedKeyRef.current = persistedKey;
		setThreads((previousThreads) =>
			upsertRovoAppThreadRecord(previousThreads, resolvedThread, {
				deletedThreadIds: deletedThreadIdsRef.current,
			}),
		);
		if (
			activeThreadIdRef.current === threadId
			&& !areRovoAppMessagesEqual(resolvedThread.messages, updatedMessages)
		) {
			beginThreadHydration();
			setRovoMessages(resolvedThread.messages);
			scheduleHydrationCompletion(() => {
				completeThreadHydration();
			});
		}
	} catch (error) {
		if (isRovoAppThreadNotFoundError(error)) {
			deletedThreadIdsRef.current.add(threadId);
			setThreads((previousThreads) =>
				previousThreads.filter((thread) => thread.id !== threadId),
			);
			return;
		}

		warn("[RovoApp] Failed to persist plan widget metadata:", error);
	}
}
