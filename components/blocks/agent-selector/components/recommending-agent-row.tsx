"use client";

import { Shimmer } from "@/components/ui/shimmer";
import { Spinner } from "@/components/ui/spinner";

/**
 * Holds the recommended agent's slot while the recommendation is worked out: a spinner where the avatar will be and
 * a shimmering label where its name will be, in the same row geometry, so the agent replaces it without a jump.
 */
export function RecommendingAgentRow() {
	return (
		<div className="rounded-lg" data-menu-row="" role="status">
			<div className="flex items-center gap-3 py-1.5 pr-1.5 pl-2">
				<span aria-hidden className="grid size-6 shrink-0 place-items-center text-icon-subtle">
					<Spinner size="default" />
				</span>
				<Shimmer as="span" className="menu-row-title min-w-0 flex-1 truncate text-text-subtle">Recommending agent</Shimmer>
			</div>
		</div>
	);
}
