"use client";

import { useState } from "react";
import type { AgentSessionItem } from "@/components/blocks/agent-session";
import type { WorkItemPerson } from "@/app/contexts/context-work-item-modal";
import { AgentAvatarVisual, type AgentAvatarVisualProps } from "@/components/ui-custom/agent-avatar-visual";
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { projectButterPersonAvatar } from "@/components/blocks/jira-work-item/project-butter/people";

type CrewMember = { name: string; kind: "person"; state: "Working"; avatarSrc?: string } | { name: string; kind: "agent"; state: "Working" | "Needs input" | "Completed"; visual: Pick<AgentAvatarVisualProps, "avatarSrc" | "brandName" | "vpkLogo"> };
const CREW: readonly CrewMember[] = [
	{ name: "Sarah Lim", kind: "person", state: "Working" },
	{ name: "Claude", kind: "agent", state: "Needs input", visual: { brandName: "claude" } },
	{ name: "Marcus Kim", kind: "person", state: "Working" },
	{ name: "Codex", kind: "agent", state: "Working", visual: { brandName: "openai-codex" } },
	{ name: "Cursor", kind: "agent", state: "Completed", visual: { brandName: "cursor" } },
	{ name: "Figma", kind: "agent", state: "Completed", visual: { brandName: "figma" } },
	{ name: "Rovo", kind: "agent", state: "Completed", visual: { vpkLogo: "rovo" } },
];

export function ProjectButterCrew({ assignee, onOpenSession, sessions, useReferenceCrew = true }: Readonly<{ assignee?: WorkItemPerson; onOpenSession: (session: AgentSessionItem) => void; sessions: readonly AgentSessionItem[]; useReferenceCrew?: boolean }>) {
	const [open, setOpen] = useState(false);
	const crew: readonly CrewMember[] = useReferenceCrew ? CREW : [
		...(assignee && assignee.name !== "Automatic" ? [{ name: assignee.name, kind: "person" as const, state: "Working" as const, avatarSrc: assignee.avatarUrl }] : []),
		...sessions.map((session): CrewMember => ({ name: session.agent.name, kind: "agent", state: session.state === "complete" ? "Completed" : session.state === "needs-input" ? "Needs input" : "Working", visual: { avatarSrc: session.agent.avatarSrc, brandName: session.agent.brandName } })),
	];
	if (crew.length === 0) return null;
	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger render={<Button aria-label={`Working on this work item. ${crew.map((member) => `${member.name}, ${member.state}`).join(". ")}`} type="button" variant="ghost" />}>
				<AvatarGroup label="People and agents working on this item">
					{crew.map((member, index) => member.kind === "person" ? <Avatar key={`${member.name}-${index}`} label={member.name} size="default"><AvatarImage src={member.avatarSrc ?? projectButterPersonAvatar(member.name)} /><AvatarFallback>{member.name.slice(0, 1)}</AvatarFallback></Avatar> : <span className="relative shrink-0" key={`${member.name}-${index}`}><AgentAvatarVisual {...member.visual} appearance="coding" label={`${member.name}, ${member.state}`} sizePx={32} status={member.state === "Completed" ? "finished" : member.state === "Needs input" ? "needs-input" : undefined} />{member.state === "Working" ? <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-surface p-0.5"><Spinner label="Working" size="xs" /></span> : null}</span>)}
				</AvatarGroup>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-80 p-3" positionerClassName="z-[650]">
				<p className="mb-3 text-sm font-semibold">Working on this work item</p>
				<ul className="space-y-2 text-sm">{crew.map((member, index) => <li className="flex justify-between gap-3" key={`${member.name}-${index}`}><span>{member.name}</span><span className="text-text-subtle">{member.state}</span></li>)}</ul>
				<p className="mb-1 mt-4 text-xs font-medium text-text-subtle">Agent sessions</p>
				{sessions.map((session) => <Button aria-label={`Open ${session.agent.name} session`} className="w-full justify-start" key={session.id} onClick={() => { onOpenSession(session); setOpen(false); }} type="button" variant="ghost">{session.title}</Button>)}
			</PopoverContent>
		</Popover>
	);
}
