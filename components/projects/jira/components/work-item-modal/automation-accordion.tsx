"use client";

import { token } from "@/lib/tokens";
import { Button } from "@/components/ui/button";
import Heading from "@/components/ui/heading";

import { useWorkItemModal } from "@/app/contexts/context-work-item-modal";
import AutomationIcon from "@atlaskit/icon/core/automation";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";

interface AutomationRuleProps {
	name: string;
	lastExecuted: string;
}

function AutomationRule({ name, lastExecuted }: Readonly<AutomationRuleProps>) {
	return (
		<div>
			<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
				<AutomationIcon label="Automation" color={token("color.icon.success")} />
				<span className="text-sm font-medium">{name}</span>
			</div>
			<span className="text-xs text-text-subtlest">Last executed: {lastExecuted}</span>
		</div>
	);
}

export function AutomationAccordion() {
	const { state, actions } = useWorkItemModal();

	return (
		<div className="min-w-0 overflow-hidden" style={{ border: `1px solid ${token("color.border")}`, borderRadius: token("radius.medium") }}>
			<div style={{ padding: "8px" }}>
				<div className="flex min-w-0 items-center gap-1">
					<Button
						aria-label={state.isAutomationOpen ? "Collapse" : "Expand"}
						aria-expanded={state.isAutomationOpen}
						size="icon-compact"
						variant="ghost"
						className="aria-expanded:!border-transparent aria-expanded:!bg-transparent aria-expanded:!text-text-subtle"
						onClick={actions.toggleAutomation}
					>
						{state.isAutomationOpen ? <ChevronDownIcon label="" size="small" /> : <ChevronRightIcon label="" size="small" />}
					</Button>
					<div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
						<Heading size="small" className="shrink-0 whitespace-nowrap">Automation</Heading>
						{state.isAutomationOpen ? null : (
							<span className="block min-w-0 flex-1 truncate text-xs text-text-subtlest" title="Rule executions">Rule executions</span>
						)}
					</div>
				</div>
			</div>

			{state.isAutomationOpen ? <div style={{ padding: "8px 12px 12px" }}>
					<div className="flex flex-col gap-3">
						<span className="text-sm font-medium text-text-subtlest">Rule executions</span>
						<AutomationRule name="Route RFP intake by region" lastExecuted="2 hours ago" />
						<AutomationRule name="Notify deal desk on pricing review" lastExecuted="5 days ago" />
					</div>
				</div> : null}
		</div>
	);
}
