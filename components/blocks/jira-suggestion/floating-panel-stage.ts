export type FloatingPanelStage =
	| { phase: "closed" | "reopening" | "measuring" | "unpacking" | "list" | "caught-up" | "closing" }
	| { phase: "expanding"; height: number };

/**
 * The stage the floating panel must move to when the pending count changes under it, or null to stay. Opening
 * expansions wait for the panel's open animation, so suggestions arriving in an already open caught-up panel (Undo,
 * Check again) unpack in place instead; waiting there would leave the cards stacked for good.
 */
export function reconcileFloatingPanelStage(stage: FloatingPanelStage, count: number, openingStage: FloatingPanelStage, reduceMotion: boolean): FloatingPanelStage | null {
	if (stage.phase === "reopening") return count > 0 ? openingStage : { phase: "caught-up" };
	if (count === 0 && stage.phase !== "closed" && stage.phase !== "caught-up" && stage.phase !== "closing") return { phase: "closed" };
	if (count > 0 && stage.phase === "caught-up") return reduceMotion ? { phase: "list" } : { phase: "unpacking" };
	return null;
}
