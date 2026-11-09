"use client";

import { useCallback, useState } from "react";
import AddIcon from "@atlaskit/icon/core/add";

import { AgentCardHeader } from "@/components/blocks/agent-card";
import { QuestionCard } from "@/components/blocks/question-card/components/question-card";
import type {
	QuestionCardAnswers,
	QuestionCardQuestion,
} from "@/components/blocks/question-card/types";
import { FloatingComposer } from "@/components/projects/shared/components/floating-composer";
import { RovoComposerActionButton } from "@/components/projects/shared/components/rovo-composer-send-controls";
import { floatingComposerTextareaClassName } from "@/components/projects/shared/components/rovo-composer-styles";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import {
	PromptInputButton,
	PromptInputTextarea,
} from "@/components/ui-custom/prompt-input";
import { Button } from "@/components/ui/button";
import type { ThirdPartyLogoName } from "@/components/ui/data/logo-third-party-data";
import { ElapsedTime, RelativeTime } from "@/components/ui/elapsed-time";
import { cn } from "@/lib/utils";

export type AgentStateState = "working" | "awaiting-input" | "completed";

export interface AgentStateAgent {
	id: string;
	name: string;
	avatarSrc?: string;
	brandName?: ThirdPartyLogoName;
}

export interface AgentStateProps {
	agent: AgentStateAgent;
	className?: string;
	completedAtMs?: number;
	completedSecondsAgo?: number;
	composer?: "visible" | "hidden";
	initialElapsedSeconds?: number;
	message?: string;
	onQuestionSubmit?: (answers: QuestionCardAnswers) => void;
	onSubmit?: (prompt: string) => void;
	onView?: () => void;
	question?: QuestionCardQuestion;
	startedAtMs?: number;
	state: AgentStateState;
}

const DEFAULT_MESSAGES: Record<AgentStateState, string> = {
	working:
		"On it. I am reviewing the connected work and will add the next update inside this work item.",
	"awaiting-input":
		"I found a decision point that needs your input before I can continue with the implementation notes.",
	completed:
		"I finished the requested work and added the completed update inside this work item.",
};

const DEFAULT_INITIAL_ELAPSED_SECONDS = 45;
// Agent State previews dictation chrome without starting a media session.
const startPreviewDictation = () => undefined;

function getAgentInitial(name: string): string {
	return name.trim()[0]?.toUpperCase() ?? "A";
}

export function AgentStateComposer({
	className,
	onSubmit,
}: Readonly<{
	className?: string;
	onSubmit?: (prompt: string) => void;
}>) {
	const [reply, setReply] = useState("");
	const canSubmit = Boolean(onSubmit && reply.trim());

	const handleSubmit = useCallback(() => {
		const prompt = reply.trim();
		if (!prompt || !onSubmit) return;
		onSubmit(prompt);
		setReply("");
	}, [onSubmit, reply]);

	return (
		<FloatingComposer
			actions={
				<RovoComposerActionButton
					canSubmit={canSubmit}
					composerStatus="ready"
					onStartDictation={startPreviewDictation}
					onStop={() => undefined}
					showSubmitWhenEmpty
					size="icon-xs"
					submitDisabled={onSubmit === undefined}
				/>
			}
			addButton={
				<PromptInputButton aria-label="Add" size="icon-xs" variant="ghost">
					<AddIcon label="" size="small" />
				</PromptInputButton>
			}
			allowOverflow
			aria-label="Reply to agent"
			className={className}
			onSubmit={handleSubmit}
		>
			<PromptInputTextarea
				aria-label="Reply to agent"
				className={cn(floatingComposerTextareaClassName, "text-sm leading-5")}
				enableDirectoryAutocomplete
				onChange={(event) => setReply(event.currentTarget.value)}
				placeholder="Ask, @mention, or / for actions"
				rows={1}
				value={reply}
			/>
		</FloatingComposer>
	);
}

function renderAgentStateFooter({
	composer,
	onQuestionSubmit,
	onSubmit,
	question,
	state,
}: Readonly<{
	composer: "visible" | "hidden";
	onQuestionSubmit?: (answers: QuestionCardAnswers) => void;
	onSubmit?: (prompt: string) => void;
	question?: QuestionCardQuestion;
	state: AgentStateState;
}>) {
	if (state === "awaiting-input" && question) {
		return (
			<QuestionCard
				className="shadow-none"
				onSubmit={(answers) => onQuestionSubmit?.(answers)}
				questions={[question]}
			/>
		);
	}

	switch (composer) {
		case "hidden":
			return null;
		case "visible":
			return <AgentStateComposer onSubmit={onSubmit} />;
		default: {
			const _exhaustive: never = composer;
			return _exhaustive;
		}
	}
}

export function AgentState({
	agent,
	className,
	completedAtMs,
	completedSecondsAgo,
	composer = "visible",
	initialElapsedSeconds = DEFAULT_INITIAL_ELAPSED_SECONDS,
	message,
	onQuestionSubmit,
	onSubmit,
	onView,
	question,
	startedAtMs,
	state,
}: Readonly<AgentStateProps>) {
	const [seededStartedAtMs] = useState(
		() => Date.now() - Math.max(0, initialElapsedSeconds) * 1000,
	);
	const resolvedStartedAtMs = startedAtMs ?? seededStartedAtMs;
	const isRovoAgent = agent.name === "Rovo";

	return (
		<div
			className={cn(
				"flex w-[400px] max-w-[calc(100vw-48px)] flex-col gap-3 rounded-xl bg-surface-overlay p-3 text-text shadow-2xl",
				className,
			)}
			data-slot="agent-state"
		>
			<AgentCardHeader
				action={
					onView ? (
						<Button onClick={onView} size="compact" type="button" variant="outline">
							View
						</Button>
					) : null
				}
				byline={
					state === "completed" ? (
						<RelativeTime
							className="text-xs leading-4 text-text-subtle"
							fallback="Just now"
							secondsAgo={completedSecondsAgo}
							timestampMs={completedAtMs}
						/>
					) : (
						<ElapsedTime
							className="text-xs leading-4 text-text-subtle"
							startedAtMs={resolvedStartedAtMs}
						/>
					)
				}
				leading={
					<AgentAvatarVisual
						avatarClassName={isRovoAgent ? "[&>svg]:hidden" : undefined}
						avatarSrc={agent.avatarSrc}
						brandName={agent.brandName}
						fallbackText={getAgentInitial(agent.name)}
						label={agent.name}
						sizePx={32}
					/>
				}
				title={agent.name}
			/>
			<p className="text-sm leading-5 text-text">
				{message ?? DEFAULT_MESSAGES[state]}
			</p>
			{renderAgentStateFooter({
				composer,
				onQuestionSubmit,
				onSubmit,
				question,
				state,
			})}
		</div>
	);
}

export default AgentState;
