"use client";

import type { ComponentProps, ReactNode } from "react";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Lozenge } from "@/components/ui/lozenge";
import { ADMIN_ICONS, type AdminIconComponent } from "@/components/blocks/product-sidebar/data/admin-navigation";
import {
	ADMIN_DISCOVER_CARDS,
	ADMIN_QUICK_ACTIONS,
} from "../data/admin-data";
import {
	AdminAreaChart,
	AdminBarChart,
	AdminLineChart,
} from "./dashboard-charts";
import {
	AdminCard,
	AdminCardHeader,
	AdminPageShell,
	AdminSectionHeading,
	AdminViewHeader,
} from "./view-primitives";

interface MonitorCardProps {
	title: string;
	value: string;
	description?: string;
	change?: {
		label: string;
		variant: ComponentProps<typeof Lozenge>["variant"];
	};
	children: ReactNode;
}

export function DashboardView() {
	return (
		<AdminPageShell>
			<AdminViewHeader title="Overview" />

			<section className="flex flex-col gap-3">
				<AdminSectionHeading>Quick actions</AdminSectionHeading>
				<div className="grid gap-3 sm:grid-cols-3">
					{ADMIN_QUICK_ACTIONS.map(({ icon: Icon, label }) => (
						<Button key={label} variant="outline" className="w-full justify-center">
							<Icon label="" color={token("color.icon")} />
							{label}
						</Button>
					))}
				</div>
			</section>

			<section className="flex flex-col gap-3">
				<AdminSectionHeading>Monitor</AdminSectionHeading>
				<div className="grid gap-4 xl:grid-cols-3">
					<MonitorCard title="Rovo credit usage" value="1,100" description="used in the last 7 days">
						<AdminLineChart />
					</MonitorCard>
					<MonitorCard
						title="Active users"
						value="14,539"
						change={{ label: "+8% quarter to date", variant: "success" }}
					>
						<AdminAreaChart />
					</MonitorCard>
					<MonitorCard
						title="Requests for app access"
						value="400"
						change={{ label: "-4% this week", variant: "danger" }}
					>
						<AdminBarChart />
					</MonitorCard>
				</div>
			</section>

			<section className="flex flex-col gap-3">
				<AdminSectionHeading>Discover</AdminSectionHeading>
				<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
					{ADMIN_DISCOVER_CARDS.map((card) => (
						<DiscoverCard key={card.title} {...card} />
					))}
				</div>
			</section>
		</AdminPageShell>
	);
}

function MonitorCard({
	title,
	value,
	description,
	change,
	children,
}: Readonly<MonitorCardProps>) {
	return (
		<AdminCard className="min-h-[352px]">
			<AdminCardHeader
				title={title}
				action={
					<Button aria-label={`More options for ${title}`} size="icon" variant="ghost">
						<ADMIN_ICONS.showMoreHorizontal label="" color={token("color.icon.subtle")} />
					</Button>
				}
			/>
			<CardContent className="flex flex-col">
				<div className="flex items-center gap-2">
					<span className="text-text" style={{ font: token("font.heading.xlarge") }}>
						{value}
					</span>
					{change ? <Lozenge variant={change.variant}>{change.label}</Lozenge> : null}
				</div>
				{description ? <span className="text-xs text-text-subtle">{description}</span> : null}
				<div className="mt-4 h-52 min-w-0 overflow-hidden p-1">{children}</div>
			</CardContent>
		</AdminCard>
	);
}

function DiscoverCard({
	accentClassName,
	description,
	icon: Icon,
	title,
}: Readonly<{
	accentClassName: string;
	description: string;
	icon: AdminIconComponent;
	title: string;
}>) {
	return (
		<AdminCard className="transition-colors hover:bg-surface-raised-hovered">
			<CardContent className="flex flex-col gap-4">
				<div className="flex items-center justify-between">
					<span className={cn("flex size-10 items-center justify-center rounded-lg", accentClassName)}>
						<Icon label="" />
					</span>
					<ADMIN_ICONS.arrowUpRight label="" color={token("color.icon.subtle")} />
				</div>
				<div className="flex flex-col gap-2">
					<h3 className="text-text" style={{ font: token("font.heading.xsmall") }}>
						{title}
					</h3>
					<p className="text-sm text-text-subtle">{description}</p>
				</div>
			</CardContent>
		</AdminCard>
	);
}
