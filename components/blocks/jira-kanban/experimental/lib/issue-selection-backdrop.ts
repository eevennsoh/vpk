import type { JiraIssueSelectionBackdrop } from "@/components/blocks/jira-issue/selection-backdrop";

/** Fusion is column-local and only joins adjacent selected issues. */
export function issueSelectionBackdrop(
	cards: readonly { code: string }[],
	selected: ReadonlySet<string> | undefined,
	index: number,
): JiraIssueSelectionBackdrop {
	if (!selected?.has(cards[index]?.code)) return "rest";
	const before = index > 0 && selected.has(cards[index - 1].code);
	const after = index + 1 < cards.length && selected.has(cards[index + 1].code);
	return before ? after ? "middle" : "end" : after ? "start" : "single";
}

/** Collapse only the spacing that disappears with a contiguous removal run. */
export function issueRemovalSpacing(
	cards: readonly { code: string }[],
	selected: ReadonlySet<string> | undefined,
	removing: ReadonlySet<string>,
	index: number,
): { gaps: number; fusedGaps: number } | undefined {
	if (!removing.has(cards[index].code)) return undefined;
	// One wrapper owns the run's spacing; interior fused seams are already closed.
	if (index > 0 && removing.has(cards[index - 1].code)) return { gaps: 0, fusedGaps: 0 };
	let end = index;
	while (end + 1 < cards.length && removing.has(cards[end + 1].code)) end++;
	const hasBefore = index > 0;
	const hasAfter = end + 1 < cards.length;
	const hasRemainingSeam = hasBefore && hasAfter;
	const gaps = end - index + Number(hasBefore) + Number(hasAfter) - Number(hasRemainingSeam);
	let fusedGaps = 0;
	for (let next = Math.max(1, index); next <= Math.min(end + 1, cards.length - 1); next++) {
		if (selected?.has(cards[next - 1].code) && selected.has(cards[next].code)) fusedGaps++;
	}
	if (hasRemainingSeam && selected?.has(cards[index - 1].code) && selected.has(cards[end + 1].code)) fusedGaps--;
	return { gaps, fusedGaps };
}
