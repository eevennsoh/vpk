// oxlint-disable react-doctor/exhaustive-deps -- Effects in this file intentionally coordinate refs and keyed host requests; dependencies are constrained to avoid replaying those requests.

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { ChatComposerPrefillRequest } from "../lib/chat-panel-types";

interface UseComposerPromptBridgeOptions {
	composerPrefillRequest?: ChatComposerPrefillRequest;
	onComposerPrefillConsumed?: (requestKey: number) => void;
	prompt: string;
	setPrompt: (prompt: string) => void;
}

export interface ComposerPromptBridge {
	composerFocusRequestKey: number;
	/** Latest prompt text for voice and screen-assistant callbacks that outlive a render. */
	promptRef: RefObject<string>;
	requestComposerFocus: () => void;
}

/**
 * Bridges imperative writers (keyed host prefills, dictation, the screen
 * assistant) into the composer: keeps a live prompt ref and a focus request key.
 */
export function useComposerPromptBridge({
	composerPrefillRequest,
	onComposerPrefillConsumed,
	prompt,
	setPrompt,
}: Readonly<UseComposerPromptBridgeOptions>): ComposerPromptBridge {
	const promptRef = useRef(prompt);
	const lastComposerPrefillKeyRef = useRef(0);
	const [composerFocusRequestKey, setComposerFocusRequestKey] = useState(0);
	const requestComposerFocus = useCallback(() => {
		setComposerFocusRequestKey((currentKey) => currentKey + 1);
	}, []);

	// Opt-in imperative composer prefill (keyed-request idiom). Text requests
	// route through setPrompt; mention requests are applied by the rich editor so
	// deliberate directory selections skip the visual-trace auto-tagger.
	useEffect(() => {
		const requestKey = composerPrefillRequest?.requestKey ?? 0;
		if (requestKey <= 0 || lastComposerPrefillKeyRef.current === requestKey) {
			return;
		}
		lastComposerPrefillKeyRef.current = requestKey;
		if (!composerPrefillRequest?.mention) {
			const incoming = composerPrefillRequest?.text ?? "";
			const next = composerPrefillRequest?.append && promptRef.current.trim()
				? `${promptRef.current.trimEnd()}\n\n${incoming}`
				: incoming;
			promptRef.current = next;
			setPrompt(next);
			onComposerPrefillConsumed?.(requestKey);
		}
		requestComposerFocus();
	}, [composerPrefillRequest, onComposerPrefillConsumed, requestComposerFocus, setPrompt]);

	useEffect(() => {
		promptRef.current = prompt;
	}, [prompt]);

	return { composerFocusRequestKey, promptRef, requestComposerFocus };
}
