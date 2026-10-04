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
 *
 * URL overrides: `?variants=autoArrange,-sessionPeel` forces variants on (`id`)
 * or off (`-id`) for one document load, on top of the stored/default values, so
 * agents and specs can reach a state without Settings clicks or storage writes.
 * The effective snapshot is `base + overrides`, where `base` is only ever the
 * user's own persisted (or default) choices:
 *
 * - The URL is read once per document, on the first client hydration (never
 *   during render or on the server), so SSR and the hydration pass still render
 *   the store default. Later client navigations do not re-read it.
 * - Overrides are never written to storage, so reloading without the param
 *   restores the user's settings and other tabs never see them.
 * - A Settings click on an overridden variant is an explicit user choice: it
 *   persists as usual and drops that one override for the rest of the document.
 *   Clicking a different variant persists only the user's base map, never the
 *   overridden values.
 * - A cross-tab `storage` update replaces the base; overrides still win for
 *   the ids they name until the user clicks them here.
 */

export const DESIGN_VARIANTS_STORAGE_KEY = "ui-design-variants";

/** Query param read once per document load: comma-separated `id` (on) / `-id` (off). */
export const DESIGN_VARIANTS_QUERY_PARAM = "variants";

/**
 * Written next to the variant booleans. Missing or older payloads are treated
 * as schema 1: Simple kanban was still an off default then, so a stored
 * `false` is incidental — the whole map is persisted when a variant is
 * toggled — and must not block the on-default rollout.
 */
export const DESIGN_VARIANTS_STORAGE_SCHEMA_VERSION = 3;

/** Schema that first shipped Simple kanban as an on default. */
const SIMPLE_KANBAN_ON_DEFAULT_SCHEMA_VERSION = 2;
/** Older maps persisted Peel visual's former on default alongside unrelated choices. */
const PEEL_OFF_DEFAULT_SCHEMA_VERSION = 3;

export const DESIGN_VARIANTS = [
	{ id: "panel", label: "Panel" },
	{ id: "simple-views", label: "Simple views" },
	{ id: "simpleKanban", label: "Simple kanban" },
	{ id: "kanbanBackground", label: "Background color" },
	{ id: "advancedTimeline", label: "Advanced timeline" },
	{ id: "agentSessionColumnResizing", label: "Dragging" },
	{ id: "manualLink", label: "Manual link" },
	{ id: "autoArrange", label: "Auto arrange" },
	{ id: "sessionStroke", label: "Stroke tracing" },
	{ id: "sessionBloom", label: "Card glow" },
	{ id: "sessionProximity", label: "Proximity sensor" },
	{ id: "sessionPeel", label: "Peel visual" },
	{ id: "moveVisual", label: "Move visual" },
] as const;

export type DesignVariantId = (typeof DESIGN_VARIANTS)[number]["id"];

export type DesignVariantState = Readonly<Record<DesignVariantId, boolean>>;

/** Forced values from `?variants=`; ids that are absent follow the base state. */
export type DesignVariantOverrides = Readonly<Partial<Record<DesignVariantId, boolean>>>;

export interface ParsedDesignVariantOverrides {
	overrides: DesignVariantOverrides;
	/** Unrecognised ids (sign stripped), in first-seen order, for a dev warning. */
	unknownIds: readonly string[];
}

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
 * Agent Session column resizing starts on: Team EU includes the width drag
 * handle unless the user explicitly disables Dragging.
 *
 * Manual link starts off: Team EU hides the Link work item session-menu row
 * until the user explicitly enables it.
 *
 * Auto arrange and Peel visual start off until explicitly enabled in Settings.
 * Move visual starts on for routes that opt into the experimental issue move visuals.
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
	autoArrange: false,
	agentSessionColumnResizing: true,
	kanbanBackground: false,
	manualLink: false,
	moveVisual: true,
	panel: false,
	sessionBloom: true,
	sessionPeel: false,
	sessionProximity: false,
	sessionStroke: false,
	"simple-views": true,
	simpleKanban: true,
});

export function isDesignVariantId(value: unknown): value is DesignVariantId {
	return DESIGN_VARIANTS.some((variant) => variant.id === value);
}

const NO_DESIGN_VARIANT_OVERRIDES: DesignVariantOverrides = Object.freeze({});

/** The user's own choices (persisted or default); never includes URL overrides. */
let baseDesignVariants: DesignVariantState = DEFAULT_DESIGN_VARIANTS;
/** This document's `?variants=` overrides, captured on the first client hydration. */
let urlDesignVariantOverrides: DesignVariantOverrides = NO_DESIGN_VARIANT_OVERRIDES;
let hasReadUrlDesignVariantOverrides = false;
/** Effective snapshot (`base + overrides`); its identity changes only with a value. */
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

/** Stable server/hydration snapshot — storage and the URL are only read after mount. */
export function getDefaultDesignVariants(): DesignVariantState {
	return DEFAULT_DESIGN_VARIANTS;
}

/**
 * Parse `?variants=` from a `location.search`-style string. Grammar: the param
 * value is a comma-separated token list; `id` forces a variant on and `-id`
 * forces it off. Tokens are trimmed, empty tokens are skipped, repeated
 * `variants` params are read in order, and the last token for an id wins.
 * Unknown ids are returned in `unknownIds` rather than thrown. Pure: no URL,
 * storage, or console access.
 */
export function parseDesignVariantOverrides(search: string): ParsedDesignVariantOverrides {
	const overrides: Partial<Record<DesignVariantId, boolean>> = {};
	const unknownIds: string[] = [];
	for (const value of new URLSearchParams(search).getAll(DESIGN_VARIANTS_QUERY_PARAM)) {
		for (const rawToken of value.split(",")) {
			const token = rawToken.trim();
			const enabled = !token.startsWith("-");
			const id = enabled ? token : token.slice(1).trim();
			if (id === "") {
				continue;
			}
			if (!isDesignVariantId(id)) {
				if (!unknownIds.includes(id)) {
					unknownIds.push(id);
				}
				continue;
			}
			overrides[id] = enabled;
		}
	}
	return {
		overrides: Object.keys(overrides).length > 0 ? Object.freeze(overrides) : NO_DESIGN_VARIANT_OVERRIDES,
		unknownIds: Object.freeze(unknownIds),
	};
}

/** Layer overrides on a base state; returns `base` itself when nothing changes. */
export function applyDesignVariantOverrides(
	base: DesignVariantState,
	overrides: DesignVariantOverrides,
): DesignVariantState {
	const changed = DESIGN_VARIANTS.some(
		(variant) => Object.hasOwn(overrides, variant.id) && overrides[variant.id] !== base[variant.id],
	);
	return changed ? Object.freeze({ ...base, ...overrides }) : base;
}

function withoutDesignVariantOverride(
	overrides: DesignVariantOverrides,
	id: DesignVariantId,
): DesignVariantOverrides {
	if (!Object.hasOwn(overrides, id)) {
		return overrides;
	}
	const remaining: Partial<Record<DesignVariantId, boolean>> = {};
	for (const variant of DESIGN_VARIANTS) {
		const value = overrides[variant.id];
		if (variant.id !== id && value !== undefined) {
			remaining[variant.id] = value;
		}
	}
	return Object.keys(remaining).length > 0 ? Object.freeze(remaining) : NO_DESIGN_VARIANT_OVERRIDES;
}

/** Replace the base (and optionally the overrides), then publish the effective state. */
function commitDesignVariants(base: DesignVariantState, overrides = urlDesignVariantOverrides) {
	baseDesignVariants = base;
	urlDesignVariantOverrides = overrides;
	const next = applyDesignVariantOverrides(base, overrides);
	if (areDesignVariantsEqual(currentDesignVariants, next)) {
		return;
	}
	currentDesignVariants = next;
	notify();
}

function warnUnknownDesignVariantOverrides(unknownIds: readonly string[]) {
	if (unknownIds.length === 0 || process.env.NODE_ENV === "production") {
		return;
	}
	// A warning, not an error: `control-vpk capture` fails on console errors.
	console.warn(
		`Ignoring unknown design variant id(s) in ?${DESIGN_VARIANTS_QUERY_PARAM}=: ${unknownIds.join(", ")}. `
			+ `Known ids: ${DESIGN_VARIANTS.map((variant) => variant.id).join(", ")}.`,
	);
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
 * default. Older Peel visual values adopt its off default because the former
 * on default was persisted with unrelated choices. Returns `null` only when
 * there is nothing usable to adopt.
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
			if (variant.id === "sessionPeel" && schemaVersion < PEEL_OFF_DEFAULT_SCHEMA_VERSION) {
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
 * Adopt a base variant state without persisting it. Used by the cross-tab
 * `storage` listener (the writing tab already persisted the value) and by
 * `hydrateClientDesignVariants` on mount. This document's URL overrides still
 * apply on top.
 */
export function hydrateDesignVariants(next: DesignVariantState) {
	commitDesignVariants(next);
}

/**
 * Mount-time client hydration: on the first call per document, capture
 * `?variants=` overrides from `search` (warning once about unknown ids), then
 * adopt the persisted map — or keep the in-memory base when storage is empty or
 * unreadable. Call only from an effect; `search` is `window.location.search`.
 */
export function hydrateClientDesignVariants(search: string) {
	if (!hasReadUrlDesignVariantOverrides) {
		hasReadUrlDesignVariantOverrides = true;
		const { overrides, unknownIds } = parseDesignVariantOverrides(search);
		urlDesignVariantOverrides = overrides;
		warnUnknownDesignVariantOverrides(unknownIds);
	}
	commitDesignVariants(readStoredDesignVariants() ?? baseDesignVariants);
}

/**
 * Flip one variant as an explicit user choice and persist the user's base map
 * (never URL overrides). A click on an overridden id also drops that override,
 * so the user sees exactly what they chose.
 */
export function setDesignVariant(id: DesignVariantId, enabled: boolean) {
	const next: DesignVariantState = Object.freeze({ ...baseDesignVariants, [id]: enabled });

	try {
		globalThis.localStorage?.setItem(
			DESIGN_VARIANTS_STORAGE_KEY,
			JSON.stringify({ ...next, schemaVersion: DESIGN_VARIANTS_STORAGE_SCHEMA_VERSION }),
		);
	} catch {
		// Non-fatal: the selection still applies for this session.
	}

	commitDesignVariants(next, withoutDesignVariantOverride(urlDesignVariantOverrides, id));
}

/** Test-only reset so suites don't leak state between cases. */
export function resetDesignVariantsForTests() {
	baseDesignVariants = DEFAULT_DESIGN_VARIANTS;
	urlDesignVariantOverrides = NO_DESIGN_VARIANT_OVERRIDES;
	hasReadUrlDesignVariantOverrides = false;
	currentDesignVariants = DEFAULT_DESIGN_VARIANTS;
	listeners.clear();
}
