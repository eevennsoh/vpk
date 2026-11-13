"use client";

import {
	PromptInput,
	PromptInputActionMenu,
	PromptInputActionMenuContent,
	PromptInputActionMenuTrigger,
	PromptInputBody,
	PromptInputFooter,
	PromptInputPreferencesButton,
	PromptInputTextarea,
	PromptInputTools,
} from "@/components/ui-custom/prompt-input";
import { composerPromptInputClassName, composerTextareaClassName, composerUpwardShadow } from "@/components/projects/shared/components/rovo-composer-styles";
import CustomizeMenu from "@/components/projects/shared/components/chat-configuration/customize-menu";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { dropdownStyles } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import AddIcon from "@atlaskit/icon/core/add";
import { useCallback, useEffect, useState } from "react";
import { RovoAppComposerAddMenu } from "@/components/projects/shared/components/rovo-app-composer-add-menu";
import { PendingAttachments } from "@/components/projects/shared/components/pending-attachments";
import { RovoComposerSendControls } from "@/components/projects/shared/components/rovo-composer-send-controls";
import { useRovoAppComposerHeight } from "@/components/projects/shared/hooks/use-rovo-app-composer-height";
import { DEFAULT_REASONING_OPTION_ID } from "@/components/projects/shared/components/chat-configuration/customize-menu-data";
import { type ComposerBodyBaseProps, usePrefillEffect } from "@/components/projects/shared/components/composer-body-shared";

export interface ComposerCardBodyProps extends ComposerBodyBaseProps {
	artifactTitle: string | null | undefined;
	compact: boolean;
	galleryExpanded: boolean;
	hideReasoningSelector: boolean;
	hideSourceAndModelControls: boolean;
	isPlanMode: boolean;
	onTogglePlanMode?: () => void;
	previewPrompt: string | null;
	showSubmitWhenEmpty: boolean;
}

/**
 * Rovo "card" composer body: bordered card with the height-animation system,
 * the Add action-menu, Customize controls, and the full
 * reasoning-aware send controls.
 */
export function ComposerCardBody({
	artifactTitle,
	autoFocus,
	attachmentCount,
	canSubmit,
	clickyActive,
	compact,
	composerStatus,
	directoryAutocompleteListVisible,
	directoryAutocompleteLimit,
	dictationState,
	dictationTranscriptPreview,
	focusRequestKey,
	galleryExpanded,
	hideReasoningSelector,
	hideSourceAndModelControls,
	isPlanMode,
	micStream,
	onDirectoryAutocompleteChange,
	onDirectoryAutocompleteControllerChange,
	onPromptSubmit,
	onStartDictation,
	onStopDictation,
	onStop,
	onTogglePlanMode,
	onToggleClicky,
	onToggleRealtimeVoice,
	placeholder,
	prefillRequestKey,
	prefillText,
	previewPrompt,
	realtimeVoiceActive,
	realtimeVoiceState,
	screenAssistantTargetPrefix,
	showBackgroundStop,
	showSubmitWhenEmpty,
	submitDisabled,
	textValue,
}: Readonly<ComposerCardBodyProps>) {
	const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
	const [isCustomizeMenuOpen, setIsCustomizeMenuOpen] = useState(false);
	const [isAutoMenuOpen, setIsAutoMenuOpen] = useState(false);
	const [selectedReasoning, setSelectedReasoning] = useState(DEFAULT_REASONING_OPTION_ID);
	const [webResultsEnabled, setWebResultsEnabled] = useState(false);
	const [companyKnowledgeEnabled, setCompanyKnowledgeEnabled] = useState(true);

	const isPreviewPlaceholderActive = Boolean(previewPrompt) && textValue.trim().length === 0;
	const isComposerBusy = composerStatus === "submitted" || composerStatus === "streaming";

	const { composerRef, textareaRef, composerHeight } = useRovoAppComposerHeight({
		textValue,
		attachmentCount,
		isPreviewPlaceholderActive,
		galleryExpanded,
		hasArtifactTitle: Boolean(artifactTitle),
		previewPrompt,
	});

	usePrefillEffect(prefillText, prefillRequestKey);

	useEffect(() => {
		if (typeof focusRequestKey !== "number" || focusRequestKey <= 0) {
			return;
		}

		requestAnimationFrame(() => {
			textareaRef.current?.focus();
		});
	}, [focusRequestKey, textareaRef]);

	const handleReasoningChange = useCallback((reasoning: string) => {
		setSelectedReasoning(reasoning);
		const shouldEnablePlanMode = reasoning === "max";

		if (onTogglePlanMode && shouldEnablePlanMode !== isPlanMode) {
			onTogglePlanMode();
		}

		requestAnimationFrame(() => {
			textareaRef.current?.focus();
		});
	}, [isPlanMode, onTogglePlanMode, textareaRef]);
	const handleCustomizeMenuOpenChange = useCallback((open: boolean) => {
		setIsCustomizeMenuOpen(open);
		if (open) {
			setIsAutoMenuOpen(false);
		}
	}, []);
	const handleAutoMenuOpenChange = useCallback((open: boolean) => {
		setIsAutoMenuOpen(open);
		if (open) {
			setIsCustomizeMenuOpen(false);
		}
	}, []);

	const resolvedCustomizeMenuOpen = !hideSourceAndModelControls && isCustomizeMenuOpen;
	const resolvedAutoMenuOpen = !hideSourceAndModelControls && !hideReasoningSelector && isAutoMenuOpen;
	const resolvedSelectedReasoning = isPlanMode
		? "max"
		: selectedReasoning === "max"
			? DEFAULT_REASONING_OPTION_ID
			: selectedReasoning;

	return (
		<div
			ref={composerRef}
			className={cn("relative z-10 rounded-xl border border-border bg-surface p-3", composerHeight ? "flex flex-col" : undefined, compact ? "pb-2 pt-3" : "pt-4")}
			style={{
				boxShadow: composerUpwardShadow,
				...(composerHeight
					? {
							height: `${composerHeight}px`,
							transition: "height var(--duration-normal) var(--ease-out)",
						}
					: {}),
			}}
		>
			<PromptInput
				allowOverflow
				className={cn(composerPromptInputClassName, "relative z-10", composerHeight ? "flex h-full flex-col [&>[data-slot=input-group]]:h-full" : undefined)}
				data-screen-assistant-target={screenAssistantTargetPrefix}
				onSubmit={onPromptSubmit}
			>
				<PendingAttachments />

				<PromptInputBody className={composerHeight ? "flex-1" : undefined}>
					<PromptInputTextarea
						ref={textareaRef}
						autoFocus={autoFocus}
						autoResize={!composerHeight}
						className={cn(composerTextareaClassName, composerHeight ? "h-full max-h-none min-h-0" : undefined)}
						directoryAutocompleteListVisible={directoryAutocompleteListVisible}
						directoryAutocompleteLimit={directoryAutocompleteLimit}
						enableVisualTraceAutoTagging
						onDirectoryAutocompleteChange={onDirectoryAutocompleteChange}
						onDirectoryAutocompleteControllerChange={onDirectoryAutocompleteControllerChange}
						placeholder={placeholder}
						rows={1}
						suppressHydrationWarning
					/>
				</PromptInputBody>

				<PromptInputFooter className="mt-3 justify-between px-0 pb-0 pt-0">
					<PromptInputTools>
						<PromptInputActionMenu open={isAddMenuOpen} onOpenChange={setIsAddMenuOpen}>
							<PromptInputActionMenuTrigger aria-label="Add" size="icon-sm" variant="ghost">
								<AddIcon label="" />
							</PromptInputActionMenuTrigger>
							<PromptInputActionMenuContent>
								<RovoAppComposerAddMenu
									onClose={() => setIsAddMenuOpen(false)}
								/>
							</PromptInputActionMenuContent>
						</PromptInputActionMenu>
						{hideSourceAndModelControls ? null : (
							<Popover open={resolvedCustomizeMenuOpen} onOpenChange={handleCustomizeMenuOpenChange}>
								<PopoverTrigger render={<PromptInputPreferencesButton aria-label="Customize" />} />
								<PopoverContent side="top" align="start" sideOffset={8} positionerClassName="z-[600]" className={cn(dropdownStyles.surface, dropdownStyles.padding, "w-auto")}>
									<PopoverTitle className="sr-only">Customize sources</PopoverTitle>
									<CustomizeMenu
										selectedReasoning={resolvedSelectedReasoning}
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
						)}
					</PromptInputTools>

					<RovoComposerSendControls
						canSubmit={canSubmit}
						className="flex-1"
						companyKnowledgeEnabled={companyKnowledgeEnabled}
						composerStatus={composerStatus}
						dictationState={dictationState}
						dictationTranscriptPreview={dictationTranscriptPreview}
						hideReasoningSelector={hideSourceAndModelControls || hideReasoningSelector}
						isComposerBusy={isComposerBusy}
						clickyActive={clickyActive}
						micStream={micStream}
						onCompanyKnowledgeChange={setCompanyKnowledgeEnabled}
						onOpenChange={handleAutoMenuOpenChange}
						onReasoningChange={handleReasoningChange}
						onStop={onStop}
						onStartDictation={onStartDictation}
						onStopDictation={onStopDictation}
						onToggleClicky={onToggleClicky}
						onToggleRealtimeVoice={onToggleRealtimeVoice}
						open={resolvedAutoMenuOpen}
						realtimeVoiceActive={realtimeVoiceActive}
						realtimeVoiceState={realtimeVoiceState}
						screenAssistantTargetPrefix={screenAssistantTargetPrefix}
						selectedReasoning={resolvedSelectedReasoning}
						showBackgroundStop={showBackgroundStop}
						showSubmitWhenEmpty={showSubmitWhenEmpty}
						submitDisabled={submitDisabled}
						webResultsEnabled={webResultsEnabled}
						onWebResultsChange={setWebResultsEnabled}
					/>
				</PromptInputFooter>
			</PromptInput>
		</div>
	);
}
