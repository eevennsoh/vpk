"use client";

import {
	PromptInputButton,
	PromptInputTextarea,
} from "@/components/ui-custom/prompt-input";
import { composerTextareaClassName, floatingComposerTextareaClassName } from "@/components/projects/shared/components/rovo-composer-styles";
import { cn } from "@/lib/utils";
import AddIcon from "@atlaskit/icon/core/add";
import { AnimatePresence, motion } from "motion/react";
import { type MouseEvent, useEffect, useRef } from "react";
import { RovoComposerActionButton } from "@/components/projects/shared/components/rovo-composer-send-controls";
import { FloatingComposer } from "@/components/projects/shared/components/floating-composer";
import { useRovoAppComposerReveal } from "@/components/projects/shared/hooks/use-rovo-app-composer-reveal";
import SvgTracing from "@/components/visual/svg-tracing";
import {
	DEFAULT_SVG_TRACE_CONFIG,
	SVG_TRACE_SCRATCH_UNDERLINE_PRESET,
	SVG_TRACE_TEMPLATES_LOOP_PRESET,
	type SvgTraceConfig,
} from "@/components/visual/svg-tracing/data";
import { type ComposerBodyBaseProps, usePrefillEffect } from "@/components/projects/shared/components/composer-body-shared";

const SCRATCH_SCRIBBLE_CONFIG: SvgTraceConfig = {
	...DEFAULT_SVG_TRACE_CONFIG,
	duration: 0.72,
	strokeWidth: 1.45,
	colorStopCount: 6,
	segmentCap: "butt",
	easingId: "easeInOutCubic",
	traceMode: "draw-eat",
	loop: false,
	repeatCount: 1,
	showOutline: false,
};

const TEMPLATES_SWEEP_CONFIG: SvgTraceConfig = {
	...SCRATCH_SCRIBBLE_CONFIG,
	duration: 0.78,
	strokeWidth: 1.45,
};

// Floating chrome width: the home/landing composer stays at the narrower 600px;
// in an active chat session it widens to align with the 800px message column.
const FLOATING_COMPOSER_MAX_WIDTH_CLASS = "max-w-[600px]";
const FLOATING_COMPOSER_SESSION_MAX_WIDTH_CLASS = "max-w-[800px]";

// Pressing a reveal link must not blur the textarea first: the blur would unmount the
// reveal before the click lands.
const keepComposerFocus = (event: MouseEvent<HTMLButtonElement>) => event.preventDefault();

export interface ComposerFloatingBodyProps extends ComposerBodyBaseProps {
	fillWidth: boolean;
	onBrowseTemplates?: () => void;
	onStartFromScratch?: () => void;
}

/**
 * Studio "floating" composer body: FloatingComposer single-row layout with
 * inline add button, the send-only action button, and the hover-revealed
 * "Browse templates / start from scratch" links with decorative SVG traces.
 */
export function ComposerFloatingBody({
	autoFocus,
	canSubmit,
	clickyActive,
	composerStatus,
	directoryAutocompleteListVisible,
	directoryAutocompleteLimit,
	dictationState,
	dictationTranscriptPreview,
	fillWidth,
	focusRequestKey,
	micStream,
	onDirectoryAutocompleteChange,
	onDirectoryAutocompleteControllerChange,
	onBrowseTemplates,
	onPromptSubmit,
	onStartFromScratch,
	onStartDictation,
	onStopDictation,
	onStop,
	onToggleClicky,
	onToggleRealtimeVoice,
	placeholder,
	prefillRequestKey,
	prefillText,
	realtimeVoiceActive,
	realtimeVoiceState,
	screenAssistantTargetPrefix = "studio-composer",
	showBackgroundStop,
	submitDisabled,
	textValue,
}: Readonly<ComposerFloatingBodyProps>) {
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);
	const shouldSuppressInitialAutoFocusRevealRef = useRef(autoFocus);
	const hasPromptValue = textValue.trim().length > 0;
	const {
		isRevealVisible,
		showTemplateSweep,
		showScratchScribble,
		templateSweepReplayKey,
		scratchScribbleReplayKey,
		replayRevealTraces,
		showReveal,
		scheduleHideReveal,
		setInputFocused,
	} = useRovoAppComposerReveal({ hasPromptValue });

	usePrefillEffect(prefillText, prefillRequestKey);

	useEffect(() => {
		if (typeof focusRequestKey !== "number" || focusRequestKey <= 0) {
			return;
		}

		requestAnimationFrame(() => {
			// The forwarded ref points at the core editor's contentEditable; focusing
			// it lands the caret per the editor (autofocus="end"), so no manual caret
			// placement is needed.
			textareaRef.current?.focus();
		});
	}, [focusRequestKey]);

	return (
		<div
			className="relative z-10"
			onMouseEnter={showReveal}
			onMouseLeave={scheduleHideReveal}
		>
			<FloatingComposer
				allowOverflow
				className={cn("relative z-10 mx-auto", fillWidth ? FLOATING_COMPOSER_SESSION_MAX_WIDTH_CLASS : FLOATING_COMPOSER_MAX_WIDTH_CLASS)}
				data-screen-assistant-target={screenAssistantTargetPrefix}
				onSubmit={onPromptSubmit}
				addButton={
					<PromptInputButton size="icon-sm" variant="ghost" aria-label="Add">
						<AddIcon label="" />
					</PromptInputButton>
				}
				actions={
					<RovoComposerActionButton
						canSubmit={canSubmit}
						composerStatus={composerStatus}
						dictationState={dictationState}
						dictationTranscriptPreview={dictationTranscriptPreview}
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
						submitDisabled={submitDisabled}
					/>
				}
			>
				<PromptInputTextarea
					ref={textareaRef}
					autoFocus={autoFocus}
					autoResize
					className={cn(composerTextareaClassName, floatingComposerTextareaClassName)}
					directoryAutocompleteListVisible={directoryAutocompleteListVisible}
					directoryAutocompleteLimit={directoryAutocompleteLimit}
					enableVisualTraceAutoTagging
					onBlur={() => setInputFocused(false)}
					onDirectoryAutocompleteChange={onDirectoryAutocompleteChange}
					onDirectoryAutocompleteControllerChange={onDirectoryAutocompleteControllerChange}
					onFocus={() => {
						if (shouldSuppressInitialAutoFocusRevealRef.current) {
							shouldSuppressInitialAutoFocusRevealRef.current = false;
							if (!hasPromptValue) {
								return;
							}
						}
						setInputFocused(true);
						replayRevealTraces();
					}}
					placeholder={placeholder}
					rows={1}
					suppressHydrationWarning
				/>
			</FloatingComposer>

			<AnimatePresence>
				{onStartFromScratch && isRevealVisible ? (
						<motion.div
							key="start-from-scratch"
							initial={{ opacity: 0, y: -4 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -4 }}
							transition={{ type: "spring", bounce: 0, visualDuration: 0.2 }}
							// Anchored absolutely below the composer so the reveal fades
							// in over the layout instead of reflowing/recentering it.
							className="absolute inset-x-0 top-full flex items-center justify-center pt-2"
							style={{ willChange: "opacity, transform" }}
						>
							<span className="text-xs text-text-subtlest">
								{onBrowseTemplates ? (
									<>
										<button
											type="button"
											onMouseDown={keepComposerFocus}
											onClick={onBrowseTemplates}
											className="rounded-xs transition-colors hover:text-text focus-visible:text-text focus-visible:outline-none"
										>
											Browse{" "}
											<span className="relative">
												templates
												{/* Decorative rainbow-traced template sweep. */}
												{showTemplateSweep ? (
													<span
														aria-hidden
														className="pointer-events-none absolute top-full left-1/2 w-11 -translate-x-1/2 pt-px"
													>
														<SvgTracing
															shape={SVG_TRACE_TEMPLATES_LOOP_PRESET}
															config={TEMPLATES_SWEEP_CONFIG}
															resetKey={templateSweepReplayKey}
															svgClassName="h-2.5 w-full"
														/>
													</span>
												) : null}
											</span>
										</button>
										{" or "}
									</>
								) : (
									"Or "
								)}
								<button
									type="button"
									onMouseDown={keepComposerFocus}
									onClick={onStartFromScratch}
									className="rounded-xs transition-colors hover:text-text focus-visible:text-text focus-visible:outline-none"
								>
									start from{" "}
									<span className="relative">
										scratch
										{/* Decorative rainbow-traced doodle. */}
										{showScratchScribble ? (
											<span
												aria-hidden
												className="pointer-events-none absolute top-full left-1/2 w-6 -translate-x-1/2 pt-px"
											>
												<SvgTracing
													shape={SVG_TRACE_SCRATCH_UNDERLINE_PRESET}
													config={SCRATCH_SCRIBBLE_CONFIG}
													resetKey={scratchScribbleReplayKey}
													svgClassName="h-2.5 w-full"
												/>
											</span>
										) : null}
									</span>
								</button>
							</span>
						</motion.div>
				) : null}
			</AnimatePresence>
		</div>
	);
}
