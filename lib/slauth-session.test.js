const test = require("node:test");
const assert = require("node:assert/strict");

const {
	SLAUTH_LOGIN_ATTEMPT_KEY,
	SLAUTH_LOGIN_COOLDOWN_MS,
	buildSlauthLoginUrl,
	classifyWatchedResponse,
	createSlauthWatchedFetch,
	isSameOriginRequest,
	isSlauthSessionFailure,
} = require("./slauth-session.ts");

const ORIGIN = "https://vpk.us-west-2.platdev.atl-paas.net";
const HREF = `${ORIGIN}/rovo?thread=a&b=1`;

function fakeResponse({ status = 200, type = "basic", slauthResult = null } = {}) {
	return {
		status,
		type,
		headers: { get: (name) => (name.toLowerCase() === "x-slauth-result" ? slauthResult : null) },
	};
}

function createHost(now = 1_000_000) {
	const store = new Map();
	const host = {
		assigned: [],
		clock: now,
		location: {
			href: HREF,
			origin: ORIGIN,
			pathname: "/rovo",
			assign: (url) => host.assigned.push(url),
		},
		storage: {
			getItem: (key) => (store.has(key) ? store.get(key) : null),
			setItem: (key, value) => store.set(key, value),
		},
		now: () => host.clock,
		store,
	};
	return host;
}

const LOGIN_URL = `/saml/login?redirect=${encodeURIComponent(HREF)}`;

test("the probe reads a 401, an opaque redirect, or a redirect marked x-slauth-result failure as an expired session", () => {
	assert.equal(isSlauthSessionFailure({ status: 401 }), true);
	assert.equal(isSlauthSessionFailure({ status: 0, type: "opaqueredirect" }), true);
	assert.equal(isSlauthSessionFailure({ status: 302, slauthResult: "failure" }), true);
	assert.equal(isSlauthSessionFailure({ status: 302, slauthResult: null }), false);
	assert.equal(isSlauthSessionFailure({ status: 403, slauthResult: "forbidden" }), false);
	assert.equal(isSlauthSessionFailure({ status: 200 }), false);
});

test("a watched response is a session failure only when the sidecar marks it; an unmarked 401 is probed", () => {
	assert.equal(classifyWatchedResponse({ status: 401, slauthResult: "failure" }), "failure");
	assert.equal(classifyWatchedResponse({ status: 302, slauthResult: "FAILURE" }), "failure");
	assert.equal(classifyWatchedResponse({ status: 401 }), "probe");
	assert.equal(classifyWatchedResponse({ status: 0, type: "opaqueredirect" }), "ok");
	assert.equal(classifyWatchedResponse({ status: 302 }), "ok");
	assert.equal(classifyWatchedResponse({ status: 200, slauthResult: "failure" }), "ok");
});

test("the login URL sends the user back to the exact page", () => {
	assert.equal(buildSlauthLoginUrl(HREF), LOGIN_URL);
});

test("only same-origin requests count", () => {
	assert.equal(isSameOriginRequest("/api/rovo/threads", ORIGIN), true);
	assert.equal(isSameOriginRequest(`${ORIGIN}/api/health`, ORIGIN), true);
	assert.equal(isSameOriginRequest(new URL("https://example.com/x"), ORIGIN), false);
	assert.equal(isSameOriginRequest({ url: "https://example.com/x" }, ORIGIN), false);
});

test("a background fetch the sidecar answers with a marked 401 sends the page through /saml/login, and still returns the response", async () => {
	const host = createHost();
	const response = fakeResponse({ status: 401, slauthResult: "failure" });
	const watched = createSlauthWatchedFetch(async () => response, host);
	assert.equal(await watched("/api/rovo/threads"), response);
	assert.deepEqual(host.assigned, [LOGIN_URL]);
	assert.equal(host.store.get(SLAUTH_LOGIN_ATTEMPT_KEY), String(host.clock));
});

test("an app-level 401 with a valid session (the probe gets 200) does not sign in", async () => {
	const host = createHost();
	const probes = [];
	const watched = createSlauthWatchedFetch(async (_input, init) => {
		if (init?.redirect === "manual") {
			probes.push(init);
			return fakeResponse({ status: 200 });
		}
		return fakeResponse({ status: 401 });
	}, host);
	await watched("/api/personal-graph");
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(probes.length, 1);
	assert.deepEqual(host.assigned, []);
});

test("an unmarked 401 whose probe also gets 401 signs in", async () => {
	const host = createHost();
	const watched = createSlauthWatchedFetch(async () => fakeResponse({ status: 401 }), host);
	await watched("/api/rovo/threads");
	await new Promise((resolve) => setImmediate(resolve));
	assert.deepEqual(host.assigned, [LOGIN_URL]);
});

test("a fetch that asked for redirect manual and got an opaque redirect is left alone", async () => {
	const host = createHost();
	let probes = 0;
	const watched = createSlauthWatchedFetch(async (_input, init) => {
		if (init?.method === "HEAD") probes += 1;
		return fakeResponse({ status: 0, type: "opaqueredirect" });
	}, host);
	await watched("/api/download", { redirect: "manual" });
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(probes, 0);
	assert.deepEqual(host.assigned, []);
});

test("a burst of failed fetches shares one in-flight probe", async () => {
	const host = createHost();
	let probes = 0;
	let releaseProbe;
	const watched = createSlauthWatchedFetch(async (_input, init) => {
		if (init?.redirect === "manual") {
			probes += 1;
			await new Promise((resolve) => { releaseProbe = resolve; });
			return fakeResponse({ status: 200 });
		}
		throw new TypeError("Failed to fetch");
	}, host);
	await Promise.allSettled([watched("/api/a"), watched("/api/b"), watched("/api/c")]);
	assert.equal(probes, 1);
	releaseProbe();
	await new Promise((resolve) => setImmediate(resolve));
	await Promise.allSettled([watched("/api/d")]);
	assert.equal(probes, 2);
	releaseProbe();
});

test("a redirect marked x-slauth-result failure sends the page through /saml/login", async () => {
	const host = createHost();
	const watched = createSlauthWatchedFetch(async () => fakeResponse({ status: 302, slauthResult: "failure" }), host);
	await watched("/api/rovo/threads");
	assert.deepEqual(host.assigned, [LOGIN_URL]);
});

test("a cross-origin 401 is not this app's session and is left alone", async () => {
	const host = createHost();
	const watched = createSlauthWatchedFetch(async () => fakeResponse({ status: 401, slauthResult: "failure" }), host);
	await watched("https://api.example.com/data");
	assert.deepEqual(host.assigned, []);
});

test("a same-origin fetch that fails as a network error is probed; an opaque redirect means sign in again", async () => {
	const host = createHost();
	const calls = [];
	const watched = createSlauthWatchedFetch(async (input, init) => {
		calls.push({ input, init });
		if (init?.redirect === "manual") return fakeResponse({ status: 0, type: "opaqueredirect" });
		throw new TypeError("Failed to fetch");
	}, host);
	await assert.rejects(watched("/api/rovo/threads"), /Failed to fetch/u);
	await new Promise((resolve) => setImmediate(resolve));
	assert.deepEqual(calls[1], {
		input: "/rovo",
		init: { cache: "no-store", credentials: "same-origin", method: "HEAD", redirect: "manual" },
	});
	assert.deepEqual(host.assigned, [LOGIN_URL]);
});

test("a network error whose probe succeeds, or an aborted fetch, does not sign in", async () => {
	const host = createHost();
	const calls = [];
	const watched = createSlauthWatchedFetch(async (_input, init) => {
		calls.push(init);
		if (init?.redirect === "manual") return fakeResponse({ status: 200 });
		if (init?.signal) {
			const error = new Error("aborted");
			error.name = "AbortError";
			throw error;
		}
		throw new TypeError("Failed to fetch");
	}, host);
	await assert.rejects(watched("/api/x"));
	await assert.rejects(watched("/api/x", { signal: {} }));
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(calls.filter((init) => init?.redirect === "manual").length, 1);
	assert.deepEqual(host.assigned, []);
});

test("sign-in is attempted at most once per cooldown so a failing login cannot loop the page", async () => {
	const host = createHost();
	const watched = createSlauthWatchedFetch(async () => fakeResponse({ status: 401, slauthResult: "failure" }), host);
	await watched("/api/a");
	await watched("/api/b");
	assert.equal(host.assigned.length, 1);
	host.clock += SLAUTH_LOGIN_COOLDOWN_MS;
	await watched("/api/c");
	assert.equal(host.assigned.length, 2);
});
