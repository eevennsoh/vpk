"use client";

import { useState, type ReactElement } from "react";
import { BUTTER_BOARD_AGENTS } from "@/components/blocks/jira-issue/project-butter-agent-catalog";
import { ProjectButterAgentPickerContent } from "@/components/blocks/jira-issue/project-butter-agent-picker";
import { ProjectButterInvocationProvider } from "@/components/blocks/jira-issue/project-butter-invocation";
import { ProjectButterDevelopmentActions } from "@/components/blocks/jira-work-item/project-butter/project-butter-development-actions";
import { Button } from "@/components/ui/button";
import { dropdownStyles } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CodeIcon } from "@/components/ui/vpk-icons";
import { usePersistentState } from "@/lib/use-persistent-state";
import { cn } from "@/lib/utils";
import { InlineLocalAgentPicker } from "./inline-local-agent-picker";

export function JiraLocalAgent({ presentation = "submenu", trigger, workItem }: Readonly<{ presentation?: "submenu" | "inline"; trigger?: ReactElement; workItem: { code: string; summary: string; description: string } }>) {
	const [open, setOpen] = useState(false);
	const [lastUsedAgentId, setLastUsedAgentId] = usePersistentState<string | null>("jira-local-agent-last-used", null);
	return (
		<ProjectButterInvocationProvider agents={BUTTER_BOARD_AGENTS} enabled>
			<Popover open={open} onOpenChange={setOpen}>
				{trigger ? <PopoverTrigger render={trigger} /> : <PopoverTrigger render={<Button aria-label="Open local agent" size="icon" variant="ghost" />}>
					<CodeIcon aria-hidden size="small" />
				</PopoverTrigger>}
				<PopoverContent aria-label="Local software agents" align="start" sideOffset={8} className="w-80 max-h-[min(26rem,var(--available-height,26rem))] gap-0 overflow-hidden p-0 [&_[cmdk-group]:last-child]:!pb-0" onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }}>
					{presentation === "inline" ? <InlineLocalAgentPicker onLocalUse={setLastUsedAgentId} recentAgentId={lastUsedAgentId} /> : <ProjectButterAgentPickerContent localOnly onLocalUse={setLastUsedAgentId} recentAgentId={lastUsedAgentId} />}
					<div className="px-1 pb-1">
						<hr className={cn(dropdownStyles.separator, "mt-0 border-0")} />
						<div className="px-2"><ProjectButterDevelopmentActions {...workItem} presentation="menu" showStartCoding={false} /></div>
					</div>
				</PopoverContent>
			</Popover>
		</ProjectButterInvocationProvider>
	);
}
