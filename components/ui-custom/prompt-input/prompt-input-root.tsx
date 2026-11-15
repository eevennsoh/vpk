"use client";

// oxlint-disable react-doctor/exhaustive-deps -- Effects in this file intentionally coordinate refs, external animation loops, timers, subscriptions, or measured DOM state; dependencies are constrained to avoid restarting those bridges.
// oxlint-disable react-doctor/no-derived-state -- These components maintain local derived display state for controlled animations, measurements, or draft editing that cannot be represented as render-only values without changing UX.

// oxlint-disable react-doctor/no-event-handler -- Effects in this file bridge external systems, animation/media state, timers, or parent-controlled state rather than user event handlers.

import type { FileUIPart, SourceDocumentUIPart } from "ai";
import type {
  ChangeEventHandler,
  FormEvent,
  FormEventHandler,
  HTMLAttributes,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { nanoid } from "nanoid";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InputGroup } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import { usePromptInputAttachmentStore } from "@/components/ui-custom/use-prompt-input-attachment-store";
import {
  LocalAttachmentsContext,
  LocalReferencedSourcesContext,
  ProviderAttachmentStoreContext,
  useOptionalPromptInputController,
  type AttachmentsContext,
  type ReferencedSourcesContext,
} from "@/components/ui-custom/prompt-input/prompt-input-context";
import { convertBlobUrlToDataUrl } from "@/components/ui-custom/prompt-input/prompt-input-helpers";

export interface PromptInputMessage {
  text: string;
  files: FileUIPart[];
}

const promptInputVariants = cva("w-full", {
  variants: {
    variant: {
      default: "",
      floating:
        "rounded-xl border border-border bg-bg-input p-2 shadow-[0px_-2px_50px_8px_rgba(30,31,33,0.08)]",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export type PromptInputProps = Omit<
  HTMLAttributes<HTMLFormElement>,
  "onSubmit" | "onError"
> &
  VariantProps<typeof promptInputVariants> & {
    // e.g., "image/*" or leave undefined for any
    accept?: string;
    multiple?: boolean;
    // When true, accepts drops anywhere on document. Default false (opt-in).
    globalDrop?: boolean;
    // Render a hidden input with given name and keep it in sync for native form posts. Default false.
    syncHiddenInput?: boolean;
    // When true, allows children (e.g. animated pulse rings) to render outside bounds.
    allowOverflow?: boolean;
    // Minimal constraints
    maxFiles?: number;
    // bytes
    maxFileSize?: number;
    onError?: (err: {
      code: "max_files" | "max_file_size" | "accept";
      message: string;
    }) => void;
    onSubmit: (
      message: PromptInputMessage,
      event: FormEvent<HTMLFormElement>
    ) => void | Promise<void>;
  };

export const PromptInput = ({
  className,
  variant,
  accept,
  multiple,
  globalDrop,
  syncHiddenInput,
  allowOverflow = false,
  maxFiles,
  maxFileSize,
  onError,
  onSubmit,
  children,
  ...props
}: Readonly<PromptInputProps>) => {
  // Try to use a provider controller if present
  const controller = useOptionalPromptInputController();
  const usingProvider = !!controller;

  // Refs
  const inputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

	const providedAttachmentStore = use(ProviderAttachmentStoreContext);
	const { files, store: attachmentStore } = usePromptInputAttachmentStore(
		usingProvider ? providedAttachmentStore : null,
	);

  // ----- Local referenced sources (always local to PromptInput)
  const [referencedSources, setReferencedSources] = useState<
    (SourceDocumentUIPart & { id: string })[]
  >([]);

	const openFileDialogLocal = useCallback(() => {
		inputRef.current?.click();
	}, []);

	const add = useCallback((incoming: File[] | FileList) => {
		attachmentStore.add(incoming, { accept, maxFiles, maxFileSize, onError });
	}, [attachmentStore, accept, maxFiles, maxFileSize, onError]);
	const remove = attachmentStore.remove;
	const clearAttachments = attachmentStore.clear;

  const clearReferencedSources = useCallback(
    () => setReferencedSources([]),
    []
  );

  const openFileDialog = usingProvider
    ? controller.attachments.openFileDialog
    : openFileDialogLocal;

  const clear = useCallback(() => {
    clearAttachments();
    clearReferencedSources();
  }, [clearAttachments, clearReferencedSources]);

  // Let provider know about our hidden file input so external menus can call openFileDialog()
  useEffect(() => {
    if (!usingProvider) {
      return;
    }
    controller.__registerFileInput(inputRef, () => inputRef.current?.click());
  }, [usingProvider, controller]);

  // Note: File input cannot be programmatically set for security reasons
  // The syncHiddenInput prop is no longer functional
  useEffect(() => {
    if (syncHiddenInput && inputRef.current && files.length === 0) {
      inputRef.current.value = "";
    }
  }, [files, syncHiddenInput]);

  // Attach drop handlers on nearest form and document (opt-in)
  useEffect(() => {
    const form = formRef.current;
    if (!form) {
      return;
    }
    if (globalDrop) {
      // when global drop is on, let the document-level handler own drops
      return;
    }

    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
      }
    };
    const onDrop = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
      }
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        add(e.dataTransfer.files);
      }
    };
    form.addEventListener("dragover", onDragOver);
    form.addEventListener("drop", onDrop);
    return () => {
      form.removeEventListener("dragover", onDragOver);
      form.removeEventListener("drop", onDrop);
    };
  }, [add, globalDrop]);

  useEffect(() => {
    if (!globalDrop) {
      return;
    }

    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
      }
    };
    const onDrop = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
      }
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        add(e.dataTransfer.files);
      }
    };
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("drop", onDrop);
    };
  }, [add, globalDrop]);

  const handleChange: ChangeEventHandler<HTMLInputElement> = useCallback(
    (event) => {
      if (event.currentTarget.files) {
        add(event.currentTarget.files);
      }
      // Reset input value to allow selecting files that were previously removed
      event.currentTarget.value = "";
    },
    [add]
  );

  const attachmentsCtx = useMemo<AttachmentsContext>(
    () => ({
      add,
      clear: clearAttachments,
      fileInputRef: inputRef,
      files: files.map((item) => ({ ...item, id: item.id })),
      openFileDialog,
      remove,
    }),
    [files, add, remove, clearAttachments, openFileDialog]
  );

  const refsCtx = useMemo<ReferencedSourcesContext>(
    () => ({
      add: (incoming: SourceDocumentUIPart[] | SourceDocumentUIPart) => {
        const array = Array.isArray(incoming) ? incoming : [incoming];
        setReferencedSources((prev) => [
          ...prev,
          ...array.map((s) => ({ ...s, id: nanoid() })),
        ]);
      },
      clear: clearReferencedSources,
      remove: (id: string) => {
        setReferencedSources((prev) => prev.filter((s) => s.id !== id));
      },
      sources: referencedSources,
    }),
    [referencedSources, clearReferencedSources]
  );

  const handleSubmit: FormEventHandler<HTMLFormElement> = useCallback(
    async (event) => {
      event.preventDefault();

      const form = event.currentTarget;
      // Prefer the composer's synced hidden field so a submit-time rich-text
      // flush (e.g. auto-tag conversion) is captured synchronously even when a
      // provider-backed controller state update has not rendered yet.
      const field = form.querySelector<HTMLInputElement>(
        '[data-slot="prompt-input-message"]'
      );
      const text = field
        ? field.value
        : usingProvider
          ? controller.textInput.value
          : (() => {
              const formData = new FormData(form);
              return (formData.get("message") as string) || "";
            })();

      // Reset form immediately after capturing text to avoid race condition
      // where user input during async blob conversion would be lost
      if (!usingProvider) {
        form.reset();
      }

      try {
        // Convert blob URLs to data URLs asynchronously
        const convertedFiles: FileUIPart[] = await Promise.all(
          files.map(async ({ id: _id, ...item }) => {
            if (item.url?.startsWith("blob:")) {
              const dataUrl = await convertBlobUrlToDataUrl(item.url);
              // If conversion failed, keep the original blob URL
              return {
                ...item,
                url: dataUrl ?? item.url,
              };
            }
            return item;
          })
        );

        const result = onSubmit({ files: convertedFiles, text }, event);

        // Handle both sync and async onSubmit
        if (result instanceof Promise) {
          try {
            await result;
            clear();
            if (usingProvider) {
              controller.textInput.clear();
            }
          } catch {
            // Don't clear on error - user may want to retry
          }
        } else {
          // Sync function completed without throwing, clear inputs
          clear();
          if (usingProvider) {
            controller.textInput.clear();
          }
        }
      } catch {
        // Don't clear on error - user may want to retry
      }
    },
    [usingProvider, controller, files, onSubmit, clear]
  );

  // Render with or without local provider
  const inner = (
    <>
      <input
        accept={accept}
        aria-label="Upload files"
        className="hidden"
        multiple={multiple}
        onChange={handleChange}
        ref={inputRef}
        title="Upload files"
        type="file"
      />
      <form
        className={cn(promptInputVariants({ variant }), className)}
        onSubmit={handleSubmit}
        ref={formRef}
        {...props}
        data-prompt-input-root=""
      >
        <InputGroup
          className={cn(
            allowOverflow ? "overflow-visible" : "overflow-hidden",
            "rounded-none border-0 ring-0 has-disabled:opacity-100 has-disabled:bg-transparent has-[[data-slot=input-group-control]:focus-visible]:border-0 has-[[data-slot=input-group-control]:focus-visible]:ring-0"
          )}
        >
          {children}
        </InputGroup>
      </form>
    </>
  );

  const withReferencedSources = (
    <LocalReferencedSourcesContext value={refsCtx}>
      {inner}
    </LocalReferencedSourcesContext>
  );

  // Always provide LocalAttachmentsContext so children get validated add function
  return (
    <LocalAttachmentsContext value={attachmentsCtx}>
      {withReferencedSources}
    </LocalAttachmentsContext>
  );
};
