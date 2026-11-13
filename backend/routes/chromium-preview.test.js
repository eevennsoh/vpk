"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const express = require("express");

const {
	createChromiumPreviewRouter,
	registerChromiumPreviewRoutes,
} = require("./chromium-preview");

function createManager(overrides = {}) {
	return {
		click: async (x, y) => ({ action: "click", x, y }),
		clickRef: async (ref) => ({ action: "clickRef", ref }),
		fillRef: async (ref, text) => ({ action: "fillRef", ref, text }),
		getState: async () => ({ url: "https://example.test", ready: true }),
		getStreamConfig: () => ({ streamUrl: "/api/chromium-preview/events" }),
		goBack: async () => ({ action: "back" }),
		goForward: async () => ({ action: "forward" }),
		hoverRef: async (ref) => ({ action: "hoverRef", ref }),
		insertText: async (text) => ({ action: "type", text }),
		navigate: async (url) => ({ action: "navigate", url }),
		press: async (key) => ({ action: "press", key }),
		reload: async () => ({ action: "reload" }),
		screenshot: async () => ({
			buffer: Buffer.from([1, 2, 3]),
			contentType: "image/png",
		}),
		scroll: async (direction, pixels) => ({ action: "scroll", direction, pixels }),
		selectRef: async (ref, values) => ({ action: "selectRef", ref, values }),
		setViewport: async (width, height) => ({ action: "viewport", width, height }),
		snapshot: async (options) => ({ action: "snapshot", ...options }),
		typeRef: async (ref, text) => ({ action: "typeRef", ref, text }),
		wheel: async (deltaX, deltaY) => ({ action: "wheel", deltaX, deltaY }),
		...overrides,
	};
}

async function withServer(dependencies, run) {
	const app = express();
	app.use(express.json({ limit: "1mb" }));
	registerChromiumPreviewRoutes(app, dependencies);

	const server = http.createServer(app);
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	const baseUrl = `http://127.0.0.1:${address.port}`;

	try {
		await run(baseUrl);
	} finally {
		await new Promise((resolve, reject) => {
			server.close((error) => {
				if (error) {
					reject(error);
					return;
				}
				resolve();
			});
		});
	}
}

test("chromium preview router validates required dependencies", () => {
	assert.throws(() => createChromiumPreviewRouter(), /chromiumPreviewManager/u);
	assert.throws(
		() => createChromiumPreviewRouter({
			chromiumPreviewManager: createManager({ navigate: null }),
		}),
		/chromiumPreviewManager\.navigate/u,
	);
	assert.throws(
		() => createChromiumPreviewRouter({
			chromiumPreviewManager: createManager(),
			getString: null,
		}),
		/getString/u,
	);
});

test("chromium preview router returns state and stream configuration", async () => {
	await withServer({
		chromiumPreviewManager: createManager(),
	}, async (baseUrl) => {
		const stateResponse = await fetch(`${baseUrl}/api/chromium-preview`);
		assert.equal(stateResponse.status, 200);
		assert.deepEqual(await stateResponse.json(), {
			ready: true,
			url: "https://example.test",
		});

		const streamResponse = await fetch(`${baseUrl}/api/chromium-preview/stream`);
		assert.equal(streamResponse.status, 200);
		assert.deepEqual(await streamResponse.json(), {
			enabled: true,
			streamUrl: "/api/chromium-preview/events",
		});
	});
});

test("chromium preview router validates navigation URL before manager call", async () => {
	let navigateCalls = 0;

	await withServer({
		chromiumPreviewManager: createManager({
			navigate: async (url) => {
				navigateCalls += 1;
				return { url };
			},
		}),
	}, async (baseUrl) => {
		const invalidResponse = await fetch(`${baseUrl}/api/chromium-preview`, {
			body: JSON.stringify({ url: " " }),
			headers: { "content-type": "application/json" },
			method: "POST",
		});
		assert.equal(invalidResponse.status, 400);
		assert.deepEqual(await invalidResponse.json(), {
			error: "A non-empty url field is required.",
		});
		assert.equal(navigateCalls, 0);

		const response = await fetch(`${baseUrl}/api/chromium-preview`, {
			body: JSON.stringify({ url: "https://example.test/page" }),
			headers: { "content-type": "application/json" },
			method: "POST",
		});
		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), {
			url: "https://example.test/page",
		});
		assert.equal(navigateCalls, 1);
	});
});

test("chromium preview router preserves ref and text validation", async () => {
	await withServer({
		chromiumPreviewManager: createManager(),
	}, async (baseUrl) => {
		const missingRefResponse = await fetch(`${baseUrl}/api/chromium-preview/click-ref`, {
			body: JSON.stringify({ ref: "" }),
			headers: { "content-type": "application/json" },
			method: "POST",
		});
		assert.equal(missingRefResponse.status, 400);
		assert.deepEqual(await missingRefResponse.json(), {
			error: "A non-empty ref field is required.",
		});

		const missingTextResponse = await fetch(`${baseUrl}/api/chromium-preview/fill-ref`, {
			body: JSON.stringify({ ref: "input-1" }),
			headers: { "content-type": "application/json" },
			method: "POST",
		});
		assert.equal(missingTextResponse.status, 400);
		assert.deepEqual(await missingTextResponse.json(), {
			error: "A text string is required.",
		});

		const response = await fetch(`${baseUrl}/api/chromium-preview/type-ref`, {
			body: JSON.stringify({ ref: "input-1", text: "hello" }),
			headers: { "content-type": "application/json" },
			method: "POST",
		});
		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), {
			action: "typeRef",
			ref: "input-1",
			text: "hello",
		});
	});
});

test("chromium preview router filters select values and validates non-empty arrays", async () => {
	await withServer({
		chromiumPreviewManager: createManager(),
	}, async (baseUrl) => {
		const invalidResponse = await fetch(`${baseUrl}/api/chromium-preview/select-ref`, {
			body: JSON.stringify({ ref: "select-1", values: [null, 42] }),
			headers: { "content-type": "application/json" },
			method: "POST",
		});
		assert.equal(invalidResponse.status, 400);
		assert.deepEqual(await invalidResponse.json(), {
			error: "A non-empty values array is required.",
		});

		const response = await fetch(`${baseUrl}/api/chromium-preview/select-ref`, {
			body: JSON.stringify({ ref: "select-1", values: ["a", 42, "b"] }),
			headers: { "content-type": "application/json" },
			method: "POST",
		});
		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), {
			action: "selectRef",
			ref: "select-1",
			values: ["a", "b"],
		});
	});
});

test("chromium preview router applies screenshot viewport query and image headers", async () => {
	const calls = [];

	await withServer({
		chromiumPreviewManager: createManager({
			screenshot: async () => {
				calls.push({ method: "screenshot" });
				return {
					buffer: Buffer.from([9, 8, 7]),
					contentType: "image/jpeg",
				};
			},
			setViewport: async (width, height) => {
				calls.push({ height, method: "setViewport", width });
				return { ok: true };
			},
		}),
	}, async (baseUrl) => {
		const response = await fetch(`${baseUrl}/api/chromium-preview/screenshot?width=800&height=600`);
		assert.equal(response.status, 200);
		assert.equal(response.headers.get("content-type"), "image/jpeg");
		assert.equal(response.headers.get("cache-control"), "no-store");
		assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.from([9, 8, 7]));
		assert.deepEqual(calls, [
			{ height: "600", method: "setViewport", width: "800" },
			{ method: "screenshot" },
		]);
	});
});

test("chromium preview router preserves manager error messages", async () => {
	const logger = {
		error: () => {},
	};

	await withServer({
		chromiumPreviewManager: createManager({
			getState: async () => {
				throw new Error("Browser unavailable");
			},
		}),
		logger,
	}, async (baseUrl) => {
		const response = await fetch(`${baseUrl}/api/chromium-preview`);
		assert.equal(response.status, 500);
		assert.deepEqual(await response.json(), {
			error: "Browser unavailable",
		});
	});
});

test("chromium preview rejects a file:, javascript: or chrome: URL before the manager runs", async () => {
	let navigateCalls = 0;
	await withServer({
		chromiumPreviewManager: createManager({
			navigate: async (url) => {
				navigateCalls += 1;
				return { url };
			},
		}),
	}, async (baseUrl) => {
		for (const url of ["file:///etc/passwd", "javascript:alert(1)", "chrome://settings", "view-source:https://e.test"]) {
			const response = await fetch(`${baseUrl}/api/chromium-preview`, {
				body: JSON.stringify({ url }),
				headers: { "content-type": "application/json" },
				method: "POST",
			});
			assert.equal(response.status, 400, url);
			assert.deepEqual(await response.json(), { error: "Only http(s) URLs and about:blank can be opened.", code: "INVALID_INPUT" });
		}
	});
	assert.equal(navigateCalls, 0);
});
