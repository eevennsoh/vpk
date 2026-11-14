"use client";

import { preloadMessageMarkdownForReply } from "@/components/projects/rovo-core/hooks/use-preload-message-markdown";
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import type { ChatStatus } from "ai";
import { AnimatePresence, motion } from "motion/react";
import type { QueuedPromptItem } from "@/app/contexts";
import CustomizeMenu from "@/components/projects/shared/components/chat-configuration/customize-menu";
import { DEFAULT_REASONING_OPTION_ID } from "@/components/projects/shared/components/chat-configuration/customize-menu-data";
import {
	PromptInput,
	PromptInputActionMenu,
	PromptInputActionMenuContent,
	PromptInputActionMenuTrigger,
	PromptInputBody,
	PromptInputFooter,
	PromptInputHeader,
	PromptInputPreferencesButton,
	PromptInputTextarea,
	PromptInputTools,
	type PromptInputMessage,
	usePromptInputAttachments,
} from "@/components/ui-custom/prompt-input";
import type { ComposerDirectoryAutocompleteController, RichTextMentionItem, RichTextMentionSources } from "@/components/ui-custom/rich-text-editor";
import type { DirectoryAutocompleteState } from "@/lib/directory-autocomplete";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { dropdownStyles } from "@/components/ui/dropdown-menu";
import { composerPromptInputClassName, composerTextareaClassName, composerUpwardShadow, textareaCSS } from "@/components/projects/shared/components/rovo-composer-styles";
import { Queue, QueueItem, QueueItemActions, QueueItemContent, QueueItemIndicator, QueueList } from "@/components/ui-custom/queue";
import { Button } from "@/components/ui/button";
import DeleteIcon from "@atlaskit/icon/core/delete";
import { Footer } from "@/components/ui-custom/footer";
import ChatContextBar from "@/components/projects/shared/components/chat-context-bar";
import type { ChatContextBarDescriptor } from "@/components/projects/shared/lib/chat-context-bar";
import AddIcon from "@atlaskit/icon/core/add";
import { PendingAttachments } from "@/components/projects/shared/components/pending-attachments";
import { RovoAppComposerAddMenu } from "@/components/projects/shared/components/rovo-app-composer-add-menu";
import { RovoComposerSendControls, type RovoComposerDictationState } from "@/components/projects/shared/components/rovo-composer-send-controls";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ChatComposerProps {
	prompt: string;
	isStreaming: boolean;
	hasInFlightTurn: boolean;
	queuedPrompts: ReadonlyArray<QueuedPromptItem>;
	addMenuItemsBefore?: ReactNode;
	/** Optional host-owned controls rendered immediately after the Add menu trigger. */
	composerToolsAfterAdd?: ReactNode;
	hideAiCursor?: boolean;
	hideAiDisclaimer?: boolean;
	hideSourceAndModelControls?: boolean;
	liveVoiceEnabled?: boolean;
	micStream?: MediaStream | null;
	dictationState?: RovoComposerDictationState;
	dictationTranscriptPreview?: string | null;
	focusRequestKey?: number;
	autoFocus?: boolean;
	clickyActive?: boolean;
	onPromptChange: (value: string) => void;
	onStartDictation?: () => void;
	onStopDictation?: () => void;
	onSubmit: (message: PromptInputMessage) => Promise<void> | void;
	onStop: () => void;
	onToggleClicky?: () => void;
	onToggleRealtimeVoice?: () => void;
	onRemoveQueuedPrompt: (id: string) => void;
	onReasoningChange?: (value: string) => void;
	realtimeVoiceActive?: boolean;
	realtimeVoiceState?: "idle" | "connecting" | "listening" | "speaking";
	screenAssistantTargetPrefix?: string;
	selectedReasoning?: string;
	containerClassName?: string;
	chatContextBar?: ChatContextBarDescriptor | null;
	composerContextBar?: ReactNode;
	composerSurfaceHeader?: ReactNode;
	composerSurfaceHeaderTooltip?: ReactNode;
	composerInputContext?: ReactNode;
	hasComposerInputContext?: boolean;
	directoryAutocompleteListVisible?: boolean;
	prefillMentionRequest?: { mention: RichTextMentionItem; requestKey: number };
	onPrefillMentionConsumed?: (requestKey: number) => void;
	/** Composer placeholder. Defaults to the standard sidebar-chat prompt. */
	placeholder?: string;
	/**
	 * Optional mention sources for the rich-text editor's `/` and `@` menus.
	 * Merged with the static catalog by the editor; used to surface runtime
	 * skills (e.g. the create-skill demo). Defaults to the static catalog.
	 */
	mentionSources?: RichTextMentionSources;
	onContextBarOpenChange?: (open: boolean) => void;
	onDirectoryAutocompleteChange?: (state: DirectoryAutocompleteState | null) => void;
	onDirectoryAutocompleteControllerChange?: (controller: ComposerDirectoryAutocompleteController | null) => void;
}

interface ChatComposerSendControlsProps {
	companyKnowledgeEnabled: boolean;
	composerStatus: ChatStatus;
	dictationState: RovoComposerDictationState;
	dictationTranscriptPreview?: string | null;
	hideReasoningSelector?: boolean;
	isComposerBusy: boolean;
	liveVoiceEnabled: boolean;
	clickyActive: boolean;
	micStream: MediaStream | null;
	onCompanyKnowledgeChange: (value: boolean) => void;
	onOpenChange: (open: boolean) => void;
	onReasoningChange: (value: string) => void;
	onStop: () => void;
	onStartDictation?: () => void;
	onStopDictation?: () => void;
	onToggleClicky?: () => void;
	onToggleRealtimeVoice?: () => void;
	open: boolean;
	prompt: string;
	hasComposerInputContext: boolean;
	realtimeVoiceActive: boolean;
	realtimeVoiceState: "idle" | "connecting" | "listening" | "speaking";
	screenAssistantTargetPrefix?: string;
	selectedReasoning: string;
	webResultsEnabled: boolean;
	onWebResultsChange: (value: boolean) => void;
}

function getQueuedPromptLabel(queuedPrompt: QueuedPromptItem): string {
	return queuedPrompt.text || queuedPrompt.files[0]?.filename || "Attachment";
}

function withComposerSurfaceHeaderTooltip(
	surface: ReactElement,
	content?: ReactNode,
): ReactElement {
	if (!content) {
		return surface;
	}

	return (
		<Tooltip>
			<TooltipTrigger render={surface} />
			<TooltipContent side="left">{content}</TooltipContent>
		</Tooltip>
	);
}

function ChatComposerSendControls({
	companyKnowledgeEnabled,
	composerStatus,
	dictationState,
	dictationTranscriptPreview = null,
	hideReasoningSelector = false,
	isComposerBusy,
	liveVoiceEnabled,
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
	prompt,
	hasComposerInputContext,
	realtimeVoiceActive,
	realtimeVoiceState,
	screenAssistantTargetPrefix,
	selectedReasoning,
	webResultsEnabled,
	onWebResultsChange,
}: Readonly<ChatComposerSendControlsProps>) {
	const attachments = usePromptInputAttachments();
	const canSubmit = prompt.trim().length > 0 || attachments.files.length > 0 || hasComposerInputContext;

	return (
		<RovoComposerSendControls
			canSubmit={canSubmit}
			companyKnowledgeEnabled={companyKnowledgeEnabled}
			composerStatus={composerStatus}
			dictationState={dictationState}
			dictationTranscriptPreview={dictationTranscriptPreview}
			hideReasoningSelector={hideReasoningSelector}
			isComposerBusy={isComposerBusy}
			liveVoiceEnabled={liveVoiceEnabled}
			clickyActive={clickyActive}
			micStream={micStream}
			onCompanyKnowledgeChange={onCompanyKnowledgeChange}
			onOpenChange={onOpenChange}
			onReasoningChange={onReasoningChange}
			onStop={onStop}
			onStartDictation={onStartDictation}
			onStopDictation={onStopDictation}
			onToggleClicky={onToggleClicky}
			onToggleRealtimeVoice={onToggleRealtimeVoice}
			open={open}
			realtimeVoiceActive={realtimeVoiceActive}
			realtimeVoiceState={realtimeVoiceState}
			screenAssistantTargetPrefix={screenAssistantTargetPrefix}
			selectedReasoning={selectedReasoning}
			showSubmitWhenEmpty={!liveVoiceEnabled}
			webResultsEnabled={webResultsEnabled}
			onWebResultsChange={onWebResultsChange}
		/>
	);
}

export default function ChatComposer({ prompt, isStreaming, hasInFlightTurn, queuedPrompts, addMenuItemsBefore, composerToolsAfterAdd, hideAiCursor = false, hideAiDisclaimer = false, hideSourceAndModelControls = false, liveVoiceEnabled = false, micStream = null, dictationState = "idle", dictationTranscriptPreview = null, focusRequestKey, autoFocus = false, clickyActive = false, onPromptChange, onStartDictation, onStopDictation, onSubmit, onStop, onToggleClicky, onToggleRealtimeVoice, onRemoveQueuedPrompt, onReasoningChange, realtimeVoiceActive = false, realtimeVoiceState = "idle", screenAssistantTargetPrefix, selectedReasoning: controlledSelectedReasoning, containerClassName, chatContextBar, composerContextBar, composerSurfaceHeader, composerSurfaceHeaderTooltip, composerInputContext, hasComposerInputContext = false, directoryAutocompleteListVisible = false, prefillMentionRequest, onPrefillMentionConsumed, placeholder = "Ask, @mention, or / for skills", mentionSources, onContextBarOpenChange, onDirectoryAutocompleteChange, onDirectoryAutocompleteControllerChange }: Readonly<ChatComposerProps>): React.ReactElement {
	const [localSelectedReasoning, setLocalSelectedReasoning] = useState(DEFAULT_REASONING_OPTION_ID);
	const [webResultsEnabled, setWebResultsEnabled] = useState(false);
	const [companyKnowledgeEnabled, setCompanyKnowledgeEnabled] = useState(true);
	const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
	const [isCustomizeMenuOpen, setIsCustomizeMenuOpen] = useState(false);
	const [isAutoMenuOpen, setIsAutoMenuOpen] = useState(false);
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);
	if (hideSourceAndModelControls && (isCustomizeMenuOpen || isAutoMenuOpen)) {
		setIsCustomizeMenuOpen(false);
		setIsAutoMenuOpen(false);
	}
	const selectedReasoning = controlledSelectedReasoning ?? localSelectedReasoning;
	const hasQueuedPrompts = queuedPrompts.length > 0;
	const submitStatus = isStreaming
		? "streaming"
		: hasInFlightTurn
			? "submitted"
			: "ready";
	const isComposerBusy = isStreaming || hasInFlightTurn;
	const handleCustomizeMenuOpenChange = (open: boolean) => {
		setIsCustomizeMenuOpen(open);
		if (open) {
			setIsAutoMenuOpen(false);
		}
	};
	const handleAutoMenuOpenChange = (open: boolean) => {
		setIsAutoMenuOpen(open);
		if (open) {
			setIsCustomizeMenuOpen(false);
		}
	};
	const handleReasoningChange = (value: string) => {
		setLocalSelectedReasoning(value);
		onReasoningChange?.(value);
	};

	useEffect(() => {
		if (typeof focusRequestKey !== "number" || focusRequestKey <= 0) {
			return;
		}

		requestAnimationFrame(() => {
			textareaRef.current?.focus();
		});
	}, [focusRequestKey]);

	return (
		<div className={cn("relative min-w-0 px-3", containerClassName)}>
			{composerContextBar}
			<ChatContextBar key={chatContextBar?.signature} context={chatContextBar} onOpenChange={onContextBarOpenChange} />
			{hasQueuedPrompts ? (
				<div className="pointer-events-none absolute bottom-full left-4 right-4 z-0">
					<Queue className="pointer-events-auto rounded-b-none border-border border-b-0 bg-surface-raised px-2 pt-2 pb-2 shadow-none">
						<QueueList className="mt-0 mb-0 w-full [&_[data-slot=scroll-area-viewport]>div]:max-h-28 [&_[data-slot=scroll-area-viewport]>div]:pr-0 [&_ul]:w-full">
							{queuedPrompts.map((queuedPrompt) => (
								<QueueItem key={queuedPrompt.id} className="w-full bg-surface py-2 hover:bg-surface-hovered">
									<div className="flex items-center gap-2">
										<QueueItemIndicator />
										<QueueItemContent className="text-text-subtle">{getQueuedPromptLabel(queuedPrompt)}</QueueItemContent>
										<QueueItemActions>
											<Button
												aria-label="Remove queued message"
												onClick={() => onRemoveQueuedPrompt(queuedPrompt.id)}
												size="icon"
												variant="ghost"
												className="size-6 rounded-full text-icon-subtle opacity-0 transition-opacity group-hover:opacity-100"
											>
												<DeleteIcon label="" size="small" />
											</Button>
										</QueueItemActions>
									</div>
								</QueueItem>
							))}
						</QueueList>
					</Queue>
				</div>
			) : null}
			{composerSurfaceHeader ? (
				withComposerSurfaceHeaderTooltip((
					<div className="relative z-10 mx-auto flex min-h-10 w-full max-w-[800px] items-center gap-1.5 rounded-t-xl border border-b-0 border-border bg-bg-neutral px-3 py-2 text-sm font-medium text-text-subtle">
						{composerSurfaceHeader}
					</div>
				), composerSurfaceHeaderTooltip)
			) : null}
			<div
				className={cn(
					"chat-composer-surface relative z-10 mx-auto w-full max-w-[800px] border border-border bg-surface px-3 pb-3 pt-4",
					composerSurfaceHeader ? "rounded-b-xl border-t-0" : "rounded-xl",
				)}
				style={{ boxShadow: composerUpwardShadow }}
			>
				<PromptInput
					allowOverflow
					data-screen-assistant-target={screenAssistantTargetPrefix}
					onSubmit={onSubmit}
					className={`${composerPromptInputClassName} relative z-10`}
				>
					<PendingAttachments />
					{hasComposerInputContext ? (
						<PromptInputHeader className="px-2 pb-3 pt-0">
							{composerInputContext}
						</PromptInputHeader>
					) : null}
					<PromptInputBody>
						<PromptInputTextarea
							ref={textareaRef}
							value={prompt}
							autoFocus={autoFocus}
							directoryAutocompleteListVisible={directoryAutocompleteListVisible}
							enableVisualTraceAutoTagging
							mentionSources={mentionSources}
							onPrefillMentionConsumed={onPrefillMentionConsumed}
							prefillMentionRequest={prefillMentionRequest}
							onChange={(event) => {
								if (event.currentTarget.value) {
									preloadMessageMarkdownForReply();
								}
								onPromptChange(event.currentTarget.value);
							}}
							onDirectoryAutocompleteChange={onDirectoryAutocompleteChange}
							onDirectoryAutocompleteControllerChange={onDirectoryAutocompleteControllerChange}
							placeholder={placeholder}
							aria-label="Chat message input"
							rows={1}
							className={composerTextareaClassName}
						/>
					</PromptInputBody>

					<PromptInputFooter className="mt-3 justify-between px-0 pb-0 pt-0">
						<PromptInputTools>
							<PromptInputActionMenu open={isAddMenuOpen} onOpenChange={setIsAddMenuOpen}>
								<PromptInputActionMenuTrigger aria-label="Add" size="icon-sm" variant="ghost">
									<AddIcon label="" />
								</PromptInputActionMenuTrigger>
								<PromptInputActionMenuContent
									positionerClassName="z-[600]"
									side="top"
									sideOffset={8}
								>
									<RovoAppComposerAddMenu
										itemsBefore={addMenuItemsBefore}
										onClose={() => setIsAddMenuOpen(false)}
									/>
								</PromptInputActionMenuContent>
							</PromptInputActionMenu>
							{composerToolsAfterAdd}

							<AnimatePresence initial={false} mode="popLayout">
								{hideSourceAndModelControls ? null : (
									<motion.div
										key="sources-selector"
										initial={{ opacity: 0, transform: "scale(0.8)" }}
										animate={{ opacity: 1, transform: "scale(1)" }}
										exit={{ opacity: 0, transform: "scale(0.8)" }}
										transition={{ type: "spring", bounce: 0, visualDuration: 0.15 }}
										style={{ willChange: "transform, opacity" }}
									>
										<Popover open={isCustomizeMenuOpen} onOpenChange={handleCustomizeMenuOpenChange}>
											<PopoverTrigger render={<PromptInputPreferencesButton aria-label="Customize" />} />
											<PopoverContent side="top" align="start" sideOffset={8} positionerClassName="z-[600]" className={cn(dropdownStyles.surface, dropdownStyles.padding, "w-auto")}>
												<PopoverTitle className="sr-only">Customize sources</PopoverTitle>
												<CustomizeMenu
													selectedReasoning={selectedReasoning}
													onReasoningChange={handleReasoningChange}
													showReasoning={false}
													webResultsEnabled={webResultsEnabled}
													onWebResultsChange={setWebResultsEnabled}
													companyKnowledgeEnabled={companyKnowledgeEnabled}
													onCompanyKnowledgeChange={setCompanyKnowledgeEnabled}
													onClose={() => setIsCustomizeMenuOpen(false)}
												/>
											</PopoverContent>
										</Popover>
									</motion.div>
								)}
							</AnimatePresence>
						</PromptInputTools>

						<ChatComposerSendControls
							companyKnowledgeEnabled={companyKnowledgeEnabled}
							composerStatus={submitStatus}
							dictationState={dictationState}
							dictationTranscriptPreview={dictationTranscriptPreview}
							hideReasoningSelector={hideSourceAndModelControls}
							isComposerBusy={isComposerBusy}
							liveVoiceEnabled={liveVoiceEnabled}
							clickyActive={!hideAiCursor && clickyActive}
							micStream={micStream}
							onCompanyKnowledgeChange={setCompanyKnowledgeEnabled}
							onOpenChange={handleAutoMenuOpenChange}
							onReasoningChange={handleReasoningChange}
							onStop={onStop}
							onStartDictation={onStartDictation}
							onStopDictation={onStopDictation}
							onToggleClicky={hideAiCursor ? undefined : onToggleClicky}
							onToggleRealtimeVoice={onToggleRealtimeVoice}
							open={isAutoMenuOpen}
							prompt={prompt}
							hasComposerInputContext={hasComposerInputContext}
							realtimeVoiceActive={realtimeVoiceActive}
							realtimeVoiceState={realtimeVoiceState}
							screenAssistantTargetPrefix={screenAssistantTargetPrefix}
							selectedReasoning={selectedReasoning}
							webResultsEnabled={webResultsEnabled}
							onWebResultsChange={setWebResultsEnabled}
						/>
					</PromptInputFooter>
				</PromptInput>
			</div>

			<style>{textareaCSS}</style>

			{hideAiDisclaimer ? null : <Footer />}
		</div>
	);
}
