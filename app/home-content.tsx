// oxlint-disable react-doctor/iframe-missing-sandbox -- These iframes render first-party internal preview routes; same-origin is required for Next dev assets and theme messaging.

import { token } from "@/lib/tokens";
import { WebsiteSidebarNav } from "@/components/website/website-sidebar-nav";
import { WebsiteHeader } from "@/components/website/website-header";
import { WebsiteGrid } from "@/components/website/website-grid";
import { WebsiteCard } from "@/components/website/website-card";
import { WebsitePreview } from "@/components/website/website-preview";
import { CategoryTabs } from "@/components/website/category-tabs";
import { CATEGORY_TAB_OPTIONS, type WebsiteCategoryTab } from "@/app/data/category-tabs";
import {
	AUDIO_COMPONENTS,
	UI_CHART_COMPONENTS,
	CUSTOM_COMPONENTS,
	UI_COMPONENTS,
	BLOCK_COMPONENTS,
	UTILITY_COMPONENTS,
	VISUAL_COMPONENTS,
} from "./data/component-manifest";
import { WEBSITE_STATIC_PAGES, WEBSITE_NAV_SECTIONS } from "./data/website-sidebar-nav";
import {
	HomeArtsSection,
	type ArtListEntry,
} from "@/app/home-arts-section";
import {
	HomeProjectsSection,
	type ProjectListEntry,
} from "@/app/home-projects-section";
import { HomeSectionHeading } from "@/app/home-section-heading";

export type HomeCategory = WebsiteCategoryTab;

interface HomeContentProps {
	category: HomeCategory;
	lastUpdatedAt?: string | null;
	projectComponents?: ReadonlyArray<ProjectListEntry>;
	artComponents?: ReadonlyArray<ArtListEntry>;
}

export function HomeContent({ category, lastUpdatedAt, projectComponents, artComponents }: Readonly<HomeContentProps>) {
	return (
		<>
			<WebsiteSidebarNav staticPages={WEBSITE_STATIC_PAGES} sections={WEBSITE_NAV_SECTIONS} logoText="VPK" />

			<div
				className="website-main-content"
				style={{
					minHeight: "100vh",
					backgroundColor: token("elevation.surface"),
				}}
			>
				<WebsiteHeader
					packageName="@vpk"
					lastUpdatedAt={lastUpdatedAt}
					leftContent={<CategoryTabs activeCategory={category} options={CATEGORY_TAB_OPTIONS} />}
				/>

				<div>
					{category === "ui" ? <>
							<HomeSectionHeading
								id="ui"
								title="UI"
								count={UI_COMPONENTS.length}
							/>
							<WebsiteGrid>
								{UI_COMPONENTS.map((comp) => (
									<WebsiteCard key={comp.slug} name={comp.name} href={`/components/ui/${comp.slug}`}>
										<WebsitePreview slug={comp.slug} name={comp.name} importPath={comp.importPath} category="ui" />
									</WebsiteCard>
								))}
							</WebsiteGrid>
						</> : null}

					{category === "ui-custom" ? <>
							<HomeSectionHeading
								id="custom-elements"
								title="UI — Custom"
								count={CUSTOM_COMPONENTS.length}
							/>
							<WebsiteGrid>
								{CUSTOM_COMPONENTS.map((comp) => (
									<WebsiteCard key={comp.slug} name={comp.name} href={`/components/ui-custom/${comp.slug}`}>
										<WebsitePreview slug={comp.slug} name={comp.name} importPath={comp.importPath} category="ui-custom" />
									</WebsiteCard>
								))}
							</WebsiteGrid>
						</> : null}

					{category === "ui-audio" ? <>
							<HomeSectionHeading
								id="audio-elements"
								title="UI — Audio"
								count={AUDIO_COMPONENTS.length}
							/>
							<WebsiteGrid>
								{AUDIO_COMPONENTS.map((comp) => (
									<WebsiteCard key={comp.slug} name={comp.name} href={`/components/ui-audio/${comp.slug}`}>
										<WebsitePreview slug={comp.slug} name={comp.name} importPath={comp.importPath} category="ui-audio" />
									</WebsiteCard>
								))}
							</WebsiteGrid>
						</> : null}

					{category === "ui-charts" ? <>
							<HomeSectionHeading
								id="ui-charts"
								title="UI — Charts"
								count={UI_CHART_COMPONENTS.length}
							/>
							<WebsiteGrid>
								{UI_CHART_COMPONENTS.map((comp) => (
									<WebsiteCard key={comp.slug} name={comp.name} href={`/components/ui-charts/${comp.slug}`}>
										<WebsitePreview slug={comp.slug} name={comp.name} importPath={comp.importPath} category="ui-charts" />
									</WebsiteCard>
								))}
							</WebsiteGrid>
						</> : null}

					{category === "blocks" ? <>
							<HomeSectionHeading
								id="blocks"
								title="Blocks"
								count={BLOCK_COMPONENTS.length}
							/>
							<ul className="grid grid-cols-1 list-none m-0 p-0">
								{BLOCK_COMPONENTS.map((comp, index) => (
									<WebsiteCard
										key={comp.slug}
										name={comp.name}
										href={`/components/blocks/${comp.slug}`}
										fullWidth
										deferOffscreen={index > 0}
									>
										<iframe
											src={`/preview/blocks/${comp.slug}`}
											title={comp.name}
											className="h-full w-full border-0"
											loading="lazy"
											sandbox="allow-same-origin allow-scripts"
										/>
									</WebsiteCard>
								))}
							</ul>
						</> : null}

					{category === "projects" ? <HomeProjectsSection projectComponents={projectComponents} /> : null}

					{category === "arts" ? <HomeArtsSection artComponents={artComponents} /> : null}

					{category === "utility" ? <>
							<HomeSectionHeading
								id="utility"
								title="Utils"
								count={UTILITY_COMPONENTS.length}
							/>
							<ul className="grid grid-cols-1 list-none m-0 p-0">
								{UTILITY_COMPONENTS.map((comp, index) => (
									<WebsiteCard
										key={comp.slug}
										name={comp.name}
										href={`/components/utility/${comp.slug}`}
										fullWidth
										deferOffscreen={index > 0}
									>
										<iframe
											src={`/preview/utility/${comp.slug}`}
											title={comp.name}
											className="h-full w-full border-0"
											loading="lazy"
											sandbox="allow-same-origin allow-scripts"
										/>
									</WebsiteCard>
								))}
							</ul>
						</> : null}

					{category === "visual" ? <>
							<HomeSectionHeading
								id="visual"
								title="Visual"
								count={VISUAL_COMPONENTS.length}
							/>
							<WebsiteGrid>
								{VISUAL_COMPONENTS.map((comp) => (
									<WebsiteCard key={comp.slug} name={comp.name} href={`/components/visual/${comp.slug}`}>
										<WebsitePreview slug={comp.slug} name={comp.name} importPath={comp.importPath} category="visual" />
									</WebsiteCard>
								))}
							</WebsiteGrid>
						</> : null}
				</div>
			</div>
		</>
	);
}
