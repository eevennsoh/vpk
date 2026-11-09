"use client";

import { useState, type KeyboardEvent } from "react";

import AddIcon from "@atlaskit/icon/core/add";
import AiChatIcon from "@atlaskit/icon/core/ai-chat";

import { ROVO_AGENT_SELECTOR_AGENTS, type SkillDirectorySkill } from "@/app/data/directory";
import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";
import { useJiraWorkItem } from "@/components/blocks/jira-work-item/experimental/context-jira-work-item";
import { ActivityComposerContextPills } from "@/components/blocks/jira-work-item/experimental/components/activity-composer-context-pills";
import { JiraWorkItemComposerMotion } from "@/components/blocks/jira-work-item/experimental/components/jira-work-item-composer-motion";
import { JIRA_WORK_ITEM_CURRENT_USER } from "@/components/blocks/jira-work-item/experimental/lib/jira-activity-adapter";
import {
	findMentionedWorkingAgentSession,
	findSteeredWorkingSession,
	includesComposerAgentMention,
} from "@/components/blocks/jira-work-item/experimental/lib/activity-composer-session-routing";
import { JiraActivityComposer } from "@/components/blocks/jira-activity";
import {
	RichTextSuggestionMenu,
	type RichTextSuggestionMenuItem,
} from "@/components/ui-custom/rich-text-editor";
import { Tag } from "@/components/ui/tag";

const JIRA_WORK_ITEM_MENTION_LABELS = { subagent: "Agents" } as const;
const JIRA_WORK_ITEM_SUGGESTION_VARIANT = { command: "flat", mention: "flat" } as const;
const SESSION_TARGET_MENU_ITEMS = [
	{
		id: "continue",
		label: "Continue in existing session",
		icon: <AiChatIcon label="" size="small" />,
	},
	{
		id: "new",
		label: "Start a new session",
		icon: <AddIcon label="" size="small" />,
	},
] satisfies readonly RichTextSuggestionMenuItem[];

type SessionTargetChoice = "continue" | "new";

interface SessionTargetSelection {
	sessionId: string;
	choice: SessionTargetChoice;
}

/**
 * Unified comment/command composer. Reuses the Jira Activity prompt surface while
 * configuring its shared editor palette for direct people, team, and agent picks.
 * Mentioning a working session's agent offers a continue/new-session route; a
 * first-time agent mention invokes that agent and adds it to Crew.
 */
export function ActivityComposer() {
	const { state, actions } = useJiraWorkItem();
	const [draft, setDraft] = useState("");
	const [sessionTargetSelection, setSessionTargetSelection] = useState<SessionTargetSelection | null>(null);
	const [selectedSessionTargetIndex, setSelectedSessionTargetIndex] = useState(0);
	const mentionedWorkingAgentSession = findMentionedWorkingAgentSession(state.sessions, draft);
	const hasResolvedSessionTarget = Boolean(
		mentionedWorkingAgentSession
		&& sessionTargetSelection?.sessionId === mentionedWorkingAgentSession.id,
	);
	const showSessionTargetMenu = Boolean(mentionedWorkingAgentSession) && !hasResolvedSessionTarget;
	const startsNewSession = Boolean(
		mentionedWorkingAgentSession
		&& sessionTargetSelection?.sessionId === mentionedWorkingAgentSession.id
		&& sessionTargetSelection.choice === "new",
	);

	const handlePromptChange = (next: string) => {
		setDraft(next);
		const nextMentionedSession = findMentionedWorkingAgentSession(state.sessions, next);
		setSelectedSessionTargetIndex(0);
		setSessionTargetSelection((currentSelection) =>
			nextMentionedSession && currentSelection?.sessionId === nextMentionedSession.id
				? currentSelection
				: null,
		);
	};

	const chooseSessionTarget = (choice: SessionTargetChoice) => {
		if (!mentionedWorkingAgentSession) {
			return;
		}
		setSessionTargetSelection({ sessionId: mentionedWorkingAgentSession.id, choice });
	};

	const handleInvokeAgent = (agent: Pick<AgentSelectorAgent, "id" | "name" | "avatarSrc" | "brandName">) => {
		actions.invokeAgent(agent, "context-pill", `@${agent.name}`);
	};

	const handleInvokeSkill = (skill: SkillDirectorySkill) => {
		actions.launchSession(
			{ id: `skill:${skill.id}`, name: "Rovo" },
			`/${skill.name}`,
			skill.name,
		);
	};

	const handleSubmit = (body: string) => {
		const text = body.trim();
		if (!text) return;
		const mentionedAgentSession = findMentionedWorkingAgentSession(state.sessions, text);
		const shouldStartNewSession = Boolean(
			mentionedAgentSession
			&& sessionTargetSelection?.sessionId === mentionedAgentSession.id
			&& sessionTargetSelection.choice === "new",
		);
		const steeredSession = findSteeredWorkingSession(state.sessions, text);
		if (mentionedAgentSession && shouldStartNewSession) {
			actions.invokeAgent(
				{
					id: mentionedAgentSession.agentId,
					name: mentionedAgentSession.agentName,
					avatarSrc: mentionedAgentSession.agentAvatarSrc,
				},
				"prompt",
				text,
			);
		} else if (steeredSession) {
			actions.replySession(steeredSession.id, text);
		} else {
			const invokedAgent = ROVO_AGENT_SELECTOR_AGENTS.find((agent) => includesComposerAgentMention(text, agent.name));
			if (invokedAgent) {
				actions.invokeAgent(invokedAgent, "prompt", text);
			} else {
				actions.addComment(text);
			}
		}
		setDraft("");
		setSessionTargetSelection(null);
		setSelectedSessionTargetIndex(0);
	};

	const handleKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
		if (!showSessionTargetMenu) {
			return;
		}
		switch (event.key) {
			case "ArrowDown":
				event.preventDefault();
				event.stopPropagation();
				setSelectedSessionTargetIndex((index) => (index + 1) % SESSION_TARGET_MENU_ITEMS.length);
				break;
			case "ArrowUp":
				event.preventDefault();
				event.stopPropagation();
				setSelectedSessionTargetIndex((index) => (index - 1 + SESSION_TARGET_MENU_ITEMS.length) % SESSION_TARGET_MENU_ITEMS.length);
				break;
			case "Enter":
			case "Tab":
				event.preventDefault();
				event.stopPropagation();
				chooseSessionTarget(SESSION_TARGET_MENU_ITEMS[selectedSessionTargetIndex].id === "new" ? "new" : "continue");
				break;
			case "Escape":
				event.preventDefault();
				event.stopPropagation();
				chooseSessionTarget("continue");
				break;
			default:
				break;
		}
	};

	return (
		<div onKeyDownCapture={handleKeyDownCapture}>
			<ActivityComposerContextPills
				onInvokeAgent={handleInvokeAgent}
				onInvokeSkill={handleInvokeSkill}
			/>
			<div className="relative" data-jira-work-item-composer-state="sticky">
				<JiraWorkItemComposerMotion placement="sticky">
					<JiraActivityComposer
						author={JIRA_WORK_ITEM_CURRENT_USER}
						mentionSectionLabels={JIRA_WORK_ITEM_MENTION_LABELS}
						onSubmit={handleSubmit}
						onValueChange={handlePromptChange}
						placeholder="Comment, @mention an agent, or / for skills"
						submitAccessory={startsNewSession ? (
							<Tag
								className="self-center"
								color="gray"
								onRemove={() => chooseSessionTarget("continue")}
								removeButtonLabel="Continue in existing session instead"
								shape="rounded"
							>
								New session
							</Tag>
						) : null}
						suggestionVariant={JIRA_WORK_ITEM_SUGGESTION_VARIANT}
						value={draft}
						variant="comment"
					/>
				</JiraWorkItemComposerMotion>
				{showSessionTargetMenu ? (
					<div
						className="absolute inset-x-0 bottom-full z-20 mb-2"
						data-jira-work-item-session-target-menu
					>
						<RichTextSuggestionMenu
							className="rich-text-command-menu-borderless w-full!"
							emptyLabel=""
							items={SESSION_TARGET_MENU_ITEMS}
							onHover={setSelectedSessionTargetIndex}
							onSelect={(item) => chooseSessionTarget(item.id === "new" ? "new" : "continue")}
							selectedIndex={selectedSessionTargetIndex}
							title="Choose agent session"
						/>
					</div>
				) : null}
			</div>
		</div>
	);
}
