import type { ComponentDetail } from "@/app/data/component-detail-types";

export const AGENT_SESSION_DETAIL: ComponentDetail = {
	description:
		'Agent sessions come in large, medium detached, medium attached, and small footprints. Large rows support unlinked, short, and long densities, with agent, pull request, host, time, and access metadata where available. Hover or focus a timestamp to see its full date, or a pull request to see its preview. The trailing status shows Working, Needs input, or Finished. Owners have a more-actions menu; team viewers can open a read-only chat when the host enables it, while private and expired sessions retain their access restrictions. Local owners can continue in the agent or Terminal; cloud owners can rename or delete. The Team sessions example demonstrates the Rovo conversation and question flow for owners and viewers.',
	demoLayout: { previewHeight: "fit" },
	examples: [
		{
			title: "Session sizes and permissions",
			description: "Compare large, medium, and small session rows across personal, private, and team sessions, including working, needs input, and finished states.",
			demoSlug: "agent-session-demo-comparison",
		},
		{
			title: "Team sessions",
			description: "Cloud sessions shown for both owners and viewers. Both can view the conversation and answer questions; only the owner can send chat messages. Viewers see an owner and status bar.",
			demoSlug: "agent-session-demo-team",
		},
		{
			title: "Unlinked sessions",
			description:
				"The default avatar-led row for an unlinked local session, shown as owner and viewer. The owner can continue in the agent or Terminal; the viewer sees the session's access information.",
			demoSlug: "agent-session-demo-unlinked",
		},
		{
			title: "Local — short",
			description:
				"A compact title-led row for a linked local session, with the agent and invoker in the metadata line. The owner can continue in the agent or Terminal; a viewer sees the session's access information.",
			demoSlug: "agent-session-demo-local-short",
		},
		{
			title: "Local — long",
			description:
				"Title-led owner and viewer rows with agent, pull request, host, time, and access metadata. The lifecycle remains at the right.",
			demoSlug: "agent-session-demo-local-long",
		},
		{
			title: "Cloud — short",
			description:
				"Compact hosted-session rows. An owner can rename or delete a session, while a viewer sees its lifecycle and access information.",
			demoSlug: "agent-session-demo-cloud-short",
		},
		{
			title: "Cloud — long",
			description:
				"Hosted owner, viewer, and expired sessions in the title-led density. Both owner and viewer rows show the lifecycle; expired rows offer Delete and explain the 28-day retention window.",
			demoSlug: "agent-session-demo-cloud-long",
		},
		{
			title: "Medium detached",
			description:
				"A 276px stroked white chip — the Jira issue card width — with 10px corners, the same 32px agent+human identity as an unlinked row, the session title, and a trailing up-arrow key. Still detached from Jira work, with the untracked-work flyout.",
			demoSlug: "agent-session-demo-medium-detached",
		},
		{
			title: "Medium attached",
			description:
				"The Jira Issue agent activity row across one agent working, several agents working as Agent Loading, a session that needs input, and a finished session.",
			demoSlug: "agent-session-demo-medium-attached",
		},
		{
			title: "Small",
			description:
				"The shared 12×2px session mark from the collapsed Agent Session Column rail, with the same session flyout available on hover or focus.",
			demoSlug: "agent-session-demo-small",
		},
		{
			title: "Drag",
			description:
				"Large cards as drag handles. A session travels as an elevated identity chip on the pointer while its card stays in place; mark several sessions first and they travel together as a stacked deck with a count. Nothing accepts a drop here, so every release snaps back.",
			demoSlug: "agent-session-demo-drag",
		},
	],
	importStatement: `import { AgentSession } from "@/components/blocks/agent-session";`,
	usage: `import { AgentSession } from "@/components/blocks/agent-session";

<AgentSession
  onCreateWorkItem={(item) => console.log("create", item.id)}
  onLinkWorkItem={(item) => console.log("link", item.id)}
/>`,
	props: [
		{
			name: "variant",
			type: '"large" | "medium-detached" | "medium-attached" | "small"',
			default: '"large"',
			description:
				"Visual footprint and Jira relationship. Medium detached is uncaptured local work; Medium attached is the canonical Jira Issue activity row for work with an existing relationship.",
		},
		{
			name: "density",
			type: '"unlinked" | "short" | "long"',
			default: '"unlinked"',
			description:
				"Row shape for the large footprint. `unlinked` leads a local session with a 32px identity; `short` and `long` are title-led and show identity, pull request, host, and time metadata. Ignored by the medium and small footprints, which have fixed geometry.",
		},
		{
			name: "showBranch",
			type: "boolean",
			default: "false",
			description: "Include the session's feature branch in long-density metadata. Other densities and the default byline are unchanged.",
		},
		{
			name: "localSessionAction",
			type: '"continue" | "view"',
			default: '"continue"',
			description: "Owner activation for large local cards. The default opens Continue in; view invokes onView so a host can open its own session surface. Viewer and expired session restrictions still apply.",
		},
		{
			name: "items",
			type: "readonly AgentSessionItem[]",
			default: "built-in sample data",
			description:
				"Sessions to render. The host selects the metadata glyph and available menu; pull request details power the preview, and an absolute update time enables the timestamp tooltip. `sharedWithTeam` marks team access, while the invoker supplies the owner's identity.",
		},
		{
			name: "capturedItemIds",
			type: "ReadonlySet<string>",
			description:
				"Ids of sessions marked captured. Medium detached uses the same solid disabled border at rest, and the default border on hover.",
		},
		{
			name: "showUntrackedWorkFooter",
			type: "boolean",
			default: "true",
			description:
				"Shows the untracked-work rationale and action controls below the flyout card body.",
		},
		{
			name: "onLinkWorkItem",
			type: "(item: AgentSessionItem, workItemKey?: string) => void",
			description:
				"Links a session to a work item, from either the untracked-work flyout or the more menu's Link work item submenu. Omit to disable the submenu's Link to existing tab.",
		},
		{
			name: "onCreateWorkItem",
			type: "(item: AgentSessionItem) => void",
			description:
				"Creates a work item from a session via the untracked-work flyout. When omitted, the action is exposed as unavailable.",
		},
		{
			name: "onCreateWorkItemFromDraft",
			type: "(item: AgentSessionItem, draft: AgentSessionWorkItemDraft) => void",
			description:
				"Creates a work item the viewer named in the more menu's Create new tab, carrying the typed summary and chosen issue type. Separate from onCreateWorkItem, whose second argument the board's drag-to-create path already uses for a column title. Omit to disable that tab.",
		},
		{
			name: "workItemOptions",
			type: "readonly AgentSessionWorkItemOption[]",
			description:
				"Work items the more menu's Link work item submenu offers on its Link to existing tab, as { key, summary, issueType }. Supplied by the host so the list is the board in view rather than a fixture.",
		},
		{
			name: "onSubtasks",
			type: "(item: AgentSessionItem) => void",
			description:
				"Add-as-subtask action behind the untracked-work flyout menu. Omit to expose the menu option as unavailable.",
		},
		{
			name: "getSuggestedWorkItemKeys",
			type: "(item: AgentSessionItem) => readonly string[] | undefined",
			description:
				"Several candidate keys for a session. The untracked-work flyout offers the first key, taking precedence over `getSuggestedWorkItemKey`.",
		},
		{
			name: "getSuggestedWorkItemKey",
			type: "(item: AgentSessionItem) => string | undefined",
			description:
				"Suggested Jira key for the untracked-work flyout. Defaults to `sessionDetails.issueKey`.",
		},
		{
			name: "getResumeCommand",
			type: "(item: AgentSessionItem) => string | undefined",
			description:
				"Overrides the shell command the menu's Terminal row copies. Defaults to `cd <worktree> && claude --resume <id>`.",
		},
		{
			name: "isResumable",
			type: "(item: AgentSessionItem) => boolean",
			default: "() => true",
			description:
				"Whether a session can be resumed. Rows that answer false disable the menu's Terminal row, because selecting it copies the command to the clipboard before `onCopyResume` ever runs.",
		},
		{
			name: "onCopyResume",
			type: "(item: AgentSessionItem) => void",
			description:
				"Called after the menu's Terminal row copies the resume command, so a host can announce or restore a terminal session. The Terminal row keeps a trailing check while the copy confirmation is showing.",
		},
		{
			name: "onContinueInAgent",
			type: "(item: AgentSessionItem) => void",
			description:
				"Reopens a local session in its own agent, behind the menu's Continue in group. Omit to render that row disabled. Cloud sessions never show it.",
		},
		{
			name: "onUnlinkSession",
			type: "(item: AgentSessionItem) => void",
			description:
				"Reserved. The more menu does not offer Unlink.",
		},
		{
			name: "onRenameSession",
			type: "(item: AgentSessionItem) => void",
			description: "Renames a cloud session. Omit to render the menu's Rename row disabled.",
		},
		{
			name: "onDeleteSession",
			type: "(item: AgentSessionItem) => void",
			description:
				"Deletes a cloud session record, behind the menu's destructive Delete row. Omit to render it disabled.",
		},
		{
			name: "onToggleVisibility",
			type: "(item: AgentSessionItem) => void",
			description:
				"Archive / Unarchive capability behind the menu's dismiss row. Omit to render that row disabled. Agent Session Column supplies it so Dismiss removes the card and Unarchive restores it.",
		},
		{
			name: "visibilityLabel",
			type: "string",
			default: '"Archive"',
			description:
				"Copy for the menu's dismiss row, which reads Dismiss by default. The column passes Unarchive when the list is the hidden-work view, where the same capability restores rather than hides.",
		},
		{
			name: "onView",
			type: "(item: AgentSessionItem) => void",
			description:
				"Called when a card body is activated. Coding-agent rows stay activatable regardless of `canViewItem`.",
		},
		{
			name: "allowViewerView",
			type: "boolean",
			default: "false",
			description: "Allow viewers of shared cloud sessions to open the host’s viewer session view. The host controls its chat and question permissions; private and expired sessions remain unavailable.",
		},
		{
			name: "canViewItem",
			type: "(item: AgentSessionItem) => boolean",
			description:
				"When `onView` is set, non-coding rows for which this returns false omit the body action.",
		},
		{
			name: "className",
			type: "string",
			description: "Additional classes applied to the list element.",
		},
	],
};
