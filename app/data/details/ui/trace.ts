import type { ComponentDetail } from "@/app/data/component-detail-types";

export const TRACE_DETAIL: ComponentDetail = {
	description:
		"The building block for reasoning, tool calls, sources and more. A Trace is a column of lines; each line can show a status, an icon, a title and a description, and can collapse a group of lines underneath it.",
	usage: `import {
  Trace,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";

<Trace>
  <TraceLine>
    <TraceIcon>
      <SearchIcon label="" />
    </TraceIcon>
    <TraceTitle>Searched for generateMetadata</TraceTitle>
  </TraceLine>
</Trace>`,
	props: [
		{
			name: "status",
			type: '"running" | "error" | "pending"',
			description: "TraceLine only. Running shimmers the title, error turns it red, pending dims it.",
		},
		{
			name: "open / onOpenChange",
			type: "boolean / (open: boolean) => void",
			description: "TraceCollapsible only. Controlled open state; pass both or neither.",
		},
	],
	subComponents: [
		{ name: "Trace", description: "Column of lines and collapsibles." },
		{ name: "TraceLine", description: "One row, with an optional status." },
		{ name: "TraceIcon", description: "Decorative icon slot." },
		{ name: "TraceTitle", description: "Truncating title text." },
		{ name: "TraceDescription", description: "Secondary detail, such as a count or duration." },
		{ name: "TraceCollapsible", description: "Collapsible group of lines." },
		{ name: "TraceCollapsibleTrigger", description: "Trigger with a rotating chevron." },
		{ name: "TraceCollapsibleContent", description: "Indented content with a left rule." },
	],
	examples: [
		{ title: "Trace Line", demoSlug: "trace-demo-trace-line" },
		{ title: "Status", demoSlug: "trace-demo-status" },
		{ title: "Description", demoSlug: "trace-demo-description" },
		{ title: "Link", demoSlug: "trace-demo-link" },
		{ title: "Dialog", demoSlug: "trace-demo-dialog" },
		{ title: "Sheet", demoSlug: "trace-demo-sheet" },
		{ title: "Group", demoSlug: "trace-demo-group" },
		{ title: "Sources", demoSlug: "trace-demo-sources" },
		{ title: "Reasoning", demoSlug: "trace-demo-reasoning" },
	],
};
