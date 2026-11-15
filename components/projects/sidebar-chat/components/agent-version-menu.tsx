"use client";

// oxlint-disable react-doctor/jsx-no-jsx-as-prop -- The version trigger and selected-row adornment use slot/render-node props.

import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import { cn } from "@/lib/utils";
import type { ChatPanelAgentVersionOption } from "../lib/chat-panel-types";

interface AgentVersionMenuProps {
	agentVersionOptions: readonly ChatPanelAgentVersionOption[];
	onSelectVersion: (versionId: string) => void;
	selectedAgentVersion: ChatPanelAgentVersionOption;
}

/** Agent Test version picker: the selected version lozenge opens the version list. */
export function AgentVersionMenu({
	agentVersionOptions,
	onSelectVersion,
	selectedAgentVersion,
}: Readonly<AgentVersionMenuProps>): React.ReactElement {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						aria-label="Switch version"
						// Nudge the version control 8px left so its lozenge
						// visually aligns with the header controls above.
						className="-ml-2 h-8 shrink-0 gap-1.5 px-2 text-sm font-medium text-text"
						type="button"
						variant="ghost"
					/>
				}
			>
				<Badge variant={selectedAgentVersion.variant ?? "success"}>
					{selectedAgentVersion.label}
				</Badge>
				<ChevronDownIcon label="" size="small" spacing="none" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" sideOffset={8}>
				<DropdownMenuGroup>
					{agentVersionOptions.map((version) => (
						<Fragment key={version.id}>
							{version.sectionBreakBefore ? (
								<DropdownMenuSeparator />
							) : null}
							<DropdownMenuItem
								onSelect={() => onSelectVersion(version.id)}
								className={cn((version.variant ?? "success") === "neutral" && "bg-popover sticky top-0 z-10")}
								elemAfter={version.id === selectedAgentVersion.id ? <CheckMarkIcon label="Selected" /> : undefined}
							>
								<span className="flex min-w-0 items-center gap-2">
									<Badge variant={version.variant ?? "success"}>{version.label}</Badge>
									{version.isCurrent ? (
										<span className="text-xs text-text-subtle">Current</span>
									) : null}
								</span>
							</DropdownMenuItem>
						</Fragment>
					))}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
