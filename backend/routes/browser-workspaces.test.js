"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const express = require("express");

const {
	createBrowserWorkspacesRouter,
	registerBrowserWorkspacesRoutes,
	resolveBrowserWorkspaceTabIndex,
} = require("./browser-workspaces");

class BrowserWorkspaceNotFoundError extends Error {
	constructor(workspaceId) {
		super(`Browser workspace not found: ${workspaceId}`);
		this.name = "BrowserWorkspaceNotFoundError";
	}
}

function isBrowserWorkspaceNotFoundError(error) {
	return error instanceof BrowserWorkspaceNotFoundError;
}

function createManager(overrides = {}) {
	const calls = [];
	const manager = {
		calls,
		activateWorkspaceTab: async (workspaceId, tabIndex) => {
			calls.push({ method: "activateWorkspaceTab", tabIndex, workspaceId });
			return { activeTabIndex: tabIndex, workspaceId };
		},
		clickWorkspace: async (workspaceId, x, y) => ({ action: "click", workspaceId, x, y }),
		clickWorkspaceRef: async (workspaceId, ref) => ({ action: "click-ref", ref, workspaceId }),
		closeWorkspaceTab: async (workspaceId, tabIndex) => {
			calls.push({ method: "closeWorkspaceTab", tabIndex, workspaceId });
			return { closedTabIndex: tabIndex, workspaceId };
		},
		createWorkspace: async ({ defaultUrl } = {}) => {
			calls.push({ defaultUrl, method: "createWorkspace" });
			return { defaultUrl, workspaceId: "workspace-1" };
		},
		createWorkspacePreviewSession: async (workspaceId, offerSdp) => {
			calls.push({ method: "createWorkspacePreviewSession", offerSdp, workspaceId });
			return { answerSdp: "answer", sessionId: "session-1" };
		},
		createWorkspaceTab: async (workspaceId, url) => {
			calls.push({ method: "createWorkspaceTab", url, workspaceId });
			return { activeTabIndex: 1, workspaceId };
		},
		deleteWorkspace: async (workspaceId) => ({ deleted: true, workspaceId }),
		deleteWorkspacePreviewSession: async (workspaceId, sessionId) => {
			calls.push({ method: "deleteWorkspacePreviewSession", sessionId, workspaceId });
			return { deleted: true, sessionId, workspaceId };
		},
		fillWorkspaceRef: async (workspaceId, ref, text) => ({ action: "fill-ref", ref, text, workspaceId }),
		getWorkspaceScreenshot: async (workspaceId) => {
			calls.push({ method: "getWorkspaceScreenshot", workspaceId });
			return {
				buffer: Buffer.from([5, 4, 3]),
				contentType: "image/png",
			};
		},
		getWorkspaceSnapshot: async (workspaceId, options) => ({ options, snapshot: "tree", workspaceId }),
		getWorkspaceState: async (workspaceId) => ({ url: "about:blank", workspaceId }),
		getWorkspaceStream: (workspaceId) => ({ mode: "workspace", workspaceId }),
		getWorkspaceTabs: async (workspaceId) => [{ active: true, index: 0, workspaceId }],
		goBack: async (workspaceId) => ({ action: "back", workspaceId }),
		goForward: async (workspaceId) => ({ action: "forward", workspaceId }),
		hoverWorkspaceRef: async (workspaceId, ref) => ({ action: "hover-ref", ref, workspaceId }),
		listWorkspaces: () => [{ workspaceId: "workspace-1" }],
		navigateWorkspace: async (workspaceId, url) => ({ action: "navigate", url, workspaceId }),
		pressWorkspaceKey: async (workspaceId, key) => ({ action: "press", key, workspaceId }),
		reloadWorkspace: async (workspaceId) => ({ action: "reload", workspaceId }),
		resizeWorkspace: async (workspaceId, width, height, deviceScaleFactor) => {
			calls.push({ deviceScaleFactor, height, method: "resizeWorkspace", width, workspaceId });
			return { height, width, workspaceId };
		},
		scrollWorkspace: async (workspaceId, direction, pixels) => ({ action: "scroll", direction, pixels, workspaceId }),
		selectWorkspaceRef: async (workspaceId, ref, values) => ({ action: "select-ref", ref, values, workspaceId }),
		typeWorkspaceRef: async (workspaceId, ref, text) => ({ action: "type-ref", ref, text, workspaceId }),
		typeWorkspaceText: async (workspaceId, text) => ({ action: "type", text, workspaceId }),
		wheelWorkspace: async (workspaceId, deltaX, deltaY) => ({ action: "wheel", deltaX, deltaY, workspaceId }),
		...overrides,
	};
	return manager;
}

async function withServer(dependencies, run) {
	const app = express();
	app.use(express.json({ limit: "1mb" }));
	registerBrowserWorkspacesRoutes(app, dependencies);

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

function createDependencies(overrides = {}) {
	return {
		appendRuntimeSocketToken: (url, scope, paramName) => `${url}?${paramName}=${encodeURIComponent(scope)}`,
		browserWorkspaceManager: createManager(),
		getMirrorBrowser: () => null,
		isBrowserWorkspaceNotFoundError,
		logger: {
			error: () => {},
			warn: () => {},
		},
		requireRuntimeAdmin: (req, res, next) => {
			if (req.get("x-runtime-admin") === "ok") {
				next();
				return;
			}
			res.status(403).json({ error: "Runtime admin authorization required" });
		},
		runtimePort: 4123,
		...overrides,
	};
}

test("browser workspaces router validates required dependencies", () => {
	assert.throws(() => createBrowserWorkspacesRouter(), /browserWorkspaceManager/u);
	assert.throws(
		() => createBrowserWorkspacesRouter(createDependencies({
			browserWorkspaceManager: createManager({ createWorkspace: null }),
		})),
		/browserWorkspaceManager\.createWorkspace/u,
	);
	assert.throws(
		() => createBrowserWorkspacesRouter(createDependencies({ appendRuntimeSocketToken: null })),
		/appendRuntimeSocketToken/u,
	);
	assert.throws(
		() => registerBrowserWorkspacesRoutes(express(), createDependencies({ requireRuntimeAdmin: null })),
		/requireRuntimeAdmin/u,
	);
});

test("browser workspaces routes are protected by runtime admin middleware", async () => {
	await withServer(createDependencies(), async (baseUrl) => {
		const blockedResponse = await fetch(`${baseUrl}/api/browser-workspaces`);
		assert.equal(blockedResponse.status, 403);
		assert.deepEqual(await blockedResponse.json(), {
			error: "Runtime admin authorization required",
		});

		const response = await fetch(`${baseUrl}/api/browser-workspaces`, {
			headers: { "x-runtime-admin": "ok" },
		});
		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), {
			workspaces: [{ workspaceId: "workspace-1" }],
		});
	});
});

test("browser workspaces router preserves create and state routes", async () => {
	const manager = createManager();

	await withServer(createDependencies({ browserWorkspaceManager: manager }), async (baseUrl) => {
		const createResponse = await fetch(`${baseUrl}/api/browser-workspaces`, {
			body: JSON.stringify({ defaultUrl: "https://example.test" }),
			headers: {
				"content-type": "application/json",
				"x-runtime-admin": "ok",
			},
			method: "POST",
		});
		assert.equal(createResponse.status, 201);
		assert.deepEqual(await createResponse.json(), {
			defaultUrl: "https://example.test",
			workspaceId: "workspace-1",
		});

		const stateResponse = await fetch(`${baseUrl}/api/browser-workspaces/workspace-1`, {
			headers: { "x-runtime-admin": "ok" },
		});
		assert.equal(stateResponse.status, 200);
		assert.deepEqual(await stateResponse.json(), {
			url: "about:blank",
			workspaceId: "workspace-1",
		});
		assert.deepEqual(manager.calls[0], {
			defaultUrl: "https://example.test",
			method: "createWorkspace",
		});
	});
});

test("browser workspaces router maps missing workspaces to 404", async () => {
	await withServer(createDependencies({
		browserWorkspaceManager: createManager({
			getWorkspaceState: async (workspaceId) => {
				throw new BrowserWorkspaceNotFoundError(workspaceId);
			},
		}),
	}), async (baseUrl) => {
		const response = await fetch(`${baseUrl}/api/browser-workspaces/missing`, {
			headers: { "x-runtime-admin": "ok" },
		});
		assert.equal(response.status, 404);
		assert.deepEqual(await response.json(), {
			error: "Browser workspace not found: missing",
		});
	});
});

test("browser workspaces router answers a crashed workspace with 404 and the cap with 503", async () => {
	const lifecycle = require("../lib/browser-workspace-lifecycle");
	await withServer(createDependencies({
		browserWorkspaceManager: createManager({
			createWorkspace: async () => {
				throw new lifecycle.BrowserWorkspaceLimitError(4);
			},
			getWorkspaceState: async (workspaceId) => {
				throw new lifecycle.BrowserWorkspaceUnavailableError(workspaceId, lifecycle.BROWSER_WORKSPACE_ERROR_CODES.CRASHED, "exited");
			},
		}),
		isBrowserWorkspaceNotFoundError: lifecycle.isBrowserWorkspaceNotFoundError,
	}), async (baseUrl) => {
		const headers = { "x-runtime-admin": "ok", "content-type": "application/json" };
		const crashed = await fetch(`${baseUrl}/api/browser-workspaces/w1`, { headers });
		assert.equal(crashed.status, 404);
		assert.deepEqual(await crashed.json(), { error: "Browser workspace crashed: w1 (exited)" });

		const capped = await fetch(`${baseUrl}/api/browser-workspaces`, { method: "POST", headers, body: "{}" });
		assert.equal(capped.status, 503);
		assert.deepEqual(await capped.json(), {
			error: "Browser workspace limit reached: 4 workspaces are open; close one before creating another.",
		});
	});
});

test("browser workspaces router validates tab and preview-session inputs", async () => {
	await withServer(createDependencies(), async (baseUrl) => {
		const invalidTabResponse = await fetch(`${baseUrl}/api/browser-workspaces/workspace-1/tabs/not-a-number/activate`, {
			headers: { "x-runtime-admin": "ok" },
			method: "POST",
		});
		assert.equal(invalidTabResponse.status, 400);
		assert.deepEqual(await invalidTabResponse.json(), {
			error: "A non-negative tabIndex route param is required.",
		});

		const invalidSessionResponse = await fetch(`${baseUrl}/api/browser-workspaces/workspace-1/preview-session`, {
			body: JSON.stringify({ offerSdp: "" }),
			headers: {
				"content-type": "application/json",
				"x-runtime-admin": "ok",
			},
			method: "POST",
		});
		assert.equal(invalidSessionResponse.status, 400);
		assert.deepEqual(await invalidSessionResponse.json(), {
			error: "A non-empty offerSdp field is required.",
		});
	});
});

test("browser workspaces router preserves tab and preview-session flows", async () => {
	const manager = createManager();

	await withServer(createDependencies({ browserWorkspaceManager: manager }), async (baseUrl) => {
		const createTabResponse = await fetch(`${baseUrl}/api/browser-workspaces/workspace-1/tabs`, {
			body: JSON.stringify({ url: "https://example.test/tab" }),
			headers: {
				"content-type": "application/json",
				"x-runtime-admin": "ok",
			},
			method: "POST",
		});
		assert.equal(createTabResponse.status, 200);
		assert.deepEqual(await createTabResponse.json(), {
			activeTabIndex: 1,
			workspaceId: "workspace-1",
		});

		const sessionResponse = await fetch(`${baseUrl}/api/browser-workspaces/workspace-1/preview-session`, {
			body: JSON.stringify({ offerSdp: "offer" }),
			headers: {
				"content-type": "application/json",
				"x-runtime-admin": "ok",
			},
			method: "POST",
		});
		assert.equal(sessionResponse.status, 201);
		assert.deepEqual(await sessionResponse.json(), {
			answerSdp: "answer",
			sessionId: "session-1",
		});

		assert.deepEqual(manager.calls.filter((call) => call.method === "createWorkspaceTab"), [{
			method: "createWorkspaceTab",
			url: "https://example.test/tab",
			workspaceId: "workspace-1",
		}]);
		assert.deepEqual(manager.calls.filter((call) => call.method === "createWorkspacePreviewSession"), [{
			method: "createWorkspacePreviewSession",
			offerSdp: "offer",
			workspaceId: "workspace-1",
		}]);
	});
});

test("browser workspaces router tokenizes stream URLs and prefers mirror streams", async () => {
	await withServer(createDependencies({
		getMirrorBrowser: (workspaceId) => ({
			getStreamConfig: (runtimePort) => ({
				mode: "mirror",
				wsUrl: `ws://127.0.0.1:${runtimePort}/mirror/${workspaceId}`,
			}),
		}),
	}), async (baseUrl) => {
		const response = await fetch(`${baseUrl}/api/browser-workspaces/mirror-1/stream`, {
			headers: { "x-runtime-admin": "ok" },
		});
		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), {
			mode: "mirror",
			wsUrl: "ws://127.0.0.1:4123/mirror/mirror-1?previewToken=browser-preview%3Amirror-1",
		});
	});
});

test("browser workspaces router returns workspace stream URLs when no mirror exists", async () => {
	await withServer(createDependencies(), async (baseUrl) => {
		const response = await fetch(`${baseUrl}/api/browser-workspaces/workspace-1/stream`, {
			headers: { "x-runtime-admin": "ok" },
		});
		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), {
			mode: "workspace",
			workspaceId: "workspace-1",
			wsUrl: "ws://127.0.0.1:4123/api/browser-workspaces/workspace-1/live?previewToken=browser-preview%3Aworkspace-1",
		});
	});
});

test("browser workspaces router applies screenshot viewport query and image headers", async () => {
	const manager = createManager();

	await withServer(createDependencies({ browserWorkspaceManager: manager }), async (baseUrl) => {
		const response = await fetch(`${baseUrl}/api/browser-workspaces/workspace-1/screenshot?width=800&height=600`, {
			headers: { "x-runtime-admin": "ok" },
		});
		assert.equal(response.status, 200);
		assert.equal(response.headers.get("content-type"), "image/png");
		assert.equal(response.headers.get("cache-control"), "no-store");
		assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.from([5, 4, 3]));
		assert.deepEqual(manager.calls.filter((call) => call.method === "resizeWorkspace"), [{
			deviceScaleFactor: undefined,
			height: "600",
			method: "resizeWorkspace",
			width: "800",
			workspaceId: "workspace-1",
		}]);
		assert.deepEqual(manager.calls.filter((call) => call.method === "getWorkspaceScreenshot"), [{
			method: "getWorkspaceScreenshot",
			workspaceId: "workspace-1",
		}]);
	});
});

test("browser workspaces router validates mutation actions and handles unsupported actions", async () => {
	await withServer(createDependencies(), async (baseUrl) => {
		const invalidNavigateResponse = await fetch(`${baseUrl}/api/browser-workspaces/workspace-1/navigate`, {
			body: JSON.stringify({ url: "" }),
			headers: {
				"content-type": "application/json",
				"x-runtime-admin": "ok",
			},
			method: "POST",
		});
		assert.equal(invalidNavigateResponse.status, 400);
		assert.deepEqual(await invalidNavigateResponse.json(), {
			error: "A non-empty url field is required.",
		});

		const invalidActionResponse = await fetch(`${baseUrl}/api/browser-workspaces/workspace-1/not-supported`, {
			headers: { "x-runtime-admin": "ok" },
			method: "POST",
		});
		assert.equal(invalidActionResponse.status, 404);
		assert.deepEqual(await invalidActionResponse.json(), {
			error: "Unsupported browser workspace action.",
		});
	});
});

test("resolveBrowserWorkspaceTabIndex accepts only non-negative integers", () => {
	assert.equal(resolveBrowserWorkspaceTabIndex({ params: { tabIndex: "0" } }), 0);
	assert.equal(resolveBrowserWorkspaceTabIndex({ params: { tabIndex: "7" } }), 7);
	assert.equal(resolveBrowserWorkspaceTabIndex({ params: { tabIndex: "-1" } }), null);
	assert.equal(resolveBrowserWorkspaceTabIndex({ params: { tabIndex: "abc" } }), null);
});
