"use client";

import type { ComponentProps } from "react";
import { ClarificationQuestionCard } from "@/components/projects/shared/components/clarification-question-card";
import { QuestionCardShortcutsFooter } from "@/components/projects/shared/components/question-card-shortcuts-footer";
import { ApprovalCard } from "@/components/blocks/approval-card/page";
import type { ChatPanelDecisions } from "../hooks/use-chat-panel-decisions";
import type { ChatPanelProps } from "../lib/chat-panel-types";
import ChatComposer from "./chat-composer";
import { ReadOnlySessionComposer } from "./read-only-session-composer";

type ChatComposerProps = ComponentProps<typeof ChatComposer>;

interface ChatPanelComposerAreaProps
	extends Pick<
		ChatPanelProps,
		| "addMenuItemsBefore"
		| "chatContextBar"
		| "composerContainerClassName"
		| "composerContextBar"
		| "composerInputContext"
		| "composerMentionSources"
		| "composerPrefillRequest"
		| "composerSurfaceHeader"
		| "composerSurfaceHeaderTooltip"
		| "composerToolsAfterAdd"
		| "hideAiDisclaimer"
		| "hideComposerSourceAndModelControls"
		| "onComposerPrefillConsumed"
		| "resolveComposerPlaceholder"
		| "readOnly"
		| "readOnlyOwner"
		| "readOnlySessionState"
	> {
	autoFocusComposer: boolean;
	clickyActive: boolean;
	composerFocusRequestKey: number;
	decisions: ChatPanelDecisions;
	dictationState: ChatComposerProps["dictationState"];
	dictationTranscriptPreview: ChatComposerProps["dictationTranscriptPreview"];
	hasInFlightTurn: boolean;
	hideAiCursor: boolean;
	isRealtimeVoiceActive: boolean;
	isStreamingLifecycleActive: boolean;
	micStream: ChatComposerProps["micStream"];
	onComposerSubmit: ChatComposerProps["onSubmit"];
	onContextBarOpenChange: ChatComposerProps["onContextBarOpenChange"];
	onDirectoryAutocompleteChange: ChatComposerProps["onDirectoryAutocompleteChange"];
	onDirectoryAutocompleteControllerChange: ChatComposerProps["onDirectoryAutocompleteControllerChange"];
	onPromptChange: ChatComposerProps["onPromptChange"];
	onReasoningChange: ChatComposerProps["onReasoningChange"];
	onRemoveQueuedPrompt: ChatComposerProps["onRemoveQueuedPrompt"];
	onStartDictation: ChatComposerProps["onStartDictation"];
	onStop: ChatComposerProps["onStop"];
	onStopDictation: ChatComposerProps["onStopDictation"];
	onToggleClicky: ChatComposerProps["onToggleClicky"];
	onToggleRealtimeVoice: ChatComposerProps["onToggleRealtimeVoice"];
	prompt: string;
	queuedPrompts: ChatComposerProps["queuedPrompts"];
	realtimeVoiceState: ChatComposerProps["realtimeVoiceState"];
	selectedReasoning: ChatComposerProps["selectedReasoning"];
	shouldShowDirectoryAutocompleteList: boolean;
}

/** Bottom of the panel: a docked question card, a pending plan approval, or the composer. */
export function ChatPanelComposerArea({
	readOnly = false,
	readOnlyOwner,
	readOnlySessionState,
	addMenuItemsBefore,
	autoFocusComposer,
	chatContextBar,
	clickyActive,
	composerContainerClassName,
	composerContextBar,
	composerFocusRequestKey,
	composerInputContext,
	composerMentionSources,
	composerPrefillRequest,
	composerSurfaceHeader,
	composerSurfaceHeaderTooltip,
	composerToolsAfterAdd,
	decisions,
	dictationState,
	dictationTranscriptPreview,
	hasInFlightTurn,
	hideAiCursor,
	hideAiDisclaimer,
	hideComposerSourceAndModelControls,
	isRealtimeVoiceActive,
	isStreamingLifecycleActive,
	micStream,
	onComposerPrefillConsumed,
	onComposerSubmit: handleComposerSubmit,
	onContextBarOpenChange: setIsContextBarOpen,
	onDirectoryAutocompleteChange: setDirectoryAutocompleteState,
	onDirectoryAutocompleteControllerChange: setDirectoryAutocompleteController,
	onPromptChange: setPrompt,
	onReasoningChange: setSelectedReasoning,
	onRemoveQueuedPrompt: removeQueuedPrompt,
	onStartDictation: handleStartDictation,
	onStop: abort,
	onStopDictation: handleStopDictation,
	onToggleClicky: handleToggleClicky,
	onToggleRealtimeVoice: handleToggleRealtimeVoice,
	prompt,
	queuedPrompts,
	realtimeVoiceState,
	resolveComposerPlaceholder,
	selectedReasoning,
	shouldShowDirectoryAutocompleteList,
}: Readonly<ChatPanelComposerAreaProps>): React.ReactElement {
	const {
		activePendingPlan,
		activeQuestionCard,
		activeQuestionCardKey,
		dismissQuestionCard,
		handleClarificationSubmit,
		handleDismissApprovalCard,
		handlePlanApprovalSubmit,
		hideQuestionCard,
		isSubmittingPlanApproval,
		pendingPlanKey,
		shouldShowApprovalCard,
		shouldShowQuestionCard,
	} = decisions;

	return (
		<div className={readOnly && shouldShowQuestionCard ? "flex min-h-0 min-w-0 shrink flex-col" : "min-w-0 shrink-0"}>
			{shouldShowQuestionCard && activeQuestionCard ? (
				<>
					<div className={readOnly ? "mb-3 min-h-0 shrink overflow-y-auto px-3" : "px-3"} onKeyDownCapture={(event) => {
						if (readOnly && event.key === "Escape" && !(event.target instanceof HTMLInputElement)) {
							event.preventDefault();
							event.stopPropagation();
						}
					}}>
						<ClarificationQuestionCard
							cardClassName="shadow-none"
							key={activeQuestionCardKey ?? undefined}
							questionCard={activeQuestionCard}
							showDismissButton={!readOnly}
							onSubmit={(answers) => {
								handleClarificationSubmit(answers);
								hideQuestionCard();
							}}
							onDismiss={dismissQuestionCard}
						/>
					</div>
					{readOnly ? <ReadOnlySessionComposer hideAiDisclaimer owner={readOnlyOwner} state={readOnlySessionState} /> : null}
					<QuestionCardShortcutsFooter showEscape={!readOnly} />
				</>
			) : shouldShowApprovalCard && activePendingPlan ? (
				<>
					<ApprovalCard
						key={pendingPlanKey ?? undefined}
						onDismiss={handleDismissApprovalCard}
						onSelect={handlePlanApprovalSubmit}
						isSubmitting={isSubmittingPlanApproval}
					/>
					<QuestionCardShortcutsFooter escLabel="cancel" />
				</>
			) : readOnly ? (
				<ReadOnlySessionComposer context={chatContextBar} hideAiDisclaimer={hideAiDisclaimer} onContextBarOpenChange={setIsContextBarOpen} owner={readOnlyOwner} state={readOnlySessionState} />
			) : (
				<>
					<ChatComposer
						prompt={prompt}
						isStreaming={isStreamingLifecycleActive}
						hasInFlightTurn={hasInFlightTurn}
						queuedPrompts={queuedPrompts}
						addMenuItemsBefore={addMenuItemsBefore}
						composerToolsAfterAdd={composerToolsAfterAdd}
						containerClassName={composerContainerClassName}
						hideAiCursor={hideAiCursor}
						hideAiDisclaimer={hideAiDisclaimer}
						hideSourceAndModelControls={hideComposerSourceAndModelControls}
						micStream={micStream}
						dictationState={dictationState}
						dictationTranscriptPreview={dictationTranscriptPreview}
						focusRequestKey={composerFocusRequestKey}
						autoFocus={autoFocusComposer}
						clickyActive={clickyActive}
						onPromptChange={setPrompt}
						onStartDictation={handleStartDictation}
						onStopDictation={handleStopDictation}
						onSubmit={handleComposerSubmit}
						onStop={abort}
						onToggleClicky={handleToggleClicky}
						onToggleRealtimeVoice={handleToggleRealtimeVoice}
						onRemoveQueuedPrompt={removeQueuedPrompt}
						onReasoningChange={setSelectedReasoning}
						onPrefillMentionConsumed={onComposerPrefillConsumed}
						realtimeVoiceActive={isRealtimeVoiceActive}
						realtimeVoiceState={realtimeVoiceState}
						screenAssistantTargetPrefix="sidebar-composer"
						selectedReasoning={selectedReasoning}
						chatContextBar={chatContextBar}
						composerContextBar={composerContextBar}
						composerSurfaceHeader={composerSurfaceHeader}
						composerSurfaceHeaderTooltip={composerSurfaceHeaderTooltip}
						composerInputContext={composerInputContext?.content}
						hasComposerInputContext={composerInputContext !== undefined}
						directoryAutocompleteListVisible={shouldShowDirectoryAutocompleteList}
						prefillMentionRequest={
							composerPrefillRequest?.mention
								? {
										mention: composerPrefillRequest.mention,
										requestKey: composerPrefillRequest.requestKey,
									}
								: undefined
						}
						placeholder={resolveComposerPlaceholder?.(prompt)}
						mentionSources={composerMentionSources}
						onContextBarOpenChange={setIsContextBarOpen}
						onDirectoryAutocompleteChange={setDirectoryAutocompleteState}
						onDirectoryAutocompleteControllerChange={setDirectoryAutocompleteController}
					/>
				</>
			)}
		</div>
	);
}
