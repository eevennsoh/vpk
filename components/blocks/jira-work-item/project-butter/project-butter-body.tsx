"use client";

import { useId, type ReactNode } from "react";
import InformationCircleIcon from "@atlaskit/icon/core/information-circle";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";

import { AgentSession, type AgentSessionItem } from "@/components/blocks/agent-session";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";

import { ProjectButterActivity } from "@/components/blocks/jira-work-item/project-butter/project-butter-activity";
import { ProjectButterCommentBar } from "@/components/blocks/jira-work-item/project-butter/project-butter-comment-bar";
import { ProjectButterRelatedWork } from "@/components/blocks/jira-work-item/project-butter/project-butter-related-work";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";

export function ProjectButterBody({
	active,
	sidePanel,
	content,
	details,
	empty,
	onOpenSession,
	onStartCoding,
	selectedSessionId,
	sessionDetail,
	sessions,
}: Readonly<{
	active: boolean;
	sidePanel: boolean;
	content: ProjectButterContent;
	details?: ReactNode;
	empty: boolean;
	onOpenSession: (sessionId: string | null) => void;
	onStartCoding: () => void;
	selectedSessionId: string | null;
	sessionDetail: ReactNode;
	sessions: readonly AgentSessionItem[];
}>) {
	const id = useId();
	const {
		description, setDescription, descriptionDraft, setDescriptionDraft,
		editingDescription, setEditingDescription, sortByName, setSortByName,
	} = content;
	const visibleSessions = sortByName ? [...sessions].sort((a, b) => a.title.localeCompare(b.title)) : sessions;
	return (
		<div className="flex min-w-0 flex-col gap-6">
			<section aria-labelledby={`${id}-description`}>
				{empty && !description ? <span className="sr-only" id={`${id}-description`}>Description</span> : <h2 className="mb-2 text-sm font-semibold text-text" id={`${id}-description`}>Description</h2>}
				{editingDescription ? (
					<form className="space-y-3" onSubmit={(event) => { event.preventDefault(); setDescription(descriptionDraft); setEditingDescription(false); }}>
						<Textarea aria-label="Work item description" onChange={(event) => setDescriptionDraft(event.currentTarget.value)} rows={6} value={descriptionDraft} />
						<div className="flex gap-2">
							<Button type="submit">Save</Button>
							<Button onClick={() => { setDescriptionDraft(description); setEditingDescription(false); }} type="button" variant="ghost">Cancel</Button>
						</div>
					</form>
				) : (
					<button aria-label="Edit description" className="w-full cursor-text rounded-sm text-left text-sm leading-6 text-text outline-none hover:bg-bg-neutral-subtle-hovered focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setEditingDescription(true)} type="button">
						{description || "Add description"}
					</button>
				)}
			</section>
			{details}
			{empty ? null : <ProjectButterRelatedWork content={content} />}
			{sessions.length > 0 ? <section aria-labelledby={`${id}-sessions`} className="min-w-0">
				<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
					<h2 className="text-sm font-semibold text-text" id={`${id}-sessions`}>Agent sessions</h2>
					<div className="flex items-center gap-2 text-xs text-text-subtle">
						<InformationCircleIcon label="" size="small" />
						<span>Uses AI. Verify results.</span>
						<DropdownMenu>
							<DropdownMenuTrigger render={<Button aria-label="Agent session actions" size="icon-compact" type="button" variant="ghost" />}><ShowMoreHorizontalIcon label="" size="small" /></DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onSelect={onStartCoding}>Start coding session</DropdownMenuItem>
								<DropdownMenuItem onSelect={() => setSortByName((current) => !current)}>{sortByName ? "Sort by recent" : "Sort by name"}</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
				<div className="space-y-3">
					{visibleSessions.map((session) => (
						<div className="rounded-lg border border-border" key={session.id}>
							<AgentSession animateLayout={false} density="long" items={[session]} onSelectedItemIdChange={onOpenSession} onView={(item) => onOpenSession(item.id)} selectedItemId={selectedSessionId} showBranch showLinkWorkItemMenuItem={false} variant="large" />
						</div>
					))}
				</div>
				{sessionDetail ? <div className="mt-4">{sessionDetail}</div> : null}
			</section> : null}
			<ProjectButterActivity content={content} sidePanel={sidePanel} />
			<ProjectButterCommentBar active={active} content={content} empty={empty} sidePanel={sidePanel} />
		</div>
	);
}
