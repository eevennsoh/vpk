"use client";

import { createContext, use, useCallback, useMemo, useState, type ReactNode } from "react";

type Product = "admin" | "agents" | "home" | "jira" | "confluence" | "rovo" | "search" | "studio";

/**
 * Sidebar State (low-frequency: pin/visibility and route).
 *
 * Hover reveal lives in its own context (`useSidebarHovered`) because it flips
 * on every pointer pass over the top-navigation toggle; keeping it out of this
 * object means visibility readers (TopNavigation, the Rovo shells) do not
 * re-render on hover.
 */
export interface SidebarState {
	isVisible: boolean;
	currentRoute: Product;
}

/**
 * Sidebar Actions (stable for the provider's lifetime).
 */
export interface SidebarActions {
	toggleSidebar: () => void;
	setSidebarVisible: (visible: boolean) => void;
	setHovered: (hovered: boolean) => void;
	setCurrentRoute: (route: Product) => void;
}

const SidebarStateContext = createContext<SidebarState | null>(null);
const SidebarHoverContext = createContext<boolean | null>(null);
const SidebarActionsContext = createContext<SidebarActions | null>(null);

interface SidebarProviderProps {
	children: ReactNode;
	defaultVisible?: boolean;
}

export function SidebarProvider({ children, defaultVisible = false }: Readonly<SidebarProviderProps>) {
	const [isVisible, setIsVisible] = useState(defaultVisible);
	const [isHovered, setIsHovered] = useState(false);
	const [currentRoute, setCurrentRoute] = useState<Product>("home");

	const state: SidebarState = useMemo(() => ({ isVisible, currentRoute }), [isVisible, currentRoute]);

	const toggleSidebar = useCallback(() => setIsVisible((prev) => !prev), []);
	const setSidebarVisible = useCallback((visible: boolean) => setIsVisible(visible), []);
	const setHovered = useCallback((hovered: boolean) => setIsHovered(hovered), []);

	const actions: SidebarActions = useMemo(
		() => ({ toggleSidebar, setSidebarVisible, setHovered, setCurrentRoute }),
		[toggleSidebar, setSidebarVisible, setHovered, setCurrentRoute],
	);

	return (
		<SidebarActionsContext value={actions}>
			<SidebarStateContext value={state}>
				<SidebarHoverContext value={isHovered}>{children}</SidebarHoverContext>
			</SidebarStateContext>
		</SidebarActionsContext>
	);
}

function useRequiredSidebarContext<T>(value: T | null, hookName: string): T {
	if (value === null) {
		throw new Error(`${hookName} must be used within a SidebarProvider`);
	}
	return value;
}

/**
 * Sidebar visibility and route. Does not change on hover.
 */
export function useSidebarState(): SidebarState {
	return useRequiredSidebarContext(use(SidebarStateContext), "useSidebarState");
}

/**
 * Whether the collapsed sidebar is hover-revealed. Only components that paint
 * the hover reveal should read this; it changes on every hover in/out.
 */
export function useSidebarHovered(): boolean {
	return useRequiredSidebarContext(use(SidebarHoverContext), "useSidebarHovered");
}

/**
 * Stable sidebar actions. Never re-renders the caller on state changes.
 */
export function useSidebarActions(): SidebarActions {
	return useRequiredSidebarContext(use(SidebarActionsContext), "useSidebarActions");
}
