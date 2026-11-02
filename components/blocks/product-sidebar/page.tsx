"use client";

import React, { useState } from "react";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import { useSidebar } from "@/app/contexts/context-sidebar";
import { TOP_NAV_HEADER_HEIGHT_PX } from "@/components/blocks/top-navigation/layout-constants";
import { Sidebar, SidebarContent } from "@/components/ui/sidebar";
import { AdminSidebar } from "./variants/admin";
import { JiraSidebar } from "./variants/jira";
import { ConfluenceSidebar } from "./variants/confluence";

type Product = "admin" | "agents" | "home" | "jira" | "confluence" | "rovo" | "search" | "studio";

interface SidebarProps {
	product: Product;
	/** Optional product-navigation body supplied by a host project prototype. */
	content?: React.ReactNode;
	embedded?: boolean;
	/**
	 * When true, renders the sidebar as a slotted component within a shell's
	 * SidebarProvider (no fixed positioning, no border, no header offset logic).
	 * The shell's chrome supplies the resizable container, divider, and layout.
	 * Defaults to false (standalone mode with fixed positioning and border).
	 */
	asChromeSlot?: boolean;
	/** The resize handle node to render at the sidebar's trailing edge (slot mode only). */
	resizeHandle?: React.ReactNode;
	/** Whether the sidebar is currently being resized (slot mode only). */
	isResizing?: boolean;
	/** Height of the chrome header the sidebar should sit below, in px (slot mode only). */
	headerOffsetPx?: number;
	/** Offsets the sidebar below the top chrome header when asChromeSlot is true. */
	topOffset?: boolean;
}

export default function ProductSidebar({
	product,
	content,
	embedded = false,
	asChromeSlot = false,
	resizeHandle,
	isResizing,
	headerOffsetPx = TOP_NAV_HEADER_HEIGHT_PX,
	topOffset = false,
}: Readonly<SidebarProps>) {
	const [selectedItem, setSelectedItem] = useState(product === "confluence" ? "Demo Live page" : "Jira Design");
	const { isVisible, isHovered, setHovered } = useSidebar();
	const shouldShow = isVisible || isHovered;
	// When visible the sidebar spans the full viewport height (top: 0) so its
	// right border runs unbroken from the very top edge down through the body,
	// visually continuing past the TopNavigation header. When collapsed/hover it
	// tucks below the header. Heights/offsets track the canonical header height.
	const headerOffsetPxStr = `${TOP_NAV_HEADER_HEIGHT_PX}px`;

	// Render the appropriate sidebar based on product
	const renderSidebarContent = () => {
		if (content) {
			return content;
		}

		switch (product) {
			case "admin":
				return <AdminSidebar />;
			case "jira":
				return <JiraSidebar selectedItem={selectedItem} onSelectItem={setSelectedItem} />;
			case "confluence":
				return <ConfluenceSidebar selectedItem={selectedItem} onSelectItem={setSelectedItem} />;
			default:
				return <JiraSidebar selectedItem={selectedItem} onSelectItem={setSelectedItem} />;
		}
	};

	// When used as a chrome slot, render like StudioSidebar: use the ui Sidebar component
	// with the slot's resizeHandle and isResizing state, leveraging the chrome's
	// SidebarProvider and resize hook instead of maintaining a conflicting copy.
	if (asChromeSlot) {
		return (
			<Sidebar
				aria-label="Product navigation"
				className={cn(
					"bg-sidebar !px-0 !pb-0",
					// The resize handle paints the divider; a container border would double it.
					!resizeHandle &&
						"group-data-[state=expanded]:group-data-[side=left]:border-r group-data-[state=expanded]:group-data-[side=left]:border-border",
				)}
				isResizing={isResizing}
				onMouseLeave={() => {
					if (isHovered && !isVisible) {
						setHovered(false);
					}
				}}
				resizeHandle={resizeHandle}
				role="complementary"
				style={{
					zIndex: 50,
					...(topOffset
						? {
								top: `${headerOffsetPx}px`,
								height: `calc(100svh - ${headerOffsetPx}px)`,
							}
						: {}),
				}}
				variant="inset"
			>
				<SidebarContent className="gap-3 overflow-hidden bg-sidebar px-3">
					<div className="flex shrink-0 flex-col gap-3">
						{renderSidebarContent()}
					</div>
				</SidebarContent>
			</Sidebar>
		);
	}

	// Standalone mode: fixed positioning with header offset and border
	return (
		<>
			<div
				style={{
					width: "230px",
					height: embedded ? "100%" : (isVisible ? "100vh" : `calc(100vh - ${headerOffsetPxStr})`),
					backgroundColor: token("elevation.surface"),
					borderRight: `1px solid ${token("color.border")}`,
					position: embedded ? "absolute" : "fixed",
					left: 0,
					top: embedded ? 0 : (isVisible ? "0" : headerOffsetPxStr),
					transform: shouldShow ? "translateX(0)" : "translateX(-100%)",
					transition: "transform var(--duration-medium) var(--ease-in-out)",
					overflow: "auto",
					zIndex: isVisible || isHovered ? 99 : 50,
				}}
				onMouseLeave={() => {
					if (isHovered && !isVisible) {
						setHovered(false);
					}
				}}
			>
				<div
					style={{
						padding: token("space.150"),
						paddingTop: embedded ? token("space.150") : (isVisible ? `calc(${headerOffsetPxStr} + 12px)` : token("space.150")),
						display: "flex",
						flexDirection: "column",
					}}
				>
					{renderSidebarContent()}
				</div>
			</div>
		</>
	);
}
