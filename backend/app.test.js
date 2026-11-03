const assert = require("node:assert/strict");
const test = require("node:test");

const {
	createBackendApp,
} = require("./app");

test("createBackendApp wires middleware before routes and does not listen", () => {
	const calls = [];
	const fakeApp = {
		listen() {
			calls.push(["listen"]);
		},
		use(...args) {
			calls.push(["use", ...args]);
		},
	};
	const runtimeControls = {
		appendRuntimeSocketToken: () => {},
		createRuntimeSocketToken: () => {},
		isAllowedRuntimeSocketOrigin: () => true,
		isRuntimeSocketTokenValid: () => true,
		requireRuntimeAdmin: () => {},
		requireRuntimeSocketTokenRequester: () => {},
		runtimeAdminRequired: true,
		runtimeAdminToken: "runtime-token",
		runtimeSocketTokenTtlMs: 1000,
	};
	let routeDependencies;

	const result = createBackendApp(
		{
			expressImpl: () => fakeApp,
			logger: {
				log: (...args) => calls.push(["log", ...args]),
			},
			serviceValue: "service",
		},
		{
			createRuntimeAdmin: ({ allowedOrigins }) => {
				calls.push(["runtime-admin", allowedOrigins]);
				return runtimeControls;
			},
			registerAiCostRateLimit: (app) => {
				assert.equal(app, fakeApp);
				calls.push(["rate-limit"]);
			},
			registerBodyLimit: (app, { expressImpl }) => {
				assert.equal(app, fakeApp);
				assert.equal(typeof expressImpl, "function");
				calls.push(["body-limit"]);
			},
			registerRoutes: (app, dependencies) => {
				assert.equal(app, fakeApp);
				calls.push(["routes"]);
				routeDependencies = dependencies;
			},
			registerSecurity: (app) => {
				assert.equal(app, fakeApp);
				calls.push(["security"]);
				return { allowedOrigins: ["https://vpk.localhost"] };
			},
		},
	);

	assert.equal(result.app, fakeApp);
	assert.deepEqual(result.allowedOrigins, ["https://vpk.localhost"]);
	assert.equal(result.runtimeAdminRequired, true);
	assert.equal(result.runtimeAdminToken, "runtime-token");
	assert.equal(routeDependencies.serviceValue, "service");
	assert.equal(routeDependencies.requireRuntimeAdmin, runtimeControls.requireRuntimeAdmin);
	assert.equal(calls[0][0], "use");
	assert.equal(calls[0][1], "/api/local-folder");
	assert.deepEqual(calls.slice(1), [
		["security"],
		["runtime-admin", ["https://vpk.localhost"]],
		["rate-limit"],
		["body-limit"],
		["log", "[STARTUP] Middleware configured"],
		["routes"],
	]);
});
