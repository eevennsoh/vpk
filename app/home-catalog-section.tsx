"use client";

// oxlint-disable react-doctor/iframe-missing-sandbox -- These iframes render first-party internal preview routes; same-origin is required for Next dev assets and theme messaging.

import { useMemo, useState } from "react";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import {
	compareHomeCatalogEntriesByLastUpdated,
	compareHomeCatalogEntriesByName,
	resolveHomeCatalogEntries,
	type HomeCatalogListEntry,
} from "@/app/home-catalog-order";
import { HomeSectionHeading } from "@/app/home-section-heading";
import type { ComponentManifestEntry } from "@/app/data/component-manifest";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@/components/ui/empty";
import { WebsiteCard } from "@/components/website/website-card";

type HomeCatalogSortOption = "last-updated" | "name";

const HOME_CATALOG_SORT_LABELS: Record<HomeCatalogSortOption, string> = {
	"last-updated": "Last updated",
	name: "Name",
};

interface HomeCatalogSectionProps {
	id: string;
	title: string;
	/** The whole catalog; the heading count is always its length. */
	components: ReadonlyArray<ComponentManifestEntry>;
	/** The cards to render, with dates; defaults to every component. May be a subset of `components`. */
	componentEntries?: ReadonlyArray<HomeCatalogListEntry>;
	componentHrefPrefix: string;
	previewHrefPrefix: string;
	emptyStateTitle: string;
	emptyStateDescription: string;
}

export function HomeCatalogSection({
	id,
	title,
	components,
	componentEntries,
	componentHrefPrefix,
	previewHrefPrefix,
	emptyStateTitle,
	emptyStateDescription,
}: Readonly<HomeCatalogSectionProps>) {
	const [catalogSort, setCatalogSort] =
		useState<HomeCatalogSortOption>("last-updated");

	const sortedComponentEntries = useMemo(() => {
		return [
			...resolveHomeCatalogEntries(components, componentEntries),
		].sort(
			catalogSort === "name"
				? compareHomeCatalogEntriesByName
				: compareHomeCatalogEntriesByLastUpdated,
		);
	}, [catalogSort, componentEntries, components]);

	const sectionActions = sortedComponentEntries.length > 1 ? (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						variant="outline"
						size="default"
						className="w-fit gap-1.5"
					/>
				}
			>
				Sort: {HOME_CATALOG_SORT_LABELS[catalogSort]}
				<ChevronDownIcon label="" size="small" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuGroup>
					<DropdownMenuRadioGroup
						value={catalogSort}
						onValueChange={(value) => {
							setCatalogSort(value as HomeCatalogSortOption);
						}}
					>
						<DropdownMenuRadioItem value="last-updated">
							Last updated
						</DropdownMenuRadioItem>
						<DropdownMenuRadioItem value="name">
							Name
						</DropdownMenuRadioItem>
					</DropdownMenuRadioGroup>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	) : null;

	// A lone card (or the empty state) fills the viewport down to its bottom padding.
	const fillsViewport = sortedComponentEntries.length <= 1;

	return (
		<>
			<HomeSectionHeading
				id={id}
				title={title}
				count={components.length}
				actions={sectionActions}
			/>
			<ul
				className={
					fillsViewport
						? "m-0 flex flex-1 list-none flex-col p-0"
						: "grid grid-cols-1 list-none m-0 p-0"
				}
			>
				{sortedComponentEntries.length > 0 ? (
					sortedComponentEntries.map((component, index) => (
						<WebsiteCard
							key={component.slug}
							name={component.name}
							href={`${componentHrefPrefix}/${component.slug}`}
							fullWidth
							fillHeight={fillsViewport}
							deferOffscreen={index > 0}
						>
							<iframe
								src={`${previewHrefPrefix}/${component.slug}?embedded=1`}
								title={component.name}
								className="h-full w-full border-0"
								loading={index === 0 ? "eager" : "lazy"}
								sandbox="allow-same-origin allow-scripts"
							/>
						</WebsiteCard>
					))
				) : (
					<WebsiteCard name={`${title} coming soon`} fullWidth fillHeight>
						<div className="flex h-full items-center justify-center bg-bg-neutral p-8">
							<div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-border bg-surface">
								<Empty width="wide">
									<EmptyHeader>
										<EmptyTitle>{emptyStateTitle}</EmptyTitle>
										<EmptyDescription>
											{emptyStateDescription}
										</EmptyDescription>
									</EmptyHeader>
								</Empty>
							</div>
						</div>
					</WebsiteCard>
				)}
			</ul>
		</>
	);
}
