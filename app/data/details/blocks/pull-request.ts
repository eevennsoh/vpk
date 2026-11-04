import type { ComponentDetail } from "@/app/data/component-detail-types";

export const PULL_REQUEST_DETAIL: ComponentDetail = {
	description:
		"Pull-request summary card in three layouts. `dropdown` is a compact two-row list card (author avatar, then `#N` + title with a trailing status lozenge, then GitHub mark + `source → target` branch path and the files / diff metrics) built for selectable lists such as the Jira work-item Pull requests select. `spacious` is the three-row dropdown/summary card: wrapping `#N` + title with a trailing glyph status lozenge, GitHub mark + `source → target`, then an author / files / diff footer. `flyout` is the overlay summary card: a linked title when a URL is supplied, author and reviewer metadata, repository, branch path, diff stats, expandable CI checks, a Review link, and a Fix PR action when checks fail.",
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
  repository="acme/storefront"
  checks={checks}
  reviewHref="https://github.com/acme/storefront/pull/1306/files"
  href="https://github.com/acme/storefront/pull/1306"
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
				"Overlay summary card: linked title with a trailing status lozenge, author · time · reviewers, then repository, branch path, diff stats, CI checks, Review, and Fix PR when checks fail.",
			demoSlug: "pull-request-demo-flyout",
		},
		{
			title: "CI checks",
			description:
				"The flyout's expandable CI checks row in every state: yet to be run, running, a mixed in-progress run, all successful, and failed. The summary shows `passed/total builds passed` with a segmented status ring. Each check is a single-status ring (lime passed, red failed), a dashed circle when yet to run, or a spinner while running; failure reasons and elapsed times stay available to screen readers.",
			demoSlug: "pull-request-demo-checks",
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
			type: '"Open" | "Merged" | "Draft" | "Failed"',
			required: true,
			description: "Review state rendered as a status lozenge: Draft, Open, Merged, or Failed.",
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
			name: "reviewers",
			type: "{ approved: number; total: number }",
			description:
				"Flyout only. Reviewer sign-off appended to the `Name · time` line: `0/1 reviewer`, `1/2 reviewers`, or `No reviewers` when `total` is 0. Omitted when absent.",
		},
		{
			name: "provider",
			type: '"github" | "bitbucket"',
			default: '"github"',
			description: "Flyout only. Source-control host mark shown on the repository row (or the branch row when no repository is given).",
		},
		{
			name: "repository",
			type: "string",
			description: "Flyout only. `workspace/repo` shown beside the provider mark. Omitted when absent.",
		},
		{
			name: "checks",
			type: "readonly PullRequestCheck[]",
			description:
				"Flyout only. CI checks (`queued`, `running`, `passed`, `failed`). The row reads `3/3 builds passed` (plus `· N failed` when applicable) with a segmented status ring, and expands inline into the full checks list. Omitted when absent or empty.",
		},
		{
			name: "reviewHref",
			type: "string",
			description: "Flyout only. Renders the primary Review action as a link. The action is omitted without it.",
		},
		{
			name: "href",
			type: "string",
			description: "Flyout only. Makes the pull request title an external link when supplied.",
		},
		{
			name: "onFix",
			type: "(checks: readonly PullRequestCheck[]) => void",
			description: "Called with failed CI checks when Fix PR is selected.",
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
