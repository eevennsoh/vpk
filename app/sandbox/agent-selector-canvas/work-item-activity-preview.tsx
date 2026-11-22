"use client";

import {
	useEffect,
	useId,
	useMemo,
	useReducer,
	useState,
	type CSSProperties,
	type MouseEvent,
	type ReactNode,
} from "react";
import { ContextChip } from "@/components/ui-custom/context-chip";
import { createCommentEntry, createReply, jiraActivityReducer } from "@/components/blocks/jira-activity/lib/jira-activity-reducer";
import { ProjectButterCommentEditor } from "@/components/blocks/jira-work-item/project-butter/project-butter-comment-editor";
import ReplyLeftIcon from "@atlaskit/icon-lab/core/reply-left";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import { AgentSessionCard, type AgentSessionItem } from "@/components/blocks/agent-session";
import {
	JiraActivity,
	JiraActivityEntryGlyph,
	type JiraActivityEntry,
	type JiraActivityReply,
	type JiraActivityActor,
	type JiraActivityCommentEntry,
} from "@/components/blocks/jira-activity";
import { getTeammateSessionPeople, TeammateSessionAvatars } from "@/components/blocks/agent-assignment/components/teammate-session-avatars";
import { ProjectButterActivityFilterMenu } from "@/components/blocks/jira-work-item/project-butter/activity-filter-menu";
import { PROJECT_BUTTER_ACTIVITY_FILTERS_ALL } from "@/components/blocks/jira-work-item/project-butter/activity-feed-model";
import { PROJECT_BUTTER_REFERENCE_HISTORY } from "@/components/blocks/jira-work-item/project-butter/reference-data";
import { ProjectButterHistoryChange } from "@/components/blocks/jira-work-item/project-butter/reference-activity-body";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Icon } from "@/components/ui/icon";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
	ACTIVITY_OWNER_SESSION,
	ACTIVITY_PREVIEW_USER,
	ACTIVITY_TEAMMATE_SESSION,
	activityOwnerReducer,
	createActivityPreviewEntries,
} from "@/app/sandbox/agent-selector-canvas/work-item-activity-data";
import { SESSION_THREAD_RAIL, SUMMARIZED_THREAD, SUMMARY_TRANSITION, useWorkItemThreadSummary, type ThreadSummary } from "@/components/blocks/jira-work-item/project-butter/activity-thread-summary";

type ActivityView = "timeline" | "sessions";
const cannotResume = () => false;
const HISTORY = new Map(PROJECT_BUTTER_REFERENCE_HISTORY.map((item) => [item.id, item]));
function EarlierReplies({ replies, expanded, collapseAll }: Readonly<{
	replies: readonly JiraActivityReply[];
	expanded: boolean;
	collapseAll: boolean;
}>) {
	const participants = [...new Map(replies.map((reply) => [reply.actor.id, reply.actor])).values()]
		.reverse().slice(0, 3);
	return expanded ? "Hide replies" : (
		<>
			<span aria-hidden className="flex gap-0.5">
				{participants.map((actor) => (
					<JiraActivityEntryGlyph actor={actor} animate={false} key={actor.id} />
				))}
			</span>
			<span>
				{collapseAll ? `${replies.length} ${replies.length === 1 ? "reply" : "replies"}`
					: `Show ${replies.length} more ${replies.length === 1 ? "reply" : "replies"}`}
			</span>
		</>
	);
}

type ReplyTarget = { entryId: string; targetId: string; actor: JiraActivityActor };

function ActivitySessionCard({ session, onOpen }: Readonly<{
	session: AgentSessionItem;
	onOpen: (session: AgentSessionItem) => void;
}>) {
	return (
		<ul className="rounded-lg border border-border bg-surface">
			<AgentSessionCard
				item={session}
				density="long"
				animateLayout={false}
				localSessionAction="view"
				isResumable={cannotResume}
				onView={session.role === "viewer" ? undefined : onOpen}
				showMoreMenu={false}
				showWorkingSpinner={session.state === "running"}
			/>
		</ul>
	);
}

function ActivityThread({ selectedReply, onSelectReply, entries, onEntriesChange, session, onOpenSession, summary, onDraft, postedReplyId }: Readonly<{
	entries: readonly JiraActivityEntry[];
	selectedReply: ReplyTarget | null;
	onSelectReply: (entry: JiraActivityCommentEntry, targetId: string, actor: JiraActivityActor) => void;
	onEntriesChange: (entries: readonly JiraActivityEntry[]) => void;
	session?: AgentSessionItem;
	onOpenSession: (session: AgentSessionItem) => void;
	postedReplyId?: string;
	summary?: ThreadSummary;
	onDraft?: (sources: readonly JiraActivityReply[]) => void;
}>) {
	const threadSummary = useWorkItemThreadSummary(entries[0]?.kind === "comment" ? entries[0] : undefined);
	const summarized = Boolean(summary && threadSummary.summarized);
	const showLatestReply = postedReplyId !== undefined;
	const visibleEntries = entries.map((entry) => entry.kind === "comment"
		? { ...entry, replyPreviewCount: showLatestReply ? 1 : 0, defaultRepliesExpanded: false }
		: entry);
	return (
		<div style={{ "--summary-header-inset": `${summarized ? threadSummary.headerInset : 0}px` } as CSSProperties}>
			<JiraActivity
				key={postedReplyId}
				className={cn(
					SESSION_THREAD_RAIL,
					summary && SUMMARY_TRANSITION,
					summarized && SUMMARIZED_THREAD,
				)}
				entries={visibleEntries}
				onEntriesChange={onEntriesChange}
				currentUser={ACTIVITY_PREVIEW_USER}
				composer={null}
				hideHeader
				connectorStyle="thread"
				commentHeaderLayout="inline"
				commentActionsPlacement="hover"
				earlierRepliesSelectedAppearance="icon-only"
				selectedReply={selectedReply}
				onSelectReply={onSelectReply}
				renderCommentAvatar={summary ? threadSummary.renderAvatar : undefined}
				renderCommentTools={summary ? (entry, reply) => reply ? null : threadSummary.renderAction(entry.replies ?? []) : undefined}
				renderCommentReplies={summary ? (_entry, replies, expandReplies) => threadSummary.renderReplies(replies, expandReplies, summary, onDraft) : undefined}
				renderEarlierRepliesLabel={(replies, expanded) => (
					<EarlierReplies replies={replies} expanded={expanded} collapseAll={!showLatestReply} />
				)}
				renderCommentBody={session ? () => <ActivitySessionCard session={session} onOpen={onOpenSession} /> : undefined}
			/>
		</div>
	);
}


function TeammateGroup({ view, sessions, children }: Readonly<{
	view: ActivityView;
	sessions: readonly AgentSessionItem[];
	children: ReactNode;
}>) {
	const [open, setOpen] = useState(true);
	const id = useId();
	const folded = view === "sessions" && !open;
	const label = getTeammateSessionPeople(sessions).size === 1 ? "Using an agent" : "Using agents";
	return (
		<div>
			<div hidden={view !== "sessions"}>
				<Button
					className="gap-2 border-0 ps-0 pe-2"
					variant="ghost"
					selectedAppearance="icon-only"
					aria-expanded={!folded}
					aria-controls={id}
					onClick={() => setOpen((current) => !current)}
				>
					<span className="flex min-w-8 shrink-0 justify-center">
						<TeammateSessionAvatars items={sessions} />
					</span>
					<span>{label}</span>
					<Icon
						className={open ? "rotate-90" : undefined}
						render={<ChevronRightIcon label="" size="small" />}
					/>
				</Button>
			</div>
			<div className="pt-3" hidden={folded} id={id}>{children}</div>
		</div>
	);
}

export function WorkItemActivityPreview({ initialView = "timeline" }: Readonly<{ initialView?: ActivityView }>) {
	const [fixture] = useState(createActivityPreviewEntries);
	const [view, setView] = useState(initialView);
	const [owner, dispatch] = useReducer(activityOwnerReducer, { entry: fixture.owner, draft: { kind: "idle" }, working: false });
	const pendingReplyId = owner.draft.kind === "pending" ? owner.draft.replyId : null;
	useEffect(() => {
		if (!pendingReplyId) return;
		const timer = window.setTimeout(() => dispatch({ type: "acknowledge", replyId: pendingReplyId }), 3000);
		return () => window.clearTimeout(timer);
	}, [pendingReplyId]);
	const [teammateEntries, setTeammateEntries] = useState<readonly JiraActivityEntry[]>([fixture.teammate]);
	const [comments, setComments] = useState<readonly JiraActivityEntry[]>(fixture.comments);
	const [expandedAudit, setExpandedAudit] = useState(false);
	const [commentDraft, setCommentDraft] = useState("");
	const [target, setTarget] = useState<"instruction" | ReplyTarget | null>(null);
	const replyTarget = typeof target === "object" ? target : null;
	const [postedReplyIds, setPostedReplyIds] = useState<Readonly<Record<string, string>>>({});
	const [focusRequest, setFocusRequest] = useState(0);
	const instruction = target === "instruction" && owner.draft.kind === "review" ? owner.draft : null;
	const [selection, setSelection] = useState("");
	const headingId = useId();
	const rows = useMemo(
		() => [owner.entry, ...fixture.audit, ...comments, ...teammateEntries],
		[owner.entry, fixture.audit, comments, teammateEntries],
	);
	const replyTitle = replyTarget?.entryId === fixture.owner.id ? ACTIVITY_OWNER_SESSION.title
		: replyTarget?.entryId === fixture.teammate.id ? ACTIVITY_TEAMMATE_SESSION.title : replyTarget?.actor.name;
	const ownerSession = owner.working ? { ...ACTIVITY_OWNER_SESSION, state: "running" as const } : ACTIVITY_OWNER_SESSION;
	const openSession = (session: AgentSessionItem) => setSelection("Selected " + session.title + " · Preview only");
	function selectReply(entry: JiraActivityCommentEntry, targetId: string, actor: JiraActivityActor) {
		const selected = replyTarget?.entryId === entry.id && replyTarget.targetId === targetId;
		setTarget(selected ? null : { entryId: entry.id, targetId, actor });
		setFocusRequest((request) => request + 1);
	}
	function submitReply(target: ReplyTarget, body: string) {
		const action = { type: "add-reply" as const, entryId: target.entryId, reply: createReply({ id: crypto.randomUUID(), actor: ACTIVITY_PREVIEW_USER, timestamp: "Just now", body }) };
		const append = (entries: readonly JiraActivityEntry[]) => jiraActivityReducer({ entries }, action).entries;
		if (target.entryId === owner.entry.id) dispatch({ type: "entries", entries: append([owner.entry]) });
		else if (target.entryId === fixture.teammate.id) setTeammateEntries(append);
		else setComments(append);
		setPostedReplyIds((ids) => ({ ...ids, [target.entryId]: action.reply.id }));
		setCommentDraft("");
		setTarget(null);
	}
	function preventNavigation(event: MouseEvent<HTMLElement>) {
		if (!(event.target instanceof Element) || !event.target.closest("a[href]")) return;
		event.preventDefault();
		setSelection("Preview only · External navigation stays closed.");
	}
	const ownerSection = (
		<div key="owner">
			<ActivityThread
				selectedReply={replyTarget}
				onSelectReply={selectReply}
				entries={[owner.entry]}
				onEntriesChange={(entries) => dispatch({ type: "entries", entries })}
				session={ownerSession}
				summary={{
					text: "Annie asked Cursor to check account setup and keyboard navigation. Cursor found that the validation messages need recovery instructions and the error summary needs focus. Annie agreed to include both fixes in the next pass.",
					fixtureReplyCount: fixture.owner.replies?.length ?? 0,
				}}
				onDraft={pendingReplyId ? undefined : (sources) => {
					dispatch({ type: "draft", sources });
					setTarget("instruction");
					setFocusRequest((request) => request + 1);
				}}
				postedReplyId={postedReplyIds[owner.entry.id]}
				onOpenSession={openSession}
			/>
		</div>
	);
	const teammateSection = (
		<div key="teammates">
			<TeammateGroup view={view} sessions={[ACTIVITY_TEAMMATE_SESSION]}>
				<ActivityThread
					selectedReply={replyTarget}
					onSelectReply={selectReply}
					entries={teammateEntries}
					onEntriesChange={setTeammateEntries}
					session={ACTIVITY_TEAMMATE_SESSION}
					summary={{
						text: "Claude reviewed the Teamwork onboarding guide in PR #1839. Annie’s session is waiting for a choice between first-run setup and the returning-user journey.",
						fixtureReplyCount: fixture.teammate.replies?.length ?? 0,
					}}
					postedReplyId={postedReplyIds[fixture.teammate.id]}
					onOpenSession={() => undefined}
				/>
			</TeammateGroup>
		</div>
	);
	const timeline = (
		<div hidden={view !== "timeline"}>
			<JiraActivity
				entries={rows.map((entry) => entry.kind === "comment" ? { ...entry, replyPreviewCount: 1, defaultRepliesExpanded: false } : entry)}
				onEntriesChange={(entries) => {
					dispatch({ type: "entries", entries });
					setTeammateEntries(entries.filter((entry) => entry.id === fixture.teammate.id));
					setComments(entries.filter((entry) => entry.kind === "comment" && entry.id !== fixture.owner.id && entry.id !== fixture.teammate.id));
				}}
				currentUser={ACTIVITY_PREVIEW_USER}
				composer={null}
				hideHeader
				connectorStyle="thread"
				commentHeaderLayout="inline"
				commentActionsPlacement="hover"
				earlierRepliesSelectedAppearance="icon-only"
				fadeAfterLast
				selectedReply={replyTarget}
				onSelectReply={selectReply}
				renderEarlierRepliesLabel={(replies, expanded) => <EarlierReplies replies={replies} expanded={expanded} collapseAll={false} />}
				renderCommentBody={(entry) => {
					const session = entry.id === fixture.owner.id ? ownerSession
						: entry.id === fixture.teammate.id ? ACTIVITY_TEAMMATE_SESSION : undefined;
					return session ? <ActivitySessionCard session={session} onOpen={openSession} /> : undefined;
				}}
				renderEntry={(entry) => {
					const item = HISTORY.get(entry.id);
					return item ? (
						<ProjectButterHistoryChange
							key={entry.id + "-" + expandedAudit}
							actor={entry.actor}
							item={item}
							timestamp={entry.timestamp}
							defaultOpen={expandedAudit}
						/>
					) : undefined;
				}}
			/>
		</div>
	);
	return (
		<TooltipProvider>
			<section
				onClickCapture={preventNavigation}
				onAuxClickCapture={preventNavigation}
				aria-labelledby={headingId}
				className="min-w-0 bg-surface px-4 pt-4 text-text"
				data-work-item-activity-preview={initialView}
			>
				<header className="mb-3 flex flex-wrap items-center gap-2">
					<h2 className="text-sm font-medium" id={headingId}>Activity</h2>
					<ToggleGroup
						aria-label="Activity view"
						className="ml-auto"
						variant="outline"
						size="sm"
						value={[view]}
						onValueChange={([nextView]) => {
							if (nextView === "timeline" || nextView === "sessions") setView(nextView);
						}}
					>
						<ToggleGroupItem value="timeline">Timeline</ToggleGroupItem>
						<ToggleGroupItem value="sessions">Agent sessions</ToggleGroupItem>
					</ToggleGroup>
					<ProjectButterActivityFilterMenu
						filters={PROJECT_BUTTER_ACTIVITY_FILTERS_ALL}
						sort="newest"
						expandDetails={expandedAudit}
						onExpandDetailsChange={setExpandedAudit}
					/>
				</header>
				{timeline}
				<div className={view === "sessions" ? "grid gap-3" : "hidden"}>
					{ownerSection}
					{teammateSection}
				</div>
				<p className="mt-2 text-xs text-text-subtle" role="status">{selection}</p>
				<div className="sticky bottom-0 z-30 mt-4 rounded-xl bg-surface" data-project-butter-comment-bar>
					<ProjectButterCommentEditor
						agents={[]}
						focusRequest={focusRequest}
						textboxLabel={instruction ? "Instruction for your Cursor session" : "Comment editor"}
						value={instruction?.text ?? commentDraft}
						inputContext={instruction || replyTarget ? (
							<ContextChip
								testId="reply-target-chip"
								countLabel={`Replying to ${instruction ? ACTIVITY_OWNER_SESSION.title : replyTitle}`}
								triggerLabel={instruction ? `Review ${instruction.sources.length} source replies` : `Replying to ${replyTitle}`}
								iconSize="default"
								icon={<ReplyLeftIcon color="currentColor" label="" />}
								items={instruction ? instruction.sources.map((reply) => ({ id: reply.id, title: reply.actor.name, subtitle: reply.timestamp, body: reply.body }))
									: [{ id: replyTarget!.entryId, title: replyTitle ?? "", body: "Replying in this activity thread" }]}
								onRemoveAll={() => { setTarget(null); setFocusRequest((request) => request + 1); }}
								removeAllLabel="Remove reply target"
							/>
						) : undefined}
						onValueChange={(text) => {
							if (instruction) dispatch({ type: "text", text });
							else setCommentDraft(text);
						}}
						onSave={(body) => {
							if (instruction) {
								const replyId = crypto.randomUUID();
								dispatch({ type: "send", text: body, replyId });
								setPostedReplyIds((ids) => ({ ...ids, [owner.entry.id]: replyId }));
								setTarget(null);
							} else if (replyTarget) {
								submitReply(replyTarget, body);
							} else {
								const entry = createCommentEntry({ id: crypto.randomUUID(), body, actor: ACTIVITY_PREVIEW_USER, timestamp: "Just now" });
								setComments((current) => [entry, ...current]);
								setCommentDraft("");
								setView("timeline");
							}
						}}
					/>
				</div>
			</section>
		</TooltipProvider>
	);
}
