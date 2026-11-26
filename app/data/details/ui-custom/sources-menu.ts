import type { ComponentDetail } from "@/app/data/component-detail-types";

export const SOURCES_MENU_DETAIL: ComponentDetail = {
	description:
		"A Context popover with simple source links or verbose source previews. Verbose row actions copy the link or open a preview dialog.",
	usage: `import { SOURCE_PREVIEW_PAGES, SourcesMenu } from "@/components/ui-custom/sources-menu";

<SourcesMenu pages={SOURCE_PREVIEW_PAGES} variant="simple" />
<SourcesMenu pages={SOURCE_PREVIEW_PAGES} variant="verbose" />`,
	props: [
		{ name: "pages", type: "readonly SourcePreviewPage[]", required: true, description: "Sources listed in the menu." },
		{ name: "variant", type: '"simple" | "verbose"', default: '"verbose"', description: "Single-line links or detailed source previews." },
		{ name: "trigger", type: "ReactElement", description: "Optional custom popover trigger." },
		{ name: "children", type: "ReactNode", description: "Content for a custom trigger." },
		{ name: "toasterId", type: "string", description: "Sonner toaster id for copy feedback." },
		{ name: "align", type: '"start" | "center" | "end"', default: '"start"', description: "Popover alignment." },
	],
};
