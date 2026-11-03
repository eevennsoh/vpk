import type { CanvasEntry } from "./canvas/canvas-workspace";
import { FocusDeckVariant } from "./variants/focus-deck";
import { InlineGhostFillVariant } from "./variants/inline-ghost-fill";
import { LedgerPopoverVariant } from "./variants/ledger-popover";
import { ProvenanceMapVariant } from "./variants/provenance-map";
import { StagedDiffSheetVariant } from "./variants/staged-diff-sheet";

/**
 * Canvas membership. Add, rename or remove previews here; positions saved in the browser only move them.
 * Every preview shares the same synthetic data, size and theme so only the design differs.
 */
const PREVIEW_WIDTH = 1040;
const PREVIEW_HEIGHT = 760;
const GAP = 120;
const column = (index: number) => index * (PREVIEW_WIDTH + GAP);
const row = (index: number) => index * (PREVIEW_HEIGHT + GAP + 40);

export const SUGGESTION_CANVAS_ENTRIES: readonly CanvasEntry[] = [
	{ id: "ledger-popover", name: "Suggestions · Ledger popover", width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT, x: column(0), y: row(0), render: () => <LedgerPopoverVariant /> },
	{ id: "inline-ghost-fill", name: "Suggestions · Inline ghost fill", width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT, x: column(1), y: row(0), render: () => <InlineGhostFillVariant /> },
	{ id: "focus-deck", name: "Suggestions · Focus deck", width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT, x: column(2), y: row(0), render: () => <FocusDeckVariant /> },
	{ id: "staged-diff-sheet", name: "Suggestions · Staged diff sheet", width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT, x: column(0), y: row(1), render: () => <StagedDiffSheetVariant /> },
	{ id: "provenance-map", name: "Suggestions · Provenance map", width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT, x: column(1), y: row(1), render: () => <ProvenanceMapVariant /> },
];
