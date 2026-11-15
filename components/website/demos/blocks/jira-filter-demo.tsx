"use client";

import { useState } from "react";
import type { JiraFilterProps } from "@/components/blocks/jira-filter";
import Page from "@/components/blocks/jira-filter/page";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export default function JiraFilterDemo() {
	const [variant, setVariant] = useState<NonNullable<JiraFilterProps["variant"]>>("project-butter");
	return (
		<div className="flex w-full flex-col">
			<div className="flex justify-end px-3 pt-3">
				<ToggleGroup
					aria-label="Jira filter variant"
					value={[variant]}
					onValueChange={(values) => {
						const next = values[0];
						if (next === "default" || next === "project-butter") setVariant(next);
					}}
					size="sm"
					variant="outline"
				>
					<ToggleGroupItem value="default">Default</ToggleGroupItem>
					<ToggleGroupItem value="project-butter">Project butter</ToggleGroupItem>
				</ToggleGroup>
			</div>
			<Page key={variant} variant={variant} />
		</div>
	);
}

export function JiraFilterDemoDefault() {
	return <Page variant="default" headingAs="h4" />;
}

export function JiraFilterDemoProjectButter() {
	return <Page variant="project-butter" headingAs="h4" />;
}
