import type {
	RovoAppThread,
	RovoAppVisibility,
} from "@/lib/rovo-app-types";
import type { RovoUIMessage } from "@/lib/rovo-ui-messages";

interface MutableRef<T> {
	current: T;
}

export function buildRovoAppThreadPersistKey(options: {
	messages: ReadonlyArray<RovoUIMessage>;
	realtimeMessages: ReadonlyArray<RovoUIMessage>;
	visibility: RovoAppVisibility;
	activeDocumentId: string | null;
	title: string;
}): string {
	return JSON.stringify({
		messages: options.messages,
		realtimeMessages: options.realtimeMessages,
		visibility: options.visibility,
		activeDocumentId: options.activeDocumentId,
		title: options.title,
	});
}

export function buildRovoAppThreadPath(rootPath: string, threadId: string): string {
	return `${rootPath}/${encodeURIComponent(threadId)}`;
}

const ROVO_APP_RESERVED_SEGMENTS = new Set(["jobs", "memories", "skills", "settings"]);

export function getRovoAppThreadIdFromPath(rootPath: string, pathname: string): string | null {
	const normalizedPath =
		pathname === `${rootPath}/`
			? rootPath
			: pathname;

	if (normalizedPath === rootPath) {
		return null;
	}

	const threadPathPrefix = `${rootPath}/`;
	if (!normalizedPath.startsWith(threadPathPrefix)) {
		return null;
	}

	const threadIdSegment = normalizedPath.slice(threadPathPrefix.length);
	if (!threadIdSegment || threadIdSegment.includes("/")) {
		return null;
	}

	if (ROVO_APP_RESERVED_SEGMENTS.has(threadIdSegment)) {
		return null;
	}

	try {
		return decodeURIComponent(threadIdSegment);
	} catch {
		return null;
	}
}

export function createRovoAppThreadRouteSync(rootPath: string): {
	buildRovoAppThreadPath: (threadId: string) => string;
	getRovoAppThreadIdFromPath: (pathname: string) => string | null;
} {
	return {
		buildRovoAppThreadPath: (threadId) => buildRovoAppThreadPath(rootPath, threadId),
		getRovoAppThreadIdFromPath: (pathname) => getRovoAppThreadIdFromPath(rootPath, pathname),
	};
}

export function shouldReplaceRovoAppRouteAfterPersistence(options: {
	pendingThreadId: string | null;
	thread: RovoAppThread;
	messages: ReadonlyArray<RovoUIMessage>;
	realtimeMessages: ReadonlyArray<RovoUIMessage>;
	visibility: RovoAppVisibility;
	activeDocumentId: string | null;
	title: string;
}): boolean {
	if (!options.pendingThreadId || options.thread.id !== options.pendingThreadId) {
		return false;
	}

	const expectedPersistKey = buildRovoAppThreadPersistKey({
		messages: options.messages,
		realtimeMessages: options.realtimeMessages,
		visibility: options.visibility,
		activeDocumentId: options.activeDocumentId,
		title: options.title,
	});
	const persistedThreadKey = buildRovoAppThreadPersistKey({
		messages: options.thread.messages,
		realtimeMessages: options.thread.realtimeMessages,
		visibility: options.thread.visibility,
		activeDocumentId: options.thread.activeDocumentId,
		title: options.thread.title,
	});

	return persistedThreadKey === expectedPersistKey;
}

export function shouldSkipRovoAppThreadLoad(options: {
	activeThreadId: string | null;
	hasHydratedThreadState: boolean;
	requestedThreadId: string;
}): boolean {
	if (!options.activeThreadId || !options.hasHydratedThreadState) {
		return false;
	}

	return options.activeThreadId === options.requestedThreadId;
}

export function shouldLoadInitialRovoAppThread(options: {
	initialThreadId: string | null;
	lastLoadedInitialThreadId: string | null;
}): options is {
	initialThreadId: string;
	lastLoadedInitialThreadId: string | null;
} {
	if (!options.initialThreadId) {
		return false;
	}

	return options.initialThreadId !== options.lastLoadedInitialThreadId;
}

export function shouldReplacePendingRovoAppRoute(options: {
	activeThreadId: string | null;
	embedded: boolean;
	hasPersistedThreadState: boolean;
	isStreaming: boolean;
	isVoiceMode: boolean;
	pendingThreadId: string | null;
}): boolean {
	if (options.embedded || options.isVoiceMode || options.isStreaming) {
		return false;
	}

	if (!options.activeThreadId || !options.pendingThreadId) {
		return false;
	}

	if (!options.hasPersistedThreadState) {
		return false;
	}

	return options.activeThreadId === options.pendingThreadId;
}

export function flushPendingRovoAppRouteReplacement(options: {
	activeThreadId: string | null;
	buildThreadPath: (threadId: string) => string;
	embedded: boolean;
	isStreaming: boolean;
	isVoiceMode: boolean;
	pendingRouteReadyRef: MutableRef<boolean>;
	pendingThreadIdRef: MutableRef<string | null>;
	replaceHistoryPath: (path: string) => void;
}): boolean {
	if (!options.activeThreadId) {
		return false;
	}

	if (!shouldReplacePendingRovoAppRoute({
		activeThreadId: options.activeThreadId,
		embedded: options.embedded,
		hasPersistedThreadState: options.pendingRouteReadyRef.current,
		isStreaming: options.isStreaming,
		isVoiceMode: options.isVoiceMode,
		pendingThreadId: options.pendingThreadIdRef.current,
	})) {
		return false;
	}

	options.pendingThreadIdRef.current = null;
	options.pendingRouteReadyRef.current = false;
	options.replaceHistoryPath(options.buildThreadPath(options.activeThreadId));
	return true;
}
