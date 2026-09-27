import type { ComponentDetail } from "@/app/data/component-detail-types";

export const JIRA_DRAGGING_DETAIL: ComponentDetail = {
	description: "Four issues in To do, beside empty In progress, In review, and Done columns. Default keeps the original blue status targets and circular insertion markers. Experimental adds magnetic targets, animated labels, fused selection wells, a gathered drag preview, and drop flights. Hold a card or select multiple cards in Experimental to prepare Auto arrange; destination badges show incoming counts, and clicking Auto arrange or pressing Return moves the cards to their stable demo destinations and clears selection. The playground starts on Experimental and lets you compare both variants without resetting the board. In progress offers Transition to In progress and Transition to Paused during a drag. Shift-click selects a range from a fixed anchor; clicking closer shrinks the range. Command-click on Mac or Ctrl-click on Windows/Linux toggles individual cards. Up/Down moves focus, Shift+Up/Down adjusts the range, and Command/Ctrl+A selects all visible cards while the board has focus. Escape closes a popup, cancels a drag, or clears selection, in that order.",
	demoLayout: { previewHeight: "fit", examplesContentWidth: "bleed" },
	importStatement: `import { JiraDragging } from "@/components/blocks/jira-dragging";`,
	usage: `<JiraDragging variant="default" />
<JiraDragging variant="experimental" />`,
	props: [
		{ name: "variant", type: '"default" | "experimental"', default: '"default"', description: "Default restores the original blue status targets, circular insertion markers, and card selection. Experimental uses magnetic targets, animated transition labels, fused selection wells, gathered drag previews, and drop flights. Team EU26 and Team EU26 End start on Experimental; Settings → Move visual switches to Default when turned off." },
		{ name: "className", type: "string", description: "Controls the playground's placement and size." },
	],
};
