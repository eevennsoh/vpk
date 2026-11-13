const assert = require("node:assert/strict");
const test = require("node:test");
const { loadRovoCoreModule } = require("../test-utils/load-rovo-core-module.cjs");

const {
	createRovoAppRouteAdapter,
} = loadRovoCoreModule("lib/rovo-app-route-adapter.ts");

test("route adapters preserve route root and chat request options", () => {
	const rovoAdapter = createRovoAppRouteAdapter({ rootPath: "/rovo" });
	assert.deepEqual(rovoAdapter.chatRequestBodyOptions, {});
	assert.equal(rovoAdapter.rootPath, "/rovo");
	assert.equal(
		rovoAdapter.buildThreadPath("thread/with spaces"),
		"/rovo/thread%2Fwith%20spaces",
	);
	assert.equal(
		rovoAdapter.getThreadIdFromPath("/rovo/thread%2Fwith%20spaces"),
		"thread/with spaces",
	);
	assert.equal(rovoAdapter.getThreadIdFromPath("/studio/thread-1"), null);

	const studioAdapter = createRovoAppRouteAdapter({
		rootPath: "/studio",
		chatRequestBodyOptions: {
			chatSdkSource: "studio",
			includeCreationMode: true,
		},
	});
	assert.deepEqual(studioAdapter.chatRequestBodyOptions, {
		chatSdkSource: "studio",
		includeCreationMode: true,
	});
	assert.equal(studioAdapter.rootPath, "/studio");
	assert.equal(
		studioAdapter.buildThreadPath("thread/with spaces"),
		"/studio/thread%2Fwith%20spaces",
	);
	assert.equal(
		studioAdapter.getThreadIdFromPath("/studio/thread%2Fwith%20spaces"),
		"thread/with spaces",
	);
	assert.equal(studioAdapter.getThreadIdFromPath("/rovo/thread-1"), null);
});

test("route adapters expose stable enumerable configuration only", () => {
	assert.deepEqual(
		Object.keys(createRovoAppRouteAdapter({ rootPath: "/rovo" })).sort(),
		["buildThreadPath", "chatRequestBodyOptions", "getThreadIdFromPath", "rootPath"],
	);
});
