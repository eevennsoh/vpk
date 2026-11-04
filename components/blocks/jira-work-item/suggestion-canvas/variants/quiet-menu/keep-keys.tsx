import { Fragment, type ReactNode } from "react";

const MONTH = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\.?";

/**
 * Tokens that read as one unit and must never break across lines: Jira issue keys (PAY-990), dates
 * (Dec 18, 2026 · Oct 28 · 28 October 2026), and release versions (v2.0 GA, v2 beta).
 */
const UNBREAKABLE = new RegExp(
	[
		"\\b[A-Z][A-Z0-9]+-\\d+\\b",
		`\\b${MONTH} \\d{1,2}(?:, \\d{4})?\\b`,
		`\\b\\d{1,2} ${MONTH}(?: \\d{4})?\\b`,
		"\\bv\\d+(?:\\.\\d+)*(?: (?:GA|beta|RC\\d*))?\\b",
	].join("|"),
	"g",
);

/**
 * Renders text with every issue key, date and version held on one line, so "PAY-990" never breaks at its hyphen
 * and "Dec 18, 2026" never splits month from day. The text still wraps normally everywhere else.
 */
export function KeepKeys({ text }: Readonly<{ text: string }>) {
	const parts: ReactNode[] = [];
	let cursor = 0;
	for (const match of text.matchAll(UNBREAKABLE)) {
		const start = match.index;
		if (start > cursor) parts.push(<Fragment key={`t${cursor}`}>{text.slice(cursor, start)}</Fragment>);
		parts.push(<span className="whitespace-nowrap" key={`k${start}`}>{match[0]}</span>);
		cursor = start + match[0].length;
	}
	if (cursor === 0) return text;
	if (cursor < text.length) parts.push(<Fragment key={`t${cursor}`}>{text.slice(cursor)}</Fragment>);
	return parts;
}
