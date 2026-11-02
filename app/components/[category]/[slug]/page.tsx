import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { UI_CHART_COMPONENTS, CUSTOM_COMPONENTS, UI_COMPONENTS, BLOCK_COMPONENTS, PROJECT_COMPONENTS, ART_COMPONENTS, UTILITY_COMPONENTS, VISUAL_COMPONENTS, findComponent } from "@/app/data/components";
import { ComponentDoc } from "@/components/website/component-doc/page";
import { getComponentPageTitle } from "@/lib/project-page-title";

interface PageProps {
	params: Promise<{
		category: string;
		slug: string;
	}>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { category, slug } = await params;
	if (category === "ui-custom" && slug === "skill-card") {
		return { title: getComponentPageTitle("Entity Card", "ui-custom") };
	}
	const component = findComponent(category, slug);
	if (!component) return {};
	return { title: getComponentPageTitle(component.name, component.category) };
}

export function generateStaticParams() {
	const params: { category: string; slug: string }[] = [
		{ category: "ui-audio", slug: "live-waveform" },
	];

	for (const comp of UI_CHART_COMPONENTS) {
		params.push({ category: "ui-charts", slug: comp.slug });
	}

	for (const comp of CUSTOM_COMPONENTS) {
		params.push({ category: "ui-custom", slug: comp.slug });
	}

	for (const comp of UI_COMPONENTS) {
		params.push({ category: "ui", slug: comp.slug });
	}

	for (const comp of BLOCK_COMPONENTS) {
		params.push({ category: "blocks", slug: comp.slug });
	}

	for (const comp of PROJECT_COMPONENTS) {
		params.push({ category: "projects", slug: comp.slug });
	}

	for (const comp of ART_COMPONENTS) {
		params.push({ category: "arts", slug: comp.slug });
	}

	for (const comp of UTILITY_COMPONENTS) {
		params.push({ category: "utility", slug: comp.slug });
	}

	for (const comp of VISUAL_COMPONENTS) {
		params.push({ category: "visual", slug: comp.slug });
	}

	return params;
}

export default async function ComponentDetailPage({ params }: PageProps) {
	const { category, slug } = await params;

	if (category === "ui-audio" && slug === "live-waveform") {
		redirect("/components/ui-custom/live-waveform");
	}

	if (category === "ui-custom" && slug === "skill-card") {
		redirect("/components/ui-custom/entity-card");
	}

	// The old card-directory doc was split: its shell + variants merged into
	// entity-card, and its template card became the standalone ui-custom/agent-card.
	if (category === "ui-custom" && slug === "card-directory") {
		redirect("/components/ui-custom/entity-card");
	}

	// The agent-card moved from ui-custom to a self-contained block.
	if (category === "ui-custom" && slug === "agent-card") {
		redirect("/components/blocks/agent-card");
	}

	// The React Flow overlay panel was renamed from panel to flow-panel to
	// disambiguate it from the ui/panel chrome surface.
	if (category === "ui-custom" && slug === "panel") {
		redirect("/components/ui-custom/flow-panel");
	}

	// chat-configuration moved from utility to a blocks doc.
	if (category === "utility" && slug === "chat-configuration") {
		redirect("/components/blocks/chat-configuration");
	}

	if (category !== "ui-charts" && category !== "ui-custom" && category !== "ui" && category !== "blocks" && category !== "projects" && category !== "arts" && category !== "utility" && category !== "visual") {
		notFound();
	}

	const component = findComponent(category, slug);

	if (!component) {
		notFound();
	}

	return <ComponentDoc component={component} />;
}
