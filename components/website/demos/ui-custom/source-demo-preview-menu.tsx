"use client";

// oxlint-disable react-doctor/jsx-no-jsx-as-prop -- PopoverTrigger uses a render-node trigger so the demo label owns the visual state.

import { ChevronDownIcon } from "@/components/ui/vpk-icons";
import {
	SOURCE_PREVIEW_PAGES,
	SourcePreviewMenu,
} from "@/components/ui-custom/source-preview-menu";

const SOURCE_PREVIEW_TOASTER_ID = "source-demo-preview-menu";

export default function SourceDemoPreviewMenu() {
	return (
		<div className="not-prose mb-4 text-primary text-xs">
			<SourcePreviewMenu
				pages={SOURCE_PREVIEW_PAGES}
				toasterId={SOURCE_PREVIEW_TOASTER_ID}
				trigger={<button className="flex items-center gap-2" type="button" />}
			>
				<p className="font-medium">Used {SOURCE_PREVIEW_PAGES.length} sources</p>
				<ChevronDownIcon size="small" />
			</SourcePreviewMenu>
		</div>
	);
}
