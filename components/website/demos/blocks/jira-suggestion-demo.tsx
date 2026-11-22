"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import Page from "@/components/blocks/jira-suggestion/page";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const ButterGalleryWorkItem = dynamic(
	() => import("@/components/projects/butter-v1/components/butter-gallery-work-item").then((module) => module.ButterGalleryWorkItem),
	{ ssr: false },
);

export default function JiraSuggestionDemo() {
	const [variant, setVariant] = useState<"menu" | "floating">("menu");
	const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);

	return (
		<div className="flex min-h-full w-full flex-col items-center justify-center gap-4 p-4">
			<ToggleGroup
				aria-label="Jira Suggestion variant"
				onValueChange={([next]) => {
					if (next === "menu" || next === "floating") setVariant(next);
				}}
				size="sm"
				value={[variant]}
				variant="outline"
			>
				<ToggleGroupItem value="menu">Menu</ToggleGroupItem>
				<ToggleGroupItem value="floating">Floating</ToggleGroupItem>
			</ToggleGroup>
			<Page>
				{variant === "floating" ? (
					<div className="absolute inset-0 isolate transform-gpu" ref={setPortalContainer}>
						{portalContainer ? <ButterGalleryWorkItem showAiSuggestions open onClose={() => setVariant("menu")} portalContainer={portalContainer} /> : null}
					</div>
				) : null}
			</Page>
		</div>
	);
}
