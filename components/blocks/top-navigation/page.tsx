"use client";

// oxlint-disable react-doctor/prefer-module-scope-static-value -- These values are intentionally colocated with the component/demo contract for readability and token context.

import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type CSSProperties,
	type ReactNode,
} from "react";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarResizeHandle } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { token } from "@/lib/tokens";
import type { DesignVariantId } from "@/components/utils/design-variants";
import SearchSuggestionsPanel from "./components/search-suggestions-panel";
import { LeftNavigation } from "./components/left-navigation";
import { RightNavigation } from "./components/right-navigation";
import { CreateButton } from "./components/create-button";
import { StudioSidebar } from "./components/studio-sidebar";
import { useTopNavigation } from "./hooks/use-top-navigation";
import { useSidebarResize } from "@/components/projects/rovo-core/hooks/use-sidebar-resize";
import {
	ROVO_APP_SEPARATOR_LINE_OFFSET_PX,
	ROVO_APP_SIDEBAR_MAX_WIDTH_PX,
	ROVO_APP_SIDEBAR_MIN_WIDTH_PX,
	TOP_NAV_COLLAPSED_LEFT_SECTION_WIDTH_PX,
	getCenteredSearchInsetPx,
	getCollapsedHeaderPaddingPx,
	TOP_NAV_HEADER_HEIGHT_PX,
	TOP_NAV_LEFT_SECTION_WIDTH_PX,
	TOP_NAV_PADDING_PX,
	TOP_NAV_SEARCH_CENTER_BREAKPOINT_PX,
	TOP_NAV_SEARCH_ICON_BREAKPOINT_PX,
	TOP_NAV_SEARCH_MAX_WIDTH_PX,
	TOP_NAV_SEARCH_MIN_WIDTH_PX,
	TOP_NAV_SIDEBAR_PIN_RELEASE_BREAKPOINT_PX,
} from "./layout-constants";
import SearchIcon from "@atlaskit/icon/core/search";

type Product = "admin" | "agents" | "home" | "jira" | "confluence" | "rovo" | "search" | "studio";

/**
 * State the `"shell"` chrome hands to a sidebar slot render function so the
 * product sidebar shares the chrome's single resizable-sidebar source of truth
 * (one `SidebarProvider`, one resize hook) rather than maintaining its own.
 */
export interface ShellSidebarSlotState {
	/** The resize handle node to render at the sidebar's trailing edge. */
	resizeHandle: ReactNode;
	/** Whether the sidebar is currently being resized (suppresses transitions). */
	isResizing: boolean;
	/** Height of the chrome header the sidebar should sit below, in px. */
	headerOffsetPx: number;
}

interface TopNavigationProps {
	product?: Product;
	showSearch?: boolean;
	/** Initial pinned-sidebar state before the user takes control. */
	defaultSidebarOpen?: boolean;
	/** Size the shell to the viewport, or fill a height-constrained parent. */
	shellHeight?: "viewport" | "parent";
	/** Preserve the legacy leading inset used by sidebar-owned product shells. */
	searchAlignment?: "responsive" | "sidebar";
	hideRovoAction?: boolean;
	settingsDesignVariantIds?: readonly DesignVariantId[];
	settingsIconOnly?: boolean;
	/**
	 * Forces the "Ask Rovo" pill to render even for products that normally
	 * suppress it (Rovo/Studio). The Figma global top navigation always shows
	 * Ask Rovo in the right cluster, so the standalone block demo opts in.
	 */
	forceShowRovoAction?: boolean;
	/**
	 * Rendering mode.
	 *
	 * - `"shell"` (default): full studio application shell — owns its own
	 *   resizable `StudioSidebar`, a 56px header, and a placeholder body. Used by
	 *   the standalone top-navigation block demo.
	 * - `"header"`: header bar only (no `StudioSidebar`, no `h-svh` wrapper, no
	 *   placeholder body). Renders in normal flow as a 56px sticky bar so a host
	 *   layout (e.g. `AppLayout`) can supply its own sidebar + content beneath it.
	 *   The sidebar toggle drives the shared `context-sidebar` instead of a
	 *   private shell state.
	 */
	variant?: "shell" | "header";
	/**
	 * Product-specific sidebar rendered inside the `"shell"` variant, in place of
	 * the default presentational `StudioSidebar`. The slotted node owns its own
	 * nav content; the chrome owns the single source of truth for the resizable
	 * sidebar state and passes it down here.
	 *
	 * Pass a render function to receive that state ({@link ShellSidebarSlotState})
	 * — the resize handle, `isResizing`, and the header offset — so the product
	 * sidebar shares the chrome's one `SidebarProvider` + resize hook instead of
	 * maintaining a conflicting copy. A plain node is still accepted for simple
	 * presentational sidebars. Ignored by the `"header"` variant (the host
	 * supplies the sidebar there). Defaults to the block demo's `StudioSidebar`.
	 */
	sidebar?: ReactNode | ((state: ShellSidebarSlotState) => ReactNode);
	/**
	 * Body content rendered inside the `"shell"` variant's framed content area,
	 * in place of the empty placeholder `<main>`. Ignored by the `"header"`
	 * variant.
	 */
	children?: ReactNode;
}

/**
 * Tracks a rendered element's width, returning a callback ref to attach and the
 * latest measurement. Both the responsive breakpoints and the centered search's
 * side reserve are driven off real geometry rather than assumed widths.
 */
function useMeasuredWidth(): readonly [(node: HTMLElement | null) => void, number] {
	const [node, setNode] = useState<HTMLElement | null>(null);
	const [width, setWidth] = useState(0);

	useEffect(() => {
		if (!node) return;

		const updateWidth = () => {
			setWidth(node.getBoundingClientRect().width);
		};

		updateWidth();
		if (typeof ResizeObserver === "undefined") {
			window.addEventListener("resize", updateWidth);
			return () => window.removeEventListener("resize", updateWidth);
		}

		const resizeObserver = new ResizeObserver(updateWidth);
		resizeObserver.observe(node);
		return () => resizeObserver.disconnect();
	}, [node]);

	return [setNode, width] as const;
}

/**
 * Studio-style application shell with a resizable, pinned side-nav and a 56px
 * top navigation bar. The header mirrors the Figma global top navigation:
 * left chrome (sidebar toggle, app switcher, product logo) sits in the
 * sidebar-aligned region; the search + Create sit in a middle zone that
 * left-aligns while the sidebar is pinned, then centers when it is collapsed
 * at or above `TOP_NAV_SEARCH_CENTER_BREAKPOINT_PX`;
 * the right cluster (Ask Rovo, notifications, help, settings, theme, avatar)
 * collapses into a "…" overflow popover at narrow widths. The search shrinks
 * fluidly and collapses to an icon button below `TOP_NAV_SEARCH_ICON_BREAKPOINT_PX`.
 */
export default function TopNavigation({
	product = "studio",
	showSearch = true,
	defaultSidebarOpen = true,
	shellHeight = "viewport",
	searchAlignment = "responsive",
	hideRovoAction = false,
	settingsDesignVariantIds,
	settingsIconOnly = false,
	forceShowRovoAction = false,
	variant = "shell",
	sidebar,
	children,
}: Readonly<TopNavigationProps>) {
	const nav = useTopNavigation();
	const [setNavigationContainer, containerWidth] = useMeasuredWidth();
	const [setRightClusterNode, rightClusterWidth] = useMeasuredWidth();

	const responsiveWidth = containerWidth || nav.windowWidth;

	// The chrome owns its own sidebar open state (decoupled from the demo's
	// `context-sidebar`) so the resizable shell works standalone.
	const [sidebarOpen, setSidebarOpen] = useState(defaultSidebarOpen);
	const didAutoReleaseShellSidebarRef = useRef(false);
	useEffect(() => {
		const shellWidth = nav.windowWidth || responsiveWidth;
		if (shellWidth === 0) return;

		const isSmallContainer = shellWidth < TOP_NAV_SIDEBAR_PIN_RELEASE_BREAKPOINT_PX;
		if (isSmallContainer && sidebarOpen) {
			didAutoReleaseShellSidebarRef.current = true;
			setSidebarOpen(false);
		} else if (!isSmallContainer && didAutoReleaseShellSidebarRef.current) {
			didAutoReleaseShellSidebarRef.current = false;
			setSidebarOpen(true);
		}
	}, [nav.windowWidth, responsiveWidth, sidebarOpen]);

	const sidebarResize = useSidebarResize({
		defaultWidth: ROVO_APP_SEPARATOR_LINE_OFFSET_PX,
		minWidth: ROVO_APP_SIDEBAR_MIN_WIDTH_PX,
		maxWidth: ROVO_APP_SIDEBAR_MAX_WIDTH_PX,
		onCollapse: useCallback(() => setSidebarOpen(false), []),
	});

	const toggleSidebar = useCallback(() => setSidebarOpen((prev) => !prev), []);

	// Gate the chrome's width/border transition so it never plays on first paint.
	const [hasMountedChrome, setHasMountedChrome] = useState(false);
	useEffect(() => {
		const frame = requestAnimationFrame(() => setHasMountedChrome(true));
		return () => cancelAnimationFrame(frame);
	}, []);

	// Search collapses to an icon-only button on very narrow viewports; tapping
	// it expands the field (and focuses it) for the search session.
	const [isSearchIconExpanded, setIsSearchIconExpanded] = useState(false);
	const isSearchCollapsible =
		responsiveWidth > 0 && responsiveWidth < TOP_NAV_SEARCH_ICON_BREAKPOINT_PX;
	const showSearchField = !isSearchCollapsible || isSearchIconExpanded;
	useEffect(() => {
		if (!isSearchCollapsible) {
			setIsSearchIconExpanded(false);
		}
	}, [isSearchCollapsible]);

	// A pinned sidebar anchors the search to the content edge. Once the sidebar
	// collapses, center the search + Create group at wide viewports; below the
	// existing breakpoint it returns to the responsive left-aligned layout.
	const isPersistentSidebarVisible = variant === "header" ? nav.isVisible : sidebarOpen;
	const centerSearch = !isPersistentSidebarVisible
		&& (responsiveWidth === 0 || responsiveWidth >= TOP_NAV_SEARCH_CENTER_BREAKPOINT_PX);

	// The centered middle zone is an overlay spanning the whole bar, so it has to
	// reserve the side chrome itself or it slides underneath it — see
	// `getCenteredSearchInsetPx`.
	const centeredZoneInsetPx = getCenteredSearchInsetPx(product, rightClusterWidth);

	const handleExpandSearchIcon = useCallback(() => {
		setIsSearchIconExpanded(true);
		nav.handleFocusSearch();
	}, [nav]);

	const sidebarStyle = {
		"--sidebar-width": `${sidebarResize.sidebarWidth}px`,
	} as CSSProperties;

	// Single source of truth for the resizable sidebar, handed to a render-prop
	// `sidebar` slot so product sidebars share this chrome's one resize hook +
	// `SidebarProvider` instead of maintaining a conflicting copy.
	const sidebarSlotState: ShellSidebarSlotState = {
		isResizing: sidebarResize.isResizing,
		headerOffsetPx: TOP_NAV_HEADER_HEIGHT_PX,
		resizeHandle: (
			<SidebarResizeHandle
				data-active={sidebarResize.isResizing ? "" : undefined}
				data-will-collapse={sidebarResize.willCollapse ? "" : undefined}
				onDoubleClick={sidebarResize.onResizeHandleDoubleClick}
				onPointerDown={sidebarResize.onResizeHandlePointerDown}
				onPointerEnter={sidebarResize.onResizeHandlePointerEnter}
				onPointerLeave={sidebarResize.onResizeHandlePointerLeave}
			/>
		),
	};
	const resolvedSidebar =
		typeof sidebar === "function" ? sidebar(sidebarSlotState) : sidebar;

	const headerHeightStyle: CSSProperties = {
		height: `${TOP_NAV_HEADER_HEIGHT_PX}px`,
	};

	// Middle zone (search + Create) and right cluster (Ask Rovo, notifications,
	// help, settings, avatar) are identical across variants — define once and
	// reuse in both the standalone shell and the embedded header bar.
	const middleZone = (
		<div
			className={cn(
				"flex min-w-0 flex-1 items-center gap-2",
				centerSearch
					? "pointer-events-none absolute inset-x-0 justify-center [&>*]:pointer-events-auto"
					: "justify-start",
			)}
			style={centerSearch ? { paddingInline: `${centeredZoneInsetPx}px` } : undefined}
		>
			{showSearch ? (
				showSearchField ? (
					<div
						ref={nav.searchContainerRef}
						className={cn(
							"relative flex h-9 min-w-0 grow items-center",
							searchAlignment === "sidebar" ? "ps-2" : undefined,
						)}
						style={{
							// Preferred width is the min; the search grows to the cap when
							// there's room and shrinks below the preferred width under
							// pressure (narrow pinned viewports) so it absorbs the squeeze
							// instead of clipping the right cluster off-screen.
							flexBasis: `${TOP_NAV_SEARCH_MIN_WIDTH_PX}px`,
							maxWidth: `${TOP_NAV_SEARCH_MAX_WIDTH_PX}px`,
						}}
					>
						<InputGroup
							className={cn(
								"h-8 origin-center rounded-md bg-bg-input shadow-none transition-[transform,background-color,box-shadow] duration-medium ease-out hover:bg-bg-input-hovered motion-reduce:transition-none",
								"has-[[data-slot=input-group-control]:focus-visible]:border-transparent has-[[data-slot=input-group-control]:focus-visible]:ring-0",
								nav.isSearchFocused && "relative z-[1001] scale-y-[1.15]",
							)}
							style={
								nav.isSearchFocused
									? {
											backgroundColor: token("elevation.surface.overlay"),
											boxShadow: token("elevation.shadow.overlay"),
										}
									: undefined
							}
						>
							<InputGroupAddon align="inline-start">
								<span className="size-4 shrink-0 text-icon-subtle">
									<SearchIcon label="" spacing="none" />
								</span>
							</InputGroupAddon>
							<InputGroupInput
								type="search"
								aria-label="Search"
								autoFocus={isSearchIconExpanded}
								value={nav.searchValue}
								onChange={(event) => nav.setSearchValue(event.currentTarget.value)}
								onFocus={nav.handleFocusSearch}
								onKeyDown={nav.handleSearchKeyDown}
								placeholder="Search"
								className="h-full text-sm placeholder:text-sm [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden [&::-webkit-search-results-button]:hidden [&::-webkit-search-results-decoration]:hidden"
							/>
						</InputGroup>
						<SearchSuggestionsPanel
							anchorRef={nav.searchContainerRef}
							isVisible={nav.isSearchFocused}
							onSearchAllApps={nav.handleSearchAllApps}
							onRecentItemClick={nav.handleRecentItemClick}
							onRecentSearchClick={nav.handleRecentSearchClick}
							panelRef={nav.searchPanelRef}
						/>
					</div>
				) : (
					<Button
						aria-label="Search"
						size="icon"
						variant="outline"
						onClick={handleExpandSearchIcon}
					>
						<SearchIcon label="" color={token("color.icon.subtle")} />
					</Button>
				)
			) : null}

			<CreateButton />
		</div>
	);

	const rightCluster = (
		<RightNavigation
			ref={setRightClusterNode}
			product={product}
			windowWidth={responsiveWidth}
			hideRovoAction={hideRovoAction}
			settingsDesignVariantIds={settingsDesignVariantIds}
			settingsIconOnly={settingsIconOnly}
			forceShowRovoAction={forceShowRovoAction}
			isChatOpen={nav.isSidebarChatOpen}
			onToggleChat={nav.toggleChat}
		/>
	);

	// Header-only variant: a 56px sticky bar in normal flow. The host layout
	// (e.g. `AppLayout`) supplies the sidebar + content beneath it, so the
	// left chrome lives inline in the bar and the sidebar toggle drives the
	// shared `context-sidebar` (via `nav.toggleSidebar`/`nav.isVisible`).
	if (variant === "header") {
		return (
			<header
				ref={setNavigationContainer}
				className={cn(
					"relative flex shrink-0 items-center gap-2 px-3",
					centerSearch && "justify-end",
				)}
				style={{
					...headerHeightStyle,
					position: "sticky",
					top: 0,
					zIndex: 100,
					backgroundColor: token("elevation.surface"),
				}}
			>
				<div style={{ flex: "0 1 auto", minWidth: 0 }}>
					<LeftNavigation
						product={product}
						windowWidth={responsiveWidth}
						isVisible={nav.isVisible}
						isAppSwitcherOpen={nav.isAppSwitcherOpen}
						separatorLineOffsetPx={TOP_NAV_LEFT_SECTION_WIDTH_PX - TOP_NAV_PADDING_PX}
						onToggleSidebar={nav.toggleSidebar}
						onToggleAppSwitcher={nav.handleToggleAppSwitcher}
						onCloseAppSwitcher={nav.handleCloseAppSwitcher}
						onNavigate={nav.handleNavigate}
						onHoverEnter={nav.handleHoverEnter}
						onHoverLeave={nav.handleHoverLeave}
					/>
				</div>
				{middleZone}
				{rightCluster}
				{/* Bottom border drawn as a positioned line instead of `border-b` so
				    it can start at the sidebar's right edge when the pinned sidebar is
				    visible. That removes the stray horizontal segment that otherwise
				    crossed the sidebar's top-left corner. */}
				<span
					aria-hidden
					style={{
						position: "absolute",
						left: nav.isVisible ? `${TOP_NAV_LEFT_SECTION_WIDTH_PX}px` : 0,
						right: 0,
						bottom: 0,
						height: "1px",
						backgroundColor: token("color.border"),
						transition: "left var(--duration-medium) var(--ease-in-out)",
					}}
				/>
				{/* Vertical border at the sidebar's right edge while the pinned sidebar
				    is visible. The header (z:100) sits above the sidebar (z:99) and its
				    own surface would otherwise hide the sidebar's right border across
				    the top 56px; this redraws it so the divider runs unbroken from the
				    very top edge down through the body. */}
				{nav.isVisible ? (
					<span
						aria-hidden
						style={{
							position: "absolute",
							left: `${TOP_NAV_LEFT_SECTION_WIDTH_PX}px`,
							top: 0,
							bottom: 0,
							width: "1px",
							backgroundColor: token("color.border"),
						}}
					/>
				) : null}
			</header>
		);
	}

	return (
		<SidebarProvider
			className={cn(
				"overflow-clip",
				shellHeight === "parent" ? "h-full! min-h-0!" : "h-svh",
			)}
			defaultOpen={defaultSidebarOpen}
			onOpenChange={setSidebarOpen}
			open={sidebarOpen}
			style={sidebarStyle}
		>
			{resolvedSidebar ?? (
				<StudioSidebar
					headerOffsetPx={sidebarSlotState.headerOffsetPx}
					isResizing={sidebarSlotState.isResizing}
					resizeHandle={sidebarSlotState.resizeHandle}
					topOffset
				/>
			)}

			{/* Persistent side-nav chrome: aligns to the sidebar width when open and
			    collapses to the shared left chrome width when closed. Hosts the sidebar toggle,
			    app switcher, and product logo. */}
			<div
				className={cn(
					"fixed top-0 left-0 z-50 flex items-center px-3",
					hasMountedChrome && !sidebarResize.isResizing && "transition-[width,border-color] duration-medium ease-in-out",
					sidebarResize.isResizing && "transition-none",
					sidebarOpen
						? cn(
								"w-(--sidebar-width) overflow-x-clip border-r",
								sidebarResize.isResizing || sidebarResize.isResizeHandleHovered
									? "border-border-selected"
									: "border-border",
							)
						: "border-b border-border",
				)}
				style={{
					...headerHeightStyle,
					width: sidebarOpen ? undefined : `${TOP_NAV_COLLAPSED_LEFT_SECTION_WIDTH_PX}px`,
					backgroundColor: token("elevation.surface"),
					viewTransitionName: "persistent-sidebar" as never,
				}}
			>
				<LeftNavigation
					product={product}
					windowWidth={nav.windowWidth}
					isVisible={sidebarOpen}
					isAppSwitcherOpen={nav.isAppSwitcherOpen}
					isSidebarResizing={sidebarResize.isResizing}
					separatorLineOffsetPx={sidebarResize.sidebarWidth - TOP_NAV_PADDING_PX}
					onToggleSidebar={toggleSidebar}
					onToggleAppSwitcher={nav.handleToggleAppSwitcher}
					onCloseAppSwitcher={nav.handleCloseAppSwitcher}
					onNavigate={nav.handleNavigate}
					onHoverEnter={nav.handleHoverEnter}
					onHoverLeave={nav.handleHoverLeave}
				/>
			</div>

			<div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
				{/* Top navigation bar */}
				<div
					ref={setNavigationContainer}
					className={cn(
						"sticky top-0 z-40 flex shrink-0 items-center gap-2 border-b px-3 transition-[padding] duration-medium ease-in-out",
						centerSearch && "justify-end",
					)}
					style={{
						...headerHeightStyle,
						paddingLeft: sidebarOpen ? undefined : `${getCollapsedHeaderPaddingPx(product)}px`,
						borderColor: token("color.border"),
						backgroundColor: token("elevation.surface"),
						viewTransitionName: "persistent-header" as never,
					}}
				>
					{middleZone}
					{rightCluster}
				</div>

				{/* Framed content area. Hosts supply real content via `children`;
				    the block demo renders an empty placeholder body. */}
				{children ?? (
					<main className="relative flex min-h-0 min-w-0 flex-1 bg-background px-3 text-foreground" />
				)}
			</div>
		</SidebarProvider>
	);
}
