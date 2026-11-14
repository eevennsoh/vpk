"use client";

import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Lozenge } from "@/components/ui/lozenge";
import { Progress } from "@/components/ui/progress";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { ADMIN_ICONS } from "@/components/blocks/product-sidebar/data/admin-navigation";
import { ADMIN_INVOICES } from "../data/admin-data";
import {
	AdminCard,
	AdminCardHeader,
	AdminPageShell,
	AdminSectionHeading,
	AdminViewHeader,
} from "./view-primitives";

const SUBSCRIPTION_DETAILS = [
	["Plan", "Team Plan"],
	["Users", "25"],
	["Price", "$150/month"],
	["Renewal date", "Jan 24, 2025"],
] as const;

const USAGE_DETAILS = [
	{ label: "Active users", value: 18, max: 25, display: "18 / 25 (72%)" },
	{ label: "Storage", value: 47, max: 100, display: "47 GB / 100 GB (47%)" },
	{ label: "API calls", value: 2.4, max: 10, display: "2.4M / 10M (24%)" },
] as const;

export function BillingView() {
	return (
		<AdminPageShell>
			<AdminViewHeader title="Billing" action={<Button>Upgrade plan</Button>} />

			<AdminCard>
				<AdminCardHeader title="Current subscription" action={<Lozenge variant="success">Active</Lozenge>} />
				<CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
					{SUBSCRIPTION_DETAILS.map(([label, value]) => (
						<div key={label} className="flex flex-col gap-1">
							<span className="text-xs text-text-subtlest">{label}</span>
							<span className="text-sm font-semibold text-text">{value}</span>
						</div>
					))}
				</CardContent>
			</AdminCard>

			<AdminCard>
				<AdminCardHeader title="Current usage" />
				<CardContent className="flex flex-col gap-4">
					{USAGE_DETAILS.map((item) => (
						<UsageBar key={item.label} {...item} />
					))}
				</CardContent>
			</AdminCard>

			<AdminCard>
				<AdminCardHeader title="Billing history" />
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Date</TableHead>
								<TableHead>Description</TableHead>
								<TableHead>Amount</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{ADMIN_INVOICES.map((invoice) => (
								<TableRow key={`${invoice.date}-${invoice.description}`}>
									<TableCell>{invoice.date}</TableCell>
									<TableCell>{invoice.description}</TableCell>
									<TableCell className="font-medium">{invoice.amount}</TableCell>
									<TableCell>
										<Lozenge variant="success">{invoice.status}</Lozenge>
									</TableCell>
									<TableCell>
										<Button size="default" variant="ghost">
											<ADMIN_ICONS.download label="" />
											Download
										</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</AdminCard>

			<AdminCard>
				<CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex flex-col gap-1">
						<AdminSectionHeading>Payment method</AdminSectionHeading>
						<span className="text-sm text-text-subtlest">
							Visa ending in 4242. Expires 12/2026
						</span>
					</div>
					<Button variant="outline">Update</Button>
				</CardContent>
			</AdminCard>
		</AdminPageShell>
	);
}

function UsageBar({
	label,
	value,
	max,
	display,
}: Readonly<{
	label: string;
	value: number;
	max: number;
	display: string;
}>) {
	const percentage = Math.round((value / max) * 100);

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center justify-between gap-3 text-sm">
				<span className="text-text">{label}</span>
				<span className="text-text-subtlest">{display}</span>
			</div>
			<Progress value={percentage} variant="success" aria-label={label} />
		</div>
	);
}
