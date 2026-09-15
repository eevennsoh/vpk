import type { ReactNode } from "react";

import type { ChatSurface } from "@/app/contexts/context-rovo-chat";
import type { JiraSidebarSessionItem } from "@/components/blocks/product-sidebar/variants/jira";
import type { ThirdPartyLogoName } from "@/components/ui/data/logo-third-party-data";

/**
 * Lifecycle of a row. Drives the title/status treatment (shimmer, animated
 * dots, or none) and which trailing indicator appears.
 *
 * The first three describe an agent working a Jira work item. `attention` is
 * the notification shape: something already happened and is waiting on the
 * viewer — an agent blocked on an answer, or a teammate who @mentioned them.
 * It keeps the row's own `title` (unlike `needs-input`, whose title is a task
 * name and is therefore swapped for the blocked state) because on those rows
 * the title already is the news.
 */
export type AgentListState = "running" | "complete" | "needs-input" | "attention";

/**
 * Whether the leading identity is an agent or a person. `agent` (the default)
 * renders the shared hexagon agent visual; `person` renders the circular photo
 * avatar the rest of Jira uses, so a human comment reads as human at a glance.
 */
export type AgentListActorKind = "agent" | "person";

/** Pull-request lifecycle shown in the metadata row, when a PR exists. */
export type AgentListPrStatus = "created" | "merged" | "failed";

/** Visual density for Jira agent-session rows. */
export type AgentListVariant = "default" | "compact";

/**
 * List surface treatment. `stroke` (the default) is a bordered card. `raised`
 * drops the outer border and uses elevation.shadow.raised, matching Artifact
 * List / Next best action so a Needs input section can sit beside it without
 * a double outline.
 */
export type AgentListChrome = "stroke" | "raised";

/** Where the session is running. Local rows replace the agent name with a device chip. */
export type AgentListHost = "cloud" | "local";

/**
 * Which hover/focus flyout a session row opens.
 *
 * - `session` (default) — the shared session-details flyout. It is
 *   shared across the whole list via one payload handle.
 * - `composer` — the per-row Agent States card, which adds a prompt composer so
 *   the viewer can reply to the agent without leaving the list.
 * - `none` — no flyout. For rows that are not agent sessions (a teammate's
 *   comment, an @mention) and therefore have no session summary to preview.
 */
export type AgentListFlyout = "session" | "composer" | "none";

export interface AgentListAgent {
	/** Canonical directory identity used by agent-state flyouts and all agent surfaces. */
	id?: string;
	/** Display name, shown as the avatar label and the metadata-row label. */
	name: string;
	/** Identity shape — see {@link AgentListActorKind}. Defaults to `agent`. */
	kind?: AgentListActorKind;
	/** Absolute path to the agent avatar SVG under `public/`. */
	avatarSrc?: string;
	/** Canonical VPK product mark used for platform-owned runners such as Rovo. */
	vpkLogo?: "rovo";
	/** Third-party brand mark rendered inside the shared hexagonal agent avatar. */
	brandName?: ThirdPartyLogoName;
}

/** Person who started the session (prompt author), shown as `by <avatar>` in metadata. */
export interface AgentListInvoker {
	name: string;
	/** Absolute path to a human face avatar under `public/`. */
	avatarSrc?: string;
}

/**
 * Session metadata that a row cannot derive from itself. Identity, lifecycle,
 * and timing are always owned by the row and are therefore not overridable
 * here; see `toAgentSessionFlyoutItem`.
 */
export type AgentListSessionDetails = Partial<
	Omit<
		JiraSidebarSessionItem,
		| "agentAvatarSrc"
		| "agentName"
		| "brandName"
		| "completedAtMs"
		| "completedSecondsAgo"
		| "id"
		| "initialElapsedSeconds"
		| "invokedBy"
		| "startedAtMs"
		| "status"
		| "title"
		| "vpkLogo"
	>
> & {
	/** Claude session id used by `claude --resume`. Defaults to the row id. */
	resumeSessionId?: string;
};

export interface AgentListItem {
	id: string;
	title: string;
	/**
	 * Agent-authored session name for single-line rows (e.g. `"Sandbox 401 root
	 * cause"`), the way a coding agent auto-names a thread from its opening
	 * prompt.
	 *
	 * Separate from {@link AgentListItem.title} because the two answer different
	 * questions at different sizes. `title` is the narrative a full card needs —
	 * why this session matters and what it is still missing — and it is written
	 * to wrap onto two lines. A compact row has roughly 26 characters between the
	 * agent mark and its hover actions, so it needs the name of the work rather
	 * than the argument about it. Rows fall back to `title` when a session has no
	 * short name.
	 */
	shortTitle?: string;
	/** Row state — see {@link AgentListState}. */
	state: AgentListState;
	/** The agent or person the row is about; rendered in the leading avatar. */
	agent: AgentListAgent;
	/**
	 * Feature branch the agent is working on. Omitted by rows that are not agent
	 * sessions, which have no branch and open no session flyout.
	 */
	branch?: string;
	/**
	 * Wrapping body copy below the metadata row. Optional — omit it to keep a
	 * compact title-and-metadata row. Rendered by the list row only, not by
	 * `AgentListActivityHeader`, whose two-line geometry is fixed.
	 */
	summary?: string;
	/**
	 * Leading metadata chunk, shown before the timestamp on the metadata line
	 * (e.g. `"Risk · PAY-112"`). Consumer-formatted, so a list can carry its own
	 * classification without the row learning that vocabulary.
	 */
	metadataPrefix?: string;
	/**
	 * Pre-formatted time shown in place of the live runtime or relative clock.
	 * `AgentListTime` runs it through `toCompactRelativeTimeLabel`, which drops
	 * a trailing `" ago"` and spells hours as `hr` so `5hr` cannot be read as
	 * months next to `5m`. Authored labels may still use `"32m ago"` / `"5h ago"`;
	 * named periods (`"Just now"`, `"Yesterday"`, `"Last week"`) and calendar
	 * stamps (`"Tue 18 Aug"`) pass through. Historical rows use it so the list
	 * does not run a per-row one-second interval to age a fact that cannot
	 * change. Local sessions always read as a static stamp, even without this
	 * field.
	 */
	timeLabel?: string;
	/**
	 * Where the session runs. Defaults to `"cloud"`. Local rows render a devices
	 * icon and {@link AgentListItem.machineName}, followed by a static timestamp,
	 * instead of a live runtime and the agent name.
	 */
	host?: AgentListHost;
	/**
	 * Viewer machine shown beside a devices icon on local rows
	 * (e.g. `"Geoff’s MacBook"`). Ignored unless `host` is `"local"`.
	 */
	machineName?: string;
	/** Human (or upstream actor) who invoked the session via the opening prompt. */
	invokedBy?: AgentListInvoker;
	/** Initial runtime shown by expanded activity cards, which tick while active. */
	elapsedSeconds?: number;
	/** Stable start time for live runtimes when supplied by real session data. */
	startedAtMs?: number;
	/** Completion/message time used once the session stops progressing. */
	completedAtMs?: number;
	/** Demo-friendly completion age that continues advancing after mount. */
	completedSecondsAgo?: number;
	/**
	 * Pull-request status. Omit while the agent is still working pre-PR or
	 * waiting for input; the metadata row still identifies the agent.
	 */
	prStatus?: AgentListPrStatus;
	/**
	 * Extra session metadata carried through the shared payload. Anything omitted
	 * is derived from the row — see `toAgentSessionFlyoutItem`.
	 */
	sessionDetails?: AgentListSessionDetails;
	/**
	 * Hover/focus primary action copy. Omit to use the row default: Reply on
	 * person rows, Resume on local sessions, View on cloud agent sessions.
	 */
	actionLabel?: string;
}

export interface AgentListCustomFlyoutActions {
	close: () => void;
}

export interface AgentListProps {
	className?: string;
	/** Chat surface opened after an Agent States composer submission. */
	composerChatSurface?: ChatSurface;
	/** Which flyout a row opens on hover or keyboard focus. Defaults to `session`. */
	flyout?: AgentListFlyout;
	/** Session rows to render; defaults to built-in sample data. */
	items?: readonly AgentListItem[];
	/** Id of the session currently selected by the consuming surface. */
	selectedItemId?: string;
	/** Optional consumer-owned detail surface that keeps the shared Agent List row presentation. */
	renderFlyout?: (item: AgentListItem, actions: AgentListCustomFlyoutActions) => ReactNode;
	/** Row density. Compact uses a 24px avatar and 12px title. */
	variant?: AgentListVariant;
	/** Outer list surface. Defaults to a bordered stroke; `raised` uses elevation and no border. */
	chrome?: AgentListChrome;
	/** Called when a row body or its primary action is activated. */
	onView?: (item: AgentListItem) => void;
	/**
	 * When `onView` is set, person rows for which this returns false omit the
	 * primary action. Coding agent rows always keep View / Resume. Defaults to
	 * every row.
	 */
	canViewItem?: (item: AgentListItem) => boolean;
	/** Called when the hover Archive icon is activated. */
	onArchive?: (item: AgentListItem) => void;
	/** Overrides the default chat destination for Agent States composer submissions. */
	onSubmitPrompt?: (item: AgentListItem, prompt: string) => Promise<void> | void;
}
