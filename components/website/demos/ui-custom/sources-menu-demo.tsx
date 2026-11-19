"use client";

// oxlint-disable react-doctor/jsx-no-jsx-as-prop -- PopoverTrigger uses a render-node trigger so the demo label owns the visual state.

import { ChevronDownIcon } from "@/components/ui/vpk-icons";
import {
	SOURCE_PREVIEW_PAGES,
	SourcesMenu,
} from "@/components/ui-custom/sources-menu";

const SOURCE_PREVIEW_TOASTER_ID = "sources-menu-demo";

export default function SourcesMenuDemo() {
	return (
		<div className="not-prose mb-4 text-primary text-xs">
			<SourcesMenu
				pages={SOURCE_PREVIEW_PAGES}
				toasterId={SOURCE_PREVIEW_TOASTER_ID}
				trigger={<button className="flex items-center gap-2" type="button" />}
			>
				<p className="font-medium">Used {SOURCE_PREVIEW_PAGES.length} sources</p>
				<ChevronDownIcon size="small" />
			</SourcesMenu>
		</div>
	);
}
