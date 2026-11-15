"use client";

// oxlint-disable react-doctor/exhaustive-deps -- Effects in this file intentionally coordinate refs, external animation loops, timers, subscriptions, or measured DOM state; dependencies are constrained to avoid restarting those bridges.
// oxlint-disable react-doctor/no-derived-state -- These components maintain local derived display state for controlled animations, measurements, or draft editing that cannot be represented as render-only values without changing UX.

// oxlint-disable react-doctor/no-event-handler -- Effects in this file bridge external systems, animation/media state, timers, or parent-controlled state rather than user event handlers.

// The tiptap editor surface of PromptInput. This is the only prompt-input
// module that imports @tiptap/react and the rich-text-editor runtime, so it can
// be lazy-loaded independently of the rest of the composer.

import type { HTMLAttributes, KeyboardEventHandler } from "react";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";

import { EDITOR_PALETTE_MENTION_SOURCES } from "@/components/blocks/editor-palette/data/mention-sources";
import {
  composerDirectoryAutocompletePluginKey,
  createComposerEditorExtensions,
  getMentionNodeAttrs,
  RICH_TEXT_OBJECT_REPLACEMENT,
  type ComposerDirectoryAutocompleteController,
} from "@/components/ui-custom/rich-text-editor";
import { useComposerVisualTraceAutoTagging } from "@/components/ui-custom/rich-text-editor/use-composer-visual-trace-auto-tagging";
import "@/components/ui-custom/rich-text-editor/rich-text-editor.css";
import { useHasVerticalOverflow } from "@/components/hooks/use-has-vertical-overflow";
import { buildScrollMaskStyle } from "@/components/visual/scroll-mask/lib";
import {
  serializeComposerDoc,
  setComposerPlainText,
} from "@/lib/composer-serialize";
import {
  getDirectoryAutocompleteState,
  type DirectoryAutocompleteState,
} from "@/lib/directory-autocomplete";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useOptionalPromptInputController,
  usePromptInputAttachments,
} from "@/components/ui-custom/prompt-input/prompt-input-context";
import { createSyntheticChangeEvent } from "@/components/ui-custom/prompt-input/prompt-input-helpers";
import type { PromptInputTextareaProps } from "@/components/ui-custom/prompt-input/prompt-input-textarea-types";

export const PromptInputTextarea = ({
  autoResize: _autoResize = true,
  enableVisualTraceAutoTagging = false,
  enableDirectoryAutocomplete = true,
  enableSuggestionMenus = true,
  directoryAutocompleteListVisible = false,
  directoryAutocompleteLimit,
  prefillMentionRequest,
  onPrefillMentionConsumed,
  onDirectoryAutocompleteChange,
  onDirectoryAutocompleteControllerChange,
  onChange,
  onInput,
  onKeyDown: _onKeyDown,
  className,
  placeholder = "What would you like to know?",
  ref: forwardedRef,
  value: valueProp,
  name = "message",
  disabled,
  autoFocus,
  mentionSources = EDITOR_PALETTE_MENTION_SOURCES,
  mentionSectionLabels,
  suggestionVariant,
  onEditorReady,
	onEscape,
  "aria-label": ariaLabel,
  // Native-textarea-only props (rows, enterKeyHint, onPaste, …) have no
  // contentEditable equivalent the composer relies on; absorb them so the
  // public prop type stays drop-in without forwarding them to a <div>.
  rows: _rows,
  // oxlint-disable-next-line eslint(no-unused-vars)
  onCompositionStart: _onCompositionStart,
  // oxlint-disable-next-line eslint(no-unused-vars)
  onCompositionEnd: _onCompositionEnd,
  // oxlint-disable-next-line eslint(no-unused-vars)
  onPaste: _onPaste,
  // oxlint-disable-next-line eslint(no-unused-vars)
  onClick: _onClick,
  // oxlint-disable-next-line eslint(no-unused-vars)
  enterKeyHint: _enterKeyHint,
  ...props
}: Readonly<PromptInputTextareaProps>) => {
  const controller = useOptionalPromptInputController();
  const attachments = usePromptInputAttachments();

  // The public `value` prop inherits the textarea union type; the composer only
  // deals in plain strings, so normalize once.
  const normalizedValueProp =
    typeof valueProp === "string" ? valueProp : undefined;

  // Stable refs for callbacks/values the editor reads, so the editor instance is
  // created once and never torn down by changing handler identities.
  const onChangeRef = useRef(onChange);
  const onInputRef = useRef(onInput);
  const onEditorReadyRef = useRef(onEditorReady);
  const mentionSourcesRef = useRef(mentionSources);
  const attachmentsRef = useRef(attachments);
  const controllerRef = useRef(controller);
  const nameRef = useRef(name);
  const prefillMentionRequestRef = useRef(prefillMentionRequest);
  const activeEditorRef = useRef<Editor | null>(null);
  const lastEditorPublishedTextRef = useRef<string | null>(null);
  const lastMentionPrefillKeyRef = useRef(0);
  const pendingMentionPrefillKeyRef = useRef(0);
  const prefillValueSyncGuardKeyRef = useRef(0);
  const lastMentionPrefillTextRef = useRef<string | null>(null);
  const directoryAutocompleteStateRef = useRef<DirectoryAutocompleteState | null>(null);
  const directoryAutocompleteListVisibleRef = useRef(directoryAutocompleteListVisible);
  const directoryAutocompleteLimitRef = useRef(directoryAutocompleteLimit);
  const onDirectoryAutocompleteChangeRef = useRef(onDirectoryAutocompleteChange);
  const onDirectoryAutocompleteControllerChangeRef = useRef(onDirectoryAutocompleteControllerChange);
	const onEscapeRef = useRef(onEscape);
  const acceptDirectoryAutocompleteIndexRef = useRef<(index: number, requireGhost?: boolean) => boolean>(() => false);
  // True while the visual-trace auto-tagger is mid-debounce. During that window we
  // intentionally keep the prior matches visible (no per-keystroke flicker), but
  // their query range is stale, so autocomplete must not be *acceptable* — otherwise
  // Cmd+number or ghost acceptance could insert a mention at the old range.
  // Assigned after the hook below; defaults to "not busy".
  const isAutoTaggingBusyRef = useRef<() => boolean>(() => false);

  const directoryAutocompleteController = useMemo<ComposerDirectoryAutocompleteController>(() => ({
    acceptActiveListItem: () =>
      !isAutoTaggingBusyRef.current() &&
      acceptDirectoryAutocompleteIndexRef.current(
        directoryAutocompleteStateRef.current?.activeIndex ?? 0
      ),
    acceptGhost: () => !isAutoTaggingBusyRef.current() && acceptDirectoryAutocompleteIndexRef.current(0, true),
    acceptIndex: (index: number) => !isAutoTaggingBusyRef.current() && acceptDirectoryAutocompleteIndexRef.current(index),
    hasAcceptableList: () =>
      directoryAutocompleteListVisibleRef.current &&
      !isAutoTaggingBusyRef.current() &&
      (directoryAutocompleteStateRef.current?.matches.length ?? 0) > 0,
    hasVisibleList: () =>
      directoryAutocompleteListVisibleRef.current &&
      (directoryAutocompleteStateRef.current?.matches.length ?? 0) > 0,
  }), []);

  useEffect(() => {
    onChangeRef.current = onChange;
    onInputRef.current = onInput;
    onEditorReadyRef.current = onEditorReady;
		onEscapeRef.current = onEscape;
    mentionSourcesRef.current = mentionSources;
    attachmentsRef.current = attachments;
    controllerRef.current = controller;
    nameRef.current = name;
    prefillMentionRequestRef.current = prefillMentionRequest;
    directoryAutocompleteListVisibleRef.current = directoryAutocompleteListVisible;
    directoryAutocompleteLimitRef.current = directoryAutocompleteLimit;
    onDirectoryAutocompleteChangeRef.current = onDirectoryAutocompleteChange;
    onDirectoryAutocompleteControllerChangeRef.current = onDirectoryAutocompleteControllerChange;
  });

  const hiddenInputRef = useRef<HTMLInputElement | null>(null);
  const [domEmpty, setDomEmpty] = useState(() => {
    const initial = controller ? controller.textInput.value : normalizedValueProp;
    return !initial;
  });
  const {
    ref: composerScrollOverflowRef,
    hasReachedVerticalLimit: hasComposerReachedScrollLimit,
    showBottomScrollMask: showComposerBottomScrollMask,
    showTopScrollMask: showComposerTopScrollMask,
  } = useHasVerticalOverflow<HTMLElement>();
  const composerScrollMaskStyle = useMemo(
    () => buildScrollMaskStyle({ fadeSize: "var(--ds-space-200)" }),
    []
  );

  // Mirror the serialized text into the hidden input + the optional consumer
  // handlers. `fromEditor` distinguishes user edits (fire onChange) from
  // programmatic syncs (skip onChange to avoid feedback loops).
  const publishText = useCallback(
    (text: string, editorDom: HTMLElement | null, fromEditor: boolean) => {
      if (hiddenInputRef.current) {
        hiddenInputRef.current.value = text;
      }
      setDomEmpty(text === "");

      if (!fromEditor) {
        lastEditorPublishedTextRef.current = null;
        return;
      }

      lastEditorPublishedTextRef.current = text;
      const activeController = controllerRef.current;
      if (activeController) {
        activeController.textInput.setInput(text);
      }

      const syntheticEvent = createSyntheticChangeEvent(
        editorDom,
        text,
        nameRef.current
      );
      onChangeRef.current?.(syntheticEvent);
      onInputRef.current?.(
        syntheticEvent as unknown as Parameters<
          NonNullable<PromptInputTextareaProps["onInput"]>
        >[0]
      );
    },
    []
  );

  const applyDirectoryAutocompleteGhost = useCallback((state: DirectoryAutocompleteState | null) => {
    const activeEditor = activeEditorRef.current;
    if (!activeEditor) {
      return;
    }

    const meta = state?.ghostText
      ? { from: state.queryTo, text: state.ghostText }
      : null;
    activeEditor.view.dispatch(
      activeEditor.state.tr.setMeta(composerDirectoryAutocompletePluginKey, meta)
    );
  }, []);

  const setDirectoryAutocompleteState = useCallback((nextState: DirectoryAutocompleteState | null) => {
    directoryAutocompleteStateRef.current = nextState;
    applyDirectoryAutocompleteGhost(nextState);
    onDirectoryAutocompleteChangeRef.current?.(nextState);
  }, [applyDirectoryAutocompleteGhost]);

  const refreshDirectoryAutocompleteRef = useRef<(activeEditor: Editor) => void>(() => undefined);
  const {
    clearPendingAutoTagging,
    flushAutoTagging,
    handleEditorUpdated: handleVisualTraceEditorUpdated,
    handleKeyDown: handleVisualTraceKeyDown,
    handlePaste: handleVisualTracePaste,
    isBusy: isVisualTraceAutoTaggingBusy,
    resetEditorState: resetVisualTraceEditorState,
    scheduleAutoTagging,
    syncExternalValue: syncVisualTraceExternalValue,
  } = useComposerVisualTraceAutoTagging({
    activeEditorRef,
    enabled: enableVisualTraceAutoTagging,
    mentionSourcesRef,
    publishText,
    refreshDirectoryAutocompleteRef,
    setDirectoryAutocompleteState,
  });
  const showComposerTopMask = hasComposerReachedScrollLimit && showComposerTopScrollMask;
  const showComposerBottomMask = hasComposerReachedScrollLimit && showComposerBottomScrollMask;

  const isAnySuggestionMenuOpen = useCallback((activeEditor: Editor): boolean => {
    for (const plugin of activeEditor.view.state.plugins) {
      const pluginState = plugin.getState(activeEditor.view.state) as
        | { active?: boolean; query?: unknown; range?: unknown }
        | undefined;
      if (pluginState?.active === true && "query" in pluginState && "range" in pluginState) {
        return true;
      }
    }

    return false;
  }, []);

  const refreshDirectoryAutocomplete = useCallback((activeEditor: Editor) => {
    if (!enableDirectoryAutocomplete || !activeEditor.isEditable) {
      setDirectoryAutocompleteState(null);
      return;
    }

    const { selection } = activeEditor.state;
    if (activeEditor.view.composing || !selection.empty || isAnySuggestionMenuOpen(activeEditor)) {
      // Context that always invalidates an inline autocomplete (IME composition,
      // a non-collapsed selection, or an open suggestion menu) clears the state
      // even mid-debounce, so a stale list can't linger after the cursor context
      // changed.
      setDirectoryAutocompleteState(null);
      return;
    }

    // Auto-tagging is mid-flight (post-keystroke idle debounce, or an exact-label
    // match converting into a chip) and the cursor is still a collapsed caret with
    // no menu open: keep the current matches rather than blanking on every
    // keystroke (that made the empty-state greeting blink to its default prompts
    // and back). The query range may be stale until `runAutoTagging` recomputes,
    // so acceptance is disabled while busy via the controller's accept methods.
    if (isVisualTraceAutoTaggingBusy()) {
      return;
    }

    const textBeforeCursor = selection.$from.parent.textBetween(
      0,
      selection.$from.parentOffset,
      "\n",
      RICH_TEXT_OBJECT_REPLACEMENT
    );
    const nextState = getDirectoryAutocompleteState({
      cursorPosition: selection.from,
      limit: directoryAutocompleteLimitRef.current,
      sources: mentionSourcesRef.current,
      textBeforeCursor,
    });
    setDirectoryAutocompleteState(nextState);
  }, [enableDirectoryAutocomplete, isAnySuggestionMenuOpen, isVisualTraceAutoTaggingBusy, setDirectoryAutocompleteState]);

  const acceptDirectoryAutocompleteIndex = useCallback((index: number, requireGhost = false): boolean => {
    const activeEditor = activeEditorRef.current;
    const currentState = directoryAutocompleteStateRef.current;
    if (!activeEditor || !currentState) {
      return false;
    }
    if (requireGhost && !currentState.ghostText) {
      return false;
    }

    const match = currentState.matches[index];
    if (!match) {
      return false;
    }

    activeEditor
      .chain()
      .focus()
      .insertContentAt(
        { from: currentState.queryFrom, to: currentState.queryTo },
        [
          {
            type: "mention",
            attrs: getMentionNodeAttrs(match.mention),
          },
          { type: "text", text: " " },
        ]
      )
      .run();
    setDirectoryAutocompleteState(null);
    return true;
  }, [setDirectoryAutocompleteState]);

  useEffect(() => {
    refreshDirectoryAutocompleteRef.current = refreshDirectoryAutocomplete;
    isAutoTaggingBusyRef.current = isVisualTraceAutoTaggingBusy;
    acceptDirectoryAutocompleteIndexRef.current = acceptDirectoryAutocompleteIndex;
  }, [acceptDirectoryAutocompleteIndex, isVisualTraceAutoTaggingBusy, refreshDirectoryAutocomplete]);

  // Plain Enter (menu closed, no IME) submits the host form unless its submit
  // button is disabled. Returns true to consume the keystroke.
  const handleEnterSubmit = useCallback((view: { dom: HTMLElement }) => {
    flushAutoTagging();

    const form = view.dom.closest("form");
    if (!form) {
      return false;
    }

    const submitButton = form.querySelector(
      'button[type="submit"]'
    ) as HTMLButtonElement | null;
    if (submitButton?.disabled) {
      // Swallow Enter so a disabled composer doesn't insert a newline either.
      return true;
    }

    form.requestSubmit();
    return true;
  }, [flushAutoTagging]);

  const extensions = useMemo(
    () =>
      createComposerEditorExtensions({
        directoryAutocomplete: directoryAutocompleteController,
        enableSuggestionMenus,
        getMentionSources: () => mentionSourcesRef.current,
        mentionSectionLabels,
        onEnter: handleEnterSubmit,
				onEscape: () => {
					if (!onEscapeRef.current) return false;
					onEscapeRef.current();
					return true;
				},
        onPasteFiles: (files) => attachmentsRef.current.add(files),
        suggestionVariant,
      }),
    [directoryAutocompleteController, enableSuggestionMenus, handleEnterSubmit, mentionSectionLabels, suggestionVariant]
  );

  const editor = useEditor({
    extensions,
    immediatelyRender: false,
    editable: !disabled,
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: {
        "aria-label": ariaLabel ?? "Message",
        class: cn(
          "prompt-input-composer max-h-48 min-h-16 w-full overflow-y-auto px-0 py-2 outline-none",
          className
        ),
        role: "textbox",
        ...(disabled ? { "aria-disabled": "true" } : {}),
      },
    },
    onCreate: ({ editor: activeEditor }) => {
      activeEditorRef.current = activeEditor;
      const initial = controllerRef.current
        ? controllerRef.current.textInput.value
        : normalizedValueProp;
      // Editor creation is asynchronous and can finish after the keyed prefill
      // effect has already inserted its mention. In that case, restoring the
      // controlled plain-text value here would flatten the mention node.
      if (initial && !prefillMentionRequestRef.current) {
        setComposerPlainText(activeEditor, initial);
      }
      publishText(serializeComposerDoc(activeEditor), activeEditor.view.dom, false);
      if (enableVisualTraceAutoTagging && initial) {
        scheduleAutoTagging(activeEditor, true, "document");
      } else {
        refreshDirectoryAutocomplete(activeEditor);
      }
      onEditorReadyRef.current?.(activeEditor);
    },
    onSelectionUpdate: ({ editor: activeEditor }) => {
      refreshDirectoryAutocomplete(activeEditor);
    },
    onUpdate: ({ editor: activeEditor }) => {
      publishText(serializeComposerDoc(activeEditor), activeEditor.view.dom, true);
      if (handleVisualTraceEditorUpdated(activeEditor)) {
        return;
      }
      refreshDirectoryAutocomplete(activeEditor);
    },
  });

  useEffect(() => {
    onDirectoryAutocompleteControllerChangeRef.current?.(directoryAutocompleteController);
    return () => {
      onDirectoryAutocompleteControllerChangeRef.current?.(null);
    };
  }, [directoryAutocompleteController]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    activeEditorRef.current = editor;
    refreshDirectoryAutocomplete(editor);
    return () => {
      if (activeEditorRef.current === editor) {
        activeEditorRef.current = null;
      }
      setDirectoryAutocompleteState(null);
    };
  }, [editor, refreshDirectoryAutocomplete, setDirectoryAutocompleteState]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    composerScrollOverflowRef(editor.view.dom);
    return () => {
      composerScrollOverflowRef(null);
    };
  }, [composerScrollOverflowRef, editor]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (handleVisualTraceKeyDown(editor, event)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    editor.view.dom.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      editor.view.dom.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [editor, handleVisualTraceKeyDown]);

  useEffect(() => {
    if (!editor || !enableVisualTraceAutoTagging) {
      return;
    }

    const handlePaste = () => {
      handleVisualTracePaste();
    };
    const handleSubmit = () => {
      flushAutoTagging(editor);
    };
    const form = editor.view.dom.closest("form");

    editor.view.dom.addEventListener("paste", handlePaste, { capture: true });
    form?.addEventListener("submit", handleSubmit, { capture: true });
    return () => {
      editor.view.dom.removeEventListener("paste", handlePaste, { capture: true });
      form?.removeEventListener("submit", handleSubmit, { capture: true });
    };
  }, [editor, enableVisualTraceAutoTagging, flushAutoTagging, handleVisualTracePaste]);

  useEffect(() => () => {
    clearPendingAutoTagging();
  }, [clearPendingAutoTagging]);

  // Forward the ref to the contentEditable DOM (escape hatch for consumers that
  // previously held a textarea ref to call .focus()/measure).
  useEffect(() => {
    if (!editor) {
      return;
    }
    const node = editor.view.dom as unknown as HTMLTextAreaElement;

    if (typeof forwardedRef === "function") {
      forwardedRef(node);
    } else if (forwardedRef && typeof forwardedRef === "object") {
      forwardedRef.current = node;
    }

    return () => {
      if (typeof forwardedRef === "function") {
        forwardedRef(null);
      } else if (forwardedRef && typeof forwardedRef === "object") {
        forwardedRef.current = null;
      }
    };
  }, [editor, forwardedRef]);

  // Keep editable state in sync with the disabled prop.
  useEffect(() => {
    if (editor && editor.isEditable === Boolean(disabled)) {
      editor.setEditable(!disabled);
      refreshDirectoryAutocomplete(editor);
    }
  }, [editor, disabled, refreshDirectoryAutocomplete]);

  // Truly-uncontrolled demos (no `value`/controller) clear the composer via the
  // host form's reset() after submit. The contentEditable isn't a native form
  // control, so mirror that reset here by clearing the editor on form reset.
  useEffect(() => {
    if (!editor) {
      return;
    }
    const form = editor.view.dom.closest("form");
    if (!form) {
      return;
    }

    const handleReset = () => {
      resetVisualTraceEditorState(editor);
      setComposerPlainText(editor, "");
      publishText("", editor.view.dom, false);
      setDirectoryAutocompleteState(null);
    };
    form.addEventListener("reset", handleReset);
    return () => {
      form.removeEventListener("reset", handleReset);
    };
  }, [editor, publishText, resetVisualTraceEditorState, setDirectoryAutocompleteState]);

  useEffect(() => {
    if (
      !editor ||
      !prefillMentionRequest ||
      prefillMentionRequest.requestKey <= 0 ||
      lastMentionPrefillKeyRef.current === prefillMentionRequest.requestKey ||
      pendingMentionPrefillKeyRef.current === prefillMentionRequest.requestKey
    ) {
      return;
    }

    let cancelled = false;
    const requestKey = prefillMentionRequest.requestKey;
    const mention = prefillMentionRequest.mention;
    const textAfter = prefillMentionRequest.textAfter ?? " ";
    pendingMentionPrefillKeyRef.current = requestKey;

    const prefillFrame = requestAnimationFrame(() => {
      if (pendingMentionPrefillKeyRef.current === requestKey) {
        pendingMentionPrefillKeyRef.current = 0;
      }
      if (cancelled || activeEditorRef.current !== editor) {
        return;
      }

      lastMentionPrefillKeyRef.current = requestKey;
      prefillValueSyncGuardKeyRef.current = requestKey;
      clearPendingAutoTagging();
      resetVisualTraceEditorState(editor);
      setDirectoryAutocompleteState(null);
      editor
        .chain()
        .focus()
        .selectAll()
        .insertContent([
          { type: "mention", attrs: getMentionNodeAttrs(mention) },
          { type: "text", text: textAfter },
        ])
        .run();
      editor.createNodeViews();
      const prefillText = serializeComposerDoc(editor);
      lastMentionPrefillTextRef.current = prefillText;
      publishText(prefillText, editor.view.dom, true);
      editor.commands.focus("end");
      onPrefillMentionConsumed?.(requestKey);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(prefillFrame);
      if (pendingMentionPrefillKeyRef.current === requestKey) {
        pendingMentionPrefillKeyRef.current = 0;
      }
    };
  }, [
    clearPendingAutoTagging,
    editor,
    onPrefillMentionConsumed,
    prefillMentionRequest,
    publishText,
    resetVisualTraceEditorState,
    setDirectoryAutocompleteState,
  ]);

  // Sync external value (controller or controlled `value` prop) into the editor.
  // Compares against the serialized text so prefill/clear/setInput apply, while
  // a user's own keystrokes (already serialized) don't loop back through here.
  const resolvedValue = controller ? controller.textInput.value : normalizedValueProp;

  useEffect(() => {
    if (!editor || resolvedValue === undefined || resolvedValue === null) {
      return;
    }

    const currentText = serializeComposerDoc(editor);
    if (
      prefillMentionRequest?.requestKey === prefillValueSyncGuardKeyRef.current
    ) {
      if (currentText !== resolvedValue) {
        return;
      }
      prefillValueSyncGuardKeyRef.current = 0;
    }
    if (lastMentionPrefillTextRef.current === currentText && resolvedValue !== currentText) {
      return;
    }

    if (currentText === resolvedValue) {
      lastMentionPrefillTextRef.current = null;
      if (lastEditorPublishedTextRef.current === resolvedValue) {
        lastEditorPublishedTextRef.current = null;
      }
      return;
    }

    if (lastEditorPublishedTextRef.current === resolvedValue) {
      return;
    }

    syncVisualTraceExternalValue(editor, resolvedValue, currentText);
  }, [editor, prefillMentionRequest, resolvedValue, syncVisualTraceExternalValue]);

  // Backspace on an empty composer removes the last attachment, matching the
  // previous textarea behavior.
  const handleContainerKeyDown: KeyboardEventHandler<HTMLDivElement> = useCallback(
    (event) => {
      if (
        event.key === "Backspace" &&
        domEmpty &&
        attachmentsRef.current.files.length > 0
      ) {
        event.preventDefault();
        const lastAttachment = attachmentsRef.current.files.at(-1);
        if (lastAttachment) {
          attachmentsRef.current.remove(lastAttachment.id);
        }
      }
    },
    [domEmpty]
  );

  const showOverlayPlaceholder = domEmpty && Boolean(placeholder);

  return (
    <div className="relative flex min-w-0 flex-1 self-stretch">
      <div
        data-slot="input-group-control-container"
        className="flex min-w-0 flex-1 self-stretch cursor-text px-2.5 has-disabled:cursor-not-allowed"
        onClick={() => editor?.commands.focus()}
        onKeyDownCapture={handleContainerKeyDown}
        // Pass through residual layout attributes (id, data-*, style). Textarea-
        // only handlers were destructured out above; cast bridges the textarea
        // prop type to this container <div>.
        {...(props as HTMLAttributes<HTMLDivElement>)}
      >
        <EditorContent
          editor={editor}
          className={cn(
            "min-w-0 flex-1 self-stretch",
            showComposerTopMask &&
              !showComposerBottomMask &&
              "scroll-mask-top",
            showComposerBottomMask &&
              !showComposerTopMask &&
              "scroll-mask-bottom",
            (showComposerTopMask ||
              showComposerBottomMask) &&
              "overscroll-contain"
          )}
          style={
            showComposerTopMask &&
            showComposerBottomMask
              ? composerScrollMaskStyle
              : undefined
          }
        />
      </div>
      {/* Hidden input keeps FormData.get("message") working for demos that read
          the submitted text from the form rather than the controller. */}
      <input ref={hiddenInputRef} type="hidden" name={name} data-slot="prompt-input-message" />
      {showOverlayPlaceholder ? (
        <span
          aria-hidden="true"
          data-slot="prompt-input-placeholder"
          className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center px-2.5 text-sm text-text-subtlest"
        >
          <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap">
            {placeholder}
          </span>
        </span>
      ) : null}
    </div>
  );
};
