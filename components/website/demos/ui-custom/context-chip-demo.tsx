"use client";

import { useState, type ReactNode } from "react";
import ReplyLeftIcon from "@atlaskit/icon-lab/core/reply-left";
import { ContextChip } from "@/components/ui-custom/context-chip";
import { CommentsComposerChip } from "@/components/ui-custom/comments-composer-chip";
import { FailingChecksComposerChip } from "@/components/ui-custom/failing-checks-composer-chip";
import { Button } from "@/components/ui/button";

const COMMENTS = [
	{ id: "comment-1", title: "Annie Cook", subtitle: "Onboarding flow", body: "Can we clarify the first step for new users?" },
	{ id: "comment-2", title: "Marcus Kim", subtitle: "Progress indicator", body: "Please check the progress indicator on mobile." },
];

function ResettableChip({ children }: Readonly<{ children: (remove: () => void) => ReactNode }>) {
	const [visible, setVisible] = useState(true);
	return visible ? children(() => setVisible(false)) : <Button onClick={() => setVisible(true)} size="compact" type="button" variant="outline">Restore context</Button>;
}

export function ContextChipDemoReply() {
	return <ResettableChip>{(remove) => <ContextChip countLabel="Replying to Summarize onboarding feedback" icon={<ReplyLeftIcon color="currentColor" label="" size="small" />} items={[{ id: "session-1", title: "Summarize onboarding feedback", subtitle: "Claude", body: "Replying in this activity thread" }]} onRemoveAll={remove} removeAllLabel="Remove reply target" testId="context-chip-reply" />}</ResettableChip>;
}

export function ContextChipDemoComments() {
	return <ResettableChip>{(remove) => <CommentsComposerChip comments={COMMENTS} onRemoveAll={remove} />}</ResettableChip>;
}

export function ContextChipDemoChecks() {
	return <ResettableChip>{(remove) => <FailingChecksComposerChip checks={[{ id: "test", name: "Unit tests", details: "One test failed in the onboarding flow." }, { id: "lint", name: "Lint", details: "A formatting check needs attention." }]} onRemoveAll={remove} />}</ResettableChip>;
}

export default function ContextChipDemo() {
	return <ContextChipDemoReply />;
}
