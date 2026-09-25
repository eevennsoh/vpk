import type { FileUIPart } from "ai";
import type { RovoMessageMetadata, RovoUIMessage } from "@/lib/rovo-ui-messages";
import { createId } from "@/lib/utils";

export type RovoAppVisibility = "private" | "public";
export type RovoAppDocumentKind = "text" | "code" | "html" | "image" | "sheet" | "react" | "excalidraw" | "browser";
export type ArtifactMode = "preview" | "edit";
export type VoteValue = "up" | "down";
export type RovoAppRunStatus = "queued" | "streaming" | "background";
export type RovoAppRunBackend = "ai-gateway" | "rovo";
export type RovoAppPromptMode = "default" | "plan";
export type RovoAppCreationMode = "agent" | "skill";

/**
 * Artifact panel state:
 * - `closed`: panel hidden, normal chat mode (GenUI cards)
 * - `preview`: rendered artifact visible, chat input routes to artifact updates
 */
export type RovoAppPanelState = "closed" | "preview";

export interface RovoAppActiveRun {
	id: string;
	backend: RovoAppRunBackend;
	status: RovoAppRunStatus;
	rovoPort: number | null;
	startedAt: string;
	updatedAt: string;
}

export interface RovoAppThread {
	id: string;
	title: string;
	messages: RovoUIMessage[];
	realtimeMessages: RovoUIMessage[];
	visibility: RovoAppVisibility;
	modelId: string | null;
	provider: string | null;
	activeDocumentId: string | null;
	sessionId: string | null;
	sessionMode: "persistent" | "ephemeral" | null;
	activeRun?: RovoAppActiveRun | null;
	createdAt: string;
	updatedAt: string;
}

export interface RovoAppVote {
	threadId: string;
	messageId: string;
	value: "up" | "down" | null;
	isUpvoted: boolean | null;
}

export interface RovoAppDocumentVersion {
	changeLabel: string;
	id: string;
	content: string;
	createdAt: string;
	title: string;
}

export interface RovoAppDocument {
	id: string;
	threadId: string;
	title: string;
	kind: RovoAppDocumentKind;
	previewSummary?: string;
	sourceMessageId: string | null;
	createdAt: string;
	updatedAt: string;
	versions: RovoAppDocumentVersion[];
}

export interface RovoAppActiveArtifact {
	id: string;
	title: string;
	kind: string;
}

export interface RovoAppVoiceMetadata {
	intentType?: string;
	urgency?: string;
	conversationSummary?: string;
}

export interface RovoAppRecentHistoryEntry {
	role: "user" | "assistant";
	content: string;
	intent?: string;
}

export interface RovoAppQueuedActionBase {
	id: string;
	threadId: string;
	text: string;
	createdAt: number;
}

export interface RovoAppQueuedPromptAction
	extends RovoAppQueuedActionBase {
	kind: "prompt";
	files: ReadonlyArray<FileUIPart>;
	contextDescription?: string;
	creationMode?: RovoAppCreationMode;
	/** Snapshotted composer mode for this specific prompt. */
	mode: RovoAppPromptMode;
	messageMetadata?: RovoMessageMetadata;
}

export interface RovoAppQueuedDelegationAction
	extends RovoAppQueuedActionBase {
	kind: "delegation";
	contextDescription?: string;
	conversationSummary?: string;
	delegatedMessageId: string;
	existingRealtimeMessageId?: string | null;
	intentType?: string;
	referencedFiles?: string[];
	urgency?: string;
}

export type RovoAppQueuedAction =
	| RovoAppQueuedPromptAction
	| RovoAppQueuedDelegationAction;

export interface RovoAppRoutingMetadata {
	activeArtifact?: RovoAppActiveArtifact;
	origin?: "text" | "voice";
	voiceMetadata?: RovoAppVoiceMetadata;
	recentHistory?: RovoAppRecentHistoryEntry[];
}

export function createRovoAppId(): string {
	return createId("rovo-app");
}
