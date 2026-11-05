"use client";

import {
	useState,
	type FocusEvent,
	type KeyboardEvent,
	type ReactNode,
	type Ref,
} from "react";
import type { Editor } from "@tiptap/react";

import ArrowUpIcon from "@atlaskit/icon/core/arrow-up";
import AddIcon from "@atlaskit/icon/core/add";
import AttachmentIcon from "@atlaskit/icon/core/attachment";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import AiGenerativeTextIcon from "@atlaskit/icon-lab/core/ai-generative-text";

import { EditorToolbar } from "@/components/blocks/editor-toolbar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { RovoColorIcon } from "@/components/ui/logo";
import { FloatingComposer } from "@/components/projects/shared/components/floating-composer";
import { RovoComposerActionButton } from "@/components/projects/shared/components/rovo-composer-send-controls";
import { floatingComposerTextareaClassName } from "@/components/projects/shared/components/rovo-composer-styles";
import { PromptInputTextarea } from "@/components/ui-custom/prompt-input";
import type {
	RichTextMentionItem,
	RichTextMentionSources,
	RichTextMentionSectionLabels,
	RichTextSuggestionVariantConfig,
} from "@/components/ui-custom/rich-text-editor";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type { JiraActivityActor } from "./jira-activity-types";
import { useJiraActivityComposerDictation } from "./use-jira-activity-composer-dictation";

/**
 * The two floating surfaces this composer serves. They share the prompt editor
 * and submit behaviour but nothing else, so every difference between them lives
 * here rather than as a className blob at each callsite.
 *
 * - `comment` — the standalone/sticky comment bar. Bordered floating box with
 *   the full-size 32px prompt controls and PromptInput's floating backdrop shadow.
 * - `flush` — the reply row nested inside an activity card. Same bordered
 *   floating chrome (rounded border, input fill) with controls tightened to
 *   24px, but `shadow-none` so the soft backdrop never clips in the activity rail.
 *
 * Both surfaces keep FloatingComposer's floating border/fill and the shared
 * compact `p-2` (space.100) inset. Flush also drops the backdrop shadow.
 */
const COMPOSER_SURFACES = {
	comment: {
		// Same compact inset as FloatingComposer (`p-2` / space.100).
		chrome: "p-2",
		// 32px controls at the shared `Button` default, with the default ADS glyph.
		controlClassName: "",
		iconSize: "medium",
	},
	flush: {
		// Keep bordered input chrome; drop the floating backdrop shadow so nested
		// replies are not clipped by scroll ancestors. Only control size differs
		// from `comment` below.
		chrome: "p-2 shadow-none",
		// 24px controls. Shrinking the box on `size="icon"` keeps `rounded-md`;
		// `size="icon-compact"` would also force the glyph to a fixed 12px.
		controlClassName: "size-6",
		// ADS ships a purpose-drawn small glyph; in a 24px box it reads correctly
		// where the default one is optically heavy.
		iconSize: "small",
	},
} as const;

function insertEditorCommand(editor: Editor, command: string): void {
	editor.chain().focus().insertContent(command).run();
}

export function JiraCommentEditorToolbarLeading({ editor }: Readonly<{ editor: Editor }>) {
	return (
		<div className="flex shrink-0 items-center gap-1">
			<Button
				aria-label="Ask Rovo"
				className="gap-1 px-1.5"
				onClick={() => insertEditorCommand(editor, "/ai ")}
				size="compact"
				type="button"
				variant="ghost"
			>
				<RovoColorIcon size="xxsmall" />
				<ChevronDownIcon label="" size="small" />
			</Button>
			<Button
				className="gap-1.5"
				onClick={() => insertEditorCommand(editor, "/Improve description ")}
				size="compact"
				type="button"
				variant="ghost"
			>
				<AiGenerativeTextIcon label="" size="small" />
				Improve description
			</Button>
		</div>
	);
}

export interface JiraActivityComposerProps {
	author: JiraActivityActor;
	placeholder: string;
	/**
	 * `reply` is a plain inline row with an avatar; `comment` is the bordered
	 * floating box with backdrop shadow; `flush` is the same bordered chrome
	 * without shadow and with compact 24px controls for in-card replies.
	 */
	variant?: "reply" | "comment" | "flush";
	onSubmit: (body: string) => void;
	/** Close a host-owned floating composer after nested editor controls dismiss. */
	onEscape?: () => void;
	/** Controlled draft value. Omit to let the composer own its draft. */
	value?: string;
	/** Initial draft for an uncontrolled composer. */
	defaultValue?: string;
	onValueChange?: (value: string) => void;
	/** Ref to the shared prompt editor used by the comment variant. */
	textareaRef?: Ref<HTMLTextAreaElement>;
	/** Expand the comment surface and expose its composer-safe toolbar on focus. */
	expandOnFocus?: boolean;
	/**
	 * Focus the editor on mount. The comment variant is a contentEditable tiptap
	 * editor that initialises asynchronously, so its own `autofocus` config is the
	 * only reliable way in — focusing a ref from a parent effect races the editor.
	 */
	autoFocus?: boolean;
	prefillMentionRequest?: { mention: RichTextMentionItem; requestKey: number; textAfter?: string };
	mentionSources?: RichTextMentionSources;
	mentionSectionLabels?: RichTextMentionSectionLabels;
	suggestionVariant?: RichTextSuggestionVariantConfig;
	/** Optional cue rendered immediately before the submit CTA. */
	submitAccessory?: ReactNode;
	/**
	 * One-turn composer context pill(s) rendered inside the floating prompt
	 * (Activity "Add to chat" / Code Review-style comment chips).
	 */
	inputContext?: ReactNode;
	/**
	 * Body used when the user submits with only `inputContext` and an empty
	 * draft — same pattern as ChatComposer's `composerInputContext.submitText`.
	 */
	inputContextSubmitText?: string;
	className?: string;
}

/**
 * A submit-on-Enter composer shared by the in-card reply row and the bottom
 * comment box. Shift+Enter inserts a newline; empty drafts can't be submitted.
 */
export function JiraActivityComposer({
	author,
	placeholder,
	variant = "comment",
	onSubmit,
	onEscape,
	value: controlledValue,
	defaultValue = "",
	onValueChange,
	textareaRef,
	expandOnFocus = false,
	autoFocus = false,
	prefillMentionRequest,
	mentionSources,
	mentionSectionLabels,
	suggestionVariant,
	submitAccessory,
	inputContext,
	inputContextSubmitText,
	className,
}: Readonly<JiraActivityComposerProps>) {
	const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
	const isExpandableComment = variant === "comment" && expandOnFocus;
	const [isExpanded, setIsExpanded] = useState(isExpandableComment && autoFocus);
	const [editor, setEditor] = useState<Editor | null>(null);
	const value = controlledValue ?? uncontrolledValue;
	const trimmed = value.trim();
	const hasInputContext = inputContext != null;
	const canSubmit = trimmed.length > 0 || hasInputContext;

	function updateValue(nextValue: string) {
		if (controlledValue === undefined) {
			setUncontrolledValue(nextValue);
		}
		onValueChange?.(nextValue);
	}

	const {
		dictationState,
		dictationTranscriptPreview,
		micStream,
		onStartDictation,
		onStopDictation,
	} = useJiraActivityComposerDictation({
		onValueChange: updateValue,
		value,
	});

	function submit() {
		if (!canSubmit) return;
		const body = trimmed || (hasInputContext ? (inputContextSubmitText ?? "").trim() : "");
		if (!body) return;
		onStopDictation();
		onSubmit(body);
		updateValue("");
	}

	function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
		if (event.key === "Escape" && onEscape && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); onEscape(); return; }
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			submit();
		}
	}

	function handleComposerBlur(event: FocusEvent<HTMLFormElement>): void {
		if (
			isExpandableComment
			&& !value.trim()
			&& !event.currentTarget.contains(event.relatedTarget as Node | null)
		) {
			setIsExpanded(false);
		}
	}

	const actions = (
		<div className="flex shrink-0 items-center gap-1">
			<Button aria-label="Attach file" size="icon-compact" type="button" variant="ghost">
				<AttachmentIcon label="" />
			</Button>
			<Button
				aria-label="Send"
				disabled={!canSubmit}
				onClick={submit}
				size="icon-compact"
				type="button"
				variant="ghost"
			>
				<ArrowUpIcon label="" />
			</Button>
		</div>
	);

	if (variant === "reply") {
		return (
			<div className={cn("flex items-center gap-2 p-3", className)}>
				<Avatar className="shrink-0" label={author.name} size="sm">
					{author.avatarSrc ? <AvatarImage alt="" src={author.avatarSrc} /> : null}
					<AvatarFallback>{author.name.slice(0, 1).toUpperCase()}</AvatarFallback>
				</Avatar>
				<Textarea
					aria-label={placeholder}
					autoFocus={autoFocus}
					className="min-h-8 flex-1 py-1.5"
					onChange={(event) => updateValue(event.target.value)}
					onKeyDown={handleKeyDown}
					placeholder={placeholder}
					rows={1}
					value={value}
					variant="none"
				/>
				{actions}
			</div>
		);
	}

	const surface = COMPOSER_SURFACES[variant];
	const expandedToolbar = isExpandableComment && isExpanded && editor ? (
		<div className="flex w-full min-w-0 flex-col gap-2">
			<EditorToolbar
				className="min-h-10"
				controlsOverflow="responsive"
				editor={editor}
				leadingSlot={<JiraCommentEditorToolbarLeading editor={editor} />}
				showFormattingControls={false}
			/>
			{inputContext}
		</div>
	) : inputContext;
	const resolvedPlaceholder = isExpandableComment && isExpanded
		? "Type /ai to ask Rovo or @ to mention someone…"
		: placeholder;

	return (
		<FloatingComposer
			actions={
				<>
					{submitAccessory}
					<RovoComposerActionButton
						canSubmit={canSubmit}
						composerStatus="ready"
						dictationState={dictationState}
						dictationTranscriptPreview={dictationTranscriptPreview}
						micStream={micStream}
						onStartDictation={onStartDictation}
						onStop={onStopDictation}
						onStopDictation={onStopDictation}
						showSubmitWhenEmpty
						submitButtonClassName={surface.controlClassName}
					/>
				</>
			}
			addButton={isExpandableComment && isExpanded ? null : (
				<Button
					aria-label="Add"
					className={surface.controlClassName}
					size="icon"
					type="button"
					variant="ghost"
				>
					<AddIcon label="" size={surface.iconSize} />
				</Button>
			)}
			allowOverflow
			aria-label={placeholder}
			className={cn(
				"w-full",
				surface.chrome,
				isExpandableComment && isExpanded && "rounded-xl",
				className,
			)}
			inputContext={expandedToolbar}
			layout={isExpandableComment && isExpanded ? "stacked" : "auto"}
			onBlurCapture={handleComposerBlur}
			onFocusCapture={() => {
				if (isExpandableComment) setIsExpanded(true);
			}}
			onPointerDownCapture={() => {
				if (isExpandableComment) setIsExpanded(true);
			}}
			onSubmit={submit}
			onKeyDown={(event) => { if (event.key === "Escape" && onEscape && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); onEscape(); } }}
		>
			<PromptInputTextarea
				aria-label={placeholder}
				autoFocus={autoFocus}
				autoResize
				className={cn(
					floatingComposerTextareaClassName,
					"text-sm leading-5",
					isExpandableComment && isExpanded && "min-h-36 py-3",
				)}
				enableDirectoryAutocomplete={false}
				mentionSources={mentionSources}
				mentionSectionLabels={mentionSectionLabels}
				onChange={(event) => updateValue(event.currentTarget.value)}
				onEditorReady={setEditor}
				onEscape={onEscape}
				placeholder={resolvedPlaceholder}
				prefillMentionRequest={prefillMentionRequest}
				ref={textareaRef}
				rows={1}
				suggestionVariant={suggestionVariant}
				value={value}
			/>
		</FloatingComposer>
	);
}
