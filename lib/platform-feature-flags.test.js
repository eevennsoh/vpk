const assert = require("node:assert/strict");
const { test } = require("node:test");
const { configurePlatformFeatureFlags } = require("./platform-feature-flags.ts");
const { getThemeStyles } = require("@atlaskit/tokens/get-theme-styles");

test("finesse themes load while unrelated platform flags keep their resolver", async () => {
	const original = globalThis.__PLATFORM_FEATURE_FLAGS__;
	try {
		globalThis.__PLATFORM_FEATURE_FLAGS__ = {
			booleanResolver: (name) => name === "existing-flag",
		};
		configurePlatformFeatureFlags();
		configurePlatformFeatureFlags();
		const resolve = globalThis.__PLATFORM_FEATURE_FLAGS__.booleanResolver;
		assert.equal(resolve("existing-flag"), true);
		assert.equal(resolve("platform-logo-rebrand-rovo-hex"), false);
		assert.equal(resolve("unknown-flag"), false);

		const styles = await getThemeStyles({
			colorMode: "auto",
			light: "light",
			dark: "dark",
			typography: "typography",
		});
		const byId = new Map(styles.map(({ id, css }) => [id, css]));
		assert.ok(byId.has("light-finesse"));
		assert.ok(byId.has("dark-finesse"));
		assert.ok(byId.has("typography-finesse"));
	} finally {
		globalThis.__PLATFORM_FEATURE_FLAGS__ = original;
	}
});
