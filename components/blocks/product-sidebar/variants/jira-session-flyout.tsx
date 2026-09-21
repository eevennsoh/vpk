"use client";

import {
	cloneElement,
	createContext,
	isValidElement,
	use,
	useEffect,
	useId,
	useState,
	type ComponentProps,
	type FocusEventHandler,
	type ReactNode,
} from "react";
import { preload } from "react-dom";

import AiAgentIcon from "@atlaskit/icon/core/ai-agent";
import BranchIcon from "@atlaskit/icon/core/branch";
import DevicesIcon from "@atlaskit/icon/core/devices";
import FolderClosedIcon from "@atlaskit/icon/core/folder-closed";
import MergeFailureIcon from "@atlaskit/icon/core/merge-failure";
import MergeSuccessIcon from "@atlaskit/icon/core/merge-success";
import PullRequestIcon from "@atlaskit/icon/core/pull-request";
import TaskIcon from "@atlaskit/icon/core/task";
import CloudIcon from "@atlaskit/icon-lab/core/cloud";
import IfElseIcon from "@atlaskit/icon-lab/core/if-else";

import { AgentStates, type AgentStatesState } from "@/components/blocks/agent-states";
import { AgentProfileCard } from "@/components/blocks/agent-profile-card";
import { SmartLink, SMART_LINK_MODAL_ACTIONS, type SmartLinkItem } from "@/components/blocks/smart-link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
	HoverCardViewport,
	type HoverCardHandle,
	type HoverCardProps,
	type HoverCardTriggerProps,
} from "@/components/ui/hover-card";
import { GithubLogo } from "@/components/ui/logo-third-party";
import { Lozenge, type LozengeProps } from "@/components/ui/lozenge";
import { MetadataPathLink, MetadataPathValue } from "@/components/ui/metadata-path-link";
import { Tag } from "@/components/ui/tag";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { ProgressCircle } from "@/components/ui-custom/progress-circle";
import { getAgentProfileBannerSrc } from "@/lib/agent-avatars";
import { cn } from "@/lib/utils";

import type {
	JiraSidebarSessionHost,
	JiraSidebarSessionItem,
	JiraSidebarSessionStatus,
} from "./jira";
import { JiraSessionDetailsCard } from "./jira-session-details-card";
import {
	createJiraSessionFlyoutHandle,
	formatSessionChecks,
	JIRA_SESSION_UPDATED_LABEL,
	prStateLozenge,
} from "./jira-session-flyout-data";
import { JiraSessionUntrackedWorkCard } from "./jira-session-untracked-work-card";
import { ConeSafezone, ConeSafezoneContent } from "@/components/utils/cone-safezone";

export { createJiraSessionFlyoutHandle, prStateLozenge };

export type JiraSessionFlyoutHandle = HoverCardHandle<JiraSidebarSessionItem>;

export type JiraSessionFlyoutTriggerProps = Omit<
	HoverCardTriggerProps<JiraSidebarSessionItem>,
	"handle" | "payload"
> & {
	handle: JiraSessionFlyoutHandle;
	session: JiraSidebarSessionItem;
};

export type JiraSessionFlyoutContent = "details" | "composer" | "untracked-work";

export interface JiraSessionFlyoutSurfaceProps {
	handle: JiraSessionFlyoutHandle;
	/** Lets dense trigger groups defer a switch while the pointer travels into the popup. */
	onOpenChange?: HoverCardProps<JiraSidebarSessionItem>["onOpenChange"];
	popupRef?: ComponentProps<typeof HoverCardContent>["ref"];
	anchor?: ComponentProps<typeof HoverCardContent>["anchor"];
	positionMethod?: ComponentProps<typeof HoverCardContent>["positionMethod"];
	/** Snaps between detached triggers: no position, enter/exit, or content-switch motion. */
	instantPosition?: boolean;
	/**
	 * Flyout body. `details` (default) is the compact session hover card, `composer`
	 * is the Agent States card, and `untracked-work` suggests a related Jira item.
	 */
	content?: JiraSessionFlyoutContent;
	/** Shows untracked-work actions and fallback rationale when no suggestion is available. Defaults to true. */
	showUntrackedWorkFooter?: boolean;
	/** Captured sessions hide Link / Create / subtask so capture cannot run twice. Archive stays available. */
	capturedSessionIds?: ReadonlySet<string>;
	/** Archives the session from the untracked-work flyout. Omit to expose the action as unavailable. */
	onArchiveSession?: (session: JiraSidebarSessionItem) => void;
	/** Flyout Archive control copy. Defaults to Archive; pass Unarchive in the archived view. */
	archiveActionLabel?: string;
	/** Adds the session below the suggested work item. Omit to expose the menu option as unavailable. */
	onAddAsSubtask?: (session: JiraSidebarSessionItem, workItemKey: string) => void;
	/** Creates a work item from the session. Omit to expose the action as unavailable. */
	onCreateWorkItem?: (session: JiraSidebarSessionItem) => void;
	/** Links the session to the suggested work item. Omit to expose the action as unavailable. */
	onLinkWorkItem?: (session: JiraSidebarSessionItem, workItemKey: string) => void;
	onSubmitPrompt?: (session: JiraSidebarSessionItem, prompt: string) => void;
}

interface FocusCaptureChildProps {
	onFocusCapture?: FocusEventHandler<HTMLElement>;
}

const JiraSessionFlyoutSuspensionContext = createContext<JiraSessionFlyoutHandle | null>(null);

/** Suspends Jira session previews throughout a subtree and closes active ones. */
export function JiraSessionFlyoutSuspensionProvider({
	children,
	suspended,
}: Readonly<{
	children: ReactNode;
	suspended: boolean;
}>) {
	const [inactiveHandle] = useState(createJiraSessionFlyoutHandle);
	const ancestorHandle = use(JiraSessionFlyoutSuspensionContext);

	return (
		<JiraSessionFlyoutSuspensionContext value={suspended ? inactiveHandle : ancestorHandle}>
			{children}
		</JiraSessionFlyoutSuspensionContext>
	);
}

/** Connects a session row to the list's shared flyout and carries its payload. */
export function JiraSessionFlyoutTrigger({
	closeDelay = 80,
	children,
	delay = 0,
	handle,
	id: idProp,
	session,
	...props
}: Readonly<JiraSessionFlyoutTriggerProps>) {
	const suspensionHandle = use(JiraSessionFlyoutSuspensionContext);
	const suspended = suspensionHandle !== null;
	const generatedId = useId();
	const triggerId = idProp ?? generatedId;

	useEffect(() => {
		if (suspended) {
			handle.close();
		}
	}, [handle, suspended]);

	const childElement = isValidElement<FocusCaptureChildProps>(children)
		? children
		: null;
	const triggerChild = childElement
		? cloneElement(childElement, {
			onFocusCapture: (event) => {
				childElement.props.onFocusCapture?.(event);
				if (
					!suspended &&
					!event.defaultPrevented &&
					event.target.matches(":focus-visible") &&
					!event.currentTarget.contains(event.relatedTarget as Node | null)
				) {
					handle.open(triggerId);
				}
			},
		})
		: children;

	return (
		<HoverCardTrigger<JiraSidebarSessionItem>
			closeDelay={closeDelay}
			delay={delay}
			handle={suspensionHandle ?? handle}
			id={triggerId}
			payload={session}
			{...props}
			onPointerDownCapture={(event) => {
				props.onPointerDownCapture?.(event);
				// Press-to-drag must dismiss the hover preview immediately.
				// Waiting for the 2px drag transaction leaves the flyout up.
				handle.close();
			}}
		>
			{triggerChild}
		</HoverCardTrigger>
	);
}

/**
 * The rich Jira agent-session detail body used by the queue and For You detail
 * panels. Hover session details use `JiraSessionDetailsCard` instead. The
 * composer Agent States card is an opt-in on the shared hover surface.
 *
 * The body reuses the shared design-system components: the work item is a
 * SmartLink, the agent is an agent-type Tag pill, PR state is a Lozenge, and the
 * SCM fields sit in their own block behind the
 * third-party GitHub logo, rendered in the normal 12px body font.
 *
 * It depends on `./jira` for TYPES ONLY (erased at build time) so that `./jira`
 * can import this body back without creating a runtime import cycle.
 */

/** Queue lifecycle mapped onto the compact, property-free agent card states. */
function toAgentStatesState(status: JiraSidebarSessionStatus): AgentStatesState {
	if (status === "awaiting-input") return "awaiting-input";
	if (status === "running") return "working";
	return "completed";
}

/** Copy for terminal states that cannot use the successful completion default. */
function toAgentStatesMessage(status: JiraSidebarSessionStatus): string | undefined {
	if (status !== "stopped") return undefined;
	return "This session was stopped before the requested work was completed.";
}

function actorInitials(name: string): string {
	return name
		.split(/\s+/u)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase())
		.join("");
}

/** Work-item status lozenge derived from the session lifecycle. */
const STATUS_WORK_ITEM: Record<
	JiraSidebarSessionStatus,
	{ label: string; variant: LozengeProps["variant"] }
> = {
	"awaiting-input": { label: "To Do", variant: "neutral" },
	running: { label: "In progress", variant: "information" },
	"pr-open": { label: "In review", variant: "information" },
	merged: { label: "Done", variant: "success" },
	stopped: { label: "Stopped", variant: "neutral" },
};

/** Lozenge tone for a board/work-item status label when the session names one. */
function issueStatusVariant(label: string): LozengeProps["variant"] {
	switch (label.trim().toLowerCase()) {
		case "done":
			return "success";
		case "in progress":
		case "in review":
			return "information";
		case "blocked":
			return "danger";
		case "to do":
		case "to-do":
		case "not started":
		case "cut":
		case "stopped":
			return "neutral";
		default:
			return "neutral";
	}
}

/** Prefers an explicit work-item status; otherwise maps the session lifecycle. */
function toWorkItemStatus(
	session: JiraSidebarSessionItem,
): { label: string; variant: LozengeProps["variant"] } {
	const issueStatus = session.issueStatus?.trim();
	if (issueStatus !== undefined && issueStatus.length > 0) {
		return { label: issueStatus, variant: issueStatusVariant(issueStatus) };
	}

	return STATUS_WORK_ITEM[session.status];
}

/**
 * Pull-request row icon, contextual to the merge outcome:
 * - `merged` → merge success
 * - `stopped` → merge failure (the PR ended without landing)
 * - everything else (open PR, running, …) → the generic pull-request glyph
 */
function prStateIcon(status: JiraSidebarSessionStatus): ReactNode {
	if (status === "merged") return <MergeSuccessIcon label="" size="small" />;
	if (status === "stopped") return <MergeFailureIcon label="" size="small" />;
	return <PullRequestIcon label="" size="small" />;
}

/**
 * Session host glyph: a cloud for a hosted session, devices for one running on
 * the viewer's own machine. Both read as "where this session runs" — unlike the
 * previous cloud-arrow-up (an upload action) and folder-closed (a directory),
 * which named the wrong concept for this row.
 *
 * `cloud` comes from icon-lab because `@atlaskit/icon/core` only ships
 * `cloud-arrow-up`; `devices` is core.
 */
function hostIcon(host: JiraSidebarSessionHost): ReactNode {
	return host === "cloud" ? (
		<CloudIcon label="" size="small" />
	) : (
		<DevicesIcon label="" size="small" />
	);
}

/** The Jira status workflow offered by the work-item status dropdown. */
const WORK_ITEM_STATUS_OPTIONS: ReadonlyArray<{ label: string; variant: LozengeProps["variant"] }> = [
	{ label: "To Do", variant: "neutral" },
	{ label: "In progress", variant: "information" },
	{ label: "In review", variant: "information" },
	{ label: "Done", variant: "success" },
];

/** Builds the SmartLink work-item link (issue key + summary + assignee, priority,
 * and an interactive status dropdown). */
function toWorkItem(
	session: JiraSidebarSessionItem,
): SmartLinkItem {
	const workItemStatus = toWorkItemStatus(session);

	return {
		id: `${session.id}-work-item`,
		href: "#work-item",
		title: `${session.issueKey}: ${session.issueSummary}`,
		variant: "jira",
		provider: { name: "Jira", logo: { kind: "atlassian", name: "jira" } },
		icon: { kind: "atlassian", name: "jira" },
		description: `Primary work item for ${session.title}.`,
		assignee: session.assignee,
		priority: session.priority,
		status: {
			label: workItemStatus.label,
			variant: workItemStatus.variant,
			options: WORK_ITEM_STATUS_OPTIONS,
		},
		actions: SMART_LINK_MODAL_ACTIONS,
	};
}

/** A metadata row: icon + value. The property name is screen-reader only so
 * the visible flyout stays property-free — that label column has been dropped
 * more than once and must not come back. */
export function FlyoutRow({
	icon,
	label,
	children,
}: Readonly<{ icon: ReactNode; label: string; children: ReactNode }>) {
	return (
		<div className="flex min-w-0 items-center gap-2 text-xs leading-5">
			<span className="grid size-4 shrink-0 place-items-center text-icon-subtlest" aria-hidden="true">
				{icon}
			</span>
			<span className="sr-only">{label}</span>
			<span className="flex min-w-0 flex-1 items-center text-text">{children}</span>
		</div>
	);
}

/** A section heading shared by Jira detail panels. */
export function JiraSessionSectionHeading({
	id,
	children,
	meta,
	showSeparator = false,
}: Readonly<{ id?: string; children: ReactNode; meta?: ReactNode; showSeparator?: boolean }>) {
	return (
		<div className="mb-1 flex items-center gap-3">
			<span
				className="flex min-w-0 shrink-0 items-center gap-1.5 text-xs font-medium leading-4 text-text-subtle"
				id={id}
			>
				{children}
				{meta ? <span className="shrink-0 text-xs font-normal text-text-subtlest">{meta}</span> : null}
			</span>
			{showSeparator ? <span className="h-px flex-1 bg-border" aria-hidden="true" /> : null}
		</div>
	);
}

type JiraSessionPreviewPosition = Pick<
	ComponentProps<typeof HoverCardContent>,
	"align" | "alignOffset" | "side"
>;

/** The redesigned flyout body matching the reference mock. */
export function JiraSessionFlyoutBody({
	session,
	hideAgentRow = false,
	hideHeader = false,
	previewPosition,
}: Readonly<{
	session: JiraSidebarSessionItem;
	/** Hide the Agent metadata row when the surrounding surface owns agent selection. */
	hideAgentRow?: boolean;
	/**
	 * Hide the in-body title + relative-time header. Used by the queue detail
	 * panel, which already surfaces the session title in its own PanelHeader, so
	 * repeating it inside the body is redundant.
	 */
	hideHeader?: boolean;
	/** Override nested Agent and Work item preview placement for constrained surfaces. */
	previewPosition?: JiraSessionPreviewPosition;
}>) {
	const agentBannerSrc = getAgentProfileBannerSrc(session.agentAvatarSrc);
	preload(agentBannerSrc, { as: "image" });

	const hasDevelopment = Boolean(
		session.repository ??
			session.pullRequestNumber ??
			session.branch ??
			session.worktreePath ??
			session.checks,
	);
	const prState = prStateLozenge(session.status);
	const hasCodeChanges = session.additions !== undefined && session.deletions !== undefined;
	const checksTotal = session.checks ? session.checks.passed + session.checks.failed : 0;

	return (
		<div className="flex flex-col gap-2">
			{hideHeader ? null : (
				<div className="flex items-start justify-between gap-3">
					<p className="min-w-0 text-xs font-medium leading-5 text-text" title={session.title}>
						{session.title}
					</p>
					<span className="flex shrink-0 items-center gap-1">
						{session.status === "awaiting-input" ? (
							<Lozenge variant="information">Needs input</Lozenge>
						) : (
							<span className="text-[12px] leading-5 text-text-subtlest">
								{JIRA_SESSION_UPDATED_LABEL[session.status]}
							</span>
						)}
						{session.invokedBy && session.status !== "awaiting-input" ? (
							<Avatar className="shrink-0" label={session.invokedBy.name} size="xs">
								{session.invokedBy.src ? <AvatarImage alt="" src={session.invokedBy.src} /> : null}
								<AvatarFallback>{actorInitials(session.invokedBy.name)}</AvatarFallback>
							</Avatar>
						) : null}
					</span>
				</div>
			)}

			<div className="flex flex-col gap-2">
				<FlyoutRow icon={hostIcon(session.host)} label="Session">
					{session.host === "cloud" ? "Cloud" : "Local"}
				</FlyoutRow>
				{hideAgentRow ? null : (
					<FlyoutRow icon={<AiAgentIcon label="" size="small" />} label="Agent">
						<HoverCard closeDelay={120} openDelay={0}>
						{/* Base UI reads delays on the Trigger, not the Root. Set them here
						    too so this nested agent card opens instantly and tolerates the
						    pointer travel from the surrounding session flyout (which itself
						    closes with 0ms delay) without dismissing before it appears. */}
						<HoverCardTrigger
							closeDelay={120}
							delay={0}
							render={
								<Tag
									color="gray"
									elemBefore={
										<span aria-hidden>
											<AgentAvatarVisual
												avatarClassName="after:border-0"
												avatarSrc={session.agentAvatarSrc}
												brandName={session.brandName}
												fallbackText={session.agentName}
												label={session.agentName}
												sizePx={16}
												vpkLogo={session.vpkLogo}
											/>
										</span>
									}
									type="agent"
									variant="editor"
								>
									{session.agentName}
								</Tag>
							}
						/>
						<HoverCardContent
							align={previewPosition?.align ?? "center"}
							alignOffset={previewPosition?.alignOffset ?? 0}
							className="w-[360px] max-w-[calc(100vw-48px)] rounded-xl border-0 bg-transparent p-0 shadow-none"
							side={previewPosition?.side ?? "right"}
							sideOffset={8}
						>
							<AgentProfileCard
								avatarSrc={session.agentAvatarSrc}
								name={session.agentName}
								surface="overlay"
							/>
						</HoverCardContent>
						</HoverCard>
					</FlyoutRow>
				)}
				<FlyoutRow icon={<TaskIcon label="" size="small" />} label="Work item">
					<SmartLink
						align={previewPosition?.align ?? "center"}
						alignOffset={previewPosition?.alignOffset ?? 0}
						className="min-w-0 max-w-full"
						item={toWorkItem(session)}
						showStatus
						side={previewPosition?.side ?? "right"}
					/>
				</FlyoutRow>
			</div>

			{hasDevelopment ? (
				<div className="flex flex-col gap-2">
					{session.pullRequestNumber ? (
						<FlyoutRow icon={prStateIcon(session.status)} label="Pull request">
							<span className="flex min-w-0 flex-1 items-center gap-1">
								<Lozenge variant={prState.variant}>{prState.label}</Lozenge>
								<MetadataPathLink
									className="text-text"
									title={
										session.pullRequestTitle
											? `#${session.pullRequestNumber}: ${session.pullRequestTitle}`
											: `#${session.pullRequestNumber}`
									}
								>
									{session.pullRequestTitle
										? `#${session.pullRequestNumber}: ${session.pullRequestTitle}`
										: `#${session.pullRequestNumber}`}
								</MetadataPathLink>
								{hasCodeChanges ? (
									<span className="ml-auto flex shrink-0 items-center gap-1">
										<span className="text-text-success">+{session.additions}</span>
										<span className="text-text-danger">-{session.deletions}</span>
									</span>
								) : null}
							</span>
						</FlyoutRow>
					) : null}
					{session.checks ? (
						<FlyoutRow
							icon={(
								<ProgressCircle
									aria-hidden
									animated={false}
									size="xs"
									value={checksTotal > 0 ? Math.round((session.checks.passed / checksTotal) * 100) : 0}
									variant="outline"
								/>
							)}
							label="Checks"
						>
							<span className="shrink-0 text-xs font-normal text-text">
								{formatSessionChecks(session.checks)}
							</span>
						</FlyoutRow>
					) : null}
					{session.repository ? (
						<FlyoutRow icon={<FolderClosedIcon label="" size="small" />} label="Repository">
							<span className="flex min-w-0 items-center gap-1">
								<GithubLogo aria-hidden borderless label="" size="xxsmall" />
								<MetadataPathLink segmented title={session.repository}>
									<MetadataPathValue path={session.repository} />
								</MetadataPathLink>
							</span>
						</FlyoutRow>
					) : null}
					{session.branch ? (
						<FlyoutRow icon={<BranchIcon label="" size="small" />} label="Branch">
							<MetadataPathLink segmented title={session.branch}>
								<MetadataPathValue path={session.branch} />
							</MetadataPathLink>
						</FlyoutRow>
					) : null}
					{session.worktreePath ? (
						<FlyoutRow icon={<IfElseIcon label="" size="small" />} label="Worktree">
							<MetadataPathLink className="text-text" title={session.worktreePath}>{session.worktreePath}</MetadataPathLink>
						</FlyoutRow>
					) : null}
				</div>
			) : null}
		</div>
	);
}

type JiraSessionFlyoutPayloadProps = Readonly<
	Pick<
		JiraSessionFlyoutSurfaceProps,
		| "archiveActionLabel"
		| "capturedSessionIds"
		| "onArchiveSession"
		| "onAddAsSubtask"
		| "onCreateWorkItem"
		| "onLinkWorkItem"
		| "onSubmitPrompt"
		| "showUntrackedWorkFooter"
	> & {
		animateAvatars: boolean;
		content: JiraSessionFlyoutContent;
		session: JiraSidebarSessionItem;
	}
>;

type JiraSessionUntrackedWorkActions = Readonly<{
	archiveActionLabel: string;
	onArchiveSession?: () => void;
	onAddAsSubtask?: (workItemKey: string) => void;
	onCreateWorkItem?: () => void;
	onLinkWorkItem?: (workItemKey: string) => void;
}>;

function resolveJiraSessionUntrackedWorkActions({
	archiveActionLabel = "Archive",
	capturedSessionIds,
	onArchiveSession,
	onAddAsSubtask,
	onCreateWorkItem,
	onLinkWorkItem,
	session,
}: Omit<JiraSessionFlyoutPayloadProps, "content">): JiraSessionUntrackedWorkActions {
	const captureLocked = capturedSessionIds?.has(session.id) ?? false;

	return {
		archiveActionLabel,
		onArchiveSession: onArchiveSession === undefined
			? undefined
			: () => onArchiveSession(session),
		onAddAsSubtask: captureLocked || onAddAsSubtask === undefined
			? undefined
			: (workItemKey) => onAddAsSubtask(session, workItemKey),
		onCreateWorkItem: captureLocked || onCreateWorkItem === undefined
			? undefined
			: () => onCreateWorkItem(session),
		onLinkWorkItem: captureLocked || onLinkWorkItem === undefined
			? undefined
			: (workItemKey) => onLinkWorkItem(session, workItemKey),
	};
}

function JiraSessionComposerFlyout({
	onSubmitPrompt,
	session,
}: Pick<JiraSessionFlyoutPayloadProps, "onSubmitPrompt" | "session">) {
	return (
		<AgentStates
			agent={{
				avatarSrc: session.agentAvatarSrc,
				brandName: session.brandName,
				id: session.id,
				name: session.agentName,
			}}
			className="w-[320px] max-w-[calc(100vw-48px)] rounded-none shadow-none"
			completedAtMs={session.completedAtMs}
			completedSecondsAgo={session.completedSecondsAgo}
			initialElapsedSeconds={session.initialElapsedSeconds}
			message={toAgentStatesMessage(session.status)}
			onSubmit={onSubmitPrompt ? (prompt) => onSubmitPrompt(session, prompt) : undefined}
			startedAtMs={session.startedAtMs}
			state={toAgentStatesState(session.status)}
		/>
	);
}

function JiraSessionUntrackedWorkFlyout(props: Omit<JiraSessionFlyoutPayloadProps, "content">) {
	return (
		<JiraSessionUntrackedWorkCard
			{...resolveJiraSessionUntrackedWorkActions(props)}
			animateAvatars={props.animateAvatars}
			session={props.session}
			showFooter={props.showUntrackedWorkFooter}
		/>
	);
}

function JiraSessionFlyoutPayload({ content, ...props }: JiraSessionFlyoutPayloadProps) {
	switch (content) {
		case "composer":
			return <JiraSessionComposerFlyout {...props} />;
		case "untracked-work":
			return <JiraSessionUntrackedWorkFlyout {...props} />;
		case "details":
			return (
				<JiraSessionDetailsCard
					animateAvatars={props.animateAvatars}
					session={props.session}
				/>
			);
		default: {
			const _exhaustive: never = content;
			return _exhaustive;
		}
	}
}

/**
 * One payload-aware flyout shared by every session row in a list. Defaults to
 * the compact session hover card; pass `content="composer"` for the Agent States
 * prompt composer or `content="untracked-work"` for a Jira-link suggestion.
 * Base UI's viewport keeps the popup mounted while the anchor
 * changes. The shell follows the new row and immediately adopts its measured
 * size without letting rapid hovers restart a stale size transition. Low-traffic
 * surfaces crossfade payload; high-frequency session lists and rails pass
 * `instantPosition` so the shell snaps with no enter, exit, position, or
 * content-switch motion.
 */
export function JiraSessionFlyoutSurface({
	anchor,
	positionMethod,
	archiveActionLabel,
	capturedSessionIds,
	content = "details",
	handle,
	instantPosition = false,
	onOpenChange,
	popupRef,
	onArchiveSession,
	onAddAsSubtask,
	onCreateWorkItem,
	onLinkWorkItem,
	onSubmitPrompt,
	showUntrackedWorkFooter = true,
}: Readonly<JiraSessionFlyoutSurfaceProps>) {
	const suspensionHandle = use(JiraSessionFlyoutSuspensionContext);
	const suspended = suspensionHandle !== null;

	useEffect(() => {
		if (suspended) {
			handle.close();
		}
	}, [handle, suspended]);

	return (
		<ConeSafezone<JiraSidebarSessionItem> handle={handle} onOpenChange={onOpenChange}>
			{({ payload }) => (
				<ConeSafezoneContent
					anchor={anchor}
					positionMethod={positionMethod}
					ref={popupRef}
					align="start"
					alignOffset={0}
					className={cn(
						"h-(--popup-height) w-(--popup-width) border-0 bg-surface-overlay p-0 text-text shadow-overlay data-[side=right]:data-starting-style:translate-x-0 data-[side=right]:data-ending-style:translate-x-0",
						instantPosition
							? "transition-none data-starting-style:opacity-100 data-starting-style:scale-100 data-ending-style:opacity-100 data-ending-style:scale-100"
							: "transition-[opacity,scale,translate] duration-medium ease-in-out motion-reduce:transition-none data-ending-style:duration-normal data-ending-style:ease-in",
					)}
					positionerClassName={cn(
						"h-(--positioner-height) w-(--positioner-width) max-w-(--available-width)",
						instantPosition
							? "transition-none"
							: "transition-[top,left,right,bottom] duration-medium ease-in-out motion-reduce:transition-none data-instant:transition-none",
					)}
					side="right"
					sideOffset={8}
				>
					<HoverCardViewport
						className={cn(
							"relative size-full overflow-clip rounded-[inherit] [&_[data-current]]:w-(--popup-width) [&_[data-current]]:opacity-100 [&_[data-previous]]:w-(--popup-width) [&_[data-previous]]:opacity-100",
							instantPosition
								? "[&_[data-current]]:transition-none [&_[data-previous]]:transition-none [&_[data-previous][data-ending-style]]:opacity-0"
								: "[&_[data-current]]:transition-opacity [&_[data-current]]:duration-medium [&_[data-current]]:ease-in-out [&_[data-current]]:[will-change:opacity] [&_[data-current][data-starting-style]]:opacity-0 [&_[data-previous]]:transition-opacity [&_[data-previous]]:duration-medium [&_[data-previous]]:ease-in-out [&_[data-previous]]:[will-change:opacity] [&_[data-previous][data-ending-style]]:opacity-0 motion-reduce:[&_[data-current]]:transition-none motion-reduce:[&_[data-current]]:[will-change:auto] motion-reduce:[&_[data-previous]]:transition-none motion-reduce:[&_[data-previous]]:[will-change:auto] data-instant:[&_[data-current]]:transition-none data-instant:[&_[data-previous]]:transition-none",
						)}
					>
						{payload ? (
							<JiraSessionFlyoutPayload
								animateAvatars={!instantPosition}
								archiveActionLabel={archiveActionLabel}
								capturedSessionIds={capturedSessionIds}
								content={content}
								onArchiveSession={onArchiveSession}
								onAddAsSubtask={onAddAsSubtask}
								onCreateWorkItem={onCreateWorkItem}
								onLinkWorkItem={onLinkWorkItem}
								onSubmitPrompt={onSubmitPrompt}
								session={payload}
								showUntrackedWorkFooter={showUntrackedWorkFooter}
							/>
						) : null}
					</HoverCardViewport>
				</ConeSafezoneContent>
			)}
		</ConeSafezone>
	);
}

export default JiraSessionFlyoutBody;
