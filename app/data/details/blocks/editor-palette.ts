import type { ComponentDetail } from "@/app/data/component-detail-types";

export const EDITOR_PALETTE_DETAIL: ComponentDetail = {
		description: "Showcase of the rich text editor's suggestion menus across three layouts. The \"nested\" layout shows each top-level section (People and team, Subagents, Skills, Tools, Knowledge, Format) as a single list you click into; the \"flat\" layout expands every section inline, capped at five items with a \"Browse all\" footer (search icon) for sections backed by a directory and a \"View more\" footer (chevron) that expands the rest inline for the others. The \"search\" layout shows one category-specific inline picker with a Search input row and a normal \"Browse all\" row. In the flat layout the \"/\" sections (Skills, Tools, Knowledge, Format) are merged into one list with a heading per section, while each \"@\" section keeps its own panel. Nested and flat include a live editor where typing \"@\" or \"/\" opens the real popups.",
		importStatement: `import EditorPalette from "@/components/blocks/editor-palette/page";`,
		usage: `import EditorPalette from "@/components/blocks/editor-palette/page";

<EditorPalette variant="flat" />
<EditorPalette variant="flat" rowVariant="with-byline" />`,
		demoLayout: { previewHeight: "fit" },
		props: [
			{
				name: "mentionSources",
				type: "RichTextMentionSources",
				description: "Skill catalog that drives the live editor's \"/\" Skills submenu counts.",
			},
			{
				name: "variant",
				type: `"nested" | "flat" | "search"`,
				default: `"nested"`,
				description: "Showcase layout. \"nested\" shows each section as a single list you click into; \"flat\" expands every section inline with a \"Browse all\" / \"View more\" footer; \"search\" renders one category-specific inline picker.",
			},
			{
				name: "rowVariant",
				type: `"compact" | "with-byline"`,
				default: `"compact"`,
				description: "Compact 36px rows hide bylines; with-byline restores the 44px rows and descriptions.",
			},
			{
				name: "searchCategory",
				type: `"knowledge" | "skill" | "subagent" | "tool"`,
				default: `"tool"`,
				description: "Category used by the search layout to choose the inline picker label and result set.",
			},
			{
				name: "showLiveEditor",
				type: "boolean",
				default: "true",
				description: "Render a live editor where typing \"@\" or \"/\" opens the real menus.",
			},
		],
		examples: [
			{ title: "Nested with bylines", description: "The original 44px rows show bylines as you explore nested sections.", demoSlug: "editor-palette-nested" },
			{ title: "Flat", description: "Every section is expanded inline, capped at five items with a \"Browse all\" or \"View more\" footer.", demoSlug: "editor-palette-flat" },
			{ title: "Search", description: "A category-specific inline search picker with a normal \"Browse all\" row.", demoSlug: "editor-palette-search" },
		],
	};
