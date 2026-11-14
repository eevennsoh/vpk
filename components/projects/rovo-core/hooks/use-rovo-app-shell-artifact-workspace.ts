"use client";

import { useCallback, useEffect, useMemo, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { RovoAppHookResult } from "@/components/projects/rovo-core/hooks/use-rovo-app-core";
import {
	buildRovoAppBrowserArtifactKey,
	shouldAutoOpenRovoAppBrowserArtifact,
	shouldShowReopenRovoAppBrowserArtifactControl,
} from "@/components/projects/rovo-core/lib/rovo-app-browser-preview";
import { useArtifactAnnotations } from "@/components/ui-custom/hooks/use-artifact-annotations";
import { formatAnnotationsForVoiceContext, type ArtifactAnnotation } from "@/components/ui-custom/lib/artifact-annotations";
import { getLatestDataPart } from "@/lib/rovo-ui-messages";

export interface RovoAppShellArtifactWorkspaceOptions {
	chat: RovoAppHookResult;
	isArtifactOpen: boolean;
	/** The annotation cursor toggle; the shell owns the state (Studio's demo reset also clears it). */
	cursorMode: boolean;
	setCursorMode: Dispatch<SetStateAction<boolean>>;
	/** The browser preview the user closed; the shell owns the state (Studio's demo reset also clears it). */
	dismissedBrowserArtifactKey: string | null;
	setDismissedBrowserArtifactKey: Dispatch<SetStateAction<string | null>>;
	artifactContentRef: RefObject<HTMLDivElement | null>;
	/** The shell's prompt options for a turn with this hidden context (applied annotations are sent as turns). */
	buildPromptOptions: (contextDescription?: string) => { contextDescription?: string };
}

/**
 * The artifact workspace of a Rovo app shell: which document (or streaming draft) and version the
 * pane shows, the browser preview derived from message data parts and its dismissal, the
 * annotation cursor and its resets, and the pane's close and browser-preview handlers.
 */
export function useRovoAppShellArtifactWorkspace({
	artifactContentRef,
	buildPromptOptions,
	chat,
	cursorMode,
	dismissedBrowserArtifactKey,
	isArtifactOpen,
	setCursorMode,
	setDismissedBrowserArtifactKey,
}: Readonly<RovoAppShellArtifactWorkspaceOptions>) {
	const visibleWorkspaceDocumentId = chat.visibleArtifactDocumentId;
	const workspaceDocument = useMemo(() => {
		return visibleWorkspaceDocumentId && chat.streamingArtifact?.documentId === visibleWorkspaceDocumentId
			? {
					id: chat.streamingArtifact.documentId ?? "streaming-artifact",
					threadId: chat.activeThreadId ?? chat.runtimeThreadId,
					title: chat.streamingArtifact.title || "Artifact draft",
					kind: chat.streamingArtifact.kind,
					sourceMessageId: null,
					createdAt: chat.streamingArtifact.createdAt,
					updatedAt: chat.streamingArtifact.updatedAt,
					versions: [
						{
							changeLabel: "Generating",
							id: "streaming",
							content: chat.streamingArtifact.content,
							createdAt: chat.streamingArtifact.updatedAt,
							title: chat.streamingArtifact.title || "Artifact draft",
						},
					],
				}
			: visibleWorkspaceDocumentId
				? (chat.documents.find((document) => document.id === visibleWorkspaceDocumentId) ?? null)
				: null;
	}, [chat.activeThreadId, chat.documents, chat.runtimeThreadId, chat.streamingArtifact, visibleWorkspaceDocumentId]);
	const selectedDocumentVersion = useMemo(() => {
		return workspaceDocument?.versions.find((version) => version.id === chat.selectedVersionId) ?? workspaceDocument?.versions.at(-1) ?? null;
	}, [chat.selectedVersionId, workspaceDocument]);

	// Derive the latest browser state from message data parts
	const latestBrowserArtifact = useMemo(() => {
		let browserState = null;
		let browserStateMessageId: string | null = null;
		let browserScreenshot = null;

		for (let i = chat.messages.length - 1; i >= 0; i--) {
			const message = chat.messages[i];
			if (!browserState) {
				const part = getLatestDataPart(message, "data-browser-state");
				if (part) {
					browserState = part.data;
					browserStateMessageId = message.id;
				}
			}

			if (!browserScreenshot) {
				const part = getLatestDataPart(message, "data-browser-screenshot");
				if (part) {
					browserScreenshot = part.data;
				}
			}

			if (browserState && browserScreenshot) {
				break;
			}
		}

		return {
			browserArtifactKey: buildRovoAppBrowserArtifactKey({
				browserScreenshot,
				browserState,
				messageId: browserStateMessageId,
			}),
			browserScreenshot,
			browserState,
		};
	}, [chat.messages]);
	const browserArtifactKey = latestBrowserArtifact.browserArtifactKey;
	const browserState = latestBrowserArtifact.browserState;
	const browserScreenshot = latestBrowserArtifact.browserScreenshot;

	useEffect(() => {
		setDismissedBrowserArtifactKey(null);
	}, [chat.runtimeThreadId, setDismissedBrowserArtifactKey]);

	// Auto-open artifact panel when browser state arrives and no document artifact is active
	useEffect(() => {
		if (shouldAutoOpenRovoAppBrowserArtifact({
			browserArtifactKey,
			dismissedBrowserArtifactKey,
			hasWorkspaceDocument: Boolean(workspaceDocument),
			panelState: chat.panelState,
		})) {
			chat.setPanelState("preview");
		}
	}, [browserArtifactKey, chat, dismissedBrowserArtifactKey, workspaceDocument]);
	const shouldShowReopenBrowserPreviewControl = shouldShowReopenRovoAppBrowserArtifactControl({
		browserArtifactKey,
		dismissedBrowserArtifactKey,
		hasWorkspaceDocument: Boolean(workspaceDocument),
		panelState: chat.panelState,
	});

	const canAnnotateWorkspaceDocument = workspaceDocument !== null;
	const annotationState = useArtifactAnnotations({
		active: cursorMode && isArtifactOpen && !chat.streamingArtifact && chat.artifactMode === "preview" && process.env.NODE_ENV === "development",
		documentId: workspaceDocument?.id ?? null,
		documentKind: workspaceDocument?.kind ?? null,
		documentVersionId: selectedDocumentVersion?.id ?? null,
		containerRef: artifactContentRef,
	});
	const {
		annotations: artifactAnnotations,
		addComment: addArtifactAnnotationComment,
		clearAnnotations,
		dismissSelection: dismissArtifactSelection,
		formatContextForVoice,
		pendingSelection: pendingArtifactSelection,
		removeAnnotation: removeArtifactAnnotation,
	} = annotationState;

	const handleApplyAnnotations = useCallback(
		(annotationsToApply: ArtifactAnnotation[]) => {
			if (annotationsToApply.length === 0) {
				return;
			}

			for (const annotation of annotationsToApply) {
				const contextDescription = formatAnnotationsForVoiceContext([annotation]);
				void chat
					.submitPrompt({
						...buildPromptOptions(contextDescription),
						text: annotation.comment,
						files: [],
					})
					.catch(() => {});
			}

			clearAnnotations();
			setCursorMode(false);
		},
		[buildPromptOptions, chat, clearAnnotations, setCursorMode],
	);

	// The annotation cursor turns off whenever annotating stops being possible.
	useEffect(() => {
		if (!isArtifactOpen) {
			setCursorMode(false);
		}
	}, [isArtifactOpen, setCursorMode]);

	useEffect(() => {
		if (chat.streamingArtifact) {
			setCursorMode(false);
		}
	}, [chat.streamingArtifact, setCursorMode]);

	useEffect(() => {
		if (!canAnnotateWorkspaceDocument) {
			setCursorMode(false);
		}
	}, [canAnnotateWorkspaceDocument, setCursorMode]);

	useEffect(() => {
		clearAnnotations();
	}, [clearAnnotations, workspaceDocument?.id]);

	useEffect(() => {
		clearAnnotations();
	}, [clearAnnotations, selectedDocumentVersion?.id]);

	useEffect(() => {
		if (chat.artifactMode !== "preview") {
			setCursorMode(false);
			clearAnnotations();
		}
	}, [chat.artifactMode, clearAnnotations, setCursorMode]);

	const handleCloseArtifactPane = useCallback(() => {
		if (!workspaceDocument) {
			return;
		}

		if (chat.streamingArtifact?.documentId !== workspaceDocument.id) {
			chat.setActiveDocumentId(null);
		}
		chat.hideArtifactPane();
	}, [workspaceDocument, chat]);

	const handleOpenBrowserPreview = useCallback(() => {
		setDismissedBrowserArtifactKey(null);
		if (chat.panelState === "closed") {
			chat.setPanelState("preview");
		}
	}, [chat, setDismissedBrowserArtifactKey]);

	const handleCloseBrowserPreview = useCallback(() => {
		if (browserArtifactKey) {
			setDismissedBrowserArtifactKey(browserArtifactKey);
		}
		chat.hideArtifactPane();
	}, [browserArtifactKey, chat, setDismissedBrowserArtifactKey]);

	return {
		addArtifactAnnotationComment,
		artifactAnnotations,
		browserScreenshot,
		browserState,
		canAnnotateWorkspaceDocument,
		dismissArtifactSelection,
		formatContextForVoice,
		handleApplyAnnotations,
		handleCloseArtifactPane,
		handleCloseBrowserPreview,
		handleOpenBrowserPreview,
		pendingArtifactSelection,
		removeArtifactAnnotation,
		selectedDocumentVersion,
		shouldShowReopenBrowserPreviewControl,
		workspaceDocument,
	};
}
