const fs = require("node:fs/promises")
const os = require("node:os")
const path = require("node:path")
const { randomUUID } = require("node:crypto")

const { normalizeChromiumPreviewUrl } = require("./chromium-preview")
const {
	AgentBrowserRuntime,
	DEFAULT_DEVICE_SCALE_FACTOR,
	DEFAULT_VIEWPORT,
	} = require("./browser-workspace-runtime")
const { BrowserPreviewSession } = require("./browser-preview-session")
const { toBoundedPointerNumber } = require("./input-schemas")
const {
	BrowserWorkspaceNotFoundError,
	BrowserWorkspaceUnavailableError,
	INITIAL_BROWSER_WORKSPACE_LIFECYCLE,
	MAX_LIVE_BROWSER_WORKSPACES,
	decideBrowserWorkspaceCall,
	isBrowserWorkspaceNotFoundError,
	transitionBrowserWorkspace,
} = require("./browser-workspace-lifecycle")
const {
	BrowserWorkspaceRegistry,
	WORKSPACE_CLEANUP_INTERVAL_MS,
	WORKSPACE_IDLE_TIMEOUT_MS,
} = require("./browser-workspace-registry")

const DEFAULT_URL = "about:blank"
const SCREENSHOT_ROOT_DIR = path.join(os.tmpdir(), "vpk-browser-workspaces")
const PREVIEW_SETTLE_DELAY_MS = 750
const PREVIEW_OVERLAY_ACTIVITY_RESET_MS = 1200
const PREVIEW_OVERLAY_POINTER_STALE_MS = 5_000
const SCROLL_DIRECTIONS = new Set(["up", "down", "left", "right"])

function delay(milliseconds) {
	return new Promise((resolve) => {
		setTimeout(resolve, milliseconds)
	})
}

function clampViewportDimension(value, fallback) {
	const parsed = Number.parseInt(String(value), 10)
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return fallback
	}

	return Math.min(Math.max(parsed, 320), 3840)
}

function clampDeviceScaleFactor(value) {
	const parsed = Number.parseFloat(String(value))
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return DEFAULT_DEVICE_SCALE_FACTOR
	}

	return Math.min(Math.max(parsed, 1), 3)
}

function requireNonEmptyString(value, message) {
	if (typeof value !== "string" || !value.trim()) {
		throw new Error(message)
	}

	return value.trim()
}

function requireNonEmptyMultilineString(value, message) {
	if (typeof value !== "string" || !value.trim()) {
		throw new Error(message)
	}

	return value
}

function normalizeScrollDirection(direction) {
	const normalizedDirection = requireNonEmptyString(
		direction,
		'A non-empty scroll direction is required.',
	).toLowerCase()

	if (!SCROLL_DIRECTIONS.has(normalizedDirection)) {
		throw new Error('Scroll direction must be one of: "up", "down", "left", "right".')
	}

	return normalizedDirection
}

function normalizeScrollDistance(value, fallback = 300) {
	const parsed = Number.parseInt(String(value), 10)
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return fallback
	}

	return Math.min(Math.max(parsed, 1), 5000)
}

function normalizeTabIndex(index) {
	const parsed = Number.parseInt(String(index), 10)
	if (!Number.isFinite(parsed) || parsed < 0) {
		throw new Error("A non-negative tab index is required.")
	}

	return parsed
}

function tabsAreEqual(currentTabs, nextTabs) {
	if (!Array.isArray(currentTabs) || !Array.isArray(nextTabs)) {
		return false
	}

	if (currentTabs.length !== nextTabs.length) {
		return false
	}

	for (let index = 0; index < currentTabs.length; index += 1) {
		const currentTab = currentTabs[index]
		const nextTab = nextTabs[index]
		if (
			currentTab?.index !== nextTab?.index ||
			currentTab?.url !== nextTab?.url ||
			currentTab?.title !== nextTab?.title ||
			currentTab?.active !== nextTab?.active
		) {
			return false
		}
	}

	return true
}

class BrowserWorkspace {
	constructor({
		workspaceId,
		sessionId,
		delayFn = delay,
		nowFn = Date.now,
		runtimeFactory,
		previewSessionFactory,
		screenshotRootDir = SCREENSHOT_ROOT_DIR,
	} = {}) {
		this._workspaceId = workspaceId
		this._sessionId = sessionId
		this._delay = delayFn
		this._now = nowFn
		this._previewSessionFactory = previewSessionFactory
		this._lifecycle = INITIAL_BROWSER_WORKSPACE_LIFECYCLE
		this._releasePromise = null
		this._pendingCalls = 0
		// AgentBrowserRuntime reports no crashes (agent-browser relaunches its own
		// daemon); a runtime that can tell calls onCrash once its browser is gone.
		this._runtime = typeof runtimeFactory === "function"
			? runtimeFactory({
				workspaceId,
				sessionId,
				viewport: DEFAULT_VIEWPORT,
				deviceScaleFactor: DEFAULT_DEVICE_SCALE_FACTOR,
				onCrash: (reason) => this._handleCrash(reason),
			})
			: new AgentBrowserRuntime({
				sessionId,
				viewport: DEFAULT_VIEWPORT,
				deviceScaleFactor: DEFAULT_DEVICE_SCALE_FACTOR,
			})
		this._queue = Promise.resolve()
		this._title = ""
		this._currentUrl = DEFAULT_URL
		this._viewport = { ...DEFAULT_VIEWPORT }
		this._deviceScaleFactor = DEFAULT_DEVICE_SCALE_FACTOR
		this._tabs = [
			{
				index: 0,
				title: "",
				url: DEFAULT_URL,
				active: true,
			},
		]
		this._activeTabIndex = 0
		this._tabHistories = new Map([
			[
				0,
				{
					entries: [DEFAULT_URL],
					index: 0,
				},
			],
		])
		this._pendingHistoryAction = null
		this._pendingHistoryTabIndex = null
		this._latestScreenshotBuffer = null
		this._latestScreenshotContentType = "image/png"
		this._screenshotDirty = true
		this._screenshotPromise = null
		this._lastUsedAt = this._now()
		this._updatedAt = this._now()
		this._screenshotDir = path.join(screenshotRootDir, this._workspaceId)
		this._previewSessions = new Map()
		this._previewClients = new Set()
			this._previewStreamPromise = null
			this._previewSettleTimer = null
			this._previewSettledScreenshotRevision = 0
			this._previewStatus = "steady"
			this._lastPreviewMetadata = null
			this._previewOverlayState = null
			this._previewOverlayActivityTimer = null
			this._lastExactPointer = null
		}

	_touch() {
		this._lastUsedAt = this._now()
	}

	_markUpdated() {
		this._touch()
		this._updatedAt = this._now()
	}

	_markScreenshotDirty() {
		this._screenshotDirty = true
	}

	_dispatch(event) {
		const previous = this._lifecycle
		this._lifecycle = transitionBrowserWorkspace(previous, event)
		return this._lifecycle !== previous
	}

	getLifecycle() {
		return this._lifecycle
	}

	// What the registry's cap decision needs to tell an abandoned workspace from one in use.
	getUsage() {
		return {
			workspaceId: this._workspaceId,
			status: this._lifecycle.status,
			lastUsedAt: this._lastUsedAt,
			previewConsumers: this._previewSessions.size + this._previewClients.size,
			pendingCalls: this._pendingCalls,
		}
	}

	assertCallable() {
		const decision = decideBrowserWorkspaceCall(this._lifecycle)
		if (decision.action === "reject") {
			throw new BrowserWorkspaceUnavailableError(
				this._workspaceId,
				decision.code,
				this._lifecycle.reason,
			)
		}
	}

	// Every call is checked when it is queued and again when it starts, so a call
	// queued before a close or crash never reaches the released browser (which
	// agent-browser would otherwise relaunch). Rejections are marked handled, as
	// queued tasks are, because timers and preview controls drop the promise.
	_enqueue(task) {
		try {
			this.assertCallable()
		} catch (error) {
			const rejected = Promise.reject(error)
			rejected.catch(() => {})
			return rejected
		}

		this._pendingCalls += 1
		const call = this._enqueueUnchecked(() => {
			this.assertCallable()
			return task()
		}).finally(() => {
			this._pendingCalls -= 1
		})
		call.catch(() => {})
		return call
	}

	_enqueueUnchecked(task) {
		const nextTask = this._queue.then(task, task)
		this._queue = nextTask.catch(() => {})
		return nextTask
	}

	_clearPreviewSettleTimer() {
		if (this._previewSettleTimer !== null) {
			clearTimeout(this._previewSettleTimer)
			this._previewSettleTimer = null
		}
	}

	_clearPreviewOverlayActivityTimer() {
		if (this._previewOverlayActivityTimer !== null) {
			clearTimeout(this._previewOverlayActivityTimer)
			this._previewOverlayActivityTimer = null
		}
	}

	_hasPreviewConsumers() {
		return this._previewSessions.size > 0 || this._previewClients.size > 0
	}

	_getPreviewSourceDimensions() {
		return {
			width: Math.max(
				1,
				this._lastPreviewMetadata?.deviceWidth ?? this._viewport.width,
			),
			height: Math.max(
				1,
				this._lastPreviewMetadata?.deviceHeight ?? this._viewport.height,
			),
		}
	}

	_clampPreviewPoint(x, y) {
		const sourceDimensions = this._getPreviewSourceDimensions()
		return {
			x: Math.min(
				sourceDimensions.width,
				toBoundedPointerNumber(x, { min: 0 }),
			),
			y: Math.min(
				sourceDimensions.height,
				toBoundedPointerNumber(y, { min: 0 }),
			),
		}
	}

	_setLastExactPointer(x, y) {
		const nextPoint = this._clampPreviewPoint(x, y)
		this._lastExactPointer = {
			...nextPoint,
			updatedAt: this._now(),
		}
		return nextPoint
	}

	_resolvePreviewOverlayPoint({ x, y, preferLastExact = true } = {}) {
		if (Number.isFinite(Number(x)) && Number.isFinite(Number(y))) {
			return this._setLastExactPointer(x, y)
		}

		if (
			preferLastExact &&
			this._lastExactPointer &&
			this._now() - this._lastExactPointer.updatedAt <=
				PREVIEW_OVERLAY_POINTER_STALE_MS
		) {
			return {
				x: this._lastExactPointer.x,
				y: this._lastExactPointer.y,
			}
		}

		const sourceDimensions = this._getPreviewSourceDimensions()
		return {
			x: Math.round(sourceDimensions.width / 2),
			y: Math.round(sourceDimensions.height / 2),
		}
	}

	_getHistoryState(tabIndex) {
		const history = this._tabHistories.get(tabIndex)
		if (history) {
			return history
		}

		const nextHistory = {
			entries: [DEFAULT_URL],
			index: 0,
		}
		this._tabHistories.set(tabIndex, nextHistory)
		return nextHistory
	}

	_shiftHistoriesAfterClose(closedIndex) {
		const nextHistories = new Map()
		for (const [tabIndex, history] of this._tabHistories.entries()) {
			if (tabIndex === closedIndex) {
				continue
			}

			nextHistories.set(tabIndex > closedIndex ? tabIndex - 1 : tabIndex, history)
		}

		this._tabHistories = nextHistories
		if (this._activeTabIndex > closedIndex) {
			this._activeTabIndex -= 1
		} else if (this._activeTabIndex === closedIndex) {
			this._activeTabIndex = Math.max(0, this._activeTabIndex - 1)
		}
	}

	_recordActiveTabHistory(activeTab) {
		if (!activeTab) {
			this._pendingHistoryAction = null
			this._pendingHistoryTabIndex = null
			return
		}

		const nextUrl =
			typeof activeTab.url === "string" && activeTab.url.trim()
				? activeTab.url.trim()
				: DEFAULT_URL

		const history = this._getHistoryState(activeTab.index)
		if (this._pendingHistoryTabIndex === activeTab.index) {
			if (this._pendingHistoryAction === "back") {
				history.index = Math.max(0, history.index - 1)
			} else if (this._pendingHistoryAction === "forward") {
				history.index = Math.min(history.entries.length - 1, history.index + 1)
			} else if (history.entries[history.index] !== nextUrl) {
				history.entries = history.entries.slice(0, history.index + 1)
				history.entries.push(nextUrl)
				history.index = history.entries.length - 1
			}

			if (history.entries[history.index] !== nextUrl) {
				history.entries[history.index] = nextUrl
			}
		} else if (history.entries[history.index] !== nextUrl) {
			history.entries = history.entries.slice(0, history.index + 1)
			history.entries.push(nextUrl)
			history.index = history.entries.length - 1
		}

		this._tabHistories.set(activeTab.index, history)
		this._pendingHistoryAction = null
		this._pendingHistoryTabIndex = null
	}

	_getStateSnapshot() {
		const activeHistory = this._getHistoryState(this._activeTabIndex)
		const runtimeMetadata =
			typeof this._runtime?.getBrowserStateMetadata === "function"
				? this._runtime.getBrowserStateMetadata()
				: null

		return {
			workspaceId: this._workspaceId,
			ready: this._lifecycle.status === "ready",
			activeTabIndex: this._activeTabIndex,
			tabs: this._tabs,
			title: this._title,
			url: this._currentUrl,
			viewportWidth: this._viewport.width,
			viewportHeight: this._viewport.height,
			canGoBack: activeHistory.index > 0,
			canGoForward: activeHistory.index < activeHistory.entries.length - 1,
			provider:
				typeof runtimeMetadata?.provider === "string"
					? runtimeMetadata.provider
					: "browser-workspace",
			updatedAt: this._updatedAt,
		}
	}

	_getPreviewStateMessage(status = this._previewStatus) {
		const sourceDimensions = this._getPreviewSourceDimensions()

		return {
			type: "preview-state",
			status,
			settledScreenshotRevision: this._previewSettledScreenshotRevision || null,
			sourceWidth: sourceDimensions.width,
			sourceHeight: sourceDimensions.height,
			pageScaleFactor: this._lastPreviewMetadata?.pageScaleFactor ?? 1,
		}
	}

	_getPreviewOverlayMessage() {
		if (!this._previewOverlayState) {
			return null
		}

		return {
			type: "preview-overlay",
			cursor: this._previewOverlayState.cursor,
			activity: this._previewOverlayState.activity,
			updatedAt: this._previewOverlayState.updatedAt,
		}
	}

	_broadcastPreviewState(status = this._previewStatus) {
		if (!this._hasPreviewConsumers()) {
			return
		}

		const message = this._getPreviewStateMessage(status)
		for (const session of this._previewSessions.values()) {
			session.send(message)
		}
		const payload = JSON.stringify(message)
		for (const client of this._previewClients) {
			if (client.readyState !== 1) {
				continue
			}
			client.send(payload)
		}
	}

	_broadcastPreviewOverlay() {
		if (!this._hasPreviewConsumers()) {
			return
		}

		const message = this._getPreviewOverlayMessage()
		if (!message) {
			return
		}

		for (const session of this._previewSessions.values()) {
			session.send(message)
		}

		const payload = JSON.stringify(message)
		for (const client of this._previewClients) {
			if (client.readyState !== 1) {
				continue
			}
			client.send(payload)
		}
	}

	_syncPreviewMessages() {
		this._broadcastPreviewState(this._previewStatus)
		this._broadcastPreviewOverlay()
	}

	_schedulePreviewOverlayActivityReset() {
		this._clearPreviewOverlayActivityTimer()
		this._previewOverlayActivityTimer = setTimeout(() => {
			this._previewOverlayActivityTimer = null
			void this._enqueue(async () => {
				if (!this._previewOverlayState?.activity) {
					return
				}

				this._previewOverlayState = {
					...this._previewOverlayState,
					activity: null,
					updatedAt: this._now(),
				}
				this._broadcastPreviewOverlay()
			})
		}, PREVIEW_OVERLAY_ACTIVITY_RESET_MS)
		this._previewOverlayActivityTimer.unref?.()
	}

	_setPreviewOverlay({ x, y, kind, label, preferLastExact = true }) {
		this._clearPreviewOverlayActivityTimer()
		const point = this._resolvePreviewOverlayPoint({
			x,
			y,
			preferLastExact,
		})

		this._previewOverlayState = {
			cursor: {
				...point,
				visible: true,
			},
			activity:
				typeof kind === "string" && typeof label === "string"
					? {
						kind,
						label,
					}
					: null,
			updatedAt: this._now(),
		}
		this._broadcastPreviewOverlay()
	}

	_schedulePreviewSettle(delayMs = PREVIEW_SETTLE_DELAY_MS) {
		this._clearPreviewSettleTimer()
		if (!this._hasPreviewConsumers()) {
			return
		}

		this._previewSettleTimer = setTimeout(() => {
			this._previewSettleTimer = null
			void this._enqueue(async () => {
				if (!this._hasPreviewConsumers()) {
					return
				}

				await this._captureScreenshot()
				this._previewSettledScreenshotRevision += 1
				this._previewStatus = "steady"
				this._broadcastPreviewState("steady")
			})
		}, delayMs)
		this._previewSettleTimer.unref?.()
	}

	_beginPreviewActivity() {
		this._markScreenshotDirty()
		if (!this._hasPreviewConsumers()) {
			return
		}

		this._previewStatus = "live"
		this._broadcastPreviewState("live")
		this._schedulePreviewSettle()
	}

	async _captureScreenshot() {
		if (!this._screenshotDirty && this._latestScreenshotBuffer) {
			this._touch()
			return {
				buffer: this._latestScreenshotBuffer,
				contentType: this._latestScreenshotContentType,
				state: this._getStateSnapshot(),
			}
		}

		if (!this._screenshotPromise) {
			this._screenshotPromise = (async () => {
				await fs.mkdir(this._screenshotDir, { recursive: true })
				const buffer = await this._runtime.screenshotBuffer()
				this._latestScreenshotBuffer = buffer
				this._screenshotDirty = false
				return buffer
			})().finally(() => {
				this._screenshotPromise = null
			})
		}

		const buffer = await this._screenshotPromise
		this._touch()
		return {
			buffer,
			contentType: this._latestScreenshotContentType,
			state: this._getStateSnapshot(),
		}
	}

	async _refreshState(options = {}) {
		const nextRuntimeState = await this._runtime.getState()
		const nextTabs = Array.isArray(nextRuntimeState?.tabs)
			? nextRuntimeState.tabs
					.filter((tab) => typeof tab?.index === "number")
					.map((tab) => ({
						index: tab.index,
						title: typeof tab.title === "string" ? tab.title : "",
						url:
							typeof tab.url === "string" && tab.url.trim()
								? tab.url.trim()
								: DEFAULT_URL,
						active: tab.active === true,
					}))
			: []

		const normalizedTabs =
			nextTabs.length > 0
				? nextTabs
				: [
					{
						index: 0,
						title: "",
						url: DEFAULT_URL,
						active: true,
					},
				]

		const presentIndices = new Set(normalizedTabs.map((tab) => tab.index))
		for (const tabIndex of this._tabHistories.keys()) {
			if (!presentIndices.has(tabIndex)) {
				this._tabHistories.delete(tabIndex)
			}
		}

		for (const tab of normalizedTabs) {
			if (!this._tabHistories.has(tab.index)) {
				this._tabHistories.set(tab.index, {
					entries: [tab.url || DEFAULT_URL],
					index: 0,
				})
			}
		}

		const nextActiveTabIndex =
			typeof nextRuntimeState?.activeTabIndex === "number"
				? nextRuntimeState.activeTabIndex
				: normalizedTabs.find((tab) => tab.active)?.index ?? 0
		const finalTabs = normalizedTabs.map((tab) => ({
			...tab,
			active: tab.index === nextActiveTabIndex,
		}))
		const activeTab =
			finalTabs.find((tab) => tab.index === nextActiveTabIndex) ?? finalTabs[0]
		const resolvedActiveTabIndex = activeTab?.index ?? 0
		const nextTitle = activeTab?.title || this._title
		const nextUrl = activeTab?.url || this._currentUrl
		const didStateChange =
			options.forceUpdated === true ||
			!tabsAreEqual(this._tabs, finalTabs) ||
			this._activeTabIndex !== resolvedActiveTabIndex ||
			this._title !== nextTitle ||
			this._currentUrl !== nextUrl

		this._tabs = finalTabs
		this._activeTabIndex = resolvedActiveTabIndex
		this._recordActiveTabHistory(activeTab)
		this._title = nextTitle
		this._currentUrl = nextUrl
		this._touch()
		if (didStateChange) {
			this._updatedAt = this._now()
		}

		return this._getStateSnapshot()
	}

	async _ensurePreviewStreaming() {
		if (!this._hasPreviewConsumers()) {
			return
		}

		if (this._previewStreamPromise) {
			await this._previewStreamPromise
			return
		}

		if (this._runtime.isScreencasting()) {
			return
		}

		this._previewStreamPromise = this._runtime
			.startScreencast((frame) => {
				const metadata = frame?.metadata ?? null
				const didMetadataChange =
					!this._lastPreviewMetadata ||
					this._lastPreviewMetadata.deviceWidth !== metadata?.deviceWidth ||
					this._lastPreviewMetadata.deviceHeight !== metadata?.deviceHeight ||
					this._lastPreviewMetadata.pageScaleFactor !== metadata?.pageScaleFactor

				this._lastPreviewMetadata = metadata
				for (const session of this._previewSessions.values()) {
					session.pushFrame(frame)
				}
				for (const client of this._previewClients) {
					if (client.readyState !== 1) {
						continue
					}
					if (Buffer.isBuffer(frame?.buffer)) {
						client.send(frame.buffer, { binary: true })
						continue
					}
					if (typeof frame?.data === "string") {
						client.send(
							JSON.stringify({
								type: "frame",
								data: frame.data,
								metadata,
							}),
						)
					}
				}
				if (didMetadataChange) {
					this._broadcastPreviewState("live")
				}
			})
			.catch((error) => {
				const payload = JSON.stringify({
					type: "preview-error",
					message:
						error instanceof Error
							? error.message
							: "Failed to start browser preview stream.",
				})
				for (const session of this._previewSessions.values()) {
					session.send({
						type: "preview-error",
						message:
							error instanceof Error
								? error.message
								: "Failed to start browser preview stream.",
					})
				}
				for (const client of this._previewClients) {
					if (client.readyState !== 1) {
						continue
					}
					client.send(payload)
				}
			})
			.finally(() => {
				this._previewStreamPromise = null
			})

		await this._previewStreamPromise
	}

	async _restartPreviewStreaming() {
		if (!this._hasPreviewConsumers()) {
			return
		}

		await this._runtime.stopScreencast().catch(() => {})
		await this._ensurePreviewStreaming()
	}

	async _handlePreviewSessionClose(sessionId) {
		if (!this._previewSessions.has(sessionId)) {
			return
		}

		this._previewSessions.delete(sessionId)
		if (this._previewSessions.size > 0 || this._previewClients.size > 0) {
			return
		}

		this._clearPreviewSettleTimer()
		this._clearPreviewOverlayActivityTimer()
		await this._runtime.stopScreencast().catch(() => {})
	}

	_handlePreviewControlMessage(message) {
		if (!message || typeof message !== "object") {
			return
		}

		switch (message.type) {
			case "preview-click":
				void this.previewClick(message.x, message.y)
				return
			case "preview-wheel":
				void this.previewWheel(message.x, message.y, message.deltaX, message.deltaY)
				return
			case "preview-key":
				void this.previewKeyEvent(
					message.eventType,
					message.key,
					message.code,
					message.text,
				)
				return
			case "preview-paste":
				void this.previewInsertText(message.text)
				return
			case "preview-sync":
				this._syncPreviewMessages()
				return
			default:
				return
		}
	}

	peekState() {
		return this._getStateSnapshot()
	}

	getLastUsedAt() {
		return this._lastUsedAt
	}

	getStreamConfig() {
		return {
			enabled: true,
			workspaceId: this._workspaceId,
			session: this._sessionId,
			port: 0,
			wsUrl: `/api/browser-workspaces/${encodeURIComponent(this._workspaceId)}/live`,
		}
	}

	initialize(defaultUrl = DEFAULT_URL) {
		return this._enqueue(async () => {
			this._currentUrl = normalizeChromiumPreviewUrl(defaultUrl)
			const initialHistory = {
				entries: [this._currentUrl],
				index: 0,
			}
			this._tabs = [
				{
					index: 0,
					title: "",
					url: this._currentUrl,
					active: true,
				},
			]
			this._activeTabIndex = 0
			this._tabHistories = new Map([[0, initialHistory]])
			try {
				await this._runtime.initialize(this._currentUrl)
			} catch (error) {
				this._handleCrash(error instanceof Error ? error.message : String(error))
				throw error
			}
			this._dispatch({ type: "LAUNCHED" })
			return this._refreshState({ forceUpdated: true })
		})
	}

	getState() {
		return this._enqueue(async () => {
			return this._refreshState({ forceUpdated: true })
		})
	}

	listTabs() {
		return this._enqueue(async () => {
			const state = await this._refreshState()
			return {
				workspaceId: this._workspaceId,
				activeTabIndex: state.activeTabIndex,
				tabs: state.tabs,
				updatedAt: state.updatedAt,
			}
		})
	}

	navigate(url) {
		return this._enqueue(async () => {
			const normalizedUrl = normalizeChromiumPreviewUrl(url)
			this._beginPreviewActivity()
			this._setPreviewOverlay({
				kind: "navigate",
				label: "Navigating",
			})
			this._pendingHistoryAction = "navigate"
			this._pendingHistoryTabIndex = this._activeTabIndex
			this._currentUrl = normalizedUrl
			await this._runtime.navigate(normalizedUrl)
			await this._delay(250)
			const state = await this._refreshState({ forceUpdated: true })
			await this._ensurePreviewStreaming()
			return state
		})
	}

	setViewport(width, height, deviceScaleFactor = this._deviceScaleFactor) {
		return this._enqueue(async () => {
			this._beginPreviewActivity()
			this._setPreviewOverlay({
				kind: "navigate",
				label: "Navigating",
			})
			this._viewport = {
				width: clampViewportDimension(width, DEFAULT_VIEWPORT.width),
				height: clampViewportDimension(height, DEFAULT_VIEWPORT.height),
			}
			this._deviceScaleFactor = clampDeviceScaleFactor(deviceScaleFactor)
			await this._runtime.setViewport(
				this._viewport.width,
				this._viewport.height,
				this._deviceScaleFactor,
			)
			const state = await this._refreshState({ forceUpdated: true })
			await this._restartPreviewStreaming()
			return state
		})
	}

	goBack() {
		return this._enqueue(async () => {
			this._beginPreviewActivity()
			this._setPreviewOverlay({
				kind: "navigate",
				label: "Navigating",
			})
			this._pendingHistoryAction = "back"
			this._pendingHistoryTabIndex = this._activeTabIndex
			await this._runtime.back()
			await this._delay(250)
			const state = await this._refreshState({ forceUpdated: true })
			await this._ensurePreviewStreaming()
			return state
		})
	}

	goForward() {
		return this._enqueue(async () => {
			this._beginPreviewActivity()
			this._setPreviewOverlay({
				kind: "navigate",
				label: "Navigating",
			})
			this._pendingHistoryAction = "forward"
			this._pendingHistoryTabIndex = this._activeTabIndex
			await this._runtime.forward()
			await this._delay(250)
			const state = await this._refreshState({ forceUpdated: true })
			await this._ensurePreviewStreaming()
			return state
		})
	}

	reload() {
		return this._enqueue(async () => {
			this._beginPreviewActivity()
			this._setPreviewOverlay({
				kind: "navigate",
				label: "Navigating",
			})
			this._pendingHistoryAction = "reload"
			this._pendingHistoryTabIndex = this._activeTabIndex
			await this._runtime.reload()
			await this._delay(250)
			const state = await this._refreshState({ forceUpdated: true })
			await this._ensurePreviewStreaming()
			return state
		})
	}

	click(x, y) {
		return this._enqueue(async () => {
			this._beginPreviewActivity()
			const resolvedX = toBoundedPointerNumber(x, { min: 0 })
			const resolvedY = toBoundedPointerNumber(y, { min: 0 })
			this._setPreviewOverlay({
				x: resolvedX,
				y: resolvedY,
				kind: "click",
				label: "Clicking",
			})
			await this._runtime.click(resolvedX, resolvedY)
			await this._delay(125)
			const state = await this._refreshState({ forceUpdated: true })
			await this._ensurePreviewStreaming()
			return state
		})
	}

	clickRef(ref) {
		return this._enqueue(async () => {
			this._beginPreviewActivity()
			this._setPreviewOverlay({
				kind: "click",
				label: "Clicking",
			})
			await this._runtime.clickRef(
				requireNonEmptyString(ref, "A non-empty accessibility ref is required."),
			)
			await this._delay(125)
			const state = await this._refreshState({ forceUpdated: true })
			await this._ensurePreviewStreaming()
			return state
		})
	}

	hoverRef(ref) {
		return this._enqueue(async () => {
			this._beginPreviewActivity()
			this._setPreviewOverlay({
				kind: "hover",
				label: "Hovering",
			})
			await this._runtime.hoverRef(
				requireNonEmptyString(ref, "A non-empty accessibility ref is required."),
			)
			await this._delay(100)
			const state = await this._refreshState({ forceUpdated: true })
			await this._ensurePreviewStreaming()
			return state
		})
	}

	fillRef(ref, text) {
		return this._enqueue(async () => {
			this._beginPreviewActivity()
			if (typeof text !== "string") {
				throw new Error("A text string is required.")
			}

			this._setPreviewOverlay({
				kind: "type",
				label: "Typing",
			})

			await this._runtime.fillRef(
				requireNonEmptyString(ref, "A non-empty accessibility ref is required."),
				text,
			)
			await this._delay(100)
			const state = await this._refreshState({ forceUpdated: true })
			await this._ensurePreviewStreaming()
			return state
		})
	}

	typeRef(ref, text) {
		return this._enqueue(async () => {
			this._beginPreviewActivity()
			if (typeof text !== "string") {
				throw new Error("A text string is required.")
			}

			this._setPreviewOverlay({
				kind: "type",
				label: "Typing",
			})

			await this._runtime.typeRef(
				requireNonEmptyString(ref, "A non-empty accessibility ref is required."),
				text,
			)
			await this._delay(100)
			const state = await this._refreshState({ forceUpdated: true })
			await this._ensurePreviewStreaming()
			return state
		})
	}

	selectRef(ref, values) {
		return this._enqueue(async () => {
			this._beginPreviewActivity()
			this._setPreviewOverlay({
				kind: "select",
				label: "Selecting",
			})
			const resolvedValues = Array.isArray(values)
				? values
						.map((value) => (typeof value === "string" ? value.trim() : ""))
						.filter(Boolean)
				: []
			if (resolvedValues.length === 0) {
				throw new Error("At least one select value is required.")
			}

			await this._runtime.selectRef(
				requireNonEmptyString(ref, "A non-empty accessibility ref is required."),
				resolvedValues,
			)
			await this._delay(100)
			const state = await this._refreshState({ forceUpdated: true })
			await this._ensurePreviewStreaming()
			return state
		})
	}

	wheel(deltaX, deltaY) {
		return this._enqueue(async () => {
			this._beginPreviewActivity()
			const resolvedDeltaX = toBoundedPointerNumber(deltaX)
			const resolvedDeltaY = toBoundedPointerNumber(deltaY)
			const targetX = Math.round(this._viewport.width / 2)
			const targetY = Math.round(this._viewport.height / 2)
			this._setPreviewOverlay({
				x: targetX,
				y: targetY,
				kind: "scroll",
				label: "Scrolling",
			})
			await this._runtime.wheel(targetX, targetY, resolvedDeltaX, resolvedDeltaY)
			this._touch()
			return this._getStateSnapshot()
		})
	}

	scroll(direction, pixels) {
		return this._enqueue(async () => {
			this._beginPreviewActivity()
			this._setPreviewOverlay({
				kind: "scroll",
				label: "Scrolling",
			})
			await this._runtime.scroll(
				normalizeScrollDirection(direction),
				normalizeScrollDistance(pixels),
			)
			await this._delay(75)
			const state = await this._refreshState({ forceUpdated: true })
			await this._ensurePreviewStreaming()
			return state
		})
	}

	press(key) {
		return this._enqueue(async () => {
			this._beginPreviewActivity()
			this._setPreviewOverlay({
				kind: "key",
				label: "Pressing key",
			})
			await this._runtime.press(
				requireNonEmptyString(key, "A keyboard key is required."),
			)
			await this._delay(75)
			const state = await this._refreshState({ forceUpdated: true })
			await this._ensurePreviewStreaming()
			return state
		})
	}

	insertText(text) {
		return this._enqueue(async () => {
			this._beginPreviewActivity()
			if (typeof text !== "string" || !text) {
				throw new Error("Text input is required.")
			}

			this._setPreviewOverlay({
				kind: "type",
				label: "Typing",
			})

			await this._runtime.insertText(text)
			await this._delay(75)
			const state = await this._refreshState({ forceUpdated: true })
			await this._ensurePreviewStreaming()
			return state
		})
	}

	createTab(url) {
		return this._enqueue(async () => {
			this._beginPreviewActivity()
			this._setPreviewOverlay({
				kind: "navigate",
				label: "Navigating",
			})
			const normalizedUrl =
				typeof url === "string" && url.trim()
					? normalizeChromiumPreviewUrl(url)
					: undefined
			await this._runtime.createTab(normalizedUrl)
			await this._delay(125)
			const state = await this._refreshState({ forceUpdated: true })
			await this._restartPreviewStreaming()
			return state
		})
	}

	activateTab(tabIndex) {
		return this._enqueue(async () => {
			this._beginPreviewActivity()
			this._setPreviewOverlay({
				kind: "navigate",
				label: "Navigating",
			})
			await this._runtime.activateTab(normalizeTabIndex(tabIndex))
			await this._delay(75)
			const state = await this._refreshState({ forceUpdated: true })
			await this._restartPreviewStreaming()
			return state
		})
	}

	closeTab(tabIndex) {
		return this._enqueue(async () => {
			this._beginPreviewActivity()
			this._setPreviewOverlay({
				kind: "navigate",
				label: "Navigating",
			})
			const resolvedIndex = normalizeTabIndex(tabIndex)
			await this._runtime.closeTab(resolvedIndex)
			this._shiftHistoriesAfterClose(resolvedIndex)
			await this._delay(75)
			const state = await this._refreshState({ forceUpdated: true })
			await this._restartPreviewStreaming()
			return state
		})
	}

	screenshot() {
		return this._enqueue(async () => {
			this._setPreviewOverlay({
				kind: "screenshot",
				label: "Taking screenshot",
			})
			return this._captureScreenshot()
		})
	}

	snapshot(options) {
		return this._enqueue(async () => {
			const snapshot = await this._runtime.snapshot(options)
			const state = await this._refreshState()
			return {
				workspaceId: this._workspaceId,
				activeTabIndex: state.activeTabIndex,
				title: state.title,
				url: state.url,
				snapshot: snapshot.snapshot,
				refs: snapshot.refs,
				state,
			}
		})
	}

	createPreviewSession(offerSdp) {
		return this._enqueue(async () => {
			const resolvedOfferSdp = requireNonEmptyMultilineString(
				offerSdp,
				"A non-empty offer SDP is required.",
			)
			await this._refreshState({ forceUpdated: true })

			const sessionId = randomUUID()
			const previewSession =
				typeof this._previewSessionFactory === "function"
					? this._previewSessionFactory({
						sessionId,
						offerSdp: resolvedOfferSdp,
						onControlMessage: (message) =>
							this._handlePreviewControlMessage(message),
						onClose: async () => {
							await this._handlePreviewSessionClose(sessionId)
						},
					})
					: new BrowserPreviewSession({
						sessionId,
						offerSdp: resolvedOfferSdp,
						onControlMessage: (message) =>
							this._handlePreviewControlMessage(message),
						onClose: async () => {
							await this._handlePreviewSessionClose(sessionId)
						},
					})

				this._previewSessions.set(sessionId, previewSession)
				try {
					const result = await previewSession.ready()
					this._syncPreviewMessages()
					await this._ensurePreviewStreaming()
					this._schedulePreviewSettle(50)
					return result
				} catch (error) {
					this._previewSessions.delete(sessionId)
					await previewSession.close().catch(() => {})
					if (!this._hasPreviewConsumers()) {
						this._clearPreviewSettleTimer()
						this._clearPreviewOverlayActivityTimer()
						await this._runtime.stopScreencast().catch(() => {})
					}
				throw error
			}
		})
	}

	deletePreviewSession(sessionId) {
		return this._enqueue(async () => {
			const resolvedSessionId = requireNonEmptyString(
				sessionId,
				"A non-empty preview session ID is required.",
			)
			const session = this._previewSessions.get(resolvedSessionId)
			if (!session) {
				return {
					sessionId: resolvedSessionId,
					closed: false,
				}
			}

			await session.close()
			return {
				sessionId: resolvedSessionId,
				closed: true,
			}
		})
	}

	previewClick(x, y) {
		return this._enqueue(async () => {
			this._beginPreviewActivity()
			const resolvedX = toBoundedPointerNumber(x, { min: 0 })
			const resolvedY = toBoundedPointerNumber(y, { min: 0 })
			this._setPreviewOverlay({
				x: resolvedX,
				y: resolvedY,
				kind: "click",
				label: "Clicking",
			})
			await this._runtime.click(resolvedX, resolvedY)
			await this._delay(75)
			await this._refreshState({ forceUpdated: true })
			await this._ensurePreviewStreaming()
		})
	}

	previewWheel(x, y, deltaX, deltaY) {
		return this._enqueue(async () => {
			this._beginPreviewActivity()
			const resolvedX = toBoundedPointerNumber(x, { min: 0 })
			const resolvedY = toBoundedPointerNumber(y, { min: 0 })
			const resolvedDeltaX = toBoundedPointerNumber(deltaX)
			const resolvedDeltaY = toBoundedPointerNumber(deltaY)
			this._setPreviewOverlay({
				x: resolvedX,
				y: resolvedY,
				kind: "scroll",
				label: "Scrolling",
			})
			await this._runtime.wheel(
				resolvedX,
				resolvedY,
				resolvedDeltaX,
				resolvedDeltaY,
			)
			this._touch()
		})
	}

	previewKeyEvent(eventType, key, code, text) {
		return this._enqueue(async () => {
			this._beginPreviewActivity()
			const resolvedEventType =
				eventType === "keyUp" ? "keyUp" : "keyDown"
			if (resolvedEventType === "keyDown") {
				this._setPreviewOverlay({
					kind: "key",
					label: "Pressing key",
				})
			}
			await this._runtime.keyEvent(
				resolvedEventType,
				typeof key === "string" ? key : undefined,
				typeof code === "string" ? code : undefined,
				typeof text === "string" ? text : undefined,
			)
			await this._delay(25)
			await this._refreshState({ forceUpdated: true })
			await this._ensurePreviewStreaming()
		})
	}

	previewInsertText(text) {
		return this._enqueue(async () => {
			this._beginPreviewActivity()
			if (typeof text !== "string" || !text) {
				return
			}

			this._setPreviewOverlay({
				kind: "type",
				label: "Typing",
			})
			await this._runtime.insertText(text)
			await this._delay(25)
			await this._refreshState({ forceUpdated: true })
			await this._ensurePreviewStreaming()
		})
	}

	attachPreviewClient(client) {
		return this._enqueue(async () => {
			this._previewClients.add(client)
			this._syncPreviewMessages()
			await this._ensurePreviewStreaming()
		})
	}

	detachPreviewClient(client) {
		return this._enqueue(async () => {
			this._previewClients.delete(client)
			if (this._hasPreviewConsumers()) {
				return
			}

			this._clearPreviewSettleTimer()
			this._clearPreviewOverlayActivityTimer()
			await this._runtime.stopScreencast().catch(() => {})
		})
	}

	// One close per workspace: later and concurrent calls (a DELETE, the idle
	// sweep, shutdown) share it. Closing a crashed workspace waits for the
	// crash's release instead of releasing again.
	close() {
		if (this._releasePromise) {
			return this._releasePromise
		}

		this._dispatch({ type: "CLOSE_REQUESTED" })
		this._releasePromise = this._enqueueUnchecked(() => this._release()).then(() => {
			this._dispatch({ type: "CLOSED" })
		})
		return this._releasePromise
	}

	_handleCrash(reason) {
		if (!this._dispatch({ type: "CRASHED", reason })) {
			return
		}

		this._releasePromise = this._enqueueUnchecked(() => this._release())
	}

	async _release() {
		this._clearPreviewSettleTimer()
		this._clearPreviewOverlayActivityTimer()
		for (const session of this._previewSessions.values()) {
			await session.close().catch(() => {})
		}
		this._previewSessions.clear()
		this._previewClients.clear()
		this._latestScreenshotBuffer = null
		this._screenshotDirty = true
		this._previewOverlayState = null
		this._lastExactPointer = null
		this._tabs = [
			{
				index: 0,
				title: "",
				url: DEFAULT_URL,
				active: true,
			},
		]
		this._activeTabIndex = 0
		this._tabHistories = new Map([
			[
				0,
				{
					entries: [DEFAULT_URL],
					index: 0,
				},
			],
		])
		await this._runtime.close().catch(() => {})
		await fs.rm(this._screenshotDir, { recursive: true, force: true }).catch(() => {})
	}
}

// The registry with real workspaces by default; tests pass a workspaceFactory.
class BrowserWorkspaceManager extends BrowserWorkspaceRegistry {
	constructor(options = {}) {
		super({
			...options,
			workspaceFactory:
				options.workspaceFactory ??
				(({ workspaceId, sessionId, nowFn }) =>
					new BrowserWorkspace({ workspaceId, sessionId, nowFn })),
		})
	}
}

const browserWorkspaceManager = new BrowserWorkspaceManager()

module.exports = {
	BrowserWorkspace,
	BrowserWorkspaceManager,
	BrowserWorkspaceNotFoundError,
	browserWorkspaceManager,
	isBrowserWorkspaceNotFoundError,
	MAX_LIVE_BROWSER_WORKSPACES,
	WORKSPACE_IDLE_TIMEOUT_MS,
	WORKSPACE_CLEANUP_INTERVAL_MS,
}
