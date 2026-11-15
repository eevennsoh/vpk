/**
 * Pure state machine for what the Studio shell's main surface shows: the agent config pane
 * (which agent, which view) and the two agent-picking dialogs. No React; the `node:test`
 * transition table drives it directly, and `useStudioMainSurface` wires it into the shell.
 *
 * Whether the user sees the agents home, a custom agent's landing or the chat follows from
 * the chat's own state, so it is derived (`deriveStudioMainSurface`), not stored.
 */
import type { AgentConfigView } from "@/components/projects/studio/components/rovo-app-agent-config-panel";
import { HOME_STARTER_DEFAULT_CATEGORY, type HomeStarterCategory } from "@/components/projects/studio/data/home-starter-templates";

/** The agent open in the config pane, and the chat message whose result created it, if any. */
export interface StudioAgentConfigTarget {
	readonly profileId: string;
	readonly sourceMessageId: string | null;
}

export interface StudioSurfaceDialogState {
	readonly open: boolean;
	/** The tab the dialog lands on; kept after closing, so the dialog keeps its key while it animates out. */
	readonly initialCategory: HomeStarterCategory;
}

/**
 * The config pane, the agent directory and the template dialog are independent today: the
 * directory can open over the config pane (an empty agent's "start with a template").
 * `agentConfigView` outlives a closed pane; every path that opens one sets it.
 */
export interface StudioMainSurfaceState {
	readonly agentConfig: StudioAgentConfigTarget | null;
	readonly agentConfigView: AgentConfigView;
	readonly directory: StudioSurfaceDialogState;
	readonly templateDialog: StudioSurfaceDialogState;
}

export type StudioMainSurfaceEvent =
	/** A generated agent result was registered: open it in the test view. */
	| { readonly type: "agent-result-registered"; readonly profileId: string; readonly sourceMessageId: string | null }
	/** Edit an agent (sidebar row, agents table, "Start from scratch"): open it in the configure view. */
	| { readonly type: "edit-agent"; readonly profileId: string }
	/**
	 * An agent was picked in the directory, or a template agent it built is opened: open the
	 * editable one (`profileId`), or none for a built-in agent picked to chat with. Closes the directory.
	 */
	| { readonly type: "directory-agent-picked"; readonly profileId: string | null }
	/** A template prompt was picked in either dialog; it goes to the composer, and both dialogs close. */
	| { readonly type: "template-agent-picked" }
	/** An agent was deleted; its config pane closes if it is open. */
	| { readonly type: "agent-deleted"; readonly profileId: string }
	/** Back to the agents home, or the open agent no longer exists. */
	| { readonly type: "close-agent-config" }
	/** `?agent=` was reconciled from the URL (deep link, Back/Forward); a different agent opens in configure. */
	| { readonly type: "agent-restored-from-url"; readonly profileId: string | null }
	| { readonly type: "set-agent-config-view"; readonly view: AgentConfigView }
	| { readonly type: "open-directory"; readonly category: HomeStarterCategory }
	| { readonly type: "set-directory-open"; readonly open: boolean }
	| { readonly type: "open-template-dialog"; readonly category: HomeStarterCategory }
	| { readonly type: "set-template-dialog-open"; readonly open: boolean }
	/** "Reset demo". */
	| { readonly type: "reset" };

const CLOSED_DIALOG: StudioSurfaceDialogState = { initialCategory: HOME_STARTER_DEFAULT_CATEGORY, open: false };

export const STUDIO_MAIN_SURFACE_INITIAL_STATE: StudioMainSurfaceState = {
	agentConfig: null,
	agentConfigView: "configure",
	directory: CLOSED_DIALOG,
	templateDialog: CLOSED_DIALOG,
};

// Opening a pane always makes a new target, even for the agent already open: effects keyed
// on the target re-run, as they did when the shell set it with useState.
function openAgentConfig(
	state: StudioMainSurfaceState,
	profileId: string,
	sourceMessageId: string | null,
	view: AgentConfigView,
): StudioMainSurfaceState {
	return { ...state, agentConfig: { profileId, sourceMessageId }, agentConfigView: view };
}

function withAgentConfigView(state: StudioMainSurfaceState, view: AgentConfigView): StudioMainSurfaceState {
	return state.agentConfigView === view ? state : { ...state, agentConfigView: view };
}

function withDialogOpen(dialog: StudioSurfaceDialogState, open: boolean): StudioSurfaceDialogState {
	return dialog.open === open ? dialog : { ...dialog, open };
}

function openDialog(dialog: StudioSurfaceDialogState, category: HomeStarterCategory): StudioSurfaceDialogState {
	return dialog.open && dialog.initialCategory === category ? dialog : { initialCategory: category, open: true };
}

function closeAgentConfig(state: StudioMainSurfaceState): StudioMainSurfaceState {
	return withAgentConfigView(state.agentConfig === null ? state : { ...state, agentConfig: null }, "configure");
}

function withDialogs(
	state: StudioMainSurfaceState,
	directory: StudioSurfaceDialogState,
	templateDialog: StudioSurfaceDialogState,
): StudioMainSurfaceState {
	return directory === state.directory && templateDialog === state.templateDialog
		? state
		: { ...state, directory, templateDialog };
}

export function studioMainSurfaceReducer(
	state: StudioMainSurfaceState,
	event: StudioMainSurfaceEvent,
): StudioMainSurfaceState {
	switch (event.type) {
		case "agent-result-registered":
			return openAgentConfig(state, event.profileId, event.sourceMessageId, "test");
		case "edit-agent":
			return openAgentConfig(state, event.profileId, null, "configure");
		case "directory-agent-picked": {
			const next = event.profileId === null
				? closeAgentConfig(state)
				: openAgentConfig(state, event.profileId, null, "configure");
			return withDialogs(next, withDialogOpen(next.directory, false), next.templateDialog);
		}
		case "template-agent-picked":
			return withDialogs(state, withDialogOpen(state.directory, false), withDialogOpen(state.templateDialog, false));
		case "agent-deleted":
			return state.agentConfig?.profileId === event.profileId ? { ...state, agentConfig: null } : state;
		case "close-agent-config":
			return closeAgentConfig(state);
		case "agent-restored-from-url": {
			// Only the agent already open keeps its view; with no pane open, even "no agent" resets it.
			const isOpenAgent = state.agentConfig !== null && state.agentConfig.profileId === event.profileId;
			const view = isOpenAgent ? state.agentConfigView : "configure";
			return event.profileId === null
				? withAgentConfigView(state.agentConfig === null ? state : { ...state, agentConfig: null }, view)
				: openAgentConfig(state, event.profileId, null, view);
		}
		case "set-agent-config-view":
			return withAgentConfigView(state, event.view);
		case "open-directory":
			return withDialogs(state, openDialog(state.directory, event.category), state.templateDialog);
		case "set-directory-open":
			return withDialogs(state, withDialogOpen(state.directory, event.open), state.templateDialog);
		case "open-template-dialog":
			return withDialogs(state, state.directory, openDialog(state.templateDialog, event.category));
		case "set-template-dialog-open":
			return withDialogs(state, state.directory, withDialogOpen(state.templateDialog, event.open));
		case "reset":
			return STUDIO_MAIN_SURFACE_INITIAL_STATE;
		default: {
			const _exhaustive: never = event;
			void _exhaustive;
			return state;
		}
	}
}

/** Facts from the chat and the agent registry that decide what the main surface shows. */
export interface StudioMainSurfaceFacts {
	readonly hasActiveThreadRun: boolean;
	/** The config pane's agent exists in the registry (a pane on a missing agent shows nothing). */
	readonly hasAgentConfigPane: boolean;
	readonly isArtifactOpen: boolean;
	readonly isCustomAgentSelected: boolean;
	readonly isLoadingThread: boolean;
	readonly isStreaming: boolean;
	readonly visibleMessageCount: number;
}

export type StudioMainSurfaceKind =
	/** The agent config pane (configure, insights or test view). */
	| "agent-config"
	/** The default agents home: starter bento, composer and agents table. */
	| "agents-home"
	/** An empty thread with a custom or built-in agent picked to chat with. */
	| "agent-home"
	| "chat";

export interface StudioMainSurface {
	readonly kind: StudioMainSurfaceKind;
	/** No conversation is on screen (also true under the config pane when the thread is empty). */
	readonly showHomeState: boolean;
	readonly isDefaultAgentHomeState: boolean;
	readonly shouldShowChatHeader: boolean;
}

export function deriveStudioMainSurface(facts: StudioMainSurfaceFacts): StudioMainSurface {
	const showHomeState = !facts.isLoadingThread
		&& !facts.isArtifactOpen
		&& !facts.hasActiveThreadRun
		&& facts.visibleMessageCount === 0;
	const shouldShowChatHeader = !facts.hasAgentConfigPane
		&& (facts.visibleMessageCount > 0 || facts.hasActiveThreadRun || facts.isStreaming);
	const isDefaultAgentHomeState = showHomeState && !facts.isCustomAgentSelected && !facts.hasAgentConfigPane;
	const kind: StudioMainSurfaceKind = facts.hasAgentConfigPane
		? "agent-config"
		: isDefaultAgentHomeState
			? "agents-home"
			: showHomeState
				? "agent-home"
				: "chat";
	return { isDefaultAgentHomeState, kind, shouldShowChatHeader, showHomeState };
}
