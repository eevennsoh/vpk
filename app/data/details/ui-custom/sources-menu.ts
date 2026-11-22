import type { ComponentDetail } from "@/app/data/component-detail-types";

export const SOURCES_MENU_DETAIL: ComponentDetail = {
	description:
		"A popover of palette-style source rows opened from a “Used N sources” trigger. Title clicks open the source; row actions copy the link or open a preview dialog.",
	usage: `import { SOURCE_PREVIEW_PAGES, SourcesMenu } from "@/components/ui-custom/sources-menu";

<SourcesMenu
  pages={SOURCE_PREVIEW_PAGES}
  trigger={<button type="button" />}
>
  Used {SOURCE_PREVIEW_PAGES.length} sources
</SourcesMenu>`,
	props: [
		{ name: "pages", type: "readonly SourcePreviewPage[]", required: true, description: "Sources listed in the menu." },
		{ name: "trigger", type: "ReactElement", required: true, description: "Element rendered as the popover trigger." },
		{ name: "children", type: "ReactNode", required: true, description: "Trigger content." },
		{ name: "toasterId", type: "string", description: "Sonner toaster id for copy feedback." },
		{ name: "align", type: '"start" | "center" | "end"', default: '"start"', description: "Popover alignment." },
	],
};
