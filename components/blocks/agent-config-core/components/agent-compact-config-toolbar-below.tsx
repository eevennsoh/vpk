"use client";

import { AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import ChevronUpIcon from "@atlaskit/icon/core/chevron-up";

import { AgentCompactEmptyConfigNav, type AgentConfigToolbarFieldName } from "@/components/blocks/agent-config-core/components/agent-compact-config-nav";
import { AgentFilledConfigSummary } from "@/components/blocks/agent-config-core/components/agent-filled-config-summary";
import type { KnowledgeModeValue, MemoryModeValue, ReasoningModeValue } from "@/components/blocks/agent-config-core/components/agent-reasoning-memory-selectors";
import { getNonEmptyConfigItems, type AgentConfigFormValue, type AgentConfigListFieldName, type AgentConfigReferenceListFieldName, type AgentConfigTextFieldName, type AgentDirectoryKind, type AgentHideableConfigField } from "@/components/blocks/agent-config-core/lib/agent-config-model";
import type { AgentAutomationRule, AgentTriggerValue } from "@/components/blocks/trigger/page";
import { Button } from "@/components/ui/button";

const AGENT_COMPACT_CONFIG_EXPAND_BUTTON_SIZE = 24;
const AGENT_COMPACT_CONFIG_EXPAND_BUTTON_EDGE_GAP = 8;
const AGENT_COMPACT_CONFIG_EXPAND_BUTTON_REVEAL_DISTANCE = 72;

export interface AgentCompactConfigToolbarBelowProps {
	config: AgentConfigFormValue;
	// Forwarded to the expanded summary so subagent chips can match the agent's
	// custom brand color (derived from the avatar family).
	avatarSrc?: string;
	// When false, the footer is permanently expanded: the collapse/expand toggle
	// is hidden (the separator stays) and the compact nav is never shown. Used by
	// single-row surfaces like the skill-directory detail view.
	collapsible?: boolean;
	hiddenConfigFields?: ReadonlySet<AgentHideableConfigField>;
	visibleFieldNames?: ReadonlySet<AgentConfigToolbarFieldName>;
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

export function AgentCompactConfigToolbarBelow({
	config,
	avatarSrc,
	collapsible = true,
	hiddenConfigFields,
	visibleFieldNames,
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
}: Readonly<AgentCompactConfigToolbarBelowProps>) {
	const [expanded, setExpanded] = useState(true);
	// Mode selectors are controlled from the persisted config when present (so a
	// generated or published agent shows its saved modes) and fall back to local
	// state otherwise (standalone demo, or before the first edit). Changes persist
	// through onTextChange — the same draft→publish channel as the text fields —
	// and also update the local fallback so the collapsed nav button and expanded
	// row stay in sync as the toolbar toggles between the two views.
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
	const shouldReduceMotion = useReducedMotion();
	const expandButtonRowRef = useRef<HTMLDivElement | null>(null);
	const expandButtonX = useMotionValue(0);
	const expandButtonPaddingRight = useTransform(expandButtonX, (latest): number =>
		Math.abs(latest) > 0.5 ? AGENT_COMPACT_CONFIG_EXPAND_BUTTON_EDGE_GAP : 0,
	);
	const expandButtonVisualX = useTransform(expandButtonX, (latest): number =>
		latest + (Math.abs(latest) > 0.5 ? AGENT_COMPACT_CONFIG_EXPAND_BUTTON_EDGE_GAP : 0),
	);
	// Non-collapsible callers stay locked open; the toggle and its compact-nav
	// branch never render, so `expanded` state is ignored entirely.
	const isExpanded = collapsible ? expanded : true;
	const transition = shouldReduceMotion ? { duration: 0 } : { duration: 0.2, ease: "easeOut" as const };

	useEffect(() => {
		if (!collapsible) {
			return;
		}

		const handlePointerMove = (event: PointerEvent) => {
			const row = expandButtonRowRef.current;

			if (!row) {
				return;
			}

			const rect = row.getBoundingClientRect();
			const pointerDistanceFromBottom = rect.bottom - event.clientY;
			const isNearBottom = pointerDistanceFromBottom >= -AGENT_COMPACT_CONFIG_EXPAND_BUTTON_SIZE
				&& pointerDistanceFromBottom <= AGENT_COMPACT_CONFIG_EXPAND_BUTTON_REVEAL_DISTANCE;

			if (!isNearBottom) {
				expandButtonX.set(0);
				return;
			}

			const restingCenterX = rect.right - AGENT_COMPACT_CONFIG_EXPAND_BUTTON_SIZE / 2;
			const minCenterX = rect.left + AGENT_COMPACT_CONFIG_EXPAND_BUTTON_SIZE / 2;
			const maxCenterX = rect.right - AGENT_COMPACT_CONFIG_EXPAND_BUTTON_SIZE / 2;
			const targetCenterX = Math.min(Math.max(event.clientX, minCenterX), maxCenterX);

			expandButtonX.set(targetCenterX - restingCenterX);
		};
		const handlePointerLeave = () => {
			expandButtonX.set(0);
		};

		window.addEventListener("pointermove", handlePointerMove, true);
		window.addEventListener("pointerleave", handlePointerLeave);

		return () => {
			window.removeEventListener("pointermove", handlePointerMove, true);
			window.removeEventListener("pointerleave", handlePointerLeave);
		};
	}, [collapsible, expandButtonX]);

	return (
		<div className="flex flex-col">
			<div className="relative flex h-6 items-center" ref={expandButtonRowRef}>
				<div aria-hidden className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
				{collapsible ? (
					<motion.div
						className="relative z-10 ml-auto bg-surface pl-2"
						style={{ paddingRight: expandButtonPaddingRight, x: expandButtonVisualX }}
					>
						<Button
							aria-label={isExpanded ? "Collapse configuration" : "Expand configuration"}
							className="size-6 rounded border-border bg-surface-overlay px-0 text-icon-subtle hover:bg-surface-overlay-hovered active:bg-surface-overlay-pressed"
							onClick={() => setExpanded((prev) => !prev)}
							size="icon-compact"
							type="button"
							variant="ghost"
						>
							{isExpanded ? (
								<ChevronDownIcon label="" size="small" />
							) : (
								<ChevronUpIcon label="" size="small" />
							)}
						</Button>
					</motion.div>
				) : null}
			</div>
			<AnimatePresence initial={false} mode="wait">
				{isExpanded ? (
					<motion.div
						key="expanded"
						// No `overflow-hidden`: the crossfade only animates opacity, so
						// clipping isn't needed — and it would square off each row's
						// `rounded-md` hover highlight, whose `-mx-2` bleed sits exactly at
						// the clip edge.
						className="bg-surface pt-2"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={transition}
						style={{ willChange: "opacity" }}
					>
						<AgentFilledConfigSummary
							config={config}
							avatarSrc={avatarSrc}
							hiddenConfigFields={hiddenConfigFields}
							visibleFieldNames={visibleFieldNames}
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
					</motion.div>
				) : (
					<motion.div
						key="collapsed"
						className="overflow-hidden bg-surface pt-2"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={transition}
						style={{ willChange: "opacity" }}
					>
						<AgentCompactEmptyConfigNav
							avatarSrc={avatarSrc}
							config={config}
							hiddenConfigFields={hiddenConfigFields}
							visibleFieldNames={visibleFieldNames}
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
				)}
			</AnimatePresence>
		</div>
	);
}
