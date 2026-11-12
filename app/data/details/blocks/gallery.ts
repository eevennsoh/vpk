import type { ComponentDetail } from "@/app/data/component-detail-types";

export const GALLERY_DETAIL: ComponentDetail = {
	description:
		"A bottom-pinned dock carousel that doubles as an in-page selector. The mixed-size cards stay pinned to the viewport bottom over a progressive surface veil, magnify with cursor proximity (macOS-dock style), and now swap middle-page content instead of opening a lightbox. The selected card gets an organic gradient reveal, text recolors where the reveal overlaps it, and a built-in toggle pill slides the strip in and out.",
	demoLayout: { previewHeight: "fixed", previewContentWidth: "full" },
	importStatement: `import { Gallery, type GalleryItem } from "@/components/blocks/gallery";`,
	usage: `const items: GalleryItem[] = [
  {
    id: "aurora",
    title: "Aurora",
    description: "Northern lights over the fjords.",
    size: "portrait",
  },
  // …more items
];

<Gallery items={items} />

// Provide in-page content for the selected item
<Gallery
  items={items}
  renderSelectedItem={(item) => <article>{item.title}</article>}
/>

// Center selected content within the viewport below the 48px top bar.
// The bottom dock remains an overlay and does not affect centering.
<Gallery
  items={items}
  stagePosition="center"
  renderSelectedItem={(item) => <article>{item.title}</article>}
/>

// Show each manually selectable section in a connected group, then use compact
// navigation when the viewport is below the large breakpoint.
<Gallery
  items={items}
  topBarCenter={<ButtonGroup variant="connected">{controls}</ButtonGroup>}
  topBarCenterCompact={<CompactStepControls />}
/>

// Controlled visibility + controlled selection
<Gallery
  items={items}
  open={open}
  onOpenChange={setOpen}
  selectedId={selectedId}
  onSelectedChange={setSelectedId}
/>`,
	props: [
		{ name: "items", type: "readonly GalleryItem[]", required: true, description: "Cards to render in the dock. Each item has an id, title, description, and size (\"portrait\" | \"landscape\" | \"1x1\")." },
		{ name: "open", type: "boolean", description: "Controlled visibility of the pinned strip. Pair with onOpenChange." },
		{ name: "defaultOpen", type: "boolean", default: "true", description: "Initial visibility when uncontrolled." },
		{ name: "onOpenChange", type: "(open: boolean) => void", description: "Called whenever the strip is shown or hidden (via the toggle pill or controlled prop)." },
		{ name: "selectedId", type: "string", description: "Controlled selected card id. Defaults to the first valid item when omitted." },
		{ name: "defaultSelectedId", type: "string", description: "Initial selected card id when the component manages its own selection." },
		{ name: "onSelectedChange", type: "(selectedId: string) => void", description: "Called when a different card is selected from the pinned strip." },
		{ name: "renderSelectedItem", type: "(item: GalleryItem) => ReactNode", description: "Renders the middle-page content for the currently selected item." },
		{ name: "topBarCenter", type: "ReactNode", description: "Optional default content centered in the 48px top bar. Use a connected group to expose each manually selectable section when space allows." },
		{ name: "topBarCenterCompact", type: "ReactNode", description: "Optional compact alternative to topBarCenter, shown below the large viewport breakpoint." },
		{ name: "stagePosition", type: '"top" | "center"', default: '"top"', description: "Positions selected content below the 48px top bar. Center mode uses both-axis centering while the bottom dock remains an overlay; content keeps a top transform origin so it grows downward." },
		{ name: "palette", type: "GalleryPalette", description: "Four colors for the selected tile's liquid gradient." },
		{ name: "selectedColor", type: "string", description: "Solid selected-tile color in place of the liquid gradient; choose a color that contrasts with inverse text." },
		{ name: "onReset", type: "(item: GalleryItem) => void", description: "Called after Reset remounts the selected prototype in its initial state." },
		{ name: "className", type: "string", description: "Extra classes merged onto the block root." },
	],
};
