import type { Editor } from "@tiptap/core";
import type { ComponentProps } from "react";
import type {
  ComposerDirectoryAutocompleteController,
  RichTextMentionItem,
  RichTextMentionSectionLabels,
  RichTextMentionSources,
  RichTextSuggestionVariantConfig,
} from "@/components/ui-custom/rich-text-editor";
import type { InputGroupTextarea } from "@/components/ui/input-group";
import type { DirectoryAutocompleteState } from "@/lib/directory-autocomplete";

export type PromptInputTextareaProps = ComponentProps<
  typeof InputGroupTextarea
> & {
  autoResize?: boolean;
  /**
   * Opt-in Rovo composer behavior that converts exact unprefixed, "/" skill/app,
   * and "@" mention labels into true mention nodes after a short idle.
   */
  enableVisualTraceAutoTagging?: boolean;
  /**
   * Enables plain-text skill/tool autocomplete backed by the directory mention
   * catalog. Defaults to true so every prompt composer exposes the discoverable
   * token path; pass false for exceptional surfaces.
   */
  enableDirectoryAutocomplete?: boolean;
  /** Enables the inline `@` mention and `/` command palettes. Defaults to true. */
  enableSuggestionMenus?: boolean;
  /**
   * Whether the host is rendering an external suggestions list for the current
   * composer. When true, Mod+1..9 selects that list; plain Enter and arrow
   * keys stay with the prompt input.
   */
  directoryAutocompleteListVisible?: boolean;
  /** Caps plain-text directory autocomplete matches before external rendering. */
  directoryAutocompleteLimit?: number;
  /** Keyed request to replace the composer draft with a rich mention token. */
  prefillMentionRequest?: { mention: RichTextMentionItem; requestKey: number; textAfter?: string };
  /** Acknowledges a rich mention request after the editor applies it. */
  onPrefillMentionConsumed?: (requestKey: number) => void;
  /** Receives composer-owned autocomplete state for external list rendering. */
  onDirectoryAutocompleteChange?: (state: DirectoryAutocompleteState | null) => void;
  /** Receives imperative insertion/selection actions for external rows. */
  onDirectoryAutocompleteControllerChange?: (controller: ComposerDirectoryAutocompleteController | null) => void;
  /**
   * Mention/reference catalog backing the inline `@`/`/` palette. Defaults to
   * the unified editor-palette catalog (built from `@/app/data/directory`).
   */
  mentionSources?: RichTextMentionSources;
  /** Optional copy overrides for sections in the inline "@" picker. */
  mentionSectionLabels?: RichTextMentionSectionLabels;
  /** Layout for the inline "@" and "/" suggestion menus. */
  suggestionVariant?: RichTextSuggestionVariantConfig;
  /**
   * Called once the tiptap editor is ready. Use this (or the forwarded `ref`,
   * which points at the contentEditable DOM) to drive focus or measurement,
   * e.g. from the Rovo/Studio composers.
   */
  onEditorReady?: (editor: Editor) => void;
	/** Called on Escape when no inline suggestion menu is open. */
	onEscape?: () => void;
};
