import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HomeContent, type HomeCategory } from "../home-content";
import { getCategoryDisplayName } from "@/lib/project-page-title";
import { getArtComponentsWithUpdatedAt, getProjectComponentsWithUpdatedAt } from "@/lib/project-component-updated";
import { getWebsiteLastUpdatedAt } from "@/lib/website-last-updated";

interface PageProps {
	params: Promise<{ category: string }>;
}

const VALID_CATEGORIES = ["ui", "ui-charts", "ui-custom", "blocks", "projects", "arts", "utility", "visual"] as const;
type ValidCategory = (typeof VALID_CATEGORIES)[number];

function isValidCategory(value: string): value is ValidCategory {
	return (VALID_CATEGORIES as readonly string[]).includes(value);
}

export function generateStaticParams() {
	return VALID_CATEGORIES.map((category) => ({ category }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { category } = await params;
	if (!isValidCategory(category)) return {};
	return { title: getCategoryDisplayName(category) };
}

export default async function CategoryPage({ params }: PageProps) {
	const { category } = await params;

	if (!isValidCategory(category)) {
		notFound();
	}

	const lastUpdatedAt = getWebsiteLastUpdatedAt();
	const projectComponents = category === "projects" ? getProjectComponentsWithUpdatedAt() : undefined;
	const artComponents = category === "arts" ? getArtComponentsWithUpdatedAt() : undefined;

	return (
		<HomeContent
			category={category satisfies HomeCategory}
			lastUpdatedAt={lastUpdatedAt}
			projectComponents={projectComponents}
			artComponents={artComponents}
		/>
	);
}
