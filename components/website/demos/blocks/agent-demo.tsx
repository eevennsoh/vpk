"use client";

import { type ReactNode, useMemo, useRef, useState } from "react";
import {
	Agent,
	AgentCompactAccessPanel,
	AgentCompactEvaluationPanel,
	AgentConfigFields,
	type AgentConfigFormValue,
	type AgentDirectoryKind,
	type AgentCompactHeaderSection,
	type AgentConfigListFieldName,
	type AgentConfigTextFieldName,
	AgentContent,
	AgentCompactHeaderNav,
	AgentCompactInsightsPanel,
	AgentCompactSurfacesPanel,
	AgentCompactUsersPanel,
	AgentHeader,
	AgentMoreOptionsMenu,
	toggleAgentConfigDisabledItem,
} from "@/components/blocks/agent";
import type { AgentAutomationRule } from "@/components/blocks/trigger/page";
import { DEFAULT_CONFIGURED_AUTOMATION_RULES } from "@/components/blocks/trigger/data/trigger-catalog";
import {
	ConversationStarterDialog,
	DEFAULT_STARTER_ICON,
	type ConversationStarter,
	type StarterIconKey,
} from "@/components/blocks/conversation-starter";
import { AgentTestPanel } from "@/components/blocks/agent-test";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import type { StudioSessionAgentEntry } from "@/app/contexts/context-rovo-chat";
import type { RovoDataParts } from "@/lib/rovo-ui-messages";
import { cn } from "@/lib/utils";

const AGENT_DEMO_SURFACE_CLASSNAME = "min-h-[852px] w-full";
type AgentDemoView = "test" | "configure";
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
	name: "Untitled agent",
	description: "",
	summary: "",
	agentId: "customer-insights",
};

const filledAgentConfig: AgentConfigFormValue = {
	name: "Policy Checker",
	description:
		"This agent helps employees quickly find and understand company guidelines, HR policies, and benefits information.",
	summary:
		"This agent helps employees quickly find and understand company guidelines, HR policies, and benefits information.",
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

function useAgentDemoConfig(initialConfig: AgentConfigFormValue) {
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
		handleTextChange,
		handleSaveConversationStarters,
		handleAutomationRulesChange,
		removeListItem,
		toggleListItem,
		updateListItem,
	};
}

function AgentDemoHeaderActions({
	activeView,
	onTestPressedChange,
}: Readonly<{
	activeView: AgentDemoView;
	onTestPressedChange: (pressed: boolean) => void;
}>) {
	return (
		<>
			<AgentMoreOptionsMenu />
			<Toggle
				aria-label="Toggle agent test view"
				onPressedChange={onTestPressedChange}
				pressed={activeView === "test"}
				size="default"
				type="button"
				variant="outline"
			>
				Test
			</Toggle>
			<Button type="button" size="default" variant="default">
				Publish
			</Button>
		</>
	);
}

function buildAgentDemoTestEntry(config: AgentConfigFormValue): StudioSessionAgentEntry {
	const agentName = config.name?.trim() || "Untitled agent";
	const description = config.description?.trim() || config.summary?.trim();
	const summary = description || "Test this agent before it goes live.";
	const action = config.action === "update" ? "update" : "create";
	const agentResult: RovoDataParts["agent-result"] = {
		agentId: config.agentId || "agent-demo-test",
		name: agentName,
		byline: "Custom agent test",
		summary,
		description: summary,
		instructions: config.instructions,
		contextDescription: config.contextDescription,
		conversationStarters: [...(config.conversationStarters ?? [])],
		conversationStarterIcons: [...(config.conversationStarterIcons ?? [])],
		automationRules: [...(config.automationRules ?? [])],
		tools: [...(config.tools ?? [])],
		skills: [...(config.skills ?? [])],
		knowledge: [...(config.knowledge ?? [])],
		subagents: [...(config.subagents ?? [])],
		guardrail: config.guardrail,
		action,
	};

	return {
		profile: {
			id: agentResult.agentId,
			name: agentName,
			byline: "Custom agent test",
			description: summary,
			starters: [],
		},
		resultKey: `agent-demo:${agentResult.agentId}`,
		sourceResult: agentResult,
		draftResult: agentResult,
		lastTouchedAt: 0,
		publishReadyResult: agentResult,
		publishedResult: null,
		publishStatus: "testing",
		publishedVersion: 0,
		lastPublishedAt: null,
		lastPublishedBy: null,
		versionHistory: [],
	};
}

function openTriggerManageDocs() {
	window.location.assign(TRIGGER_MANAGE_DOCS_PATH);
}

/**
 * Shared body for the compact agent demos. The header nav is a *controlled*
 * component — it only reacts when a parent owns `activeSection` and feeds it
 * back — so every nav-bearing demo routes its selected section through here.
 * Each section's screen owns its own scroll container + padding, so panels
 * render inside a bounded `flex-1 min-h-0` region rather than the padded
 * `AgentContent`; when no section is active we fall back to `configView`.
 */
function AgentDemoCompactBody({
	activeSection,
	configView,
}: Readonly<{
	activeSection: AgentCompactHeaderSection | null;
	configView: ReactNode;
}>) {
	if (activeSection === "details") {
		return configView;
	}
	if (activeSection === "insights") {
		return (
			<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
				<AgentCompactInsightsPanel />
			</div>
		);
	}
	if (activeSection === "evaluation") {
		return (
			<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
				<AgentCompactEvaluationPanel />
			</div>
		);
	}
	if (activeSection === "access") {
		return (
			<div className="min-h-0 flex-1 overflow-y-auto">
				<div className="mx-auto w-full max-w-4xl px-6 py-5">
					<AgentCompactAccessPanel />
				</div>
			</div>
		);
	}
	if (activeSection === "users") {
		return (
			<div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
				<AgentCompactUsersPanel />
			</div>
		);
	}
	if (activeSection === "surfaces") {
		return (
			<div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
				<AgentCompactSurfacesPanel />
			</div>
		);
	}
	return configView;
}

export function AgentDemoFull() {
	const {
		addListValues,
		appendListItem,
		config,
		conversationStarterDialogValue,
		handleSaveConversationStarters,
		handleTextChange,
		handleAutomationRulesChange,
		removeListItem,
		toggleListItem,
		updateListItem,
	} = useAgentDemoConfig(filledAgentConfig);
	const [activeSection, setActiveSection] = useState<AgentCompactHeaderSection | null>("details");
	const [activeView, setActiveView] = useState<AgentDemoView>("configure");
	const [activeDirectory, setActiveDirectory] = useState<AgentDirectoryKind | null>(null);
	const lastSectionRef = useRef<AgentCompactHeaderSection>("details");
	const testEntry = buildAgentDemoTestEntry(config);
	function handleHeaderSectionChange(section: AgentCompactHeaderSection) {
		lastSectionRef.current = section;
		setActiveView("configure");
		setActiveSection(section);
	}
	function handleTestPressedChange(pressed: boolean) {
		if (pressed) {
			if (activeSection) {
				lastSectionRef.current = activeSection;
			}
			setActiveView("test");
			setActiveSection(null);
			return;
		}
		setActiveView("configure");
		setActiveSection(lastSectionRef.current ?? "details");
	}
	function handleOpenDirectory(directory: AgentDirectoryKind) {
		if (directory === "conversationStarters") {
			setActiveDirectory("conversationStarters");
		}
	}

	return (
		<>
			<Agent className={cn(AGENT_DEMO_SURFACE_CLASSNAME, "flex flex-col")}>
				<AgentHeader
					actions={<AgentDemoHeaderActions activeView={activeView} onTestPressedChange={handleTestPressedChange} />}
					leadingContent={
						<AgentCompactHeaderNav activeSection={activeSection} onSectionChange={handleHeaderSectionChange} />
					}
					name={config.name?.trim() || "Untitled agent"}
				/>
				{activeView === "test" ? (
					<AgentTestPanel entry={testEntry} />
				) : (
					<AgentDemoCompactBody
						activeSection={activeSection}
						configView={
							<AgentContent>
									<AgentConfigFields
										config={config}
										idPrefix="agent-demo-full"
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
						}
					/>
				)}
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

export function AgentDemoEmpty() {
	const {
		addListValues,
		appendListItem,
		config,
		conversationStarterDialogValue,
		handleSaveConversationStarters,
		handleTextChange,
		handleAutomationRulesChange,
		removeListItem,
		toggleListItem,
		updateListItem,
	} = useAgentDemoConfig(emptyAgentConfig);
	const [activeSection, setActiveSection] = useState<AgentCompactHeaderSection | null>("details");
	const [activeView, setActiveView] = useState<AgentDemoView>("configure");
	const [activeDirectory, setActiveDirectory] = useState<AgentDirectoryKind | null>(null);
	const lastSectionRef = useRef<AgentCompactHeaderSection>("details");
	const testEntry = buildAgentDemoTestEntry(config);
	function handleHeaderSectionChange(section: AgentCompactHeaderSection) {
		lastSectionRef.current = section;
		setActiveView("configure");
		setActiveSection(section);
	}
	function handleTestPressedChange(pressed: boolean) {
		if (pressed) {
			if (activeSection) {
				lastSectionRef.current = activeSection;
			}
			setActiveView("test");
			setActiveSection(null);
			return;
		}
		setActiveView("configure");
		setActiveSection(lastSectionRef.current ?? "details");
	}
	function handleOpenDirectory(directory: AgentDirectoryKind) {
		if (directory === "conversationStarters") {
			setActiveDirectory("conversationStarters");
		}
	}

	return (
		<>
			<Agent className={cn(AGENT_DEMO_SURFACE_CLASSNAME, "flex flex-col")}>
				<AgentHeader
					actions={<AgentDemoHeaderActions activeView={activeView} onTestPressedChange={handleTestPressedChange} />}
					leadingContent={
						<AgentCompactHeaderNav activeSection={activeSection} onSectionChange={handleHeaderSectionChange} />
					}
					name={config.name?.trim() || "Untitled agent"}
				/>
				{activeView === "test" ? (
					<AgentTestPanel entry={testEntry} />
				) : (
					<AgentDemoCompactBody
						activeSection={activeSection}
						configView={
							<AgentContent>
									<AgentConfigFields
										config={config}
										idPrefix="agent-demo-empty"
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
						}
					/>
				)}
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

export default function AgentDemo() {
	return <AgentDemoFull />;
}
