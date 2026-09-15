import type { ReactNode } from "react";
import type { AgentSessionProps } from "@/components/blocks/agent-session";
import type { UntrackedWorkTriage } from "@/components/blocks/agent-session/untracked-work-triage";

import type { AgentSessionColumnFrame } from "./agent-session-column-frame";

export type AgentSessionColumnNotchShape = "circle" | "line";

/**
 * Column chrome around the Agent Session cards.
 *
 * Every card-level concern is delegated: this extends `AgentSessionProps` so a
 * host wires `onLinkWorkItem`, `onCreateWorkItem`, `capturedItemIds` and friends
 * exactly as it would on the bare block. Only `className` is reclaimed, because
 * on a column it reads as the column surface rather than the inner list.
 * `rowTriage` is omitted because the column builds it.
 */
export interface AgentSessionColumnProps extends Omit<
	AgentSessionProps,
	"arrivingItemIds" | "className" | "onArrivalComplete" | "rowTriage"
> {
	/** Additional classes applied to the column surface. */
	className?: string;
	/** Classes applied to the inner session list. */
	listClassName?: string;
	/** Header label. */
	title?: string;
	/**
	 * Header count. Defaults to the number of rendered sessions; override when
	 * the column shows a filtered slice of a larger backlog.
	 */
	count?: number;
	/** Copy shown in place of the list when there are no sessions. */
	emptyLabel?: string;
	/**
	 * Whether the column starts collapsed into its compact marker rail. The column owns
	 * the state from there — the hover-revealed shrink/grow control toggles it.
	 *
	 * Ignored once {@link AgentSessionColumnProps.collapsed} is supplied.
	 */
	defaultCollapsed?: boolean;
	/** Collapsed marker treatment. Defaults to circular user dots. */
	notchShape?: AgentSessionColumnNotchShape;
	/**
	 * `"gutter"` hides the visual count and expand icon at rest while leaving
	 * the rail top-aligned. The expand control remains keyboard-reachable.
	 * Hover preview should pass `"column"` so that chrome returns. Defaults
	 * to `"column"`.
	 */
	collapsedPresentation?: "column" | "gutter";
	/**
	 * Host-owned collapsed header control. Receives the slot chrome classes
	 * so the trigger can share the count/control hover swap. Omit it to keep
	 * the default Expand button. In-flow passes a "…" menu; panel omits this.
	 */
	collapsedMenu?: (slot: { className: string; dragging: boolean }) => ReactNode;
	/**
	 * Whether the column is pinned. Only used when {@link onPinnedChange}
	 * is supplied — the pin affordance is omitted otherwise.
	 */
	pinned?: boolean;
	/**
	 * Pin capability. Omit it to hide the header pin control. The host must
	 * own the persistence flag; this is never a no-op.
	 */
	onPinnedChange?: (pinned: boolean) => void;
	/** Whether the current expand/collapse action changes the column width. */
	toggleChangesWidth?: boolean;
	/** Optional host-owned handle for repositioning the entire column. */
	headerDragHandle?: ReactNode;
	/** Temporary presentation while the host repositions this column. */
	isRepositioning?: boolean;
	/**
	 * Extra horizontal pointer space on each side of the collapsed rail,
	 * without moving its markers.
	 */
	collapsedRailHitSlopPx?: number;
	/** Plays the collapsed gutter rail's one-time staggered dot introduction. */
	playGutterIntro?: boolean;
	/** Called after the final dot finishes the gutter introduction. */
	onGutterIntroComplete?: () => void;
	/**
	 * Controlled collapse. Supply it when the host renders its own collapse
	 * affordance — a docked surface with a minimise control, say — and needs the
	 * two to agree. The column then never writes the state itself; it still
	 * reports every toggle through `onCollapsedChange`, so a host that forgets
	 * to echo the value back simply sees no change.
	 *
	 * Leave it `undefined` for the default uncontrolled behaviour, where the
	 * column starts at `defaultCollapsed` and owns the state from there.
	 */
	collapsed?: boolean;
	/** Called after the column collapses or expands, controlled or not. */
	onCollapsedChange?: (collapsed: boolean) => void;
	/**
	 * Reports pointer hover or focus anywhere inside the column. Hosts with
	 * ambient updates can pause them while a viewer is working in either the
	 * collapsed rail or expanded list.
	 */
	onInteractionChange?: (interacting: boolean) => void;
	/**
	 * Enables additive/range selection, selection keyboard shortcuts, bulk header
	 * actions, and multi-session drag cohorts. Defaults to `true`. Set to `false`
	 * when every drag must carry only the session it started from. `false` also
	 * disables single-select row chrome: article click does not toggle
	 * `selectedItemId`.
	 */
	multiSelect?: boolean;
	/**
	 * Enables row Approve and, while `multiSelect` is true, selection and bulk
	 * header actions. Omit it and the column stays a read-only list with Resume
	 * and Archive.
	 */
	triage?: UntrackedWorkTriage;
	/**
	 * Which chrome the header wears.
	 *
	 * `"column"` is the in-flow board title row. `"panel"` is the docked
	 * rail's PanelHeader skin. The collapsed rail normally keeps its compact
	 * header in both modes; `collapsedPresentation="gutter"` hides the count at rest.
	 */
	headerSurface?: "column" | "panel";
	/**
	 * In-flow only. Ignored when `headerSurface` is `"panel"`.
	 * Omit for `"caption"`. Kanban hosts overwrite this from `columnChrome`.
	 */
	columnFrame?: AgentSessionColumnFrame;
	/**
	 * Shows the header Filter sessions control. Defaults to `true`.
	 * Off omits the button and its hover-reveal slot; filter state is not
	 * applied.
	 */
	showFilter?: boolean;
	/**
	 * Shows the header overflow (ellipsis) menu. Defaults to `true`.
	 * Off omits that control; collapse and any remaining real actions stay.
	 */
	showOverflow?: boolean;
	/**
	 * Shows the per-row hover check that links a session to its suggested work
	 * item. Defaults to `true`. Off omits that control on every row; drag-to-link
	 * and the bulk selection actions are unaffected. A board whose product no
	 * longer offers one-click linking passes `false`.
	 */
	showLinkAction?: boolean;
	/**
	 * Enables the bottom depth tail, scroll fade, and end summary on the
	 * expanded list. Defaults to `false`.
	 */
	hasScrollingEffect?: boolean;
	/**
	 * Elevates this column's painted well above horizontally scrolled board
	 * content. Defaults to `false`. The well already supplies the white fill
	 * and radius; hosts must not wrap it in a second surface. Underlap adds
	 * overlay shadow and grows the well by `space.100` above and below.
	 * Expanded rest paints the 1px disabled stroke; underlap hides that
	 * stroke so overlay shadow is the only edge. Collapsed wells never
	 * paint a stroke. Collapsed hit slop stays wide at rest and shrinks
	 * inside the elevated well while status columns underlap.
	 */
	showTrailingShadow?: boolean;
	/**
	 * Expanded width in px. Defaults to the board column's 280. A wider host
	 * (the docked rail) passes its content-box width so the well fills that
	 * surface instead of leaving a 280px column inside a larger panel.
	 */
	expandedWidthPx?: number;
	/** Disable the column's width transition while a host drives live resizing. */
	widthTransitionDisabled?: boolean;
}
