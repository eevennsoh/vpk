"use client";

import type { FileUIPart, SourceDocumentUIPart } from "ai";
import type { RefObject } from "react";
import { createContext, use } from "react";
import type { PromptInputAttachmentStore } from "@/lib/prompt-input-attachments";

// Sibling modules in prompt-input/ share these contexts and optional hooks.
// Only names re-exported from ./index.ts are public; import from
// "@/components/ui-custom/prompt-input", never from this file directly.

export interface AttachmentsContext {
  files: (FileUIPart & { id: string })[];
  add: (files: File[] | FileList) => void;
  remove: (id: string) => void;
  clear: () => void;
  openFileDialog: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
}

export interface TextInputContext {
  value: string;
  setInput: (v: string) => void;
  clear: () => void;
}

export interface PromptInputControllerProps {
  textInput: TextInputContext;
  attachments: AttachmentsContext;
  /** INTERNAL: Allows PromptInput to register its file textInput + "open" callback */
  __registerFileInput: (
    ref: RefObject<HTMLInputElement | null>,
    open: () => void
  ) => void;
}

export const PromptInputController = createContext<PromptInputControllerProps | null>(
  null
);
export const ProviderAttachmentsContext = createContext<AttachmentsContext | null>(
  null
);

export const ProviderAttachmentStoreContext = createContext<PromptInputAttachmentStore | null>(null);

export const usePromptInputController = () => {
  const ctx = use(PromptInputController);
  if (!ctx) {
    throw new Error(
      "Wrap your component inside <PromptInputProvider> to use usePromptInputController()."
    );
  }
  return ctx;
};

// Optional variants (do NOT throw). Useful for dual-mode components.
export const useOptionalPromptInputController = () =>
  use(PromptInputController);

export const useProviderAttachments = () => {
  const ctx = use(ProviderAttachmentsContext);
  if (!ctx) {
    throw new Error(
      "Wrap your component inside <PromptInputProvider> to use useProviderAttachments()."
    );
  }
  return ctx;
};

export const useOptionalProviderAttachments = () =>
  use(ProviderAttachmentsContext);

export const LocalAttachmentsContext = createContext<AttachmentsContext | null>(null);

export const usePromptInputAttachments = () => {
  // Prefer local context (inside PromptInput) as it has validation, fall back to provider
  const provider = useOptionalProviderAttachments();
  const local = use(LocalAttachmentsContext);
  const context = local ?? provider;
  if (!context) {
    throw new Error(
      "usePromptInputAttachments must be used within a PromptInput or PromptInputProvider"
    );
  }
  return context;
};

// ============================================================================
// Referenced Sources (Local to PromptInput)
// ============================================================================

export interface ReferencedSourcesContext {
  sources: (SourceDocumentUIPart & { id: string })[];
  add: (sources: SourceDocumentUIPart[] | SourceDocumentUIPart) => void;
  remove: (id: string) => void;
  clear: () => void;
}

// react-doctor-disable-next-line react-doctor/only-export-components -- This context module intentionally exports the provider, hook, and context contract together.
export const LocalReferencedSourcesContext =
  createContext<ReferencedSourcesContext | null>(null);

export const usePromptInputReferencedSources = () => {
  const ctx = use(LocalReferencedSourcesContext);
  if (!ctx) {
    throw new Error(
      "usePromptInputReferencedSources must be used within a LocalReferencedSourcesContext.Provider"
    );
  }
  return ctx;
};
