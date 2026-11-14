"use client";

import { token } from "@/lib/tokens";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Lozenge } from "@/components/ui/lozenge";
import { ADMIN_ICONS } from "@/components/blocks/product-sidebar/data/admin-navigation";
import { ADMIN_PROJECTS } from "../data/admin-data";
import { AdminCard, AdminPageShell, AdminViewHeader } from "./view-primitives";

export function ProjectsView() {
	return (
		<AdminPageShell>
			<AdminViewHeader
				title="Projects"
				action={
					<Button>
						<ADMIN_ICONS.add label="" color={token("color.icon.inverse")} />
						Create project
					</Button>
				}
			/>

			<div className="flex flex-col gap-4">
				{ADMIN_PROJECTS.map((project) => (
					<AdminCard key={project.name}>
						<CardContent className="flex flex-col gap-3">
							<div className="flex items-center justify-between gap-3">
								<h2 className="min-w-0 truncate text-text" style={{ font: token("font.heading.small") }}>
									{project.name}
								</h2>
								<Lozenge variant={project.variant}>{project.status}</Lozenge>
							</div>
							<p className="text-sm text-text-subtlest">{project.description}</p>
						</CardContent>
					</AdminCard>
				))}
			</div>
		</AdminPageShell>
	);
}
