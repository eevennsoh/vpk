// Types the Rovo and Studio app shells share for their Realtime voice wiring and typed-scroll anchor.
import type { FileUIPart } from "ai";
import type { RovoAppHookResult } from "@/components/projects/rovo-core/hooks/use-rovo-app-core";
import type {
	DelegationRequest,
	UseRealtimeVoiceOptions,
	UseRealtimeVoiceResult,
} from "@/components/projects/rovo-core/hooks/use-realtime-voice";
import type { RovoRealtimeShellAdapter } from "@/components/projects/rovo-core/hooks/use-rovo-realtime-shell-bridge";

export type RealtimeInjectContextPayload = {
	type: string;
	content?: string;
	role?: string;
	summary?: string;
	[key: string]: unknown;
};

export type RovoAppRealtimeShellAdapter = RovoRealtimeShellAdapter<RovoAppHookResult> & {
	delegateToRovo?: (messageId: string, options?: Record<string, unknown>) => Promise<void>;
	submitRealtimeText?: (payload: { contextDescription?: string; files: FileUIPart[]; text: string }) => Promise<void>;
};

export type ExtendedDelegationRequest = DelegationRequest & {
	delegatedMessageId?: string;
	messageId?: string;
	realtimeMessageId?: string;
};

export type RealtimeSpeechTranscriptPayload =
	| string
	| {
			delta?: string;
			messageId?: string;
			text?: string;
			transcript?: string;
	  };

export type RealtimeAssistantTextPayload =
	| string
	| {
			delta?: string;
			displayOnly?: boolean;
			messageId?: string;
			replace?: boolean;
			source?: "text" | "audio_transcript";
			text?: string;
	  };

export type RealtimeAssistantTextCompletedPayload =
	| string
	| {
			messageId?: string;
			text?: string;
	  };

/** The route `useRealtimeVoice` options (the route hook fixes `sessionPolicyMode`) plus the shell callbacks. */
export type RealtimeVoiceShellOptions = Omit<UseRealtimeVoiceOptions, "sessionPolicyMode"> & {
	onAssistantTextCompleted?: (payload: string | { messageId?: string; text?: string }) => void;
	onAssistantTextDelta?: (payload: string | { delta?: string; displayOnly?: boolean; messageId?: string; replace?: boolean; source?: "text" | "audio_transcript"; text?: string }) => void;
	onSpeechTranscriptCompleted?: (payload: string | { messageId?: string; transcript?: string; text?: string }) => void;
	onSpeechTranscriptDelta?: (payload: string | { delta?: string; messageId?: string; text?: string }) => void;
	onTextResponseStart?: (payload?: { messageId?: string }) => void;
};

export type RealtimeVoiceShellResult = UseRealtimeVoiceResult & {
	connectionState?: string;
	connectionStatus?: string;
	currentAssistantMessageId?: string | null;
	currentUserMessageId?: string | null;
	isReconnecting?: boolean;
	sendTextInput?: (payload: { contextDescription?: string; messageId?: string; text: string }) => Promise<void>;
	sessionId?: string;
	sessionKey?: string;
	statusMessage?: string | null;
};

export type TypedScrollAnchorSource = "none" | "standard" | "realtime";

export type ScrollActiveTimelineSelection = {
	latestTimelineMessageId: string | null;
	messageId: string;
	runtimeThreadId: string | null;
};
