"use client";

import { CanvasWorkspace } from "@/components/blocks/jira-work-item/suggestion-canvas/canvas/canvas-workspace";
import { SUGGESTION_CANVAS_ENTRIES } from "@/components/blocks/jira-work-item/suggestion-canvas/registry";

// Design canvas for the empty Jira work item suggestions panel. All data is synthetic; nothing is written.
// Open /sandbox/suggestion-canvas, or /sandbox/suggestion-canvas?item=<id> to frame one preview.
export default function SuggestionCanvasPage() {
	return <CanvasWorkspace entries={SUGGESTION_CANVAS_ENTRIES} title="Work item suggestions · design canvas" />;
}
