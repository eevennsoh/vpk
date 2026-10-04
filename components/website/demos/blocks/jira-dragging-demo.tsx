"use client";

import { useState } from "react";
import { JiraDragging, type JiraDraggingProps } from "@/components/blocks/jira-dragging";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export default function JiraDraggingDemo() {
	const [variant, setVariant] = useState<NonNullable<JiraDraggingProps["variant"]>>("experimental");
	return (
		<div className="flex min-h-0 w-full flex-col">
			<div className="flex justify-end px-3 py-2">
				<ToggleGroup
					aria-label="Jira dragging variant"
					value={[variant]}
					onValueChange={(values) => {
						const next = values[0];
						if (next === "default" || next === "experimental") setVariant(next);
					}}
					size="sm"
					variant="outline"
				>
					<ToggleGroupItem value="default">Default</ToggleGroupItem>
					<ToggleGroupItem value="experimental">Experimental</ToggleGroupItem>
				</ToggleGroup>
			</div>
			<JiraDragging className="mx-auto" variant={variant} />
		</div>
	);
}
