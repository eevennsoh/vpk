"use client";

import { useState } from "react";

import { JiraToolbar } from "./index";
import { Button } from "@/components/ui/button";
import { BOARD_AGENTS } from "@/components/projects/jira/data/board-agents";

const STATUS_OPTIONS = ["Intake", "Drafting", "Review", "Approved"] as const;

export default function JiraToolbarPage() {
	const [selectedCount, setSelectedCount] = useState(2);
	const [selectedStatus, setSelectedStatus] = useState<string | null>("Intake");
	const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);

	return (
		<div className="relative grid min-h-[320px] w-full place-items-center rounded-lg bg-surface p-6">
			<div className="flex flex-col items-center gap-3 text-center">
				<p className="text-sm text-text-subtle">
					{selectedCount > 0
						? `${selectedCount} Jira work items selected in ${selectedStatus ?? "multiple statuses"}.`
						: "Select work items to show the Jira Toolbar."}
				</p>
				{selectedCount === 0 ? (
					<Button onClick={() => setSelectedCount(2)}>Select two work items</Button>
				) : null}
			</div>
			<JiraToolbar
				agents={BOARD_AGENTS}
				className="absolute"
				onAgentAssignmentChange={(agentId, assigned) => {
					setSelectedAgentIds((current) => assigned
						? Array.from(new Set([...current, agentId]))
						: current.filter((id) => id !== agentId));
				}}
				onClearSelection={() => setSelectedCount(0)}
				onSelectAll={() => setSelectedCount(6)}
				onStatusChange={setSelectedStatus}
				selectedAgentIds={selectedAgentIds}
				selectedCount={selectedCount}
				selectedStatus={selectedStatus}
				statusOptions={STATUS_OPTIONS}
			/>
		</div>
	);
}
