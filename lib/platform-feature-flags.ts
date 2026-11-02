type PlatformFeatureFlags = {
	booleanResolver?: (flagName: string) => boolean;
};

export function configurePlatformFeatureFlags() {
	const platform = globalThis as typeof globalThis & {
		__PLATFORM_FEATURE_FLAGS__?: PlatformFeatureFlags;
	};
	const previous = platform.__PLATFORM_FEATURE_FLAGS__;
	const resolve = previous?.booleanResolver;

	platform.__PLATFORM_FEATURE_FLAGS__ = {
		...previous,
		booleanResolver: (flagName) => {
			if (flagName === "platform-dst-tokens-finesse") return true;
			if (flagName === "platform-logo-rebrand-rovo-hex") return false;
			return resolve?.(flagName) ?? false;
		},
	};
}
