"use client";

// oxlint-disable react-doctor/jsx-no-jsx-as-prop -- PopoverTrigger uses a render-node trigger so the stack button owns the visual state.

import { useId } from "react";

import {
	PULSE_SOURCE_PREVIEW_PAGES,
	PULSE_SOURCES,
} from "@/components/blocks/jira-kanban/experimental/pulse/data/pulse-sources-preview";
import { SourcePreviewMenu } from "@/components/ui-custom/source-preview-menu";
import { TWGAppstack } from "@/components/ui-custom/twg-appstack";

export function PulseSourcesAppstack() {
	const toasterId = useId();

	return (
		<SourcePreviewMenu
			pages={PULSE_SOURCE_PREVIEW_PAGES}
			toasterId={toasterId}
			trigger={
				<button
					aria-label={`View ${PULSE_SOURCES.length} sources`}
					className="inline-flex h-auto w-auto min-h-0 min-w-fit shrink-0 items-center overflow-visible rounded-sm bg-transparent p-0.5 outline-none hover:bg-bg-neutral-subtle-hovered focus-visible:ring-3 focus-visible:ring-ring/50"
					type="button"
				/>
			}
		>
			<TWGAppstack
				animated={false}
				aria-hidden
				className="w-auto min-w-fit shrink-0 justify-start overflow-visible"
				iconSize="xxsmall"
				maxVisible={4}
				sources={PULSE_SOURCES}
			/>
		</SourcePreviewMenu>
	);
}
