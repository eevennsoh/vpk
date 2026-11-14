"use client";

import { token } from "@/lib/tokens";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { ADMIN_ICONS } from "@/components/blocks/product-sidebar/data/admin-navigation";
import { ADMIN_SPACES } from "../data/admin-data";
import { AdminCard, AdminPageShell, AdminViewHeader } from "./view-primitives";

export function SpacesView() {
	return (
		<AdminPageShell>
			<AdminViewHeader
				title="Spaces"
				action={
					<Button>
						<ADMIN_ICONS.add label="" color={token("color.icon.inverse")} />
						Create space
					</Button>
				}
			/>

			<div className="grid gap-4 lg:grid-cols-2">
				{ADMIN_SPACES.map((space) => (
					<AdminCard key={space.name}>
						<CardContent className="flex flex-col gap-2">
							<div>
								<h2 className="text-text" style={{ font: token("font.heading.small") }}>
									{space.name}
								</h2>
								<p className="mt-1 text-xs text-text-subtlest">{space.type}</p>
							</div>
							<p className="text-sm text-text-subtle">{space.description}</p>
							<div className="flex items-center gap-1 text-xs text-text-subtlest">
								<ADMIN_ICONS.person label="" color={token("color.icon.subtle")} size="small" />
								<span>{space.members} members</span>
							</div>
						</CardContent>
					</AdminCard>
				))}
			</div>
		</AdminPageShell>
	);
}
