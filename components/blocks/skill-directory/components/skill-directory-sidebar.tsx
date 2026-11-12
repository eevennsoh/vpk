"use client";

// oxlint-disable react-doctor/jsx-no-jsx-as-prop -- These components intentionally use slot/render-node props for icons, triggers, and adornments.

import Image from "next/image";
import AlignTextLeftIcon from "@atlaskit/icon/core/align-text-left";
import AngleBracketsIcon from "@atlaskit/icon/core/angle-brackets";
import BranchIcon from "@atlaskit/icon/core/branch";
import ChartTrendUpIcon from "@atlaskit/icon/core/chart-trend-up";
import EditIcon from "@atlaskit/icon/core/edit";
import PeopleGroupIcon from "@atlaskit/icon/core/people-group";
import SettingsIcon from "@atlaskit/icon/core/settings";
import ShieldIcon from "@atlaskit/icon/core/shield";
import SupportIcon from "@atlaskit/icon/core/support";
import TimelineIcon from "@atlaskit/icon/core/timeline";
import CartIcon from "@atlaskit/icon-lab/core/cart";
import { useState, type ReactElement } from "react";

import { AtlassianLogo } from "@/components/ui/logo";
import { LogoThirdParty } from "@/components/ui/logo-third-party";
import { Tile } from "@/components/ui/tile";
import { SidebarNavItem } from "@/components/ui-custom/sidebar-nav-item";
import { useHasVerticalOverflow } from "@/components/hooks/use-has-vertical-overflow";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import {
	getSkillById,
	getSkillIcon,
	type SkillDirectorySkill,
} from "@/app/data/directory/skills";
import type {
	SkillDirectoryCategoryItem,
	SkillNavIcon,
	SkillDirectoryCompanyItem,
	SkillDirectoryPrimaryItem,
	SkillDirectorySidebarGroup,
	SkillDirectorySidebarItem,
} from "../data/sidebar-groups";

const MAX_VISIBLE_TAXONOMY_ITEMS = 5;

function getCategoryNavIcon(icon: SkillNavIcon, label: string): ReactElement {
	switch (icon) {
		case "settings":
			return <SettingsIcon label={label} size="small" color="currentColor" />;
		case "edit":
			return <EditIcon label={label} size="small" color="currentColor" />;
		case "chart-trend-up":
			return <ChartTrendUpIcon label={label} size="small" color="currentColor" />;
		case "angle-brackets":
			return <AngleBracketsIcon label={label} size="small" color="currentColor" />;
		case "support":
			return <SupportIcon label={label} size="small" color="currentColor" />;
		case "branch":
			return <BranchIcon label={label} size="small" color="currentColor" />;
		case "shield":
			return <ShieldIcon label={label} size="small" color="currentColor" />;
		case "people-group":
			return <PeopleGroupIcon label={label} size="small" color="currentColor" />;
		case "cart":
			return <CartIcon label={label} size="small" color="currentColor" />;
		case "timeline":
		default:
			return <TimelineIcon label={label} size="small" color="currentColor" />;
	}
}

function TileLeading({ children }: Readonly<{ children: ReactElement }>) {
	return (
		<Tile aria-hidden className="shrink-0 text-icon-subtle" label="" size="small" variant="neutral">
			{children}
		</Tile>
	);
}

function LogoLeading({ item }: Readonly<{ item: SkillDirectoryCompanyItem }>) {
	// 3P brands render as the self-framing package mark (its own bordered tile).
	if (item.brandName) {
		return <LogoThirdParty className="shrink-0" label={item.label} name={item.brandName} size="small" />;
	}

	const logo = item.logoName ? (
		<AtlassianLogo name={item.logoName} size="small" themeAware label={item.label} />
	) : item.logoSrc ? (
		<Image alt="" aria-hidden className="size-full object-contain" height={24} src={item.logoSrc} width={24} />
	) : null;

	if (!logo) {
		return null;
	}

	// Bare marks (no built-in tile/background) get a bordered VPK tile; logos
	// that already ship their own tile render as a plain image.
	if (item.needsTile) {
		return (
			<Tile aria-hidden className="shrink-0" hasBorder label={item.label} size="small" variant="transparent">
				{logo}
			</Tile>
		);
	}

	return <span className="inline-flex size-6 shrink-0 items-center justify-center">{logo}</span>;
}

export interface SkillDirectorySidebarProps {
	activeItem: string;
	groups: readonly SkillDirectorySidebarGroup[];
	onSelectItem: (id: string) => void;
	primaryItems: readonly SkillDirectoryPrimaryItem[];
	skills: readonly SkillDirectorySkill[];
}

export function SkillDirectorySidebar({
	activeItem,
	groups,
	onSelectItem,
	primaryItems,
	skills,
}: Readonly<SkillDirectorySidebarProps>) {
	const taxonomyGroup = groups.find(isTaxonomySidebarGroup);
	const secondaryGroups = groups.filter((group) => group !== taxonomyGroup);
	const sidebarOverflow = useHasVerticalOverflow<HTMLElement>();

	return (
		<nav
			aria-label="Skill categories"
			className={cn(
				"hidden min-h-0 w-[280px] shrink-0 flex-col overflow-y-auto pl-6 md:flex",
				sidebarOverflow.showTopScrollMask && "scroll-mask-top overscroll-contain",
			)}
			ref={sidebarOverflow.ref}
		>
			<ul className="flex w-64 flex-col">
				{primaryItems.map((item) => (
					<li key={item.id}>
						<SidebarNavItem
							label={item.label}
							isSelected={activeItem === item.id}
							onClick={() => onSelectItem(item.id)}
						/>
					</li>
				))}
			</ul>

			{taxonomyGroup ? (
				<SkillsTaxonomyGroup
					activeItem={activeItem}
					group={taxonomyGroup}
					onSelectItem={onSelectItem}
				/>
			) : null}

			{secondaryGroups.length > 0 ? (
				<div className="mt-5 flex w-64 flex-col gap-5 pb-6">
					{secondaryGroups.map((group) => (
						<SkillsSidebarGroup
							key={group.title}
							activeItem={activeItem}
							group={group}
							onSelectItem={onSelectItem}
							skills={skills}
						/>
					))}
				</div>
			) : null}
		</nav>
	);
}

function isCategorySidebarItem(item: SkillDirectorySidebarItem): item is SkillDirectoryCategoryItem {
	return item.kind === "category";
}

function isTaxonomySidebarItem(item: SkillDirectorySidebarItem): item is SkillDirectoryCategoryItem {
	return isCategorySidebarItem(item);
}

function isTaxonomySidebarGroup(group: SkillDirectorySidebarGroup): boolean {
	return group.items.some(isTaxonomySidebarItem);
}

interface SkillsTaxonomyGroupProps {
	activeItem: string;
	group: SkillDirectorySidebarGroup;
	onSelectItem: (id: string) => void;
}

function SkillsTaxonomyGroup({
	activeItem,
	group,
	onSelectItem,
}: Readonly<SkillsTaxonomyGroupProps>) {
	const [showAllTaxonomyItems, setShowAllTaxonomyItems] = useState(false);
	const taxonomyItems = group.items.filter(isTaxonomySidebarItem);
	const visibleTaxonomyItems = showAllTaxonomyItems
		? taxonomyItems
		: taxonomyItems.slice(0, MAX_VISIBLE_TAXONOMY_ITEMS);
	const hasHiddenTaxonomyItems = !showAllTaxonomyItems && taxonomyItems.length > MAX_VISIBLE_TAXONOMY_ITEMS;

	if (visibleTaxonomyItems.length === 0) return null;

	return (
		<>
			<div className="w-64 py-2 pl-1.5">
				<p className="text-text-subtlest" style={{ font: token("font.heading.xxsmall") }}>
					{group.title}
				</p>
			</div>
			<ul className="flex w-64 flex-col">
				{visibleTaxonomyItems.map((item) => (
					<li key={`${item.kind}-${item.id}`}>
						<SidebarNavItem
							isSelected={activeItem === item.id}
							label={item.label}
							leading={<TaxonomyLeading item={item} />}
							leadingSize="medium"
							onClick={() => onSelectItem(item.id)}
						/>
					</li>
				))}
				{hasHiddenTaxonomyItems ? (
					<li>
						<SidebarNavItem
							label="Show all"
							leading={<AlignTextLeftIcon label="" size="small" />}
							leadingSize="medium"
							onClick={() => setShowAllTaxonomyItems(true)}
						/>
					</li>
				) : null}
			</ul>
		</>
	);
}

function TaxonomyLeading({
	item,
}: Readonly<{ item: SkillDirectoryCategoryItem }>) {
	return getCategoryNavIcon(item.icon, item.label);
}

interface SkillsSidebarGroupProps {
	activeItem: string;
	group: SkillDirectorySidebarGroup;
	onSelectItem: (id: string) => void;
	skills: readonly SkillDirectorySkill[];
}

function SkillsSidebarGroup({
	activeItem,
	group,
	onSelectItem,
	skills,
}: Readonly<SkillsSidebarGroupProps>) {
	if (group.items.length === 0) return null;

	return (
		<div className="flex flex-col gap-1.5">
			<p className="px-1.5 text-text-subtlest" style={{ font: token("font.heading.xxsmall") }}>
				{group.title}
			</p>
			<ul className="flex flex-col">
				{group.items.map((item) => {
					if (item.kind === "skill") {
						const skill = getSkillById(skills, item.id);
						if (!skill) return null;
						return (
							<li key={`skill-${item.id}`}>
								<SidebarNavItem
									label={skill.name}
									leading={<TileLeading>{getSkillIcon(skill.icon)}</TileLeading>}
									leadingSize="medium"
									isSelected={activeItem === item.id}
									onClick={() => onSelectItem(item.id)}
								/>
							</li>
						);
					}

					if (item.kind === "category") return null;

					return (
						<li key={`company-${item.id}`}>
							<SidebarNavItem
								label={item.label}
								leading={<LogoLeading item={item} />}
								leadingSize="medium"
								isSelected={activeItem === item.id}
								onClick={() => onSelectItem(item.id)}
							/>
						</li>
					);
				})}
				{group.showAll ? (
					<li>
						<SidebarNavItem
							label="Show all"
							leading={<AlignTextLeftIcon label="" size="small" />}
							leadingSize="medium"
							onClick={() => onSelectItem("all-skills")}
						/>
					</li>
				) : null}
			</ul>
		</div>
	);
}
