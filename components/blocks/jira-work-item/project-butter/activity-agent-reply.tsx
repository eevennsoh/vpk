"use client";

import { useEffect, useState } from "react";

import type { JiraActivityReply } from "@/components/blocks/jira-activity/jira-activity-types";
import { Button } from "@/components/ui/button";
import { ChainOfThought, ChainOfThoughtHeader } from "@/components/ui/chain-of-thought";

const PROGRESS_LABELS = ["Thinking...", "Gathering context...", "Analyzing request...", "Working on it...", "Drafting reply..."] as const;

export function AgentReplyProgress({ startedAtMs }: Readonly<{ startedAtMs: number }>) {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const timer = window.setInterval(() => setNow(Date.now()), 2000);
		return () => window.clearInterval(timer);
	}, []);
	const step = Math.min(PROGRESS_LABELS.length - 1, Math.max(0, Math.floor((now - startedAtMs) / 2000)));
	return (
		<div aria-label="Agent is preparing a reply" aria-valuetext={PROGRESS_LABELS[step]} role="progressbar">
			<div aria-hidden="true"><ChainOfThought><ChainOfThoughtHeader showChevron={false} state="thinking">{PROGRESS_LABELS[step]}</ChainOfThoughtHeader></ChainOfThought></div>
		</div>
	);
}

export function ProjectButterAgentReplyAction({ onPublish, reply }: Readonly<{ onPublish: (id: string) => void; reply: JiraActivityReply }>) {
	if (reply.visibility !== "private" || reply.generationStartedAtMs !== undefined) return null;
	return <Button onClick={() => onPublish(reply.id)} size="compact" type="button" variant="outline">Add reply</Button>;
}
