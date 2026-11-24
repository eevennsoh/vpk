"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
	useRealtimeVoice,
	type UseRealtimeVoiceResult,
} from "@/components/projects/rovo-core/hooks/use-realtime-voice";
import type { RovoComposerDictationState } from "@/components/projects/shared/components/rovo-composer-send-controls";
import { appendDictationTranscript, resolveComposerDictationState } from "@/lib/composer-dictation";

type TranscriptPayload =
	| string
	| {
			delta?: string;
			text?: string;
			transcript?: string;
	  };

function getTranscriptText(payload: TranscriptPayload): string {
	if (typeof payload === "string") {
		return payload;
	}

	return payload.text ?? payload.transcript ?? payload.delta ?? "";
}

export interface JiraActivityComposerDictation {
	dictationState: RovoComposerDictationState;
	dictationTranscriptPreview: string | null;
	micStream: UseRealtimeVoiceResult["micStream"];
	onStartDictation: () => void;
	onStopDictation: () => void;
}

/**
 * Browser-transcription dictation for the activity FloatingComposer.
 * Mirrors the Rovo/sidebar `transcriptionOnly` start/stop path so the
 * shared `RovoComposerActionButton` mic behaves the same as other composers.
 */
export function useJiraActivityComposerDictation({
	onValueChange,
	value,
}: Readonly<{
	onValueChange: (value: string) => void;
	value: string;
}>): JiraActivityComposerDictation {
	const valueRef = useRef(value);
	const onValueChangeRef = useRef(onValueChange);
	const dictationBaselineRef = useRef<string | null>(null);
	const dictationCommittedTextRef = useRef<string | null>(null);
	const isDictationActiveRef = useRef(false);
	const [isDictationActive, setIsDictationActive] = useState(false);
	const [dictationTranscriptPreview, setDictationTranscriptPreview] = useState<string | null>(null);

	useEffect(() => {
		valueRef.current = value;
	}, [value]);

	useEffect(() => {
		onValueChangeRef.current = onValueChange;
	}, [onValueChange]);

	const applyDictationText = useCallback((transcriptText: string, commit: boolean) => {
		const nextText = appendDictationTranscript(
			dictationCommittedTextRef.current ?? dictationBaselineRef.current ?? "",
			transcriptText,
		);
		if (commit) {
			dictationCommittedTextRef.current = nextText;
		}
		valueRef.current = nextText;
		onValueChangeRef.current(nextText);
	}, []);

	const handleSpeechStarted = useCallback(() => {
		if (isDictationActiveRef.current) {
			setDictationTranscriptPreview(null);
		}
	}, []);

	const handleSpeechTranscriptDelta = useCallback(
		(payload: TranscriptPayload) => {
			if (!isDictationActiveRef.current) {
				return;
			}
			const transcriptText = getTranscriptText(payload);
			if (!transcriptText.trim()) {
				return;
			}
			setDictationTranscriptPreview(transcriptText);
			applyDictationText(transcriptText, false);
		},
		[applyDictationText],
	);

	const handleSpeechTranscriptCompleted = useCallback(
		(payload: TranscriptPayload) => {
			if (!isDictationActiveRef.current) {
				return;
			}
			const transcriptText = getTranscriptText(payload);
			if (!transcriptText.trim()) {
				return;
			}
			setDictationTranscriptPreview(transcriptText);
			applyDictationText(transcriptText, true);
		},
		[applyDictationText],
	);

	const realtime = useRealtimeVoice({
		chatMessages: [],
		onDelegateToRovo: () => undefined,
		onSpeechStarted: handleSpeechStarted,
		onSpeechTranscriptCompleted: handleSpeechTranscriptCompleted,
		onSpeechTranscriptDelta: handleSpeechTranscriptDelta,
		sessionPolicyMode: "auto",
	});

	const dictationState = resolveComposerDictationState({
		active: isDictationActive,
		voiceState: realtime.voiceState,
	});

	const onStartDictation = useCallback(() => {
		if (process.env.NEXT_PUBLIC_BUTTER_SCRIPTED_DEMO === "true") {
			const nextText = appendDictationTranscript(valueRef.current, "Please summarize the next steps.");
			valueRef.current = nextText;
			onValueChangeRef.current(nextText);
			return;
		}
		if (realtime.voiceState !== "idle") {
			realtime.disconnect();
		}

		const baselineText = valueRef.current;
		dictationBaselineRef.current = baselineText;
		dictationCommittedTextRef.current = baselineText;
		isDictationActiveRef.current = true;
		setIsDictationActive(true);
		setDictationTranscriptPreview(null);
		realtime.connect({ transcriptionOnly: true });
	}, [realtime]);

	const onStopDictation = useCallback(() => {
		dictationBaselineRef.current = null;
		dictationCommittedTextRef.current = null;
		isDictationActiveRef.current = false;
		setIsDictationActive(false);
		setDictationTranscriptPreview(null);
		realtime.disconnect();
	}, [realtime]);

	return {
		dictationState,
		dictationTranscriptPreview,
		micStream: realtime.micStream,
		onStartDictation,
		onStopDictation,
	};
}
