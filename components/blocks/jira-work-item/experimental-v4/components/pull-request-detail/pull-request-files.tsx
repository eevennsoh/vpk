import { CodeReview } from "@/components/blocks/code-review";
import type { CodeReviewCommit } from "@/components/blocks/code-review/data/types";
import type { InlineReviewComment } from "@/components/blocks/code-review/lib/inline-comments";

import type { PullRequestGuidedReview } from "@/components/blocks/jira-work-item/experimental-v4/lib/pull-request-detail-data";

export function PullRequestFiles({
	commits,
	initialInlineComments,
	onInlineCommentsChange,
	review,
}: Readonly<{
	commits?: readonly CodeReviewCommit[];
	initialInlineComments?: readonly InlineReviewComment[];
	onInlineCommentsChange?: (comments: readonly InlineReviewComment[]) => void;
	review: PullRequestGuidedReview;
}>) {
	return (
		<section aria-label="Changed files">
			<CodeReview
				commits={commits}
				defaultSelectedFileId={review.files[0]?.id}
				embedded
				expandContent
				explorerRootLabel="Guest checkout"
				files={review.files}
				initialInlineComments={initialInlineComments}
				onInlineCommentsChange={onInlineCommentsChange}
			/>
		</section>
	);
}
