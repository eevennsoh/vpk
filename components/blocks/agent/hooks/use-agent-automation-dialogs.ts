import { useCallback, useEffect, useMemo, useState } from "react";

import {
	createAgentAutomationRule,
	type AgentAutomationRule,
	type AgentTriggerProviderId,
} from "@/components/blocks/trigger/data/trigger-catalog";
import {
	createAutomationRuleFromEvent,
	getAgentAutomationRules,
	getNextAutomationRuleIndex,
	type AgentConfigFormValue,
} from "@/components/blocks/agent/lib/agent-config-model";

export interface AgentAutomationEditorState {
	open: boolean;
	fromManage: boolean;
	seed: AgentAutomationRule;
	title: string;
}

export interface UseAgentAutomationDialogsOptions {
	config: AgentConfigFormValue;
	onAutomationRulesChange?: (automationRules: readonly AgentAutomationRule[]) => void;
	onManageTriggers?: () => void;
	registerAutomationDialogOpener?: (opener: (() => void) | null) => void;
}

export function useAgentAutomationDialogs({
	config,
	onAutomationRulesChange,
	onManageTriggers,
	registerAutomationDialogOpener,
}: Readonly<UseAgentAutomationDialogsOptions>) {
	const currentAutomationRules = useMemo(
		() => getAgentAutomationRules(config),
		[config],
	);
	// Automation authoring routes through the rule-builder modal hosted by
	// AgentConfigFields so every entry point edits against one dialog instance.
	const [triggersEditor, setTriggersEditor] = useState<AgentAutomationEditorState>(() => ({
		open: false,
		fromManage: false,
		title: "New flow",
		seed: createEmptyAutomationRule("automation-1"),
	}));
	const [manageTriggersOpen, setManageTriggersOpen] = useState(false);

	const handleEditTriggers = useCallback((seed?: AgentAutomationRule, fromManage = false, isNew = false) => {
		setTriggersEditor({
			open: true,
			fromManage,
			title: !seed || isNew ? "Add flow" : "Edit flow",
			seed: seed ?? createEmptyAutomationRule(`automation-${getNextAutomationRuleIndex(currentAutomationRules)}`),
		});
	}, [currentAutomationRules]);
	const handleTriggersEditorOpenChange = useCallback((open: boolean) => {
		setTriggersEditor((prev) => ({ ...prev, open }));
	}, []);
	const handleTriggersSave = useCallback((automationRule: AgentAutomationRule) => {
		const current = currentAutomationRules;
		const existingIndex = current.findIndex((rule) => rule.id === automationRule.id);
		onAutomationRulesChange?.(
			existingIndex >= 0
				? current.map((rule, index) => (index === existingIndex ? automationRule : rule))
				: [...current, automationRule],
		);
	}, [currentAutomationRules, onAutomationRulesChange]);

	const handleManageTriggers = useCallback(() => {
		if (onManageTriggers) {
			onManageTriggers();
			return;
		}

		setManageTriggersOpen(true);
	}, [onManageTriggers]);
	// Opens the flow config dialog directly for the most recently configured
	// automation, falling back to a fresh flow when none exist.
	const handleOpenAutomationFlowConfig = useCallback(() => {
		const rules = currentAutomationRules;
		if (rules.length > 0) {
			handleEditTriggers(rules[rules.length - 1]);
			return;
		}
		handleEditTriggers();
	}, [currentAutomationRules, handleEditTriggers]);

	useEffect(() => {
		if (!registerAutomationDialogOpener) {
			return;
		}
		registerAutomationDialogOpener(handleOpenAutomationFlowConfig);
		return () => registerAutomationDialogOpener(null);
	}, [registerAutomationDialogOpener, handleOpenAutomationFlowConfig]);

	const handleAddAutomationFromManage = useCallback(
		(providerId: AgentTriggerProviderId, eventId: string) => {
			const next = createAutomationRuleFromEvent(providerId, eventId, currentAutomationRules);
			if (!next) {
				return;
			}
			setManageTriggersOpen(false);
			handleEditTriggers(next, false, true);
		},
		[currentAutomationRules, handleEditTriggers],
	);
	const handleReorderAutomations = useCallback(
		(activeId: string, overId: string) => {
			const current = currentAutomationRules;
			const from = current.findIndex((rule) => rule.id === activeId);
			const to = current.findIndex((rule) => rule.id === overId);
			if (from === -1 || to === -1) {
				return;
			}
			const next = current.slice();
			const [moved] = next.splice(from, 1);
			next.splice(to, 0, moved);
			onAutomationRulesChange?.(next);
		},
		[currentAutomationRules, onAutomationRulesChange],
	);
	const handleToggleAutomation = useCallback(
		(id: string, enabled: boolean) => {
			const current = currentAutomationRules;
			onAutomationRulesChange?.(
				current.map((rule) => (rule.id === id ? { ...rule, enabled } : rule)),
			);
		},
		[currentAutomationRules, onAutomationRulesChange],
	);
	const handleDeleteAutomation = useCallback(
		(id: string) => {
			const current = currentAutomationRules;
			onAutomationRulesChange?.(current.filter((rule) => rule.id !== id));
		},
		[currentAutomationRules, onAutomationRulesChange],
	);
	const handleEditAutomationFromManage = useCallback(
		(automationRule: AgentAutomationRule) => {
			setManageTriggersOpen(false);
			handleEditTriggers(automationRule, true);
		},
		[handleEditTriggers],
	);

	return {
		currentAutomationRules,
		triggersEditor,
		manageTriggersOpen,
		setManageTriggersOpen,
		handleAddAutomationFromManage,
		handleDeleteAutomation,
		handleEditAutomationFromManage,
		handleEditTriggers,
		handleManageTriggers,
		handleReorderAutomations,
		handleToggleAutomation,
		handleTriggersEditorOpenChange,
		handleTriggersSave,
	};
}

function createEmptyAutomationRule(id: string): AgentAutomationRule {
	return createAgentAutomationRule({
		id,
		name: "",
		prompt: "",
		triggers: [],
	});
}
