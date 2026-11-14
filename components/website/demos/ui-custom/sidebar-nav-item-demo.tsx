"use client";

import AddIcon from "@atlaskit/icon/core/add";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import ProjectIcon from "@atlaskit/icon/core/project";
import Image from "next/image";
import { SidebarNavItem, SidebarNavItemAction, SidebarNavItemCount } from "@/components/ui-custom/sidebar-nav-item";
import { Tile } from "@/components/ui/tile";

function DemoFrame({ children }: Readonly<{ children: React.ReactNode }>) {
	return <div className="flex w-[276px] justify-center">{children}</div>;
}

// Standardized leading avatar: the shared `Tile` snug variant renders a
// transparent 24x24 tile (the leading slot) holding 20x20 content. Declared as a
// wrapper so `SidebarNavItem`'s `normalizeIconNode` `cloneElement` injects its
// `label`/`size` here (and they're ignored) rather than clobbering the Tile.
function TileLeadingAvatar({ label = "" }: Readonly<{ label?: string; size?: "small" | "medium" }>) {
	return (
		<Tile aria-hidden label={label || "Agent"} variant="transparent" size="small" isSnug>
			<Image alt="" aria-hidden src="/avatar-agent-new/blue/release-notes.svg" width={24} height={24} />
		</Tile>
	);
}

function TileLeadingProjectAvatar() {
	return (
		<Tile aria-hidden label="" variant="transparent" size="small" isSnug>
			<Image alt="" aria-hidden className="rounded-md border border-border object-cover" src="/avatar-project/rocket.svg" width={20} height={20} />
		</Tile>
	);
}

function ChevronAction() {
	return (
		<SidebarNavItemAction
			aria-label="Open item details"
		>
			<ChevronRightIcon label="" />
		</SidebarNavItemAction>
	);
}

function AddAction() {
	return (
		<SidebarNavItemAction aria-label="Add child item">
			<AddIcon label="" />
		</SidebarNavItemAction>
	);
}

export default function SidebarNavItemDemo() {
	return (
		<div className="flex justify-center px-6 py-8">
			<div className="flex w-[276px] flex-col gap-4">
				<SidebarNavItemDemoDefault />
				<SidebarNavItemDemoTileLeading />
				<SidebarNavItemDemoExpanded />
				<SidebarNavItemDemoHovered />
				<SidebarNavItemDemoSelected />
				<SidebarNavItemDemoFocusVisible />
				<SidebarNavItemDemoWithCount />
				<SidebarNavItemDemoProjectCount />
				<SidebarNavItemDemoWithDescription />
				<SidebarNavItemDemoNestedLevels />
			</div>
		</div>
	);
}

export function SidebarNavItemDemoDefault() {
	return (
		<DemoFrame>
			<SidebarNavItem
				label="Label"
				leading={<ChevronRightIcon label="" />}
				leadingSize="small"
				actions={<ChevronAction />}
			/>
		</DemoFrame>
	);
}

export function SidebarNavItemDemoTileLeading() {
	return (
		<div className="flex w-[276px] flex-col gap-1">
			<SidebarNavItem
				label="RFP Drafter"
				leading={<TileLeadingAvatar />}
				leadingSize="medium"
			/>
			<SidebarNavItem
				label="Launch planning"
				leading={<TileLeadingProjectAvatar />}
				leadingSize="medium"
			/>
		</div>
	);
}

export function SidebarNavItemDemoExpanded() {
	return (
		<DemoFrame>
			<SidebarNavItem
				label="Label"
				leading={<ChevronDownIcon label="" />}
				leadingSize="small"
				isExpanded
				actions={
					<>
						<AddAction />
						<ChevronAction />
					</>
				}
			/>
		</DemoFrame>
	);
}

export function SidebarNavItemDemoHovered() {
	return (
		<DemoFrame>
			<SidebarNavItem
				label="Label"
				leading={<ChevronDownIcon label="" />}
				leadingSize="small"
				interactionState="hovered"
				isExpanded
				actions={
					<>
						<AddAction />
						<ChevronAction />
					</>
				}
			/>
		</DemoFrame>
	);
}

export function SidebarNavItemDemoSelected() {
	return (
		<DemoFrame>
			<SidebarNavItem
				label="Label"
				leading={<ChevronRightIcon label="" />}
				leadingSize="small"
				isSelected
				actions={<ChevronAction />}
			/>
		</DemoFrame>
	);
}

export function SidebarNavItemDemoFocusVisible() {
	return (
		<DemoFrame>
			<SidebarNavItem
				label="Label"
				leading={<ChevronRightIcon label="" />}
				leadingSize="small"
				interactionState="focus-visible"
				actions={<ChevronAction />}
			/>
		</DemoFrame>
	);
}

export function SidebarNavItemDemoWithCount() {
	return (
		<DemoFrame>
			<SidebarNavItem
				label="Label"
				leading={<ChevronRightIcon label="" />}
				leadingSize="small"
				meta={<SidebarNavItemCount>25</SidebarNavItemCount>}
				actions={<ChevronAction />}
			/>
		</DemoFrame>
	);
}

export function SidebarNavItemDemoProjectCount() {
	return (
		<DemoFrame>
			<SidebarNavItem
				label="Label"
				leading={<ProjectIcon label="" />}
				leadingSize="medium"
				meta={<SidebarNavItemCount>25</SidebarNavItemCount>}
				actions={<ChevronAction />}
			/>
		</DemoFrame>
	);
}

export function SidebarNavItemDemoWithDescription() {
	return (
		<DemoFrame>
			<SidebarNavItem
				label="Building a New App Concept"
				description="1 hour ago"
				actions={<ChevronAction />}
			/>
		</DemoFrame>
	);
}

export function SidebarNavItemDemoNestedLevels() {
	return (
		<div className="flex w-[276px] flex-col">
			<SidebarNavItem
				label="Apps"
				leading={<ChevronDownIcon label="" />}
				leadingSize="small"
				isExpanded
			/>
			<div className="flex flex-col pl-3">
				<SidebarNavItem
					label="Dependency Mapper"
					leading={<ProjectIcon label="" />}
					leadingSize="medium"
					isSelected
				/>
				<div className="flex flex-col pl-3">
					<SidebarNavItem
						label="Data sources"
						leading={<ChevronRightIcon label="" />}
						leadingSize="small"
					/>
				</div>
			</div>
		</div>
	);
}
