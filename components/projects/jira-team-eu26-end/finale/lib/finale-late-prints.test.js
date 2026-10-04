import assert from "node:assert/strict";
import test from "node:test";

import { latePrintResolvers } from "./finale-late-prints.ts";

const resolve = () => undefined;

test("a late print still resolves when an echo without a resolver claims the key first", () => {
	const resolvers = latePrintResolvers([
		{ printKey: "TEU-1" },
		{ printKey: "TEU-1", resolvePrint: resolve },
	]);
	assert.equal(resolvers.get("TEU-1"), resolve);
});

test("keys that already have a print, or no resolver anywhere, are not pending", () => {
	const resolvers = latePrintResolvers([
		{ printKey: "TEU-1", print: {}, resolvePrint: resolve },
		{ printKey: "TEU-2" },
	]);
	assert.equal(resolvers.size, 0);
});
