"use client";

import { useEffect, useRef, useState } from "react";

// Loads a module through a dynamic import the first time a surface needs it, and returns it only
// once it has arrived. A caller can hold the surface closed until then, so the first open shows the
// finished content instead of an empty frame, and the module stays out of the route's first load.
// Loaders must be stable module-level constants: the cache is keyed by the loader function.

type ModuleLoader<Module> = () => Promise<Module>;

const loadedModules = new WeakMap<ModuleLoader<unknown>, unknown>();

/**
 * Starts (or reuses) the import and caches the result, so later mounts render synchronously. Hosts
 * call it on launcher hover or focus so most opens find the module already loaded.
 */
export function preloadDeferredModule<Module>(load: ModuleLoader<Module>): Promise<Module> {
	if (loadedModules.has(load)) {
		return Promise.resolve(loadedModules.get(load) as Module);
	}
	return load().then((module) => {
		loadedModules.set(load, module);
		return module;
	});
}

interface UseDeferredModuleOptions {
	/**
	 * Called when the import fails (for example a stale chunk after a redeploy). The surface stays
	 * closed, so the host should reset whatever requested it; the import retries the next time
	 * `needed` turns true.
	 */
	onError?: (error: unknown) => void;
}

/** Returns the module once `needed` has been true and the import resolved; `null` until then. */
export function useDeferredModule<Module>(
	load: ModuleLoader<Module>,
	needed: boolean,
	{ onError }: UseDeferredModuleOptions = {},
): Module | null {
	const [module, setModule] = useState<Module | null>(() => (loadedModules.get(load) as Module | undefined) ?? null);
	const onErrorRef = useRef(onError);

	useEffect(() => {
		onErrorRef.current = onError;
	}, [onError]);

	useEffect(() => {
		if (!needed || module !== null) {
			return;
		}
		let current = true;
		preloadDeferredModule(load).then((loaded) => {
			if (current) {
				setModule(() => loaded);
			}
		}, (error: unknown) => {
			if (current) {
				onErrorRef.current?.(error);
			}
		});
		return () => {
			current = false;
		};
	}, [load, module, needed]);

	return module;
}
