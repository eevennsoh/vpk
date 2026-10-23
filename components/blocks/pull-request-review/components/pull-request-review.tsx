"use client";

import { useState } from "react";

import CrossIcon from "@atlaskit/icon/core/cross";

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

import type {
	PullRequestReviewProps,
	PullRequestReviewVariant,
	PullRequestReviewVerdict,
} from "./pull-request-review-types";
import { PullRequestReviewVerdictControl } from "./pull-request-review-verdict";

/** Send stays off until the reviewer has typed a non-empty comment body. */
function canSubmitReview(body: string): boolean {
	return body.trim().length > 0;
}

/**
 * Pull request review composer.
 *
 * One composer with two presentations, not two components: the compact prompt
 * bar a reviewer sees at rest, and the review card it grows into once they
 * engage. Both render the same `FloatingComposer` + `PromptInputTextarea`
 * subtree, so expanding preserves the caret, the draft, and any active mention
 * menu — remounting a second composer for the expanded state would drop all
 * three the moment the user clicks in.
 *
 * The expanded state pins `layout="stacked"` so the editor always owns a
 * full-width row above the controls, instead of only stacking once the draft
 * wraps (the compact default).
 */
export function PullRequestReview({
	ariaLabel,
	autoFocus = false,
	className,
	defaultValue = "",
	defaultVariant = "compact",
	defaultVerdict = "comment",
	expandOnFocus = true,
	inputContext,
	onAddClick,
	onClose,
	onSubmit,
	onValueChange,
	onVariantChange,
	onVerdictChange,
	placeholder = "Leave a comment...",
	commentCount,
	reviewedCount,
	reviewedTotal,
	submitDisabled = false,
	title = "Review",
	value: controlledValue,
	variant: controlledVariant,
	verdict: controlledVerdict,
}: Readonly<PullRequestReviewProps>) {
	const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
	const [uncontrolledVariant, setUncontrolledVariant] =
		useState<PullRequestReviewVariant>(defaultVariant);
	const [uncontrolledVerdict, setUncontrolledVerdict] =
		useState<PullRequestReviewVerdict>(defaultVerdict);

	const value = controlledValue ?? uncontrolledValue;
	const variant = controlledVariant ?? uncontrolledVariant;
	const verdict = controlledVerdict ?? uncontrolledVerdict;
	const isExpanded = variant === "expanded";
	/**
	 * The verdict control renders only in the expanded card, so while compact
	 * there is no verdict on screen — and a selection left over from a previous
	 * expansion must never decide what Send does. Deriving here (rather than
	 * resetting in the dismiss handler) covers every collapse path, including a
	 * host flipping the controlled `variant` without touching this component's
	 * handlers. A compact composer always submits a plain comment.
	 */
	const activeVerdict: PullRequestReviewVerdict = isExpanded
		? verdict
		: "comment";
	/**
	 * Content alone enables Send. Host `submitDisabled` is reserved for hard
	 * blocks (already approved / no handler) — not chapter progress — so a
	 * typed draft never sits behind an unrelated gate.
	 */
	const canSubmit = !submitDisabled && canSubmitReview(value);
	const hasReviewedProgress =
		reviewedCount !== undefined && reviewedTotal !== undefined;
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

	function updateVariant(nextVariant: PullRequestReviewVariant) {
		if (nextVariant === variant) return;
		if (controlledVariant === undefined) {
			setUncontrolledVariant(nextVariant);
		}
		onVariantChange?.(nextVariant);
	}

	function updateVerdict(nextVerdict: PullRequestReviewVerdict) {
		if (controlledVerdict === undefined) {
			setUncontrolledVerdict(nextVerdict);
		}
		onVerdictChange?.(nextVerdict);
	}

	function submit() {
		if (!canSubmit) return;
		const accepted = onSubmit?.({ body: value.trim(), verdict: activeVerdict });
		if (accepted === false) return;
		updateValue("");
	}

	function close() {
		// The dismiss gesture discards the pending verdict as well as collapsing.
		// `activeVerdict` already stops a stale selection from reaching Send, so
		// this is about the next expansion starting clean, not about safety.
		updateVerdict(defaultVerdict);
		updateVariant("compact");
		onClose?.();
	}

	const reviewHeader = isExpanded ? (
		<div className="flex w-full items-center gap-2">
			<h2 className="text-text" style={{ font: token("font.heading.small") }}>
				{title}
			</h2>
			{hasReviewedProgress ? (
				<Badge variant="neutral">{`${reviewedCount}/${reviewedTotal} Reviewed`}</Badge>
			) : null}
			{hasCommentCount ? (
				<Badge variant="neutral">{commentBadgeLabel}</Badge>
			) : null}
			<Button
				aria-label="Close review"
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
		reviewHeader || inputContext ? (
			<>
				{reviewHeader}
				{inputContext}
			</>
		) : null;

	return (
		<FloatingComposer
			actions={
				<>
					{isExpanded ? (
						<PullRequestReviewVerdictControl
							onValueChange={updateVerdict}
							value={verdict}
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
			aria-label={ariaLabel ?? title}
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
						? () => updateVariant("expanded")
						: undefined
				}
				placeholder={placeholder}
				rows={1}
				value={value}
			/>
		</FloatingComposer>
	);
}
