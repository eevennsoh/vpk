// Public entry for `@/components/ui-custom/prompt-input`. The composer is split
// into cohesive modules; the tiptap editor surface lives alone in
// `prompt-input-textarea.tsx` so it can be lazy-loaded later.
export {
	PromptInputDictationControl,
	type PromptInputDictationControlProps,
	type PromptInputDictationControlSize,
	type PromptInputDictationState,
} from "@/components/ui-custom/prompt-input-dictation";
export {
	PromptInputButton,
	type PromptInputButtonProps,
	type PromptInputButtonTooltip,
} from "@/components/ui-custom/prompt-input-button";
export {
	LocalReferencedSourcesContext,
	usePromptInputAttachments,
	usePromptInputController,
	usePromptInputReferencedSources,
	useProviderAttachments,
	type AttachmentsContext,
	type PromptInputControllerProps,
	type ReferencedSourcesContext,
	type TextInputContext,
} from "@/components/ui-custom/prompt-input/prompt-input-context";
export {
	PromptInputProvider,
	type PromptInputProviderProps,
} from "@/components/ui-custom/prompt-input/prompt-input-provider";
export {
	PromptInput,
	type PromptInputMessage,
	type PromptInputProps,
} from "@/components/ui-custom/prompt-input/prompt-input-root";
export { PromptInputTextarea } from "@/components/ui-custom/prompt-input/prompt-input-textarea";
export type { PromptInputTextareaProps } from "@/components/ui-custom/prompt-input/prompt-input-textarea-types";
export {
	PromptInputBody,
	PromptInputFooter,
	PromptInputHeader,
	PromptInputTools,
	type PromptInputBodyProps,
	type PromptInputFooterProps,
	type PromptInputHeaderProps,
	type PromptInputToolsProps,
} from "@/components/ui-custom/prompt-input/prompt-input-layout";
export {
	PromptInputActionAddAttachments,
	PromptInputActionAddScreenshot,
	PromptInputActionMenu,
	PromptInputActionMenuContent,
	PromptInputActionMenuItem,
	PromptInputActionMenuTrigger,
	type PromptInputActionAddAttachmentsProps,
	type PromptInputActionAddScreenshotProps,
	type PromptInputActionMenuContentProps,
	type PromptInputActionMenuItemProps,
	type PromptInputActionMenuProps,
	type PromptInputActionMenuTriggerProps,
} from "@/components/ui-custom/prompt-input/prompt-input-actions";
export {
	PromptInputAutoButton,
	PromptInputMicrophone,
	PromptInputPreferencesButton,
	PromptInputSendControls,
	PromptInputSubmit,
	type PromptInputAutoButtonProps,
	type PromptInputMicrophoneProps,
	type PromptInputPreferencesButtonProps,
	type PromptInputSendControlsProps,
	type PromptInputSubmitProps,
} from "@/components/ui-custom/prompt-input/prompt-input-controls";
export {
	PromptInputSelect,
	PromptInputSelectContent,
	PromptInputSelectItem,
	PromptInputSelectTrigger,
	PromptInputSelectValue,
	type PromptInputSelectContentProps,
	type PromptInputSelectItemProps,
	type PromptInputSelectProps,
	type PromptInputSelectTriggerProps,
	type PromptInputSelectValueProps,
} from "@/components/ui-custom/prompt-input/prompt-input-select";
export {
	PromptInputHoverCard,
	PromptInputHoverCardContent,
	PromptInputHoverCardTrigger,
	type PromptInputHoverCardContentProps,
	type PromptInputHoverCardProps,
	type PromptInputHoverCardTriggerProps,
} from "@/components/ui-custom/prompt-input/prompt-input-hover-card";
export {
	PromptInputTab,
	PromptInputTabBody,
	PromptInputTabItem,
	PromptInputTabLabel,
	PromptInputTabsList,
	type PromptInputTabBodyProps,
	type PromptInputTabItemProps,
	type PromptInputTabLabelProps,
	type PromptInputTabProps,
	type PromptInputTabsListProps,
} from "@/components/ui-custom/prompt-input/prompt-input-tabs";
export {
	PromptInputCommand,
	PromptInputCommandEmpty,
	PromptInputCommandGroup,
	PromptInputCommandInput,
	PromptInputCommandItem,
	PromptInputCommandList,
	PromptInputCommandSeparator,
	type PromptInputCommandEmptyProps,
	type PromptInputCommandGroupProps,
	type PromptInputCommandInputProps,
	type PromptInputCommandItemProps,
	type PromptInputCommandListProps,
	type PromptInputCommandProps,
	type PromptInputCommandSeparatorProps,
} from "@/components/ui-custom/prompt-input/prompt-input-command";
