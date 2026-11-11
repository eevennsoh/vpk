const assert = require("node:assert/strict");
const { test } = require("node:test");
const { configurePlatformFeatureFlags } = require("./platform-feature-flags.ts");
const { getThemeStyles } = require("@atlaskit/tokens/get-theme-styles");

test("finesse themes load while unrelated platform flags keep their resolver", async () => {
	const original = globalThis.__PLATFORM_FEATURE_FLAGS__;
	const originalFinesse = process.env.NEXT_PUBLIC_PLATFORM_DST_TOKENS_FINESSE;
	try {
		delete process.env.NEXT_PUBLIC_PLATFORM_DST_TOKENS_FINESSE;
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

		process.env.NEXT_PUBLIC_PLATFORM_DST_TOKENS_FINESSE = "false";
		assert.equal(resolve("platform-dst-tokens-finesse"), false);
		const withoutFinesse = await getThemeStyles({
			colorMode: "auto",
			light: "light",
			dark: "dark",
			typography: "typography",
		});
		assert.equal(withoutFinesse.some(({ id }) => id.endsWith("-finesse")), false);
	} finally {
		if (originalFinesse === undefined) delete process.env.NEXT_PUBLIC_PLATFORM_DST_TOKENS_FINESSE;
		else process.env.NEXT_PUBLIC_PLATFORM_DST_TOKENS_FINESSE = originalFinesse;
		globalThis.__PLATFORM_FEATURE_FLAGS__ = original;
	}
});
