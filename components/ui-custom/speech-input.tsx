"use client";

import type { ComponentProps, MouseEvent } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useLatestRef } from "@/lib/use-latest-ref";
import MicrophoneIcon from "@atlaskit/icon/core/microphone";
import VideoStopIcon from "@atlaskit/icon/core/video-stop";
import { useCallback, useEffect, useRef, useState } from "react";

type SpeechInputMode = "speech-recognition" | "media-recorder" | "none";

export type SpeechInputProps = ComponentProps<typeof Button> & {
	onTranscriptionChange?: (text: string) => void;
	/**
	 * Callback for when audio is recorded using MediaRecorder fallback.
	 * This is called in browsers that don't support the Web Speech API (Firefox, Safari).
	 * The callback receives an audio Blob that should be sent to a transcription service.
	 * Return the transcribed text, which will be passed to onTranscriptionChange.
	 */
	onAudioRecorded?: (audioBlob: Blob) => Promise<string>;
	lang?: string;
};

const detectSpeechInputMode = (): SpeechInputMode => {
	if (typeof window === "undefined") {
		return "none";
	}

	if ("SpeechRecognition" in window || "webkitSpeechRecognition" in window) {
		return "speech-recognition";
	}

	if ("MediaRecorder" in window && "mediaDevices" in navigator) {
		return "media-recorder";
	}

	return "none";
};

function subscribeMediaRecorder(
	mediaRecorder: MediaRecorder,
	handlers: {
		onDataAvailable: (event: BlobEvent) => void;
		onError: () => void;
		onStop: () => void;
	},
): () => void {
	mediaRecorder.addEventListener("dataavailable", handlers.onDataAvailable);
	mediaRecorder.addEventListener("stop", handlers.onStop);
	mediaRecorder.addEventListener("error", handlers.onError);
	return () => {
		mediaRecorder.removeEventListener("dataavailable", handlers.onDataAvailable);
		mediaRecorder.removeEventListener("stop", handlers.onStop);
		mediaRecorder.removeEventListener("error", handlers.onError);
	};
}

const resolveSpeechInputButtonSize = (size: SpeechInputProps["size"]): SpeechInputProps["size"] => {
	if (size === "compact") {
		return "icon-compact";
	}

	if (size == null || size === "default") {
		return "icon";
	}

	return size;
};

const resolveSpeechInputIconSize = (size: SpeechInputProps["size"]): "small" | "medium" => {
	if (size === "icon-compact") {
		return "small"; // 12px
	}

	return "medium"; // 16px
};

export const SpeechInput = ({ className, onTranscriptionChange, onAudioRecorded, lang = "en-US", size, variant = "ghost", disabled: disabledProp, onClick, ...props }: SpeechInputProps) => {
	const [isListening, setIsListening] = useState(false);
	const [isProcessing, setIsProcessing] = useState(false);
	const [mode] = useState<SpeechInputMode>(detectSpeechInputMode);
	const [isRecognitionReady, setIsRecognitionReady] = useState(false);
	const recognitionRef = useRef<SpeechRecognition | null>(null);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const mediaRecorderListenerCleanupRef = useRef<(() => void) | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);
	const onTranscriptionChangeRef = useLatestRef<SpeechInputProps["onTranscriptionChange"]>(onTranscriptionChange);
	const onAudioRecordedRef = useLatestRef<SpeechInputProps["onAudioRecorded"]>(onAudioRecorded);
	const clearMediaRecorderListeners = useCallback(() => {
		mediaRecorderListenerCleanupRef.current?.();
		mediaRecorderListenerCleanupRef.current = null;
	}, []);

	// Initialize Speech Recognition when mode is speech-recognition
		// oxlint-disable react-doctor/no-adjust-state-on-prop-change -- browser SpeechRecognition availability is discovered through an external API.
		useEffect(() => {
		if (mode !== "speech-recognition") {
			return;
		}

		const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
		if (!SpeechRecognitionCtor) return;
		const speechRecognition = new SpeechRecognitionCtor();

		speechRecognition.continuous = true;
		speechRecognition.interimResults = true;
		speechRecognition.lang = lang;

		const handleStart = () => {
			setIsListening(true);
		};

		const handleEnd = () => {
			setIsListening(false);
		};

		const handleResult = (event: Event) => {
			const speechEvent = event as SpeechRecognitionEvent;
			let finalTranscript = "";

			for (let i = speechEvent.resultIndex; i < speechEvent.results.length; i += 1) {
				const result = speechEvent.results[i];
				if (result.isFinal) {
					finalTranscript += result[0]?.transcript ?? "";
				}
			}

			if (finalTranscript) {
				onTranscriptionChangeRef.current?.(finalTranscript);
			}
		};

		const handleError = () => {
			setIsListening(false);
		};

		speechRecognition.addEventListener("start", handleStart);
		speechRecognition.addEventListener("end", handleEnd);
		speechRecognition.addEventListener("result", handleResult);
		speechRecognition.addEventListener("error", handleError);

		recognitionRef.current = speechRecognition;
		setIsRecognitionReady(true);

		return () => {
			speechRecognition.removeEventListener("start", handleStart);
			speechRecognition.removeEventListener("end", handleEnd);
			speechRecognition.removeEventListener("result", handleResult);
			speechRecognition.removeEventListener("error", handleError);
			speechRecognition.stop();
			recognitionRef.current = null;
			setIsRecognitionReady(false);
		};
		}, [lang, mode, onTranscriptionChangeRef]);
		// oxlint-enable react-doctor/no-adjust-state-on-prop-change

	// Cleanup MediaRecorder and stream on unmount
	useEffect(
		() => () => {
			clearMediaRecorderListeners();
			if (mediaRecorderRef.current?.state === "recording") {
				mediaRecorderRef.current.stop();
			}
			if (streamRef.current) {
				for (const track of streamRef.current.getTracks()) {
					track.stop();
				}
			}
		},
			[clearMediaRecorderListeners],
	);

	// Start MediaRecorder recording
	const startMediaRecorder = useCallback(async () => {
		if (!onAudioRecordedRef.current) {
			return;
		}

		try {
			clearMediaRecorderListeners();
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			streamRef.current = stream;
			const mediaRecorder = new MediaRecorder(stream);
			audioChunksRef.current = [];

			const handleDataAvailable = (event: BlobEvent) => {
				if (event.data.size > 0) {
					audioChunksRef.current.push(event.data);
				}
			};

			const handleStop = async () => {
				clearMediaRecorderListeners();
				mediaRecorderRef.current = null;
				for (const track of stream.getTracks()) {
					track.stop();
				}
				streamRef.current = null;

				const audioBlob = new Blob(audioChunksRef.current, {
					type: "audio/webm",
				});

				if (audioBlob.size > 0 && onAudioRecordedRef.current) {
					setIsProcessing(true);
					try {
						const transcript = await onAudioRecordedRef.current(audioBlob);
						if (transcript) {
							onTranscriptionChangeRef.current?.(transcript);
						}
					} catch {
						// Error handling delegated to the onAudioRecorded caller
					} finally {
						setIsProcessing(false);
					}
				}
			};

			const handleError = () => {
				clearMediaRecorderListeners();
				mediaRecorderRef.current = null;
				setIsListening(false);
				for (const track of stream.getTracks()) {
					track.stop();
				}
				streamRef.current = null;
			};

			mediaRecorderListenerCleanupRef.current = subscribeMediaRecorder(mediaRecorder, {
				onDataAvailable: handleDataAvailable,
				onError: handleError,
				onStop: handleStop,
			});

			mediaRecorderRef.current = mediaRecorder;
			mediaRecorder.start();
			setIsListening(true);
		} catch {
			setIsListening(false);
		}
	}, [clearMediaRecorderListeners, onAudioRecordedRef, onTranscriptionChangeRef]);

	// Stop MediaRecorder recording
	const stopMediaRecorder = useCallback(() => {
		if (mediaRecorderRef.current?.state === "recording") {
			mediaRecorderRef.current.stop();
		}
		setIsListening(false);
	}, []);

	const toggleListening = useCallback(() => {
		if (mode === "speech-recognition" && recognitionRef.current) {
			if (isListening) {
				recognitionRef.current.stop();
			} else {
				recognitionRef.current.start();
			}
		} else if (mode === "media-recorder") {
			if (isListening) {
				stopMediaRecorder();
			} else {
				startMediaRecorder();
			}
		}
	}, [mode, isListening, startMediaRecorder, stopMediaRecorder]);

	const handleClick = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			onClick?.(event as Parameters<NonNullable<SpeechInputProps["onClick"]>>[0]);

			if (event.defaultPrevented) {
				return;
			}

			toggleListening();
		},
		[onClick, toggleListening],
	);

	const resolvedButtonSize = resolveSpeechInputButtonSize(size);
	const resolvedIconSize = resolveSpeechInputIconSize(resolvedButtonSize);
	const resolvedVariant = isListening ? "destructive" : variant;

	// Determine if button should be disabled
	const isDisabled = mode === "none" || (mode === "speech-recognition" && !isRecognitionReady) || (mode === "media-recorder" && !onAudioRecorded) || isProcessing || Boolean(disabledProp);

	return (
		<div className="relative z-10 inline-flex items-center justify-center overflow-visible">
			{/* Animated pulse rings */}
			{isListening ? [0, 1, 2].map((index) => (
					<div
						className={cn("pointer-events-none absolute animate-pulse rounded-full border-2 border-destructive/30", index === 0 ? "inset-0" : index === 1 ? "-inset-px" : "-inset-1")}
						key={index}
						style={{
							animationDelay: `${index * 0.2}s`,
							animationDuration: "1.4s",
						}}
					/>
				)) : null}

			{/* Main record button */}
			<Button
				{...props}
				className={cn(
					"relative z-10 aspect-square shrink-0 rounded-full p-0 transition-all duration-300",
					isListening ? "bg-destructive text-primary-foreground hover:bg-destructive/80 hover:text-primary-foreground" : "text-icon-subtle",
					className,
				)}
				disabled={isDisabled}
				onClick={handleClick}
				size={resolvedButtonSize}
				variant={resolvedVariant}
				type="button"
			>
				{isProcessing ? <Spinner /> : null}
				{!isProcessing && isListening ? <VideoStopIcon label="" size={resolvedIconSize} /> : null}
				{!(isProcessing || isListening) ? <MicrophoneIcon label="" size={resolvedIconSize} /> : null}
			</Button>
		</div>
	);
};
