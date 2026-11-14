"use client";

// oxlint-disable react-doctor/no-multi-comp -- This module intentionally colocates coupled component parts as a compound component or demo surface API.

// oxlint-disable react-doctor/no-event-handler -- Effects in this file bridge external systems, animation/media state, timers, or parent-controlled state rather than user event handlers.

import { cloneElement, useCallback, useEffect, useRef, useState, type HTMLAttributes, type ReactElement, type ReactNode } from "react";
import type { ChatStatus } from "ai";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import CustomizeMenu from "@/components/projects/shared/components/chat-configuration/customize-menu";
import { REASONING_OPTIONS } from "@/components/projects/shared/components/chat-configuration/customize-menu-data";
import {
	PromptInputAutoButton,
	PromptInputButton,
	PromptInputDictationControl,
	PromptInputSubmit,
} from "@/components/ui-custom/prompt-input";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { dropdownStyles } from "@/components/ui/dropdown-menu";
import { LiveWaveform } from "@/components/ui-custom/live-waveform";
import { RovoCursorTrackingIcon } from "@/components/projects/shared/components/rovo-cursor-tracking-icon";
import { resolveRovoAppComposerIdleAction } from "@/components/projects/shared/lib/rovo-app-composer-idle-action";
import { resolveRovoAppComposerWaveformState } from "@/components/projects/shared/lib/rovo-app-composer-waveform-state";
import { ROVO_WAVEFORM_COLOR_CSS_VARS } from "@/lib/rovo-colors";
import { cn } from "@/lib/utils";
import ArrowUpIcon from "@atlaskit/icon/core/arrow-up";
import AudioWaveformIcon from "@atlaskit/icon-lab/core/audio-waveform";

const ROVO_COMPOSER_WAVEFORM_INTRO_MS = 500;
const LIVE_VOICE_CTA_CLASS_NAME = "bg-rovo-brand text-rovo-icon-inverse [&_svg]:text-rovo-icon-inverse hover:bg-rovo-brand/90 active:bg-rovo-brand/80";
const ACTION_FRAME_CLASS_NAME = "flex h-9 shrink-0 items-center justify-center";
const ACTION_FRAME_CLASS_NAME_BY_SIZE = {
	"icon-sm": ACTION_FRAME_CLASS_NAME,
	"icon-xs": "flex h-6 shrink-0 items-center justify-center",
} as const;
const ACTION_CLUSTER_CLASS_NAME_BY_SIZE = {
	"icon-sm": "flex h-9 items-center gap-1",
	"icon-xs": "flex h-6 items-center gap-1",
} as const;
const ACTION_ICON_BUTTON_CLASS_NAME_BY_SIZE = {
	"icon-sm": "size-8 hover:opacity-90 active:opacity-80",
	"icon-xs": "size-6 hover:opacity-90 active:opacity-80",
} as const;
const LIVE_VOICE_STOP_BUTTON_SIZE_CLASS_NAME_BY_SIZE = {
	"icon-sm": "size-8",
	"icon-xs": "size-6",
} as const;
const CURSOR_RAIL_FRAME_CLASS_NAME_BY_SIZE = {
	"icon-sm": "relative flex h-9 w-[68px] items-center justify-center overflow-hidden rounded-lg",
	"icon-xs": "relative flex h-6 w-[52px] items-center justify-center overflow-hidden rounded-md",
} as const;
const CURSOR_RAIL_INNER_CLASS_NAME_BY_SIZE = {
	"icon-sm": "relative z-10 flex h-8 w-16 items-center gap-0",
	"icon-xs": "relative z-10 flex h-6 w-12 items-center gap-0",
} as const;
const CURSOR_RAIL_PILL_WIDTH_CLASS_NAME_BY_SIZE = {
	"icon-sm": { active: "w-16", idle: "w-8" },
	"icon-xs": { active: "w-12", idle: "w-6" },
} as const;
const ROVO_CURSOR_BUTTON_TRANSITION = { type: "spring", bounce: 0.18, visualDuration: 0.22 } as const;
const ROVO_CURSOR_BUTTON_VARIANTS = {
	rest: { transform: "scale(1)" },
	hover: { transform: "scale(1.06)" },
	tap: { transform: "scale(0.96)" },
} as const;
const ROVO_CURSOR_BUTTON_REDUCED_VARIANTS = {
	rest: { transform: "scale(1)" },
	hover: { transform: "scale(1)" },
	tap: { transform: "scale(1)" },
} as const;

export type RovoComposerDictationState = "idle" | "recording" | "processing";

interface ComposerVoiceWaveformProps {
	active: boolean;
	barHeightScale: number;
	barCount?: 4 | 8;
	mediaStream: MediaStream | null;
	processing: boolean;
}

function ComposerVoiceWaveform({
	active,
	barHeightScale,
	barCount = 8,
	mediaStream,
	processing,
}: Readonly<ComposerVoiceWaveformProps>): ReactElement {
	return (
		<span className={cn("flex h-full shrink-0 items-center", barCount === 4 ? "w-4" : "w-8")}>
			<LiveWaveform
				active={active}
				barColor="currentColor"
				barColors={[...ROVO_WAVEFORM_COLOR_CSS_VARS]}
				barCount={barCount}
				barGap={2}
				barHeightScale={barHeightScale}
				barOpacityMax={1}
				barOpacityMin={1}
				barWidth={2}
				barRadius={0}
				className="min-h-0 min-w-0 flex-1 animate-in fade-in duration-slow"
				entranceAnimation="stagger"
				entranceDurationMs={180}
				entranceStaggerMs={14}
				fadeEdges={false}
				fftSize={512}
				height="100%"
				mediaStream={mediaStream}
				mode="static"
				processing={processing}
				sensitivity={2.4}
				smoothingTimeConstant={0.35}
			/>
		</span>
	);
}

export type RovoComposerActionSize = "icon-sm" | "icon-xs";

function ComposerActionFrame({
	children,
	size = "icon-sm",
}: Readonly<{ children: ReactNode; size?: RovoComposerActionSize }>): ReactElement {
	return (
		<div className={ACTION_FRAME_CLASS_NAME_BY_SIZE[size]}>
			{children}
		</div>
	);
}

const autoReasoningButtonClassName = [
	"whitespace-nowrap",
	"[&[aria-expanded=true]]:border-transparent",
	"[&[aria-expanded=true]]:bg-transparent",
	"[&[aria-expanded=true]]:text-text-subtle",
	"[&[aria-expanded=true]_svg]:text-icon-subtle",
].join(" ");

function getReasoningButtonLabel(option: (typeof REASONING_OPTIONS)[number]): string {
	return option.id === "let-rovo-decide" ? "Auto" : option.label;
}

export interface RovoComposerReasoningSelectorProps {
	companyKnowledgeEnabled: boolean;
	onCompanyKnowledgeChange: (enabled: boolean) => void;
	onReasoningChange: (reasoning: string) => void;
	onOpenChange?: (open: boolean) => void;
	open?: boolean;
	selectedReasoning: string;
	webResultsEnabled: boolean;
	onWebResultsChange: (enabled: boolean) => void;
}

export function RovoComposerReasoningSelector({
	companyKnowledgeEnabled,
	onCompanyKnowledgeChange,
	onReasoningChange,
	onOpenChange,
	open,
	selectedReasoning,
	webResultsEnabled,
	onWebResultsChange,
}: Readonly<RovoComposerReasoningSelectorProps>): ReactElement {
	const selectedReasoningOption = REASONING_OPTIONS.find((option) => option.id === selectedReasoning) ?? REASONING_OPTIONS[0];
	const selectedReasoningButtonLabel = getReasoningButtonLabel(selectedReasoningOption);

	return (
		<Popover open={open} onOpenChange={onOpenChange}>
			<PopoverTrigger
				render={(
					<PromptInputAutoButton
						aria-label={`Reasoning: ${selectedReasoningOption.label}`}
						className={autoReasoningButtonClassName}
					>
						{cloneElement(selectedReasoningOption.icon, { label: "" })}
						<span>{selectedReasoningButtonLabel}</span>
					</PromptInputAutoButton>
				)}
			/>
			<PopoverContent side="top" align="end" sideOffset={8} positionerClassName="z-[600]" className={cn(dropdownStyles.surface, dropdownStyles.padding, "w-auto")}>
				<PopoverTitle className="sr-only">Choose reasoning</PopoverTitle>
				<CustomizeMenu
					selectedReasoning={selectedReasoning}
					onReasoningChange={onReasoningChange}
					showSources={false}
					webResultsEnabled={webResultsEnabled}
					onWebResultsChange={onWebResultsChange}
					companyKnowledgeEnabled={companyKnowledgeEnabled}
					onCompanyKnowledgeChange={onCompanyKnowledgeChange}
					onClose={() => onOpenChange?.(false)}
				/>
			</PopoverContent>
		</Popover>
	);
}

export interface RovoComposerActionButtonProps {
	canSubmit: boolean;
	composerStatus: ChatStatus;
	dictationState?: RovoComposerDictationState;
	dictationTranscriptPreview?: string | null;
	isComposerBusy?: boolean;
	liveVoiceEnabled?: boolean;
	clickyActive?: boolean;
	micStream?: MediaStream | null;
	onStartDictation?: () => void;
	onStopDictation?: () => void;
	onStop: () => Promise<void> | void;
	onToggleClicky?: () => void;
	onToggleRealtimeVoice?: () => void;
	realtimeVoiceActive?: boolean;
	realtimeVoiceState?: "idle" | "connecting" | "listening" | "speaking";
	screenAssistantTargetPrefix?: string;
	showBackgroundStop?: boolean;
	showSubmitWhenEmpty?: boolean;
	size?: RovoComposerActionSize;
	submitButtonClassName?: string;
	submitDisabled?: boolean;
	voiceStartButtonClassName?: string;
}

export function RovoComposerActionButton({
	canSubmit,
	composerStatus,
	dictationState = "idle",
	dictationTranscriptPreview = null,
	isComposerBusy,
	liveVoiceEnabled = false,
	clickyActive = false,
	micStream = null,
	onStartDictation,
	onStopDictation,
	onStop,
	onToggleClicky,
	onToggleRealtimeVoice,
	realtimeVoiceActive = false,
	realtimeVoiceState = "idle",
	screenAssistantTargetPrefix,
	showBackgroundStop = false,
	showSubmitWhenEmpty = false,
	size = "icon-sm",
	submitButtonClassName,
	submitDisabled = false,
	voiceStartButtonClassName,
}: Readonly<RovoComposerActionButtonProps>): ReactElement {
	const glyphSize = size === "icon-xs" ? "small" : undefined;
	const realtimeWaveformIntroTimeoutRef = useRef<number | null>(null);
	const shouldReduceMotion = useReducedMotion();
	const [isRealtimeWaveformIntroActive, setIsRealtimeWaveformIntroActive] = useState(false);
	const [isDictationOptimisticActive, setIsDictationOptimisticActive] = useState(false);
	const resolvedComposerBusy = isComposerBusy ?? (composerStatus === "submitted" || composerStatus === "streaming");
	// The opt-in controls whether this composer can start live voice. An active
	// session may have been started by a shell shortcut, so it must remain
	// visible and stoppable even when this surface does not expose the start CTA.
	const resolvedRealtimeVoiceActive = realtimeVoiceActive;
	const isDictationActive = dictationState !== "idle" || isDictationOptimisticActive;
	const idleAction = showSubmitWhenEmpty && !resolvedComposerBusy && !resolvedRealtimeVoiceActive && !showBackgroundStop
		? "submit"
		: resolveRovoAppComposerIdleAction({
			canStartDictation: Boolean(onStartDictation),
			canStartRealtimeVoice: liveVoiceEnabled && Boolean(onToggleRealtimeVoice),
			canSubmit,
			isComposerBusy: resolvedComposerBusy,
			realtimeVoiceActive: resolvedRealtimeVoiceActive,
			showBackgroundStop,
			submitDisabled,
		});
	const realtimeWaveformState = resolveRovoAppComposerWaveformState({
		hasMicStream: micStream !== null,
		isIntroActive: isRealtimeWaveformIntroActive,
		realtimeVoiceActive: resolvedRealtimeVoiceActive,
	});
	const isRealtimeMicWaveformActive = realtimeVoiceState === "listening" && realtimeWaveformState.active;
	const isRealtimeWaveformProcessing = !isRealtimeMicWaveformActive && resolvedRealtimeVoiceActive;
	const isDictationRecording = dictationState === "recording" && micStream !== null;
	const shouldShowDictationStart = Boolean(onStartDictation) && !resolvedComposerBusy && !resolvedRealtimeVoiceActive && !submitDisabled;
	const shouldShowRealtimeVoiceStart = liveVoiceEnabled && idleAction === "voice-start" && !canSubmit && Boolean(onToggleRealtimeVoice);
	const shouldShowRealtimeVoiceRail = resolvedRealtimeVoiceActive && Boolean(onToggleClicky);

	const clearRealtimeWaveformIntro = useCallback(() => {
		if (realtimeWaveformIntroTimeoutRef.current !== null) {
			window.clearTimeout(realtimeWaveformIntroTimeoutRef.current);
			realtimeWaveformIntroTimeoutRef.current = null;
		}
	}, []);

	const handleToggleRealtimeVoice = useCallback(() => {
		if ((!liveVoiceEnabled && !realtimeVoiceActive) || !onToggleRealtimeVoice) {
			return;
		}

		clearRealtimeWaveformIntro();

		if (!realtimeVoiceActive) {
			setIsRealtimeWaveformIntroActive(true);
			realtimeWaveformIntroTimeoutRef.current = window.setTimeout(() => {
				realtimeWaveformIntroTimeoutRef.current = null;
				setIsRealtimeWaveformIntroActive(false);
			}, ROVO_COMPOSER_WAVEFORM_INTRO_MS);
		} else {
			setIsRealtimeWaveformIntroActive(false);
		}

		onToggleRealtimeVoice();
	}, [clearRealtimeWaveformIntro, liveVoiceEnabled, onToggleRealtimeVoice, realtimeVoiceActive]);

	const handleStartDictation = useCallback(() => {
		setIsDictationOptimisticActive(true);
		onStartDictation?.();
	}, [onStartDictation]);

	const handleStopDictation = useCallback(() => {
		setIsDictationOptimisticActive(false);
		onStopDictation?.();
	}, [onStopDictation]);

	useEffect(() => {
		if (dictationState !== "idle" || resolvedRealtimeVoiceActive) {
			setIsDictationOptimisticActive(false);
		}
	}, [dictationState, resolvedRealtimeVoiceActive]);

	useEffect(() => {
		return () => {
			clearRealtimeWaveformIntro();
		};
	}, [clearRealtimeWaveformIntro]);

	return (
		<>
			<AnimatePresence mode="popLayout" initial={false}>
				{isDictationActive ? (
					<motion.div
						key="dictation-active"
						initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.8 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.8 }}
						transition={{ type: "spring", bounce: 0, visualDuration: 0.15 }}
						style={{ willChange: "transform, opacity" }}
					>
						<ComposerActionFrame size={size}>
							<PromptInputDictationControl
								mediaStream={micStream}
								onStop={handleStopDictation}
								size={size}
								state={isDictationRecording ? "listening" : "processing"}
								transcriptPreview={dictationTranscriptPreview}
							/>
						</ComposerActionFrame>
					</motion.div>
				) : shouldShowRealtimeVoiceRail ? (
					<motion.div
						key="live-voice-active"
						initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.8 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.8 }}
						transition={{ type: "spring", bounce: 0, visualDuration: 0.15 }}
						style={{ willChange: "transform, opacity" }}
					>
						<div
							className={cn(
								CURSOR_RAIL_FRAME_CLASS_NAME_BY_SIZE[size],
								clickyActive ? "text-text-inverse" : undefined,
							)}
						>
							<span aria-hidden="true" className="absolute inset-0 rounded-lg bg-bg-neutral" />
							<span
								aria-hidden="true"
								className={cn(
									"absolute top-0.5 right-0.5 bottom-0.5 rounded-md bg-bg-neutral-bold shadow-sm transition-[width] duration-medium ease-in-out motion-reduce:transition-none",
									clickyActive
										? CURSOR_RAIL_PILL_WIDTH_CLASS_NAME_BY_SIZE[size].active
										: CURSOR_RAIL_PILL_WIDTH_CLASS_NAME_BY_SIZE[size].idle,
								)}
							/>
							<div className={CURSOR_RAIL_INNER_CLASS_NAME_BY_SIZE[size]}>
								<motion.button
									aria-label="Rovo cursor"
									aria-pressed={clickyActive}
									animate="rest"
									className={cn(
										"group/rovo-cursor-button flex shrink-0 items-center justify-center rounded-md border border-transparent p-0 outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
										LIVE_VOICE_STOP_BUTTON_SIZE_CLASS_NAME_BY_SIZE[size],
										clickyActive
											? "text-text-inverse"
											: "text-icon-subtle",
									)}
									data-screen-assistant-target={screenAssistantTargetPrefix ? `${screenAssistantTargetPrefix}:cursor` : undefined}
									initial="rest"
									onClick={onToggleClicky}
									style={{ willChange: shouldReduceMotion ? undefined : "transform" }}
									transition={ROVO_CURSOR_BUTTON_TRANSITION}
									type="button"
									variants={shouldReduceMotion ? ROVO_CURSOR_BUTTON_REDUCED_VARIANTS : ROVO_CURSOR_BUTTON_VARIANTS}
									whileHover="hover"
									whileTap="tap"
								>
									{clickyActive ? (
										<RovoCursorTrackingIcon active />
									) : (
										<RovoCursorTrackingIcon active={false} />
									)}
								</motion.button>
								<button
									aria-label="Stop live voice"
									className={cn(
										"flex shrink-0 items-center justify-center overflow-hidden rounded-md p-0 text-text-inverse outline-none transition-colors hover:bg-bg-neutral-bold-hovered focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-bg-neutral-bold-pressed",
										LIVE_VOICE_STOP_BUTTON_SIZE_CLASS_NAME_BY_SIZE[size],
									)}
									data-screen-assistant-target={screenAssistantTargetPrefix ? `${screenAssistantTargetPrefix}:voice` : undefined}
									onClick={handleToggleRealtimeVoice}
									type="button"
								>
									<ComposerVoiceWaveform
										active={isRealtimeMicWaveformActive}
										barCount={4}
										barHeightScale={isRealtimeWaveformProcessing ? 1.15 : 1}
										mediaStream={isRealtimeMicWaveformActive ? micStream : null}
										processing={isRealtimeWaveformProcessing}
									/>
								</button>
							</div>
						</div>
					</motion.div>
				) : resolvedRealtimeVoiceActive ? (
					<motion.div
						key="waveform"
						initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.8 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.8 }}
						transition={{ type: "spring", bounce: 0, visualDuration: 0.15 }}
						style={{ willChange: "transform, opacity" }}
					>
						<ComposerActionFrame size={size}>
							<button
								aria-label="Stop live voice"
								className={cn(
									"flex items-center justify-center overflow-hidden rounded-md bg-bg-neutral-bold p-0 text-text-inverse shadow-sm outline-none transition-colors hover:bg-bg-neutral-bold-hovered focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-bg-neutral-bold-pressed",
									LIVE_VOICE_STOP_BUTTON_SIZE_CLASS_NAME_BY_SIZE[size],
								)}
								onClick={handleToggleRealtimeVoice}
								type="button"
							>
								<ComposerVoiceWaveform
									active={isRealtimeMicWaveformActive}
									barCount={4}
									barHeightScale={isRealtimeWaveformProcessing ? 1.15 : 1}
									mediaStream={isRealtimeMicWaveformActive ? micStream : null}
									processing={isRealtimeWaveformProcessing}
								/>
							</button>
						</ComposerActionFrame>
					</motion.div>
				) : idleAction === "submit" || idleAction === "voice-start" ? (
					<motion.div
						key={idleAction === "submit" ? "submit-actions" : "voice-start"}
						initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.8 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.8 }}
						transition={{ type: "spring", bounce: 0, visualDuration: 0.15 }}
						style={{ willChange: "transform, opacity" }}
					>
						<ComposerActionFrame size={size}>
							<div className={ACTION_CLUSTER_CLASS_NAME_BY_SIZE[size]}>
								{shouldShowDictationStart ? (
									<PromptInputDictationControl
										onStart={handleStartDictation}
										screenAssistantTarget={screenAssistantTargetPrefix ? `${screenAssistantTargetPrefix}:dictation` : undefined}
										size={size}
									/>
								) : null}
								{idleAction === "submit" ? (
									<PromptInputSubmit aria-label="Submit" className={cn("hover:opacity-90 active:opacity-80", submitButtonClassName)} disabled={submitDisabled || !canSubmit} onStop={() => void onStop()} size={size} status={composerStatus}>
										<ArrowUpIcon label="" size={glyphSize} />
									</PromptInputSubmit>
								) : null}
								{shouldShowRealtimeVoiceStart ? (
									<PromptInputButton
										aria-label="Start live voice"
										className={cn(ACTION_ICON_BUTTON_CLASS_NAME_BY_SIZE[size], LIVE_VOICE_CTA_CLASS_NAME, voiceStartButtonClassName)}
										data-screen-assistant-target={screenAssistantTargetPrefix ? `${screenAssistantTargetPrefix}:voice` : undefined}
										onClick={handleToggleRealtimeVoice}
										size={size}
										tooltip={{ content: "Live chat", delay: 0 }}
										variant="ghost"
									>
										<AudioWaveformIcon label="" size={glyphSize} />
									</PromptInputButton>
								) : null}
							</div>
						</ComposerActionFrame>
					</motion.div>
				) : idleAction === "background-stop" ? (
					<motion.div
						key="background-stop"
						initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.8 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.8 }}
						transition={{ type: "spring", bounce: 0, visualDuration: 0.15 }}
						style={{ willChange: "transform, opacity" }}
					>
						<ComposerActionFrame size={size}>
							<PromptInputSubmit
								aria-label="Stop background work"
								onStop={() => void onStop()}
								size={size}
								status="streaming"
							>
								<ArrowUpIcon label="" size={glyphSize} />
							</PromptInputSubmit>
						</ComposerActionFrame>
					</motion.div>
				) : null}
			</AnimatePresence>
			<AnimatePresence initial={false}>
				{resolvedComposerBusy ? (
					<motion.div
						key="stop"
						initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.8 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.8 }}
						transition={{ type: "spring", bounce: 0, visualDuration: 0.15 }}
						style={{ willChange: "transform, opacity" }}
					>
						<ComposerActionFrame size={size}>
							<PromptInputSubmit aria-label="Stop" onStop={() => void onStop()} size={size} status={composerStatus}>
								<ArrowUpIcon label="" size={glyphSize} />
							</PromptInputSubmit>
						</ComposerActionFrame>
					</motion.div>
				) : null}
			</AnimatePresence>
		</>
	);
}

export type RovoComposerSendControlsProps = HTMLAttributes<HTMLDivElement> &
	RovoComposerReasoningSelectorProps &
	RovoComposerActionButtonProps & {
		hideReasoningSelector?: boolean;
	};

export function RovoComposerSendControls({
	canSubmit,
	className,
	companyKnowledgeEnabled,
	composerStatus,
	dictationState,
	dictationTranscriptPreview,
	hideReasoningSelector = false,
	isComposerBusy,
	liveVoiceEnabled = false,
	clickyActive,
	micStream,
	onCompanyKnowledgeChange,
	onOpenChange,
	onReasoningChange,
	onStop,
	onStartDictation,
	onStopDictation,
	onToggleClicky,
	onToggleRealtimeVoice,
	open,
	realtimeVoiceActive,
	realtimeVoiceState,
	screenAssistantTargetPrefix,
	selectedReasoning,
	showBackgroundStop,
	showSubmitWhenEmpty,
	size,
	submitButtonClassName,
	submitDisabled,
	voiceStartButtonClassName,
	webResultsEnabled,
	onWebResultsChange,
	...props
}: Readonly<RovoComposerSendControlsProps>): ReactElement {
	const shouldReduceMotion = useReducedMotion();
	useEffect(() => {
		if (hideReasoningSelector && open) {
			onOpenChange?.(false);
		}
	}, [hideReasoningSelector, onOpenChange, open]);

	return (
		<div className={cn("flex h-9 min-w-0 shrink-0 items-center justify-end gap-1", className)} {...props}>
			<AnimatePresence initial={false} mode="popLayout">
				{hideReasoningSelector ? null : (
					<motion.div
						key="reasoning-selector"
						initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.8 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.8 }}
						transition={{ type: "spring", bounce: 0, visualDuration: 0.15 }}
						style={{ willChange: "transform, opacity" }}
					>
						<RovoComposerReasoningSelector
							companyKnowledgeEnabled={companyKnowledgeEnabled}
							onCompanyKnowledgeChange={onCompanyKnowledgeChange}
							onReasoningChange={onReasoningChange}
							onOpenChange={onOpenChange}
							open={open}
							selectedReasoning={selectedReasoning}
							webResultsEnabled={webResultsEnabled}
							onWebResultsChange={onWebResultsChange}
						/>
					</motion.div>
				)}
			</AnimatePresence>
			<RovoComposerActionButton
				canSubmit={canSubmit}
				composerStatus={composerStatus}
				dictationState={dictationState}
				dictationTranscriptPreview={dictationTranscriptPreview}
				isComposerBusy={isComposerBusy}
				liveVoiceEnabled={liveVoiceEnabled}
				clickyActive={clickyActive}
				micStream={micStream}
				onStop={onStop}
				onStartDictation={onStartDictation}
				onStopDictation={onStopDictation}
				onToggleClicky={onToggleClicky}
				onToggleRealtimeVoice={onToggleRealtimeVoice}
				realtimeVoiceActive={realtimeVoiceActive}
				realtimeVoiceState={realtimeVoiceState}
				screenAssistantTargetPrefix={screenAssistantTargetPrefix}
				showBackgroundStop={showBackgroundStop}
				showSubmitWhenEmpty={showSubmitWhenEmpty}
				size={size}
				submitButtonClassName={submitButtonClassName}
				submitDisabled={submitDisabled}
				voiceStartButtonClassName={voiceStartButtonClassName}
			/>
		</div>
	);
}
