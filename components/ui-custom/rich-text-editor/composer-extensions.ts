"use client";

import { Extension, Node } from "@tiptap/core";
import { history, redo, undo } from "@tiptap/pm/history";
import { keymap } from "@tiptap/pm/keymap";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { EditorView } from "@tiptap/pm/view";

import {
	createRichTextMentionExtension,
	DismissedAutoTagTracker,
	mapRangeThroughTransaction,
	rangeTextMatches,
	SlashCommand,
} from "./extensions";
import type { RichTextEditorExtensionOptions } from "./types";

/**
 * Minimal schema for the mentions-only chat composer.
 *
 * Unlike the full document editor (`createRichTextEditorExtensions`), the
 * composer is a single-paragraph-friendly contentEditable that supports ONLY
 * plain text, hard breaks, and the shared `@`/`/` mention tokens — no marks
 * (bold/italic/…), no block nodes (headings/lists/tables/code), no markdown,
 * and no input rules. The Document/Paragraph/Text/HardBreak nodes are defined
 * inline via `Node.create` from `@tiptap/core` (a direct dependency) instead of
 * pulling in StarterKit or its transitive node packages.
 */

const ComposerDocument = Node.create({
	name: "doc",
	topNode: true,
	content: "block+",
});

const ComposerParagraph = Node.create({
	name: "paragraph",
	group: "block",
	content: "inline*",
	parseHTML() {
		return [{ tag: "p" }];
	},
	renderHTML() {
		return ["p", 0];
	},
});

const ComposerText = Node.create({
	name: "text",
	group: "inline",
});

const ComposerHardBreak = Node.create({
	name: "hardBreak",
	group: "inline",
	inline: true,
	selectable: false,
	linebreakReplacement: true,
	parseHTML() {
		return [{ tag: "br" }];
	},
	renderHTML() {
		return ["br"];
	},
	addKeyboardShortcuts() {
		const insertHardBreak = () =>
			this.editor.chain().insertContent({ type: this.name }).run();

		// Shift+Enter (and Cmd/Ctrl+Enter) insert a hard break. Plain Enter is
		// reserved for submit (see createComposerSubmit) so it is not bound here.
		return {
			"Shift-Enter": insertHardBreak,
			"Mod-Enter": insertHardBreak,
		};
	},
});

function createComposerHistoryExtension() {
	return Extension.create({
		name: "composerHistory",
		addProseMirrorPlugins() {
			return [
				history(),
				keymap({
					"Mod-z": undo,
					"Shift-Mod-z": redo,
					"Mod-y": redo,
				}),
			];
		},
	});
}

const composerSubmitPluginKey = new PluginKey("composer-submit");
export const composerDirectoryAutocompletePluginKey = new PluginKey<DecorationSet>("composer-directory-autocomplete");
export const composerTraceDecorationPluginKey = new PluginKey<ComposerTraceDecorationPluginState>("composer-trace-decoration");
export const COMPOSER_TRACE_DECORATION_CLASS_NAME = "prompt-input-trace-decoration";
export const COMPOSER_TRACE_DECORATION_PENDING_CLASS_NAME = "prompt-input-trace-decoration-pending";
export const COMPOSER_TRACE_DECORATION_STATIC_CLASS_NAME = "prompt-input-trace-decoration-static";

export type ComposerTraceDecorationMotion = "active" | "static";

export interface ComposerTraceDecoration {
	from: number;
	id: string;
	label: string;
	motion?: ComposerTraceDecorationMotion;
	pending?: boolean;
	to: number;
}

export interface ComposerTraceDecorationPluginState {
	decorations: DecorationSet;
	traces: readonly ComposerTraceDecoration[];
}

export type ComposerTraceDecorationPendingState =
	| { type: "clear" }
	| { decorations: readonly ComposerTraceDecoration[]; type: "set" };

export interface ComposerTraceDecorationController {
	clearTraceDecorations: () => boolean;
	flushPendingTraceDecorations: () => boolean;
	flushPendingTraceDecorationState: () => boolean;
	getPendingTraceDecorationState: () => ComposerTraceDecorationPendingState | null;
	getPendingTraceDecorations: () => readonly ComposerTraceDecoration[];
	getTraceDecorations: () => readonly ComposerTraceDecoration[];
	hasPendingTraceDecorationState: () => boolean;
	setTraceDecorations: (decorations: readonly ComposerTraceDecoration[]) => boolean;
}

type ComposerTraceDecorationDocumentState = Pick<EditorState, "doc">;

const EMPTY_COMPOSER_TRACE_DECORATION_STATE: ComposerTraceDecorationPluginState = {
	decorations: DecorationSet.empty,
	traces: [],
};

function isTraceDecorationMeta(value: unknown): value is ComposerTraceDecorationPendingState {
	return typeof value === "object"
		&& value !== null
		&& (
			(value as { type?: unknown }).type === "clear"
			|| (
				(value as { type?: unknown }).type === "set"
				&& Array.isArray((value as { decorations?: unknown }).decorations)
			)
		);
}

function getComposerTraceDecorationMotion(decoration: ComposerTraceDecoration): ComposerTraceDecorationMotion {
	return decoration.motion === "static" ? "static" : "active";
}

function isValidComposerTraceDecoration(
	state: ComposerTraceDecorationDocumentState,
	decoration: ComposerTraceDecoration,
): decoration is ComposerTraceDecoration {
	if (
		!Number.isSafeInteger(decoration.from)
		|| !Number.isSafeInteger(decoration.to)
		|| decoration.from < 0
		|| decoration.to > state.doc.content.size
		|| decoration.from >= decoration.to
		|| typeof decoration.id !== "string"
		|| typeof decoration.label !== "string"
		|| decoration.id.trim().length === 0
		|| decoration.label.length === 0
	) {
		return false;
	}

	return rangeTextMatches(state.doc, decoration.from, decoration.to, decoration.label);
}

function createComposerTraceDecorationAttributes(decoration: ComposerTraceDecoration) {
	const motion = getComposerTraceDecorationMotion(decoration);
	const className = [
		COMPOSER_TRACE_DECORATION_CLASS_NAME,
		decoration.pending ? COMPOSER_TRACE_DECORATION_PENDING_CLASS_NAME : null,
		motion === "static" ? COMPOSER_TRACE_DECORATION_STATIC_CLASS_NAME : null,
	].filter(Boolean).join(" ");

	return {
		class: className,
		"data-composer-trace": "true",
		"data-composer-trace-id": decoration.id,
		"data-composer-trace-label": decoration.label,
		"data-composer-trace-motion": motion,
		"data-composer-trace-pending": decoration.pending ? "true" : "false",
	};
}

function createComposerTraceDecorationState(
	state: ComposerTraceDecorationDocumentState,
	decorations: readonly ComposerTraceDecoration[],
): ComposerTraceDecorationPluginState {
	const validDecorations = decorations.filter((decoration) =>
		isValidComposerTraceDecoration(state, decoration)
	);

	if (validDecorations.length === 0) {
		return EMPTY_COMPOSER_TRACE_DECORATION_STATE;
	}

	return {
		decorations: DecorationSet.create(
			state.doc,
			validDecorations.map((decoration) =>
				Decoration.inline(
					decoration.from,
					decoration.to,
					createComposerTraceDecorationAttributes(decoration),
					{ inclusiveEnd: false, inclusiveStart: false },
				)
			),
		),
		traces: validDecorations,
	};
}

function mapComposerTraceDecorations(
	transaction: Transaction,
	decorations: readonly ComposerTraceDecoration[],
): readonly ComposerTraceDecoration[] {
	return decorations
		.map((decoration): ComposerTraceDecoration => ({
			...decoration,
			...mapRangeThroughTransaction(transaction.mapping, decoration.from, decoration.to),
		}))
		.filter((decoration) => isValidComposerTraceDecoration(transaction, decoration));
}

export function getComposerTraceDecorationState(state: EditorState): ComposerTraceDecorationPluginState {
	return composerTraceDecorationPluginKey.getState(state) ?? EMPTY_COMPOSER_TRACE_DECORATION_STATE;
}

export function setComposerTraceDecorations(
	view: EditorView,
	decorations: readonly ComposerTraceDecoration[],
): boolean {
	view.dispatch(
		view.state.tr.setMeta(composerTraceDecorationPluginKey, {
			decorations,
			type: "set",
		} satisfies ComposerTraceDecorationPendingState),
	);
	return true;
}

export function clearComposerTraceDecorations(view: EditorView): boolean {
	view.dispatch(
		view.state.tr.setMeta(composerTraceDecorationPluginKey, {
			type: "clear",
		} satisfies ComposerTraceDecorationPendingState),
	);
	return true;
}

export function createComposerTraceDecorationController(
	getEditorView: () => EditorView | null,
): ComposerTraceDecorationController {
	let pendingState: ComposerTraceDecorationPendingState | null = null;

	const applyState = (state: ComposerTraceDecorationPendingState): boolean => {
		const view = getEditorView();
		if (!view) {
			pendingState = state;
			return false;
		}

		if (state.type === "clear") {
			clearComposerTraceDecorations(view);
		} else {
			setComposerTraceDecorations(view, state.decorations);
		}
		pendingState = null;
		return true;
	};

	const flushPendingTraceDecorationState = (): boolean => {
		if (!pendingState) {
			return true;
		}
		return applyState(pendingState);
	};

	return {
		clearTraceDecorations: () => applyState({ type: "clear" }),
		flushPendingTraceDecorations: flushPendingTraceDecorationState,
		flushPendingTraceDecorationState,
		getPendingTraceDecorationState: () => pendingState,
		getPendingTraceDecorations: () => {
			const view = getEditorView();
			const traces = view
				? getComposerTraceDecorationState(view.state).traces
				: pendingState?.type === "set"
					? pendingState.decorations
					: [];
			return traces.filter((decoration) => decoration.pending === true);
		},
		getTraceDecorations: () => {
			const view = getEditorView();
			if (view) {
				return getComposerTraceDecorationState(view.state).traces;
			}
			return pendingState?.type === "set" ? pendingState.decorations : [];
		},
		hasPendingTraceDecorationState: () => pendingState !== null,
		setTraceDecorations: (decorations) => applyState({
			decorations,
			type: "set",
		}),
	};
}

/**
 * True when any `@tiptap/suggestion`-backed palette (the `@` mention menu or the
 * `/` command menu) is currently open. Those plugins store `{ active }` in their
 * own plugin state; while a menu is open Enter/Tab belong to the menu, not the
 * submit handler.
 */
function isSuggestionMenuOpen(view: EditorView): boolean {
	for (const plugin of view.state.plugins) {
		const state = plugin.getState(view.state) as
			| { active?: boolean; range?: unknown; query?: unknown }
			| undefined;
		// @tiptap/suggestion stores `{ active, range, query, ... }`. Match that
		// specific shape rather than any plugin exposing a truthy `active`, so an
		// unrelated plugin storing `{ active: true }` can't permanently suppress
		// Enter-to-submit.
		if (state?.active === true && "range" in state && "query" in state) {
			return true;
		}
	}

	return false;
}

/**
 * Plain Enter (no Shift, not during IME composition) submits the host form;
 * Shift+Enter inserts a hard break (handled by ComposerHardBreak). Also forces
 * pasted clipboard content to plain text so no formatting (and no foreign
 * schema nodes) ever enters the mentions-only document. Runs above Tiptap's
 * base keymap, whose default Enter binding splits the paragraph; explicit menu
 * checks below still let open `@`/`/` suggestions consume Enter.
 */
function createComposerBehavior(
	onEnter?: (view: EditorView) => boolean,
	onPasteFiles?: (files: File[]) => void,
	onEscape?: (view: EditorView) => boolean,
) {
	return Extension.create({
		name: "composerBehavior",
		// Higher than Tiptap's default core keymap priority (100), so plain Enter
		// submits instead of falling through to `splitBlock()`. The external
		// directory autocomplete plugin stays higher for explicit shortcuts, but
		// plain Enter and arrow keys remain reserved for the prompt input.
		priority: 125,
		addProseMirrorPlugins() {
			return [
				new Plugin({
					key: composerSubmitPluginKey,
					props: {
						handleKeyDown: (view, event) => {
							if (event.key === "Escape" && !event.isComposing && !isSuggestionMenuOpen(view) && onEscape) {
								const handled = onEscape(view);
								if (handled) event.stopPropagation();
								return handled;
							}
							if (event.key !== "Enter") {
								return false;
							}
							if (event.shiftKey || event.isComposing) {
								return false;
							}
							if (isSuggestionMenuOpen(view)) {
								return false;
							}

							return onEnter ? onEnter(view) : false;
						},
						handlePaste: (view, event) => {
							const clipboard = event.clipboardData;
							// Pasted files (images, screenshots, files from Finder)
							// become composer attachments, matching the previous
							// native-textarea behavior. Files take precedence over any
							// accompanying text/plain payload.
							if (clipboard?.items && onPasteFiles) {
								const files: File[] = [];
								for (const item of clipboard.items) {
									if (item.kind === "file") {
										const file = item.getAsFile();
										if (file) {
											files.push(file);
										}
									}
								}
								if (files.length > 0) {
									event.preventDefault();
									onPasteFiles(files);
									return true;
								}
							}

							const text = clipboard?.getData("text/plain");
							if (!text) {
								return false;
							}

							event.preventDefault();
							// Drop all clipboard formatting and any non-composer schema
							// nodes: insert plain text, turning newlines into hardBreaks so
							// multi-line pastes keep their line structure without paragraphs.
							const hardBreakType = view.state.schema.nodes.hardBreak;
							const { tr } = view.state;
							const lines = text.split("\n");
							lines.forEach((line, index) => {
								if (index > 0 && hardBreakType) {
									tr.replaceSelectionWith(hardBreakType.create(), false);
								}
								if (line) {
									tr.insertText(line);
								}
							});
							view.dispatch(tr);
							return true;
						},
					},
				}),
			];
		},
	});
}

export interface ComposerDirectoryAutocompleteController {
	acceptActiveListItem: () => boolean;
	acceptGhost: () => boolean;
	acceptIndex: (index: number) => boolean;
	hasAcceptableList: () => boolean;
	hasVisibleList: () => boolean;
}

export interface ComposerDirectoryAutocompleteDecoration {
	from: number;
	text: string;
}

export function createComposerDirectoryAutocomplete(
	controller?: ComposerDirectoryAutocompleteController,
) {
	return Extension.create({
		name: "composerDirectoryAutocomplete",
		// Above ProseMirror's base keymap so a visible external list can own
		// explicit Cmd/Ctrl+number shortcuts before default editor handling.
		priority: 150,
		addProseMirrorPlugins() {
			return [
				new Plugin<DecorationSet>({
					key: composerDirectoryAutocompletePluginKey,
					state: {
						init: () => DecorationSet.empty,
						apply(transaction, current) {
							const meta = transaction.getMeta(composerDirectoryAutocompletePluginKey) as
								| ComposerDirectoryAutocompleteDecoration
								| null
								| undefined;

							if (meta === null) {
								return DecorationSet.empty;
							}

							if (meta?.text) {
								const widget = Decoration.widget(
									meta.from,
									() => {
										const element = document.createElement("span");
										element.className = "prompt-input-directory-autocomplete-ghost";
										element.textContent = meta.text;
										element.setAttribute("aria-hidden", "true");
										return element;
									},
									{ side: 1 },
								);
								return DecorationSet.create(transaction.doc, [widget]);
							}

							return current.map(transaction.mapping, transaction.doc);
						},
					},
					props: {
						decorations(state) {
							return composerDirectoryAutocompletePluginKey.getState(state) ?? DecorationSet.empty;
						},
						handleKeyDown: (_view, event) => {
							if (!controller || event.isComposing || event.altKey) {
								return false;
							}

							if ((event.metaKey || event.ctrlKey) && /^[1-9]$/u.test(event.key) && controller.hasAcceptableList()) {
								event.preventDefault();
								return controller.acceptIndex(Number(event.key) - 1);
							}

							if (event.ctrlKey || event.metaKey) {
								return false;
							}

							if (event.key === "Tab" && !event.shiftKey && controller.hasAcceptableList()) {
								event.preventDefault();
								return controller.acceptActiveListItem();
							}

							if (
								((event.key === "Tab" && !event.shiftKey) || event.key === "ArrowRight") &&
								!controller.hasVisibleList()
							) {
								return controller.acceptGhost();
							}

							return false;
						},
					},
				}),
			];
		},
	});
}

export function createComposerTraceDecorationExtension() {
	return Extension.create({
		name: "composerTraceDecoration",
		addProseMirrorPlugins() {
			return [
				new Plugin<ComposerTraceDecorationPluginState>({
					key: composerTraceDecorationPluginKey,
					state: {
						init: () => EMPTY_COMPOSER_TRACE_DECORATION_STATE,
						apply(transaction, current) {
							const meta = transaction.getMeta(composerTraceDecorationPluginKey);

							if (isTraceDecorationMeta(meta)) {
								if (meta.type === "clear") {
									return EMPTY_COMPOSER_TRACE_DECORATION_STATE;
								}

								return createComposerTraceDecorationState(transaction, meta.decorations);
							}

							if (current.traces.length === 0) {
								return current;
							}

							return createComposerTraceDecorationState(
								transaction,
								mapComposerTraceDecorations(transaction, current.traces),
							);
						},
					},
					props: {
						decorations(state) {
							return getComposerTraceDecorationState(state).decorations;
						},
					},
				}),
			];
		},
	});
}

export interface ComposerEditorExtensionOptions extends RichTextEditorExtensionOptions {
	directoryAutocomplete?: ComposerDirectoryAutocompleteController;
	/** Disable the inline `@` mention and `/` command palettes. */
	enableSuggestionMenus?: boolean;
	/**
	 * Called on a plain (non-Shift, non-IME) Enter when no `@`/`/` menu is open.
	 * Return `true` to consume the keystroke (e.g. after requesting form submit).
	 */
	onEnter?: (view: EditorView) => boolean;
	/** Called on Escape after inline suggestion menus have dismissed. */
	onEscape?: (view: EditorView) => boolean;
	/**
	 * Called with files pasted into the composer (images, etc.) so the host can
	 * turn them into attachments — the contentEditable itself can't hold files.
	 */
	onPasteFiles?: (files: File[]) => void;
}

export function createComposerEditorExtensions(
	options: ComposerEditorExtensionOptions = {},
) {
	// The chat composer anchors its `@`/`/` palette to the prompt-input box
	// (full width, 8px gap, viewport-aware up/down flip) rather than the caret.
	const composerOptions = { ...options, anchorToInput: true, showAskRovoPrompt: false };
	return [
		ComposerDocument,
		ComposerParagraph,
		ComposerText,
		ComposerHardBreak,
		createComposerHistoryExtension(),
		...(options.enableSuggestionMenus === false
			? []
			: [
					createRichTextMentionExtension(composerOptions),
					// The composer's "/" menu surfaces references only — no Format category.
					SlashCommand.configure({ ...composerOptions, includeFormat: false }),
				]),
		// Composer-only: tracks reverted auto-tag spots so they aren't re-converted.
		DismissedAutoTagTracker,
		createComposerTraceDecorationExtension(),
		createComposerDirectoryAutocomplete(options.directoryAutocomplete),
		createComposerBehavior(options.onEnter, options.onPasteFiles, options.onEscape),
	];
}
