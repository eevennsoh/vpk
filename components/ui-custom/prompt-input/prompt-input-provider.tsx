"use client";

import type { PropsWithChildren, RefObject } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { usePromptInputAttachmentStore } from "@/components/ui-custom/use-prompt-input-attachment-store";
import {
  PromptInputController,
  ProviderAttachmentStoreContext,
  ProviderAttachmentsContext,
  type AttachmentsContext,
  type PromptInputControllerProps,
} from "@/components/ui-custom/prompt-input/prompt-input-context";

export type PromptInputProviderProps = PropsWithChildren<{
  initialInput?: string;
  onInputChange?: (value: string) => void;
}>;

/**
 * Optional global provider that lifts PromptInput state outside of PromptInput.
 * If you don't use it, PromptInput stays fully self-managed.
 */
export const PromptInputProvider = ({
  initialInput: initialTextInput = "",
  onInputChange,
  children,
}: PromptInputProviderProps) => {
  // ----- textInput state
  const [textInput, setTextInput] = useState(initialTextInput);
  const updateTextInput = useCallback((value: string) => {
    setTextInput(value);
    onInputChange?.(value);
  }, [onInputChange]);
  const clearInput = useCallback(() => updateTextInput(""), [updateTextInput]);

	const { files: attachmentFiles, store: attachmentStore } = usePromptInputAttachmentStore();
	const { add, remove, clear } = attachmentStore;
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	// oxlint-disable-next-line eslint(no-empty-function)
	const openRef = useRef<() => void>(() => {});

  const openFileDialog = useCallback(() => {
    openRef.current?.();
  }, []);

  const attachments = useMemo<AttachmentsContext>(
    () => ({
      add,
      clear,
      fileInputRef,
      files: attachmentFiles,
      openFileDialog,
      remove,
    }),
    [attachmentFiles, add, remove, clear, openFileDialog]
  );

  const __registerFileInput = useCallback(
    (ref: RefObject<HTMLInputElement | null>, open: () => void) => {
      fileInputRef.current = ref.current;
      openRef.current = open;
    },
    []
  );

  const controller = useMemo<PromptInputControllerProps>(
    () => ({
      __registerFileInput,
      attachments,
      textInput: {
        clear: clearInput,
        setInput: updateTextInput,
        value: textInput,
      },
    }),
    [textInput, clearInput, updateTextInput, attachments, __registerFileInput]
  );

	return (
		<ProviderAttachmentStoreContext value={attachmentStore}>
			<PromptInputController value={controller}>
				<ProviderAttachmentsContext value={attachments}>
					{children}
				</ProviderAttachmentsContext>
			</PromptInputController>
		</ProviderAttachmentStoreContext>
	);

};
