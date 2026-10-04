// Runtime shims prepended to single-file artifact bundles. Each shim is serialized with
// Function#toString, so it must stay self-contained: no imports or outer-scope references.

/** Serializes a self-contained function into an immediately invoked banner statement. */
export function invokeInBanner(fn, ...args) {
	return `(${fn.toString()})(${args.map((arg) => JSON.stringify(arg)).join(", ")});`;
}

/**
 * The Artifacts viewer renders HTML in a sandboxed srcdoc frame where storage access can
 * throw. Components read localStorage directly, so swap in an in-memory store when it does.
 * Returns whether the fallback was installed.
 */
export function installStorageFallback(scope = globalThis) {
	try {
		scope.localStorage.getItem("vpk-probe");
		return false;
	} catch {
		const store = new Map();
		const memoryStorage = {
			get length() {
				return store.size;
			},
			clear: () => store.clear(),
			getItem: (key) => (store.has(String(key)) ? store.get(String(key)) : null),
			key: (index) => [...store.keys()][index] ?? null,
			removeItem: (key) => {
				store.delete(String(key));
			},
			setItem: (key, value) => {
				store.set(String(key), String(value));
			},
		};
		try {
			Object.defineProperty(scope, "localStorage", { configurable: true, value: memoryStorage });
		} catch {
			return false;
		}
		return true;
	}
}

/** VPK does not initialize Feature Gates outside the app; resolve every platform flag to false. */
export function installPlatformFeatureFlags(scope = globalThis) {
	scope.__PLATFORM_FEATURE_FLAGS__ = { booleanResolver: () => false };
}
