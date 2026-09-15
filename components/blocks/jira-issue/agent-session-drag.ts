import type {
	PointerDragBounds,
	PointerDragPosition,
} from "@/components/ui-custom/hooks/use-pointer-drag";

import type { AgentListInvoker } from "@/components/blocks/agent-list";
import type { JiraIssueAgentActivity } from "@/components/blocks/jira-issue/agent-activity";
import type { JiraIssueAttachTrace } from "@/components/blocks/jira-issue/attach-proximity";

// Kept out of `agent-activity.tsx` on purpose: that file exports components, and
// a non-component value export there defeats Fast Refresh state preservation
// (react-doctor/only-export-components).

/**
 * Live state of an in-progress chin-row session drag. Published to the
 * transfer region so it can reveal drop zones and hit-test the pointer.
 * `pointer` is in client coordinates and is `null` once the drag ends.
 */
export type JiraIssueAgentSessionDragSource = "chin" | "detached" | "untracked";

export interface JiraIssueAgentSessionTransferMember {
	/** Absolute `public/` path to the agent avatar, when the source has one. */
	readonly avatarSrc?: string;
	readonly id: string;
	/**
	 * Human who invoked the session. Carried through the transfer so the
	 * post-drop flight chip keeps the face the drag chip was already showing.
	 */
	readonly invoker?: AgentListInvoker;
	readonly name: string;
	/**
	 * Stable identity seed for a deterministic fallback colour. Most agents
	 * identify by a brand logo component rather than an image URL, so
	 * `avatarSrc` is absent far more often than not.
	 */
	readonly tintSeed?: string;
}

/**
 * First non-empty candidate, lowercased, as the member's tint seed.
 *
 * Brand ids come first because they are the identity that survives the
 * attach/detach round trip. Lowercasing is what makes the two drag sources
 * agree: a detached Rovo session carries `vpkLogo: "rovo"`, while the same
 * session dragged back off a chin row has lost every brand field to
 * `toJiraIssueAgentActivityFromSession` and only still knows `name: "Rovo"`.
 */
export function sessionTransferTintSeed(
	...candidates: readonly (string | undefined)[]
): string | undefined {
	for (const candidate of candidates) {
		const trimmed = candidate?.trim();
		if (trimmed) {
			return trimmed.toLowerCase();
		}
	}

	return undefined;
}

export interface JiraIssueAgentSessionTransfer {
	readonly key: string;
	readonly members: readonly [
		JiraIssueAgentSessionTransferMember,
		...JiraIssueAgentSessionTransferMember[],
	];
}

export type JiraIssueAgentSessionDragState =
	| {
		activities: readonly JiraIssueAgentActivity[];
		cancelled: boolean;
		dragging: false;
		pointer: PointerDragPosition | null;
		source: JiraIssueAgentSessionDragSource;
	}
	| {
		activities: readonly JiraIssueAgentActivity[];
		cancelled: false;
		dragging: true;
		pointer: PointerDragPosition;
		source: JiraIssueAgentSessionDragSource;
		transfer: JiraIssueAgentSessionTransfer;
	};

/**
 * Opt-in binding that turns each chin row into a draggable session handle.
 * Supplying it is what mounts the drag wrapper and the pointer-drag bind;
 * without it the rows render exactly as before.
 */
/**
 * Optional board ownership for a session drag. Shared Jira issue demos keep
 * their local transfer state when this is absent.
 */
export interface JiraIssueAgentSessionDragControl {
	/**
	 * 0..1 approach ramp for the travelling session. Drives only the grey
	 * backdrop's opacity continuously; the chin and shell switch at a threshold.
	 */
	attachNearness?: number;
	/**
	 * Accent and pointer for the approach stroke traced along this card's edge.
	 * Only the nearest card gets one; omit it to draw no stroke.
	 */
	attachTrace?: JiraIssueAttachTrace | null;
	binding: JiraIssueAgentSessionDragBinding;
	/**
	 * Sessions in the current drag transfer. Needed on receiving cards (their
	 * `state` stays idle) and during fusion after pointer-up. Falls back to
	 * `state.transfer.members.length` on a live source drag.
	 */
	dragCount?: number;
	dropTarget?: "attach" | "unlink" | null;
	sourceActive: boolean;
	state: JiraIssueAgentSessionDragState;
}

export interface JiraIssueAgentSessionDragBinding {
	/** Optional paper-wave finish for detached/uncaptured session drag previews. */
	previewEffect?: "peel";
	/** Eager preparation is for a single-object demo; collections prepare on pointer/focus intent. */
	previewPreparation?: "eager" | "intent";
	/** Clamp for the row translate, in px relative to its resting position. */
	bounds?: PointerDragBounds;
	onDragStateChange: (state: JiraIssueAgentSessionDragState) => void;
	/** Retains the row keyboard focus came from while focus moves to the drop zone. */
	onFocusedActivitiesChange: (activities: readonly JiraIssueAgentActivity[]) => void;
	/** Immediate unlink from the chin link-broken — same commit as a well drop. */
	onUnlink?: (session?: { id: string; name: string }) => void;
}

export const JIRA_ISSUE_AGENT_SESSION_DRAG_IDLE: Extract<
	JiraIssueAgentSessionDragState,
	{ dragging: false }
> = {
	activities: [],
	cancelled: false,
	dragging: false,
	pointer: null,
	source: "chin",
};

/**
 * Pins a travelling mention chip to the viewport so a collapsing row or a
 * growing attach chin cannot shove it off the pointer.
 */
export function sessionDragChipViewportStyle(enabled: boolean): {
	left: 0;
	position: "fixed";
	top: 0;
} | undefined {
	if (!enabled) {
		return undefined;
	}

	return { left: 0, position: "fixed", top: 0 };
}

/**
 * `position: fixed` is viewport-relative unless an ancestor creates a
 * containing block. Subtract that origin so the chip still sits on the
 * pointer inside a transformed card or preview frame.
 */
export function measureSessionDragChipPointer(
	pointer: PointerDragPosition,
	containingBlock: Pick<DOMRect, "left" | "top">,
): PointerDragPosition {
	return {
		x: pointer.x - containingBlock.left,
		y: pointer.y - containingBlock.top,
	};
}
