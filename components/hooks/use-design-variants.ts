"use client";

import { useEffect, useSyncExternalStore } from "react";

import {
	DESIGN_VARIANTS_STORAGE_KEY,
	getDefaultDesignVariants,
	getDesignVariants,
	hydrateClientDesignVariants,
	hydrateDesignVariants,
	readStoredDesignVariants,
	setDesignVariant,
	subscribeToDesignVariants,
	type DesignVariantId,
	type DesignVariantState,
} from "@/components/utils/design-variants";

interface UseDesignVariantsResult {
	designVariants: DesignVariantState;
	setDesignVariant: (id: DesignVariantId, enabled: boolean) => void;
}

/**
 * Reads and writes the global design-variant toggles.
 *
 * Hydration-safe: `useSyncExternalStore` renders the store default on the
 * server and during hydration, then an effect adopts the stored preferences
 * and this document's `?variants=` URL overrides — the same shape
 * `ThemeWrapper` uses for `ui-theme`. Any variant-driven UI must therefore
 * tolerate one paint at the default before a stored or URL override applies.
 */
export function useDesignVariants(): UseDesignVariantsResult {
	const designVariants = useSyncExternalStore(
		subscribeToDesignVariants,
		getDesignVariants,
		getDefaultDesignVariants,
	);

	// Adopt the stored preferences after mount. The store reads the URL only on
	// its first client hydration, so later mounts and client navigations reuse it.
	useEffect(() => {
		hydrateClientDesignVariants(window.location.search);
	}, []);

	// Keep tabs in sync. The writing tab already persisted the value, so re-read
	// and adopt it without writing back; a cleared key falls back to the default.
	useEffect(() => {
		const handleStorage = (event: StorageEvent) => {
			if (event.key !== DESIGN_VARIANTS_STORAGE_KEY) {
				return;
			}
			hydrateDesignVariants(readStoredDesignVariants() ?? getDefaultDesignVariants());
		};

		window.addEventListener("storage", handleStorage);
		return () => {
			window.removeEventListener("storage", handleStorage);
		};
	}, []);

	return { designVariants, setDesignVariant };
}
