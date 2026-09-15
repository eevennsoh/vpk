import type { ComponentDetail } from "@/app/data/component-detail-types";

export const PULL_REQUEST_DETAIL: ComponentDetail = {
	description:
		"Pull-request summary card in three layouts. `dropdown` is a compact two-row list card (author avatar, then `#N` + title with a trailing status lozenge, then GitHub mark + `source → target` branch path and the files / diff metrics) built for selectable lists such as the Jira work-item Pull requests select. `spacious` is the three-row dropdown/summary card: wrapping `#N` + title with a trailing glyph status lozenge, GitHub mark + `source → target`, then an author / files / diff footer. `flyout` is the overlay summary card: wrapping `#N` + title with a trailing status lozenge, author avatar + `Name · relativeTime`, then a divided GitHub mark + `source → target` path and files / `+add` `−del` footer.",
	importStatement: `import { PullRequest } from "@/components/blocks/pull-request";
import type { PullRequestProps } from "@/components/blocks/pull-request";`,
	usage: `import { PullRequest } from "@/components/blocks/pull-request";

<PullRequest
  variant="flyout"
  number={1306}
  title="Add guest checkout to the storefront"
  status="Open"
  author={{ name: "Venn", avatarUrl: "/avatar-user/venn/venn.png" }}
  branch="rovo/rfp-103-response-validation"
  targetBranch="main"
  additions={86}
  deletions={21}
  filesChanged={6}
  relativeTime="1h"
/>`,
	demoLayout: {
		previewContentWidth: "full",
		examplesContentWidth: "full",
	},
	examples: [
		{
			title: "Dropdown compact",
			description:
				"Two-row list card for select menus and other dropdown surfaces. Avatar, `#N` + title with a trailing status lozenge, then GitHub `source → target` and files / diffs.",
			demoSlug: "pull-request-demo-dropdown",
		},
		{
			title: "Dropdown spacious",
			description:
				"Three-row summary card for dropdowns: wrapping title with a trailing glyph status lozenge, GitHub `source → target`, then author / files / diffs. Selectable list chrome.",
			demoSlug: "pull-request-demo-spacious",
		},
		{
			title: "Flyout",
			description:
				"Overlay summary card: wrapping `#N` + title with a trailing status lozenge, author · time, then GitHub `source → target` and files / diff stats.",
			demoSlug: "pull-request-demo-flyout",
		},
	],
	props: [
		{
			name: "variant",
			type: '"dropdown" | "spacious" | "flyout"',
			default: '"dropdown"',
			description:
				"Card layout. `dropdown` is the compact list row; `spacious` is the three-row dropdown card; `flyout` is the overlay summary card.",
		},
		{
			name: "number",
			type: "number",
			required: true,
			description: "Pull request number shown as subtle `#N` before the title.",
		},
		{
			name: "title",
			type: "string",
			required: true,
			description:
				"Pull request title shown after the number. Wraps on spacious and flyout cards; truncates on the compact dropdown row.",
		},
		{
			name: "status",
			type: '"Open" | "Merged"',
			required: true,
			description: "Review state rendered as a status lozenge (Open = success, Merged = discovery).",
		},
		{
			name: "author",
			type: "PullRequestAuthor",
			description:
				"Author name and optional avatar URL. Leads the compact dropdown row; spacious footer avatar; on the flyout, pairs with `relativeTime`.",
		},
		{
			name: "branch",
			type: "string",
			description: "Source / head branch shown before the arrow. Omitted when absent.",
		},
		{
			name: "targetBranch",
			type: "string",
			description: "Target / base branch shown after the arrow (e.g. `main`).",
		},
		{
			name: "additions",
			type: "number",
			required: true,
			description: "Lines added, shown in success green as `+N`.",
		},
		{
			name: "deletions",
			type: "number",
			required: true,
			description: "Lines deleted, shown in danger red as `-N`.",
		},
		{
			name: "filesChanged",
			type: "number",
			description:
				"Number of changed files, rendered as `N files` on every card.",
		},
		{
			name: "timestampMs",
			type: "number",
			description: "Optional absolute timestamp reserved for callers; not rendered on the card.",
		},
		{
			name: "relativeTime",
			type: "string",
			description: "Optional static relative label. Rendered on the flyout as `Name · relativeTime`.",
		},
		{
			name: "selected",
			type: "boolean",
			default: "false",
			description:
				"Marks the card as the active selection in a list. Applied to dropdown compact and spacious chrome; ignored by the flyout overlay.",
		},
		{
			name: "onActivate",
			type: "() => void",
			description: "Turns the card into a pressed button for select-to-open lists.",
		},
	],
};
