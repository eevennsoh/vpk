import triggerBylinesData from "./trigger-bylines.json";

/**
 * Trigger-byline mock copy. Sources the short subtitle shown beneath each
 * trigger-provider row (in the Triggers picker and the agent-compact "Add
 * trigger" flyout) from `trigger-bylines.json` as the single source of truth,
 * matching the loader pattern used by `teams.ts` / `people.ts`.
 *
 * Keyed by `AgentTriggerProviderId` (see
 * `components/blocks/trigger/data/trigger-catalog.ts`). Kept as a plain
 * `Record<string, string>` here so this data module stays free of a component
 * import; callers pass the provider id they already hold.
 */
export type TriggerBylineMap = Readonly<Record<string, string>>;

/** The complete provider-id → byline copy map. */
export const TRIGGER_BYLINES: TriggerBylineMap = triggerBylinesData;

/** Byline copy for a trigger provider, or `undefined` when none is authored. */
export function getTriggerByline(providerId: string): string | undefined {
	return TRIGGER_BYLINES[providerId];
}
