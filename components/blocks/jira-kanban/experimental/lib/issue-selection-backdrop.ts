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
