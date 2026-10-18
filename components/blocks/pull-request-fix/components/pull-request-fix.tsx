"use client";

import { type MouseEvent, useRef, useState } from "react";

import CrossIcon from "@atlaskit/icon/core/cross";

import { DEFAULT_PULL_REQUEST_FIX_AGENT_ID } from "@/components/blocks/pull-request-fix/data/pull-request-fix-agents";
import { FloatingComposer } from "@/components/projects/shared/components/floating-composer";
import { floatingComposerTextareaClassName } from "@/components/projects/shared/components/rovo-composer-styles";
import {
	PromptInputSubmit,
	PromptInputTextarea,
} from "@/components/ui-custom/prompt-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import { PullRequestFixAgentPicker } from "./pull-request-fix-agent-picker";
import type {
	PullRequestFixAgentId,
	PullRequestFixProps,
	PullRequestFixVariant,
} from "./pull-request-fix-types";

/** Send stays off until the reviewer has typed a non-empty comment body. */
function canSubmitFix(body: string): boolean {
	return body.trim().length > 0;
}

/**
 * Pull request fix composer.
 *
 * One composer with two presentations, not two components: the compact prompt
 * bar a reviewer sees at rest, and the fix card it grows into once they
 * engage. Both render the same `FloatingComposer` + `PromptInputTextarea`
 * subtree, so expanding preserves the caret, the draft, and any active mention
 * menu — remounting a second composer for the expanded state would drop all
 * three the moment the user clicks in.
 *
 * The expanded state pins `layout="stacked"` so the editor always owns a
 * full-width row above the controls, instead of only stacking once the draft
 * wraps (the compact default).
 */
export function PullRequestFix({
	agentId: controlledAgentId,
	autoFocus = false,
	checkName,
	className,
	defaultAgentId = DEFAULT_PULL_REQUEST_FIX_AGENT_ID,
	defaultValue = "",
	defaultVariant = "compact",
	expandOnFocus = true,
	inputContext,
	onAddClick,
	onAgentChange,
	onClose,
	onSubmit,
	onValueChange,
	onVariantChange,
	placeholder = "write your instruction...",
	commentCount,
	submitDisabled = false,
	title = "Fix",
	value: controlledValue,
	variant: controlledVariant,
}: Readonly<PullRequestFixProps>) {
	const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
	const [uncontrolledVariant, setUncontrolledVariant] =
		useState<PullRequestFixVariant>(defaultVariant);
	const [uncontrolledAgentId, setUncontrolledAgentId] =
		useState<PullRequestFixAgentId>(defaultAgentId);
	const editorRef = useRef<HTMLTextAreaElement>(null);
	const skipNextFocusExpansionRef = useRef(false);

	const value = controlledValue ?? uncontrolledValue;
	const variant = controlledVariant ?? uncontrolledVariant;
	const agentId = controlledAgentId ?? uncontrolledAgentId;
	const isExpanded = variant === "expanded";
	/**
	 * A submission handler plus content enables Send. Host `submitDisabled` is
	 * reserved for other hard blocks (for example, already approved) — not
	 * chapter progress — so a handled typed draft never sits behind an
	 * unrelated gate.
	 */
	const canSubmit = Boolean(onSubmit) && !submitDisabled && canSubmitFix(value);
	const trimmedCheckName = checkName?.trim() ?? "";
	const hasCheckName = trimmedCheckName.length > 0;
	const hasCommentCount = commentCount !== undefined && commentCount > 0;
	const commentBadgeLabel = hasCommentCount
		? `${commentCount} ${commentCount === 1 ? "Comment" : "Comments"}`
		: null;

	function updateValue(nextValue: string) {
		if (controlledValue === undefined) {
			setUncontrolledValue(nextValue);
		}
		onValueChange?.(nextValue);
	}

	function updateVariant(nextVariant: PullRequestFixVariant) {
		if (nextVariant === variant) return;
		if (controlledVariant === undefined) {
			setUncontrolledVariant(nextVariant);
		}
		onVariantChange?.(nextVariant);
	}

	function updateAgentId(nextAgentId: PullRequestFixAgentId) {
		if (controlledAgentId === undefined) {
			setUncontrolledAgentId(nextAgentId);
		}
		onAgentChange?.(nextAgentId);
	}

	function handleEditorFocus() {
		if (skipNextFocusExpansionRef.current) {
			skipNextFocusExpansionRef.current = false;
			return;
		}
		updateVariant("expanded");
	}

	function submit() {
		if (!canSubmit) return;
		if (!onSubmit) return;
		const accepted = onSubmit({ body: value.trim(), agentId });
		if (accepted === false) return;
		updateValue("");
	}

	function close(event: MouseEvent<HTMLButtonElement>) {
		updateVariant("compact");
		onClose?.();
		if (event.detail !== 0) return;
		window.requestAnimationFrame(() => {
			// A controlled host may unmount this composer or move focus elsewhere.
			// Restore only when collapsing removed the focused close button and the
			// compact composer is still mounted.
			if (document.activeElement === document.body && editorRef.current) {
				skipNextFocusExpansionRef.current = true;
				editorRef.current.focus();
			}
		});
	}

	const fixHeader = isExpanded ? (
		<div className="flex w-full items-center gap-2">
			<h2 className="text-text" style={{ font: token("font.heading.small") }}>
				{title}
			</h2>
			{hasCheckName ? (
				<Badge variant="neutral">{trimmedCheckName}</Badge>
			) : null}
			{hasCommentCount ? (
				<Badge variant="neutral">{commentBadgeLabel}</Badge>
			) : null}
			<Button
				aria-label="Close fix"
				className="ml-auto"
				onClick={close}
				size="icon"
				type="button"
				variant="ghost"
			>
				<CrossIcon label="" />
			</Button>
		</div>
	) : null;

	const composerContext =
		fixHeader || inputContext ? (
			<>
				{fixHeader}
				{inputContext}
			</>
		) : null;

	return (
		<FloatingComposer
			actions={
				<>
					{isExpanded ? (
						<PullRequestFixAgentPicker
							onValueChange={updateAgentId}
							value={agentId}
						/>
					) : null}
					<PromptInputSubmit
						className="hover:opacity-90 active:opacity-80"
						disabled={!canSubmit}
						status="ready"
					/>
				</>
			}
			addButtonProps={{ onClick: onAddClick }}
			aria-label={title}
			className={cn(
				"w-full",
				// Expanded reads as a card rather than a bar: a wider gutter, a
				// standing-row gap that matches the header's, and overlay elevation.
				isExpanded &&
					"gap-y-4 p-4 [&_[data-slot=floating-composer-row]]:gap-y-4",
				isExpanded &&
					// Enter-only. The card grows around a composer the reviewer is
					// already focused in, so a bold `ease-out` entrance reads as the
					// surface asserting itself; collapsing is user-initiated and
					// snaps back without competing for attention.
					"animate-in fade-in-0 duration-medium ease-out motion-reduce:animate-none",
				className,
			)}
			inputContext={composerContext}
			layout={isExpanded ? "stacked" : "auto"}
			onSubmit={submit}
		>
			<PromptInputTextarea
				aria-label={placeholder}
				autoFocus={autoFocus}
				autoResize
				className={cn(floatingComposerTextareaClassName, "text-sm leading-5")}
				enableDirectoryAutocomplete={false}
				onChange={(event) => updateValue(event.currentTarget.value)}
				onFocus={
					expandOnFocus && controlledVariant === undefined
						? handleEditorFocus
						: undefined
				}
				placeholder={placeholder}
				ref={editorRef}
				rows={1}
				value={value}
			/>
		</FloatingComposer>
	);
}
