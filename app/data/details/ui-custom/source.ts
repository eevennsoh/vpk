import type { ComponentDetail } from "@/app/data/component-detail-types";

export const SOURCE_DETAIL: ComponentDetail = {
	description:
		"A collapsible component that allows users to view the sources or citations used to generate an AI response. Built on Collapsible with animated expand/collapse and customizable trigger and content areas.",
	usage: `import {
  Source,
  SourceTrigger,
  SourceContent,
  SourceItem,
} from "@/components/ui-custom/source";

<Source>
  <SourceTrigger count={3} />
  <SourceContent>
    <SourceItem href="https://react.dev" title="React Documentation" />
    <SourceItem href="https://developer.mozilla.org" title="MDN Web Docs" />
    <SourceItem href="https://www.typescriptlang.org/docs" title="TypeScript Handbook" />
  </SourceContent>
</Source>`,
	props: [
		{
			name: "count",
			type: "number",
			required: true,
			description: "The number of sources displayed in the trigger label.",
		},
		{
			name: "href",
			type: "string",
			description: "URL for an individual SourceItem link. Opens in a new tab with rel=\"noreferrer\".",
		},
		{
			name: "title",
			type: "string",
			description: "Display title for an individual SourceItem when using default rendering.",
		},
		{
			name: "className",
			type: "string",
			description: "Additional CSS classes applied to any sub-component.",
		},
	],
	subComponents: [
		{ name: "Source", description: "Root Collapsible wrapper with default text styling." },
		{ name: "SourceTrigger", description: "Collapsible trigger button displaying \"Used N sources\" label with chevron icon. Accepts children to override default rendering." },
		{ name: "SourceContent", description: "Animated collapsible content container with slide-in/slide-out transitions." },
		{ name: "SourceItem", description: "Individual source link opening in a new tab. Renders a BookIcon + title by default, or custom children." },
	],
	examples: [
		{ title: "Custom rendering", description: "Sources with custom trigger label, external link icons, and custom source titles.", demoSlug: "source-demo-custom-rendering" },
		{ title: "Preview menu", description: "Click Used N sources to open a preview menu of palette-style source rows. Title clicks open the source; extra actions copy the link or open a preview.", demoSlug: "source-demo-preview-menu" },
	],
};
