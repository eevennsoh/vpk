/**
 * Pure machine for which directory dialog the Studio agent config panel shows, and what the
 * last one was opened on. No React; the `node:test` transition table drives it directly.
 */
import type { AgentDirectoryKind } from "@/components/blocks/agent/lib/agent-config-model";

/**
 * What the last directory was opened on. A dismissed directory forgets it, so a plain "Add"
 * or "Browse" opens the list; closing after an add keeps it while the dialog animates out.
 */
export type AgentConfigDirectorySeed =
	| { readonly kind: "none" }
	| { readonly kind: "tools"; readonly toolId: string | null }
	| { readonly kind: "apps"; readonly appId: string | null }
	| { readonly kind: "skills"; readonly detailSkillId: string | null; readonly selectedSkillIds: readonly string[] };

export interface AgentConfigDirectoryState {
	readonly open: AgentDirectoryKind | null;
	readonly seed: AgentConfigDirectorySeed;
}

export type AgentConfigDirectoryEvent =
	/** Open `kind`; `seed` comes from a chip or picker, and is kept when a dialog reopens itself. */
	| { readonly type: "open"; readonly kind: AgentDirectoryKind; readonly seed?: AgentConfigDirectorySeed }
	/** The user closed the `kind` dialog (Escape, Close, outside click). */
	| { readonly type: "dismiss"; readonly kind: AgentDirectoryKind }
	/** The panel closed the dialog after an add. */
	| { readonly type: "close" }
	| { readonly type: "select-skills"; readonly skillIds: readonly string[] }
	| { readonly type: "clear-skill-selection" };

const NO_SEED: AgentConfigDirectorySeed = { kind: "none" };
const NO_SKILL_IDS: readonly string[] = [];

export const AGENT_CONFIG_DIRECTORY_INITIAL_STATE: AgentConfigDirectoryState = { open: null, seed: NO_SEED };

export function agentConfigDirectoryReducer(
	state: AgentConfigDirectoryState,
	event: AgentConfigDirectoryEvent,
): AgentConfigDirectoryState {
	switch (event.type) {
		case "open": {
			const seed = event.seed ?? state.seed;
			return state.open === event.kind && seed === state.seed ? state : { open: event.kind, seed };
		}
		case "dismiss": {
			const seed = state.seed.kind === event.kind ? NO_SEED : state.seed;
			return state.open === null && seed === state.seed ? state : { open: null, seed };
		}
		case "close":
			return state.open === null ? state : { ...state, open: null };
		case "select-skills":
			if (state.seed.kind !== "skills" || state.seed.selectedSkillIds === event.skillIds) {
				return state;
			}
			return { ...state, seed: { ...state.seed, selectedSkillIds: event.skillIds } };
		case "clear-skill-selection":
			if (state.seed.kind !== "skills" || state.seed.selectedSkillIds.length === 0) {
				return state;
			}
			return { ...state, seed: { ...state.seed, selectedSkillIds: NO_SKILL_IDS } };
		default: {
			const _exhaustive: never = event;
			void _exhaustive;
			return state;
		}
	}
}

export function createToolsSeed(toolId: string | null): AgentConfigDirectorySeed {
	return { kind: "tools", toolId };
}

export function createAppsSeed(appId: string | null): AgentConfigDirectorySeed {
	return { kind: "apps", appId };
}

export function createSkillsSeed(detailSkillId: string | null): AgentConfigDirectorySeed {
	return { kind: "skills", detailSkillId, selectedSkillIds: NO_SKILL_IDS };
}

export interface AgentConfigDirectorySelection {
	readonly toolId: string | null;
	readonly appId: string | null;
	readonly detailSkillId: string | null;
	readonly selectedSkillIds: readonly string[];
}

/** The props each directory dialog reads; a seed for another kind reads as nothing. */
export function selectAgentConfigDirectorySelection(state: AgentConfigDirectoryState): AgentConfigDirectorySelection {
	const { seed } = state;
	return {
		toolId: seed.kind === "tools" ? seed.toolId : null,
		appId: seed.kind === "apps" ? seed.appId : null,
		detailSkillId: seed.kind === "skills" ? seed.detailSkillId : null,
		selectedSkillIds: seed.kind === "skills" ? seed.selectedSkillIds : NO_SKILL_IDS,
	};
}
