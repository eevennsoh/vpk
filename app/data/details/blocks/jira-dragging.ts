import type { ComponentDetail } from "@/app/data/component-detail-types";

export const JIRA_DRAGGING_DETAIL: ComponentDetail = {
	description: "Four issues in To do, beside empty In progress, In review, and Done columns. In progress offers Transition to In progress and Transition to Paused during a drag. Shift-click selects a range from a fixed anchor; clicking closer shrinks the range. Command-click on Mac or Ctrl-click on Windows/Linux toggles individual cards. Up/Down moves focus, Shift+Up/Down adjusts the range, and Command/Ctrl+A selects all visible cards while the board has focus. Adjacent selected backdrops fuse into a pale-blue group and drag as a stacked issue-card deck. Escape closes a popup, cancels a drag, or clears selection, in that order.",
	demoLayout: { previewHeight: "fit", examplesContentWidth: "bleed" },
	importStatement: `import { JiraDragging } from "@/components/blocks/jira-dragging";`,
	usage: `<JiraDragging />`,
	props: [
		{ name: "className", type: "string", description: "Controls the playground's placement and size." },
	],
};
