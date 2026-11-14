"use client";

import type { ComponentProps, ReactNode } from "react";
import { SlackLogo } from "@/components/ui/logo-third-party";
import AppIcon from "@atlaskit/icon/core/app";
import AutomationIcon from "@atlaskit/icon/core/automation";
import CommentIcon from "@atlaskit/icon/core/comment";
import EditIcon from "@atlaskit/icon/core/edit";
import WorkItemIcon from "@atlaskit/icon/core/work-item";

import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tile } from "@/components/ui/tile";
import { cn } from "@/lib/utils";

export type AgentSurfaceStatus = "active" | "available" | "managed";

export interface AgentDefaultSurface {
	description: string;
	icon: ReactNode;
	id: string;
	label: string;
	status: AgentSurfaceStatus;
	switchLabel?: string;
}

export interface AgentExtendedSurface {
	actionLabel?: string;
	description: string;
	detail: ReactNode;
	icon: ReactNode;
	id: string;
	label: string;
	status: AgentSurfaceStatus;
}

// react-doctor-disable-next-line react-doctor/only-export-components -- This component module intentionally exports colocated non-component API used by consumers.
export const AGENT_DEFAULT_SURFACES: ReadonlyArray<AgentDefaultSurface> = [
	{
		description: "Talk to this agent in Rovo Chat across Atlassian apps.",
		icon: <CommentIcon label="" size="small" color="currentColor" />,
		id: "rovo-chat",
		label: "Rovo Chat",
		status: "active",
	},
	{
		description: "Get writing assistance in editor surfaces across Atlassian apps.",
		icon: <EditIcon label="" size="small" color="currentColor" />,
		id: "editor",
		label: "Editor",
		status: "active",
	},
	{
		description: "Use this agent in automation flows across Atlassian apps.",
		icon: <AutomationIcon label="" size="small" color="currentColor" />,
		id: "automation",
		label: "Automation",
		status: "active",
	},
	{
		description: "Collaborate with this agent on Jira work items.",
		icon: <WorkItemIcon label="" size="small" color="currentColor" />,
		id: "work-items",
		label: "Work items",
		status: "available",
		switchLabel: "Enable Work items surface",
	},
] as const;

// react-doctor-disable-next-line react-doctor/only-export-components -- This component module intentionally exports colocated non-component API used by consumers.
export const AGENT_EXTENDED_SURFACES: ReadonlyArray<AgentExtendedSurface> = [
	{
		description: "Use this agent from the Rovo browser extension.",
		detail: "Manage extension availability from Chrome when the extension is installed.",
		icon: <AppIcon label="" size="small" color="currentColor" />,
		id: "browser-extension",
		label: "Rovo browser extension",
		status: "managed",
	},
	{
		description: "Invite this agent into channels from Slack.",
		detail: (
			<>
				Use <code className="rounded-xs bg-surface-overlay px-1 py-0.5 text-text">/Rovo add</code> in Slack after the
				Rovo app is installed.
			</>
		),
		icon: <SlackLogo size="xsmall" label="" />,
		id: "slack",
		label: "Slack",
		status: "managed",
	},
	{
		actionLabel: "Add to portal",
		description: "Add this agent to a Jira Service Management portal.",
		detail: "Choose the portal, set the request context, and publish when the service team is ready.",
		icon: <AgentServiceManagementIcon />,
		id: "customer-portal",
		label: "Customer portal",
		status: "available",
	},
	{
		actionLabel: "Add to help center",
		description: "Add this agent to a Jira Service Management help center.",
		detail: "Connect the agent to help-center entry points and scope where people can discover it.",
		icon: <AgentServiceManagementIcon />,
		id: "help-center",
		label: "Help center",
		status: "available",
	},
] as const;

export type AgentSurfaceProps = ComponentProps<"div">;

function AgentServiceManagementIcon() {
	return (
		<Tile label="Jira Service Management" size="xsmall" variant="warning" isInset={false}>
			<AutomationIcon label="" size="small" color="currentColor" />
		</Tile>
	);
}

function AgentSurfaceStatusBadge({ status }: Readonly<{ status: AgentSurfaceStatus }>) {
	if (status === "active") {
		return <Badge variant="success">Active</Badge>;
	}

	if (status === "managed") {
		return <Badge variant="information">Managed elsewhere</Badge>;
	}

	return <Badge variant="neutral">Available</Badge>;
}

function AgentSurfaceIconFrame({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-icon-subtle">
			{children}
		</span>
	);
}

function AgentDefaultSurfaceRow({ surface }: Readonly<{ surface: AgentDefaultSurface }>) {
	return (
		<li className="grid min-h-16 gap-3 border-b border-border px-3 py-3 last:border-b-0 sm:grid-cols-[minmax(11rem,0.7fr)_minmax(0,1fr)_auto] sm:items-center">
			<div className="flex min-w-0 items-center gap-3">
				<AgentSurfaceIconFrame>{surface.icon}</AgentSurfaceIconFrame>
				<span className="min-w-0 truncate text-sm font-semibold text-text">{surface.label}</span>
			</div>
			<p className="min-w-0 text-sm leading-5 text-text-subtle">{surface.description}</p>
			{surface.switchLabel ? (
				<Switch defaultChecked={false} label={surface.switchLabel} size="default" />
			) : (
				<AgentSurfaceStatusBadge status={surface.status} />
			)}
		</li>
	);
}

function AgentExtendedSurfaceRow({ surface }: Readonly<{ surface: AgentExtendedSurface }>) {
	return (
		<AccordionItem className="border-b border-border last:border-b-0" value={surface.id}>
			<AccordionTrigger className="rounded-none border-0 px-3 py-3 hover:no-underline">
				<span className="grid flex-1 gap-3 text-left sm:grid-cols-[minmax(13rem,0.7fr)_minmax(0,1fr)_auto] sm:items-center">
					<span className="flex min-w-0 items-center gap-3">
						<AgentSurfaceIconFrame>{surface.icon}</AgentSurfaceIconFrame>
						<span className="min-w-0 truncate text-sm font-semibold text-text">{surface.label}</span>
					</span>
					<span className="min-w-0 text-sm font-normal leading-5 text-text-subtle">{surface.description}</span>
					<span className="flex items-center gap-2"><AgentSurfaceStatusBadge status={surface.status} /></span>
				</span>
			</AccordionTrigger>
			<AccordionContent className="px-3 pb-3">
				<div className="flex flex-col gap-3 rounded-md bg-surface-sunken px-3 py-2 text-sm leading-5 text-text-subtle sm:flex-row sm:items-center sm:justify-between">
					<span className="min-w-0">{surface.detail}</span>
					{surface.actionLabel ? (
						<Button type="button" size="compact" variant="outline" className="w-fit shrink-0">
							{surface.actionLabel}
						</Button>
					) : null}
				</div>
			</AccordionContent>
		</AccordionItem>
	);
}

export function AgentSurface({ className, ...props }: Readonly<AgentSurfaceProps>) {
	return (
		<div
			className={cn("flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto text-text", className)}
			data-agent-compact-section="surfaces"
			{...props}
		>
			<div className="flex flex-col gap-1">
				<p className="text-xs font-semibold text-text-subtlest">Surfaces</p>
				<p className="text-sm leading-5 text-text-subtle">
					Choose where this agent appears across Atlassian apps and connected channels.
				</p>
			</div>
			<section className="flex flex-col gap-2" aria-labelledby="agent-default-surfaces-heading">
				<div className="flex items-center justify-between gap-3">
					<h3 id="agent-default-surfaces-heading" className="text-sm font-semibold text-text">
						Default surfaces
					</h3>
					<Badge variant="success">3 active</Badge>
				</div>
				<ul className="overflow-hidden rounded-lg border border-border bg-surface">
					{AGENT_DEFAULT_SURFACES.map((surface) => (
						<AgentDefaultSurfaceRow key={surface.id} surface={surface} />
					))}
				</ul>
			</section>
			<section className="flex flex-col gap-2" aria-labelledby="agent-extended-surfaces-heading">
				<div className="flex items-center justify-between gap-3">
					<h3 id="agent-extended-surfaces-heading" className="text-sm font-semibold text-text">
						Extended surfaces
					</h3>
					<Badge variant="neutral">4 available</Badge>
				</div>
				<Accordion className="overflow-hidden rounded-lg border border-border bg-surface">
					{AGENT_EXTENDED_SURFACES.map((surface) => (
						<AgentExtendedSurfaceRow key={surface.id} surface={surface} />
					))}
				</Accordion>
			</section>
		</div>
	);
}
