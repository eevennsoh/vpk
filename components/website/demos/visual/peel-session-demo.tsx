"use client";

import { useEffect, useRef } from "react";

import { AgentSession } from "@/components/blocks/agent-session";
import { toJiraIssueAgentActivityFromSession } from "@/components/blocks/agent-session/agent-session-work-item";
import { JiraIssue } from "@/components/blocks/jira-issue";
import { JiraLinking } from "@/components/blocks/jira-linking";
import { Button } from "@/components/ui/button";

import { PEEL_CLAUDE_SESSION, PEEL_WORK_ITEM } from "./peel-session-data";
import { usePeelSessionDemo } from "./use-peel-session-demo";

const SESSIONS = [PEEL_CLAUDE_SESSION];
const IDLE_SESSIONS = [{ ...PEEL_CLAUDE_SESSION, state: "complete" as const }];
const ACTIVITIES = [toJiraIssueAgentActivityFromSession(PEEL_CLAUDE_SESSION)];
const WORK_ITEMS = [PEEL_WORK_ITEM];

/** Standalone source and receiver, using the same presenters as the session column. */
export function PeelSessionDemo({ active = true }: Readonly<{ active?: boolean }>) {
	const targetRef = useRef<HTMLDivElement>(null);
	const sourceRef = useRef<HTMLDivElement>(null);
	const resetRef = useRef<HTMLButtonElement>(null);
	const { attach, commitLink, control, identities, link, release, reset } = usePeelSessionDemo(targetRef);
	useEffect(() => {
		if (!active) return;
		// The source/menu or Reset just unmounted. Restore focus only when
		// nothing else owns it, so an unrelated focused control is preserved.
		if (document.activeElement !== document.body) return;
		const next = link.attached ? resetRef.current : sourceRef.current?.querySelector<HTMLButtonElement>("button");
		next?.focus({ preventScroll: true });
	}, [link.attached, active]);
	useEffect(() => {
		if (!active && release) reset();
	}, [active, release, reset]);
	return (
		<div className="flex w-full flex-col items-center gap-8" data-testid="peel-session-demo">
			<p className="text-sm text-text-subtle">Drag Claude onto the work item.</p>
			<div className="flex w-full flex-col items-center justify-center gap-10 md:flex-row md:items-start">
				<div ref={sourceRef} className={release ? "w-[276px] max-w-full opacity-0" : "w-[276px] max-w-full"} aria-hidden={release ? true : undefined} inert={release ? true : undefined}>
					{link.attached ? (
						<div className="flex min-h-16 flex-col items-start gap-3 p-3">
							<p className="text-sm text-text-subtle">Claude linked to {PEEL_WORK_ITEM.key}.</p>
							<Button ref={resetRef} variant="outline" size="compact" onClick={reset}>Reset</Button>
						</div>
					) : (
						<AgentSession animateLayout={false} items={active ? SESSIONS : IDLE_SESSIONS} glowBloom={active} glowStroke={active} onLinkWorkItem={attach} sessionDrag={control.binding} showWorkingSpinner={active} workItemOptions={WORK_ITEMS} />
					)}
				</div>
				<div ref={targetRef} className="w-[276px] max-w-full" data-testid="peel-work-item">
					<JiraIssue
						issueKey={PEEL_WORK_ITEM.key}
						summary={PEEL_WORK_ITEM.summary}
						tags={[{ text: "wallet", color: "standard" }]}
						priority="medium"
						assigneeAvatarSrc="/avatar-user/andrew-park/color/asow-dev-lime.png"
						chrome="stroke"
						compact
						showMoreAction={false}
						agentActivities={link.attached ? ACTIVITIES : undefined}
						agentSessionDragControl={link.attached ? undefined : control}
						agentSessionTransfer={link.attached ? undefined : { onLink: attach }}
					/>
				</div>
			</div>
			<JiraLinking
				key={link.resetVersion}
				variant="glow"
				identities={identities}
				release={active ? release : null}
				onFuseSettled={commitLink}
				sourceSelector="[data-session-drag-overlay] [data-session-fusion-chip]"
				target={null}
				nearness={0}
			/>
			<p className="sr-only" role="status">{link.attached ? `Claude linked to ${PEEL_WORK_ITEM.key}.` : "Claude is ready to drag."}</p>
		</div>
	);
}
