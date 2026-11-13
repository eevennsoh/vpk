import assert from "node:assert/strict";
import test from "node:test";

import { loadCachedResult } from "./demo-registry-loader.ts";

test("a rejected load is retried by the next call instead of staying cached", async () => {
	const cache = new Map<string, Promise<string>>();
	let attempts = 0;
	const load = () => {
		attempts += 1;
		return attempts === 1 ? Promise.reject(new Error("chunk failed")) : Promise.resolve("table");
	};

	await assert.rejects(loadCachedResult(cache, "projects", load), /chunk failed/u);
	await Promise.resolve();
	assert.equal(cache.has("projects"), false);

	assert.equal(await loadCachedResult(cache, "projects", load), "table");
	assert.equal(await loadCachedResult(cache, "projects", load), "table");
	assert.equal(attempts, 2, "a successful load stays cached");
});

test("concurrent callers share one in-flight load", async () => {
	const cache = new Map<string, Promise<number>>();
	let attempts = 0;
	const load = () => Promise.resolve((attempts += 1));
	const [first, second] = await Promise.all([loadCachedResult(cache, "ui", load), loadCachedResult(cache, "ui", load)]);
	assert.equal(first, 1);
	assert.equal(second, 1);
	assert.equal(attempts, 1);
});
