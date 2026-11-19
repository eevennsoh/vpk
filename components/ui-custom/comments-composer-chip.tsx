"use client";

import CommentIcon from "@atlaskit/icon/core/comment";

import {
	ContextChip,
	type ContextChipItem,
} from "@/components/ui-custom/context-chip";

export type CommentsComposerChipItem = ContextChipItem;

interface CommentsComposerChipProps {
	comments: readonly CommentsComposerChipItem[];
	onRemoveAll: () => void;
	/** Accessible label for the dismiss control. */
	removeAllLabel?: string;
	/** Test id for the chip root. Defaults to `comments-composer-chip`. */
	testId?: string;
}

/**
 * One-turn composer context pill for attached comments. Shared by Code Review
 * inline comments and Activity "Add to chat" (sticky activity composer) so both
 * surfaces render the same count chip + popover + dismiss control.
 */
export function CommentsComposerChip({
	comments,
	onRemoveAll,
	removeAllLabel = "Remove all comments",
	testId = "comments-composer-chip",
}: Readonly<CommentsComposerChipProps>) {
	const countLabel = `${comments.length} ${comments.length === 1 ? "comment" : "comments"}`;

	return (
		<ContextChip
			countLabel={countLabel}
			icon={<CommentIcon label="" size="small" />}
			items={comments}
			onRemoveAll={onRemoveAll}
			removeAllLabel={removeAllLabel}
			testId={testId}
		/>
	);
}
