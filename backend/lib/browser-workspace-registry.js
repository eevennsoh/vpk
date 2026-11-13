"use strict"

// The set of live browser workspaces: lookup with typed rejections, the cap on
// workspaces that hold a browser, shared closes, and the idle sweep. One
// workspace's lifecycle is in browser-workspace-lifecycle.js; the workspace
// itself (BrowserWorkspace) is in browser-workspace-manager.js, which supplies
// the default workspace factory.

const { randomUUID } = require("node:crypto")

const {
	BrowserWorkspaceLimitError,
	BrowserWorkspaceNotFoundError,
	MAX_LIVE_BROWSER_WORKSPACES,
	decideBrowserWorkspaceCreate,
	holdsBrowser,
	isListed,
} = require("./browser-workspace-lifecycle")

const DEFAULT_WORKSPACE_URL = "about:blank"
const WORKSPACE_IDLE_TIMEOUT_MS = 30 * 60 * 1000
const WORKSPACE_CLEANUP_INTERVAL_MS = 60 * 1000

function requireWorkspaceId(value) {
	if (typeof value !== "string" || !value.trim()) {
		throw new Error("A non-empty workspace ID is required.")
	}

	return value.trim()
}

class BrowserWorkspaceRegistry {
	constructor({
		idleTimeoutMs = WORKSPACE_IDLE_TIMEOUT_MS,
		cleanupIntervalMs = WORKSPACE_CLEANUP_INTERVAL_MS,
		nowFn = Date.now,
		workspaceFactory,
		maxLiveWorkspaces = MAX_LIVE_BROWSER_WORKSPACES,
	} = {}) {
		// Every workspace until its close completes; crashed ones until deleted or swept.
		this._workspaces = new Map()
		this._maxLiveWorkspaces = maxLiveWorkspaces
		this._idleTimeoutMs = idleTimeoutMs
		this._cleanupIntervalMs = cleanupIntervalMs
		this._now = nowFn
		this._workspaceFactory = workspaceFactory
		this._cleanupTimer = setInterval(() => {
			void this.cleanupIdleWorkspaces()
		}, this._cleanupIntervalMs)
		this._cleanupTimer.unref?.()
	}

	_createWorkspaceInstance({ workspaceId, sessionId }) {
		return this._workspaceFactory({
			workspaceId,
			sessionId,
			nowFn: this._now,
		})
	}

	_requireWorkspace(workspaceId) {
		const resolvedWorkspaceId = requireWorkspaceId(workspaceId)
		const workspace = this._workspaces.get(resolvedWorkspaceId)
		if (!workspace) {
			throw new BrowserWorkspaceNotFoundError(resolvedWorkspaceId)
		}

		workspace.assertCallable()
		return workspace
	}

	// Promise-returning calls reject instead of throwing synchronously: the
	// preview socket listeners chain `.catch` on them, and a synchronous throw
	// from a socket listener exits the backend.
	_callWorkspace(workspaceId, call) {
		try {
			return call(this._requireWorkspace(workspaceId))
		} catch (error) {
			return Promise.reject(error)
		}
	}

	async createWorkspace(options = {}) {
		// Count and insert before the first await, so concurrent creates cannot overshoot.
		let liveCount = 0
		for (const workspace of this._workspaces.values()) {
			if (holdsBrowser(workspace.getLifecycle())) {
				liveCount += 1
			}
		}
		const decision = decideBrowserWorkspaceCreate({
			liveCount,
			limit: this._maxLiveWorkspaces,
		})
		if (decision.action === "reject") {
			throw new BrowserWorkspaceLimitError(this._maxLiveWorkspaces)
		}

		const workspaceId = randomUUID()
		const sessionId = workspaceId
		const workspace = this._createWorkspaceInstance({
			workspaceId,
			sessionId,
		})

		this._workspaces.set(workspaceId, workspace)
		try {
			await workspace.initialize(options.defaultUrl || DEFAULT_WORKSPACE_URL)
			return workspace.peekState()
		} catch (error) {
			await workspace.close().catch(() => {})
			this._workspaces.delete(workspaceId)
			throw error
		}
	}

	listWorkspaces() {
		return Array.from(this._workspaces.values())
			.filter((workspace) => isListed(workspace.getLifecycle()))
			.map((workspace) => workspace.peekState())
	}

	getWorkspaceState(workspaceId) {
		return this._callWorkspace(workspaceId, (workspace) => workspace.getState())
	}

	getWorkspaceStream(workspaceId) {
		return this._requireWorkspace(workspaceId).getStreamConfig()
	}

	getWorkspaceSnapshot(workspaceId, options) {
		return this._callWorkspace(workspaceId, (workspace) => workspace.snapshot(options))
	}

	getWorkspaceScreenshot(workspaceId) {
		return this._callWorkspace(workspaceId, (workspace) => workspace.screenshot())
	}

	getWorkspaceTabs(workspaceId) {
		return this._callWorkspace(workspaceId, (workspace) => workspace.listTabs())
	}

	navigateWorkspace(workspaceId, url) {
		return this._callWorkspace(workspaceId, (workspace) => workspace.navigate(url))
	}

	resizeWorkspace(workspaceId, width, height, deviceScaleFactor) {
		return this._callWorkspace(workspaceId, (workspace) => workspace.setViewport(
			width,
			height,
			deviceScaleFactor,
		))
	}

	goBack(workspaceId) {
		return this._callWorkspace(workspaceId, (workspace) => workspace.goBack())
	}

	goForward(workspaceId) {
		return this._callWorkspace(workspaceId, (workspace) => workspace.goForward())
	}

	reloadWorkspace(workspaceId) {
		return this._callWorkspace(workspaceId, (workspace) => workspace.reload())
	}

	clickWorkspace(workspaceId, x, y) {
		return this._callWorkspace(workspaceId, (workspace) => workspace.click(x, y))
	}

	clickWorkspaceRef(workspaceId, ref) {
		return this._callWorkspace(workspaceId, (workspace) => workspace.clickRef(ref))
	}

	hoverWorkspaceRef(workspaceId, ref) {
		return this._callWorkspace(workspaceId, (workspace) => workspace.hoverRef(ref))
	}

	fillWorkspaceRef(workspaceId, ref, text) {
		return this._callWorkspace(workspaceId, (workspace) => workspace.fillRef(ref, text))
	}

	typeWorkspaceRef(workspaceId, ref, text) {
		return this._callWorkspace(workspaceId, (workspace) => workspace.typeRef(ref, text))
	}

	selectWorkspaceRef(workspaceId, ref, values) {
		return this._callWorkspace(workspaceId, (workspace) => workspace.selectRef(ref, values))
	}

	scrollWorkspace(workspaceId, direction, pixels) {
		return this._callWorkspace(workspaceId, (workspace) => workspace.scroll(direction, pixels))
	}

	wheelWorkspace(workspaceId, deltaX, deltaY) {
		return this._callWorkspace(workspaceId, (workspace) => workspace.wheel(deltaX, deltaY))
	}

	pressWorkspaceKey(workspaceId, key) {
		return this._callWorkspace(workspaceId, (workspace) => workspace.press(key))
	}

	typeWorkspaceText(workspaceId, text) {
		return this._callWorkspace(workspaceId, (workspace) => workspace.insertText(text))
	}

	createWorkspaceTab(workspaceId, url) {
		return this._callWorkspace(workspaceId, (workspace) => workspace.createTab(url))
	}

	activateWorkspaceTab(workspaceId, tabIndex) {
		return this._callWorkspace(workspaceId, (workspace) => workspace.activateTab(tabIndex))
	}

	closeWorkspaceTab(workspaceId, tabIndex) {
		return this._callWorkspace(workspaceId, (workspace) => workspace.closeTab(tabIndex))
	}

	createWorkspacePreviewSession(workspaceId, offerSdp) {
		return this._callWorkspace(workspaceId, (workspace) => workspace.createPreviewSession(offerSdp))
	}

	deleteWorkspacePreviewSession(workspaceId, sessionId) {
		return this._callWorkspace(workspaceId, (workspace) => workspace.deletePreviewSession(sessionId))
	}

	attachWorkspacePreviewClient(workspaceId, client) {
		return this._callWorkspace(workspaceId, (workspace) => workspace.attachPreviewClient(client))
	}

	detachWorkspacePreviewClient(workspaceId, client) {
		return this._callWorkspace(workspaceId, (workspace) => workspace.detachPreviewClient(client))
	}

	handleWorkspacePreviewControlMessage(workspaceId, message) {
		return this._requireWorkspace(workspaceId)._handlePreviewControlMessage(message)
	}

	async deleteWorkspace(workspaceId) {
		const resolvedWorkspaceId = requireWorkspaceId(workspaceId)
		const workspace = this._workspaces.get(resolvedWorkspaceId)
		if (!workspace) {
			return {
				workspaceId: resolvedWorkspaceId,
				closed: false,
			}
		}

		// Concurrent deletes share the workspace's one close and all resolve after it.
		await workspace.close()
		if (this._workspaces.get(resolvedWorkspaceId) === workspace) {
			this._workspaces.delete(resolvedWorkspaceId)
		}
		return {
			workspaceId: resolvedWorkspaceId,
			closed: true,
		}
	}

	// Shutdown: closes every workspace, including ones another caller is already
	// closing, and resolves when all of them are released.
	async closeAllWorkspaces() {
		const workspaceIds = Array.from(this._workspaces.keys())
		await Promise.all(workspaceIds.map((workspaceId) => this.deleteWorkspace(workspaceId)))
		return workspaceIds.length
	}

	async cleanupIdleWorkspaces() {
		const closedWorkspaceIds = []
		const now = this._now()
		for (const [workspaceId, workspace] of this._workspaces.entries()) {
			const { status } = workspace.getLifecycle()
			if (
				status === "closing" ||
				status === "closed" ||
				now - workspace.getLastUsedAt() <= this._idleTimeoutMs
			) {
				continue
			}

			await this.deleteWorkspace(workspaceId).catch(() => {})
			closedWorkspaceIds.push(workspaceId)
		}

		return closedWorkspaceIds
	}
}

module.exports = {
	BrowserWorkspaceRegistry,
	WORKSPACE_CLEANUP_INTERVAL_MS,
	WORKSPACE_IDLE_TIMEOUT_MS,
}
