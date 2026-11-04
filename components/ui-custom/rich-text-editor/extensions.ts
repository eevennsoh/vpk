"use client";

import { Extension, mergeAttributes, type Editor } from "@tiptap/core";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import { TaskList } from "@tiptap/extension-list";
import Mention from "@tiptap/extension-mention";
import {
	Table,
	TableCell,
	TableHeader,
	TableRow,
} from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import { Markdown } from "@tiptap/markdown";
import { Plugin, PluginKey, TextSelection, type EditorState } from "@tiptap/pm/state";
import { Suggestion, exitSuggestion } from "@tiptap/suggestion";
import StarterKit from "@tiptap/starter-kit";
import { ReactNodeViewRenderer } from "@tiptap/react";

import { EDITOR_PALETTE_MENTION_SOURCES } from "@/components/blocks/editor-palette/data/mention-sources";
import { RichTextCodeBlock } from "./code-block-node";
import { FrontmatterNode } from "./frontmatter-node";
import { RichTextMentionNodeView } from "./mention-node-view";
import { RichTextTaskItem } from "./task-item-node";
import {
	createMentionTokenParser,
	mentionMarkdownTokenizer,
	MENTION_MARKDOWN_TOKEN_NAME,
	type MentionTokenResolver,
	serializeMentionNode,
} from "./mention-token-codec";
import {
	getRichTextMentionVisualAttrs,
	getRichTextMentionVisualDOMSpec,
	getRichTextMentionVisualFromAttrs,
} from "./mention-visual";
import { isRichTextReferenceCategory } from "./reference-categories";
import {
	createMentionSuggestionRenderer,
	createSlashSuggestionRenderer,
	type RichTextSlashAction,
} from "./suggestion-menu";
import {
	resolveCommandVariant,
	resolveMentionVariant,
} from "./types";
import type {
	RichTextEditorExtensionOptions,
	RichTextMentionItem,
} from "./types";

const slashCommandPluginKey = new PluginKey("rich-text-slash-command");

/**
 * Resolve a mention's category. Prefers an explicit non-empty `category`
 * (stored on the node), else derives it from the `id` prefix (`skill:foo` →
 * `skill`), falling back to `"context"`. Single source for every mention
 * surface (node view, editor inventory).
 */
export function getMentionCategory(id: unknown, category?: unknown): string {
	if (typeof category === "string" && category.trim()) {
		return category;
	}

	if (typeof id !== "string") {
		return "context";
	}

	return id.split(":")[0] || "context";
}

export function getMentionNodeAttrs(mention: RichTextMentionItem) {
	return {
		category: mention.category,
		id: mention.id,
		label: mention.label,
		mentionSuggestionChar: "@",
		...getRichTextMentionVisualAttrs(mention.visual),
	};
}

/**
 * Resolve a `@[category:id]` markdown token back to the mention attrs the node
 * view needs, looking the id up in the shared editor-palette directory (the same
 * source the `@`/`/` palettes draw from). Returns `undefined` for an unknown id
 * so the codec leaves the token as plain text. Lookup is by exact `id` because a
 * token carries the id, not the label.
 */
/** Humanizes a mention id (`"app:google-calendar"` → `"Google Calendar"`) for the unknown-app chip label. */
function labelFromMentionId(id: string): string {
	const lastSegment = id.split(":").pop() ?? id;
	return lastSegment
		.split(/[-_\s]+/u)
		.filter(Boolean)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ") || lastSegment;
}

const resolveMentionToken: MentionTokenResolver = (category, id) => {
	if (!isRichTextReferenceCategory(category)) {
		return undefined;
	}

	const item = EDITOR_PALETTE_MENTION_SOURCES[category]?.find(
		(candidate) => candidate.id === id,
	);
	if (item) {
		return {
			label: item.label,
			attrs: getRichTextMentionVisualAttrs(item.visual),
		};
	}

	// Unknown `app` id: still render a chip (a default lozenge with no brand logo)
	// so generated or typed app references like `/foobar` become tags instead of
	// literal `@[app:foobar]` text. Scoped to `app` only — other categories keep
	// the passthrough-as-text behavior so a later ingest pass can repair them.
	if (category === "app") {
		return { label: labelFromMentionId(id), attrs: {} };
	}

	return undefined;
};

/**
 * A spot the user reverted from tag → text. The auto-tagger leaves it as text
 * until the content there changes, at which point the spot is forgotten so a
 * later retype of the same word converts to a tag again.
 */
interface DismissedAutoTagRange {
	from: number;
	to: number;
	/** The reverted text; the spot is dropped once the content here no longer matches. */
	text: string;
}

interface DismissedAutoTagPluginState {
	ranges: readonly DismissedAutoTagRange[];
}

type DismissedAutoTagMeta =
	| { type: "add"; range: DismissedAutoTagRange }
	| { type: "clear" };

const dismissedAutoTagPluginKey = new PluginKey<DismissedAutoTagPluginState>(
	"rich-text-dismissed-auto-tags",
);

/**
 * Placeholder substituted for non-text leaf nodes (e.g. mentions) in
 * `Node.textBetween` reads. Shared so the auto-tag matcher, trace-decoration
 * validation, and dismissed-spot pruning all compare against one sentinel.
 */
export const RICH_TEXT_OBJECT_REPLACEMENT = "￼";

/**
 * Map a `[from, to]` range through a transaction, biasing the endpoints inward
 * (`from` forward, `to` backward) so the range does not swallow inserts at its
 * boundaries. Shared by the dismissed-spot plugin and the trace-decoration mapper
 * so both track positions identically.
 */
export function mapRangeThroughTransaction(
	mapping: { map(pos: number, assoc?: number): number },
	from: number,
	to: number,
): { from: number; to: number } {
	return { from: mapping.map(from, 1), to: mapping.map(to, -1) };
}

/**
 * Whether the document text in `[from, to]` still equals `text`
 * (case-insensitive, with non-text leaves read as {@link RICH_TEXT_OBJECT_REPLACEMENT}).
 * Callers must ensure `from < to`. Used to decide a mapped range is still "live".
 */
export function rangeTextMatches(
	doc: { textBetween(from: number, to: number, blockSeparator?: string, leafText?: string): string },
	from: number,
	to: number,
	text: string,
): boolean {
	return (
		doc.textBetween(from, to, "\n", RICH_TEXT_OBJECT_REPLACEMENT).toLowerCase() ===
		text.toLowerCase()
	);
}

/**
 * Tracks reverted occurrences by position (not by text), mapping them through
 * every edit and dropping any whose text changed. This makes a revert local and
 * temporary: the specific word stays text until you edit/remove it, while a fresh
 * retype — or the same word typed elsewhere — auto-tags normally.
 */
function createDismissedAutoTagPlugin(): Plugin<DismissedAutoTagPluginState> {
	return new Plugin<DismissedAutoTagPluginState>({
		key: dismissedAutoTagPluginKey,
		state: {
			init: () => ({ ranges: [] }),
			apply(tr, value, _oldState, newState) {
				const meta = tr.getMeta(dismissedAutoTagPluginKey) as DismissedAutoTagMeta | undefined;
				if (meta?.type === "clear") {
					return value.ranges.length === 0 ? value : { ranges: [] };
				}

				// Fold a newly reverted spot (recorded in pre-transaction coords) into
				// the set so it maps through this same transaction uniformly with the
				// existing spots — no second coordinate frame to keep in sync.
				let ranges = meta?.type === "add" ? [...value.ranges, meta.range] : value.ranges;

				// Skip the per-edit map/filter entirely in the common empty case so a
				// keystroke with no tracked spots allocates nothing and preserves the
				// state object identity.
				if (tr.docChanged && ranges.length > 0) {
					ranges = ranges
						.map((range) => ({
							...range,
							...mapRangeThroughTransaction(tr.mapping, range.from, range.to),
						}))
						// Case-insensitive on purpose: a reverted word stays text through a
						// re-casing; only a content change re-enables auto-tagging.
						.filter((range) => range.from < range.to && rangeTextMatches(newState.doc, range.from, range.to, range.text));
				}

				return ranges === value.ranges ? value : { ranges };
			},
		},
	});
}

/**
 * Registers the dismissed-auto-tag plugin. Deliberately composer-only — added to
 * {@link createComposerEditorExtensions}, NOT the full document editor — since only
 * the composer auto-tags (and therefore reverts) tokens. Kept beside the
 * {@link RichTextMention} command that drives it; mirrors the position-mapping
 * pattern in `mapComposerTraceDecorations` (composer-extensions.ts).
 */
export const DismissedAutoTagTracker = Extension.create({
	name: "dismissedAutoTagTracker",
	addProseMirrorPlugins() {
		return [createDismissedAutoTagPlugin()];
	},
});

/**
 * Reverted spots the auto-tagger should leave as text, mapped to current
 * positions. Empty when the mention extension (and its plugin) isn't installed.
 */
export function getDismissedAutoTagRanges(
	state: EditorState,
): readonly { from: number; to: number }[] {
	return dismissedAutoTagPluginKey.getState(state)?.ranges ?? [];
}

/** Forget every reverted spot (e.g. when the draft is cleared or replaced). */
export function clearDismissedAutoTags(editor: Editor): void {
	const { state, view } = editor;
	if (dismissedAutoTagPluginKey.getState(state)?.ranges.length) {
		view.dispatch(state.tr.setMeta(dismissedAutoTagPluginKey, { type: "clear" }));
	}
}

export const RichTextMention = Mention.extend({
	// Teach tiptap-markdown to round-trip a mention as `@[category:id]`. Without
	// these the node is dropped from the markdown `value` (it has no default
	// markdown spec), so an agent's tokenized `instructions` lose their lozenges.
	markdownTokenName: MENTION_MARKDOWN_TOKEN_NAME,
	markdownTokenizer: mentionMarkdownTokenizer,
	parseMarkdown: createMentionTokenParser(resolveMentionToken),
	renderMarkdown: serializeMentionNode,
	selectable: true,
	addAttributes() {
		return {
			...(this.parent?.() ?? {}),
			category: {
				default: null,
				parseHTML: (element: HTMLElement) => element.getAttribute("data-mention-category"),
				renderHTML: (attributes: Record<string, unknown>) => (
					attributes.category ? { "data-mention-category": attributes.category } : {}
				),
			},
			// Set only by the composer's visual-trace auto-tagging when it converts
			// typed text into a token. Holds the exact original text so a revert
			// (Backspace at the caret, or the chip's swap control) restores what the
			// user typed. Its presence also marks a token as auto-converted, so the
			// revert affordances stay off deliberate `@`/`/` mentions (which leave
			// this null).
			sourceText: {
				default: null,
				parseHTML: (element: HTMLElement) => element.getAttribute("data-source-text"),
				renderHTML: (attributes: Record<string, unknown>) => (
					attributes.sourceText ? { "data-source-text": attributes.sourceText } : {}
				),
			},
			visualIconKey: {
				default: null,
				parseHTML: (element: HTMLElement) => element.getAttribute("data-visual-icon-key"),
				renderHTML: (attributes: Record<string, unknown>) => (
					attributes.visualIconKey ? { "data-visual-icon-key": attributes.visualIconKey } : {}
				),
			},
			visualIconColor: {
				default: null,
				parseHTML: (element: HTMLElement) => element.getAttribute("data-visual-icon-color"),
				renderHTML: (attributes: Record<string, unknown>) => (
					attributes.visualIconColor ? { "data-visual-icon-color": attributes.visualIconColor } : {}
				),
			},
			visualKind: {
				default: null,
				parseHTML: (element: HTMLElement) => element.getAttribute("data-visual-kind"),
				renderHTML: (attributes: Record<string, unknown>) => (
					attributes.visualKind ? { "data-visual-kind": attributes.visualKind } : {}
				),
			},
			visualLogoName: {
				default: null,
				parseHTML: (element: HTMLElement) => element.getAttribute("data-visual-logo-name"),
				renderHTML: (attributes: Record<string, unknown>) => (
					attributes.visualLogoName ? { "data-visual-logo-name": attributes.visualLogoName } : {}
				),
			},
			visualShape: {
				default: null,
				parseHTML: (element: HTMLElement) => element.getAttribute("data-visual-shape"),
				renderHTML: (attributes: Record<string, unknown>) => (
					attributes.visualShape ? { "data-visual-shape": attributes.visualShape } : {}
				),
			},
			visualSrc: {
				default: null,
				parseHTML: (element: HTMLElement) => element.getAttribute("data-visual-src"),
				renderHTML: (attributes: Record<string, unknown>) => (
					attributes.visualSrc ? { "data-visual-src": attributes.visualSrc } : {}
				),
			},
		};
	},
	addNodeView() {
		return ReactNodeViewRenderer(RichTextMentionNodeView);
	},
	addCommands() {
		return {
			// Replace the auto-tagged mention node at `pos` with the exact text it was
			// converted from, and record that spot so the auto-tagger leaves it as text
			// until the user edits it. No-op for non-auto-tagged mentions (no sourceText).
			restoreAutoTaggedMention:
				(pos: number) =>
				({ state, dispatch, tr }) => {
					const node = state.doc.nodeAt(pos);
					if (!node || node.type.name !== "mention") {
						return false;
					}

					const sourceText = node.attrs.sourceText;
					if (typeof sourceText !== "string" || !sourceText) {
						return false;
					}

					// Side effects (the revert + recording the dismissed spot) only run on
					// a real dispatch — a dry-run (`editor.can()`) must stay side-effect-free.
					if (dispatch) {
						const from = pos;
						const to = pos + node.nodeSize;
						tr.replaceWith(from, to, state.schema.text(sourceText));
						tr.setSelection(TextSelection.create(tr.doc, from + sourceText.length));
						// Record the spot in pre-replace coords (the mention's span); the
						// plugin maps it through this transaction to land on the inserted text.
						tr.setMeta(dismissedAutoTagPluginKey, {
							type: "add",
							range: { from, to, text: sourceText },
						});
						dispatch(tr);
					}

					return true;
				},
		};
	},
});

declare module "@tiptap/core" {
	interface Commands<ReturnType> {
		richTextMention: {
			/** Revert an auto-tagged mention node (one with `sourceText`) back to plain text. */
			restoreAutoTaggedMention: (pos: number) => ReturnType;
		};
	}
}

export const SlashCommand = Extension.create<RichTextEditorExtensionOptions>({
	name: "slashCommand",

	addProseMirrorPlugins() {
		const getMentionSources = this.options.getMentionSources;
		const includeFormat = this.options.includeFormat ?? true;
		const showAskRovoPrompt = this.options.showAskRovoPrompt ?? true;
		// The "/" command menu resolves to the command variant (object form lets
		// Studio keep "/" nested while "@" stays flat).
		const suggestionVariant = resolveCommandVariant(this.options.suggestionVariant);

		return [
			Suggestion<RichTextSlashAction, RichTextSlashAction>({
				editor: this.editor,
				char: "/",
				pluginKey: slashCommandPluginKey,
				// The renderer computes visible items from the slash command list and
				// the live mention sources, so Tiptap does not need a static list.
				items: () => [],
				command: ({ editor, range, props }) => {
					if (props.type === "mention") {
						editor
							.chain()
							.focus()
							.insertContentAt(range, [
								{
									type: "mention",
									attrs: getMentionNodeAttrs(props.mention),
								},
								{ type: "text", text: " " },
							])
							.run();
						return;
					}

					editor.chain().focus().deleteRange(range).run();
					if (props.type === "ask-rovo") {
						props.onAskRovo?.(editor);
						return;
					}

					props.run(editor);
				},
				render: () => createSlashSuggestionRenderer(
					getMentionSources,
					this.options.onAskRovo,
					includeFormat,
					this.options.anchorToInput,
					suggestionVariant,
					showAskRovoPrompt,
					this.options.onOpenDirectory,
					(editor) => exitSuggestion(editor.view, slashCommandPluginKey),
				),
			}),
		];
	},
});

/**
 * The configured `@` mention extension shared by the full document editor and
 * the mentions-only chat composer. Both surfaces insert the same mention node
 * (visual node view, `data-mention-category`, "@" suggestion) so a token reads
 * identically wherever it is created.
 */
export function createRichTextMentionExtension(
	options: RichTextEditorExtensionOptions = {},
) {
	return RichTextMention.configure({
		HTMLAttributes: {
			class: "rich-text-mention",
		},
		deleteTriggerWithBackspace: true,
		renderText: ({ node }) => `@${node.attrs.label ?? node.attrs.id}`,
		renderHTML: ({ node, options: mentionOptions }) => [
			"span",
			mergeAttributes(
				mentionOptions.HTMLAttributes,
				{
					"data-mention-category": node.attrs.category ?? getMentionCategory(node.attrs.id),
					"data-type": "mention",
				},
			),
			...[
				getRichTextMentionVisualDOMSpec(getRichTextMentionVisualFromAttrs(node.attrs)) ?? [
					"span",
					{ "aria-hidden": "true", class: "rich-text-mention-trigger" },
					"@",
				],
				[
					"span",
					{ class: "rich-text-mention-label" },
					node.attrs.label ?? node.attrs.id,
				],
			],
		],
		suggestion: {
			char: "@",
			items: () => [],
			command: ({ editor, range, props }) => {
				const mention = props as RichTextMentionItem;
				editor
					.chain()
					.focus()
					.insertContentAt(range, [
						{
							type: "mention",
							attrs: getMentionNodeAttrs(mention),
						},
						{ type: "text", text: " " },
					])
					.run();
			},
			render: () => createMentionSuggestionRenderer(
				options.getMentionSources,
				options.anchorToInput,
				resolveMentionVariant(options.suggestionVariant),
				options.mentionSectionLabels,
			),
		},
	});
}

export function createRichTextEditorExtensions(
	options: RichTextEditorExtensionOptions = {},
) {
	return [
		StarterKit.configure({
			trailingNode: options.trailingNode,
			link: false,
			underline: false,
			// Replaced by RichTextCodeBlock so ```mermaid fences get a NodeView.
			codeBlock: false,
		}),
		RichTextCodeBlock,
		// Registered AFTER StarterKit so `paragraph` stays the default block type for
		// the doc's `block+` content (an empty/cleared doc fills with a paragraph,
		// not this atom). Opt-in: only present for the skill editor.
		...(options.frontmatter?.enabled ? [FrontmatterNode] : []),
		Underline,
		Link.configure({
			openOnClick: false,
			HTMLAttributes: {
				class: "editor-link",
			},
		}),
		TextAlign.configure({
			types: ["heading", "paragraph"],
			alignments: ["left", "center", "right"],
		}),
		TextStyle,
		Color,
		Highlight.configure({
			multicolor: true,
		}),
		TaskList.configure({
			HTMLAttributes: {
				class: "rich-text-task-list",
			},
		}),
		RichTextTaskItem.configure({
			nested: true,
			HTMLAttributes: {
				class: "rich-text-task-item",
			},
		}),
		Table.configure({
			resizable: true,
			HTMLAttributes: {
				class: "rich-text-table",
			},
		}),
		TableRow,
		TableHeader,
		TableCell,
		createRichTextMentionExtension(options),
		SlashCommand.configure(options),
		Markdown.configure({
			indentation: {
				style: "tab",
				size: 1,
			},
		}),
	];
}
