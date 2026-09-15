/**
 * Global "design variants" preferences — independent on/off toggles in the
 * top navigation's settings menu.
 *
 * Each variant is an independent boolean, so the store's snapshot is a frozen
 * map rather than a single id.
 *
 * This module is deliberately React-free (like `theme-storage.ts`) so the
 * selection logic can be unit-tested without a renderer; `useDesignVariants`
 * in `components/hooks/use-design-variants.ts` is the React binding.
 *
 * There is **no DOM mirroring** here. A variant changes component *structure*
 * (which components mount, and where), so it is only ever read in JS through
 * `useDesignVariants()`. Do not add a `data-design-variants` attribute —
 * nothing would consume it.
 *
 * Snapshot identity matters: `useSyncExternalStore` calls both snapshot getters
 * on every render and compares with `Object.is`. `getDesignVariants()` and
 * `getDefaultDesignVariants()` therefore return a *stable* module-level object
 * and never build a fresh one — a new object per call throws "The result of
 * getSnapshot should be cached" and re-renders forever.
 */

export const DESIGN_VARIANTS_STORAGE_KEY = "ui-design-variants";

/**
 * Written next to the variant booleans. Missing or older payloads are treated
 * as schema 1: Simple kanban was still an off default then, so a stored
 * `false` is incidental — the whole map is persisted when a variant is
 * toggled — and must not block the on-default rollout.
 */
export const DESIGN_VARIANTS_STORAGE_SCHEMA_VERSION = 2;

/** Schema that first shipped Simple kanban as an on default. */
const SIMPLE_KANBAN_ON_DEFAULT_SCHEMA_VERSION = 2;

export const DESIGN_VARIANTS = [
	{ id: "panel", label: "Panel" },
	{ id: "simple-views", label: "Simple views" },
	{ id: "simpleKanban", label: "Simple kanban" },
	{ id: "kanbanBackground", label: "Background color" },
	{ id: "advancedTimeline", label: "Advanced timeline" },
	{ id: "agentSessionColumnResizing", label: "Dragging" },
	{ id: "manualLink", label: "Manual link" },
	{ id: "sessionStroke", label: "Stroke tracing" },
	{ id: "sessionBloom", label: "Card glow" },
	{ id: "sessionProximity", label: "Proximity sensor" },
	{ id: "sessionPeel", label: "Peel visual" },
] as const;

export type DesignVariantId = (typeof DESIGN_VARIANTS)[number]["id"];

export type DesignVariantState = Readonly<Record<DesignVariantId, boolean>>;

/**
 * The baseline state. Frozen and held in one place so the server/hydration
 * snapshot keeps a stable identity across renders.
 *
 * Panel starts off: Golden Journeys v4 ships untracked work in the in-flow
 * board column unless the user turns the floating side surface on.
 *
 * Simple views starts on: Team EU ships one Work items tab and moves
 * Board/List into the board header, unless the user turns it off to restore
 * Board and List as sibling space tabs.
 *
 * Simple kanban starts on: expanded columns drop the sunken well unless the
 * user turns it off to restore the default column chrome.
 *
 * Kanban background starts off: routes opt into the subtlest grey board plane
 * while foreground surfaces, including Agent Sessions, remain white.
 *
 * Advanced timeline starts off: Team EU keeps its compact session timeline
 * embedded with only expand/collapse until the user opts into unpinning and
 * cross-column repositioning.
 *
 * Agent Session column resizing starts off: Team EU omits the width drag
 * handle until the user explicitly enables Dragging.
 *
 * Manual link starts off: Team EU hides the Link work item session-menu row
 * until the user explicitly enables it.
 *
 * Card glow starts on; Stroke tracing and Proximity sensor start off.
 * Each layer remains independently configurable in Settings:
 *
 * - Stroke tracing — the accent border traced along the card edge.
 * - Card glow — the soft accent wash behind the row.
 * - Proximity sensor — the column-wide pointer plane that starts the other two
 *   before the cursor reaches a row. With both layers off it drives nothing, so
 *   it is the only one whose effect depends on another.
 */
const DEFAULT_DESIGN_VARIANTS: DesignVariantState = Object.freeze({
	advancedTimeline: false,
	agentSessionColumnResizing: false,
	kanbanBackground: false,
	manualLink: false,
	panel: false,
	sessionBloom: true,
	sessionPeel: true,
	sessionProximity: false,
	sessionStroke: false,
	"simple-views": true,
	simpleKanban: true,
});

export function isDesignVariantId(value: unknown): value is DesignVariantId {
	return DESIGN_VARIANTS.some((variant) => variant.id === value);
}

let currentDesignVariants: DesignVariantState = DEFAULT_DESIGN_VARIANTS;
const listeners = new Set<() => void>();

function notify() {
	for (const listener of listeners) {
		listener();
	}
}

/** Value (not identity) comparison — every stored/next state is a fresh object. */
function areDesignVariantsEqual(a: DesignVariantState, b: DesignVariantState) {
	return DESIGN_VARIANTS.every((variant) => a[variant.id] === b[variant.id]);
}

export function subscribeToDesignVariants(listener: () => void) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

export function getDesignVariants(): DesignVariantState {
	return currentDesignVariants;
}

/** Stable server/hydration snapshot — storage is only read after mount. */
export function getDefaultDesignVariants(): DesignVariantState {
	return DEFAULT_DESIGN_VARIANTS;
}

function storedSchemaVersion(record: Record<string, unknown>): number {
	const value = record.schemaVersion;
	return typeof value === "number" && Number.isInteger(value) && value >= 1 ? value : 1;
}

/**
 * Read the persisted map, normalising it against the known variant ids so a
 * partial, stale, or hostile payload can never produce a state object with a
 * missing key. Unknown keys are dropped. Present non-boolean values coerce to
 * off; absent keys keep the store default. Schema 1 (or missing) Simple kanban
 * values are ignored so an incidental stored `false` cannot block the on
 * default. Returns `null` only when there is nothing usable to adopt.
 */
export function readStoredDesignVariants(): DesignVariantState | null {
	try {
		const stored = globalThis.localStorage?.getItem(DESIGN_VARIANTS_STORAGE_KEY);
		if (!stored) {
			return null;
		}

		const parsed: unknown = JSON.parse(stored);
		if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
			return null;
		}

		const record = parsed as Record<string, unknown>;
		const schemaVersion = storedSchemaVersion(record);
		const next: Record<DesignVariantId, boolean> = { ...DEFAULT_DESIGN_VARIANTS };
		for (const variant of DESIGN_VARIANTS) {
			if (!Object.hasOwn(record, variant.id)) {
				continue;
			}
			if (variant.id === "simpleKanban" && schemaVersion < SIMPLE_KANBAN_ON_DEFAULT_SCHEMA_VERSION) {
				continue;
			}
			next[variant.id] = record[variant.id] === true;
		}
		return Object.freeze(next);
	} catch {
		// Storage can throw in privacy modes / sandboxed iframes, and the stored
		// payload can be malformed JSON.
		return null;
	}
}

/**
 * Adopt a variant state without persisting it. Used on mount to reconcile the
 * in-memory default with whatever the user last chose, and by the cross-tab
 * `storage` listener (the writing tab already persisted the value).
 */
export function hydrateDesignVariants(next: DesignVariantState) {
	if (areDesignVariantsEqual(currentDesignVariants, next)) {
		return;
	}
	currentDesignVariants = next;
	notify();
}

/** Flip one variant as an explicit user choice and persist the whole map. */
export function setDesignVariant(id: DesignVariantId, enabled: boolean) {
	const next: DesignVariantState = Object.freeze({ ...currentDesignVariants, [id]: enabled });

	try {
		globalThis.localStorage?.setItem(
			DESIGN_VARIANTS_STORAGE_KEY,
			JSON.stringify({ ...next, schemaVersion: DESIGN_VARIANTS_STORAGE_SCHEMA_VERSION }),
		);
	} catch {
		// Non-fatal: the selection still applies for this session.
	}

	hydrateDesignVariants(next);
}

/** Test-only reset so suites don't leak state between cases. */
export function resetDesignVariantsForTests() {
	currentDesignVariants = DEFAULT_DESIGN_VARIANTS;
	listeners.clear();
}
