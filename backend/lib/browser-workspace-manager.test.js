const test = require("node:test")
const assert = require("node:assert/strict")

const {
	BrowserWorkspace,
	BrowserWorkspaceManager,
	BrowserWorkspaceNotFoundError,
	isBrowserWorkspaceNotFoundError,
} = require("./browser-workspace-manager")

function titleFromUrl(url) {
	if (!url || url === "about:blank") {
		return ""
	}

	try {
		return new URL(url).hostname
	} catch {
		return url
	}
}

function createFakeRuntime(initialUrl = "about:blank") {
	const tabs = [
		{
			index: 0,
			url: initialUrl,
			title: titleFromUrl(initialUrl),
			active: true,
		},
	]
	const histories = new Map([
		[
			0,
			{
				entries: [initialUrl],
				index: 0,
			},
		],
	])
	let activeTabIndex = 0
	let viewport = {
		width: 1280,
		height: 900,
	}
	let screenshotCount = 0
	let screencasting = false

	function setActiveTab(index) {
		activeTabIndex = index
		for (const tab of tabs) {
			tab.active = tab.index === index
		}
	}

	function getActiveTab() {
		return tabs.find((tab) => tab.index === activeTabIndex) ?? tabs[0]
	}

	function recordNavigation(nextUrl) {
		const history = histories.get(activeTabIndex) ?? {
			entries: ["about:blank"],
			index: 0,
		}
		if (history.entries[history.index] !== nextUrl) {
			history.entries = history.entries.slice(0, history.index + 1)
			history.entries.push(nextUrl)
			history.index = history.entries.length - 1
		}
		histories.set(activeTabIndex, history)
		const activeTab = getActiveTab()
		if (activeTab) {
			activeTab.url = nextUrl
			activeTab.title = titleFromUrl(nextUrl)
		}
	}

	return {
		async initialize(defaultUrl) {
			if (defaultUrl && defaultUrl !== "about:blank") {
				recordNavigation(defaultUrl)
			}
		},
		async getState() {
			return {
				activeTabIndex,
				tabs: tabs.map((tab) => ({ ...tab })),
				title: getActiveTab()?.title ?? "",
				url: getActiveTab()?.url ?? "about:blank",
			}
		},
		async navigate(url) {
			recordNavigation(url)
		},
		async setViewport(width, height) {
			viewport = { width, height }
		},
		async back() {
			const history = histories.get(activeTabIndex)
			if (history && history.index > 0) {
				history.index -= 1
				const activeTab = getActiveTab()
				activeTab.url = history.entries[history.index]
				activeTab.title = titleFromUrl(activeTab.url)
			}
		},
		async forward() {
			const history = histories.get(activeTabIndex)
			if (history && history.index < history.entries.length - 1) {
				history.index += 1
				const activeTab = getActiveTab()
				activeTab.url = history.entries[history.index]
				activeTab.title = titleFromUrl(activeTab.url)
			}
		},
		async reload() {},
		async click() {},
		async clickRef() {},
		async hoverRef() {},
		async fillRef() {},
		async typeRef() {},
		async selectRef() {},
		async wheel() {},
		async scroll() {},
		async press() {},
		async keyEvent() {},
		async insertText() {},
		async createTab(url) {
			const nextUrl = url || "about:blank"
			const nextIndex = tabs.length
			tabs.push({
				index: nextIndex,
				url: nextUrl,
				title: titleFromUrl(nextUrl),
				active: false,
			})
			histories.set(nextIndex, {
				entries: [nextUrl],
				index: 0,
			})
			setActiveTab(nextIndex)
		},
		async activateTab(index) {
			setActiveTab(index)
		},
		async closeTab(index) {
			tabs.splice(index, 1)
			histories.delete(index)
			const shiftedHistories = new Map()
			for (const [tabIndex, history] of histories.entries()) {
				shiftedHistories.set(tabIndex > index ? tabIndex - 1 : tabIndex, history)
			}
			histories.clear()
			for (const [tabIndex, history] of shiftedHistories.entries()) {
				histories.set(tabIndex, history)
			}
			for (const [nextIndex, tab] of tabs.entries()) {
				tab.index = nextIndex
			}
			setActiveTab(Math.max(0, Math.min(activeTabIndex, tabs.length - 1)))
		},
		async screenshotBuffer() {
			screenshotCount += 1
			return Buffer.from(`shot-${viewport.width}x${viewport.height}-${screenshotCount}`)
		},
		async snapshot(options = {}) {
			return {
				snapshot:
					options.interactive
						? '- button "Sign in" [ref=@e1]\n- link "More info" [ref=@e2]'
						: '- button "Sign in"',
				refs: options.interactive
					? {
						"@e1": {
							role: "button",
							name: "Sign in",
						},
						"@e2": {
							role: "link",
							name: "More info",
						},
					}
					: undefined,
			}
		},
		isScreencasting() {
			return screencasting
		},
		async startScreencast() {
			screencasting = true
		},
		async stopScreencast() {
			screencasting = false
		},
		async close() {},
	}
}

function createTestWorkspace(options = {}) {
	return new BrowserWorkspace({
		workspaceId: options.workspaceId ?? "workspace-test",
		sessionId: options.sessionId ?? "workspace-test-session",
		delayFn: async () => {},
		nowFn: options.nowFn,
		runtimeFactory: () => createFakeRuntime(options.initialUrl),
		previewSessionFactory: options.previewSessionFactory,
	})
}

test("wheel and preview wheel pass only finite, bounded numbers to the runtime", async () => {
	const wheelCalls = []
	const workspace = new BrowserWorkspace({
		workspaceId: "workspace-wheel",
		sessionId: "workspace-wheel-session",
		delayFn: async () => {},
		runtimeFactory: () => ({
			...createFakeRuntime(),
			async wheel(...args) {
				wheelCalls.push(args)
			},
		}),
	})
	await workspace.initialize("about:blank")
	// JSON.parse("-1e999") is -Infinity, which a socket frame can carry.
	await workspace.wheel(JSON.parse("-1e999"), Number.NaN)
	await workspace.previewWheel(JSON.parse("1e999"), -40, "abc", JSON.parse("1e999"))
	for (const call of wheelCalls) {
		assert.equal(call.every(Number.isFinite), true, JSON.stringify(call.map(String)))
	}
	assert.deepEqual(wheelCalls[0].slice(2), [-100_000, 0])
	assert.deepEqual(wheelCalls[1], [100_000, 0, 0, 100_000])
})

test("a preview paste the argument rules refuse is answered with a preview-error, never an unhandled rejection", async (t) => {
	const { requireBrowserArgument } = require("./input-schemas")
	const unhandled = []
	const onUnhandled = (reason) => unhandled.push(reason)
	process.on("unhandledRejection", onUnhandled)
	t.after(() => process.off("unhandledRejection", onUnhandled))

	const workspace = new BrowserWorkspace({
		workspaceId: "workspace-paste",
		sessionId: "workspace-paste-session",
		delayFn: async () => {},
		runtimeFactory: () => ({
			...createFakeRuntime(),
			async insertText(text) {
				requireBrowserArgument(text, "Text")
			},
		}),
	})
	await workspace.initialize("about:blank")
	const sent = []
	workspace._previewClients.add({ readyState: 1, send: (payload) => sent.push(JSON.parse(payload)) })

	workspace._handlePreviewControlMessage({ type: "preview-paste", text: "--session=other" })
	await workspace._queue
	await new Promise(setImmediate)

	assert.deepEqual(unhandled, [])
	assert.deepEqual(sent.filter((message) => message.type === "preview-error"), [
		{ type: "preview-error", message: "Text cannot start like a command-line option." },
	])
})

test("browser workspace tracks tab creation and active tab switching", async () => {
	const workspace = createTestWorkspace({
		workspaceId: "workspace-tabs",
		initialUrl: "https://example.com",
	})

	await workspace.initialize("https://example.com")
	const navigated = await workspace.navigate("https://news.ycombinator.com")
	assert.equal(navigated.url, "https://news.ycombinator.com")
	assert.equal(navigated.canGoBack, true)

	const createdTab = await workspace.createTab("https://example.org")
	assert.equal(createdTab.activeTabIndex, 1)
	assert.equal(createdTab.tabs.length, 2)
	assert.equal(createdTab.url, "https://example.org")

	const switchedBack = await workspace.activateTab(0)
	assert.equal(switchedBack.activeTabIndex, 0)
	assert.equal(switchedBack.url, "https://news.ycombinator.com")
	assert.equal(switchedBack.canGoBack, true)
	assert.equal(switchedBack.canGoForward, false)
})

test("browser workspace snapshot includes refs for interactive snapshots", async () => {
	const workspace = createTestWorkspace({
		workspaceId: "workspace-snapshot",
		initialUrl: "https://example.com",
	})

	await workspace.initialize("https://example.com")
	const snapshot = await workspace.snapshot({ interactive: true })

	assert.equal(snapshot.url, "https://example.com")
	assert.deepEqual(snapshot.refs, {
		"@e1": {
			role: "button",
			name: "Sign in",
		},
		"@e2": {
			role: "link",
			name: "More info",
		},
	})
})

test("browser workspace screenshot cache stays isolated per workspace", async () => {
	const first = createTestWorkspace({
		workspaceId: "workspace-a",
		initialUrl: "https://example.com",
	})
	const second = createTestWorkspace({
		workspaceId: "workspace-b",
		initialUrl: "https://example.org",
	})

	await first.initialize("https://example.com")
	await second.initialize("https://example.org")

	const firstCapture = await first.screenshot()
	const secondCapture = await second.screenshot()
	const firstCachedCapture = await first.screenshot()

	assert.equal(firstCapture.buffer.equals(Buffer.from("shot-1280x900-1")), true)
	assert.equal(secondCapture.buffer.equals(Buffer.from("shot-1280x900-1")), true)
	assert.equal(firstCachedCapture.buffer.equals(Buffer.from("shot-1280x900-1")), true)

	await first.navigate("https://example.net")
	const firstFreshCapture = await first.screenshot()
	assert.equal(firstFreshCapture.buffer.equals(Buffer.from("shot-1280x900-2")), true)
})

test("browser workspace preview session lifecycle returns session ids", async () => {
	const closedSessionIds = []
	const workspace = createTestWorkspace({
		workspaceId: "workspace-preview",
		initialUrl: "https://example.com",
		previewSessionFactory: ({ sessionId, onClose }) => ({
			sessionId,
			ready: async () => ({
				sessionId,
				answerSdp: "answer-sdp",
			}),
			send() {},
			pushFrame() {},
			close: async () => {
				closedSessionIds.push(sessionId)
				await onClose()
			},
		}),
	})

	await workspace.initialize("https://example.com")
	const created = await workspace.createPreviewSession("offer-sdp")
	assert.equal(typeof created.sessionId, "string")
	assert.equal(created.answerSdp, "answer-sdp")

	const deleted = await workspace.deletePreviewSession(created.sessionId)
	assert.deepEqual(deleted, {
		sessionId: created.sessionId,
		closed: true,
	})
	assert.deepEqual(closedSessionIds, [created.sessionId])
})

test("browser workspace settles preview state for websocket-only preview clients", async () => {
	const originalSetTimeout = global.setTimeout
	const originalClearTimeout = global.clearTimeout
	const scheduledTimers = []

	global.setTimeout = (callback, delay) => {
		const timer = {
			callback,
			cleared: false,
			delay,
			unref() {},
		}
		scheduledTimers.push(timer)
		return timer
	}
	global.clearTimeout = (timer) => {
		if (timer) {
			timer.cleared = true
		}
	}

	try {
		const messages = []
		const workspace = createTestWorkspace({
			workspaceId: "workspace-preview-client",
			initialUrl: "https://example.com",
		})
		const client = {
			readyState: 1,
			send(payload) {
				messages.push(JSON.parse(payload))
			},
		}

		await workspace.initialize("https://example.com")
			await workspace.attachPreviewClient(client)
			await workspace.previewClick(32, 48)

			assert.equal(workspace._previewStatus, "live")
			assert.equal(scheduledTimers.length, 1)
			assert.equal(
				messages.some(
					(message) => message.type === "preview-state" && message.status === "live",
				),
				true,
			)
			assert.deepEqual(
				messages.findLast((message) => message.type === "preview-overlay"),
				{
					type: "preview-overlay",
					cursor: {
						x: 32,
						y: 48,
						visible: true,
					},
					activity: {
						kind: "click",
						label: "Clicking",
					},
					updatedAt: workspace._previewOverlayState.updatedAt,
				},
			)

			const settleTimer = scheduledTimers.find((timer) => timer.delay === 750)
			assert.ok(settleTimer)

			settleTimer.callback()
			await workspace._queue

			const steadyMessages = messages.filter(
				(message) => message.type === "preview-state" && message.status === "steady",
			)
			assert.equal(workspace._previewStatus, "steady")
			assert.equal(steadyMessages.length >= 2, true)
			assert.equal(steadyMessages.at(-1)?.settledScreenshotRevision, 1)

			assert.deepEqual(
				messages.findLast((message) => message.type === "preview-overlay"),
				{
					type: "preview-overlay",
					cursor: {
						x: 32,
						y: 48,
						visible: true,
					},
					activity: {
						kind: "click",
						label: "Clicking",
					},
					updatedAt: workspace._previewOverlayState.updatedAt,
				},
			)
		} finally {
			global.setTimeout = originalSetTimeout
			global.clearTimeout = originalClearTimeout
		}
	})

test("browser workspace reuses recent pointer overlay for ref actions and falls back to center once stale", async () => {
	let currentTime = 10_000
	const workspace = createTestWorkspace({
		workspaceId: "workspace-overlay-anchor",
		initialUrl: "https://example.com",
		nowFn: () => currentTime,
	})

	await workspace.initialize("https://example.com")
	await workspace.previewClick(80, 120)
	assert.deepEqual(workspace._previewOverlayState.cursor, {
		x: 80,
		y: 120,
		visible: true,
	})

	currentTime += 1_000
	await workspace.typeRef("@e1", "hello")
	assert.deepEqual(workspace._previewOverlayState.cursor, {
		x: 80,
		y: 120,
		visible: true,
	})
	assert.deepEqual(workspace._previewOverlayState.activity, {
		kind: "type",
		label: "Typing",
	})

	currentTime += 6_000
	await workspace.selectRef("@e1", ["one"])
	assert.deepEqual(workspace._previewOverlayState.cursor, {
		x: 640,
		y: 450,
		visible: true,
	})
	assert.deepEqual(workspace._previewOverlayState.activity, {
		kind: "select",
		label: "Selecting",
	})
})

test("browser workspace replays overlay state to preview clients on attach and sync", async () => {
	const messages = []
	const workspace = createTestWorkspace({
		workspaceId: "workspace-overlay-sync",
		initialUrl: "https://example.com",
	})
	const client = {
		readyState: 1,
		send(payload) {
			messages.push(JSON.parse(payload))
		},
	}

	await workspace.initialize("https://example.com")
	await workspace.previewClick(24, 36)
	await workspace.attachPreviewClient(client)

	assert.deepEqual(
		messages.findLast((message) => message.type === "preview-overlay"),
		{
			type: "preview-overlay",
			cursor: {
				x: 24,
				y: 36,
				visible: true,
			},
			activity: {
				kind: "click",
				label: "Clicking",
			},
			updatedAt: workspace._previewOverlayState.updatedAt,
		},
	)

	messages.length = 0
	workspace._handlePreviewControlMessage({
		type: "preview-sync",
	})
	await workspace._queue

	assert.deepEqual(
		messages.findLast((message) => message.type === "preview-overlay"),
		{
			type: "preview-overlay",
			cursor: {
				x: 24,
				y: 36,
				visible: true,
			},
			activity: {
				kind: "click",
				label: "Clicking",
			},
			updatedAt: workspace._previewOverlayState.updatedAt,
		},
	)
})

test("browser workspace cleans up failed preview session negotiation", async () => {
	let closeCalls = 0
	const workspace = createTestWorkspace({
		workspaceId: "workspace-preview-failure",
		initialUrl: "https://example.com",
		previewSessionFactory: ({ sessionId }) => ({
			sessionId,
			ready: async () => {
				throw new Error("Invalid offer SDP")
			},
			send() {},
			pushFrame() {},
			close: async () => {
				closeCalls += 1
			},
		}),
	})

	await workspace.initialize("https://example.com")
	await assert.rejects(
		() => workspace.createPreviewSession("broken-offer-sdp"),
		/Invalid offer SDP/,
	)
	assert.equal(closeCalls, 1)
	assert.equal(workspace._previewSessions.size, 0)
})

test("browser workspace manager deletes explicit workspaces and cleans up idle ones", async () => {
	let currentTime = 1_000
	const closedWorkspaceIds = []

	const manager = new BrowserWorkspaceManager({
		nowFn: () => currentTime,
		cleanupIntervalMs: 1_000_000,
		idleTimeoutMs: 10,
		workspaceFactory: ({ workspaceId, sessionId }) =>
			new BrowserWorkspace({
				workspaceId,
				sessionId,
				delayFn: async () => {},
				nowFn: () => currentTime,
				runtimeFactory: () => ({
					...createFakeRuntime(),
					async close() {
						closedWorkspaceIds.push(workspaceId)
					},
				}),
			}),
	})

	const firstState = await manager.createWorkspace()
	const secondState = await manager.createWorkspace()

	assert.equal(manager.listWorkspaces().length, 2)

	const deleted = await manager.deleteWorkspace(firstState.workspaceId)
	assert.deepEqual(deleted, {
		workspaceId: firstState.workspaceId,
		closed: true,
	})
	assert.deepEqual(closedWorkspaceIds, [firstState.workspaceId])

	currentTime += 50
	const cleaned = await manager.cleanupIdleWorkspaces()
	assert.deepEqual(cleaned, [secondState.workspaceId])
	assert.deepEqual(closedWorkspaceIds, [
		firstState.workspaceId,
		secondState.workspaceId,
	])
	assert.equal(manager.listWorkspaces().length, 0)
	clearInterval(manager._cleanupTimer)
})

test("browser workspace manager rejects with typed errors for missing workspaces", async () => {
	const manager = new BrowserWorkspaceManager({
		cleanupIntervalMs: 1_000_000,
	})

	await assert.rejects(
		manager.getWorkspaceState("missing-workspace"),
		(error) => {
			assert.equal(error instanceof BrowserWorkspaceNotFoundError, true)
			assert.equal(isBrowserWorkspaceNotFoundError(error), true)
			assert.equal(error.code, "BROWSER_WORKSPACE_NOT_FOUND")
			assert.equal(error.workspaceId, "missing-workspace")
			assert.equal(
				error.message,
				"Browser workspace not found: missing-workspace",
			)
			return true
		},
	)
	// Synchronous lookups still throw synchronously.
	assert.throws(
		() => manager.getWorkspaceStream("missing-workspace"),
		BrowserWorkspaceNotFoundError,
	)
	clearInterval(manager._cleanupTimer)
})

test("browser workspace manager uses compact runtime session ids", async () => {
	let createdWorkspace = null

	const manager = new BrowserWorkspaceManager({
		cleanupIntervalMs: 1_000_000,
		workspaceFactory: ({ workspaceId, sessionId }) => {
			createdWorkspace = {
				workspaceId,
				sessionId,
			}

			return {
				workspaceId,
				sessionId,
				state: {
					workspaceId,
					ready: true,
					activeTabIndex: 0,
					tabs: [
						{
							index: 0,
							title: "",
							url: "about:blank",
							active: true,
						},
					],
					title: "",
					url: "about:blank",
					viewportWidth: 1280,
					viewportHeight: 900,
					canGoBack: false,
					canGoForward: false,
					updatedAt: 1_000,
				},
				async initialize() {},
				getLifecycle() {
					return { status: "ready", reason: null }
				},
				getUsage() {
					return { workspaceId, status: "ready", lastUsedAt: 0, previewConsumers: 0, pendingCalls: 0 }
				},
				peekState() {
					return this.state
				},
				async close() {},
			}
		},
	})

	await manager.createWorkspace()

	assert.equal(createdWorkspace?.sessionId, createdWorkspace?.workspaceId)
})

test("a preview control action that fails never becomes an unhandled rejection, on the socket or the data channel", async (t) => {
	const unhandled = []
	const onUnhandled = (reason) => unhandled.push(reason)
	process.on("unhandledRejection", onUnhandled)
	t.after(() => process.off("unhandledRejection", onUnhandled))
	const warn = t.mock.method(console, "warn", () => {})

	const workspace = new BrowserWorkspace({
		workspaceId: "workspace-reject",
		sessionId: "workspace-reject-session",
		delayFn: async () => {},
		runtimeFactory: () => ({
			...createFakeRuntime(),
			async insertText() {
				throw Object.assign(new Error("Text cannot start like a command-line option."), { status: 400 })
			},
		}),
	})
	await workspace.initialize("about:blank")
	const sent = []
	workspace._previewClients.add({ readyState: 1, send: (payload) => sent.push(JSON.parse(payload)) })

	// The socket path: the failure comes back to the caller (whose guard answers it with
	// a preview-error) or is answered to the preview clients directly.
	const socketFailure = await Promise.resolve(workspace._handlePreviewControlMessage({ type: "preview-paste", text: "--x" })).then(
		() => null,
		(error) => error,
	)
	const answered = sent.some((message) => message.type === "preview-error")
	assert.equal(Boolean(socketFailure) || answered, true)
	// The WebRTC data channel has no caller to return it to.
	await workspace._handleDetachedPreviewControlMessage({ type: "preview-paste", text: "--x" })
	await workspace._queue
	await new Promise(setImmediate)

	assert.deepEqual(unhandled, [])
	if (socketFailure) {
		assert.equal(warn.mock.calls.some((call) => String(call.arguments[0]).includes("Preview control message failed")), true)
	}
})
