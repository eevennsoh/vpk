"use client";

// oxlint-disable react-doctor/jsx-no-jsx-as-prop -- Menu items use slot props for Atlaskit icons.

import { useCallback, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import ChatPanel, {
	type ChatPanelGreetingProps,
	type ChatSubmitInterceptOutcome,
} from "@/components/projects/sidebar-chat/page";
import { getRovoAgentProfile, ROVO_AGENT_ID } from "@/app/data/directory/agents";
import { DEFAULT_SKILLS } from "@/app/data/directory/skills";
import { addCreatedSkill, useCreatedSkills } from "@/app/data/directory/created-skills-store";
import { mapSkillToMentionItem } from "@/components/blocks/editor-palette/data/mention-sources";
import type { RichTextMentionItem, RichTextMentionSources } from "@/components/ui-custom/rich-text-editor";
import { SkillsDirectoryDialog, type SkillsDirectorySkill } from "@/components/blocks/skills-directory";
import { PromptInputActionMenuItem } from "@/components/ui-custom/prompt-input";
import FolderAddIcon from "@atlaskit/icon-lab/core/folder-add";
import SkillIcon from "@atlaskit/icon-lab/core/skill";
import { SkillCreationTraceCard } from "./components/skill-creation-trace-card";
import { SkillCreationResultCard } from "./components/skill-creation-result-card";
import {
	buildCreateSkillStage1,
	buildCreateSkillStage2,
	deriveSkillFromPrompt,
	hasCreateSkillMention,
	isCreateSkillClarification,
	matchCreatedSkillMention,
	SKILL_CREATION_RESULT_WIDGET_TYPE,
	SKILL_CREATION_TRACE_WIDGET_TYPE,
	type SkillCreationResultPayload,
	type SkillCreationTracePayload,
} from "./lib/create-skill-flow";
import { SKILL_GREETING_SUGGESTIONS } from "./lib/skill-suggestions";

const SKILLS_GREETING: ChatPanelGreetingProps = {
	suggestions: SKILL_GREETING_SUGGESTIONS,
};

/**
 * The default Rovo agent profile. Pinning the greeting to it keeps the Skills
 * triggers visible even when a custom agent is selected in the shared Rovo chat
 * state — otherwise `ChatGreeting`'s custom-agent branch would ignore
 * `greeting.suggestions` and show that agent's starters instead.
 */
const ROVO_GREETING_AGENT = getRovoAgentProfile(ROVO_AGENT_ID);

const CREATE_SKILL_PLACEHOLDER = "Describe what you want";
const STATIC_SKILL_IDS = DEFAULT_SKILLS.map((skill) => skill.id);

interface SkillsPanelProps {
	/** Mirrors `ChatPanel.onClose`; defaults to a no-op for the standalone demo. */
	onClose?: () => void;
}

/**
 * Skills project surface. A thin, fork-free reuse of the Sidebar Chat `ChatPanel`
 * wired to keep skill creation local while normal prompts use the Rovo chat path:
 *
 * 1. **Creating** a skill — when the composer carries the `create-skill` tag, the
 *    deterministic `create-skill-flow` engine animates a chain-of-thought, asks one
 *    round of questions (docked card), then shows a generated-skill result card. The
 *    new skill is registered at runtime so it resolves in the `/` menu, skill-tag
 *    styling, and the config dialog, and the composer is auto-prefilled with its tag.
 * 2. **Chatting** with skills — greeting starters submit through the shared
 *    `ChatPanel` path so they behave like `sidebar-chat`, instead of injecting a
 *    one-off scripted "Skill invoked" response locally.
 *
 * The composer "+" menu also exposes "View all skills" (the directory) and a
 * placeholder "Create space" item.
 */
export default function SkillsPanel({ onClose }: Readonly<SkillsPanelProps>) {
	const createdSkills = useCreatedSkills();
	// Original create-skill prompt, stashed on submit 1 so the answer turn can
	// derive the skill from it (the clarification summary alone lacks it).
	const pendingCreatePromptRef = useRef<string>("");
	const prefillCounterRef = useRef(0);
	// Per-flow identity so answered state is tracked per create-skill flow, not
	// panel-wide (multiple flows can coexist in one transcript).
	const flowCounterRef = useRef(0);
	const pendingFlowIdRef = useRef<string>("");
	const [configSkillId, setConfigSkillId] = useState<string | null>(null);
	const [isSkillsDirectoryOpen, setIsSkillsDirectoryOpen] = useState(false);
	const [prefillRequest, setPrefillRequest] = useState<{ mention?: RichTextMentionItem; text?: string; requestKey: number }>();
	// Flow ids whose question round has been answered. Each awaiting trace flips
	// to "Questions answered" only when its own flow id lands here.
	const [answeredFlowIds, setAnsweredFlowIds] = useState<ReadonlySet<string>>(() => new Set());

	const handleEditSkill = useCallback((skillId: string) => {
		setConfigSkillId(skillId);
	}, []);

	const renderWidget = useCallback(
		(widget: { type: string; data: unknown }): ReactNode => {
			switch (widget.type) {
				case SKILL_CREATION_TRACE_WIDGET_TYPE:
					return (
						<SkillCreationTraceCard
							payload={widget.data as SkillCreationTracePayload}
							answeredFlowIds={answeredFlowIds}
						/>
					);
				case SKILL_CREATION_RESULT_WIDGET_TYPE:
					return (
						<SkillCreationResultCard
							payload={widget.data as SkillCreationResultPayload}
							onEdit={handleEditSkill}
						/>
					);
				case "question-card":
					// Rendered as the docked clarification card by ChatPanel, not inline.
					return null;
				default:
					return undefined;
			}
		},
		[answeredFlowIds, handleEditSkill],
	);

	const getWidgetPosition = useCallback(
		(widgetType: string): "before-content" | "after-content" | undefined => {
			if (widgetType === SKILL_CREATION_RESULT_WIDGET_TYPE) {
				return "after-content";
			}

			if (widgetType === SKILL_CREATION_TRACE_WIDGET_TYPE) {
				return "before-content";
			}
			return undefined;
		},
		[],
	);

	const onInterceptSubmit = useCallback((text: string): ChatSubmitInterceptOutcome => {
		// Submit 1: the composer carries the create-skill tag → start the build flow.
		if (hasCreateSkillMention(text)) {
			pendingCreatePromptRef.current = text;
			flowCounterRef.current += 1;
			pendingFlowIdRef.current = String(flowCounterRef.current);
			const stage = buildCreateSkillStage1(pendingFlowIdRef.current);
			return {
				handled: true,
				getPendingAssistantParts: stage.getPendingAssistantParts,
				assistantPartStages: stage.assistantPartStages,
			};
		}

		// Answer turn: ChatPanel routed the question-card answers back here.
		if (isCreateSkillClarification(text)) {
			const flowId = pendingFlowIdRef.current;
			setAnsweredFlowIds((prev) => {
				const next = new Set(prev);
				if (flowId) {
					next.add(flowId);
				}
				return next;
			});
			const skill = deriveSkillFromPrompt(pendingCreatePromptRef.current || text, text, {
				reservedSkillIds: [...STATIC_SKILL_IDS, ...createdSkills.map((entry) => entry.id)],
			});
			addCreatedSkill(skill);
			const stage = buildCreateSkillStage2(skill, () => {
				prefillCounterRef.current += 1;
				setPrefillRequest({ mention: mapSkillToMentionItem(skill), requestKey: prefillCounterRef.current });
			});
			return {
				handled: true,
				getPendingAssistantParts: stage.getPendingAssistantParts,
				assistantPartStages: stage.assistantPartStages,
			};
		}

		// Invoking a runtime-created skill (e.g. the auto-prefilled `/<name>` tag).
		// Handle it locally so it doesn't fall through to the static keyword matcher
		// and mis-fire a built-in skill (e.g. a name containing "summarize").
		const invokedCreatedSkill = matchCreatedSkillMention(text, createdSkills);
		if (invokedCreatedSkill) {
			return {
				handled: true,
				assistantParts: [
					{
						type: "text",
						text: `Ran **${invokedCreatedSkill.name}** — ${invokedCreatedSkill.description}`,
						state: "done",
					},
				] as ChatSubmitInterceptOutcome["assistantParts"],
			};
		}

		// Otherwise let ChatPanel submit through the normal Rovo chat path.
		return { handled: false };
	}, [createdSkills]);

	const resolveComposerPlaceholder = useCallback(
		(prompt: string): string | undefined =>
			hasCreateSkillMention(prompt) ? CREATE_SKILL_PLACEHOLDER : undefined,
		[],
	);

	const composerMentionSources = useMemo<RichTextMentionSources | undefined>(
		() => (createdSkills.length > 0 ? { skill: createdSkills.map(mapSkillToMentionItem) } : undefined),
		[createdSkills],
	);

	const dialogSkills = useMemo(() => [...DEFAULT_SKILLS, ...createdSkills], [createdSkills]);

	const handleViewAllSkills = useCallback(() => {
		setConfigSkillId(null);
		setIsSkillsDirectoryOpen(true);
	}, []);
	const handleAddDirectorySkills = useCallback(
		(_skillIds: readonly string[], skills: readonly SkillsDirectorySkill[]) => {
			const skill = skills[0];
			if (!skill) {
				return;
			}
			prefillCounterRef.current += 1;
			setPrefillRequest({ mention: mapSkillToMentionItem(skill), requestKey: prefillCounterRef.current });
			setConfigSkillId(null);
			setIsSkillsDirectoryOpen(false);
		},
		[],
	);
	const handleCreateSpace = useCallback(() => {
		setIsSkillsDirectoryOpen(false);
	}, []);
	const addMenuItemsBefore = (
		<>
			<PromptInputActionMenuItem elemBefore={<FolderAddIcon label="" />} onSelect={handleCreateSpace}>
				Create space
			</PromptInputActionMenuItem>
			<PromptInputActionMenuItem elemBefore={<SkillIcon label="" />} onSelect={handleViewAllSkills}>
				View all skills
			</PromptInputActionMenuItem>
		</>
	);

	// One dialog serves both surfaces: the generated-skill config detail (opened
	// from a result card's Edit, which closes on exit) and the "View all skills"
	// browse grid.
	const isDetailOpen = configSkillId !== null;
	const isDialogOpen = isDetailOpen || isSkillsDirectoryOpen;

	return (
		<>
			<ChatPanel
				onClose={onClose ?? (() => {})}
				addMenuItemsBefore={addMenuItemsBefore}
				greeting={SKILLS_GREETING}
				greetingSelectedAgent={ROVO_GREETING_AGENT}
				suppressCustomAgentTabs
				onInterceptSubmit={onInterceptSubmit}
				interceptClarificationAnswers
				renderWidget={renderWidget}
				getWidgetPosition={getWidgetPosition}
				resolveComposerPlaceholder={resolveComposerPlaceholder}
				composerPrefillRequest={prefillRequest}
				composerMentionSources={composerMentionSources}
				autoFocusComposer
			/>
			<SkillsDirectoryDialog
				open={isDialogOpen}
				onOpenChange={(open) => {
					if (!open) {
						setConfigSkillId(null);
						setIsSkillsDirectoryOpen(false);
					}
				}}
				initialDetailSkillId={configSkillId}
				skills={dialogSkills}
				variant="experimental"
				addedSkillIds={configSkillId ? [configSkillId] : []}
				closeOnDetailExit={isDetailOpen}
				onAddSkills={handleAddDirectorySkills}
				selectionExperience="chat-single-add"
			/>
		</>
	);
}
