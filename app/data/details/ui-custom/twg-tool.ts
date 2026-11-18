import type { ComponentDetail } from "@/app/data/component-detail-types";

export const TWG_TOOL_DETAIL: ComponentDetail = {
	description:
		"A compact Teamwork Graph thinking trace row for showing search progress, source context, and source icon stacks inside AI reasoning surfaces.",
	usage: `import {
  TwgTool,
  TwgToolSourceIcon,
  type TwgToolSource,
} from "@/components/ui-custom/twg-tool";
import {
  ChainOfThoughtSearchResult,
  ChainOfThoughtSearchResults,
  ChainOfThoughtStep,
} from "@/components/ui/chain-of-thought";
import SearchIcon from "@atlaskit/icon/core/search";

const sources: TwgToolSource[] = [
  { id: "twg", label: "Teamwork Graph", provider: "twg" },
  { id: "confluence", label: "Confluence", provider: "confluence" },
  { id: "google-drive", label: "Google Drive", provider: "google-drive" },
];

<TwgTool
  defaultOpen
  description={
    <div className="flex min-w-0 items-center gap-1">
      Looking into
      <TwgToolSourceIcon source={sources[0]} size="xxsmall" />
      <span className="italic">Upper arm strain repair</span>
    </div>
  }
  sources={sources}
>
  <ChainOfThoughtStep
    icon={SearchIcon}
    label="Evaluating sources"
    description="Ranking sources by recency and authority"
    status="complete"
  >
    <ChainOfThoughtSearchResults>
      <ChainOfThoughtSearchResult>www.atlassian.com</ChainOfThoughtSearchResult>
      <ChainOfThoughtSearchResult>www.github.com</ChainOfThoughtSearchResult>
    </ChainOfThoughtSearchResults>
  </ChainOfThoughtStep>
</TwgTool>`,
	demoLayout: {
		previewContentWidth: "full",
		examplesContentWidth: "full",
	},
	props: [
		{
			name: "title",
			type: "ReactNode",
			default: '"Searching Teamwork Graph"',
			description: "Title rendered in the first line of the trace banner.",
		},
		{
			name: "status",
			type: '"active" | "complete" | "pending"',
			default: '"active"',
			description: "Visual status for the trace row.",
		},
		{
			name: "description",
			type: "ReactNode",
			description: "Second-line status content. Can include TwgToolSourceIcon elements.",
		},
		{
			name: "sources",
			type: "ReadonlyArray<TwgToolSource>",
			default: "[]",
			description: "Sources shown as the overlapping right-side icon stack.",
		},
		{
			name: "loader",
			type: "ReactNode",
			description: "Custom leading loader content. Falls back to the standard Teamwork Graph loader.",
		},
		{
			name: "showChevron",
			type: "boolean",
			default: "true",
			description: "Shows the chevron affordance and enables collapsible content when children are provided.",
		},
		{
			name: "showLoader",
			type: "boolean",
			default: "true",
			description: "Shows the Teamwork Graph loader at the start of the banner.",
		},
		{
			name: "chevronOpen",
			type: "boolean",
			description: "Controls the chevron orientation when the banner is used as an external trigger.",
		},
		{
			name: "onBannerClick",
			type: "() => void",
			description: "Renders the banner as a button and calls this handler when no internal children are provided.",
		},
		{
			name: "contentClassName",
			type: "string",
			description: "Additional classes applied to expanded content, useful for aligning nested reasoning content with the banner copy.",
		},
		{
			name: "open",
			type: "boolean",
			description: "Controlled open state passed to the underlying Collapsible root.",
		},
		{
			name: "defaultOpen",
			type: "boolean",
			description: "Initial open state when the component is uncontrolled.",
		},
		{
			name: "onOpenChange",
			type: "CollapsibleRootProps[\"onOpenChange\"]",
			description: "Callback fired when the collapsible trace content opens or closes.",
		},
		{
			name: "className",
			type: "string",
			description: "Additional classes applied to the root container.",
		},
	],
	subComponents: [
		{ name: "TwgTool", description: "Root trace banner with Teamwork Graph loader, source stack, cycling byline, and optional collapsible content." },
		{ name: "TwgToolSourceIcon", description: "Tile-backed 16px or 24px provider icon using Teamwork Graph, Atlassian product logos, or local third-party assets." },
		{ name: "TwgToolSourceStack", description: "Right-aligned overlapping source icon stack with overflow count support." },
	],
	examples: [
		{ title: "Single source", description: "Searching Teamwork Graph with one source in the icon stack.", demoSlug: "twg-tool-demo-single-source" },
		{ title: "Multiple sources", description: "Progress row with Teamwork Graph, Confluence, Google Drive, and Jira sources.", demoSlug: "twg-tool-demo-multiple-sources" },
		{
			title: "Without loader",
			description: "TWG Tool banner without the nested Teamwork Graph loader.",
			demoSlug: "twg-tool-demo-completed",
		},
	],
};
