"use client";

import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { AgentAutomationRule, AgentTriggerValue } from "@/components/blocks/triggers/page";
import { AgentCompactEmptyConfigNav } from "@/components/blocks/agent/components/agent-compact-config-nav";
import { AgentFilledConfigSummary } from "@/components/blocks/agent/components/agent-filled-config-summary";
import type { KnowledgeModeValue, MemoryModeValue, ReasoningModeValue } from "@/components/blocks/agent/components/agent-reasoning-memory-selectors";
import {
	getAgentAutomationItems,
	getNonEmptyConfigItems,
	getSkillConfigItems,
	type AgentConfigFormValue,
	type AgentConfigListFieldName,
	type AgentConfigReferenceListFieldName,
	type AgentConfigTextFieldName,
	type AgentDirectoryKind,
	type AgentHideableConfigField,
} from "@/components/blocks/agent/lib/agent-config-model";
import { cn } from "@/lib/utils";
import { motionEase } from "@/lib/motion";

export interface AgentCompactConfigPanelProps {
	config: AgentConfigFormValue;
	// Forwarded to the expanded summary so subagent chips can match the agent's
	// custom brand color (derived from the avatar family).
	avatarSrc?: string;
	hiddenConfigFields?: ReadonlySet<AgentHideableConfigField>;
	onAddListValues?: (field: AgentConfigReferenceListFieldName, values: readonly string[]) => void;
	onAppendListItem?: (field: AgentConfigListFieldName) => void;
	onConnectTrigger?: (trigger: AgentTriggerValue) => void;
	onEditTriggers?: (seed?: AgentAutomationRule) => void;
	onManageTriggers?: () => void;
	onListItemChange?: (field: AgentConfigListFieldName, index: number, value: string) => void;
	onManageSubagents?: () => void;
	onOpenDirectory?: (directory: AgentDirectoryKind, selectedItem?: string) => void;
	onRemoveListItem?: (field: AgentConfigListFieldName, index: number) => void;
	onSelectListItem?: (field: AgentConfigListFieldName, index: number) => void;
	onTextChange?: (field: AgentConfigTextFieldName, value: string) => void;
	onToggleListItem?: (field: AgentConfigListFieldName, index: number, enabled: boolean) => void;
	onAutomationRulesChange?: (automationRules: readonly AgentAutomationRule[]) => void;
	screenAssistantTargetPrefix?: string;
	selectedListItemIndexByField?: Partial<Record<AgentConfigListFieldName, number>>;
}

export function AgentCompactConfigPanel({
	config,
	avatarSrc,
	hiddenConfigFields,
	onAddListValues,
	onAppendListItem,
	onConnectTrigger,
	onEditTriggers,
	onManageTriggers,
	onListItemChange,
	onManageSubagents,
	onOpenDirectory,
	onRemoveListItem,
	onSelectListItem,
	onTextChange,
	onToggleListItem,
	onAutomationRulesChange,
	screenAssistantTargetPrefix,
	selectedListItemIndexByField,
}: Readonly<AgentCompactConfigPanelProps>) {
	// Mode selectors are controlled from the persisted config when present (so a
	// generated or published agent shows its saved modes) and fall back to local
	// state otherwise (standalone demo, or before the first edit). Changes persist
	// through onTextChange — the same draft→publish channel as the text fields —
	// and also update the local fallback so the chip strip reflects the selection.
	const [reasoningFallback, setReasoningFallback] = useState<ReasoningModeValue | null>(null);
	const [knowledgeFallback, setKnowledgeFallback] = useState<KnowledgeModeValue | null>(null);
	const [memoryFallback, setMemoryFallback] = useState<MemoryModeValue | null>(null);
	const reasoningValue =
		(config.reasoningMode as ReasoningModeValue | undefined) ?? reasoningFallback ?? "quick-auto";
	const knowledgeMode =
		(config.knowledgeMode as KnowledgeModeValue | undefined)
		?? knowledgeFallback
		?? (getNonEmptyConfigItems(config.knowledge).length > 0 ? "custom" : "all");
	const memoryMode = (config.memoryMode as MemoryModeValue | undefined) ?? memoryFallback ?? "on";
	const setReasoningValue = useCallback(
		(next: ReasoningModeValue) => {
			setReasoningFallback(next);
			onTextChange?.("reasoningMode", next);
		},
		[onTextChange],
	);
	const setKnowledgeMode = useCallback(
		(next: KnowledgeModeValue) => {
			setKnowledgeFallback(next);
			onTextChange?.("knowledgeMode", next);
		},
		[onTextChange],
	);
	const setMemoryMode = useCallback(
		(next: MemoryModeValue) => {
			setMemoryFallback(next);
			onTextChange?.("memoryMode", next);
		},
		[onTextChange],
	);

	// A list-type is "promoted" to a summary row once it holds at least one item
	// (and isn't suppressed via hiddenConfigFields). Promoted types are hidden from
	// the chip strip below; every other type — plus the always-on Memory and
	// Reasoning selectors and Conversation starters — stays a chip.
	const promotedFields = new Set<string>();
	if (getAgentAutomationItems(config).length > 0 && !hiddenConfigFields?.has("trigger")) {
		promotedFields.add("trigger");
	}
	if (getNonEmptyConfigItems(config.apps).length > 0) {
		promotedFields.add("apps");
	}
	if (getSkillConfigItems(config.skills).length > 0) {
		promotedFields.add("skills");
	}
	if (getNonEmptyConfigItems(config.subagents).length > 0 && !hiddenConfigFields?.has("subagents")) {
		promotedFields.add("subagents");
	}
	const hasRows = promotedFields.size > 0;
	// Conversation starters always lives in the chip strip (never a summary row),
	// so suppress its row in the summary while leaving it visible in the chips.
	const summaryHiddenConfigFields = new Set<AgentHideableConfigField>(hiddenConfigFields);
	summaryHiddenConfigFields.add("conversationStarters");

	// The secondary selector strip (divider + nav) is revealed on hover/focus so the
	// resting card shows only the configured summary rows. We only gate it when there
	// are summary rows to anchor the card — with no promoted rows the strip is the
	// card's sole content, so it must stay visible. Pointer drives hover; focus-within
	// (onFocusCapture/onBlurCapture) keeps the controls keyboard-reachable while hidden.
	const reduceMotion = useReducedMotion();
	const [stripHovered, setStripHovered] = useState(false);
	const [stripFocused, setStripFocused] = useState(false);
	// Touch devices have no persistent hover, so a hover-gated strip would strand the
	// secondary controls with no tappable entry point. Keep it visible when the device
	// lacks hover capability. Defaults to true (desktop) for SSR; corrected on mount.
	const [canHover, setCanHover] = useState(true);
	useEffect(() => {
		const mql = window.matchMedia("(hover: hover)");
		const onChange = () => setCanHover(mql.matches);
		onChange();
		mql.addEventListener("change", onChange);
		return () => mql.removeEventListener("change", onChange);
	}, []);
	// A menu opened from a strip control (e.g. the Memory/Reasoning dropdowns)
	// renders its popup in a portal *outside* this card, so moving the pointer
	// toward it fires `onPointerLeave` and collapses the strip out from under the
	// open menu. While any menu is open its trigger button — which stays inside
	// the card — carries `aria-expanded="true"`, so we observe that attribute on
	// the card subtree and latch the strip open until the menu closes. This spans
	// both the summary-row edit menus and the chip-strip menus without threading
	// an open-state callback through every nav button.
	const cardRef = useRef<HTMLDivElement | null>(null);
	const [stripMenuOpen, setStripMenuOpen] = useState(false);
	useEffect(() => {
		const card = cardRef.current;
		if (!card) {
			return;
		}
		const update = () => setStripMenuOpen(card.querySelector('[aria-expanded="true"]') !== null);
		const observer = new MutationObserver(update);
		observer.observe(card, { subtree: true, attributes: true, attributeFilter: ["aria-expanded"] });
		update();
		return () => observer.disconnect();
	}, []);
	const stripRevealed = !hasRows || !canHover || stripHovered || stripFocused || stripMenuOpen;

	return (
		<div
			ref={cardRef}
			className={cn(
				"mb-2 flex flex-col rounded-2xl border border-border px-4 pt-2",
				stripRevealed ? "pb-2" : "pb-0",
			)}
			onPointerEnter={() => setStripHovered(true)}
			onPointerLeave={() => setStripHovered(false)}
			onFocusCapture={(event) => {
				// Only keyboard focus should latch the strip open (its sole purpose is
				// keeping the hidden controls Tab-reachable). A mouse *click* on a strip
				// control also focuses it; without the `:focus-visible` gate that focus
				// would keep `stripFocused` true after the pointer leaves, stranding the
				// card in its expanded state until the next click elsewhere.
				const target = event.target;
				if (target instanceof Element && target.matches(":focus-visible")) {
					setStripFocused(true);
				}
			}}
			onBlurCapture={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
					setStripFocused(false);
				}
			}}
		>
			{hasRows ? (
				<AgentFilledConfigSummary
					config={config}
					avatarSrc={avatarSrc}
					hiddenConfigFields={summaryHiddenConfigFields}
					hideEmptyRows
					hideModeRows
					knowledgeMode={knowledgeMode}
					onKnowledgeModeChange={setKnowledgeMode}
					memoryMode={memoryMode}
					onMemoryModeChange={setMemoryMode}
					onAddListValues={onAddListValues}
					onAppendListItem={onAppendListItem}
					onConnectTrigger={onConnectTrigger}
					onEditTriggers={onEditTriggers}
					onListItemChange={onListItemChange}
					onManageSubagents={onManageSubagents}
					onManageTriggers={onManageTriggers}
					onOpenDirectory={onOpenDirectory}
					onReasoningModeChange={setReasoningValue}
					onRemoveListItem={onRemoveListItem}
					onSelectListItem={onSelectListItem}
					onTextChange={onTextChange}
					onToggleListItem={onToggleListItem}
					onAutomationRulesChange={onAutomationRulesChange}
					reasoningMode={reasoningValue}
					screenAssistantTargetPrefix={screenAssistantTargetPrefix}
					selectedListItemIndexByField={selectedListItemIndexByField}
				/>
			) : null}
			<motion.div
				// Reveal-on-hover collapsible: animate height 0 → auto + fade so the card
				// grows to surface the secondary selectors (matches the Figma two-state
				// spec). Kept mounted (not unmounted) so the controls stay in tab order;
				// `pt-2`/divider live inside the animated region so the parent doesn't keep
				// a residual gap while collapsed (flex `gap` wouldn't transition away).
				initial={false}
				animate={{ opacity: stripRevealed ? 1 : 0 }}
				layout
				transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: motionEase.outPractical }}
				// `overflow: hidden` drives the height-collapse animation, but it clips
				// BOTH axes — and `overflow-x: visible` can't pair with `overflow-y:
				// hidden` (it computes to `auto`, which still clips). The strip inside
				// uses `-ml-4` to left-align its first item's text with the summary-row
				// labels, so without room that first button's rounded/hover/focus-ring
				// edge gets sheared here. `-mx-4 px-4` pushes this clip box out to the
				// card's padding edge while keeping the content in place, so the bleed
				// has room. Card padding is `px-4`, so this nets to the card border.
				style={{ height: stripRevealed ? "auto" : 0, overflow: "hidden", willChange: "opacity, transform" }}
				className={hasRows ? "-mx-4 flex flex-col gap-2 px-4 pt-2" : "-mx-4 flex flex-col gap-2 px-4"}
			>
				{hasRows ? <div aria-hidden className="h-px bg-border" /> : null}
				<AgentCompactEmptyConfigNav
					avatarSrc={avatarSrc}
					config={config}
					hiddenConfigFields={hiddenConfigFields}
					hiddenFieldNames={promotedFields}
					onAddListValues={onAddListValues}
					onAppendListItem={onAppendListItem}
					onEditTriggers={onEditTriggers}
					onManageTriggers={onManageTriggers}
					onListItemChange={onListItemChange}
					onManageSubagents={onManageSubagents}
					onOpenDirectory={onOpenDirectory}
					onRemoveListItem={onRemoveListItem}
					onSelectListItem={onSelectListItem}
					onToggleListItem={onToggleListItem}
					onAutomationRulesChange={onAutomationRulesChange}
					reasoningValue={reasoningValue}
					onReasoningValueChange={setReasoningValue}
					knowledgeMode={knowledgeMode}
					onKnowledgeModeChange={setKnowledgeMode}
					memoryMode={memoryMode}
					onMemoryModeChange={setMemoryMode}
					screenAssistantTargetPrefix={screenAssistantTargetPrefix}
					selectedListItemIndexByField={selectedListItemIndexByField}
				/>
			</motion.div>
		</div>
	);
}
