import type { ComponentDetail } from "@/app/data/component-detail-types";

export const SMART_LINK_DETAIL: ComponentDetail = {
		description: "Smart link chips with hover previews, plus a bordered card appearance that every item can expand into. Built on the shared HoverCard primitive for the inline mode.",
		importStatement: `import { SmartLink } from "@/components/blocks/smart-link";
import type { SmartLinkItem } from "@/components/blocks/smart-link";`,
		usage: `import { SmartLink } from "@/components/blocks/smart-link";
import type { SmartLinkItem } from "@/components/blocks/smart-link";

const item: SmartLinkItem = {
  id: "page-1",
  href: "#page-1",
  title: "Project slingshot release plan",
  variant: "confluence",
  provider: { name: "Confluence", logo: { kind: "atlassian", name: "confluence" } },
  icon: { kind: "atlassian", name: "confluence" },
};

{/* Inline chip with hover flyout */}
<SmartLink
  item={item}
  onActionSelect={(action, smartLink) => console.log(action.id, smartLink.id)}
/>

{/* Let a long title wrap with surrounding text */}
<SmartLink item={item} wrap />

{/* Bordered block card for the same item */}
<SmartLink appearance="card" item={item} />`,
		demoLayout: {
			previewContentWidth: "full",
			examplesContentWidth: "full",
		},
		props: [
			{
				name: "item",
				type: "SmartLinkItem",
				required: true,
				description: "Link, provider, preview metadata, and action data rendered by the trigger and hover card.",
			},
			{
				name: "appearance",
				type: '"inline" | "card"',
				default: '"inline"',
				description: "Presentation mode. inline is the chip with hover flyout; card is the bordered block card for the same item.",
			},
			{
				name: "size",
				type: '"small" | "medium" | "large"',
				default: '"small"',
				description: "Inline label size: 12px, 14px, or 16px.",
			},
			{
				name: "wrap",
				type: "boolean",
				default: "false",
				description: "Allows an inline link title to wrap across lines instead of truncating.",
			},
			{
				name: "side",
				type: '"top" | "bottom" | "left" | "right"',
				default: '"bottom"',
				description: "Placement side forwarded to HoverCardContent.",
			},
			{
				name: "align",
				type: '"start" | "center" | "end"',
				default: '"start"',
				description: "Alignment forwarded to HoverCardContent.",
			},
			{
				name: "onActionSelect",
				type: "(action: SmartLinkAction, item: SmartLinkItem) => void",
				description: "Callback for action rows such as Copy link, Open preview, or Summarize.",
			},
			{
				name: "onRemove",
				type: "() => void",
				description: "Removes the Smart Link when its remove control is activated.",
			},
			{
				name: "removeVariant",
				type: '"overlay"',
				description: "Reveals an X over the trailing edge on hover or keyboard focus without changing the chip width.",
			},
			{
				name: "removeButtonLabel",
				type: "string",
				description: "Accessible label for the remove control. Defaults to Remove followed by the Smart Link title.",
			},
		],
		examples: [
			{ title: "Confluence and Jira", description: "Rich Atlassian previews with metadata and action rows.", demoSlug: "smart-link-demo-rich" },
			{ title: "External article", description: "External article preview using fallback brand tile artwork.", demoSlug: "smart-link-demo-article" },
			{ title: "Team", description: "Team preview with avatar stack and provider footer.", demoSlug: "smart-link-demo-team" },
			{ title: "Goal", description: "Goal preview with status, score, date, and goal-specific action.", demoSlug: "smart-link-demo-goal" },
			{ title: "Project", description: "Project preview with avatar, status, update date, and project-specific action.", demoSlug: "smart-link-demo-project" },
			{ title: "Loom", description: "Loom preview with media-style title, excerpt, and actions.", demoSlug: "smart-link-demo-loom" },
			{ title: "Generic links", description: "File and message previews backed by existing third-party provider assets.", demoSlug: "smart-link-demo-generic" },
			{ title: "Pull request", description: "GitHub pull request chip with status, diff stats, branch path, and author in the flyout.", demoSlug: "smart-link-demo-pull-request" },
			{ title: "Card", description: "Bordered block cards for every smart-link variant — Jira, Confluence, article, team, goal, project, Loom, file, generic, and pull request.", demoSlug: "smart-link-demo-card" },
			{ title: "Removable (overlay)", description: "Smart Links with an X revealed over the trailing edge on hover or keyboard focus.", demoSlug: "smart-link-demo-removable-overlay" },
			{ title: "Inline status", description: "Work item status rendered as a lozenge at the end of the inline chip.", demoSlug: "smart-link-demo-status" },
			{ title: "Sizes", description: "12px, 14px, and 16px inline chips for compact prose or prominent references.", demoSlug: "smart-link-demo-sizes" },
			{ title: "Wrapping", description: "Long titles wrap across lines in all three inline sizes.", demoSlug: "smart-link-demo-wrapping" },
		],
	};
