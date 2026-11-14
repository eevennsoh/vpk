"use client";

// oxlint-disable react-doctor/exhaustive-deps -- Effects in this file intentionally coordinate refs, external animation loops, timers, subscriptions, or measured DOM state; dependencies are constrained to avoid restarting those bridges.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FileUIPart } from "ai";
import { RovoAppComposer } from "@/components/projects/rovo/components/rovo-app-composer";
import {
	createRealtimeTextMessage,
	updateRealtimeTextMessage,
	upsertRealtimeMessage,
} from "@/components/projects/rovo-core/lib/rovo-app-realtime-message-state";
import {
	useRealtimeVoice,
} from "@/components/projects/rovo/hooks/use-realtime-voice";
import { createId } from "@/lib/utils";
import type { RovoUIMessage } from "@/lib/rovo-ui-messages";
import { GUI } from "@/components/utils/gui";
import type { GUIRGBAColor as RGBAColor } from "@/components/utils/gui-color";
import {
	buildOrganicWaveformConfig,
	buildSharedWaveformMotionParams,
} from "./lib/waveform-config";
import {
	SmoothGradientWaveform,
	DEFAULT_WAVEFORM_CONFIG,
	type WaveformConfig,
} from "./smooth-gradient-waveform";

type RealtimeSpeechTranscriptPayload =
	| string
	| {
			delta?: string;
			text?: string;
			transcript?: string;
	  };

type RealtimeAssistantTextPayload =
	| string
	| {
			delta?: string;
			text?: string;
	  };

function resolveRealtimeStatusMessage(input: {
	connectionState: string;
	isReconnecting: boolean;
	statusMessage: string | null;
}): string | null {
	const directStatus =
		typeof input.statusMessage === "string" && input.statusMessage.trim()
			? input.statusMessage.trim()
			: null;
	if (directStatus) {
		return directStatus;
	}

	const connectionState = input.connectionState.trim().toLowerCase();
	if (connectionState === "reconnecting" || input.isReconnecting) {
		return "Reconnecting voice...";
	}

	if (connectionState === "disconnected") {
		return "Voice disconnected";
	}

	return null;
}

function getTranscriptText(
	payload: RealtimeSpeechTranscriptPayload,
): string {
	if (typeof payload === "string") {
		return payload;
	}

	return payload.transcript ?? payload.text ?? payload.delta ?? "";
}

function getAssistantText(
	payload: RealtimeAssistantTextPayload,
): string {
	if (typeof payload === "string") {
		return payload;
	}

	return payload.text ?? payload.delta ?? "";
}

function ControlSectionLabel({ children }: Readonly<{ children: string }>) {
	return (
		<div className="pt-1 text-[10px] font-semibold text-text-subtlest">
			{children}
		</div>
	);
}

const D = DEFAULT_WAVEFORM_CONFIG;
const TRANSITION_PREVIEW_PHASES = ["appear", "idle", "user", "ai", "disappear"] as const;
type TransitionPreviewPhase = (typeof TRANSITION_PREVIEW_PHASES)[number];
const TRANSITION_PREVIEW_PHASE_DURATIONS: Record<TransitionPreviewPhase, number> = {
	appear: 1400,
	idle: 1700,
	user: 1700,
	ai: 1700,
	disappear: 1400,
};

function cloneColor(color: RGBAColor): RGBAColor {
	return [color[0], color[1], color[2], color[3]];
}

export default function VisualWaveformPage() {
	// GUI state for all waveform config values
	const [timeSpeedIdle, setTimeSpeedIdle] = useState(D.timeSpeedIdle);
	const [timeSpeedActive, setTimeSpeedActive] = useState(D.timeSpeedActive);
	const [motionSpeedIdle, setMotionSpeedIdle] = useState(D.motionSpeedIdle);
	const [motionSpeedUser, setMotionSpeedUser] = useState(D.motionSpeedUser);
	const [motionSpeedAi, setMotionSpeedAi] = useState(D.motionSpeedAi);
	const [idleBaseAmplitude, setIdleBaseAmplitude] = useState(D.idleBaseAmplitude);
	const [idleBaseNoiseAmount, setIdleBaseNoiseAmount] = useState(D.idleBaseNoiseAmount);
	const [idleLiftAmount, setIdleLiftAmount] = useState(D.idleLiftAmount);
	const [idleCenterY, setIdleCenterY] = useState(D.idleCenterY);
	const [idleCenterSignalMul, setIdleCenterSignalMul] = useState(D.idleCenterSignalMul);
	const [idleThicknessSignalMul, setIdleThicknessSignalMul] = useState(D.idleThicknessSignalMul);
	const [idleWarpFreq, setIdleWarpFreq] = useState(D.idleWarpFreq);
	const [idleWarpSpeed, setIdleWarpSpeed] = useState(D.idleWarpSpeed);
	const [idleWarpAmount, setIdleWarpAmount] = useState(D.idleWarpAmount);
	const [idleNoiseGlowFreqX, setIdleNoiseGlowFreqX] = useState(D.idleNoiseGlowFreqX);
	const [idleNoiseGlowFreqY, setIdleNoiseGlowFreqY] = useState(D.idleNoiseGlowFreqY);
	const [idleNoiseGlowSpeed, setIdleNoiseGlowSpeed] = useState(D.idleNoiseGlowSpeed);
	const [idleNoiseGlowAmount, setIdleNoiseGlowAmount] = useState(D.idleNoiseGlowAmount);
	const [warpFreq, setWarpFreq] = useState(D.warpFreq);
	const [warpSpeed, setWarpSpeed] = useState(D.warpSpeed);
	const [warpAmount, setWarpAmount] = useState(D.warpAmount);
	const [noiseGlowFreqX, setNoiseGlowFreqX] = useState(D.noiseGlowFreqX);
	const [noiseGlowFreqY, setNoiseGlowFreqY] = useState(D.noiseGlowFreqY);
	const [noiseGlowSpeed, setNoiseGlowSpeed] = useState(D.noiseGlowSpeed);
	const [noiseGlowAmount, setNoiseGlowAmount] = useState(D.noiseGlowAmount);
	const [thicknessIdle, setThicknessIdle] = useState(D.thicknessIdle);
	const [thicknessActive, setThicknessActive] = useState(D.thicknessActive);
	const [thicknessSignalMul, setThicknessSignalMul] = useState(D.thicknessSignalMul);
	const [signalSmoothRate, setSignalSmoothRate] = useState(D.signalSmoothRate);
	const [signalRiseMul, setSignalRiseMul] = useState(D.signalRiseMul);
	const [signalFallMul, setSignalFallMul] = useState(D.signalFallMul);
	const [signalDecay, setSignalDecay] = useState(D.signalDecay);
	// Idle-specific general params
	const [idleWaveformWidthPercent, setIdleWaveformWidthPercent] = useState(D.waveformWidthPercent);
	const [idleWaveformHeightScale, setIdleWaveformHeightScale] = useState(D.waveformHeightScale);
	const [idleEdgeFadeLeft, setIdleEdgeFadeLeft] = useState(D.edgeFadeLeft);
	const [idleEdgeFadeRight, setIdleEdgeFadeRight] = useState(D.edgeFadeRight);
	const [idleColorLerpRate, setIdleColorLerpRate] = useState(D.colorLerpRate);
	const [idleStateModeLerpRate, setIdleStateModeLerpRate] = useState(D.stateModeLerpRate);
	// Speaking-specific general params
	const [speakingWaveformWidthPercent, setSpeakingWaveformWidthPercent] = useState(D.waveformWidthPercent);
	const [speakingWaveformHeightScale, setSpeakingWaveformHeightScale] = useState(D.waveformHeightScale);
	const [speakingEdgeFadeLeft, setSpeakingEdgeFadeLeft] = useState(D.edgeFadeLeft);
	const [speakingEdgeFadeRight, setSpeakingEdgeFadeRight] = useState(D.edgeFadeRight);
	const [speakingColorLerpRate, setSpeakingColorLerpRate] = useState(D.colorLerpRate);
	const [speakingStateModeLerpRate, setSpeakingStateModeLerpRate] = useState(D.stateModeLerpRate);
	const [organicDriftSpeed, setOrganicDriftSpeed] = useState(0.4);
	const [organicDriftRadius, setOrganicDriftRadius] = useState(0.2);
	const [organicNoiseScale, setOrganicNoiseScale] = useState(2.0);
	const [organicNoiseSpeed, setOrganicNoiseSpeed] = useState(0.3);
	const [organicWaveformWidthPercent, setOrganicWaveformWidthPercent] = useState(D.waveformWidthPercent);
	const [organicWaveformHeightScale, setOrganicWaveformHeightScale] = useState(D.waveformHeightScale);
	const [organicEdgeFadeLeft, setOrganicEdgeFadeLeft] = useState(D.edgeFadeLeft);
	const [organicEdgeFadeRight, setOrganicEdgeFadeRight] = useState(D.edgeFadeRight);
	const [organicThicknessActive, setOrganicThicknessActive] = useState(D.thicknessActive);
	const [organicThicknessSignalMul, setOrganicThicknessSignalMul] = useState(D.thicknessSignalMul);
	const [transitionAppearFadeRate, setTransitionAppearFadeRate] = useState(D.activeFadeRate);
	const [transitionDisappearFadeRate, setTransitionDisappearFadeRate] = useState(D.disappearFadeRate);
	const [idleColor1, setIdleColor1] = useState<RGBAColor>(cloneColor(D.idleColor1));
	const [idleColor2, setIdleColor2] = useState<RGBAColor>(cloneColor(D.idleColor2));
	const [idleColor3, setIdleColor3] = useState<RGBAColor>(cloneColor(D.idleColor3));
	const [idleColor4, setIdleColor4] = useState<RGBAColor>(cloneColor(D.idleColor4));
	const [aiColor1, setAiColor1] = useState<RGBAColor>(cloneColor(D.aiColor1));
	const [aiColor2, setAiColor2] = useState<RGBAColor>(cloneColor(D.aiColor2));
	const [aiColor3, setAiColor3] = useState<RGBAColor>(cloneColor(D.aiColor3));
	const [aiColor4, setAiColor4] = useState<RGBAColor>(cloneColor(D.aiColor4));
	const [userColor1, setUserColor1] = useState<RGBAColor>(cloneColor(D.userColor1));
	const [userColor2, setUserColor2] = useState<RGBAColor>(cloneColor(D.userColor2));
	const [userColor3, setUserColor3] = useState<RGBAColor>(cloneColor(D.userColor3));
	const [userColor4, setUserColor4] = useState<RGBAColor>(cloneColor(D.userColor4));

	// Realtime voice composer state
	const [messages, setMessages] = useState<RovoUIMessage[]>([]);
	const [inputError, setInputError] = useState<string | null>(null);
	const [voiceTranscript, setVoiceTranscript] = useState<string | null>(null);
	const assistantMessageIdRef = useRef<string | null>(null);

	const appendRealtimeMessage = useCallback(
		(
			role: "user" | "assistant",
			content: string,
			options?: {
				messageId?: string;
				state?: "done" | "streaming";
			},
		) => {
			const createdAt = new Date().toISOString();
			const messageId =
				options?.messageId ?? createId("rovo-app-realtime");
			const message = createRealtimeTextMessage({
				id: messageId,
				role,
				content,
				createdAt,
				state: options?.state ?? "done",
				metadata: {
					realtimeMessageId: messageId,
				},
			});

			setMessages((currentMessages) =>
				upsertRealtimeMessage(currentMessages, message),
			);

			return messageId;
		},
		[],
	);

	const updateAssistantMessage = useCallback(
		(
			messageId: string,
			content: string,
			options: { append: boolean; state: "done" | "streaming" },
		) => {
			setMessages((currentMessages) =>
				updateRealtimeTextMessage(currentMessages, messageId, content, {
					append: options.append,
					metadata: { updatedAt: new Date().toISOString() },
					state: options.state,
				}),
			);
		},
		[],
	);

	const resetAssistantMessageState = useCallback(() => {
		assistantMessageIdRef.current = null;
	}, []);

	const realtime = useRealtimeVoice({
		onDelegateToRovo: useCallback(() => {
			setInputError(
				"Rovo delegation is disabled in this standalone demo. Use live chat prompts for the GPT Realtime waveform experience.",
			);
		}, []),
		onSpeechStarted: useCallback(() => {
			setInputError(null);
			resetAssistantMessageState();
			setVoiceTranscript("");
		}, [resetAssistantMessageState]),
		onSpeechTranscriptDelta: useCallback((payload: RealtimeSpeechTranscriptPayload) => {
			const text = getTranscriptText(payload);
			if (!text) {
				return;
			}

			setVoiceTranscript(text);
		}, []),
		onSpeechTranscriptCompleted: useCallback(
			(payload: RealtimeSpeechTranscriptPayload) => {
				const transcript = getTranscriptText(payload).trim();
				if (!transcript) {
					setVoiceTranscript(null);
					return;
				}

				appendRealtimeMessage("user", transcript);
				setVoiceTranscript(null);
			},
			[appendRealtimeMessage],
		),
		onTextResponseStart: useCallback(() => {
			setInputError(null);
			const messageId = appendRealtimeMessage("assistant", "", {
				state: "streaming",
			});
			assistantMessageIdRef.current = messageId;
		}, [appendRealtimeMessage]),
		onAssistantTextDelta: useCallback(
			(payload: RealtimeAssistantTextPayload) => {
				const delta = getAssistantText(payload);
				if (!delta) {
					return;
				}

				const messageId =
					assistantMessageIdRef.current ??
					appendRealtimeMessage("assistant", "", { state: "streaming" });
				assistantMessageIdRef.current = messageId;
				updateAssistantMessage(messageId, delta, {
					append: true,
					state: "streaming",
				});
			},
			[appendRealtimeMessage, updateAssistantMessage],
		),
		onAssistantTextCompleted: useCallback(
			(payload: RealtimeAssistantTextPayload) => {
				const text = getAssistantText(payload).trim();
				if (!text) {
					return;
				}

				const messageId =
					assistantMessageIdRef.current ??
					appendRealtimeMessage("assistant", text);
				assistantMessageIdRef.current = messageId;
				updateAssistantMessage(messageId, text, {
					append: false,
					state: "done",
				});
			},
			[appendRealtimeMessage, updateAssistantMessage],
		),
		chatMessages: messages,
	});

	const realtimeStatusMessage = resolveRealtimeStatusMessage({
		connectionState: realtime.connectionState,
		isReconnecting: realtime.isReconnecting,
		statusMessage: realtime.statusMessage,
	});
	const isRealtimeActive = realtime.voiceState !== "idle";

	const handleToggleRealtimeVoice = useCallback(() => {
		setInputError(null);

		if (realtime.voiceState === "idle") {
			resetAssistantMessageState();
			realtime.connect();
			return;
		}

		const transcriptToPreserve = realtime.currentTranscript.trim();
		resetAssistantMessageState();
		realtime.disconnect();
		if (transcriptToPreserve) {
			setVoiceTranscript(transcriptToPreserve);
		}
	}, [realtime, resetAssistantMessageState]);

	const handleSubmit = useCallback(
		async ({
			text,
		}: {
			files: FileUIPart[];
			text: string;
		}) => {
			const trimmedText = text.trim();
			if (!trimmedText) {
				return;
			}

			setInputError(null);

			if (!isRealtimeActive) {
				setInputError(
					"Start live chat to test the GPT Realtime waveform in this demo.",
				);
				return;
			}

			resetAssistantMessageState();
			appendRealtimeMessage("user", trimmedText);
			await realtime.sendTextInput({ text: trimmedText });
		},
		[appendRealtimeMessage, isRealtimeActive, realtime, resetAssistantMessageState],
	);

	// Synthetic signals for Idle, User, and AI waveforms
	const [idleSignal, setIdleSignal] = useState<number[]>([]);
	const [userSignal, setUserSignal] = useState<number[]>([]);
	const [aiSignal, setAiSignal] = useState<number[]>([]);
	const [transitionPreviewPhaseIndex, setTransitionPreviewPhaseIndex] = useState(0);

	useEffect(() => {
		const interval = setInterval(() => {
			const t = performance.now() * 0.001;
			const idleTime = t * motionSpeedIdle;
			const userTime = t * motionSpeedUser;
			const aiTime = t * motionSpeedAi;

			// Idle uses the same signal-backed preview structure as speaking,
			// but with a softer cadence so it still reads as idle.
			setIdleSignal(
				Array.from({ length: 16 }, (_, i) =>
					Math.max(
						0,
						0.12 +
							0.12 * Math.sin(idleTime * 1.6 + i * 0.45) +
							0.06 * Math.sin(idleTime * 3.8 + i * 0.9),
					),
				),
			);

			// User signal: gentler, speech-like cadence
			setUserSignal(
				Array.from({ length: 16 }, (_, i) =>
					Math.max(
						0,
						0.15 +
							0.2 * Math.sin(userTime * 1.8 + i * 0.5) +
							0.1 * Math.sin(userTime * 4.2 + i * 1.1),
					),
				),
			);

			// AI signal: more energetic, varied
			setAiSignal(
				Array.from({ length: 16 }, (_, i) =>
					Math.max(
						0,
						0.3 +
							0.3 * Math.sin(aiTime * 2 + i * 0.4) +
							0.15 * Math.sin(aiTime * 5.7 + i * 1.3),
					),
				),
			);
		}, 50);

		return () => clearInterval(interval);
	}, [motionSpeedAi, motionSpeedIdle, motionSpeedUser]);

	const transitionPreviewPhase: TransitionPreviewPhase = TRANSITION_PREVIEW_PHASES[transitionPreviewPhaseIndex];

	useEffect(() => {
		const timeout = setTimeout(() => {
			setTransitionPreviewPhaseIndex((currentIndex) =>
				(currentIndex + 1) % TRANSITION_PREVIEW_PHASES.length,
			);
		}, TRANSITION_PREVIEW_PHASE_DURATIONS[transitionPreviewPhase]);

		return () => clearTimeout(timeout);
	}, [transitionPreviewPhase]);

	const sharedMotionParams = buildSharedWaveformMotionParams({
		timeSpeedIdle,
		timeSpeedActive,
		motionSpeedIdle,
		motionSpeedUser,
		motionSpeedAi,
		idleBaseAmplitude,
		idleBaseNoiseAmount,
		idleLiftAmount,
		idleCenterY,
		idleCenterSignalMul,
		idleThicknessSignalMul,
		idleWarpFreq,
		idleWarpSpeed,
		idleWarpAmount,
		idleNoiseGlowFreqX,
		idleNoiseGlowFreqY,
		idleNoiseGlowSpeed,
		idleNoiseGlowAmount,
		warpFreq,
		warpSpeed,
		warpAmount,
		noiseGlowFreqX,
		noiseGlowFreqY,
		noiseGlowSpeed,
		noiseGlowAmount,
		thicknessIdle,
		thicknessActive,
		thicknessSignalMul,
		signalSmoothRate,
		signalRiseMul,
		signalFallMul,
		signalDecay,
		idleColor1,
		idleColor2,
		idleColor3,
		idleColor4,
		aiColor1,
		aiColor2,
		aiColor3,
		aiColor4,
		userColor1,
		userColor2,
		userColor3,
		userColor4,
	});

	const idleWaveformConfig = useMemo<WaveformConfig>(
		() => ({
			...sharedMotionParams,
			colorLerpRate: idleColorLerpRate,
			stateModeLerpRate: idleStateModeLerpRate,
			activeFadeRate: transitionAppearFadeRate,
			disappearFadeRate: transitionDisappearFadeRate,
			waveformWidthPercent: idleWaveformWidthPercent,
			waveformHeightScale: idleWaveformHeightScale,
			edgeFadeLeft: idleEdgeFadeLeft,
			edgeFadeRight: idleEdgeFadeRight,
		}),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[
			timeSpeedIdle, timeSpeedActive,
			motionSpeedIdle, motionSpeedUser, motionSpeedAi,
			idleBaseAmplitude, idleBaseNoiseAmount, idleLiftAmount,
			idleCenterY, idleCenterSignalMul, idleThicknessSignalMul,
			idleWarpFreq, idleWarpSpeed, idleWarpAmount,
			idleNoiseGlowFreqX, idleNoiseGlowFreqY, idleNoiseGlowSpeed, idleNoiseGlowAmount,
			warpFreq, warpSpeed, warpAmount,
			noiseGlowFreqX, noiseGlowFreqY, noiseGlowSpeed, noiseGlowAmount,
			thicknessIdle, thicknessActive, thicknessSignalMul,
			signalSmoothRate, signalRiseMul, signalFallMul, signalDecay,
			idleColorLerpRate, idleStateModeLerpRate, transitionAppearFadeRate, transitionDisappearFadeRate,
			idleWaveformWidthPercent, idleWaveformHeightScale, idleEdgeFadeLeft, idleEdgeFadeRight,
			idleColor1, idleColor2, idleColor3, idleColor4,
			aiColor1, aiColor2, aiColor3, aiColor4,
			userColor1, userColor2, userColor3, userColor4,
		],
	);

	const speakingWaveformConfig = useMemo<WaveformConfig>(
		() => ({
			...sharedMotionParams,
			colorLerpRate: speakingColorLerpRate,
			stateModeLerpRate: speakingStateModeLerpRate,
			activeFadeRate: transitionAppearFadeRate,
			disappearFadeRate: transitionDisappearFadeRate,
			waveformWidthPercent: speakingWaveformWidthPercent,
			waveformHeightScale: speakingWaveformHeightScale,
			edgeFadeLeft: speakingEdgeFadeLeft,
			edgeFadeRight: speakingEdgeFadeRight,
		}),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[
			timeSpeedIdle, timeSpeedActive,
			motionSpeedIdle, motionSpeedUser, motionSpeedAi,
			idleBaseAmplitude, idleBaseNoiseAmount, idleLiftAmount,
			idleCenterY, idleCenterSignalMul, idleThicknessSignalMul,
			idleWarpFreq, idleWarpSpeed, idleWarpAmount,
			idleNoiseGlowFreqX, idleNoiseGlowFreqY, idleNoiseGlowSpeed, idleNoiseGlowAmount,
			warpFreq, warpSpeed, warpAmount,
			noiseGlowFreqX, noiseGlowFreqY, noiseGlowSpeed, noiseGlowAmount,
			thicknessIdle, thicknessActive, thicknessSignalMul,
			signalSmoothRate, signalRiseMul, signalFallMul, signalDecay,
			speakingColorLerpRate, speakingStateModeLerpRate, transitionAppearFadeRate, transitionDisappearFadeRate,
			speakingWaveformWidthPercent, speakingWaveformHeightScale, speakingEdgeFadeLeft, speakingEdgeFadeRight,
			idleColor1, idleColor2, idleColor3, idleColor4,
			aiColor1, aiColor2, aiColor3, aiColor4,
			userColor1, userColor2, userColor3, userColor4,
		],
	);

	const organicWaveformConfig = buildOrganicWaveformConfig({
		sharedMotionParams,
		colorLerpRate: speakingColorLerpRate,
		stateModeLerpRate: speakingStateModeLerpRate,
		activeFadeRate: transitionAppearFadeRate,
		disappearFadeRate: transitionDisappearFadeRate,
		waveformWidthPercent: organicWaveformWidthPercent,
		waveformHeightScale: organicWaveformHeightScale,
		edgeFadeLeft: organicEdgeFadeLeft,
		edgeFadeRight: organicEdgeFadeRight,
		thicknessActive: organicThicknessActive,
		thicknessSignalMul: organicThicknessSignalMul,
	});

	const guiValues = useMemo(
		() => ({
			...idleWaveformConfig,
			// Include speaking-specific keys for the values panel
			speakingWaveformWidthPercent,
			speakingWaveformHeightScale,
			speakingEdgeFadeLeft,
			speakingEdgeFadeRight,
			speakingColorLerpRate,
			speakingStateModeLerpRate,
			transitionAppearFadeRate,
			transitionDisappearFadeRate,
		}),
		[idleWaveformConfig, speakingWaveformWidthPercent, speakingWaveformHeightScale, speakingEdgeFadeLeft, speakingEdgeFadeRight, speakingColorLerpRate, speakingStateModeLerpRate, transitionAppearFadeRate, transitionDisappearFadeRate],
	);

	const transitionPreviewWaveformProps = useMemo(() => {
		if (transitionPreviewPhase === "appear") {
			return {
				active: true,
				config: idleWaveformConfig,
				generationState: "idle" as const,
				label: "Transition Preview · Appear",
				signal: idleSignal,
				voiceState: "idle" as const,
			};
		}

		if (transitionPreviewPhase === "user") {
			return {
				active: true,
				config: speakingWaveformConfig,
				generationState: "idle" as const,
				label: "Transition Preview · User",
				signal: userSignal,
				voiceState: "listening" as const,
			};
		}

		if (transitionPreviewPhase === "ai") {
			return {
				active: true,
				config: speakingWaveformConfig,
				generationState: "generating" as const,
				label: "Transition Preview · AI",
				signal: aiSignal,
				voiceState: "speaking" as const,
			};
		}

		if (transitionPreviewPhase === "disappear") {
			return {
				active: false,
				config: speakingWaveformConfig,
				generationState: "generating" as const,
				label: "Transition Preview · Disappear",
				signal: aiSignal,
				voiceState: "speaking" as const,
			};
		}

		return {
			active: true,
			config: idleWaveformConfig,
			generationState: "idle" as const,
			label: "Transition Preview · Idle",
			signal: idleSignal,
			voiceState: "idle" as const,
		};
	}, [
		aiSignal,
		idleSignal,
		idleWaveformConfig,
		speakingWaveformConfig,
		transitionPreviewPhase,
		userSignal,
	]);

	return (
		<div className="flex min-h-0 w-full flex-1 flex-col items-center px-6 py-10">
			<div className="grid w-full max-w-[1280px] flex-1 gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
				<div className="flex w-full flex-1 flex-col gap-16 pt-[200px]">
					{/* Live GPT-Realtime Composer */}
					{realtimeStatusMessage ? (
						<div className="w-full max-w-[800px] px-1 pb-3 text-text-subtle text-xs">
							{realtimeStatusMessage}
						</div>
					) : null}
					<div className="w-full max-w-[800px]">
						<RovoAppComposer
							composerStatus="ready"
							errorMessage={inputError}
							micStream={realtime.micStream}
							onStop={async () => {
								realtime.disconnect();
							}}
							onSubmit={handleSubmit}
							onToggleRealtimeVoice={handleToggleRealtimeVoice}
							placeholder="Ask, @mention, or / for skills"
							prefillText={voiceTranscript}
							realtimeVoiceActive={isRealtimeActive}
							realtimeVoiceState={realtime.voiceState}
						/>
					</div>

					{/* Transition Preview */}
					<div className="relative h-[200px]">
						<span className="absolute left-3 top-3 z-10 rounded-md bg-bg-neutral px-2 py-0.5 text-[11px] font-semibold text-text-subtle">
							{transitionPreviewWaveformProps.label}
						</span>
						<div className="pointer-events-none absolute inset-0 overflow-visible">
							<SmoothGradientWaveform
								active={transitionPreviewWaveformProps.active}
								config={transitionPreviewWaveformProps.config}
								generationState={transitionPreviewWaveformProps.generationState}
								signal={transitionPreviewWaveformProps.signal}
								voiceState={transitionPreviewWaveformProps.voiceState}
							/>
						</div>
					</div>

					{/* Idle */}
					<div className="relative h-[200px]">
						<span className="absolute left-3 top-3 z-10 rounded-md bg-bg-neutral px-2 py-0.5 text-[11px] font-semibold text-text-subtle">
							Idle
						</span>
						<div className="pointer-events-none absolute inset-0 overflow-visible">
							<SmoothGradientWaveform
								active
								voiceState="idle"
								signal={idleSignal}
								config={idleWaveformConfig}
							/>
						</div>
					</div>

					{/* User Speaking */}
					<div className="relative h-[200px]">
						<span className="absolute left-3 top-3 z-10 rounded-md bg-bg-neutral px-2 py-0.5 text-[11px] font-semibold text-text-subtle">
							User Speaking
						</span>
						<div className="pointer-events-none absolute inset-0 overflow-visible">
							<SmoothGradientWaveform
								active
								voiceState="listening"
								signal={userSignal}
								config={speakingWaveformConfig}
							/>
						</div>
					</div>

					{/* AI Speaking */}
					<div className="relative h-[200px]">
						<span className="absolute left-3 top-3 z-10 rounded-md bg-bg-neutral px-2 py-0.5 text-[11px] font-semibold text-text-subtle">
							AI Speaking
						</span>
						<div className="pointer-events-none absolute inset-0 overflow-visible">
							<SmoothGradientWaveform
								active
								voiceState="speaking"
								generationState="generating"
								signal={aiSignal}
								config={speakingWaveformConfig}
							/>
						</div>
					</div>

					{/* AI Speaking · Organic */}
					<div className="relative h-[200px]">
						<span className="absolute left-3 top-3 z-10 rounded-md bg-bg-neutral px-2 py-0.5 text-[11px] font-semibold text-text-subtle">
							AI Speaking · Organic
						</span>
						<div className="pointer-events-none absolute inset-0 overflow-visible">
							<SmoothGradientWaveform
								active
								voiceState="speaking"
								generationState="generating"
								signal={aiSignal}
								config={organicWaveformConfig}
								colorMode="organic"
								organicDriftSpeed={organicDriftSpeed}
								organicDriftRadius={organicDriftRadius}
								organicNoiseScale={organicNoiseScale}
								organicNoiseSpeed={organicNoiseSpeed}
							/>
						</div>
					</div>
				</div>

				<div className="flex flex-col gap-4">
					<div className="rounded-xl border border-border bg-surface p-4">
						<GUI.Panel title="Waveform controls" values={guiValues}>
						<GUI.Section title="Transition Motion" borderTop={false}>
							<ControlSectionLabel>States</ControlSectionLabel>
							<GUI.Control
								id="transition-appear-fade-rate"
								label="Appear fade rate"
								description="How quickly the preview waveform fades and grows from zero into its first visible idle state."
								value={transitionAppearFadeRate}
								defaultValue={D.activeFadeRate}
								min={0.001}
								max={0.2}
								step={0.001}
								onChange={setTransitionAppearFadeRate}
								valueKeys="transitionAppearFadeRate"
							/>
							<GUI.Control
								id="transition-disappear-fade-rate"
								label="Disappear fade rate"
								description="How quickly the preview waveform fades and shrinks back to zero after the AI speaking state."
								value={transitionDisappearFadeRate}
								defaultValue={D.disappearFadeRate}
								min={0.001}
								max={0.2}
								step={0.001}
								onChange={setTransitionDisappearFadeRate}
								valueKeys="transitionDisappearFadeRate"
							/>
							<ControlSectionLabel>Idle Preview</ControlSectionLabel>
							<GUI.Control
								id="idle-color-lerp-rate"
								label="Color transition rate"
								description="Per-frame color interpolation speed for idle transitions in the preview cycle."
								value={idleColorLerpRate}
								defaultValue={D.colorLerpRate}
								min={0.001}
								max={0.2}
								step={0.001}
								onChange={setIdleColorLerpRate}
								valueKeys="colorLerpRate"
							/>
							<GUI.Control
								id="idle-state-mode-lerp"
								label="State mode transition"
								description="How quickly the preview blends back into the idle state."
								value={idleStateModeLerpRate}
								defaultValue={D.stateModeLerpRate}
								min={0.001}
								max={0.2}
								step={0.001}
								onChange={setIdleStateModeLerpRate}
								valueKeys="stateModeLerpRate"
							/>
							<ControlSectionLabel>Speaking Preview</ControlSectionLabel>
							<GUI.Control
								id="speaking-color-lerp-rate"
								label="Color transition rate"
								description="Per-frame color interpolation speed for user and AI transitions in the preview cycle."
								value={speakingColorLerpRate}
								defaultValue={D.colorLerpRate}
								min={0.001}
								max={0.2}
								step={0.001}
								onChange={setSpeakingColorLerpRate}
								valueKeys="speakingColorLerpRate"
							/>
							<GUI.Control
								id="speaking-state-mode-lerp"
								label="State mode transition"
								description="How quickly the preview blends between user and AI speaking states."
								value={speakingStateModeLerpRate}
								defaultValue={D.stateModeLerpRate}
								min={0.001}
								max={0.2}
								step={0.001}
								onChange={setSpeakingStateModeLerpRate}
								valueKeys="speakingStateModeLerpRate"
							/>
						</GUI.Section>

						<GUI.Section title="Idle Motion">
							<ControlSectionLabel>Layout</ControlSectionLabel>
							<GUI.Control
								id="idle-waveform-width"
								label="Waveform width"
								description="Overall waveform width relative to its container."
								value={idleWaveformWidthPercent}
								defaultValue={D.waveformWidthPercent}
								min={40}
								max={140}
								step={1}
								unit="%"
								onChange={setIdleWaveformWidthPercent}
								valueKeys="waveformWidthPercent"
							/>
							<GUI.Control
								id="idle-waveform-height"
								label="Waveform height"
								description="Increases the waveform's vertical amplitude without changing its layout box."
								value={idleWaveformHeightScale}
								defaultValue={D.waveformHeightScale}
								min={0.25}
								max={2.5}
								step={0.05}
								unit="x"
								onChange={setIdleWaveformHeightScale}
								valueKeys="waveformHeightScale"
							/>
							<GUI.Control
								id="idle-edge-fade-left"
								label="Left edge fade"
								description="How gradually the waveform tapers out on the left edge."
								value={idleEdgeFadeLeft}
								defaultValue={D.edgeFadeLeft}
								min={0}
								max={0.5}
								step={0.01}
								onChange={setIdleEdgeFadeLeft}
								valueKeys="edgeFadeLeft"
							/>
							<GUI.Control
								id="idle-edge-fade-right"
								label="Right edge fade"
								description="How gradually the waveform tapers out on the right edge."
								value={idleEdgeFadeRight}
								defaultValue={D.edgeFadeRight}
								min={0}
								max={0.5}
								step={0.01}
								onChange={setIdleEdgeFadeRight}
								valueKeys="edgeFadeRight"
							/>
							<ControlSectionLabel>Speed</ControlSectionLabel>
							<GUI.Control
								id="time-speed-idle"
								label="Time speed (idle)"
								value={timeSpeedIdle}
								defaultValue={D.timeSpeedIdle}
								min={0}
								max={1}
								step={0.01}
								onChange={setTimeSpeedIdle}
								valueKeys="timeSpeedIdle"
							/>
							<GUI.Control
								id="idle-motion-speed"
								label="Idle motion speed"
								description="Scales the full idle waveform motion, including shader drift and pulse cadence."
								value={motionSpeedIdle}
								defaultValue={D.motionSpeedIdle}
								min={0}
								max={3}
								step={0.05}
								unit="x"
								onChange={setMotionSpeedIdle}
								valueKeys="motionSpeedIdle"
							/>
							<ControlSectionLabel>Warp</ControlSectionLabel>
							<GUI.Control
								id="idle-warp-freq"
								label="Idle warp frequency"
								description="Spatial frequency of the idle X warping."
								value={idleWarpFreq}
								defaultValue={D.idleWarpFreq}
								min={0}
								max={8}
								step={0.1}
								onChange={setIdleWarpFreq}
								valueKeys="idleWarpFreq"
							/>
							<GUI.Control
								id="idle-warp-speed"
								label="Idle warp speed"
								description="How fast the idle warp noise evolves over time."
								value={idleWarpSpeed}
								defaultValue={D.idleWarpSpeed}
								min={0}
								max={3}
								step={0.01}
								onChange={setIdleWarpSpeed}
								valueKeys="idleWarpSpeed"
							/>
							<GUI.Control
								id="idle-warp-amount"
								label="Idle warp amount"
								description="Displacement strength of the idle fluid warping."
								value={idleWarpAmount}
								defaultValue={D.idleWarpAmount}
								min={0}
								max={0.3}
								step={0.005}
								onChange={setIdleWarpAmount}
								valueKeys="idleWarpAmount"
							/>
							<ControlSectionLabel>Shape</ControlSectionLabel>
							<GUI.Control
								id="idle-base-amplitude"
								label="Idle base amplitude"
								description="Ambient waveform body for idle before any extra lift is applied."
								value={idleBaseAmplitude}
								defaultValue={D.idleBaseAmplitude}
								min={0}
								max={0.15}
								step={0.001}
								onChange={setIdleBaseAmplitude}
								valueKeys="idleBaseAmplitude"
							/>
							<GUI.Control
								id="idle-base-noise-amount"
								label="Idle noise range"
								description="How much the idle silhouette morphs from its internal noise field."
								value={idleBaseNoiseAmount}
								defaultValue={D.idleBaseNoiseAmount}
								min={0}
								max={0.1}
								step={0.001}
								onChange={setIdleBaseNoiseAmount}
								valueKeys="idleBaseNoiseAmount"
							/>
							<GUI.Control
								id="idle-lift-amount"
								label="Idle lift amount"
								description="Extra animated lift for idle so it moves like the active states."
								value={idleLiftAmount}
								defaultValue={D.idleLiftAmount}
								min={0}
								max={0.12}
								step={0.001}
								onChange={setIdleLiftAmount}
								valueKeys="idleLiftAmount"
							/>
							<GUI.Control
								id="idle-center-y"
								label="Idle center position"
								description="Vertical anchor for the idle waveform."
								value={idleCenterY}
								defaultValue={D.idleCenterY}
								min={0.2}
								max={0.6}
								step={0.005}
								onChange={setIdleCenterY}
								valueKeys="idleCenterY"
							/>
							<GUI.Control
								id="idle-center-signal-mul"
								label="Idle center response"
								description="How much idle rises and falls as its animated amplitude changes."
								value={idleCenterSignalMul}
								defaultValue={D.idleCenterSignalMul}
								min={0}
								max={0.4}
								step={0.005}
								onChange={setIdleCenterSignalMul}
								valueKeys="idleCenterSignalMul"
							/>
							<GUI.Control
								id="thickness-idle"
								label="Thickness (idle)"
								value={thicknessIdle}
								defaultValue={D.thicknessIdle}
								min={0}
								max={0.5}
								step={0.005}
								onChange={setThicknessIdle}
								valueKeys="thicknessIdle"
							/>
							<GUI.Control
								id="idle-thickness-signal-mul"
								label="Idle thickness response"
								description="How much idle grows thicker as its internal motion intensifies."
								value={idleThicknessSignalMul}
								defaultValue={D.idleThicknessSignalMul}
								min={0}
								max={2}
								step={0.01}
								onChange={setIdleThicknessSignalMul}
								valueKeys="idleThicknessSignalMul"
							/>
							<ControlSectionLabel>Glow</ControlSectionLabel>
							<GUI.Control
								id="idle-noise-glow-freq-x"
								label="Idle noise X frequency"
								value={idleNoiseGlowFreqX}
								defaultValue={D.idleNoiseGlowFreqX}
								min={0}
								max={10}
								step={0.1}
								onChange={setIdleNoiseGlowFreqX}
								valueKeys="idleNoiseGlowFreqX"
							/>
							<GUI.Control
								id="idle-noise-glow-freq-y"
								label="Idle noise Y frequency"
								value={idleNoiseGlowFreqY}
								defaultValue={D.idleNoiseGlowFreqY}
								min={0}
								max={10}
								step={0.1}
								onChange={setIdleNoiseGlowFreqY}
								valueKeys="idleNoiseGlowFreqY"
							/>
							<GUI.Control
								id="idle-noise-glow-speed"
								label="Idle noise speed"
								value={idleNoiseGlowSpeed}
								defaultValue={D.idleNoiseGlowSpeed}
								min={0}
								max={3}
								step={0.01}
								onChange={setIdleNoiseGlowSpeed}
								valueKeys="idleNoiseGlowSpeed"
							/>
							<GUI.Control
								id="idle-noise-glow-amount"
								label="Idle noise amount"
								description="Strength of the wispy aurora effect for idle."
								value={idleNoiseGlowAmount}
								defaultValue={D.idleNoiseGlowAmount}
								min={0}
								max={1}
								step={0.01}
								onChange={setIdleNoiseGlowAmount}
								valueKeys="idleNoiseGlowAmount"
							/>
							<ControlSectionLabel>Colors</ControlSectionLabel>
							<GUI.RgbaColorInput id="idle-c1" label="Color 1" value={idleColor1} defaultValue={D.idleColor1} onChange={setIdleColor1} valueKeys="idleColor1" />
							<GUI.RgbaColorInput id="idle-c2" label="Color 2" value={idleColor2} defaultValue={D.idleColor2} onChange={setIdleColor2} valueKeys="idleColor2" />
							<GUI.RgbaColorInput id="idle-c3" label="Color 3" value={idleColor3} defaultValue={D.idleColor3} onChange={setIdleColor3} valueKeys="idleColor3" />
							<GUI.RgbaColorInput id="idle-c4" label="Color 4" value={idleColor4} defaultValue={D.idleColor4} onChange={setIdleColor4} valueKeys="idleColor4" />
						</GUI.Section>

						<GUI.Section title="Speaking Motion">
							<ControlSectionLabel>Layout</ControlSectionLabel>
							<GUI.Control
								id="speaking-waveform-width"
								label="Waveform width"
								description="Overall waveform width relative to its container."
								value={speakingWaveformWidthPercent}
								defaultValue={D.waveformWidthPercent}
								min={40}
								max={140}
								step={1}
								unit="%"
								onChange={setSpeakingWaveformWidthPercent}
								valueKeys="speakingWaveformWidthPercent"
							/>
							<GUI.Control
								id="speaking-waveform-height"
								label="Waveform height"
								description="Increases the waveform's vertical amplitude without changing its layout box."
								value={speakingWaveformHeightScale}
								defaultValue={D.waveformHeightScale}
								min={0.25}
								max={2.5}
								step={0.05}
								unit="x"
								onChange={setSpeakingWaveformHeightScale}
								valueKeys="speakingWaveformHeightScale"
							/>
							<GUI.Control
								id="speaking-edge-fade-left"
								label="Left edge fade"
								description="How gradually the waveform tapers out on the left edge."
								value={speakingEdgeFadeLeft}
								defaultValue={D.edgeFadeLeft}
								min={0}
								max={0.5}
								step={0.01}
								onChange={setSpeakingEdgeFadeLeft}
								valueKeys="speakingEdgeFadeLeft"
							/>
							<GUI.Control
								id="speaking-edge-fade-right"
								label="Right edge fade"
								description="How gradually the waveform tapers out on the right edge."
								value={speakingEdgeFadeRight}
								defaultValue={D.edgeFadeRight}
								min={0}
								max={0.5}
								step={0.01}
								onChange={setSpeakingEdgeFadeRight}
								valueKeys="speakingEdgeFadeRight"
							/>
							<ControlSectionLabel>Speed</ControlSectionLabel>
							<GUI.Control
								id="time-speed-active"
								label="Time speed (active)"
								value={timeSpeedActive}
								defaultValue={D.timeSpeedActive}
								min={0}
								max={2}
								step={0.01}
								onChange={setTimeSpeedActive}
								valueKeys="timeSpeedActive"
							/>
							<GUI.Control
								id="demo-user-motion-speed"
								label="User motion speed"
								description="Scales the full listening/user waveform motion, including shader drift and pulse cadence."
								value={motionSpeedUser}
								defaultValue={D.motionSpeedUser}
								min={0}
								max={3}
								step={0.05}
								unit="x"
								onChange={setMotionSpeedUser}
								valueKeys="motionSpeedUser"
							/>
							<GUI.Control
								id="demo-ai-motion-speed"
								label="AI motion speed"
								description="Scales the full speaking/AI waveform motion, including shader drift and pulse cadence."
								value={motionSpeedAi}
								defaultValue={D.motionSpeedAi}
								min={0}
								max={3}
								step={0.05}
								unit="x"
								onChange={setMotionSpeedAi}
								valueKeys="motionSpeedAi"
							/>
							<ControlSectionLabel>Warp</ControlSectionLabel>
							<GUI.Control
								id="warp-freq"
								label="Warp frequency"
								description="Spatial frequency of the listening and speaking X warping."
								value={warpFreq}
								defaultValue={D.warpFreq}
								min={0}
								max={8}
								step={0.1}
								onChange={setWarpFreq}
								valueKeys="warpFreq"
							/>
							<GUI.Control
								id="warp-speed"
								label="Warp speed"
								description="How fast the listening and speaking warp noise evolves over time."
								value={warpSpeed}
								defaultValue={D.warpSpeed}
								min={0}
								max={3}
								step={0.01}
								onChange={setWarpSpeed}
								valueKeys="warpSpeed"
							/>
							<GUI.Control
								id="warp-amount"
								label="Warp amount"
								description="Displacement strength of the listening and speaking fluid warping."
								value={warpAmount}
								defaultValue={D.warpAmount}
								min={0}
								max={0.3}
								step={0.005}
								onChange={setWarpAmount}
								valueKeys="warpAmount"
							/>
							<ControlSectionLabel>Shape</ControlSectionLabel>
							<GUI.Control
								id="thickness-active"
								label="Thickness (active)"
								value={thicknessActive}
								defaultValue={D.thicknessActive}
								min={0}
								max={0.5}
								step={0.005}
								onChange={setThicknessActive}
								valueKeys="thicknessActive"
							/>
							<GUI.Control
								id="thickness-signal-mul"
								label="Thickness signal multiplier"
								description="How much the listening and speaking states grow thicker from audio amplitude."
								value={thicknessSignalMul}
								defaultValue={D.thicknessSignalMul}
								min={0}
								max={3}
								step={0.01}
								onChange={setThicknessSignalMul}
								valueKeys="thicknessSignalMul"
							/>
							<ControlSectionLabel>Signal</ControlSectionLabel>
							<GUI.Control
								id="signal-smooth-rate"
								label="Smooth rate"
								description="Per-frame lerp rate toward target signal. Lower = smoother."
								value={signalSmoothRate}
								defaultValue={D.signalSmoothRate}
								min={0.001}
								max={0.2}
								step={0.001}
								onChange={setSignalSmoothRate}
								valueKeys="signalSmoothRate"
							/>
							<GUI.Control
								id="signal-rise-mul"
								label="Rise multiplier"
								description="Multiplier on smooth rate when signal is rising."
								value={signalRiseMul}
								defaultValue={D.signalRiseMul}
								min={0.1}
								max={5}
								step={0.1}
								onChange={setSignalRiseMul}
								valueKeys="signalRiseMul"
							/>
							<GUI.Control
								id="signal-fall-mul"
								label="Fall multiplier"
								description="Multiplier on smooth rate when signal is falling."
								value={signalFallMul}
								defaultValue={D.signalFallMul}
								min={0.1}
								max={5}
								step={0.1}
								onChange={setSignalFallMul}
								valueKeys="signalFallMul"
							/>
							<GUI.Control
								id="signal-decay"
								label="Decay rate"
								description="Per-frame multiplier when no signal (1.0 = no decay)."
								value={signalDecay}
								defaultValue={D.signalDecay}
								min={0.8}
								max={1}
								step={0.005}
								onChange={setSignalDecay}
								valueKeys="signalDecay"
							/>
							<ControlSectionLabel>Glow</ControlSectionLabel>
							<GUI.Control
								id="noise-glow-freq-x"
								label="Noise X frequency"
								value={noiseGlowFreqX}
								defaultValue={D.noiseGlowFreqX}
								min={0}
								max={10}
								step={0.1}
								onChange={setNoiseGlowFreqX}
								valueKeys="noiseGlowFreqX"
							/>
							<GUI.Control
								id="noise-glow-freq-y"
								label="Noise Y frequency"
								value={noiseGlowFreqY}
								defaultValue={D.noiseGlowFreqY}
								min={0}
								max={10}
								step={0.1}
								onChange={setNoiseGlowFreqY}
								valueKeys="noiseGlowFreqY"
							/>
							<GUI.Control
								id="noise-glow-speed"
								label="Noise speed"
								value={noiseGlowSpeed}
								defaultValue={D.noiseGlowSpeed}
								min={0}
								max={3}
								step={0.01}
								onChange={setNoiseGlowSpeed}
								valueKeys="noiseGlowSpeed"
							/>
							<GUI.Control
								id="noise-glow-amount"
								label="Noise amount"
								description="Strength of the wispy aurora effect for the listening and speaking states."
								value={noiseGlowAmount}
								defaultValue={D.noiseGlowAmount}
								min={0}
								max={1}
								step={0.01}
								onChange={setNoiseGlowAmount}
								valueKeys="noiseGlowAmount"
							/>
							<ControlSectionLabel>User Colors</ControlSectionLabel>
							<GUI.RgbaColorInput id="user-c1" label="Color 1" value={userColor1} defaultValue={D.userColor1} onChange={setUserColor1} valueKeys="userColor1" />
							<GUI.RgbaColorInput id="user-c2" label="Color 2" value={userColor2} defaultValue={D.userColor2} onChange={setUserColor2} valueKeys="userColor2" />
							<GUI.RgbaColorInput id="user-c3" label="Color 3" value={userColor3} defaultValue={D.userColor3} onChange={setUserColor3} valueKeys="userColor3" />
							<GUI.RgbaColorInput id="user-c4" label="Color 4" value={userColor4} defaultValue={D.userColor4} onChange={setUserColor4} valueKeys="userColor4" />
							<ControlSectionLabel>AI Colors</ControlSectionLabel>
							<GUI.RgbaColorInput id="ai-c1" label="Color 1" value={aiColor1} defaultValue={D.aiColor1} onChange={setAiColor1} valueKeys="aiColor1" />
							<GUI.RgbaColorInput id="ai-c2" label="Color 2" value={aiColor2} defaultValue={D.aiColor2} onChange={setAiColor2} valueKeys="aiColor2" />
							<GUI.RgbaColorInput id="ai-c3" label="Color 3" value={aiColor3} defaultValue={D.aiColor3} onChange={setAiColor3} valueKeys="aiColor3" />
							<GUI.RgbaColorInput id="ai-c4" label="Color 4" value={aiColor4} defaultValue={D.aiColor4} onChange={setAiColor4} valueKeys="aiColor4" />
						</GUI.Section>
					</GUI.Panel>
				</div>

				<div className="rounded-xl border border-border bg-surface p-4">
					<GUI.Panel title="Organic color mode" values={{ organicDriftSpeed, organicDriftRadius, organicNoiseScale, organicNoiseSpeed, organicWaveformWidthPercent, organicWaveformHeightScale, organicEdgeFadeLeft, organicEdgeFadeRight, organicThicknessActive, organicThicknessSignalMul }}>
						<GUI.Section title="Layout" borderTop={false}>
							<GUI.Control
								id="organic-waveform-width"
								label="Waveform width"
								description="Overall waveform width relative to its container."
								value={organicWaveformWidthPercent}
								defaultValue={D.waveformWidthPercent}
								min={40}
								max={140}
								step={1}
								unit="%"
								onChange={setOrganicWaveformWidthPercent}
								valueKeys="organicWaveformWidthPercent"
							/>
							<GUI.Control
								id="organic-waveform-height"
								label="Waveform height"
								description="Increases the waveform's vertical amplitude without changing its layout box."
								value={organicWaveformHeightScale}
								defaultValue={D.waveformHeightScale}
								min={0.25}
								max={2.5}
								step={0.05}
								unit="x"
								onChange={setOrganicWaveformHeightScale}
								valueKeys="organicWaveformHeightScale"
							/>
							<GUI.Control
								id="organic-edge-fade-left"
								label="Left edge fade"
								description="How gradually the waveform tapers out on the left edge."
								value={organicEdgeFadeLeft}
								defaultValue={D.edgeFadeLeft}
								min={0}
								max={0.5}
								step={0.01}
								onChange={setOrganicEdgeFadeLeft}
								valueKeys="organicEdgeFadeLeft"
							/>
							<GUI.Control
								id="organic-edge-fade-right"
								label="Right edge fade"
								description="How gradually the waveform tapers out on the right edge."
								value={organicEdgeFadeRight}
								defaultValue={D.edgeFadeRight}
								min={0}
								max={0.5}
								step={0.01}
								onChange={setOrganicEdgeFadeRight}
								valueKeys="organicEdgeFadeRight"
							/>
						</GUI.Section>
						<GUI.Section title="Shape">
							<GUI.Control
								id="organic-thickness-active"
								label="Thickness (active)"
								value={organicThicknessActive}
								defaultValue={D.thicknessActive}
								min={0}
								max={0.5}
								step={0.005}
								onChange={setOrganicThicknessActive}
								valueKeys="organicThicknessActive"
							/>
							<GUI.Control
								id="organic-thickness-signal-mul"
								label="Thickness signal multiplier"
								description="How much the waveform grows thicker from audio amplitude."
								value={organicThicknessSignalMul}
								defaultValue={D.thicknessSignalMul}
								min={0}
								max={3}
								step={0.01}
								onChange={setOrganicThicknessSignalMul}
								valueKeys="organicThicknessSignalMul"
							/>
						</GUI.Section>
						<GUI.Section title="Organic Motion">
							<GUI.Control
								id="organic-drift-speed"
								label="Drift speed"
								description="How quickly the color blobs drift spatially across the waveform."
								value={organicDriftSpeed}
								defaultValue={0.4}
								min={0.05}
								max={2.0}
								step={0.05}
								onChange={setOrganicDriftSpeed}
								valueKeys="organicDriftSpeed"
							/>
							<GUI.Control
								id="organic-drift-radius"
								label="Drift radius"
								description="How far each color blob's center drifts from the waveform baseline."
								value={organicDriftRadius}
								defaultValue={0.2}
								min={0.02}
								max={0.6}
								step={0.01}
								onChange={setOrganicDriftRadius}
								valueKeys="organicDriftRadius"
							/>
							<GUI.Control
								id="organic-noise-scale"
								label="Noise scale"
								description="Spatial frequency of the noise mask that shapes each blob's visibility."
								value={organicNoiseScale}
								defaultValue={2.0}
								min={0.5}
								max={6.0}
								step={0.1}
								onChange={setOrganicNoiseScale}
								valueKeys="organicNoiseScale"
							/>
							<GUI.Control
								id="organic-noise-speed"
								label="Noise speed"
								description="Temporal speed of the noise mask that animates each blob's shape."
								value={organicNoiseSpeed}
								defaultValue={0.3}
								min={0.05}
								max={1.5}
								step={0.05}
								onChange={setOrganicNoiseSpeed}
								valueKeys="organicNoiseSpeed"
							/>
						</GUI.Section>
					</GUI.Panel>
				</div>
				</div>
			</div>
		</div>
	);
}
