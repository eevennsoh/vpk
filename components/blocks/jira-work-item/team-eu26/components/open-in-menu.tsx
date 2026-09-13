"use client";

import { cloneElement, useState, type ReactElement, type ReactNode } from "react";
import CopyIcon from "@atlaskit/icon/core/copy";

import {
	useJiraWorkItemMeta,
	useJiraWorkItemState,
} from "@/components/blocks/jira-work-item/team-eu26/context-jira-work-item";
import type { ThirdPartyLogoName } from "@/components/ui/data/logo-third-party-data";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RovoColorIcon } from "@/components/ui/logo";
import { LogoThirdParty } from "@/components/ui/logo-third-party";

type OpenInAgentId =
	| "claude-code"
	| "codex"
	| "cursor"
	| "github-copilot"
	| "rovo-cli"
	| "vs-code";

type OpenInAgent = Readonly<{
	id: OpenInAgentId;
	label: string;
	logo: ReactNode;
}>;

function thirdPartyAgentLogo(name: ThirdPartyLogoName): ReactNode {
	return <LogoThirdParty borderless name={name} size="small" />;
}

/**
 * Local-session destinations shared by the header Open-in-code button and the
 * empty Development "Start local session" action. Logos reuse the same 1P / 3P
 * marks as {@link ContextTitleActions}.
 */
const OPEN_IN_MENU_AGENTS: readonly OpenInAgent[] = [
	{ id: "claude-code", label: "Claude Code", logo: thirdPartyAgentLogo("claude") },
	{ id: "codex", label: "Codex", logo: thirdPartyAgentLogo("openai-codex") },
	{ id: "cursor", label: "Cursor", logo: thirdPartyAgentLogo("cursor") },
	{ id: "github-copilot", label: "GitHub Copilot", logo: thirdPartyAgentLogo("github-copilot") },
	{ id: "rovo-cli", label: "Rovo CLI", logo: <RovoColorIcon size="small" /> },
	{ id: "vs-code", label: "VS Code", logo: thirdPartyAgentLogo("vs-code") },
];

const OPEN_IN_MENU_CONTENT = {
	align: "end",
	className: "flex min-w-56 flex-col gap-1 p-1",
	positionerClassName: "z-[502]",
} as const;

function copyWorkItemPrompt(workItemCode: string, title: string, description: string) {
	const body = [title, description].filter((part) => part.trim().length > 0).join("\n\n");
	void navigator.clipboard.writeText(body ? `${workItemCode}: ${body}` : workItemCode);
}

/**
 * Shared "Open in..." dropdown. The caller supplies the trigger; this owner
 * supplies the menu, logos, and Copy prompt.
 */
export function OpenInMenu({
	align = "end",
	trigger,
}: Readonly<{
	align?: "start" | "end";
	trigger: ReactElement<{ "aria-pressed"?: boolean }>;
}>) {
	const [open, setOpen] = useState(false);
	const { contextResources } = useJiraWorkItemState();
	const { workItem } = useJiraWorkItemMeta();

	return (
		<DropdownMenu onOpenChange={setOpen} open={open}>
			<DropdownMenuTrigger render={cloneElement(trigger, { "aria-pressed": open })} />
			<DropdownMenuContent
				align={align}
				className={OPEN_IN_MENU_CONTENT.className}
				positionerClassName={OPEN_IN_MENU_CONTENT.positionerClassName}
			>
				<DropdownMenuGroup>
					<DropdownMenuLabel>Copy prompt for</DropdownMenuLabel>
					{OPEN_IN_MENU_AGENTS.map((agent) => (
						<DropdownMenuItem
							elemBefore={(
								<span aria-hidden className="inline-flex items-center justify-center leading-none">
									{agent.logo}
								</span>
							)}
							key={agent.id}
							onSelect={() => {
								copyWorkItemPrompt(workItem.code, contextResources.title, contextResources.description);
							}}
						>
							{agent.label}
						</DropdownMenuItem>
					))}
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem
						elemBefore={<CopyIcon label="" size="small" />}
						onSelect={() => {
							copyWorkItemPrompt(workItem.code, contextResources.title, contextResources.description);
						}}
					>
						Copy prompt
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
