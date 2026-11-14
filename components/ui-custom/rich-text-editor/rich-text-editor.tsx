"use client";

// oxlint-disable react-doctor/no-derived-state -- These components maintain local derived display state for controlled animations, measurements, or draft editing that cannot be represented as render-only values without changing UX.
// oxlint-disable react-doctor/no-pass-live-state-to-parent -- Callbacks in this file intentionally stream live interaction state to the parent owner.

import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { EditorContent, useEditor } from "@tiptap/react";

import {
	buildAgentDataFlowMermaid,
	isValidAgentDataFlowMermaid,
	type StudioAgentDataFlowConfig,
} from "@/lib/studio-agent-data-flow";
import { cn } from "@/lib/utils";
import { token } from "@/lib/tokens";
import {
	getDirectoryAutocompleteState,
	type DirectoryAutocompleteState,
} from "@/lib/directory-autocomplete";
import { StickyRowScrollFade } from "@/components/visual/scroll-mask";

import { createRichTextEditorExtensions, getMentionCategory, getMentionNodeAttrs, RICH_TEXT_OBJECT_REPLACEMENT } from "./extensions";
import {
	createComposerDirectoryAutocomplete,
	composerDirectoryAutocompletePluginKey,
	type ComposerDirectoryAutocompleteController,
} from "./composer-extensions";
import {
	applyMarkdownFormat,
	type MarkdownFormatKind,
} from "./markdown-format";
import { MarkdownSourceEditor } from "./markdown-source-editor";
import { FrontmatterPortalContext } from "./frontmatter-portal";
import "./rich-text-editor.css";

// The data-flow diagram renders with Streamdown and its mermaid plugin, which load only when the
// editor switches to that view.
const DataFlowDiagramView = lazy(() => import("./rich-text-data-flow-diagram").then((module) => ({ default: module.DataFlowDiagramView })));
import {
	RichTextEditorBubbleMenu,
	RichTextEditorFloatingMenu,
	RichTextEditorToolbar,
} from "./toolbar";
import type { EditorToolbarInsertReferenceCategory, EditorToolbarViewMode } from "@/components/blocks/editor-toolbar";
import { isRichTextReferenceCategory } from "./reference-categories";
import type {
	RichTextEditorExtensionOptions,
	RichTextMentionItem,
	RichTextMentionRemovalRequest,
	RichTextMentionSources,
	RichTextSlashCategory,
	RichTextSuggestionVariantConfig,
} from "./types";

interface RichTextEditorProps
	extends Omit<ComponentProps<"div">, "onChange"> {
	value?: string;
	placeholder?: string;
	placeholderSlot?: ReactNode;
	trailingNode?: RichTextEditorExtensionOptions["trailingNode"];
	dataFlowConfig?: StudioAgentDataFlowConfig;
	dataFlowDiagramLabel?: string;
	editorClassName?: string;
	contentClassName?: string;
	toolbarEndSlot?: ReactNode;
	toolbarBelowSlot?: ReactNode;
	toolbarClassName?: string;
	mentionSources?: RichTextMentionSources;
	/**
	 * Enables inline "ghost text" autocomplete for skill/tool mentions, mirroring
	 * the chat composer: as the user types, the remainder of the best-matching
	 * skill/tool label is shown greyed inline and Tab / → inserts it as a mention
	 * chip. Off by default so document/showcase editors are unaffected; the
	 * suggestions are drawn from `mentionSources.skill` + `mentionSources.tool`.
	 */
	enableDirectoryAutocomplete?: boolean;
	/**
	 * Layout for the live "@" / "/" suggestion menus. `"flat"` (default) merges
	 * each surface's sections into one list separated by headings; `"nested"`
	 * keeps the original drill-in category lists. Pass an object to set each
	 * trigger independently, e.g. `{ mention: "flat", command: "nested" }`.
	 */
	suggestionVariant?: RichTextSuggestionVariantConfig;
	suggestionRowVariant?: RichTextEditorExtensionOptions["suggestionRowVariant"];
	mentionRemovalRequest?: RichTextMentionRemovalRequest | null;
	onMarkdownChange?: (value: string) => void;
	onPlainTextChange?: (value: string) => void;
	onMentionInventoryChange?: (mentions: readonly RichTextMentionItem[]) => void;
	onMentionRemovalRequestHandled?: (key: string) => void;
	onInsertReferenceOption?: (category: EditorToolbarInsertReferenceCategory, label: string) => boolean | void;
	onAskRovo?: (editor: Editor) => void;
	/**
	 * Launches the directory for a nested "/" category from its empty-state
	 * "Browse all" button (e.g. drilling into Skills with no matches). Only
	 * directory-backed categories (everything but "format") invoke it; omit it to
	 * keep the plain empty title with no button.
	 */
	onOpenDirectory?: (category: RichTextSlashCategory) => void;
	/** Requested view mode. Omit to let the editor manage the mode internally. */
	viewMode?: EditorToolbarViewMode;
	onViewModeChange?: (mode: EditorToolbarViewMode) => void;
	/**
	 * When `{ enabled: true }`, a leading SKILL.md `---` YAML block renders as the
	 * editable frontmatter card and round-trips as a fence in the markdown view.
	 * Off by default.
	 */
	frontmatter?: { enabled?: boolean };
	showToolbar?: boolean;
	showBubbleMenu?: boolean;
	showFloatingMenu?: boolean;
	/**
	 * Controls how the toolbar is revealed.
	 * - `"always"` (default): toolbar is always visible.
	 * - `"hover"`: toolbar is hidden (but its space stays reserved, so there is
	 *   no layout jump) and fades in when the pointer hovers anywhere in the
	 *   editor, or while focus remains anywhere within the editor. It is also
	 *   sticky and follows the scroll while hover/focus continues to own which
	 *   toolbar state is visible.
	 */
	toolbarReveal?: "always" | "hover";
	/**
	 * When `true`, reserves 8px of surface below the hover-reveal toolbar (`pb-2`
	 * on the reveal) so the toolbar→content gap is opaque. Once the bar pins, that
	 * keeps content scrolling under it from cramping the bar and avoids a
	 * transparent gap below the divider. Pair with `space-y-0` on the root so the
	 * gap isn't doubled. Opt-in (e.g. agent + skill config instructions).
	 */
	padStuckToolbar?: boolean;
	/** Adds the shared 32px progressive blur below this toolbar only while stuck. */
	stuckToolbarScrollFade?: boolean;
	/**
	 * Only meaningful with `toolbarReveal="hover"`. When `true`, the space the
	 * hidden toolbar reserves shows a centered hairline divider in the resting
	 * state (matching `h-px bg-border` rules elsewhere) instead of an empty gap.
	 * The divider cross-fades out — and the toolbar cross-fades in — on
	 * hover/focus-within.
	 * Opt-in so other hover consumers keep the plain empty gap.
	 */
	toolbarRestingSeparator?: boolean;
	/**
	 * Optional label shown before the resting separator's hairline (mirrors the
	 * "Activity" header pattern: label + full-width rule). Only rendered when
	 * `toolbarRestingSeparator` is set. Omit for a bare line.
	 */
	toolbarRestingSeparatorLabel?: ReactNode;
	"aria-label"?: string;
}

function toCssString(value: string): string {
	return JSON.stringify(value);
}


function getEditorMentionInventory(editor: Editor): readonly RichTextMentionItem[] {
	const mentions: RichTextMentionItem[] = [];

	editor.state.doc.descendants((node) => {
		if (node.type.name !== "mention") {
			return true;
		}

		const category = getMentionCategory(node.attrs.id);
		if (!isRichTextReferenceCategory(category)) {
			return false;
		}

		const label = typeof node.attrs.label === "string" ? node.attrs.label.trim() : "";
		const id = typeof node.attrs.id === "string" ? node.attrs.id : "";
		if (!label || !id) {
			return false;
		}

		mentions.push({
			category,
			id,
			label,
		});
		return false;
	});

	return mentions;
}

function normalizeMentionText(value: string | undefined): string {
	return value?.trim().toLowerCase() ?? "";
}

function mentionMatchesRemovalRequest(
	attrs: Record<string, unknown>,
	request: RichTextMentionRemovalRequest,
): boolean {
	const category = getMentionCategory(attrs.id);
	if (category !== request.category) {
		return false;
	}

	const id = typeof attrs.id === "string" ? attrs.id : undefined;
	const label = typeof attrs.label === "string" ? attrs.label : undefined;

	return Boolean(
		(request.id && id === request.id) ||
		(request.label && normalizeMentionText(label) === normalizeMentionText(request.label)),
	);
}

function removeMentionsFromEditor(
	editor: Editor,
	request: RichTextMentionRemovalRequest,
): boolean {
	const ranges: Array<{ from: number; to: number }> = [];

	editor.state.doc.descendants((node, pos) => {
		if (node.type.name !== "mention") {
			return true;
		}

		if (mentionMatchesRemovalRequest(node.attrs, request)) {
			ranges.push({ from: pos, to: pos + node.nodeSize });
		}
		return false;
	});

	if (ranges.length === 0) {
		return false;
	}

	let transaction = editor.state.tr;
	for (const range of ranges.reverse()) {
		transaction = transaction.delete(range.from, range.to);
	}
	editor.view.dispatch(transaction);
	return true;
}

export function RichTextEditor({
	value,
	placeholder,
	placeholderSlot,
	trailingNode,
	dataFlowConfig,
	dataFlowDiagramLabel,
	className,
	editorClassName,
	contentClassName,
	toolbarEndSlot,
	toolbarBelowSlot,
	toolbarClassName,
	mentionSources,
	enableDirectoryAutocomplete = false,
	suggestionVariant = "nested",
	suggestionRowVariant,
	mentionRemovalRequest,
	onMarkdownChange,
	onPlainTextChange,
	onMentionInventoryChange,
	onMentionRemovalRequestHandled,
	onInsertReferenceOption,
	onAskRovo,
	onOpenDirectory,
	viewMode: requestedViewMode,
	onViewModeChange,
	frontmatter,
	showToolbar = true,
	showBubbleMenu = true,
	showFloatingMenu = false,
	toolbarReveal = "always",
	padStuckToolbar = false,
	stuckToolbarScrollFade = false,
	toolbarRestingSeparator = false,
	toolbarRestingSeparatorLabel,
	"aria-label": ariaLabel,
	...props
}: Readonly<RichTextEditorProps>) {
	const mentionSourcesRef = useRef(mentionSources);
	const onAskRovoRef = useRef(onAskRovo);
	const onOpenDirectoryRef = useRef(onOpenDirectory);
	const onMarkdownChangeRef = useRef(onMarkdownChange);
	const onPlainTextChangeRef = useRef(onPlainTextChange);
	const onMentionInventoryChangeRef = useRef(onMentionInventoryChange);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const activeEditorRef = useRef<Editor | null>(null);
	const directoryAutocompleteStateRef = useRef<DirectoryAutocompleteState | null>(null);
	const enableDirectoryAutocompleteRef = useRef(enableDirectoryAutocomplete);
	// Mirror the ghost decoration into the editor: push the greyed remainder as a
	// widget at the cursor, or clear it when there is no suggestion.
	const applyDirectoryAutocompleteGhost = useCallback((state: DirectoryAutocompleteState | null) => {
		const activeEditor = activeEditorRef.current;
		if (!activeEditor) {
			return;
		}
		const meta = state?.ghostText
			? { from: state.queryTo, text: state.ghostText }
			: null;
		activeEditor.view.dispatch(
			activeEditor.state.tr.setMeta(composerDirectoryAutocompletePluginKey, meta),
		);
	}, []);
	const setDirectoryAutocompleteState = useCallback((nextState: DirectoryAutocompleteState | null) => {
		directoryAutocompleteStateRef.current = nextState;
		applyDirectoryAutocompleteGhost(nextState);
	}, [applyDirectoryAutocompleteGhost]);
	// A live "@"/"/" suggestion menu owns the keystrokes; suppress the ghost while
	// one is open (matches the chat composer).
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
		if (!enableDirectoryAutocompleteRef.current || !activeEditor.isEditable) {
			setDirectoryAutocompleteState(null);
			return;
		}
		const { selection } = activeEditor.state;
		const { $from } = selection;
		if (
			activeEditor.view.composing ||
			!selection.empty ||
			!$from.parent.isTextblock ||
			$from.parentOffset !== $from.parent.content.size ||
			isAnySuggestionMenuOpen(activeEditor)
		) {
			// A widget inserted before existing characters participates in inline
			// layout and pushes the remaining text aside. Keep document-editor
			// completions at the end of the current text block, where the ghost is a
			// true continuation of what the user is typing.
			setDirectoryAutocompleteState(null);
			return;
		}
		const textBeforeCursor = $from.parent.textBetween(
			0,
			$from.parentOffset,
			"\n",
			RICH_TEXT_OBJECT_REPLACEMENT,
		);
		const nextState = getDirectoryAutocompleteState({
			cursorPosition: selection.from,
			sources: mentionSourcesRef.current,
			textBeforeCursor,
		});
		setDirectoryAutocompleteState(nextState);
	}, [isAnySuggestionMenuOpen, setDirectoryAutocompleteState]);
	// Accept the ghost (Tab / →): replace the typed query with the matched skill /
	// tool mention chip plus a trailing space, exactly like the chat composer.
	const acceptDirectoryAutocompleteGhost = useCallback((): boolean => {
		const activeEditor = activeEditorRef.current;
		const currentState = directoryAutocompleteStateRef.current;
		if (!activeEditor || !currentState || !currentState.ghostText) {
			return false;
		}
		const match = currentState.matches[0];
		if (!match) {
			return false;
		}
		activeEditor
			.chain()
			.focus()
			.insertContentAt(
				{ from: currentState.queryFrom, to: currentState.queryTo },
				[
					{ type: "mention", attrs: getMentionNodeAttrs(match.mention) },
					{ type: "text", text: " " },
				],
			)
			.run();
		setDirectoryAutocompleteState(null);
		return true;
	}, [setDirectoryAutocompleteState]);
	// Ghost-only controller: this editor has no external suggestion list, so the
	// list-navigation branches stay inert (hasVisibleList → false).
	const directoryAutocompleteController = useMemo<ComposerDirectoryAutocompleteController>(() => ({
		acceptActiveListItem: () => false,
		acceptGhost: () => acceptDirectoryAutocompleteGhost(),
		acceptIndex: () => false,
		hasAcceptableList: () => false,
		hasVisibleList: () => false,
	}), [acceptDirectoryAutocompleteGhost]);
	const [isEmpty, setIsEmpty] = useState(() => !value?.trim());
	const [viewMode, setViewMode] = useState<EditorToolbarViewMode>("rendered");
	const [markdownSource, setMarkdownSource] = useState("");
	const baselineDataFlowMermaid = useMemo(
		() => dataFlowConfig ? buildAgentDataFlowMermaid(dataFlowConfig) : "",
		[dataFlowConfig],
	);
	const [dataFlowMermaid, setDataFlowMermaid] = useState(baselineDataFlowMermaid);
	const [isRefiningDataFlow, setIsRefiningDataFlow] = useState(false);
	const isMarkdownMode = viewMode === "markdown";
	const isDataFlowMode = viewMode === "data-flow";

	useEffect(() => {
		onViewModeChange?.(viewMode);
	}, [onViewModeChange, viewMode]);

	function updateViewMode(nextMode: EditorToolbarViewMode): void {
		setViewMode(nextMode);
	}

	// Pass the directory launcher only when a host actually supplies one. The
	// renderer shows the empty state's "Browse all" button whenever this is
	// defined, so an always-present wrapper would render a dead button on
	// surfaces with no host directory (the showcase, the chat composer). Track
	// presence (not identity) in the deps so toggling it rebuilds the editor
	// while a changing handler is still read live through the ref.
	const hasOpenDirectory = Boolean(onOpenDirectory);
	const frontmatterEnabled = Boolean(frontmatter?.enabled);
	// Portal target for the frontmatter card. When frontmatter is enabled the
	// editor renders this slot directly below the toolbar and the frontmatter
	// node-view portals its card into it (the node stays in the doc — markdown
	// round-trip and save are unchanged). Null elsewhere, so the card renders inline.
	const [frontmatterPortalEl, setFrontmatterPortalEl] = useState<HTMLElement | null>(null);
	const extensions = useMemo(
		() => {
			const richTextExtensions = createRichTextEditorExtensions({
				trailingNode,
				getMentionSources: () => mentionSourcesRef.current,
				onAskRovo: (activeEditor) => onAskRovoRef.current?.(activeEditor),
				// Read through a ref so a changing handler doesn't rebuild the editor
				// (matches onAskRovo above); the slash menu calls this when the user
				// clicks "Browse all" in a nested category's empty state.
				onOpenDirectory: hasOpenDirectory
					? (category) => onOpenDirectoryRef.current?.(category)
					: undefined,
				suggestionVariant,
				suggestionRowVariant,
				frontmatter: frontmatterEnabled ? { enabled: true } : undefined,
			});
			if (enableDirectoryAutocomplete) {
				richTextExtensions.push(createComposerDirectoryAutocomplete(directoryAutocompleteController));
			}
			return richTextExtensions;
		},
		[directoryAutocompleteController, enableDirectoryAutocomplete, frontmatterEnabled, hasOpenDirectory, suggestionRowVariant, suggestionVariant, trailingNode],
	);
	const editor = useEditor({
		extensions,
		content: value ?? "",
		contentType: "markdown",
		immediatelyRender: false,
		editorProps: {
			attributes: {
				"aria-label": ariaLabel ?? "Rich text editor",
				class: cn("tiptap-editor", editorClassName),
				role: "textbox",
			},
		},
		onCreate: ({ editor: activeEditor }) => {
			activeEditorRef.current = activeEditor;
			onMentionInventoryChangeRef.current?.(getEditorMentionInventory(activeEditor));
			refreshDirectoryAutocomplete(activeEditor);
		},
		onUpdate: ({ editor: activeEditor }) => {
			setIsEmpty(activeEditor.isEmpty);
			const markdown = activeEditor.getMarkdown();
			onMarkdownChangeRef.current?.(markdown);
			onPlainTextChangeRef.current?.(markdown);
			onMentionInventoryChangeRef.current?.(getEditorMentionInventory(activeEditor));
			refreshDirectoryAutocomplete(activeEditor);
		},
		onSelectionUpdate: ({ editor: activeEditor }) => {
			refreshDirectoryAutocomplete(activeEditor);
		},
	});

	useEffect(() => {
		if (!editor || requestedViewMode === undefined || requestedViewMode === viewMode) {
			return;
		}

		if (viewMode === "markdown" && requestedViewMode !== "markdown") {
			editor.commands.setContent(markdownSource, {
				contentType: "markdown",
				emitUpdate: false,
			});
			setIsEmpty(!markdownSource.trim());
			onMentionInventoryChangeRef.current?.(getEditorMentionInventory(editor));
		}

		if (requestedViewMode === "markdown") {
			setMarkdownSource(editor.getMarkdown());
		}

		setViewMode(requestedViewMode);
	}, [editor, markdownSource, requestedViewMode, viewMode]);

	useEffect(() => {
		mentionSourcesRef.current = mentionSources;
	}, [mentionSources]);

	useEffect(() => {
		enableDirectoryAutocompleteRef.current = enableDirectoryAutocomplete;
	}, [enableDirectoryAutocomplete]);

	useEffect(() => {
		onAskRovoRef.current = onAskRovo;
	}, [onAskRovo]);

	useEffect(() => {
		onOpenDirectoryRef.current = onOpenDirectory;
	}, [onOpenDirectory]);

	useEffect(() => {
		onMarkdownChangeRef.current = onMarkdownChange;
	}, [onMarkdownChange]);

	useEffect(() => {
		onPlainTextChangeRef.current = onPlainTextChange;
	}, [onPlainTextChange]);

	useEffect(() => {
		onMentionInventoryChangeRef.current = onMentionInventoryChange;
	}, [onMentionInventoryChange]);

	useEffect(() => {
		if (!editor || !mentionRemovalRequest) {
			return;
		}

		removeMentionsFromEditor(editor, mentionRemovalRequest);
		onMentionRemovalRequestHandled?.(mentionRemovalRequest.key);
	}, [editor, mentionRemovalRequest, onMentionRemovalRequestHandled]);

	useEffect(() => {
		if (!editor) {
			return;
		}

		const nextValue = value ?? "";

		if (editor.getMarkdown() === nextValue) {
			return;
		}

		// setContent triggers TipTap's internal flushSync to keep React node views in
		// sync. Calling it inline can land inside React's render/commit phase (React 19
		// concurrent), where flushSync throws. Defer to a microtask so it runs after
		// the current commit drains but before paint (no visible flash).
		let cancelled = false;
		queueMicrotask(() => {
			if (cancelled || editor.isDestroyed) {
				return;
			}

			editor.commands.setContent(nextValue, {
				contentType: "markdown",
				emitUpdate: false,
			});
			setIsEmpty(!nextValue.trim());
			onMentionInventoryChangeRef.current?.(getEditorMentionInventory(editor));
			// setContent above bypasses onUpdate (emitUpdate: false), so any ghost from
			// the prior content is now stale — clear it.
			setDirectoryAutocompleteState(null);
		});

		return () => {
			cancelled = true;
		};
	}, [editor, value, setDirectoryAutocompleteState]);

	useEffect(() => {
		setDataFlowMermaid(baselineDataFlowMermaid);
	}, [baselineDataFlowMermaid]);

	useEffect(() => {
		if (!isDataFlowMode || !dataFlowConfig || !baselineDataFlowMermaid) {
			setIsRefiningDataFlow(false);
			return;
		}

		const abortController = new AbortController();
		const timeoutId = window.setTimeout(() => {
			setIsRefiningDataFlow(true);
			void fetch("/api/studio/agent-data-flow", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					config: dataFlowConfig,
					baselineMermaid: baselineDataFlowMermaid,
				}),
				signal: abortController.signal,
			})
				.then(async (response) => {
					if (!response.ok) {
						return null;
					}
					return await response.json() as { mermaid?: unknown };
				})
				.then((payload) => {
					const refinedMermaid = typeof payload?.mermaid === "string"
						? payload.mermaid
						: "";
					if (isValidAgentDataFlowMermaid(refinedMermaid)) {
						setDataFlowMermaid(refinedMermaid.trim());
					}
				})
				.catch((error) => {
					if (error instanceof DOMException && error.name === "AbortError") {
						return;
					}
				})
				.finally(() => {
					if (!abortController.signal.aborted) {
						setIsRefiningDataFlow(false);
					}
				});
		}, 500);

		return () => {
			window.clearTimeout(timeoutId);
			abortController.abort();
			setIsRefiningDataFlow(false);
		};
	}, [baselineDataFlowMermaid, dataFlowConfig, isDataFlowMode]);
	// oxlint-enable react-doctor/no-adjust-state-on-prop-change

	function handleModeChange(nextMode: EditorToolbarViewMode): void {
		if (!editor) {
			return;
		}

		if (viewMode === nextMode) {
			return;
		}

		if (isMarkdownMode && nextMode !== "markdown") {
			editor.commands.setContent(markdownSource, {
				contentType: "markdown",
				emitUpdate: false,
			});
			setIsEmpty(!markdownSource.trim());
			onMentionInventoryChangeRef.current?.(getEditorMentionInventory(editor));
			updateViewMode(nextMode);
			return;
		}

		if (nextMode === "markdown") {
			setMarkdownSource(editor.getMarkdown());
		}

		updateViewMode(nextMode);
	}

	function handleToggleMarkdownMode(): void {
		handleModeChange(isMarkdownMode ? "rendered" : "markdown");
	}

	function handleMarkdownSourceChange(next: string): void {
		setMarkdownSource(next);
		setIsEmpty(!next.trim());
		onMarkdownChangeRef.current?.(next);
		onPlainTextChangeRef.current?.(next);
	}

	function handleMarkdownFormat(kind: MarkdownFormatKind): void {
		const textarea = textareaRef.current;

		if (!textarea) {
			return;
		}

		let linkUrl: string | undefined;

		if (kind === "link") {
			linkUrl = window.prompt("Enter URL") ?? undefined;

			if (!linkUrl) {
				return;
			}
		}

		const result = applyMarkdownFormat(
			kind,
			{
				value: textarea.value,
				selectionStart: textarea.selectionStart,
				selectionEnd: textarea.selectionEnd,
			},
			{ linkUrl },
		);

		handleMarkdownSourceChange(result.value);

		// Restore focus + selection after React re-renders the controlled textarea.
		requestAnimationFrame(() => {
			const node = textareaRef.current;

			if (!node) {
				return;
			}

			node.focus();
			node.setSelectionRange(result.selectionStart, result.selectionEnd);
		});
	}

	return (
		<div className={cn("space-y-2", toolbarReveal === "hover" && "group", className)} {...props}>
			{showToolbar && editor ? (
				<div
					data-slot="rich-text-editor-toolbar"
					className={cn(
						// In hover mode the toolbar becomes a sticky scroll-state
						// container: it pins to the top of the surrounding scroll
						// container while hover/focus continues to own whether the
						// resting label or interactive controls are visible.
						toolbarReveal === "hover" &&
							"sticky top-0 z-10 [container-type:scroll-state]",
						// The sticky position itself anchors the absolutely-positioned
						// resting row that fills the reserved toolbar space below.
						toolbarClassName,
					)}
				>
					{toolbarReveal === "hover" && toolbarRestingSeparator ? (
						// Resting row that occupies the reserved toolbar space instead
						// of an empty gap. It's the inverse of the
						// reveal child: visible when idle and cross-fading out as the
						// toolbar fades in on hover/focus-within.
						<div
							aria-hidden="true"
							data-slot="rich-text-editor-toolbar-resting-separator"
							className="pointer-events-none absolute inset-x-0 top-0 flex h-8 items-center gap-3 opacity-100 transition-opacity duration-normal ease-out group-hover:opacity-0 group-focus-within:opacity-0 motion-reduce:transition-none"
						>
							{toolbarRestingSeparatorLabel != null ? (
								<span className="shrink-0 text-text-subtlest" style={{ font: token("font.heading.xxsmall") }}>
									{toolbarRestingSeparatorLabel}
								</span>
							) : null}
							<div className="h-px min-w-2 flex-1 bg-border" />
						</div>
					) : null}
					<div
						data-slot="rich-text-editor-toolbar-reveal"
						className={cn(
							// Hidden by default (space stays reserved by the sticky
							// parent above) and revealed on hover/focus.
							// `relative` anchors the stuck ::before that fills any
							// scroll-padding gap above the pinned bar (see CSS).
							toolbarReveal === "hover" &&
								"relative bg-transparent opacity-0 transition-opacity duration-normal ease-out group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none",
							// `padStuckToolbar` reserves 8px of surface below the bar so,
							// once it pins, content scrolling under isn't cramped and no
							// transparent gap shows. Consumers pair it with `space-y-0`.
							padStuckToolbar && "pb-2",
						)}
					>
						<RichTextEditorToolbar
							editor={editor}
							endSlot={toolbarEndSlot}
							isMarkdownMode={isMarkdownMode}
							mode={viewMode}
							showDataFlowMode={Boolean(dataFlowConfig)}
							onModeChange={handleModeChange}
							onToggleMarkdownMode={handleToggleMarkdownMode}
							onMarkdownFormat={handleMarkdownFormat}
							onInsertReferenceOption={onInsertReferenceOption}
						/>
					</div>
					{toolbarReveal === "hover" && stuckToolbarScrollFade ? (
						<StickyRowScrollFade
							data-slot="rich-text-editor-toolbar-scroll-fade"
						/>
					) : null}
				</div>
			) : null}
			{frontmatterEnabled && viewMode === "rendered" ? (
				<div data-slot="rich-text-editor-frontmatter-header" ref={setFrontmatterPortalEl} />
			) : null}
			{toolbarBelowSlot ? (
				<div data-slot="rich-text-editor-toolbar-below">
					{toolbarBelowSlot}
				</div>
			) : null}
			<div
				className={cn("rich-text-editor-content relative", contentClassName)}
				data-empty={isEmpty ? "true" : undefined}
				style={
					placeholder && !placeholderSlot
						? ({
								"--rich-text-placeholder": toCssString(placeholder),
							} as CSSProperties)
						: undefined
					}
				>
				{isDataFlowMode && dataFlowMermaid ? (
					<Suspense fallback={<div className="relative min-h-[480px]" data-rich-text-data-flow-diagram="loading" />}>
						<DataFlowDiagramView
							isRefining={isRefiningDataFlow}
							mermaidCode={dataFlowMermaid}
							diagramLabel={dataFlowDiagramLabel}
						/>
					</Suspense>
				) : isMarkdownMode ? (
					<MarkdownSourceEditor
						ref={textareaRef}
						aria-label={`${ariaLabel ?? "Rich text editor"} Markdown source`}
						data-rich-text-markdown-source
						placeholder={placeholder}
						textareaClassName="min-h-24"
						value={markdownSource}
						onValueChange={handleMarkdownSourceChange}
					/>
				) : (
					<FrontmatterPortalContext value={frontmatterPortalEl}>
						<EditorContent editor={editor} />
					</FrontmatterPortalContext>
				)}
				{placeholderSlot && isEmpty && viewMode === "rendered" ? (
					<div
						aria-hidden="true"
						data-slot="rich-text-editor-placeholder"
						className={cn("pointer-events-none absolute inset-0", contentClassName)}
					>
						{placeholderSlot}
					</div>
				) : null}
				{showBubbleMenu && editor && viewMode === "rendered" ? (
					<RichTextEditorBubbleMenu
						editor={editor}
						onAskRovo={onAskRovo}
					/>
				) : null}
				{showFloatingMenu && editor && viewMode === "rendered" ? (
					<RichTextEditorFloatingMenu
						editor={editor}
					/>
				) : null}
			</div>
		</div>
	);
}

export {
	RichTextEditorBubbleMenu,
	RichTextEditorFloatingMenu,
	RichTextEditorToolbar,
};
export type { RichTextMentionSources };
