"use client";

import type {
	RovoAppDocument,
	RovoAppThread,
	RovoAppVisibility,
	RovoAppVote,
} from "@/lib/rovo-app-types";
import { API_ENDPOINTS } from "@/lib/api-config";
import type { RovoUIMessage } from "@/lib/rovo-ui-messages";

export const ROVO_APP_BACKEND_UNAVAILABLE_MESSAGE =
	"Cannot connect to backend server";

// Raw network-failure messages surfaced by the runtime/AI-SDK transport when the
// local backend is unreachable. The Next proxy normalizes most failures to
// ROVO_APP_BACKEND_UNAVAILABLE_MESSAGE, but streaming/transport errors can leak
// the underlying message (e.g. undici's "fetch failed", browsers' "Failed to
// fetch") straight through to onError. Treat those as backend-unavailable too so
// users see the actionable "start the backend" hint instead of a bare
// "fetch failed".
const ROVO_APP_NETWORK_FAILURE_MESSAGES = [
	ROVO_APP_BACKEND_UNAVAILABLE_MESSAGE,
	"fetch failed",
	"failed to fetch",
	"load failed",
	"network error",
	"networkerror when attempting to fetch resource.",
	"econnrefused",
	"connection refused",
].map((message) => message.toLowerCase());

export function isRovoAppBackendUnavailableError(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false;
	}

	const message = error.message.trim().toLowerCase();
	return ROVO_APP_NETWORK_FAILURE_MESSAGES.some(
		(candidate) => message === candidate || message.includes(candidate),
	);
}

export function getRovoAppBackendUnavailableUserMessage(): string {
	return "Rovo can't reach the local backend. Start `pnpm run dev:backend` or `pnpm run rovo`, then refresh.";
}

export function toRovoAppUserErrorMessage(error: unknown): string {
	if (isRovoAppBackendUnavailableError(error)) {
		return getRovoAppBackendUnavailableUserMessage();
	}

	return error instanceof Error ? error.message : String(error);
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
	if (!response.ok) {
		let message = `Request failed with status ${response.status}`;
		try {
			const payload = (await response.json()) as { error?: unknown; details?: unknown };
			if (typeof payload.error === "string" && payload.error.trim()) {
				message = payload.error.trim();
			} else if (typeof payload.details === "string" && payload.details.trim()) {
				message = payload.details.trim();
			}
		} catch {
			const text = await response.text().catch(() => "");
			if (text.trim()) {
				message = text.trim();
			}
		}
		throw new Error(message);
	}

	return response.json() as Promise<T>;
}

function assertRovoAppAvailable<T extends { backendUnavailable?: boolean }>(
	payload: T,
): T {
	if (payload.backendUnavailable) {
		throw new Error(ROVO_APP_BACKEND_UNAVAILABLE_MESSAGE);
	}

	return payload;
}

function normalizeRovoAppThread(thread: Partial<RovoAppThread> | null | undefined): RovoAppThread | null {
	if (!thread || typeof thread !== "object" || typeof thread.id !== "string" || thread.id.trim().length === 0) {
		return null;
	}

	return {
		activeDocumentId:
			typeof thread.activeDocumentId === "string" && thread.activeDocumentId.trim().length > 0
				? thread.activeDocumentId
				: null,
		activeRun: thread.activeRun ?? null,
		createdAt:
			typeof thread.createdAt === "string" && thread.createdAt.trim().length > 0
				? thread.createdAt
				: new Date(0).toISOString(),
		id: thread.id,
		messages: Array.isArray(thread.messages) ? thread.messages : [],
		modelId: typeof thread.modelId === "string" && thread.modelId.trim().length > 0 ? thread.modelId : null,
		provider: typeof thread.provider === "string" && thread.provider.trim().length > 0 ? thread.provider : null,
		realtimeMessages: Array.isArray(thread.realtimeMessages) ? thread.realtimeMessages : [],
		sessionId:
			typeof thread.sessionId === "string" && thread.sessionId.trim().length > 0
				? thread.sessionId
				: null,
		sessionMode:
			thread.sessionMode === "persistent" || thread.sessionMode === "ephemeral"
				? thread.sessionMode
				: null,
		title:
			typeof thread.title === "string" && thread.title.trim().length > 0
				? thread.title
				: "New chat",
		updatedAt:
			typeof thread.updatedAt === "string" && thread.updatedAt.trim().length > 0
				? thread.updatedAt
				: new Date(0).toISOString(),
		visibility: thread.visibility === "public" ? "public" : "private",
	};
}

export async function listRovoAppThreads(limit?: number): Promise<RovoAppThread[]> {
	const response = await fetch(API_ENDPOINTS.rovoAppThreads(limit), {
		method: "GET",
	});
	const payload = assertRovoAppAvailable(
		await parseJsonResponse<{ backendUnavailable?: boolean; threads?: Array<Partial<RovoAppThread>> }>(response),
	);
	return Array.isArray(payload.threads)
		? payload.threads
				.map((thread) => normalizeRovoAppThread(thread))
				.filter((thread): thread is RovoAppThread => thread !== null)
		: [];
}

export async function getRovoAppThread(threadId: string): Promise<RovoAppThread | null> {
	const response = await fetch(API_ENDPOINTS.rovoAppThread(threadId), {
		method: "GET",
	});
	if (response.status === 404) {
		return null;
	}
	const payload = assertRovoAppAvailable(
		await parseJsonResponse<{ backendUnavailable?: boolean; thread?: Partial<RovoAppThread> | null }>(response),
	);
	return normalizeRovoAppThread(payload.thread);
}

export async function createRovoAppThread(input: {
	id: string;
	title: string;
	messages?: ReadonlyArray<RovoUIMessage>;
	realtimeMessages?: ReadonlyArray<RovoUIMessage>;
	visibility: RovoAppVisibility;
	modelId?: string | null;
	provider?: string | null;
	activeDocumentId?: string | null;
}): Promise<RovoAppThread> {
	const response = await fetch(API_ENDPOINTS.ROVO_APP_THREADS, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	const payload = await parseJsonResponse<{ thread?: Partial<RovoAppThread> }>(response);
	const thread = normalizeRovoAppThread(payload.thread);
	if (!thread) {
		throw new Error("Rovo thread response was missing a thread.");
	}
	return thread;
}

export async function updateRovoAppThread(
	threadId: string,
	input: {
		title?: string;
		messages?: ReadonlyArray<RovoUIMessage>;
		realtimeMessages?: ReadonlyArray<RovoUIMessage>;
		visibility?: RovoAppVisibility;
		modelId?: string | null;
		provider?: string | null;
		activeDocumentId?: string | null;
	},
): Promise<RovoAppThread> {
	const response = await fetch(API_ENDPOINTS.rovoAppThread(threadId), {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	const payload = await parseJsonResponse<{ thread?: Partial<RovoAppThread> }>(response);
	const thread = normalizeRovoAppThread(payload.thread);
	if (!thread) {
		throw new Error("Rovo update response was missing a thread.");
	}
	return thread;
}

export async function deleteRovoAppThread(threadId: string): Promise<void> {
	const response = await fetch(API_ENDPOINTS.rovoAppThread(threadId), {
		method: "DELETE",
	});
	await parseJsonResponse<{ deleted?: boolean }>(response);
}

export async function deleteAllRovoAppThreads(): Promise<void> {
	const response = await fetch(`${API_ENDPOINTS.ROVO_APP_THREADS}?all=true`, {
		method: "DELETE",
	});
	await parseJsonResponse<{ deleted?: boolean }>(response);
}

export async function listRovoAppRealtimeMessages(
	threadId: string,
): Promise<RovoUIMessage[]> {
	const response = await fetch(API_ENDPOINTS.rovoAppMessages(threadId), {
		method: "GET",
	});
	const payload = assertRovoAppAvailable(
		await parseJsonResponse<{ backendUnavailable?: boolean; messages?: RovoUIMessage[] }>(
			response,
		),
	);
	return Array.isArray(payload.messages) ? payload.messages : [];
}

export async function saveRovoAppRealtimeMessages(input: {
	threadId: string;
	messages: ReadonlyArray<RovoUIMessage>;
}): Promise<RovoUIMessage[]> {
	const response = await fetch(API_ENDPOINTS.ROVO_APP_MESSAGES, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	const payload = await parseJsonResponse<{ messages?: RovoUIMessage[] }>(response);
	if (!Array.isArray(payload.messages)) {
		throw new Error("Rovo realtime message response was missing messages.");
	}
	return payload.messages;
}

export async function upsertRovoAppRealtimeMessage(input: {
	threadId: string;
	message: RovoUIMessage;
}): Promise<RovoUIMessage[]> {
	const response = await fetch(API_ENDPOINTS.ROVO_APP_MESSAGES, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	const payload = await parseJsonResponse<{ messages?: RovoUIMessage[] }>(response);
	if (!Array.isArray(payload.messages)) {
		throw new Error("Rovo realtime upsert response was missing messages.");
	}
	return payload.messages;
}

export async function fetchRovoAppSuggestedQuestions(input: {
	message: string;
	conversationHistory: Array<{
		type: "user" | "assistant";
		content: string;
	}>;
	assistantResponse: string;
	signal?: AbortSignal;
}): Promise<string[]> {
	const { signal, ...body } = input;
	const response = await fetch(API_ENDPOINTS.ROVO_APP_SUGGESTIONS, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
		signal,
	});
	const payload = assertRovoAppAvailable(
		await parseJsonResponse<{
			backendUnavailable?: boolean;
			questions?: string[];
		}>(response),
	);
	return Array.isArray(payload.questions)
		? payload.questions.filter(
			(question) =>
				typeof question === "string" && question.trim().length > 0,
		)
		: [];
}

export async function listRovoAppVotes(threadId: string): Promise<RovoAppVote[]> {
	const response = await fetch(`${API_ENDPOINTS.ROVO_APP_VOTES}?threadId=${encodeURIComponent(threadId)}`, {
		method: "GET",
	});
	const payload = assertRovoAppAvailable(
		await parseJsonResponse<{ backendUnavailable?: boolean; votes?: RovoAppVote[] }>(response),
	);
	return Array.isArray(payload.votes) ? payload.votes : [];
}

export async function setRovoAppVote(input: {
	threadId: string;
	messageId: string;
	value: "up" | "down" | null;
}): Promise<RovoAppVote> {
	const response = await fetch(API_ENDPOINTS.ROVO_APP_VOTES, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	const payload = await parseJsonResponse<{ vote?: RovoAppVote }>(response);
	if (!payload.vote) {
		throw new Error("Rovo vote response was missing a vote.");
	}
	return payload.vote;
}

export async function listRovoAppDocuments(threadId: string): Promise<RovoAppDocument[]> {
	const response = await fetch(`${API_ENDPOINTS.ROVO_APP_DOCUMENTS}?threadId=${encodeURIComponent(threadId)}`, {
		method: "GET",
	});
	const payload = assertRovoAppAvailable(
		await parseJsonResponse<{ backendUnavailable?: boolean; documents?: RovoAppDocument[] }>(response),
	);
	return Array.isArray(payload.documents) ? payload.documents : [];
}

export async function getRovoAppDocument(documentId: string): Promise<RovoAppDocument | null> {
	const response = await fetch(`${API_ENDPOINTS.ROVO_APP_DOCUMENTS}?documentId=${encodeURIComponent(documentId)}`, {
		method: "GET",
	});
	if (response.status === 404) {
		return null;
	}
	const payload = assertRovoAppAvailable(
		await parseJsonResponse<{ backendUnavailable?: boolean; document?: RovoAppDocument | null }>(response),
	);
	return payload.document ?? null;
}

export async function saveRovoAppDocument(input: {
	changeLabel?: string;
	documentId?: string;
	threadId?: string;
	title?: string;
	kind?: string;
	content?: string;
	sourceMessageId?: string;
}): Promise<RovoAppDocument> {
	const response = await fetch(API_ENDPOINTS.ROVO_APP_DOCUMENTS, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	const payload = await parseJsonResponse<{ document?: RovoAppDocument }>(response);
	if (!payload.document) {
		throw new Error("Rovo document response was missing a document.");
	}
	return payload.document;
}

export async function deleteRovoAppDocument(documentId: string): Promise<void> {
	const response = await fetch(`${API_ENDPOINTS.ROVO_APP_DOCUMENTS}?documentId=${encodeURIComponent(documentId)}`, {
		method: "DELETE",
	});
	await parseJsonResponse<{ deleted?: boolean }>(response);
}

export async function detachRovoAppStream(threadId: string): Promise<boolean> {
	const response = await fetch(API_ENDPOINTS.ROVO_APP_DETACH, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ threadId }),
	});
	if (response.status === 404) {
		return false;
	}
	const payload = await parseJsonResponse<{ detached?: boolean }>(response);
	return payload.detached === true;
}

export async function listRovoAppBackgroundStreams(): Promise<Array<{ threadId: string; status: string; startedAt: number }>> {
	const response = await fetch(API_ENDPOINTS.ROVO_APP_BACKGROUND_STREAMS, {
		method: "GET",
	});
	const payload = await parseJsonResponse<{ streams?: Array<{ threadId: string; status: string; startedAt: number }> }>(response);
	return Array.isArray(payload.streams) ? payload.streams : [];
}

export async function fetchRovoAppAITitle(message: string): Promise<string | null> {
	try {
		const response = await fetch(API_ENDPOINTS.CHAT_TITLE, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ message }),
		});
		if (!response.ok) return null;
		const data = (await response.json()) as { title?: string };
		const title = (data.title ?? "").trim().replace(/^["']|["']$/g, "").replace(/\.+$/, "").trim();
		return title.length > 0 ? title : null;
	} catch {
		return null;
	}
}

export async function detachRovoAppRun(threadId: string): Promise<boolean> {
	const response = await fetch(API_ENDPOINTS.rovoAppRunDetach(threadId), {
		method: "POST",
	});
	if (response.status === 404) {
		return false;
	}
	const payload = await parseJsonResponse<{ detached?: boolean }>(response);
	return payload.detached === true;
}

export async function cancelRovoAppRun(threadId: string): Promise<boolean> {
	const response = await fetch(API_ENDPOINTS.rovoAppRunCancel(threadId), {
		method: "POST",
	});
	if (response.status === 404) {
		return false;
	}
	const payload = await parseJsonResponse<{ cancelled?: boolean }>(response);
	return payload.cancelled === true;
}
