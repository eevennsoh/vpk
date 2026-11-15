"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { useWindowWidth } from "@/components/hooks/use-window-width";
import { useClickOutside } from "@/components/hooks/use-click-outside";
import { useSidebarActions, useSidebarState } from "@/app/contexts/context-sidebar";
import { useRovoChatControls } from "@/app/contexts";
import { token } from "@/lib/tokens";
import { TOP_NAV_SIDEBAR_PIN_RELEASE_BREAKPOINT_PX } from "../layout-constants";

const TOP_NAV_CENTER_SECTION_MAX_WIDTH_PX = 762;

export function useTopNavigation() {
	const router = useRouter();
	const [searchValue, setSearchValue] = useState("");
	const [isAppSwitcherOpen, setIsAppSwitcherOpen] = useState(false);
	const [isSearchFocused, setIsSearchFocused] = useState(false);
	const windowWidth = useWindowWidth();
	const { isVisible } = useSidebarState();
	const { toggleSidebar, setSidebarVisible, setHovered } = useSidebarActions();
	const { toggleChat, openChat, chatSurface } = useRovoChatControls();
	const isSidebarChatOpen = chatSurface === "sidebar";
	const searchContainerRef = useRef<HTMLDivElement>(null);
	const searchPanelRef = useRef<HTMLDivElement>(null);

	const searchRefs = useMemo(() => [searchContainerRef, searchPanelRef], []);

	useClickOutside(searchRefs, () => setIsSearchFocused(false), isSearchFocused);

	// Smart sidebar pin release: below the small-viewport breakpoint a persistent
	// (pinned) sidebar reserves horizontal space and overlaps the top navigation,
	// so automatically un-pin it. We remember that we released a pinned sidebar so
	// the prior pinned state is restored once the viewport grows back. `windowWidth`
	// is 0 during SSR/first paint, so we wait for a real measurement before acting.
	// The top-navigation shell (`page.tsx`) derives the same rule during render
	// from its own pin intent; this one writes shared context state, so it still
	// runs as an effect. Keep the two in step until this one is derived too.
	const didAutoReleaseSidebarRef = useRef(false);
	useEffect(() => {
		if (windowWidth === 0) {
			return;
		}
		const isSmallViewport = windowWidth < TOP_NAV_SIDEBAR_PIN_RELEASE_BREAKPOINT_PX;
		if (isSmallViewport) {
			if (isVisible) {
				didAutoReleaseSidebarRef.current = true;
				setSidebarVisible(false);
			}
		} else if (didAutoReleaseSidebarRef.current) {
			didAutoReleaseSidebarRef.current = false;
			setSidebarVisible(true);
		}
	}, [windowWidth, isVisible, setSidebarVisible]);

	const handleNavigate = useCallback(
		(path: string) => {
			router.push(path);
			setIsAppSwitcherOpen(false);
		},
		[router]
	);

	const handleSearchKeyDown = useCallback(
		(event: KeyboardEvent<HTMLInputElement>) => {
			if (event.key === "Enter") {
				router.push("/rovo");
				setIsSearchFocused(false);
			}
			if (event.key === "Escape") {
				setIsSearchFocused(false);
			}
		},
		[router]
	);

	const handleSearchAllApps = useCallback(() => {
		router.push("/rovo");
	}, [router]);

	const handleRecentItemClick = useCallback(() => {
		setIsSearchFocused(false);
	}, []);

	const handleRecentSearchClick = useCallback(
		(query: string) => {
			setSearchValue(query);
			router.push("/rovo");
			setIsSearchFocused(false);
		},
		[router]
	);

	const handleCloseSearch = useCallback(() => setIsSearchFocused(false), []);
	const handleFocusSearch = useCallback(() => setIsSearchFocused(true), []);
	const handleToggleAppSwitcher = useCallback(() => setIsAppSwitcherOpen((prev) => !prev), []);
	const handleCloseAppSwitcher = useCallback(() => setIsAppSwitcherOpen(false), []);
	const handleHoverEnter = useCallback(() => setHovered(true), [setHovered]);
	const handleHoverLeave = useCallback(() => setHovered(false), [setHovered]);

	const centerSectionStyle = useMemo(() => {
		// The center section grows to fill the available horizontal space (so the
		// search box never leaves dead gaps beside it) but caps at a max width and,
		// thanks to the parent's `justify-content: space-between`, stays centered on
		// wide layouts. Padding tightens on smaller widths.
		const base = {
			boxSizing: "border-box" as const,
			display: "flex",
			alignItems: "center",
			gap: token("space.100"),
			flex: "1 1 auto" as const,
			minWidth: 0,
			maxWidth: `${TOP_NAV_CENTER_SECTION_MAX_WIDTH_PX}px`,
			paddingLeft: token("space.150"),
			paddingRight: token("space.150"),
		};

		if (windowWidth >= 1028) {
			return base;
		}
		return { ...base, paddingLeft: token("space.100"), paddingRight: token("space.100") };
	}, [windowWidth]);

	return {
		searchValue,
		setSearchValue,
		isAppSwitcherOpen,
		isSearchFocused,
		windowWidth,
		isVisible,
		toggleSidebar,
		toggleChat,
		openChat,
		isSidebarChatOpen,
		searchContainerRef,
		searchPanelRef,
		centerSectionStyle,
		handleNavigate,
		handleSearchKeyDown,
		handleSearchAllApps,
		handleRecentItemClick,
		handleRecentSearchClick,
		handleCloseSearch,
		handleFocusSearch,
		handleToggleAppSwitcher,
		handleCloseAppSwitcher,
		handleHoverEnter,
		handleHoverLeave,
	};
}
