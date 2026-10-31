import type { ComponentDetail } from "@/app/data/component-detail-types";

export const JIRA_ACTIVITY_DETAIL: ComponentDetail = {
	description:
		'A chronological activity timeline that documents work done by humans and AI agents on a Jira work item, in the style of a Linear "Activity" feed. Entries share a single connector spine and come in three kinds: compact events, rich comment cards, and changed-files cards. The header can sort all activity or show only agent-authored cards, including generated outputs.',
	demoLayout: { previewHeight: "fit" },
	importStatement: `import { JiraActivity } from "@/components/blocks/jira-activity";`,
	usage: `import { JiraActivity } from "@/components/blocks/jira-activity";

<JiraActivity defaultSortOrder="ascending" />`,
	examples: [
		{
			title: "Activity card",
			description:
				"Standalone rich activity card with an agent-session header, response content, and a flush in-card reply composer.",
			demoSlug: "jira-activity-demo-activity-card",
		},
		{
			title: "Comment reactions",
			description:
				'Comment cards with the always-visible action row: Reply reveals the composer, and the add-reaction popover toggles emoji pills. This is the default `commentActions="reply-and-reactions"` behavior.',
			demoSlug: "jira-activity-demo-reactions",
		},
	],
	props: [
		{
			name: "entries",
			type: "readonly JiraActivityEntry[]",
			default: "undefined (uncontrolled)",
			description:
				'Controlled timeline entries, oldest first. Each entry\'s `kind` selects its renderer.',
		},
		{
			name: "defaultEntries",
			type: "readonly JiraActivityEntry[]",
			default: "built-in sample data",
			description: "Initial entries for an uncontrolled timeline.",
		},
		{
			name: "onEntriesChange",
			type: "(entries: readonly JiraActivityEntry[]) => void",
			description: "Called with the complete next timeline after a comment or reply is submitted.",
		},
		{
			name: "composer",
			type: "ReactNode | null",
			default: "shared JiraActivityComposer",
			description: "Overrides the bottom composer. Pass null to suppress it.",
		},
		{
			name: "renderCommentAction",
			type: "(entry: JiraActivityCommentEntry) => ReactNode",
			description: "Renders an optional trailing action in each comment card header.",
		},
		{
			name: "renderEntry",
			type: "(entry: JiraActivityEntry) => ReactNode | undefined",
			description: "Optionally replaces one entry body while retaining Jira Activity ordering, filtering, and timeline structure.",
		},
		{
			name: "activeEntryId",
			type: "string",
			description: "Marks one timeline row as the current step with aria-current and a data-active hook.",
		},
		{
			name: "onAddCommentToChat",
			type: "(entry: JiraActivityCommentEntry) => void",
			description:
				'Shows an outlined "Add to chat" control on each comment card header, left of expand/collapse. Callers typically open the agent chat and attach the comment as a composer pill.',
		},
		{
			name: "onAddReplyToChat",
			type: "(reply: JiraActivityReply, entry: JiraActivityCommentEntry) => void",
			description:
				'Same as `onAddCommentToChat` for nested reply cards.',
		},
		{
			name: "commentActions",
			type: '"none" | "reactions" | "reply-and-reactions"',
			default: '"reply-and-reactions"',
			description:
				'Per-comment action row and composer disclosure. `"none"` renders no action row and leaves the reply composer mounted (legacy behavior); `"reactions"` adds reaction pills and Add reaction while keeping the composer mounted; `"reply-and-reactions"` adds a Reply button and hides the composer until Reply is activated.',
		},
		{
			name: "onToggleReaction",
			type: "(entry: JiraActivityCommentEntry, emoji: string) => void",
			description:
				"Handles a reaction toggle externally instead of applying it to local state. Omit to let the built-in reducer toggle the reaction for `currentUser`.",
		},
		{
			name: "onViewSession",
			type: "(item: AgentListItem) => void",
			description: "Called when the View action on a rich agent-session activity card is activated.",
		},
		{
			name: "currentUser",
			type: "JiraActivityActor",
			default: "built-in sample user",
			description:
				"The signed-in viewer. Authors new comments (bottom composer) and replies (in-card composer).",
		},
		{
			name: "sortOrder",
			type: '"ascending" | "descending"',
			default: "undefined (uncontrolled)",
			description: "Controlled timeline ordering. `ascending` shows oldest first.",
		},
		{
			name: "defaultSortOrder",
			type: '"ascending" | "descending"',
			default: '"ascending"',
			description: "Initial ordering when the sort control is uncontrolled.",
		},
		{
			name: "onSortOrderChange",
			type: '(next: "ascending" | "descending") => void',
			description: "Called when the header sort control changes the ordering.",
		},
		{
			name: "filter",
			type: '"all" | "agents-only" | "needs-input" | "comments-only" | "history-only" | "insights-only"',
			default: "undefined (uncontrolled)",
			description:
				"Controlled timeline filter. `agents-only` shows agent cards; `needs-input` shows sessions awaiting the viewer; `comments-only` shows comment entries; `history-only` shows changes and other events; `insights-only` shows captured decisions.",
		},
		{
			name: "defaultFilter",
			type: '"all" | "agents-only" | "needs-input" | "comments-only" | "history-only" | "insights-only"',
			default: '"all"',
			description: "Initial filter when the header view control is uncontrolled.",
		},
		{
			name: "onFilterChange",
			type: '(next: "all" | "agents-only" | "needs-input" | "comments-only" | "history-only" | "insights-only") => void',
			description: "Called when the header view control changes the activity filter.",
		},
		{
			name: "className",
			type: "string",
			description: "Additional classes applied to the root container.",
		},
	],
	subComponents: [
		{
			name: "JiraActivityCard",
			description:
				"Shared activity-card shell for human and agent responses, optional supporting details, replies, and a reply composer.",
			props: [
				{
					name: "item",
					type: "AgentListItem",
					description:
						"Optional session summary that renders the session-specific agent header.",
				},
				{
					name: "agentName",
					type: "string",
					description: "Agent or person name shown when `item` is omitted.",
				},
				{
					name: "timestamp",
					type: "string",
					description:
						"Fixed sent timestamp; running session headers append `Working for …`, needs-input headers append shimmering `Needs input` with trailing animated dots, and plain headers show the timestamp alone.",
				},
				{
					name: "headerAvatar",
					type: "ReactNode",
					description: "Optional leading identity for a plain activity-card header.",
				},
				{
					name: "headerLayout",
					type: '"inline" | "stacked"',
					default: '"inline"',
					description: "Header geometry used when `item` is omitted.",
				},
				{
					name: "onView",
					type: "(item: AgentListItem) => void",
					description: "Called when the session header's View button is activated.",
				},
				{
					name: "details",
					type: "{ label: string; children: ReactNode }",
					description: "Optional expandable supporting detail.",
				},
				{
					name: "replies",
					type: "ReactNode",
					description: "Rendered replies shown in the card footer.",
				},
				{
					name: "replyComposer",
					type: "ReactNode",
					description: "Optional reply composer shown below replies.",
				},
			],
		},
	],
};
