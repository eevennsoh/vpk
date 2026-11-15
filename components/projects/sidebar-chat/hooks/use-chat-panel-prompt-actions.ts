import { useCallback } from "react";
import type { FileUIPart } from "ai";
import type { SendPromptOptions } from "@/app/contexts";
import { buildGenerativeWidgetSubmitPrompt, type GenerativeWidgetPrimaryActionPayload } from "@/components/projects/shared/lib/generative-widget";
import type { ComposerDirectoryAutocompleteController } from "@/components/ui-custom/rich-text-editor";
import { mergeRovoContextDescriptions } from "@/lib/rovo-context";
import type { RovoSuggestion } from "@/lib/rovo-suggestions";
import type { RovoDataParts } from "@/lib/rovo-ui-messages";
import { isLocalConversationSubmitHandled } from "../lib/chat-panel-local-conversation";
import type { ChatPanelLocalConversation, ChatPanelLocalConversationSubmitResult, ComposerInputContext, RovoChat } from "../lib/chat-panel-types";
import type { useChatSubmit } from "./use-chat-submit";

type ChatSubmit = ReturnType<typeof useChatSubmit>;

interface UseChatPanelPromptActionsOptions {
	composerInputContext?: ComposerInputContext;
	directoryAutocompleteController: ComposerDirectoryAutocompleteController | null;
	handleSubmit: ChatSubmit["handleSubmit"];
	interceptSubmit: ChatSubmit["interceptSubmit"];
	localConversation: ChatPanelLocalConversation | null;
	prompt: string;
	resolvedSendPromptOptions: SendPromptOptions | undefined;
	selectAgent: RovoChat["selectAgent"];
	selectableAgents: RovoChat["selectableAgents"];
	sendPrompt: RovoChat["sendPrompt"];
	setPrompt: ChatSubmit["setPrompt"];
	speakLocalConversationVoiceText: (result: ChatPanelLocalConversationSubmitResult) => void;
	submitPrompt: ChatSubmit["submitPrompt"];
}

/**
 * Every way a user sends something from the chat panel without voice: the
 * composer, greeting starters, follow-up chips, widget actions, directory
 * autocomplete rows, and generated agent cards.
 */
export function useChatPanelPromptActions({
	composerInputContext,
	directoryAutocompleteController,
	handleSubmit,
	interceptSubmit,
	localConversation,
	prompt,
	resolvedSendPromptOptions,
	selectAgent,
	selectableAgents,
	sendPrompt,
	setPrompt,
	speakLocalConversationVoiceText,
	submitPrompt,
}: Readonly<UseChatPanelPromptActionsOptions>) {
	const handleComposerSubmit = useCallback(async ({ files, text }: { text: string; files: FileUIPart[] }) => {
		const promptText = (text || prompt).trim() || composerInputContext?.submitText.trim() || "";
		if (!promptText && files.length === 0) {
			return;
		}
		composerInputContext?.onSubmitStart?.();

		if (!localConversation) {
			await handleSubmit({ files, text: promptText });
			composerInputContext?.onSubmitted?.();
			return;
		}

		const result = await localConversation.onSubmit(promptText);
		if (!isLocalConversationSubmitHandled(result)) {
			await handleSubmit({ files, text: promptText });
			composerInputContext?.onSubmitted?.();
			return;
		}

		setPrompt("");
		speakLocalConversationVoiceText(result);
		composerInputContext?.onSubmitted?.();
	}, [composerInputContext, handleSubmit, prompt, localConversation, setPrompt, speakLocalConversationVoiceText]);

	const handleFollowUpSuggestionClick = useCallback((question: string) => void submitPrompt(question), [submitPrompt]);

	const handleGreetingSuggestionClick = useCallback(
		(suggestion: RovoSuggestion) => {
			const promptText = suggestion.prompt ?? suggestion.label;
			const hasSeparatePrompt = suggestion.prompt && suggestion.prompt !== suggestion.label;

			void (async () => {
				// Route build-intent greeting chips through the deterministic
				// interceptor first so they get the local reply instead of the
				// real model; fall back to the normal send for everything else.
				if (await interceptSubmit(promptText)) {
					return;
				}

				void sendPrompt(promptText, {
					...resolvedSendPromptOptions,
					contextDescription: mergeRovoContextDescriptions(
						resolvedSendPromptOptions?.contextDescription,
						suggestion.contextDescription,
					),
					messageMetadata: {
						...resolvedSendPromptOptions?.messageMetadata,
						...(hasSeparatePrompt ? { displayLabel: suggestion.label } : {}),
					},
				});
			})();
		},
		[interceptSubmit, resolvedSendPromptOptions, sendPrompt],
	);
	const handleDirectoryAutocompleteSelect = useCallback((index: number) => {
		directoryAutocompleteController?.acceptIndex(index);
	}, [directoryAutocompleteController]);

	const handleWidgetPrimaryAction = useCallback(
		(payload: GenerativeWidgetPrimaryActionPayload) => {
			void submitPrompt(buildGenerativeWidgetSubmitPrompt(payload));
		},
		[submitPrompt],
	);
	const handleAgentResultSelect = useCallback((agent: RovoDataParts["agent-result"]) => {
		if (selectableAgents.some((selectableAgent) => selectableAgent.id === agent.agentId)) {
			selectAgent(agent.agentId);
		}
	}, [selectAgent, selectableAgents]);

	return {
		handleAgentResultSelect,
		handleComposerSubmit,
		handleDirectoryAutocompleteSelect,
		handleFollowUpSuggestionClick,
		handleGreetingSuggestionClick,
		handleWidgetPrimaryAction,
	};
}
