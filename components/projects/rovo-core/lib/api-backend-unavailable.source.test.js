const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const API_SOURCE = fs.readFileSync(path.join(__dirname, "api.ts"), "utf8");

// Regression: a backend-down stream surfaced a bare "fetch failed" in the
// composer because isRovoAppBackendUnavailableError only matched the proxy's
// normalized "Cannot connect to backend server" string. Raw transport network
// errors must also resolve to the actionable "start the backend" hint.
test("api treats raw network failures as backend-unavailable", () => {
	assert.match(API_SOURCE, /ROVO_APP_NETWORK_FAILURE_MESSAGES/u);
	assert.match(API_SOURCE, /"fetch failed"/u);
	assert.match(API_SOURCE, /"failed to fetch"/u);
	assert.match(API_SOURCE, /message === candidate \|\| message\.includes\(candidate\)/u);
});

test("api exports the shared Rovo app user error formatter", () => {
	assert.match(API_SOURCE, /export function toRovoAppUserErrorMessage\(error: unknown\): string \{/u);
	assert.match(API_SOURCE, /if \(isRovoAppBackendUnavailableError\(error\)\) \{[\s\S]*return getRovoAppBackendUnavailableUserMessage\(\);/u);
	assert.match(API_SOURCE, /return error instanceof Error \? error\.message : String\(error\);/u);
});

test("thread creation forwards cancellation to fetch without serializing it in the request body", async () => {
	const { loadRovoCoreModule } = require("../test-utils/load-rovo-core-module.cjs");
	const { createRovoAppThread } = loadRovoCoreModule("lib/api.ts");
	const originalFetch = globalThis.fetch;
	const controller = new AbortController();
	const input = { id: "thread", title: "New chat", visibility: "private", messages: [] };
	const requests = [];
	globalThis.fetch = async (url, request) => {
		requests.push({ method: request.method, body: JSON.parse(request.body), signal: request.signal });
		return new Response(JSON.stringify({ thread: input }), { headers: { "Content-Type": "application/json" } });
	};
	try {
		assert.equal((await createRovoAppThread({ ...input, signal: controller.signal })).id, "thread");
		assert.equal(requests[0].method, "POST");
		assert.deepEqual(requests[0].body, input);
		assert.equal(requests[0].signal === controller.signal, true);
		const cancelled = new DOMException("Cancelled", "AbortError");
		globalThis.fetch = (url, request) => new Promise((resolve, reject) => request.signal.addEventListener("abort", () => reject(cancelled), { once: true }));
		const pending = createRovoAppThread({ ...input, signal: controller.signal });
		controller.abort();
		await assert.rejects(pending, (error) => error === cancelled);
	} finally {
		globalThis.fetch = originalFetch;
	}
});
