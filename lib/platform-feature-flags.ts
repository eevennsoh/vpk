type PlatformFeatureFlags = {
	booleanResolver?: (flagName: string) => boolean;
};

export function isFinesseEnabled() {
	return process.env.NEXT_PUBLIC_PLATFORM_DST_TOKENS_FINESSE !== "false";
}

export function configurePlatformFeatureFlags() {
	const platform = globalThis as typeof globalThis & {
		__PLATFORM_FEATURE_FLAGS__?: PlatformFeatureFlags;
	};
	const previous = platform.__PLATFORM_FEATURE_FLAGS__;
	const resolve = previous?.booleanResolver;

	platform.__PLATFORM_FEATURE_FLAGS__ = {
		...previous,
		booleanResolver: (flagName) => {
			if (flagName === "platform-dst-tokens-finesse") return isFinesseEnabled();
			if (flagName === "platform-logo-rebrand-rovo-hex") return false;
			return resolve?.(flagName) ?? false;
		},
	};
}
