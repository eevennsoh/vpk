"use client";

import { useEffect, useState } from "react";

// Loads a module through a dynamic import the first time a surface needs it, and returns it only
// once it has arrived. A caller can hold the surface closed until then, so the first open shows the
// finished content instead of an empty frame, and the module stays out of the route's first load.

type ModuleLoader<Module> = () => Promise<Module>;

const loadedModules = new WeakMap<ModuleLoader<unknown>, unknown>();

/** Starts (or reuses) the import and caches the result, so later mounts render synchronously. */
export function preloadDeferredModule<Module>(load: ModuleLoader<Module>): Promise<Module> {
	return load().then((module) => {
		loadedModules.set(load, module);
		return module;
	});
}

/** Returns the module once `needed` has been true and the import resolved; `null` until then. */
export function useDeferredModule<Module>(load: ModuleLoader<Module>, needed: boolean): Module | null {
	const [module, setModule] = useState<Module | null>(() => (loadedModules.get(load) as Module | undefined) ?? null);

	useEffect(() => {
		if (!needed || module !== null) {
			return;
		}
		let current = true;
		preloadDeferredModule(load).then((loaded) => {
			if (current) {
				setModule(() => loaded);
			}
		}, () => {
			// A failed chunk keeps the surface closed; the next time it is needed the import retries.
		});
		return () => {
			current = false;
		};
	}, [load, module, needed]);

	return module;
}
