import type { CanvasEntry } from "./canvas/canvas-workspace";
import { CardStackVariant } from "./variants/card-stack";
import { LedgerPopoverVariant } from "./variants/ledger-popover";
import { PeekPaneVariant } from "./variants/peek-pane";
import { PeekingStackVariant } from "./variants/peeking-stack";
import { QuietMenuVariant } from "./variants/quiet-menu";
import { RunTimelineVariant } from "./variants/run-timeline";

/**
 * Canvas membership. Add, rename or remove previews here; positions saved in the browser only move them.
 * Every preview shares the same synthetic data, size and theme so only the design differs.
 * All variants are lightweight popovers over the work item, fed by the same ongoing suggestion feed.
 */
const PREVIEW_WIDTH = 1040;
const PREVIEW_HEIGHT = 760;
const GAP = 120;
const column = (index: number) => index * (PREVIEW_WIDTH + GAP);
const row = (index: number) => index * (PREVIEW_HEIGHT + GAP + 40);

export const SUGGESTION_CANVAS_ENTRIES: readonly CanvasEntry[] = [
	{ id: "ledger-popover", name: "Suggestions · Ledger popover", width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT, x: column(0), y: row(0), render: () => <LedgerPopoverVariant /> },
	{ id: "card-stack", name: "Suggestions · Card stack", width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT, x: column(1), y: row(0), render: () => <CardStackVariant /> },
	{ id: "quiet-menu", name: "Suggestions · Quiet menu", width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT, x: column(2), y: row(0), render: () => <QuietMenuVariant /> },
	{ id: "run-timeline", name: "Suggestions · Run timeline", width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT, x: column(0), y: row(1), render: () => <RunTimelineVariant /> },
	{ id: "peek-pane", name: "Suggestions · Peek pane", width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT, x: column(1), y: row(1), render: () => <PeekPaneVariant /> },
	{ id: "peeking-stack", name: "Suggestions · Peeking stack", width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT, x: column(2), y: row(1), render: () => <PeekingStackVariant /> },
];
