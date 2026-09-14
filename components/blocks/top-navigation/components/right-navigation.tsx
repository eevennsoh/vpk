"use client";

import { useState, type Ref } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsMounted } from "@/components/hooks/use-is-mounted";
import type { DesignVariantId } from "@/components/utils/design-variants";
import { token } from "@/lib/tokens";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import {
	RightNavigationActions,
	type RightNavigationSettingsMenuItem,
} from "./right-navigation-actions";
import { TOP_NAV_OVERFLOW_BREAKPOINT_PX } from "../layout-constants";

type Product = "admin" | "agents" | "home" | "jira" | "confluence" | "rovo" | "search" | "studio";

interface RightNavigationProps {
	product: Product;
	windowWidth: number;
	hideRovoAction?: boolean;
	settingsDesignVariantIds?: readonly DesignVariantId[];
	settingsIconOnly?: boolean;
	forceShowRovoAction?: boolean;
	isChatOpen?: boolean;
	onToggleChat: () => void;
	settingsMenuItems?: ReadonlyArray<RightNavigationSettingsMenuItem>;
	/**
	 * Exposes the cluster's container so the bar can measure how much room the
	 * right side needs. The centered search overlay reserves that width on both
	 * sides so it can never slide underneath these actions.
	 */
	ref?: Ref<HTMLDivElement>;
}

export function RightNavigation({
	product,
	windowWidth,
	hideRovoAction = false,
	settingsDesignVariantIds,
	settingsIconOnly = false,
	forceShowRovoAction = false,
	isChatOpen = false,
	onToggleChat,
	settingsMenuItems,
	ref,
}: Readonly<RightNavigationProps>) {
	const [isOverflowOpen, setIsOverflowOpen] = useState(false);
	// Gate the responsive collapse on mount: `windowWidth` is 0 during SSR and the
	// first client paint, so `0 < BREAKPOINT` would briefly render the "…" overflow
	// before the real width arrives (a flash on desktop). Until mounted, render the
	// full inline cluster (server + first client render agree → no hydration
	// mismatch); only collapse once we have a real, genuinely-narrow measurement.
	const isMounted = useIsMounted();
	const productSuppressesRovoAction = product === "rovo" || product === "studio";
	const showRovoAction = !hideRovoAction && (!productSuppressesRovoAction || forceShowRovoAction);
	// Match Figma: a generous gap separates the Create button (middle zone) from
	// the right-side cluster (Ask Rovo + utility icons) at every width down to the
	// overflow breakpoint, where the cluster collapses and the gap is dropped.
	const containerStyle = {
		display: "flex",
		alignItems: "center",
		gap: token("space.050"),
		flexShrink: 0,
		justifyContent: "flex-end",
		// 56px isn't on the ADS space scale (it jumps 48 → 64), so use a raw value;
		// the Figma gap is flex-derived rather than a token. Below the overflow
		// breakpoint the cluster collapses, so fall back to the 8px rhythm.
		marginLeft:
			isMounted && windowWidth < TOP_NAV_OVERFLOW_BREAKPOINT_PX
				? token("space.100")
				: "56px",
	};

	const actions = (
		<RightNavigationActions
			settingsDesignVariantIds={settingsDesignVariantIds}
			settingsIconOnly={settingsIconOnly}
			showRovoAction={showRovoAction}
			isChatOpen={isChatOpen}
			onToggleChat={onToggleChat}
			settingsMenuItems={settingsMenuItems}
		/>
	);

	// Narrow widths: collapse the entire right cluster into a single "…" popover
	// that renders the same actions in a horizontal row (matches production).
	if (isMounted && windowWidth < TOP_NAV_OVERFLOW_BREAKPOINT_PX) {
		return (
			<div ref={ref} style={containerStyle}>
				<Popover open={isOverflowOpen} onOpenChange={setIsOverflowOpen}>
					<PopoverTrigger
						render={
							<Button aria-label="More" size="icon" variant="outline">
								<ShowMoreHorizontalIcon label="" color={token("color.icon.subtle")} />
							</Button>
						}
					/>
					<PopoverContent
						side="bottom"
						align="end"
						sideOffset={8}
						className="flex w-auto flex-row items-center gap-1 p-1"
					>
						{actions}
					</PopoverContent>
				</Popover>
			</div>
		);
	}

	return <div ref={ref} style={containerStyle}>{actions}</div>;
}
