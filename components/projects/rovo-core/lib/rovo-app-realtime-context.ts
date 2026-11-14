// Context the Rovo app shells inject into, and read back from, a Realtime voice session. Not the
// same as rovo-core/lib/rovo-realtime-thread-summary.ts, which the voice hook injects on connect.
import {
	getMessageArtifactResult,
	getMessageText,
	type RovoUIMessage,
} from "@/lib/rovo-ui-messages";

const ROVO_APP_REALTIME_THREAD_SUMMARY_MAX_MESSAGES = 10;
export const ROVO_APP_REALTIME_RESULT_SUMMARY_MAX_CHARS = 500;

type RovoAppRealtimeMessage = Pick<RovoUIMessage, "parts" | "role">;

export type RovoAppRealtimeStatusInput = {
	connectionState?: string;
	connectionStatus?: string;
	isReconnecting?: boolean;
	sessionId?: string;
	sessionKey?: string;
	statusMessage?: string | null;
	voiceState: string;
};

export function buildRovoAppRealtimeThreadSummary(messages: ReadonlyArray<RovoAppRealtimeMessage>): string {
	const summary = messages
		.filter((message) => message.role === "user" || message.role === "assistant")
		.slice(-ROVO_APP_REALTIME_THREAD_SUMMARY_MAX_MESSAGES)
		.map((message) => {
			const text = getMessageText(message).trim();
			const artifact = getMessageArtifactResult(message);
			const fragments = [text || null, artifact ? `${artifact.action === "update" ? "Updated" : "Created"} artifact "${artifact.title}".` : null].filter((fragment): fragment is string =>
				Boolean(fragment),
			);

			if (fragments.length === 0) {
				return null;
			}

			return `${message.role}: ${fragments.join(" ")}`.trim();
		})
		.filter((line): line is string => Boolean(line))
		.join("\n");

	return summary.slice(0, 2_000);
}

/** What a delegated turn produced, told back to the voice session in the product's name ("Rovo", "Studio"). */
export function buildRovoAppRealtimeResultSummary(message: Pick<RovoUIMessage, "parts">, productName: string): string {
	const text = getMessageText(message);
	const artifact = getMessageArtifactResult(message);
	const summary = artifact ? `${productName} ${artifact.action === "update" ? "updated" : "created"} artifact "${artifact.title}". ${text || ""}` : text || `${productName} completed the task.`;

	return summary.slice(0, ROVO_APP_REALTIME_RESULT_SUMMARY_MAX_CHARS);
}

export function buildRovoAppRealtimeArtifactContextSummary(input: {
	annotationContext: string | null;
	document: {
		id: string;
		kind: string;
		title: string;
	} | null;
}): string | null {
	if (!input.document) {
		return null;
	}

	return [`Artifact open: ${input.document.title}`, `Document ID: ${input.document.id}`, `Kind: ${input.document.kind}`, input.annotationContext ? input.annotationContext : null]
		.filter((part): part is string => Boolean(part))
		.join("\n");
}

export function resolveRovoAppRealtimeStatusMessage(realtime: RovoAppRealtimeStatusInput): string | null {
	const directStatus = typeof realtime.statusMessage === "string" && realtime.statusMessage.trim() ? realtime.statusMessage.trim() : null;
	if (directStatus) {
		return directStatus;
	}

	const connectionState =
		typeof realtime.connectionState === "string" && realtime.connectionState.trim()
			? realtime.connectionState.trim().toLowerCase()
			: typeof realtime.connectionStatus === "string" && realtime.connectionStatus.trim()
				? realtime.connectionStatus.trim().toLowerCase()
				: null;

	if (connectionState === "reconnecting" || realtime.isReconnecting) {
		return "Reconnecting voice...";
	}

	if (connectionState === "disconnected") {
		return "Voice disconnected";
	}

	return null;
}

export function resolveRovoAppRealtimeSessionIdentity(realtime: RovoAppRealtimeStatusInput, activeThreadId: string | null, runtimeThreadId: string): string | null {
	const candidates = [realtime.sessionId, realtime.sessionKey, realtime.connectionState, realtime.connectionStatus];

	const explicitIdentity = candidates.find((candidate) => {
		return typeof candidate === "string" && candidate.trim().length > 0;
	});

	if (explicitIdentity) {
		return explicitIdentity;
	}

	return realtime.voiceState !== "idle" ? `${activeThreadId ?? runtimeThreadId}:${realtime.voiceState}` : null;
}
