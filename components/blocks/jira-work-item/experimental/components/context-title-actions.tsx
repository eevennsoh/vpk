"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Icon } from "@/components/ui/icon";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RovoColorIcon } from "@/components/ui/logo";
import { LogoThirdParty } from "@/components/ui/logo-third-party";
import type { ThirdPartyLogoName } from "@/components/ui/data/logo-third-party-data";
import type { ReactNode } from "react";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import CopyIcon from "@atlaskit/icon/core/copy";
import EyeOpenIcon from "@atlaskit/icon/core/eye-open";
import LockUnlockedIcon from "@atlaskit/icon/core/lock-unlocked";
import ShareIcon from "@atlaskit/icon/core/share";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";

export type CodingAgentId =
	| "claude-code"
	| "codex"
	| "rovo-cli"
	| "cursor"
	| "vs-code"
	| "github-copilot"
	| "gemini";

type CodingAgent = Readonly<{
	/** Stable id used for React keys. */
	id: CodingAgentId;
	/** Human-readable label shown in the button/menu. */
	label: string;
	/** Brand glyph. Rovo is a 1P mark; the rest render via `LogoThirdParty`. */
	logo: ReactNode;
}>;

function thirdPartyAgentLogo(name: ThirdPartyLogoName): ReactNode {
	return <LogoThirdParty name={name} size="small" borderless />;
}

/**
 * Coding editors / agents shown behind the "Open" split button. The first entry
 * is the default — its logo + label sit in front of the split button, so it is
 * intentionally omitted from the dropdown (no need to repeat the default). The
 * remaining entries populate the trailing chevron's menu. Most map to a
 * registered `LogoThirdParty` brand (Codex/Cursor/Copilot ship with the upstream
 * package or a local `public/3p` fallback); Rovo CLI uses the 1P `RovoColorIcon`.
 */
const CODING_AGENTS: readonly CodingAgent[] = [
	{ id: "claude-code", label: "Claude", logo: thirdPartyAgentLogo("claude") },
	{ id: "codex", label: "Codex", logo: thirdPartyAgentLogo("openai-codex") },
	{ id: "rovo-cli", label: "Rovo CLI", logo: <RovoColorIcon size="small" /> },
	{ id: "cursor", label: "Cursor", logo: thirdPartyAgentLogo("cursor") },
	{ id: "vs-code", label: "VS Code", logo: thirdPartyAgentLogo("vs-code") },
	{ id: "github-copilot", label: "GitHub Copilot", logo: thirdPartyAgentLogo("github-copilot") },
	{ id: "gemini", label: "Gemini", logo: thirdPartyAgentLogo("google-gemini") },
];

/**
 * Title-row action cluster for the experimental Jira Work Item work item:
 * lock / watch / share / status / Open split button / more. It mirrors the
 * standard ModalHeader action styling but sits beside the editable
 * title instead of in the breadcrumb row. The Open split button reuses the
 * shared ButtonGroup primitive so the main + trailing chevron read as one group;
 * its trailing chevron opens a dropdown listing the available coding agents.
 */
export function ContextTitleActions({
	collapsed = false,
	primaryAgentId = "claude-code",
}: Readonly<{ collapsed?: boolean; primaryAgentId?: CodingAgentId }>) {
	const primaryCodingAgent = CODING_AGENTS.find((agent) => agent.id === primaryAgentId) ?? CODING_AGENTS[0];
	const secondaryCodingAgents = CODING_AGENTS.filter((agent) => agent.id !== primaryCodingAgent.id);

	return (
		<div className="flex shrink-0 items-center gap-2">
			{collapsed ? null : (
				<>
					<Button aria-label="No restrictions" size="icon" variant="outline">
						<LockUnlockedIcon label="" />
					</Button>
					<Button className="gap-2" variant="outline">
						<EyeOpenIcon label="" />
						1
					</Button>
					<Button aria-label="Share" size="icon" variant="outline">
						<ShareIcon label="" />
					</Button>
				</>
			)}
			<ButtonGroup variant="split">
				<Button aria-label={`Open with ${primaryCodingAgent.label}`} variant="outline" className="gap-0.5">
					{primaryCodingAgent.logo}
					Open
				</Button>
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<Button aria-label="More open options" size="icon" variant="outline">
								<ChevronDownIcon label="" size="small" />
							</Button>
						}
					/>
					<DropdownMenuContent align="end" positionerClassName="z-[502]" className="p-0">
						<div className="max-h-72 overflow-y-auto p-1">
							<DropdownMenuGroup>
								<DropdownMenuLabel>Open in</DropdownMenuLabel>
								{secondaryCodingAgents.map((agent) => (
									<DropdownMenuItem className="gap-0.5" key={agent.id} elemBefore={agent.logo}>
										{agent.label}
									</DropdownMenuItem>
								))}
							</DropdownMenuGroup>
						</div>
						<div className="sticky bottom-0 border-t border-border bg-surface-overlay p-1">
							<DropdownMenuItem
								className="gap-0.5"
								elemBefore={<CopyIcon label="" size="small" />}
							>
								Copy prompt
							</DropdownMenuItem>
						</div>
					</DropdownMenuContent>
				</DropdownMenu>
			</ButtonGroup>
			{collapsed ? (
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<Button aria-label="Actions" size="icon" variant="outline">
								<ShowMoreHorizontalIcon label="" />
							</Button>
						}
					/>
					<DropdownMenuContent align="end" positionerClassName="z-[502]">
						<DropdownMenuItem
							elemBefore={<Icon aria-hidden render={<LockUnlockedIcon label="" size="small" />} />}
						>
							No restrictions
						</DropdownMenuItem>
						<DropdownMenuItem
							elemBefore={<Icon aria-hidden render={<EyeOpenIcon label="" size="small" />} />}
							elemAfter={<Badge>1</Badge>}
						>
							Watch
						</DropdownMenuItem>
						<DropdownMenuItem
							elemBefore={<Icon aria-hidden render={<ShareIcon label="" size="small" />} />}
						>
							Share
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			) : (
				<Button aria-label="Actions" size="icon" variant="outline">
					<ShowMoreHorizontalIcon label="" />
				</Button>
			)}
		</div>
	);
}
