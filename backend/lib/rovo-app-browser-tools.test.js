const test = require("node:test")
const assert = require("node:assert/strict")

const {
	createDefaultWorkspaceBindings,
	createThreadBrowserBridge,
} = require("./rovo-app-browser-tools")

function createWorkspaceBindings() {
	return {
		async ensureThreadWorkspace(threadId) {
			assert.equal(threadId, "thread-browser-bridge")
			return {
				state: {
					title: "about:blank",
					url: "about:blank",
				},
				streamConfig: {
					enabled: true,
					wsUrl: "/api/browser-workspaces/workspace-1/live",
				},
				workspaceId: "workspace-1",
			}
		},
		async getThreadWorkspace(threadId) {
			assert.equal(threadId, "thread-browser-bridge")
			return {
				state: {
					title: "Example Domain",
					url: "https://example.com",
				},
				streamConfig: {
					enabled: true,
					wsUrl: "/api/browser-workspaces/workspace-1/live",
				},
				workspaceId: "workspace-1",
			}
		},
		async getThreadWorkspaceScreenshot(threadId) {
			assert.equal(threadId, "thread-browser-bridge")
			return {
				buffer: Buffer.from("screenshot-bytes"),
				contentType: "image/png",
				state: {
					url: "https://example.com",
				},
				workspaceId: "workspace-1",
			}
		},
	}
}

function createScreenshotStore() {
	return {
		async persistScreenshot({ buffer, contentType, threadId, workspaceId }) {
			assert.equal(threadId, "thread-browser-bridge")
			assert.equal(workspaceId, "workspace-1")
			assert.equal(contentType, "image/png")
			assert.equal(Buffer.isBuffer(buffer), true)
			return {
				contentType,
				height: 1538,
				imageUrl: "/api/rovo/files/upload-browser-shot",
				width: 2400,
			}
		},
	}
}

test("browser bridge emits thread-bound workspace state immediately on navigate start and result", async () => {
	const writes = []
	const bridge = createThreadBrowserBridge({
		screenshotStore: createScreenshotStore(),
		threadId: "thread-browser-bridge",
		writer: {
			write(entry) {
				writes.push(entry)
			},
		},
		workspaceBindings: createWorkspaceBindings(),
	})

	await bridge.handleToolCallStart({
		toolCallId: "tool-call-1",
		toolInput: {
			thread_id: "thread-browser-bridge",
			url: "https://example.com",
		},
		toolName: "browser_navigate",
	})
	await bridge.handleToolCallResult({
		toolCallId: "tool-call-1",
		toolName: "browser_navigate",
	})

	assert.deepEqual(writes, [
		{
			type: "data-browser-state",
			data: {
				status: "navigating",
				streamConfig: {
					enabled: true,
					wsUrl: "/api/browser-workspaces/workspace-1/live",
				},
				title: "about:blank",
				url: "https://example.com",
				workspaceId: "workspace-1",
			},
		},
		{
			type: "data-browser-state",
			data: {
				status: "ready",
				streamConfig: {
					enabled: true,
					wsUrl: "/api/browser-workspaces/workspace-1/live",
				},
				title: "Example Domain",
				url: "https://example.com",
				workspaceId: "workspace-1",
			},
		},
	])
})

test("browser bridge emits a screenshot only for explicit screenshot tool results", async () => {
	const writes = []
	const bridge = createThreadBrowserBridge({
		screenshotStore: createScreenshotStore(),
		threadId: "thread-browser-bridge",
		writer: {
			write(entry) {
				writes.push(entry)
			},
		},
		workspaceBindings: createWorkspaceBindings(),
	})

	await bridge.handleToolCallStart({
		toolCallId: "tool-call-2",
		toolInput: {
			thread_id: "thread-browser-bridge",
		},
		toolName: "browser_take_screenshot",
	})
	await bridge.handleToolCallResult({
		toolCallId: "tool-call-2",
		toolName: "browser_take_screenshot",
	})

	assert.deepEqual(writes[0], {
		type: "data-browser-state",
		data: {
			status: "navigating",
			streamConfig: {
				enabled: true,
				wsUrl: "/api/browser-workspaces/workspace-1/live",
			},
			title: "about:blank",
			url: "about:blank",
			workspaceId: "workspace-1",
		},
	})
	assert.deepEqual(writes[1], {
		type: "data-browser-state",
		data: {
			status: "ready",
			streamConfig: {
				enabled: true,
				wsUrl: "/api/browser-workspaces/workspace-1/live",
			},
			title: "Example Domain",
			url: "https://example.com",
			workspaceId: "workspace-1",
		},
	})
	assert.deepEqual(writes[2], {
		type: "data-browser-screenshot",
		data: {
			contentType: "image/png",
			height: 1538,
			imageUrl: "/api/rovo/files/upload-browser-shot",
			timestamp: writes[2].data.timestamp,
			url: "https://example.com",
			width: 2400,
			workspaceId: "workspace-1",
		},
	})
	assert.match(writes[2].data.timestamp, /^\d{4}-\d{2}-\d{2}T/)
})

test("default workspace bindings use the thread session workspace helpers", async () => {
	const bindings = createDefaultWorkspaceBindings({
		ensureThreadSessionWorkspaceImpl: async ({ threadId, defaultUrl }) => {
			assert.equal(threadId, "thread-browser-bridge")
			assert.equal(defaultUrl, "https://example.com/docs")
			return {
				state: {
					title: "Loading",
					url: "https://example.com/docs",
				},
				streamConfig: {
					enabled: true,
					wsUrl: "/api/browser-workspaces/workspace-1/live",
				},
				workspaceId: "workspace-1",
			}
		},
		getThreadSessionWorkspaceImpl: async ({ threadId }) => {
			assert.equal(threadId, "thread-browser-bridge")
			return {
				state: {
					title: "Docs",
					url: "https://example.com/docs",
				},
				streamConfig: {
					enabled: true,
					wsUrl: "/api/browser-workspaces/workspace-1/live",
				},
				workspaceId: "workspace-1",
			}
		},
		getThreadSessionWorkspaceScreenshotImpl: async ({ threadId }) => {
			assert.equal(threadId, "thread-browser-bridge")
			return {
				contentType: "image/png",
				state: {
					url: "https://example.com/docs",
				},
				workspaceId: "workspace-1",
			}
		},
	})

	const ensured = await bindings.ensureThreadWorkspace(
		"thread-browser-bridge",
		"https://example.com/docs",
	)
	const fetched = await bindings.getThreadWorkspace("thread-browser-bridge")
	const screenshot = await bindings.getThreadWorkspaceScreenshot("thread-browser-bridge")

	assert.deepEqual(ensured, {
		state: {
			title: "Loading",
			url: "https://example.com/docs",
		},
		streamConfig: {
			enabled: true,
			wsUrl: "/api/browser-workspaces/workspace-1/live",
		},
		workspaceId: "workspace-1",
	})
	assert.deepEqual(fetched, {
		state: {
			title: "Docs",
			url: "https://example.com/docs",
		},
		streamConfig: {
			enabled: true,
			wsUrl: "/api/browser-workspaces/workspace-1/live",
		},
		workspaceId: "workspace-1",
	})
	assert.deepEqual(screenshot, {
		contentType: "image/png",
		state: {
			url: "https://example.com/docs",
		},
		workspaceId: "workspace-1",
	})
})

test("a browser tool call acts on the request's own thread, whatever thread_id the model sends", async () => {
	const ensured = []
	const bindings = {
		async ensureThreadWorkspace(threadId) {
			ensured.push(threadId)
			return { state: { title: "", url: "about:blank" }, streamConfig: null, workspaceId: `browser-${threadId}` }
		},
		async getThreadWorkspace() {
			return null
		},
		async getThreadWorkspaceScreenshot() {
			return null
		},
	}
	const writer = { write() {} }
	const bound = createThreadBrowserBridge({ threadId: "thread-a", writer, workspaceBindings: bindings })
	assert.equal(await bound.handleToolCallStart({ toolCallId: "c1", toolInput: { thread_id: "thread-b" }, toolName: "browser_navigate" }), true)
	assert.deepEqual(ensured, ["thread-a"])

	const unbound = createThreadBrowserBridge({ threadId: undefined, writer, workspaceBindings: bindings })
	assert.equal(await unbound.handleToolCallStart({ toolCallId: "c2", toolInput: { thread_id: "thread-b" }, toolName: "browser_navigate" }), false)
	assert.deepEqual(ensured, ["thread-a"], "no request thread: nothing opened for the named thread")
})
