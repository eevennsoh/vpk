"use client";

import { useMemo, useState } from "react";
import {
	Agent,
	AgentConfigFields,
	type AgentConfigFormValue,
	type AgentDirectoryKind,
	type AgentConfigListFieldName,
	type AgentConfigTextFieldName,
	AgentContent,
	toggleAgentConfigDisabledItem,
} from "@/components/blocks/trigger-config";
import {
	type AgentAutomationRule,
} from "@/components/blocks/trigger/page";
import { DEFAULT_CONFIGURED_AUTOMATION_RULES } from "@/components/blocks/trigger/data/trigger-catalog";
import {
	ConversationStarterDialog,
	DEFAULT_STARTER_ICON,
	type ConversationStarter,
	type StarterIconKey,
} from "@/components/blocks/conversation-starter";
import { cn } from "@/lib/utils";

const AGENT_DEMO_SURFACE_CLASSNAME = "min-h-[852px] w-full";
const TRIGGER_MANAGE_DOCS_PATH = "/components/blocks/trigger#manage";

const initialAgentConfig: AgentConfigFormValue = {
	name: "",
	description: "",
	summary: "",
	instructions: "",
	contextDescription: "",
	trigger: "",
	guardrail: "",
	tools: [],
	conversationStarters: [],
	agentId: "policy-checker",
	action: "draft",
};

const emptyAgentConfig: AgentConfigFormValue = {
	...initialAgentConfig,
	name: "Untitled trigger",
	description: "",
	summary: "",
	agentId: "customer-insights",
};

const filledAgentConfig: AgentConfigFormValue = {
	name: "Policy Checker",
	description:
		"This trigger helps employees quickly find and understand company guidelines, HR policies, and benefits information.",
	summary:
		"This trigger helps employees quickly find and understand company guidelines, HR policies, and benefits information.",
	instructions: "",
	contextDescription: "",
	automationRules: DEFAULT_CONFIGURED_AUTOMATION_RULES,
	apps: ["Jira", "Confluence"],
	skills: ["Create work items", "Dependency mapper"],
	tools: ["Jira", "Confluence"],
	subagents: ["Subagent 1", "Subagent 1"],
	knowledge: ["Confluence - all content", "Jira - all content"],
	conversationStarters: [
		"Can this policy answer an employee leave question?",
		"Summarize the relevant HR guidance for a manager.",
		"Create a follow-up work item for missing policy context.",
	],
	agentId: "policy-checker",
	action: "draft",
};

function useTriggerConfigDemoConfig(initialConfig: AgentConfigFormValue) {
	const [config, setConfig] = useState<AgentConfigFormValue>(initialConfig);

	function handleTextChange(field: AgentConfigTextFieldName, value: string) {
		setConfig((current) => ({
			...current,
			[field]: value,
			...(field === "description" ? { summary: value } : {}),
		}));
	}

	function updateListItem(field: AgentConfigListFieldName, index: number, value: string) {
		setConfig((current) => {
			const items = Array.isArray(current[field])
				? current[field].map((item, itemIndex) => itemIndex === index ? value : item)
				: [];
			return { ...current, [field]: items };
		});
	}

	function removeListItem(field: AgentConfigListFieldName, index: number) {
		setConfig((current) => {
			const items = Array.isArray(current[field]) ? current[field] : [];
			return { ...current, [field]: items.filter((_, itemIndex) => itemIndex !== index) };
		});
	}

	function toggleListItem(field: AgentConfigListFieldName, index: number, enabled: boolean) {
		setConfig((current) => {
			const label = (Array.isArray(current[field]) ? current[field] : [])[index];
			return label ? toggleAgentConfigDisabledItem(current, field, label, enabled) : current;
		});
	}

	function appendListItem(field: AgentConfigListFieldName) {
		setConfig((current) => {
			const items = Array.isArray(current[field]) ? current[field] : [];
			return { ...current, [field]: [...items, ""] };
		});
	}

	function addListValues(field: AgentConfigListFieldName, values: readonly string[]) {
		setConfig((current) => {
			const items = Array.isArray(current[field]) ? current[field] : [];
			const existing = new Set(items.map((item) => item.trim().toLowerCase()));
			const additions = values.filter((value) => !existing.has(value.trim().toLowerCase()));
			return additions.length > 0 ? { ...current, [field]: [...items, ...additions] } : current;
		});
	}

	function handleAutomationRulesChange(automationRules: readonly AgentAutomationRule[]) {
		setConfig((current) => ({
			...current,
			automationRules,
		}));
	}

	const conversationStarterDialogValue = useMemo<readonly ConversationStarter[]>(() => {
		const texts = Array.isArray(config.conversationStarters)
			? config.conversationStarters
			: [];
		const icons = Array.isArray(config.conversationStarterIcons)
			? config.conversationStarterIcons
			: [];

		return texts
			.filter((text) => text.trim().length > 0)
			.map((text, index) => ({
				id: `starter-${index}`,
				text,
				icon: (icons[index] as StarterIconKey | undefined) ?? DEFAULT_STARTER_ICON,
			}));
	}, [config.conversationStarterIcons, config.conversationStarters]);

	function handleSaveConversationStarters(starters: readonly ConversationStarter[]) {
		setConfig((current) => ({
			...current,
			conversationStarters: starters.map((starter) => starter.text),
			conversationStarterIcons: starters.map((starter) => starter.icon),
		}));
	}

	return {
		config,
		addListValues,
		appendListItem,
		conversationStarterDialogValue,
		handleAutomationRulesChange,
		handleTextChange,
		handleSaveConversationStarters,
		removeListItem,
		toggleListItem,
		updateListItem,
	};
}

function openTriggerManageDocs() {
	window.location.assign(TRIGGER_MANAGE_DOCS_PATH);
}

export function TriggerConfigDemoFull() {
	const {
		addListValues,
		appendListItem,
		config,
		conversationStarterDialogValue,
		handleAutomationRulesChange,
		handleSaveConversationStarters,
		handleTextChange,
		removeListItem,
		toggleListItem,
		updateListItem,
	} = useTriggerConfigDemoConfig(filledAgentConfig);
	const [activeDirectory, setActiveDirectory] = useState<AgentDirectoryKind | null>(null);
	function handleOpenDirectory(directory: AgentDirectoryKind) {
		if (directory === "conversationStarters") {
			setActiveDirectory("conversationStarters");
		}
	}

	return (
		<>
			<Agent className={cn(AGENT_DEMO_SURFACE_CLASSNAME, "flex flex-col")}>
				<AgentContent>
					<AgentConfigFields
						config={config}
						idPrefix="trigger-config-demo-full"
						onTextChange={handleTextChange}
						onListItemChange={updateListItem}
						onRemoveListItem={removeListItem}
						onToggleListItem={toggleListItem}
						onAddListValues={addListValues}
						onAppendListItem={appendListItem}
						onManageTriggers={openTriggerManageDocs}
						onOpenDirectory={handleOpenDirectory}
						onAutomationRulesChange={handleAutomationRulesChange}
					/>
				</AgentContent>
			</Agent>
			<ConversationStarterDialog
				open={activeDirectory === "conversationStarters"}
				onOpenChange={(open) => setActiveDirectory(open ? "conversationStarters" : null)}
				starters={conversationStarterDialogValue}
				maxStarters={3}
				saveLabel={conversationStarterDialogValue.length > 0 ? "Save" : "Add"}
				onSave={handleSaveConversationStarters}
			/>
		</>
	);
}

export function TriggerConfigDemoEmpty() {
	const {
		addListValues,
		appendListItem,
		config,
		conversationStarterDialogValue,
		handleAutomationRulesChange,
		handleSaveConversationStarters,
		handleTextChange,
		removeListItem,
		toggleListItem,
		updateListItem,
	} = useTriggerConfigDemoConfig(emptyAgentConfig);
	const [activeDirectory, setActiveDirectory] = useState<AgentDirectoryKind | null>(null);
	function handleOpenDirectory(directory: AgentDirectoryKind) {
		if (directory === "conversationStarters") {
			setActiveDirectory("conversationStarters");
		}
	}

	return (
		<>
			<Agent className={cn(AGENT_DEMO_SURFACE_CLASSNAME, "flex flex-col")}>
				<AgentContent>
					<AgentConfigFields
						config={config}
						idPrefix="trigger-config-demo-empty"
						onTextChange={handleTextChange}
						onListItemChange={updateListItem}
						onRemoveListItem={removeListItem}
						onToggleListItem={toggleListItem}
						onAddListValues={addListValues}
						onAppendListItem={appendListItem}
						onManageTriggers={openTriggerManageDocs}
						onOpenDirectory={handleOpenDirectory}
						onAutomationRulesChange={handleAutomationRulesChange}
					/>
				</AgentContent>
			</Agent>
			<ConversationStarterDialog
				open={activeDirectory === "conversationStarters"}
				onOpenChange={(open) => setActiveDirectory(open ? "conversationStarters" : null)}
				starters={conversationStarterDialogValue}
				maxStarters={3}
				saveLabel={conversationStarterDialogValue.length > 0 ? "Save" : "Add"}
				onSave={handleSaveConversationStarters}
			/>
		</>
	);
}

export default function TriggerConfigDemo() {
	return <TriggerConfigDemoFull />;
}
