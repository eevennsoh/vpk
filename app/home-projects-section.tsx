import { PROJECT_COMPONENTS } from "@/app/data/component-manifest";
import {
	resolveHomeCatalogEntries,
	selectLatestHomeCatalogEntries,
	type HomeCatalogListEntry,
} from "@/app/home-catalog-order";
import { HomeCatalogSection } from "@/app/home-catalog-section";

/**
 * Each project card is a live iframe of a whole prototype, so the Projects view mounts only the
 * most recently updated one. The sidebar's Projects list links every project; the heading count
 * still reports the full catalog.
 */
const HOME_LIVE_PROJECT_LIMIT = 1;

interface HomeProjectsSectionProps {
	projectComponents?: ReadonlyArray<HomeCatalogListEntry>;
}

export function HomeProjectsSection({
	projectComponents,
}: Readonly<HomeProjectsSectionProps>) {
	const liveProjects = selectLatestHomeCatalogEntries(
		resolveHomeCatalogEntries(PROJECT_COMPONENTS, projectComponents),
		HOME_LIVE_PROJECT_LIMIT,
	);

	return (
		<HomeCatalogSection
			id="projects"
			title="Projects"
			components={PROJECT_COMPONENTS}
			componentEntries={liveProjects}
			note={
				liveProjects.length < PROJECT_COMPONENTS.length
					? `Showing the latest of ${PROJECT_COMPONENTS.length} projects. Browse them all in the sidebar's Projects list.`
					: undefined
			}
			componentHrefPrefix="/components/projects"
			previewHrefPrefix="/preview/projects"
			emptyStateTitle="No projects yet"
			emptyStateDescription="Add a project entry to start building out this showcase."
		/>
	);
}

export type ProjectListEntry = HomeCatalogListEntry;
