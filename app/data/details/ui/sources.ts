import type { ComponentDetail } from "@/app/data/component-detail-types";

export const SOURCES_DETAIL: ComponentDetail = {
	description:
		"The pages the agent read to answer. Sources is a collapsible Trace that says how many sources were used and lists each one as a link.",
	usage: `import { Source, Sources, SourcesContent, SourcesTrigger } from "@/components/ui/sources";

<Sources>
  <SourcesTrigger count={sources.length} />
  <SourcesContent>
    {sources.map((source) => (
      <Source key={source.url} href={source.url} title={source.title} />
    ))}
  </SourcesContent>
</Sources>`,
	props: [
		{
			name: "count",
			type: "number",
			required: true,
			description: "SourcesTrigger only. Shown as “Used N sources”.",
		},
		{
			name: "href / title",
			type: "string",
			description: "Source only. The link and its label; opens in a new tab.",
		},
	],
	subComponents: [
		{ name: "Sources", description: "Trace with a TraceCollapsible." },
		{ name: "SourcesTrigger", description: "Trigger with a globe icon and the source count." },
		{ name: "SourcesContent", description: "Collapsible content with a Trace of links." },
		{ name: "Source", description: "Link wrapping a TraceLine, with a screen-reader new-tab note." },
	],
};
