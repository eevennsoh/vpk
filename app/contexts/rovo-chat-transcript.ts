import type { FileUIPart } from "ai";
import { createRovoAppUserMessage } from "@/components/projects/rovo-core/lib/rovo-app-user-message";
import { createId } from "@/lib/utils";
import type { RovoMessageMetadata, RovoUIMessage } from "@/lib/rovo-ui-messages";
import type { RovoChatTransitionKind, RovoChatTransitionToken } from "./rovo-chat-transition-coordinator";

export interface RovoSessionSnapshot {
	agentId?: string;
	markPersisted?: boolean;
	messages: ReadonlyArray<RovoUIMessage>;
	threadId: string | null;
}

export interface RovoLocalAssistantStage {
	delayMs: number;
	getAssistantParts: (context: { startedAt: Date }) => RovoUIMessage["parts"];
	onApply?: () => Promise<void> | void;
	startsNewAssistantMessage?: boolean;
}

export interface RovoLocalTurn {
	assistantParts: RovoUIMessage["parts"];
	assistantPartStages?: readonly RovoLocalAssistantStage[];
	assistantMessageId?: string;
	files?: ReadonlyArray<FileUIPart>;
	getAssistantParts?: (context: { startedAt: Date }) => RovoUIMessage["parts"];
	getPendingAssistantParts?: (context: { startedAt: Date }) => RovoUIMessage["parts"];
	history?: "append" | "replace";
	onApply?: () => Promise<void> | void;
	onApplyAfterResponse?: () => Promise<void> | void;
	onThinkingMessageChange?: (messageId: string | null) => void;
	pendingAssistantParts?: RovoUIMessage["parts"];
	promptText: string;
	delayMs?: number;
	signal?: AbortSignal;
	userMetadata?: RovoMessageMetadata;
	userMessage?: RovoUIMessage;
}

export interface RovoChatTranscriptOwner {
	begin: (kind: RovoChatTransitionKind) => { token: RovoChatTransitionToken; signal: AbortSignal };
	isCurrent: (token: RovoChatTransitionToken) => boolean;
	finish: (token: RovoChatTransitionToken) => void;
	stop: () => Promise<void>;
	ensureThread: (seed: string, signal: AbortSignal) => Promise<string>;
	readMessages: () => ReadonlyArray<RovoUIMessage>;
	resetPending: () => void;
	writeMessages: (messages: ReadonlyArray<RovoUIMessage>) => void;
	writeSnapshot: (snapshot: RovoSessionSnapshot) => void;
	selectAgent: (agentId: string) => void;
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
	if (signal.aborted) return Promise.resolve();
	return new Promise((resolve) => {
		const finish = () => {
			clearTimeout(timer);
			signal.removeEventListener("abort", finish);
			resolve();
		};
		const timer = setTimeout(finish, ms);
		signal.addEventListener("abort", finish, { once: true });
	});
}

function waitForThreadCreation(pending: Promise<string>, signal: AbortSignal): Promise<string> {
	return new Promise((resolve, reject) => {
		const onAbort = () => reject(new DOMException("Local turn cancelled", "AbortError"));
		if (signal.aborted) onAbort();
		else signal.addEventListener("abort", onAbort, { once: true });
		// Both handlers remain attached after cancellation so a late network
		// rejection is consumed and cannot escape the owning operation.
		pending.then(
			(threadId) => { signal.removeEventListener("abort", onAbort); resolve(threadId); },
			(error) => { signal.removeEventListener("abort", onAbort); reject(error); },
		);
	});
}

/** Uses the provider's transition owner so resets and network turns supersede local work. */
export function createRovoChatTranscript(initialOwner: RovoChatTranscriptOwner) {
	let configuredOwner = initialOwner;
	return {
		configure(owner: RovoChatTranscriptOwner) { configuredOwner = owner; },
		async activateSession(snapshot: RovoSessionSnapshot): Promise<boolean> {
			const owner = configuredOwner;
			const { token, signal } = owner.begin("activate-session");
			try {
				await owner.stop();
				if (signal.aborted || !owner.isCurrent(token)) return false;
				owner.resetPending();
				if (snapshot.agentId) owner.selectAgent(snapshot.agentId);
				owner.writeSnapshot(snapshot);
				return true;
			} catch (error) {
				if (signal.aborted || !owner.isCurrent(token)) return false;
				throw error;
			} finally {
				owner.finish(token);
			}
		},
		async applyLocalTurn(turn: RovoLocalTurn): Promise<boolean> {
			const owner = configuredOwner;
			const { token, signal } = owner.begin("apply-local-turn");
			const turnSignal = turn.signal ? AbortSignal.any([signal, turn.signal]) : signal;
			const active = () => !turnSignal.aborted && owner.isCurrent(token);
			try {
				await owner.stop();
				if (!active()) return false;
				owner.resetPending();
				await waitForThreadCreation(owner.ensureThread(turn.promptText || turn.files?.[0]?.filename || "New chat", turnSignal), turnSignal);
				if (!active()) return false;
				const base = turn.history === "replace" ? [] : owner.readMessages();
				const createdAt = new Date().toISOString();
				const startedAt = new Date();
				const user = turn.userMessage ?? createRovoAppUserMessage({
					id: createId("rovo-chat-user"), createdAt, files: turn.files ?? [], text: turn.promptText, metadata: turn.userMetadata,
				});
				const assistant = (id: string, parts: RovoUIMessage["parts"]): RovoUIMessage => ({
					id, role: "assistant", metadata: { origin: "rovo", createdAt, updatedAt: new Date().toISOString() }, parts,
				});
				let assistantId = turn.assistantMessageId ?? createId("rovo-chat-assistant");
				let replies = [assistant(assistantId, turn.getPendingAssistantParts?.({ startedAt }) ?? turn.pendingAssistantParts ?? turn.assistantParts)];
				const commit = () => owner.writeMessages([...base, user, ...replies]);
				commit();
				const stages = turn.assistantPartStages ?? [];
				if (stages.length > 0) {
					turn.onThinkingMessageChange?.(assistantId);
					for (const stage of stages) {
						if (stage.delayMs > 0) await wait(stage.delayMs, turnSignal);
						if (!active()) return false;
						await stage.onApply?.();
						if (!active()) return false;
						const parts = stage.getAssistantParts({ startedAt });
						if (stage.startsNewAssistantMessage) {
							assistantId = createId("rovo-chat-assistant");
							turn.onThinkingMessageChange?.(assistantId);
							replies = [...replies, assistant(assistantId, parts)];
						} else replies = [...replies.slice(0, -1), assistant(assistantId, parts)];
						commit();
					}
				} else if ((turn.pendingAssistantParts || turn.getPendingAssistantParts) && (turn.delayMs ?? 0) > 0) {
					turn.onThinkingMessageChange?.(assistantId);
					await wait(turn.delayMs ?? 0, turnSignal);
				}
				if (!active()) return false;
				await turn.onApply?.();
				if (!active()) return false;
				const final = turn.getAssistantParts?.({ startedAt }) ?? (stages.length > 0 ? replies.at(-1)?.parts : null) ?? turn.assistantParts;
				if (replies.at(-1)?.parts !== final) {
					replies = [...replies.slice(0, -1), assistant(assistantId, final)];
					commit();
				}
				await turn.onApplyAfterResponse?.();
				return active();
			} catch (error) {
				if (!active()) return false;
				throw error;
			} finally {
				if (owner.isCurrent(token)) turn.onThinkingMessageChange?.(null);
				owner.finish(token);
			}
		},
	};
}
