"use client";

import { token } from "@/lib/tokens";
import { Button } from "@/components/ui/button";
import { ADMIN_ICONS } from "@/components/blocks/product-sidebar/data/admin-navigation";
import { ADMIN_USER_METRICS } from "../data/admin-data";
import {
	AdminMetricCard,
	AdminPageShell,
	AdminViewHeader,
} from "./view-primitives";

export function UsersView() {
	return (
		<AdminPageShell>
			<AdminViewHeader
				title="Users"
				description="Manage users in your organization. You can invite new users, update their roles, and control access to products."
				action={
					<>
						<Button>
							<ADMIN_ICONS.personAdd label="" color={token("color.icon.inverse")} />
							Invite users
						</Button>
						<Button aria-label="More user actions" size="icon" variant="ghost">
							<ADMIN_ICONS.showMoreHorizontal label="" color={token("color.icon.subtle")} />
						</Button>
					</>
				}
			/>

			<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				{ADMIN_USER_METRICS.map((metric) => (
					<AdminMetricCard
						key={metric.label}
						label={metric.label}
						value={metric.value}
					/>
				))}
			</div>
		</AdminPageShell>
	);
}
