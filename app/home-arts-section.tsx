import { ART_COMPONENTS } from "@/app/data/component-manifest";
import type { HomeCatalogListEntry } from "@/app/home-catalog-order";
import { HomeCatalogSection } from "@/app/home-catalog-section";

interface HomeArtsSectionProps {
	artComponents?: ReadonlyArray<HomeCatalogListEntry>;
}

export function HomeArtsSection({
	artComponents,
}: Readonly<HomeArtsSectionProps>) {
	return (
		<HomeCatalogSection
			id="arts"
			title="Arts"
			components={ART_COMPONENTS}
			componentEntries={artComponents}
			componentHrefPrefix="/components/arts"
			previewHrefPrefix="/preview/arts"
			emptyStateTitle="No art pieces yet"
			emptyStateDescription="Add an art entry to start building out this showcase."
		/>
	);
}

export type ArtListEntry = HomeCatalogListEntry;
