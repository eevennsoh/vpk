// oxlint-disable react-doctor/exhaustive-deps -- Callbacks in this file intentionally read stable refs that bridge realtime tool calls and composer state.

import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { FileUIPart } from "ai";
import type { ChatSurface } from "@/app/contexts/context-rovo-chat";
import {
	activateStudioScreenAssistantTarget,
	createStudioScreenAssistantSnapshot,
	getStudioScreenAssistantVisibleTargets,
	getViewportPointFromScreenAssistantTarget,
	groundStudioScreenAssistantTarget,
	type StudioScreenAssistantRegion,
	type StudioScreenAssistantToolCall,
	type StudioScreenAssistantToolResponder,
} from "@/components/projects/rovo-core/lib/screen-assistant";
import type { ChatPanelClicky } from "./use-chat-panel-clicky";

interface UseChatPanelScreenAssistantOptions {
	chatSurface: ChatSurface | null;
	clicky: ChatPanelClicky["clicky"];
	handleComposerSubmit: (input: { text: string; files: FileUIPart[] }) => Promise<void>;
	promptRef: RefObject<string>;
	screenAssistantRegion: StudioScreenAssistantRegion | null;
	selectedAgent: { id: string; name: string };
	setPrompt: (prompt: string) => void;
}

/**
 * Screen-assistant tools the realtime voice session can call from the chat
 * panel: read the screen, point the AI cursor at a target, activate it, and
 * fill or submit the composer.
 */
export function useChatPanelScreenAssistant({
	chatSurface,
	clicky,
	handleComposerSubmit,
	promptRef,
	screenAssistantRegion,
	selectedAgent,
	setPrompt,
}: Readonly<UseChatPanelScreenAssistantOptions>) {
	const {
		activate: activateClicky,
		isActive: isClickyActive,
		startPointing: clickyStartPointing,
	} = clicky;
	const screenAssistantPointerRef = useRef<{ x: number; y: number } | null>(null);

	useEffect(() => {
		const handlePointerMove = (event: PointerEvent) => {
			screenAssistantPointerRef.current = {
				x: event.clientX,
				y: event.clientY,
			};
		};

		window.addEventListener("pointermove", handlePointerMove, { passive: true });
		return () => window.removeEventListener("pointermove", handlePointerMove);
	}, []);

	const getScreenAssistantVisibleTargets = useCallback(
		() => getStudioScreenAssistantVisibleTargets(),
		[],
	);

	const getScreenAssistantSnapshot = useCallback(() => {
		return createStudioScreenAssistantSnapshot({
			activeRegion: screenAssistantRegion,
			activePanel: `sidebar-chat:${chatSurface}`,
			composer: {
				hasPrefill: Boolean(promptRef.current.trim()),
				placeholder: "Ask Rovo",
			},
			pointer: screenAssistantPointerRef.current,
			selectedAgent: {
				id: selectedAgent.id,
				name: selectedAgent.name,
			},
		});
	}, [chatSurface, promptRef, screenAssistantRegion, selectedAgent.id, selectedAgent.name]);

	const handleScreenAssistantToolCall = useCallback(
		(
			{ name, args }: StudioScreenAssistantToolCall,
			respond: StudioScreenAssistantToolResponder,
		) => {
			switch (name) {
				case "get_screen_state": {
					respond(getScreenAssistantSnapshot());
					return;
				}
				case "point_at_target": {
					const snapshot = getScreenAssistantSnapshot();
					const grounded = groundStudioScreenAssistantTarget({
						fieldId: typeof args.fieldId === "string" ? args.fieldId : undefined,
						id: typeof args.targetId === "string" ? args.targetId : undefined,
						label: typeof args.label === "string" ? args.label : undefined,
						activeRegion: snapshot.activeRegion ?? null,
						pointerTarget: snapshot.pointerContext?.target ?? null,
						visibleTargets: snapshot.visibleTargets,
					});
					const point = getViewportPointFromScreenAssistantTarget(grounded);
					const label = typeof args.label === "string" ? args.label : grounded?.label ?? "";
					let pointingStarted = false;
					if (point) {
						if (!isClickyActive) {
							activateClicky();
						}
						clickyStartPointing(point, label);
						pointingStarted = true;
					}
					respond({
						ok: pointingStarted,
						pointed: pointingStarted && grounded ? { id: grounded.id, label: grounded.label } : null,
					});
					return;
				}
				case "activate_screen_target": {
					const snapshot = getScreenAssistantSnapshot();
					respond(activateStudioScreenAssistantTarget({
						fieldId: typeof args.fieldId === "string" ? args.fieldId : undefined,
						id: typeof args.targetId === "string" ? args.targetId : undefined,
						label: typeof args.label === "string" ? args.label : undefined,
						pointerTarget: snapshot.pointerContext?.target ?? null,
						visibleTargets: snapshot.visibleTargets,
					}));
					return;
				}
				case "set_composer_text": {
					const text = typeof args.text === "string" ? args.text : "";
					promptRef.current = text;
					setPrompt(text);
					respond({ ok: Boolean(text) });
					return;
				}
				case "submit_composer": {
					const text = promptRef.current.trim();
					if (text) {
						void handleComposerSubmit({ files: [], text });
					}
					respond({ ok: Boolean(text) });
					return;
				}
				case "apply_agent_draft_patch": {
					respond({ ok: false, error: "unsupported_surface" });
					return;
				}
				default:
					respond({ ok: false, error: "unknown_tool" });
			}
		},
		[
			activateClicky,
			clickyStartPointing,
			getScreenAssistantSnapshot,
			handleComposerSubmit,
			isClickyActive,
			promptRef,
			setPrompt,
		],
	);

	return { getScreenAssistantVisibleTargets, handleScreenAssistantToolCall };
}
