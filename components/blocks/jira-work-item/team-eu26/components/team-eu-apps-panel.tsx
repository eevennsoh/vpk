"use client";

import { useState, type ReactNode } from "react";
import AppIcon from "@atlaskit/icon/core/app";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";

import { TeamEuRailPanel } from "@/components/blocks/jira-work-item/team-eu26/components/team-eu-rail-panel";
import { Icon } from "@/components/ui/icon";
import {
	PagerdutyLogo,
	SentryLogo,
	TempoTimesheetsLogo,
} from "@/components/ui/logo-third-party";
import { cn } from "@/lib/utils";

const APPS: readonly { body: string; icon: ReactNode; logo?: boolean; title: string }[] = [
	{
		body: "Content here...",
		icon: <AppIcon label="" size="small" />,
		title: "My Reminders",
	},
	{
		body: "More content...",
		icon: <TempoTimesheetsLogo borderless label="" size="xxsmall" />,
		logo: true,
		title: "Tempo",
	},
	{
		body: "More content...",
		icon: <PagerdutyLogo borderless label="" size="xxsmall" />,
		logo: true,
		title: "PagerDuty",
	},
	{
		body: "More content...",
		icon: <SentryLogo borderless label="" size="xxsmall" />,
		logo: true,
		title: "Sentry",
	},
	{
		body: "More content...",
		icon: <AppIcon label="" size="small" />,
		title: "Checklist",
	},
	{
		body: "More content...",
		icon: <AppIcon label="" size="small" />,
		title: "Invision for Jira",
	},
	{
		body: "More content...",
		icon: <AppIcon label="" size="small" />,
		title: "Trello Assistant",
	},
];

function AppRow({ app, body }: Readonly<{ app: (typeof APPS)[number]; body?: string }>) {
	const [open, setOpen] = useState(false);
	return (
		<li>
			<button
				aria-expanded={open}
				className="flex h-8 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-sm text-text outline-none transition-colors duration-xxshort ease-out-practical hover:bg-bg-neutral-subtle-hovered focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
				onClick={() => setOpen((current) => !current)}
				type="button"
			>
				<span aria-hidden className={cn("grid size-4 shrink-0 place-items-center text-icon-subtle [&_path]:fill-current! [&_span]:filter-none!", app.logo ? "[&_svg]:size-4!" : "[&_svg]:size-3!")}>
					{app.icon}
				</span>
				<span className="min-w-0 flex-1 truncate">{app.title}</span>
				<Icon
					aria-hidden
					className={cn(
						"shrink-0 text-icon-subtle transition-transform duration-normal ease-out-practical motion-reduce:transition-none",
						open ? undefined : "-rotate-90",
					)}
					render={<ChevronDownIcon label="" size="small" />}
				/>
			</button>
			{open ? (
				<div className="px-8 pb-3 text-sm text-text-subtle">{body ?? app.body}</div>
			) : null}
		</li>
	);
}

export function TeamEuAppsList({ className, renderBody }: Readonly<{ className?: string; renderBody?: (title: string) => string }>) {
	return (
		<ul aria-label="Connected apps" className={cn("px-2 pb-2", className)}>
			{APPS.map((app) => (
				<AppRow app={app} body={renderBody?.(app.title)} key={app.title} />
			))}
		</ul>
	);
}

export function TeamEuAppsPanel() {
	return (
		<TeamEuRailPanel title="Apps">
			<TeamEuAppsList />
		</TeamEuRailPanel>
	);
}
