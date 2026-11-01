"use client";

import { useEffect } from "react";

import { useTheme } from "@/components/utils/theme-wrapper";

import { finaleAppearanceFromSearch, type FinaleAppearance } from "./finale-studio-config";

let addressApplied = false;

/** The finale's look: the app's own theme, which a page address (`?appearance=dark`) sets on load. */
export function useFinaleAppearance(): FinaleAppearance {
	const { actualTheme, setTheme } = useTheme();
	useEffect(() => {
		if (addressApplied) return;
		addressApplied = true;
		const asked = finaleAppearanceFromSearch(window.location.search);
		if (asked) setTheme(asked);
	}, [setTheme]);
	return actualTheme;
}
