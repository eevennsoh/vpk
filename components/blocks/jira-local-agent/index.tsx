"use client";

import { useState, type ReactElement } from "react";
import { ProjectButterDevelopmentActions } from "@/components/blocks/jira-work-item/project-butter/project-butter-development-actions";
import { Button } from "@/components/ui/button";
import { OpenIn } from "@/components/ui-custom/open-in";
import { dropdownStyles } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RovoColorIcon } from "@/components/ui/logo";
import { LogoThirdParty } from "@/components/ui/logo-third-party";
import { CodeIcon } from "@/components/ui/vpk-icons";
import { usePersistentState } from "@/lib/use-persistent-state";
import { cn } from "@/lib/utils";
import { InlineLocalAgentPicker, LOCAL_APPS } from "./inline-local-agent-picker";

type JiraLocalAgentMenuProps = Readonly<{ presentation?: "submenu" | "inline"; workItem: { code: string; summary: string; description: string }; onLocalUse?: (agentId: string) => void }>;

type JiraLocalAgentProps = JiraLocalAgentMenuProps & Readonly<{ trigger?: ReactElement }>;

function LocalAppSplitIcon({ agent }: Readonly<{ agent: (typeof LOCAL_APPS)[number] }>) {
	if (agent.id === "rovo-cli") return <RovoColorIcon size="xxsmall" />;
	if (agent.id === "vscode" || agent.id === "test-agent") return <LogoThirdParty artwork="local" label="" name={agent.id === "vscode" ? "vs-code" : "cursor"} sizePx={16} />;
	return agent.brandName ? <LogoThirdParty artwork={agent.id === "review-agent" ? "glyph" : "package"} borderless className={cn("[&_svg]:size-4!", agent.id === "claude-code" && "[&_svg]:scale-150")} label="" name={agent.brandName} size="xxsmall" sizePx={16} /> : null;
}

export function JiraLocalAgentMenu({ presentation = "submenu", workItem, onLocalUse }: JiraLocalAgentMenuProps) {
	const [lastUsedAgentId, setLastUsedAgentId] = usePersistentState<string | null>("jira-local-agent-last-used", null);
	return (
		<>
			<InlineLocalAgentPicker onLocalUse={(id) => { setLastUsedAgentId(id); onLocalUse?.(id); }} presentation={presentation} recentAgentId={lastUsedAgentId} />
			<div className="px-1 pb-1">
				<hr className={cn(dropdownStyles.separator, "mt-0 border-0")} />
				<div className="px-2"><ProjectButterDevelopmentActions {...workItem} presentation="menu" showStartCoding={false} /></div>
			</div>
		</>
	);
}

export function JiraLocalAgentSplitButton({ workItem }: Pick<JiraLocalAgentMenuProps, "workItem">) {
	const [open, setOpen] = useState(false);
	const [feedback, setFeedback] = useState("");
	const [lastUsedAgentId, setLastUsedAgentId] = usePersistentState<string | null>("jira-local-agent-last-used", null);
	const recentAgent = LOCAL_APPS.find((agent) => agent.id === lastUsedAgentId && agent.id !== "release-agent") ?? LOCAL_APPS.find((agent) => agent.id === "claude-code");
	return <OpenIn app={recentAgent ? { name: recentAgent.name, icon: <LocalAppSplitIcon agent={recentAgent} /> } : null} contentLabel="Local software agents" onAppClick={() => { if (recentAgent) { setLastUsedAgentId(recentAgent.id); setFeedback(recentAgent.id === "rovo-cli" ? "Command copied" : ""); } }} onOpenChange={setOpen} open={open} status={feedback}>
		<JiraLocalAgentMenu workItem={workItem} onLocalUse={(id) => { if (id !== "rovo-cli") setOpen(false); }} />
	</OpenIn>;
}

export function JiraLocalAgent({ trigger, ...props }: JiraLocalAgentProps) {
	const [open, setOpen] = useState(false);
	return (
		<Popover open={open} onOpenChange={setOpen}>
			{trigger ? <PopoverTrigger render={trigger} /> : <PopoverTrigger render={<Button aria-label="Open local agent" size="icon" variant="ghost" />}>
				<CodeIcon aria-hidden size="small" />
			</PopoverTrigger>}
			<PopoverContent aria-label="Local software agents" align="start" sideOffset={8} initialFocus={(interactionType) => interactionType === "keyboard"} className="w-80 max-h-[min(26rem,var(--available-height,26rem))] gap-0 overflow-hidden rounded-lg p-0 shadow-2xl [&_[cmdk-group]:last-child]:!pb-0" onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }}>
				<JiraLocalAgentMenu {...props} />
			</PopoverContent>
		</Popover>
	);
}
