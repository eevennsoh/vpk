import type { ComponentDetail } from "@/app/data/component-detail-types";

export const AGENT_SESSION_COLUMN_DETAIL: ComponentDetail = {
	description:
		"A column of unattached agent sessions — work that never became Jira items. The catalog shows the docked panel and the in-flow kanban board.",

	demoLayout: { previewHeight: "fit", examplesContentWidth: "bleed" },
	importStatement: `import { AgentSessionColumn } from "@/components/blocks/agent-session-column";`,
	usage: `import { AgentSessionColumn } from "@/components/blocks/agent-session-column";

<AgentSessionColumn
  title="Unlink sessions"
  headerSurface="panel"
  hasScrollingEffect
  multiSelect={false}
  onCreateWorkItem={(item) => console.log("create", item.id)}
  onLinkWorkItem={(item) => console.log("link", item.id)}
/>

// The board omits headerSurface — it defaults to "column".
// Circle markers are the default; pass notchShape="line" for the original rail.
// Kanban hosts overwrite columnFrame from columnChrome.`,
	examples: [
		{
			title: "Panel",
			description: "Docked headerSurface=panel. Framing does not apply.",
			demoSlug: "agent-session-column-demo-panel",
		},
		{
			title: "Kanban",
			description: "In-flow column. Use Default / Simple on the board to switch chrome.",
			demoSlug: "agent-session-column-demo",
		},
		{
			title: "Kanban simple",
			description: "Same board, starting on simple chrome. Toggle back to Default on the board.",
			demoSlug: "agent-session-column-demo-simple",
		},
	],
	props: [
		{
			name: "title",
			type: "string",
			default: '"Unlink sessions"',
			description:
				"Header label. Also seeds the column's accessible name and its `data-agent-session-column` attribute.",
		},
		{
			name: "items",
			type: "readonly AgentSessionItem[]",
			default: "built-in sample data",
			description:
				"Sessions to render. `AgentSessionItem` is the Agent List row model, so a surface that already builds those rows needs no conversion.",
		},
		{
			name: "count",
			type: "number",
			default: "items.length",
			description:
				"Header count. Override when the column shows a filtered slice of a larger backlog.",
		},
		{
			name: "hasScrollingEffect",
			type: "boolean",
			default: "false",
			description:
				"Enables the bottom depth tail, extended scroll fade, and animated end summary.",
		},
		{
			name: "emptyLabel",
			type: "string",
			default: '"No sessions to unlink"',
			description: "Copy shown in place of the list when there are no sessions.",
		},
		{
			name: "defaultCollapsed",
			type: "boolean",
			default: "false",
			description:
				"Whether the column starts collapsed into its compact marker rail. The column owns the state from there — the hover-revealed shrink/grow control toggles it.",
		},
		{
			name: "notchShape",
			type: '"circle" | "line"',
			default: '"circle"',
			description:
				'Collapsed marker treatment. "circle" renders 4px human-avatar dots; all rest in `icon.disabled` regardless of unread state; they grow with gradual neighbor falloff to a 12px maximum and reveal the face on hover or focus. "line" preserves the original horizontal marks, length falloff, and tone treatment.',
		},
		{
			name: "collapsedPresentation",
			type: '"column" | "gutter"',
			default: '"column"',
			description:
				'Use "gutter" for the count-hidden, top-aligned compact rail at rest. The expand control remains keyboard-reachable. `"column"` keeps that total visible. The in-flow board uses `"gutter"` only while the rail is tucked; hover preview switches to `"column"` so the count and options control return.',
		},
		{
			name: "collapsedMenu",
			type: '(slot: { className: string }) => ReactNode',
			description:
				'Host-owned collapsed header control. In-flow supplies a "…" menu with Pin/Unpin and Expand. Omit it to keep the default Expand button.',
		},
		{
			name: "pinned",
			type: "boolean",
			default: "false",
			description:
				"Whether the column stays embedded after the pointer leaves. Only rendered when onPinnedChange is supplied.",
		},
		{
			name: "onPinnedChange",
			type: "(pinned: boolean) => void",
			description:
				"Pin capability. Omit it to hide the header pin control. Expand is width/presentation; pin is persistence.",
		},
		{
			name: "onCollapsedChange",
			type: "(collapsed: boolean) => void",
			description: "Called after the viewer collapses or expands the column.",
		},
	{
		name: "headerSurface",
		type: '"column" | "panel"',
		default: '"column"',
		description:
			'Which chrome the header wears. `"column"` is the in-flow board title row. `"panel"` is the docked rail\'s PanelHeader skin. The collapsed rail keeps its compact header in both modes. The board omits this prop so it stays on the default.',
	},
	{
		name: "showFilter",
		type: "boolean",
		default: "true",
		description:
			"Shows the header Filter sessions control. Off omits the button and its hover-reveal slot; the column does not apply filter state.",
	},
	{
		name: "showOverflow",
		type: "boolean",
		default: "true",
		description:
			"Shows the header overflow (ellipsis) menu. Off omits that control; collapse and any remaining real actions stay.",
	},
		{
			name: "columnFrame",
			type: '"enclosed" | "caption"',
			default: '"caption"',
			description:
				'In-flow well framing. "enclosed" puts the header inside the well. "caption" leaves it on the host surface. Ignored when headerSurface is "panel". Kanban hosts derive this from columnChrome and overwrite whatever is passed on agentSessionColumn.',
		},
		{
			name: "multiSelect",
			type: "boolean",
			default: "true",
			description:
				"Enables additive/range selection, selection keyboard shortcuts, bulk header actions, and multi-session drag cohorts. Set false to remove selection UI and make every drag carry only its originating session.",
		},
		{
			name: "triage",
			type: "UntrackedWorkTriage",
			description:
				"Enables row Approve and, while multiSelect is true, the Selected N header and bulk Link / Create / Archive / Clear. Omit it and the column stays a read-only list with Resume and Archive. `locateTarget` is the only lookup — `attach` consumes that value.",
		},
		{
			name: "capturedItemIds",
			type: "ReadonlySet<string>",
			description:
				"Ids of sessions whose chin should read Captured instead of offering Link and Create.",
		},
		{
			name: "newItemIds",
			type: "ReadonlySet<string>",
			description:
				"Ids that arrived in the last sync and have not been reviewed. Each one plays a one-shot arrival beat and carries a persistent unreviewed mark: expanded, the card steps in from above and its dashed border recolours to discovery with an information-colored leading dot; collapsed, circle markers reveal the same human avatar used by the expanded card, hold, then morph — the face collapses 12→4 onto the rest disc already waiting beneath it and crossfades into `icon.disabled` at matched size, never dissolving to bare plane first — while the markers below slide down to make room, and the rail's head stays count-hidden in the gutter, including the hover-scaled hit area. Once the rail is out of the gutter (column presentation), that total stays visible. Circle mode paints every resting dot with `icon.disabled`, with no persistent unread color. Line mode retains its original new-state tone and grows from its centre. The mark is the load-bearing half — it survives a backgrounded tab, a collapsed column, and prefers-reduced-motion, where the beat does not.",
		},
		{
			name: "onLinkWorkItem",
			type: "(item: AgentSessionItem, workItemKey?: string) => void",
			description:
				"Links a session to a suggested work item from the chin. Receives the row's key when several are offered. The header overflow's Link all suggestions action calls this once per uncaptured session in the current view, and the card's more menu calls it with the work item picked in its Link work item submenu.",
		},
		{
			name: "onCreateWorkItem",
			type: "(item: AgentSessionItem) => void",
			description:
				"Creates a work item from a session. When omitted, the action is exposed as unavailable.",
		},
		{
			name: "onCreateWorkItemFromDraft",
			type: "(item: AgentSessionItem, draft: AgentSessionWorkItemDraft) => void",
			description:
				"Creates a work item the viewer named in the card menu's Create new tab, carrying the typed summary and chosen issue type. Omit to disable that tab.",
		},
		{
			name: "workItemOptions",
			type: "readonly AgentSessionWorkItemOption[]",
			description:
				"Work items the card menu's Link work item submenu offers on its Link to existing tab, as { key, summary, issueType }. Supplied by the host so the list is the board in view rather than a fixture.",
		},
		{
			name: "isResumable",
			type: "(item: AgentSessionItem) => boolean",
			default: "() => true",
			description:
				"Whether a session can be resumed. Rows that answer false render no Resume control at all, because the control copies the command before `onCopyResume` runs.",
		},
		{
			name: "onCopyResume",
			type: "(item: AgentSessionItem) => void",
			description: "Called after the hover Resume control copies the resume command.",
		},
		{
			name: "onView",
			type: "(item: AgentSessionItem) => void",
			description: "Called when a card body is activated.",
		},
		{
			name: "className",
			type: "string",
			description: "Additional classes applied to the column region that wraps the header and the session plane.",
		},
		{
			name: "listClassName",
			type: "string",
			description: "Classes applied to the inner session list.",
		},
	],
};
