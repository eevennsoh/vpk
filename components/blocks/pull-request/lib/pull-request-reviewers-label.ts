/**
 * Reviewer sign-off for the flyout's meta line: `0/1 reviewer`, `1/2 reviewers`,
 * or `No reviewers` when nobody is assigned. `approved` never reads above `total`.
 */
export function pullRequestReviewersLabel(reviewers: { approved: number; total: number }): string {
	const total = Math.max(0, Math.floor(reviewers.total));
	if (total === 0) return "No reviewers";
	const approved = Math.min(total, Math.max(0, Math.floor(reviewers.approved)));
	return `${approved}/${total} ${total === 1 ? "reviewer" : "reviewers"}`;
}
