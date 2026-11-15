"use client";

import AddIcon from "@atlaskit/icon/core/add";
import AiAgentIcon from "@atlaskit/icon/core/ai-agent";
import AngleBracketsIcon from "@atlaskit/icon/core/angle-brackets";
import BranchIcon from "@atlaskit/icon/core/branch";
import CommitIcon from "@atlaskit/icon/core/commit";
import DevicesIcon from "@atlaskit/icon/core/devices";
import LinkIcon from "@atlaskit/icon/core/link";
import MergeFailureIcon from "@atlaskit/icon/core/merge-failure";
import PullRequestIcon from "@atlaskit/icon/core/pull-request";
import SearchIcon from "@atlaskit/icon/core/search";
import SettingsIcon from "@atlaskit/icon/core/settings";
import StatusErrorIcon from "@atlaskit/icon/core/status-error";
import TaskIcon from "@atlaskit/icon/core/task";
import TaskToDoIcon from "@atlaskit/icon/core/task-to-do";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import RovoIcon from "@atlaskit/icon-lab/core/rovo";

import { OpenInMenu } from "@/components/blocks/jira-work-item/team-eu26/components/open-in-menu";
import { TeamEuRailPanel } from "@/components/blocks/jira-work-item/team-eu26/components/team-eu-rail-panel";
import { WorkItemAgentSelectorMenu } from "@/components/blocks/jira-work-item/team-eu26/components/work-item-agent-selector";
import { Button } from "@/components/ui/button";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Icon } from "@/components/ui/icon";
import { BitbucketIcon } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

const METRICS = [
	{
		label: "Branches",
		value: "1,000",
		icon: <BranchIcon label="" size="small" />,
	},
	{
		label: "Commits",
		value: "9,999+",
		icon: <CommitIcon label="" size="small" />,
	},
	{
		label: "Pull requests",
		value: "586",
		icon: <PullRequestIcon label="" size="small" />,
	},
	{ label: "Pipelines", value: "23", icon: <LinkIcon label="" size="small" /> },
] as const;

const PR_ROW_CLASS =
	"-mx-2 flex min-h-10 w-[calc(100%+1rem)] min-w-0 items-start gap-2 rounded-lg px-2 py-2 text-left text-sm text-text outline-none transition-colors duration-xxshort ease-out-practical hover:bg-bg-neutral-subtle-hovered focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none";

function PullRequestHoverContent() {
	return (
		<div className="flex w-[25rem] max-w-[calc(100vw-2rem)] flex-col gap-3">
			<div className="flex min-w-0 items-center gap-2 px-2 py-1">
				<Icon
					aria-hidden
					className="text-icon-danger"
					render={<MergeFailureIcon label="" size="small" />}
				/>
				<code className="shrink-0 text-xs text-text-subtlest">#345</code>
				<strong className="min-w-0 flex-1 truncate text-sm font-medium">
					feat/dev-panel-empty-state-entry-points
				</strong>
				<BitbucketIcon appearance="brand" label="Bitbucket" size="xsmall" />
			</div>
			<div className="grid grid-cols-[1.5rem_4.5rem_minmax(0,1fr)] items-center gap-y-0.5 px-2 text-xs text-text">
				<DevicesIcon label="" size="small" />
				<span className="text-text-subtlest">Device</span>
				<span>Annie&apos;s MacBook</span>
				<StatusErrorIcon label="" size="small" />
				<span className="text-text-subtlest">Builds</span>
				<span>2 failed · 4 passing</span>
				<TaskIcon label="" size="small" />
				<span className="text-text-subtlest">Reviews</span>
				<span>0/2 approved</span>
				<AngleBracketsIcon label="" size="small" />
				<span className="text-text-subtlest">Changes</span>
				<span>
					<code className="text-text-success">+214</code>{" "}
					<code className="text-text-danger">−36</code>
				</span>
				<RovoIcon label="" size="small" />
				<span className="self-start text-text-subtlest">Confidence</span>
				<span>
					72 (medium) – tests mostly passing; no approvals; moderate change size
				</span>
			</div>
			<div className="flex items-center justify-between px-2 text-xs font-medium text-text-subtlest">
				<span>Timeline</span>
				<ChevronRightIcon label="" size="small" />
			</div>
			<div className="flex items-center gap-2 px-2 text-xs">
				<TaskToDoIcon label="" size="small" />
				<strong className="font-medium">Deployed to production</strong>
				<span className="text-text-subtlest">Just now</span>
			</div>
			<Button
				className="self-center"
				disabled
				size="compact"
				type="button"
				variant="ghost"
			>
				Show more
			</Button>
			<div className="flex items-center gap-1 px-2">
				<Button disabled size="compact" type="button" variant="outline">
					Fix build
				</Button>
				<Button disabled size="compact" type="button" variant="ghost">
					Open build
				</Button>
				<Button disabled size="compact" type="button" variant="ghost">
					View pull request
				</Button>
			</div>
		</div>
	);
}

function PullRequestRow({
	detail,
	tone,
	hoverCard = false,
}: Readonly<{
	detail?: string;
	tone: "danger" | "success" | "neutral" | "information" | "discovery";
	hoverCard?: boolean;
}>) {
	const content = (
		<>
			<Icon
				aria-hidden
				className={cn(
					"mt-0.5 shrink-0",
					tone === "danger" && "text-icon-danger",
					tone === "success" && "text-icon-success",
					tone === "neutral" && "text-icon-subtle",
					tone === "information" && "text-icon-information",
					tone === "discovery" && "text-icon-discovery",
				)}
				render={<PullRequestIcon label="" size="small" />}
			/>
			<span className="min-w-0 flex-1">
				<span className="block truncate">
					<code className="text-xs">#345</code> {"{pull request name}"}
				</span>
				{detail ? (
					<span className="block truncate text-xs text-text-subtle">
						{detail}
					</span>
				) : null}
			</span>
		</>
	);
	return hoverCard ? (
		<HoverCard closeDelay={120} openDelay={0}>
			<HoverCardTrigger
				render={
					<button className={PR_ROW_CLASS} type="button">
						{content}
					</button>
				}
			/>
			<HoverCardContent
				align="start"
				className="w-auto p-2 shadow-2xl"
				positionerClassName="z-[503]"
				side="left"
				sideOffset={4}
			>
				<PullRequestHoverContent />
			</HoverCardContent>
		</HoverCard>
	) : (
		<div className={PR_ROW_CLASS}>{content}</div>
	);
}

const EMPTY_DEVELOPMENT_HEADER_ACTIONS = (
	<>
		<Button
			aria-label="Search development"
			disabled
			size="icon-compact"
			type="button"
			variant="ghost"
		>
			<SearchIcon label="" size="small" />
		</Button>
		<Button
			aria-label="Development settings"
			disabled
			size="icon-compact"
			type="button"
			variant="ghost"
		>
			<SettingsIcon label="" size="small" />
		</Button>
	</>
);

const EMPTY_DEVELOPMENT_ACTION_CLASS =
	"inline-flex h-8 min-w-0 items-center gap-2 rounded-md px-1 text-sm text-text outline-none transition-colors duration-xxshort ease-out-practical hover:bg-bg-neutral-subtle-hovered focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none";

function EmptyDevelopmentBody() {
	return (
		<div className="flex flex-wrap items-center gap-4 px-4 pb-4">
			<WorkItemAgentSelectorMenu
				align="start"
				trigger={(
					<button className={EMPTY_DEVELOPMENT_ACTION_CLASS} type="button">
						<Icon aria-hidden className="shrink-0 text-icon-subtle" render={<AiAgentIcon label="" size="small" />} />
						Start with agent
					</button>
				)}
			/>
			<OpenInMenu
				align="start"
				trigger={(
					<button className={EMPTY_DEVELOPMENT_ACTION_CLASS} type="button">
						<Icon aria-hidden className="shrink-0 text-icon-subtle" render={<DevicesIcon label="" size="small" />} />
						Start local session
					</button>
				)}
			/>
		</div>
	);
}

const DEVELOPMENT_HEADER_ACTIONS = (
	<>
		<Button
			aria-label="Add development item"
			disabled
			size="icon-compact"
			type="button"
			variant="ghost"
		>
			<AddIcon label="" size="small" />
		</Button>
		<Button
			aria-label="Development settings"
			disabled
			size="icon-compact"
			type="button"
			variant="ghost"
		>
			<SettingsIcon label="" size="small" />
		</Button>
	</>
);

export function TeamEuDevelopmentPanel({
	empty = false,
}: Readonly<{ empty?: boolean }>) {
	return (
		<TeamEuRailPanel
			defaultOpen
			headerActions={empty ? EMPTY_DEVELOPMENT_HEADER_ACTIONS : DEVELOPMENT_HEADER_ACTIONS}
			title="Development"
		>
			{empty ? <EmptyDevelopmentBody /> : (
			<div className="px-4 pb-4">
				<div
					aria-label="Development totals"
					className="mb-4 grid h-8 grid-cols-4 gap-0.5 overflow-hidden rounded-lg"
					role="group"
				>
					{METRICS.map((metric) => (
						<div
							className="flex min-w-0 items-center justify-center gap-1 bg-surface-sunken px-1 text-text-subtle"
							key={metric.label}
						>
							<Icon aria-hidden className="shrink-0" render={metric.icon} />
							<code className="truncate text-xs">{metric.value}</code>
							<span className="sr-only">{metric.label}</span>
						</div>
					))}
				</div>
				<div>
					<h3 className="mb-1.5 text-xs text-text-subtle">Needs attention</h3>
					<PullRequestRow
						detail="Merge blocked by failing CI"
						hoverCard
						tone="danger"
					/>
					<PullRequestRow
						detail="Unresolved comments need replies"
						tone="success"
					/>
				</div>
				<div className="mt-4">
					<h3 className="mb-1.5 text-xs text-text-subtle">Ongoing work</h3>
					<PullRequestRow tone="neutral" />
					<PullRequestRow tone="information" />
					<PullRequestRow tone="discovery" />
				</div>
			</div>
			)}
		</TeamEuRailPanel>
	);
}
