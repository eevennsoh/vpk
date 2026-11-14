"use client";

import { token } from "@/lib/tokens";
import { Divider } from "../components/divider";
import { ADMIN_ICONS, ADMIN_NAV_SECTIONS } from "@/components/blocks/product-sidebar/data/admin-navigation";
import { useAdmin } from "@/components/blocks/product-sidebar/variants/admin-context";
import {
	AdminExpandableSection,
	AdminSidebarGroup,
	AdminSidebarRootLeaf,
} from "@/components/blocks/product-sidebar/variants/admin-sidebar-items";

export function AdminSidebar() {
	const { selectedItem, setSelectedItem } = useAdmin();

	return (
		<AdminSidebarGroup>
			<div className="mb-2 flex min-h-8 items-center gap-1 rounded-md px-2 py-1">
				<span
					className="flex size-6 shrink-0 items-center justify-center rounded-md bg-bg-neutral"
					aria-hidden="true"
				>
					<ADMIN_ICONS.officeBuilding label="" color={token("color.icon")} />
				</span>
				<span className="min-w-0 flex-1 truncate pl-0.5 text-sm font-medium text-text">
					Prosperify
				</span>
			</div>

			{ADMIN_NAV_SECTIONS.map((section) => {
				if (section.type === "leaf") {
					return (
						<AdminSidebarRootLeaf
							key={section.label}
							icon={section.icon}
							label={section.label}
							selectedItem={selectedItem}
							onSelectItem={setSelectedItem}
						/>
					);
				}

				return (
					<AdminExpandableSection
						key={section.label}
						section={section}
						selectedItem={selectedItem}
						onSelectItem={setSelectedItem}
					/>
				);
			})}

			<Divider />
		</AdminSidebarGroup>
	);
}
