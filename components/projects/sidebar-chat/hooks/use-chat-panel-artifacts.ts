// oxlint-disable react-doctor/exhaustive-deps -- The reporting effect reads a lazily created ref that dedupes artifact results across renders.

import { useCallback, useEffect, useRef } from "react";
import { useLazyRef } from "@/lib/use-lazy-ref";
import { getMessageArtifactResult, type RovoUIMessage } from "@/lib/rovo-ui-messages";
import type { ArtifactResult } from "../components/artifact-result-card";
import type { RovoChat } from "../lib/chat-panel-types";

const ARTIFACT_DIALOG_FLOATING_PIN_REASON = "sidebar-chat-artifact-dialog";

/** Reports each artifact result in the thread to the host once. */
export function useArtifactResultReporting(
	messages: ReadonlyArray<Pick<RovoUIMessage, "id" | "parts">>,
	onArtifactResult: ((artifact: ArtifactResult) => void) | undefined,
): void {
	const reportedArtifactResultKeysRef = useLazyRef<Set<string>>(() => new Set());

	useEffect(() => {
		if (!onArtifactResult) {
			return;
		}

		for (const message of messages) {
			const artifactResult = getMessageArtifactResult(message);
			if (!artifactResult) {
				continue;
			}

			const resultKey = `${message.id}:${artifactResult.documentId}:${artifactResult.action}`;
			if (reportedArtifactResultKeysRef.current.has(resultKey)) {
				continue;
			}

			reportedArtifactResultKeysRef.current.add(resultKey);
			onArtifactResult(artifactResult);
		}
	}, [messages, onArtifactResult, reportedArtifactResultKeysRef]);
}

interface UseArtifactDialogFloatingPinOptions {
	chatSurface: RovoChat["chatSurface"];
	onArtifactDialogOpen?: (artifact: ArtifactResult) => void;
	pinFloating: RovoChat["pinFloating"];
	preserveFloatingSurfaceOnArtifactDialogOpen: boolean;
	unpinFloating: RovoChat["unpinFloating"];
}

/**
 * Optionally keeps the floating chat surface open while an artifact dialog
 * opened from it is showing, and releases that pin on close or unmount.
 */
export function useArtifactDialogFloatingPin({
	chatSurface,
	onArtifactDialogOpen,
	pinFloating,
	preserveFloatingSurfaceOnArtifactDialogOpen,
	unpinFloating,
}: Readonly<UseArtifactDialogFloatingPinOptions>) {
	const artifactDialogFloatingPinRef = useRef(false);
	const releaseArtifactDialogFloatingPin = useCallback(() => {
		if (!artifactDialogFloatingPinRef.current) {
			return;
		}

		artifactDialogFloatingPinRef.current = false;
		unpinFloating(ARTIFACT_DIALOG_FLOATING_PIN_REASON);
	}, [unpinFloating]);

	useEffect(() => releaseArtifactDialogFloatingPin, [releaseArtifactDialogFloatingPin]);

	const handleArtifactDialogOpen = useCallback(
		(artifact: ArtifactResult) => {
			if (
				preserveFloatingSurfaceOnArtifactDialogOpen &&
				chatSurface === "floating" &&
				!artifactDialogFloatingPinRef.current
			) {
				artifactDialogFloatingPinRef.current = true;
				pinFloating(ARTIFACT_DIALOG_FLOATING_PIN_REASON);
			}

			onArtifactDialogOpen?.(artifact);
		},
		[
			chatSurface,
			onArtifactDialogOpen,
			pinFloating,
			preserveFloatingSurfaceOnArtifactDialogOpen,
		],
	);

	return { handleArtifactDialogOpen, releaseArtifactDialogFloatingPin };
}
