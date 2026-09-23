import type { ComponentDetail } from "@/app/data/component-detail-types";

export const AGENT_SESSION_DETAIL: ComponentDetail = {
	description:
		'Agent sessions in four footprints and relationship states. Large is the default detached, solid uncaptured-work card, and it comes in two densities: `short` leads with a 32px identity and a `agent · PR · host · time` byline (PR is omitted when the session has none), while `long` drops the leading avatar, gives the title its own line, and spends the room on `agent · cycling tool call · artifact · session type/timestamp` plus a trailing lifecycle label and icon. Progression stays at the far right, not in the byline; tool calls shimmer and cycle, Working also shimmers, and Needs input and Finished remain still. Owner rows reveal a `…` menu; viewer rows show an outline information-circle tooltip instead; expired cloud-long rows show a 24×24 `…` menu with Delete and explain the 28-day retention window in a tooltip across the row. A local owner menu offers Continue in — the agent itself or Terminal — while a cloud owner menu offers Rename and Delete. Both end in a dismiss row. Medium detached is a 276px stroked white chip (Jira issue width, 10px corners): the same 32px agent+human identity as a short row, the session title, and a trailing up-arrow key, still with the untracked-work flyout. Medium attached is the Jira Issue activity row (24px identity, h-8 chin, trailing 24×24 status) already connected to work. Small becomes the collapsed Agent Session Column notch. Short, medium, and small detached footprints open the untracked-work Agent Session Flyout with Link, Create, and add-as-subtask actions; long density does not. Medium attached opens session details because its Jira relationship already exists. Captured ids use a solid border, and rows the host cannot resume disable the Terminal row.',
	demoLayout: { previewHeight: "fit" },
	examples: [
		{
			title: "Local — short",
			description:
				"The default avatar-led row for a session on the viewer's own machine, shown as owner and viewer. An owner byline reads agent · PR · host · time when a pull request is linked, and the more menu offers Continue in → the agent or Terminal. A viewer sees an information icon instead of that menu.",
			demoSlug: "agent-session-demo-local-short",
		},
		{
			title: "Local — long",
			description:
				"Title-led owner and viewer rows with the provenance metadata line (agent, cycling tool call, artifact, session type/time). Owners show the trailing lifecycle label and icon. Viewers show only a permanent information icon; hovering anywhere on their row explains private access. No hover flyout.",
			demoSlug: "agent-session-demo-local-long",
		},
		{
			title: "Cloud — short",
			description:
				"The same compact owner and viewer rows for a hosted session. A cloud owner cannot resume in a terminal, so its menu swaps the Continue in group for Rename and Delete. A viewer shows only a permanent information icon, with the private-access tooltip available across the row.",
			demoSlug: "agent-session-demo-cloud-short",
		},
		{
			title: "Cloud — long",
			description:
				"Hosted owner, viewer, and expired sessions in the title-led density — no hover flyout. Owners show Working, Needs input, or Finished. Tool calls cycle with shimmering text; the owner's Working label also shimmers beside the Avatar spinner, while settled lifecycle labels stay still. Viewers show only a permanent information icon and a private-access tooltip across the row. Expired rows show a 24×24 more-actions button offering Delete. Hovering the expired row explains the 28-day retention window and that the session cannot be resumed.",
			demoSlug: "agent-session-demo-cloud-long",
		},
		{
			title: "Medium detached",
			description:
				"A 276px stroked white chip — the Jira issue card width — with 10px corners, the same 32px agent+human identity as a short row, the session title, and a trailing up-arrow key. Still detached from Jira work, with the untracked-work flyout.",
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
			type: '"short" | "long"',
			default: '"short"',
			description:
				"Row shape for the large footprint. `short` leads with a 32px identity and an agent · PR · host · time byline (PR omitted when none is linked). `long` drops the leading avatar, gives the title the full width, and adds agent, a cycling tool call, an artifact chip, session type/time, and a trailing indicator. Ignored by the medium and small footprints, which have fixed geometry.",
		},
		{
			name: "items",
			type: "readonly AgentSessionItem[]",
			default: "built-in sample data",
			description:
				"Sessions to render. `AgentSessionItem` is the Agent List row model, so a surface that already builds those rows needs no conversion. `toolCalls` supplies the long density's shimmering cycle immediately after the agent name. `host` (falling back to `sessionDetails.host`) decides both the metadata glyph and which menu the row opens; a payload that declares neither omits the host segment in the long density rather than assuming the cloud. `sessionDetails.pullRequestNumber` and `pullRequestTitle` supply the short-byline PR number and the long-density artifact chip, `sessionDetails.issueKey` seeds the untracked-work flyout suggestion, and `sessionDetails.worktreePath` the copied resume command.",
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
