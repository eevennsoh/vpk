"use client";

import {
	isValidElement,
	useLayoutEffect,
	useMemo,
	useState,
	type CSSProperties,
	type FocusEvent,
	type PointerEvent,
	type ReactElement,
} from "react";

import type { SkillsDirectorySkill } from "@/app/data/directory";
import { ROVO_AGENT_SELECTOR_AGENTS } from "@/app/data/directory/agents";
import { AgentSelector, type AgentSelectorAgent } from "@/components/blocks/agent-selector";
import { EDITOR_PALETTE_MENTION_SOURCES } from "@/components/blocks/editor-palette/data/mention-sources";
import {
	DEFAULT_PINNED_SPACE_AGENT_IDS,
	DEFAULT_PINNED_WORK_ITEM_SKILL_IDS,
	WORK_ITEM_PINNED_ITEMS_LABEL,
	WORK_ITEM_SKILLS,
} from "@/components/blocks/jira-work-item/lib/work-item-picker-options";
import { SkillSelector } from "@/components/blocks/skill-selector";
import {
	RovoSparkle,
	RovoSparkleButton,
	type RovoSparkleActionKind,
	type RovoSparkleActionRequest,
	type RovoSparkleItem,
	type RovoSparkleSelectedItem,
} from "@/components/ui-custom/rovo-sparkle";
import { getMentionChildItems } from "@/components/ui-custom/rich-text-editor";
import { DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "@/components/ui/dropdown-menu";

export type JiraIssueGenerativeActionKind = RovoSparkleActionKind;

export interface JiraIssueGenerativeActionIssue {
	issueKey: string;
	summary: string;
}

export type JiraIssueGenerativeActionSelectedItem = RovoSparkleSelectedItem;

export interface JiraIssueGenerativeActionRequest {
	kind: JiraIssueGenerativeActionKind;
	prompt: string;
	issue: JiraIssueGenerativeActionIssue;
	selectedItem?: JiraIssueGenerativeActionSelectedItem;
}

export interface JiraIssueGenerativeActionConfig {
	agents?: readonly RovoSparkleItem[];
	ariaLabel?: string;
	onBrowseAgents?: () => void;
	onBrowseSkills?: () => void;
	onCreateAgent?: () => void;
	onCreateSkill?: () => void;
	onSubmit: (request: JiraIssueGenerativeActionRequest) => void | Promise<void>;
	skills?: readonly RovoSparkleItem[];
}

interface JiraIssueGenerativeActionMenuProps {
	action: JiraIssueGenerativeActionConfig;
	anchor?: HTMLElement | null;
	issue: JiraIssueGenerativeActionIssue;
	onOpenChange?: (open: boolean) => void;
	onTriggerBlur?: () => void;
	onTriggerFocus?: () => void;
	onTriggerPointerEnter?: () => void;
	onTriggerPointerLeave?: () => void;
	revealActive?: boolean;
	triggerElement?: ReactElement;
}

interface JiraIssueAgentAndSkillSubmenusProps {
	action: JiraIssueGenerativeActionConfig;
	issue: JiraIssueGenerativeActionIssue;
	onRequestClose: () => void;
}

interface JiraIssueGenerativeActionPosition {
	bridgeHeight: number;
	left: number;
	top: number;
}

const JIRA_ISSUE_GENERATIVE_SKILLS = getMentionChildItems(EDITOR_PALETTE_MENTION_SOURCES, "skill");
const JIRA_ISSUE_GENERATIVE_AGENTS = getMentionChildItems(EDITOR_PALETTE_MENTION_SOURCES, "subagent");
const JIRA_ISSUE_GENERATIVE_TRIGGER_SIZE = 24;

function buildJiraIssueGenerativeAskRovoPrompt(
	prompt: string,
	issue: JiraIssueGenerativeActionIssue,
): string {
	return `${prompt.trim()}\n\nJira issue ${issue.issueKey}: ${issue.summary}`;
}

function buildJiraIssueGenerativeSkillPrompt(
	item: JiraIssueGenerativeActionSelectedItem,
	issue: JiraIssueGenerativeActionIssue,
): string {
	return `Use the "${item.label}" skill for Jira issue ${issue.issueKey}: ${issue.summary}.`;
}

function buildJiraIssueGenerativeAgentPrompt(
	item: JiraIssueGenerativeActionSelectedItem,
	issue: JiraIssueGenerativeActionIssue,
): string {
	return `Ask "${item.label}" to help with Jira issue ${issue.issueKey}: ${issue.summary}.`;
}

function submitJiraIssueAssignment(
	action: JiraIssueGenerativeActionConfig,
	issue: JiraIssueGenerativeActionIssue,
	kind: "agent" | "skill",
	item: JiraIssueGenerativeActionSelectedItem,
) {
	const prompt = kind === "agent"
		? buildJiraIssueGenerativeAgentPrompt(item, issue)
		: buildJiraIssueGenerativeSkillPrompt(item, issue);
	void action.onSubmit({ kind, prompt, issue, selectedItem: item });
}

function submitJiraIssueGenerativeAction(
	action: JiraIssueGenerativeActionConfig,
	issue: JiraIssueGenerativeActionIssue,
	request: RovoSparkleActionRequest,
) {
	if (request.kind === "ask-rovo") {
		void action.onSubmit({
			kind: request.kind,
			prompt: buildJiraIssueGenerativeAskRovoPrompt(request.prompt, issue),
			issue,
		});
		return;
	}

	submitJiraIssueAssignment(action, issue, request.kind, request.selectedItem);
}

function mapRovoItemToAgent(item: RovoSparkleItem): AgentSelectorAgent {
	return {
		id: item.id,
		name: item.label,
		byline: item.description ?? "Agent",
		avatarSrc: item.visual?.kind === "avatar" || item.visual?.kind === "image"
			? item.visual.src
			: undefined,
		visual: isValidElement(item.leadingVisual) ? item.leadingVisual : undefined,
	};
}

function mapRovoItemToSkill(item: RovoSparkleItem): SkillsDirectorySkill {
	return {
		id: item.id,
		name: item.label,
		description: item.description ?? "",
		icon: "skill",
		source: "platform",
	};
}

function resolvePinnedItemIds(
	items: readonly Readonly<{ id: string }>[],
	defaultIds: readonly string[],
): readonly string[] {
	return defaultIds.flatMap((defaultId) => {
		const item = items.find((candidate) => (
			candidate.id === defaultId || candidate.id.endsWith(`:${defaultId}`)
		));
		return item ? [item.id] : [];
	});
}

export function JiraIssueAgentAndSkillSubmenus({
	action,
	issue,
	onRequestClose,
}: Readonly<JiraIssueAgentAndSkillSubmenusProps>) {
	const agents = useMemo(
		() => action.agents?.map(mapRovoItemToAgent) ?? ROVO_AGENT_SELECTOR_AGENTS,
		[action.agents],
	);
	const skills = useMemo(
		() => action.skills?.map(mapRovoItemToSkill) ?? WORK_ITEM_SKILLS,
		[action.skills],
	);
	const [agentQuery, setAgentQuery] = useState("");
	const [skillQuery, setSkillQuery] = useState("");
	const [pinnedAgentIds, setPinnedAgentIds] = useState<readonly string[]>(() => (
		resolvePinnedItemIds(agents, DEFAULT_PINNED_SPACE_AGENT_IDS)
	));
	const [pinnedSkillIds, setPinnedSkillIds] = useState<readonly string[]>(() => (
		resolvePinnedItemIds(skills, DEFAULT_PINNED_WORK_ITEM_SKILL_IDS)
	));
	const browseAgents = action.onBrowseAgents;
	const browseSkills = action.onBrowseSkills;
	const createAgent = action.onCreateAgent;
	const createSkill = action.onCreateSkill;

	function closeThenRun(callback: () => void) {
		onRequestClose();
		callback();
	}

	function handleAgentToggle(agentId: string) {
		const agent = agents.find((candidate) => candidate.id === agentId);
		if (!agent) {
			return;
		}

		onRequestClose();
		submitJiraIssueAssignment(action, issue, "agent", {
			id: agent.id,
			label: agent.name,
			description: agent.byline,
			avatarSrc: agent.avatarSrc,
		});
	}

	function handleSkillToggle(skillId: string) {
		const skill = skills.find((candidate) => candidate.id === skillId);
		if (!skill) {
			return;
		}

		onRequestClose();
		submitJiraIssueAssignment(action, issue, "skill", {
			id: skill.id,
			label: skill.name,
			description: skill.description,
		});
	}

	return (
		<>
			<DropdownMenuSub onOpenChange={(open) => open ? undefined : setAgentQuery("")}>
				<DropdownMenuSubTrigger>Assign agents</DropdownMenuSubTrigger>
				<DropdownMenuSubContent
					className="max-h-none w-[360px] overflow-hidden p-0"
					onClick={(event) => event.stopPropagation()}
				>
					<AgentSelector
						agents={agents}
						onAgentToggle={handleAgentToggle}
						onBrowseAgents={browseAgents ? () => closeThenRun(browseAgents) : undefined}
						onCreateAgent={createAgent ? () => closeThenRun(createAgent) : undefined}
						onPinnedAgentIdsChange={setPinnedAgentIds}
						onQueryChange={setAgentQuery}
						pinnedAgentIds={pinnedAgentIds}
						pinnedItemsLabel={WORK_ITEM_PINNED_ITEMS_LABEL}
						query={agentQuery}
						searchVariant="palette"
						selectionMode="single"
					/>
				</DropdownMenuSubContent>
			</DropdownMenuSub>
			<DropdownMenuSub onOpenChange={(open) => open ? undefined : setSkillQuery("")}>
				<DropdownMenuSubTrigger>Use skills</DropdownMenuSubTrigger>
				<DropdownMenuSubContent
					className="max-h-none w-[360px] overflow-hidden p-0"
					onClick={(event) => event.stopPropagation()}
				>
					<SkillSelector
						onBrowseSkills={browseSkills ? () => closeThenRun(browseSkills) : undefined}
						onCreateSkill={createSkill ? () => closeThenRun(createSkill) : undefined}
						onPinnedSkillIdsChange={setPinnedSkillIds}
						onQueryChange={setSkillQuery}
						onSkillToggle={handleSkillToggle}
						pinnedItemsLabel={WORK_ITEM_PINNED_ITEMS_LABEL}
						pinnedSkillIds={pinnedSkillIds}
						query={skillQuery}
						searchVariant="palette"
						selectionMode="single"
						skills={skills}
					/>
				</DropdownMenuSubContent>
			</DropdownMenuSub>
		</>
	);
}

function getJiraIssueGenerativeTriggerPosition(anchor: HTMLElement): JiraIssueGenerativeActionPosition {
	const rect = anchor.getBoundingClientRect();
	const issueSurface = anchor.querySelector<HTMLElement>("[data-slot='jira-issue-surface']");
	const top = issueSurface?.getBoundingClientRect().top ?? rect.top;
	return {
		bridgeHeight: Math.max(JIRA_ISSUE_GENERATIVE_TRIGGER_SIZE, rect.bottom - top),
		left: rect.right + 7,
		top,
	};
}

export function JiraIssueGenerativeActionMenu({
	action,
	anchor = null,
	issue,
	onOpenChange,
	onTriggerBlur,
	onTriggerFocus,
	onTriggerPointerEnter,
	onTriggerPointerLeave,
	revealActive = false,
	triggerElement,
}: Readonly<JiraIssueGenerativeActionMenuProps>) {
	const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

	useLayoutEffect(() => {
		setPortalContainer(document.body);
	}, []);
	const [open, setOpen] = useState(false);
	const [triggerPosition, setTriggerPosition] = useState<JiraIssueGenerativeActionPosition | null>(null);
	const hasTriggerElement = Boolean(triggerElement);
	const sparkleVisible = revealActive && !open;

	function handleOpenChange(nextOpen: boolean) {
		setOpen(nextOpen);
		onOpenChange?.(nextOpen);
	}

	useLayoutEffect(() => {
		if (!anchor) {
			return;
		}

		const updateTriggerPosition = () => setTriggerPosition(getJiraIssueGenerativeTriggerPosition(anchor));
		updateTriggerPosition();
		window.addEventListener("resize", updateTriggerPosition);
		window.addEventListener("scroll", updateTriggerPosition, true);
		const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateTriggerPosition);
		resizeObserver?.observe(anchor);

		return () => {
			resizeObserver?.disconnect();
			window.removeEventListener("resize", updateTriggerPosition);
			window.removeEventListener("scroll", updateTriggerPosition, true);
		};
	}, [anchor]);

	useLayoutEffect(() => {
		if (!anchor || (!revealActive && !open)) {
			return;
		}

		let animationFrameId = 0;
		const trackTriggerPosition = () => {
			setTriggerPosition((currentPosition) => {
				const nextPosition = getJiraIssueGenerativeTriggerPosition(anchor);
				return currentPosition?.bridgeHeight === nextPosition.bridgeHeight
					&& currentPosition.left === nextPosition.left
					&& currentPosition.top === nextPosition.top
					? currentPosition
					: nextPosition;
			});
			animationFrameId = window.requestAnimationFrame(trackTriggerPosition);
		};

		trackTriggerPosition();
		return () => window.cancelAnimationFrame(animationFrameId);
	}, [anchor, open, revealActive]);

	function handleRovoSparkleSubmit(request: RovoSparkleActionRequest) {
		submitJiraIssueGenerativeAction(action, issue, request);
	}

	const generatedTrigger = triggerPosition ? (
		<RovoSparkleButton
			active={open}
			aria-label={action.ariaLabel ?? "Open Jira issue generative actions"}
			className="fixed z-[150] overflow-visible before:pointer-events-auto before:absolute before:-left-2 before:top-0 before:h-[var(--jira-issue-generative-bridge-height)] before:w-2 before:content-[''] [&>span]:rounded-[inherit]"
			hideWhenSelected
			onBlur={onTriggerBlur}
			onClick={(event) => event.stopPropagation()}
			onFocus={onTriggerFocus}
			onPointerDown={(event) => event.stopPropagation()}
			onPointerEnter={onTriggerPointerEnter}
			onPointerLeave={onTriggerPointerLeave}
			size="compact"
			style={{
				"--jira-issue-generative-bridge-height": `${triggerPosition.bridgeHeight}px`,
				left: triggerPosition.left,
				pointerEvents: open ? "none" : undefined,
				top: triggerPosition.top,
			} as CSSProperties}
			visible={sparkleVisible}
		/>
	) : null;
	const resolvedTrigger = triggerElement ?? generatedTrigger;

	if (!resolvedTrigger) {
		return null;
	}

	return (
		<RovoSparkle
			agents={action.agents ?? JIRA_ISSUE_GENERATIVE_AGENTS}
			ariaLabel={action.ariaLabel ?? "Open Jira issue generative actions"}
			emptyLabel="No Jira issue actions found"
			menuTitle="Jira issue actions"
			onOpenChange={handleOpenChange}
			onSubmit={handleRovoSparkleSubmit}
			open={open}
			popoverTitle="Jira issue generative actions"
			side="right"
			sideOffset={hasTriggerElement ? 4 : -24}
			size="compact"
			skills={action.skills ?? JIRA_ISSUE_GENERATIVE_SKILLS}
			triggerElement={resolvedTrigger}
			triggerPortalContainer={hasTriggerElement ? null : portalContainer}
		/>
	);
}

/** Keep the issue surface reveal state and its pointer/focus lifecycle together. */
export function useJiraIssueGenerativeActionReveal() {
	const [generativeActionPointerActive, setGenerativeActionPointerActive] = useState(false);
	const [generativeActionFocusActive, setGenerativeActionFocusActive] = useState(false);
	const [generativeActionRevealSuppressed, setGenerativeActionRevealSuppressed] = useState(false);
	function handleGenerativeActionPointerOver(event: PointerEvent<HTMLElement>) {
		if (
			event.target instanceof Element
			&& event.target.closest("[data-slot='jira-issue-agent-row'], [data-slot='jira-issue-session-transfer']")
		) {
			setGenerativeActionRevealSuppressed(true);
			setGenerativeActionPointerActive(false);
			return;
		}

		if (event.currentTarget.contains(event.target as Node)) {
			setGenerativeActionRevealSuppressed(false);
			setGenerativeActionPointerActive(true);
		}
	}

	function handleGenerativeActionPointerOut(event: PointerEvent<HTMLElement>) {
		if (!event.currentTarget.contains(event.target as Node)) {
			return;
		}

		const nextTarget = event.relatedTarget as Node | null;
		if (event.currentTarget.contains(nextTarget)) {
			return;
		}

		setGenerativeActionPointerActive(false);
	}

	function handleGenerativeActionFocusCapture(event: FocusEvent<HTMLElement>) {
		if (
			event.target instanceof Element
			&& event.currentTarget.contains(event.target)
		) {
			setGenerativeActionRevealSuppressed(false);
			setGenerativeActionFocusActive(event.target.matches(":focus-visible"));
		}
	}

	function handleGenerativeActionBlurCapture(event: FocusEvent<HTMLElement>) {
		if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) {
			return;
		}

		const nextTarget = event.relatedTarget as Node | null;
		if (event.currentTarget.contains(nextTarget)) {
			return;
		}

		setGenerativeActionFocusActive(false);
	}

	return {
		generativeActionPointerActive, generativeActionFocusActive, generativeActionRevealSuppressed,
		setGenerativeActionRevealSuppressed, handleGenerativeActionPointerOver, handleGenerativeActionPointerOut,
		handleGenerativeActionFocusCapture, handleGenerativeActionBlurCapture,
	};
}
