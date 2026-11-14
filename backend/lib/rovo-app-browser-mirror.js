/**
 * Headless mirror browser for live-streaming a browsed page to the frontend.
 *
 * Launches a headless Chromium via @playwright/test, navigates to the same URLs
 * as the agent's browser workspace, and streams JPEG frames via WebSocket to the
 * artifact panel.
 *
 * This is a read-only mirror — no interaction controls. The agent's backend
 * browser workspace remains the authoritative browsing session for the agent.
 */

const { redactLogText, redactUrlForLog } = require("./log-redaction")

const SCREENCAST_INTERVAL_MS = 200
const SCREENSHOT_QUALITY = 80
const DEFAULT_VIEWPORT = { width: 1280, height: 900 }
const NAVIGATE_TIMEOUT_MS = 30_000

let playwrightModule = null

function getPlaywright() {
	if (!playwrightModule) {
		try {
			playwrightModule = require("@playwright/test")
		} catch {
			throw new Error(
				"@playwright/test is required for browser mirroring. Install it with: pnpm add -D @playwright/test",
			)
		}
	}
	return playwrightModule
}

class HeadlessMirrorBrowser {
	constructor({ mirrorId, viewport = DEFAULT_VIEWPORT } = {}) {
		this._mirrorId = mirrorId
		this._viewport = viewport
		this._browser = null
		this._page = null
		this._screencastInterval = null
		this._screencastCapturePromise = null
		this._screencastStarting = null
		this._clients = new Set()
		this._lastFrameData = null
		this._lastMetadata = null
		this._currentUrl = "about:blank"
	}

	async launch() {
		if (this._browser) return

		const { chromium } = getPlaywright()
		this._browser = await chromium.launch({ headless: true })
		const context = await this._browser.newContext({
			viewport: this._viewport,
		})
		this._page = await context.newPage()
	}

	async navigate(url) {
		if (!this._page) {
			await this.launch()
		}

		this._currentUrl = url
		try {
			await this._page.goto(url, {
				waitUntil: "domcontentloaded",
				timeout: NAVIGATE_TIMEOUT_MS,
			})
		} catch (error) {
			console.warn(`[MIRROR] Navigation to ${redactUrlForLog(url)} failed:`, redactLogText(error?.message ?? ""))
		}

		await this._ensureScreencasting()
	}

	async screenshot() {
		if (!this._page) return null
		return this._page.screenshot({ type: "png" })
	}

	isScreencasting() {
		return this._screencastInterval !== null
	}

	// Two attaches at once share one start: a second call while the first capture is
	// pending would otherwise start a second interval.
	_ensureScreencasting() {
		if (this._screencastInterval) return Promise.resolve()
		if (!this._screencastStarting) {
			this._screencastStarting = this._startScreencasting().finally(() => {
				this._screencastStarting = null
			})
		}
		return this._screencastStarting
	}

	async _startScreencasting() {
		if (this._screencastInterval) return
		if (!this._page) return
		if (this._clients.size === 0) return

		await this._captureAndBroadcast()
		if (this._screencastInterval || this._clients.size === 0) return
		this._screencastInterval = setInterval(() => {
			void this._captureAndBroadcast().catch(() => {})
		}, SCREENCAST_INTERVAL_MS)
		this._screencastInterval.unref?.()
	}

	_stopScreencasting() {
		if (this._screencastInterval) {
			clearInterval(this._screencastInterval)
			this._screencastInterval = null
		}
	}

	async _captureAndBroadcast() {
		if (this._screencastCapturePromise) return this._screencastCapturePromise
		if (!this._page) return

		this._screencastCapturePromise = (async () => {
			const buffer = await this._page.screenshot({
				type: "jpeg",
				quality: SCREENSHOT_QUALITY,
			})
			const data = buffer.toString("base64")
			const metadata = {
				deviceWidth: this._viewport.width,
				deviceHeight: this._viewport.height,
				pageScaleFactor: 1,
			}
			this._lastFrameData = data
			this._lastMetadata = metadata

			const payload = JSON.stringify({ type: "frame", data, metadata })
			for (const client of this._clients) {
				if (client.readyState === 1) {
					client.send(payload)
				}
			}
		})().finally(() => {
			this._screencastCapturePromise = null
		})

		return this._screencastCapturePromise
	}

	attachClient(ws) {
		this._clients.add(ws)

		// Send initial state
		ws.send(
			JSON.stringify({
				type: "preview-state",
				status: "live",
				settledScreenshotRevision: null,
				sourceWidth: this._viewport.width,
				sourceHeight: this._viewport.height,
				pageScaleFactor: 1,
			}),
		)

		// Send last frame immediately so the client isn't staring at a blank canvas
		if (this._lastFrameData) {
			ws.send(
				JSON.stringify({
					type: "frame",
					data: this._lastFrameData,
					metadata: this._lastMetadata,
				}),
			)
		}

		ws.on("close", () => {
			this._clients.delete(ws)
			if (this._clients.size === 0) {
				this._stopScreencasting()
			}
		})

		ws.on("error", () => {
			this._clients.delete(ws)
			if (this._clients.size === 0) {
				this._stopScreencasting()
			}
		})

		// Handle control messages (preview-sync requests)
		ws.on("message", (rawData) => {
			try {
				const message = JSON.parse(String(rawData))
				if (message.type === "preview-sync") {
					ws.send(
						JSON.stringify({
							type: "preview-state",
							status: this._screencastInterval ? "live" : "steady",
							settledScreenshotRevision: null,
							sourceWidth: this._viewport.width,
							sourceHeight: this._viewport.height,
							pageScaleFactor: 1,
						}),
					)
				}
			} catch {
				// Ignore malformed messages
			}
		})

		// Nobody awaits this: a failed first capture is logged instead of becoming an
		// unhandled rejection, which would exit the backend.
		void this._ensureScreencasting().catch((error) => {
			console.warn("[MIRROR] Screencast start failed:", redactLogText(error?.message ?? String(error)))
		})
	}

	getStreamConfig(port) {
		return {
			enabled: true,
			workspaceId: this._mirrorId,
			wsUrl: `ws://127.0.0.1:${port}/api/browser-workspaces/${encodeURIComponent(this._mirrorId)}/live`,
		}
	}

	async close() {
		this._stopScreencasting()
		this._lastFrameData = null
		this._lastMetadata = null

		for (const client of this._clients) {
			client.close()
		}
		this._clients.clear()

		if (this._browser) {
			await this._browser.close().catch(() => {})
			this._browser = null
			this._page = null
		}
	}
}

// Global registry of mirror browsers keyed by mirrorId (typically threadId)
const mirrorBrowsers = new Map()

async function getOrCreateMirrorBrowser(mirrorId) {
	let mirror = mirrorBrowsers.get(mirrorId)
	if (mirror) return mirror

	mirror = new HeadlessMirrorBrowser({ mirrorId })
	mirrorBrowsers.set(mirrorId, mirror)
	await mirror.launch()
	return mirror
}

function getMirrorBrowser(mirrorId) {
	return mirrorBrowsers.get(mirrorId) ?? null
}

// Closes started by destroyMirrorBrowser, so shutdown can wait for them too.
const closingMirrors = new Set()

async function destroyMirrorBrowser(mirrorId) {
	const mirror = mirrorBrowsers.get(mirrorId)
	if (!mirror) return

	mirrorBrowsers.delete(mirrorId)
	const closing = mirror.close()
	closingMirrors.add(closing)
	try {
		await closing
	} finally {
		closingMirrors.delete(closing)
	}
}

// Shutdown: closes every registered mirror and waits for closes already started.
// Returns how many it closed; a second call finds none.
async function closeAllMirrorBrowsers({ registry = mirrorBrowsers, closing = closingMirrors } = {}) {
	const mirrors = Array.from(registry.values())
	registry.clear()
	await Promise.all([
		...mirrors.map((mirror) => mirror.close().catch(() => {})),
		...Array.from(closing, (promise) => promise.catch(() => {})),
	])
	return mirrors.length
}

module.exports = {
	HeadlessMirrorBrowser,
	mirrorBrowsers,
	getOrCreateMirrorBrowser,
	getMirrorBrowser,
	destroyMirrorBrowser,
	closeAllMirrorBrowsers,
}
