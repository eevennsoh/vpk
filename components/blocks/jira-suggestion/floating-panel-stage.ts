/**
 * `measuring` lays the list out unseen to learn the panel's full height, then hands it to the stage named by `then`:
 * `expanding` for an open (finished by the open animation) or `unpacking` for cards arriving in an already open panel.
 * Both hold the panel at that height while the stack unpacks, so the cards fan down into room that is already there.
 * While a check runs, `checking` gathers the list into a stack as the panel folds down to its header and footer, the
 * cards fading out of view, and remembers the list's height. When the check ends (with finds or none, or cancelled),
 * `reopening` grows the panel back to that height with the stack in it, and `unpacking` spreads the stack into the list.
 */
export type FloatingPanelStage =
	| { phase: "closed" | "list" | "caught-up" | "closing" }
	| { phase: "measuring"; then: "expanding" | "unpacking" }
	| { phase: "expanding" | "unpacking" | "reopening" | "checking"; height: number };

/**
 * The stage the floating panel must move to when the pending count changes under it, or null to stay. Opening
 * expansions wait for the panel's open animation, so suggestions arriving in an already open caught-up panel (Undo,
 * Check again) measure and unpack in place instead; waiting there would leave the cards stacked for good.
 */
export function reconcileFloatingPanelStage(stage: FloatingPanelStage, count: number, reduceMotion: boolean, running: boolean): FloatingPanelStage | null {
	if (stage.phase === "checking" && !running) return reduceMotion ? { phase: "list" } : { phase: "reopening", height: stage.height };
	if (count === 0 && stage.phase !== "closed" && stage.phase !== "caught-up" && stage.phase !== "closing") return { phase: "closed" };
	if (count > 0 && stage.phase === "caught-up") return reduceMotion ? { phase: "list" } : { phase: "measuring", then: "unpacking" };
	return null;
}

/** The stage a finished measurement leads to, or null when the panel moved on while it was being measured. */
export function settleMeasuredStage(stage: FloatingPanelStage, height: number): FloatingPanelStage | null {
	return stage.phase === "measuring" ? { phase: stage.then, height } : null;
}
