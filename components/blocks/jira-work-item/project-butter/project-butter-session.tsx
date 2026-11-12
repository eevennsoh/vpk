"use client";

import CloseIcon from "@atlaskit/icon/core/close";

import type { ProjectButterSessionItem } from "@/components/blocks/jira-work-item/project-butter/data";
import { AgentState } from "@/components/blocks/agent-state";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ProjectButterSession({
	draft,
	onClose,
	onDraftChange,
	onReply,
	replies,
	session,
}: Readonly<{
	draft: string;
	onClose: () => void;
	onDraftChange: (value: string) => void;
	onReply: () => void;
	replies: readonly string[];
	session: ProjectButterSessionItem;
}>) {
	return (
		<section aria-label={`${session.title} session`} className="min-w-0 rounded-lg border border-border p-4">
			<div className="mb-3 flex items-start justify-between gap-3">
				<h3 className="text-sm font-semibold text-text">{session.title}</h3>
				<Button aria-label="Close session" onClick={onClose} size="icon-compact" type="button" variant="ghost"><CloseIcon label="" size="small" /></Button>
			</div>
			<AgentState
				agent={{ ...session.agent, id: session.agent.id ?? session.id }}
				composer="hidden"
				message={session.message}
				state={session.state === "running" ? "working" : session.state === "complete" ? "completed" : "awaiting-input"}
			/>
			<div aria-live="polite" className="mt-4 space-y-2">
				{replies.map((reply, index) => <p className="rounded-md bg-bg-neutral p-3 text-sm text-text" key={`${session.id}-${index}`}>{reply}</p>)}
			</div>
			<form className="mt-4 flex flex-col gap-3" onSubmit={(event) => { event.preventDefault(); onReply(); }}>
				<Textarea aria-label={`Reply to ${session.agent.name}`} onChange={(event) => onDraftChange(event.currentTarget.value)} placeholder="Give the agent direction…" value={draft} />
				<Button className="self-end" disabled={!draft.trim()} type="submit">Send reply</Button>
			</form>
		</section>
	);
}
