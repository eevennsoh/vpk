"use client";

import { useCallback, useState, type ReactElement } from "react";
import Trigger, {
	TriggerAutomationDialog,
} from "@/components/blocks/trigger/page";
import { ManageTriggersDialog } from "@/components/blocks/trigger/components/manage-triggers-dialog";
import { Button } from "@/components/ui/button";
import {
	DEFAULT_CONFIGURED_TRIGGER_VALUES,
	DEFAULT_NEEDS_CONNECTION_TRIGGER_VALUES,
	createAgentAutomationRule,
	createAgentTriggerValue,
	type AgentTriggerProviderId,
	type AgentAutomationRule,
	type AgentTriggerValue,
} from "@/components/blocks/trigger/data/trigger-catalog";

const MULTIPLE_AUTOMATION_RULES = [
	createAgentAutomationRule({
		id: "automation-1",
		name: "Team channel summary",
		prompt: "Summarize the run and post the result to the team channel.",
		triggers: DEFAULT_CONFIGURED_TRIGGER_VALUES,
	}),
	createAgentAutomationRule({
		id: "automation-2",
		name: "Documentation response",
		prompt: "Reply to the comment with a status update and next steps.",
		triggers: [
			createAgentTriggerValue("jira", "comment-added", 1),
			createAgentTriggerValue("confluence", "page-updated", 2),
		].filter(Boolean) as AgentTriggerValue[],
	}),
] as const satisfies readonly AgentAutomationRule[];

function TriggerDemoFrame({ children }: Readonly<{ children: ReactElement }>): ReactElement {
	return (
		<div className="flex items-start justify-center p-6">
			<div className="w-full max-w-[48rem]">{children}</div>
		</div>
	);
}

export default function TriggerDemo(): ReactElement {
	return (
		<TriggerDemoFrame>
			<Trigger />
		</TriggerDemoFrame>
	);
}

export function TriggerDemoEmpty(): ReactElement {
	return (
		<TriggerDemoFrame>
			<Trigger />
		</TriggerDemoFrame>
	);
}

export function TriggerDemoPicker(): ReactElement {
	return (
		<TriggerDemoFrame>
			<Trigger />
		</TriggerDemoFrame>
	);
}

export function TriggerDemoConfigured(): ReactElement {
	return (
		<TriggerDemoFrame>
			<Trigger defaultAutomationRules={MULTIPLE_AUTOMATION_RULES.slice(0, 1)} />
		</TriggerDemoFrame>
	);
}

export function TriggerDemoMultiple(): ReactElement {
	return (
		<TriggerDemoFrame>
			<Trigger defaultAutomationRules={MULTIPLE_AUTOMATION_RULES} />
		</TriggerDemoFrame>
	);
}

export function TriggerDemoNeedsConnection(): ReactElement {
	return (
		<TriggerDemoFrame>
			<Trigger defaultTriggers={DEFAULT_NEEDS_CONNECTION_TRIGGER_VALUES} />
		</TriggerDemoFrame>
	);
}

export function TriggerDemoManage(): ReactElement {
	const [automationRules, setAutomationRules] = useState<readonly AgentAutomationRule[]>(MULTIPLE_AUTOMATION_RULES);
	const [manageOpen, setManageOpen] = useState(false);
	const [automationOpen, setAutomationOpen] = useState(false);
	const [selectedRule, setSelectedRule] = useState<AgentAutomationRule>(MULTIPLE_AUTOMATION_RULES[0]);

	const handleAddAutomation = useCallback((providerId: AgentTriggerProviderId, eventId: string) => {
		const trigger = createAgentTriggerValue(providerId, eventId, 1);
		if (!trigger) {
			return;
		}
		const nextRule = createAgentAutomationRule({
			id: `automation-${automationRules.length + 1}`,
			name: "",
			prompt: "",
			triggers: [trigger],
		});
		setSelectedRule(nextRule);
		setManageOpen(false);
		setAutomationOpen(true);
	}, [automationRules.length]);

	const handleReorderAutomations = useCallback((activeId: string, overId: string) => {
		setAutomationRules((current) => {
			const from = current.findIndex((rule) => rule.id === activeId);
			const to = current.findIndex((rule) => rule.id === overId);
			if (from === -1 || to === -1) {
				return current;
			}
			const next = current.slice();
			const [moved] = next.splice(from, 1);
			next.splice(to, 0, moved);
			return next;
		});
	}, []);

	const handleToggleAutomation = useCallback((id: string, enabled: boolean) => {
		setAutomationRules((current) =>
			current.map((rule) => (rule.id === id ? { ...rule, enabled } : rule)),
		);
	}, []);

	const handleDeleteAutomation = useCallback((id: string) => {
		setAutomationRules((current) => current.filter((rule) => rule.id !== id));
	}, []);

	const handleEditAutomation = useCallback((rule: AgentAutomationRule) => {
		setSelectedRule(rule);
		setManageOpen(false);
		setAutomationOpen(true);
	}, []);
	const handleSaveAutomation = useCallback((rule: AgentAutomationRule) => {
		setAutomationRules((current) =>
			current.some((item) => item.id === rule.id)
				? current.map((item) => (item.id === rule.id ? rule : item))
				: [...current, rule],
		);
	}, []);

	return (
		<TriggerDemoFrame>
			<div className="grid gap-3">
				<ButtonShell onClick={() => setManageOpen(true)} />
				<ManageTriggersDialog
					open={manageOpen}
					onOpenChange={setManageOpen}
					automationRules={automationRules}
					onAddAutomation={handleAddAutomation}
					onReorderAutomations={handleReorderAutomations}
					onToggleAutomation={handleToggleAutomation}
					onDeleteAutomation={handleDeleteAutomation}
					onEditAutomation={handleEditAutomation}
				/>
				<TriggerAutomationDialog
					automationRule={selectedRule}
					open={automationOpen}
					onOpenChange={setAutomationOpen}
					onSave={handleSaveAutomation}
					title="Edit Automation"
				/>
			</div>
		</TriggerDemoFrame>
	);
}

function ButtonShell({ onClick }: Readonly<{ onClick: () => void }>): ReactElement {
	return (
		<Button className="w-fit" onClick={onClick} type="button" variant="outline">
			Manage automations
		</Button>
	);
}
