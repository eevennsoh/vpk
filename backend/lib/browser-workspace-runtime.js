const fs = require("node:fs/promises")
const fsSync = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const childProcess = require("node:child_process")
const { execFile } = childProcess
const { createAgentBrowserCaller, isAgentBrowserCallTimeoutError } = require("./agent-browser-call")
const { promisify } = require("node:util")
const WebSocket = require("ws")
const { requireAgentBrowserRef, requireBrowserArgument } = require("./input-schemas")
const {
	DEFAULT_BROWSER_MODE,
} = require("./browser-runtime-config")

const execFileAsync = promisify(execFile)

const BINARY_PATH = path.resolve(
	__dirname,
	"..",
	"..",
	"node_modules",
	".bin",
	process.platform === "win32" ? "agent-browser.cmd" : "agent-browser",
)

const MAX_OUTPUT_BYTES = 10 * 1024 * 1024
const SCREENSHOT_ROOT_DIR = path.join(os.tmpdir(), "vpk-browser-workspaces")
const DEFAULT_AGENT_BROWSER_SUBPROCESS_HOME = path.join(
	os.tmpdir(),
	"vpk-agent-browser-home",
)
const DEFAULT_AGENT_BROWSER_HOME = path.join(
	DEFAULT_AGENT_BROWSER_SUBPROCESS_HOME,
	".agent-browser",
)

const DEFAULT_DEVICE_SCALE_FACTOR = 1
const DEFAULT_VIEWPORT = {
	width: 1280,
	height: 900,
}
const DEFAULT_SCREENCAST_QUALITY = 82
const DEFAULT_SCREENCAST_MAX_WIDTH = 1600
const DEFAULT_SCREENCAST_MAX_HEIGHT = 1200
const SCREENCAST_INTERVAL_MS = 200
const OPEN_TIMEOUT_RECOVERY_ATTEMPTS = 5
const OPEN_TIMEOUT_RECOVERY_DELAY_MS = 500
const DEFAULT_AGENT_BROWSER_EXECUTABLE_CANDIDATE_PATHS = [
	"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
	"/Applications/Chromium.app/Contents/MacOS/Chromium",
]

let installPromise = null

function delay(milliseconds) {
	return new Promise((resolve) => {
		setTimeout(resolve, milliseconds)
	})
}

function clampDeviceScaleFactor(value) {
	const parsed = Number.parseFloat(String(value))
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return DEFAULT_DEVICE_SCALE_FACTOR
	}

	return Math.min(Math.max(parsed, 1), 3)
}

function sanitizeSessionToken(value) {
	if (typeof value !== "string" || !value.trim()) {
		return "default"
	}

	return value.trim().replace(/[^a-zA-Z0-9_-]+/g, "-")
}

function parseJsonOutput(stdout) {
	const trimmed = typeof stdout === "string" ? stdout.trim() : ""
	if (!trimmed) {
		return null
	}

	const jsonLine = trimmed
		.split(/\r?\n/u)
		.reverse()
		.find((line) => {
			const candidate = line.trim()
			return candidate.startsWith("{") || candidate.startsWith("[")
		})

	if (!jsonLine) {
		return null
	}

	try {
		return JSON.parse(jsonLine)
	} catch {
		return null
	}
}

function normalizeRefKey(ref) {
	if (typeof ref !== "string" || !ref) {
		return ref
	}

	return ref.startsWith("@") ? ref : `@${ref}`
}

function normalizeSnapshotText(snapshot) {
	if (typeof snapshot !== "string" || !snapshot) {
		return "Empty page"
	}

	return snapshot.replace(/\bref=(e\d+)\b/gu, "ref=@$1")
}

function hasConfiguredString(value) {
	return typeof value === "string" && value.trim().length > 0
}

function resolveAgentBrowserExecutablePath({
	env = process.env,
	fsImpl = fsSync,
} = {}) {
	if (hasConfiguredString(env?.AGENT_BROWSER_EXECUTABLE_PATH)) {
		return env.AGENT_BROWSER_EXECUTABLE_PATH.trim()
	}

	if (typeof fsImpl?.existsSync !== "function") {
		return null
	}

	for (const candidatePath of DEFAULT_AGENT_BROWSER_EXECUTABLE_CANDIDATE_PATHS) {
		if (fsImpl.existsSync(candidatePath)) {
			return candidatePath
		}
	}

	return null
}

function buildAgentBrowserEnv({
	env = process.env,
	agentBrowserExecutablePath,
	fsImpl = fsSync,
} = {}) {
	const resolvedAgentBrowserHome = hasConfiguredString(env?.AGENT_BROWSER_HOME)
		? env.AGENT_BROWSER_HOME.trim()
		: DEFAULT_AGENT_BROWSER_HOME
	const resolvedSubprocessHome = path.dirname(resolvedAgentBrowserHome)
	const baseEnv = {
		...env,
		AGENT_BROWSER_HOME: resolvedAgentBrowserHome,
		HOME: resolvedSubprocessHome,
		USERPROFILE: resolvedSubprocessHome,
	}
	const resolvedExecutablePath =
		hasConfiguredString(agentBrowserExecutablePath)
			? agentBrowserExecutablePath.trim()
			: resolveAgentBrowserExecutablePath({ env, fsImpl })

	if (!hasConfiguredString(resolvedExecutablePath)) {
		return baseEnv
	}

	return {
		...baseEnv,
		AGENT_BROWSER_EXECUTABLE_PATH: resolvedExecutablePath,
	}
}

async function ensureAgentBrowserDirectories({
	env = process.env,
	fsImpl = fs,
} = {}) {
	const directoriesToEnsure = new Set()

	if (hasConfiguredString(env?.HOME)) {
		directoriesToEnsure.add(path.join(env.HOME.trim(), ".agent-browser"))
	}
	if (hasConfiguredString(env?.AGENT_BROWSER_HOME)) {
		directoriesToEnsure.add(env.AGENT_BROWSER_HOME.trim())
	}

	for (const directoryPath of directoriesToEnsure) {
		await fsImpl.mkdir(directoryPath, { recursive: true })
	}
}

function parseComparableUrl(value) {
	if (typeof value !== "string" || !value.trim()) {
		return null
	}

	try {
		const parsed = new URL(value.trim())
		parsed.hash = ""
		return parsed
	} catch {
		return null
	}
}

function normalizeComparableHostname(value) {
	return typeof value === "string"
		? value.trim().toLowerCase().replace(/^www\./u, "")
		: ""
}

function normalizeComparablePathname(value) {
	if (typeof value !== "string") {
		return ""
	}

	const trimmed = value.trim().replace(/\/+$/u, "")
	return trimmed === "/" ? "" : trimmed
}

function urlsLooselyMatch(currentUrl, targetUrl) {
	const current = parseComparableUrl(currentUrl)
	const target = parseComparableUrl(targetUrl)
	if (!current || !target) {
		return false
	}

	if (
		normalizeComparableHostname(current.hostname) !==
		normalizeComparableHostname(target.hostname)
	) {
		return false
	}

	const targetPathname = normalizeComparablePathname(target.pathname)
	if (!targetPathname) {
		return true
	}

	const currentPathname = normalizeComparablePathname(current.pathname)
	return (
		currentPathname === targetPathname ||
		currentPathname.startsWith(`${targetPathname}/`)
	)
}

function stateLooksLoadedForTarget(state, targetUrl) {
	if (!state || typeof state !== "object") {
		return false
	}

	return urlsLooselyMatch(state.url, targetUrl)
}

function isOperationTimedOutError(error) {
	const message =
		error instanceof Error && typeof error.message === "string"
			? error.message
			: String(error ?? "")

	return /\boperation timed out\b|\btimed out\b/iu.test(message)
}

function getPngDimensions(buffer) {
	if (!Buffer.isBuffer(buffer) || buffer.length < 24) {
		return null
	}

	const pngSignature = "89504e470d0a1a0a"
	if (buffer.subarray(0, 8).toString("hex") !== pngSignature) {
		return null
	}

	return {
		width: buffer.readUInt32BE(16),
		height: buffer.readUInt32BE(20),
	}
}

function getJpegDimensions(buffer) {
	if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
		return null
	}

	if (buffer[0] !== 0xff || buffer[1] !== 0xd8) {
		return null
	}

	let offset = 2
	while (offset + 8 < buffer.length) {
		if (buffer[offset] !== 0xff) {
			offset += 1
			continue
		}

		const marker = buffer[offset + 1]
		offset += 2

		if (marker === 0xd8 || marker === 0xd9) {
			continue
		}

		if (offset + 2 > buffer.length) {
			break
		}

		const segmentLength = buffer.readUInt16BE(offset)
		if (segmentLength < 2 || offset + segmentLength > buffer.length) {
			break
		}

		const isStartOfFrame =
			(marker >= 0xc0 && marker <= 0xc3) ||
			(marker >= 0xc5 && marker <= 0xc7) ||
			(marker >= 0xc9 && marker <= 0xcb) ||
			(marker >= 0xcd && marker <= 0xcf)
		if (isStartOfFrame && segmentLength >= 7) {
			return {
				height: buffer.readUInt16BE(offset + 3),
				width: buffer.readUInt16BE(offset + 5),
			}
		}

		offset += segmentLength
	}

	return null
}

function getImageDimensions(buffer, format) {
	if (format === "jpeg") {
		return getJpegDimensions(buffer)
	}

	if (format === "png") {
		return getPngDimensions(buffer)
	}

	return null
}

async function ensureAgentBrowserInstalled({
	env = process.env,
	fsImpl = fsSync,
	execFileImpl = execFileAsync,
} = {}) {
	const executablePath = resolveAgentBrowserExecutablePath({ env, fsImpl })
	if (
		hasConfiguredString(executablePath) &&
		typeof fsImpl?.existsSync === "function" &&
		fsImpl.existsSync(executablePath)
	) {
		await ensureAgentBrowserDirectories({ env })
		return
	}

	await ensureAgentBrowserDirectories({ env })

	if (!installPromise) {
		installPromise = execFileImpl(BINARY_PATH, ["install"], {
			env: buildAgentBrowserEnv({
				env,
				agentBrowserExecutablePath: executablePath,
				fsImpl,
			}),
			maxBuffer: MAX_OUTPUT_BYTES,
		}).catch((error) => {
			installPromise = null
			const stderr =
				typeof error?.stderr === "string" && error.stderr.trim()
					? error.stderr.trim()
					: null
			const stdout =
				typeof error?.stdout === "string" && error.stdout.trim()
					? error.stdout.trim()
					: null
			throw new Error(stderr || stdout || error?.message || "agent-browser install failed.")
		})
	}

	return installPromise
}

class AgentBrowserRuntime {
	constructor({
		sessionId,
		viewport = DEFAULT_VIEWPORT,
		deviceScaleFactor = DEFAULT_DEVICE_SCALE_FACTOR,
		agentBrowserExecutablePath = resolveAgentBrowserExecutablePath(),
		onCrash = null,
		timers = undefined,
	} = {}) {
		const sessionToken = sanitizeSessionToken(sessionId)
		// Each command is bounded; one that does not answer calls onCrash (agent-browser-call.js).
		this._caller = createAgentBrowserCaller({ execFileImpl: childProcess.execFile, file: BINARY_PATH, onCrash, timers })

		this._sessionId = sessionId
		this._sessionName = `browser-workspace-${sessionToken}`
		this._browserMode = DEFAULT_BROWSER_MODE
		this._agentBrowserExecutablePath = agentBrowserExecutablePath
		this._agentBrowserEnv = buildAgentBrowserEnv({
			agentBrowserExecutablePath,
		})
		this._provider = "browser-workspace"
		this._viewport = {
			width: viewport.width,
			height: viewport.height,
		}
		this._deviceScaleFactor = clampDeviceScaleFactor(deviceScaleFactor)
		this._isBrowserReady = false
		this._nativeStreamConnectPromise = null
		this._nativeStreamSocket = null
		this._screencastInterval = null
		this._screencastCapturePromise = null
		this._screenshotDir = path.join(SCREENSHOT_ROOT_DIR, sessionToken)
		this._pngScreenshotPath = path.join(this._screenshotDir, "latest.png")
		this._jpegScreenshotPath = path.join(this._screenshotDir, "live.jpg")
	}

	getBrowserStateMetadata() {
		return {
			provider: this._provider,
		}
	}

	async _executeAgentBrowser(commandArgs, args = commandArgs) {
		this._caller.assertAnswering(args)
		await ensureAgentBrowserDirectories({
			env: this._agentBrowserEnv,
		})
		return this._caller.call({ args, commandArgs, options: { env: this._agentBrowserEnv, maxBuffer: MAX_OUTPUT_BYTES } })
	}

	async _buildCommandArgs(args, {
		json = false,
		includeSession = true,
	} = {}) {
		const commandArgs = []
		if (json) {
			commandArgs.push("--json")
		}
		if (includeSession) {
			commandArgs.push("--session", this._sessionName)
		}
		commandArgs.push(...args.map((value) => String(value)))
		return commandArgs
	}

	async _runCommand(args, { json = false, includeSession = true } = {}) {
		const commandArgs = await this._buildCommandArgs(args, {
			json,
			includeSession,
		})

		try {
			return await this._executeAgentBrowser(commandArgs, args)
		} catch (error) {
			if (isAgentBrowserCallTimeoutError(error)) throw error
			const stderr =
				typeof error?.stderr === "string" && error.stderr.trim()
					? error.stderr.trim()
					: null
			const stdout =
				typeof error?.stdout === "string" && error.stdout.trim()
					? error.stdout.trim()
					: null
			throw new Error(
				stderr ||
					stdout ||
					error?.message ||
					`agent-browser ${args[0] || "command"} failed.`,
			)
		}
	}

	async _runJsonCommand(args) {
		const stdout = await this._runCommand(args, { json: true })
		const payload = parseJsonOutput(stdout)
		if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
			throw new Error(
				`agent-browser ${args[0] || "command"} returned invalid JSON output.`,
			)
		}
		if (payload.success === false) {
			throw new Error(
				typeof payload.error === "string" && payload.error
					? payload.error
					: `agent-browser ${args[0] || "command"} failed.`,
			)
		}

		return payload.data ?? null
	}

	async _ensureInstalled() {
		await ensureAgentBrowserInstalled({
			env: this._agentBrowserEnv,
		})
	}

	async _readStateFromActiveSession() {
		const data = await this._runJsonCommand(["tab"])
		const tabs = Array.isArray(data?.tabs)
			? data.tabs
					.filter((tab) => typeof tab?.index === "number")
					.map((tab) => ({
						active: tab.active === true,
						index: tab.index,
						title: typeof tab.title === "string" ? tab.title : "",
						type: typeof tab.type === "string" ? tab.type : "page",
						url: typeof tab.url === "string" && tab.url ? tab.url : "about:blank",
					}))
			: []
		const activeTab = tabs.find((tab) => tab.active) ?? tabs[0]

		return {
			activeTabIndex: activeTab?.index ?? 0,
			tabs,
			title: activeTab?.title ?? "",
			url: activeTab?.url ?? "about:blank",
		}
	}

	async _recoverTimedOutOpen(url) {
		for (
			let attempt = 0;
			attempt < OPEN_TIMEOUT_RECOVERY_ATTEMPTS;
			attempt += 1
		) {
			const state = await this._readStateFromActiveSession().catch(() => null)
			if (stateLooksLoadedForTarget(state, url)) {
				return true
			}

			if (attempt + 1 < OPEN_TIMEOUT_RECOVERY_ATTEMPTS) {
				await delay(OPEN_TIMEOUT_RECOVERY_DELAY_MS)
			}
		}

		return false
	}

	async _openUrl(url) {
		try {
			await this._runCommand(["open", url])
		} catch (error) {
			if (
				isOperationTimedOutError(error) &&
				(await this._recoverTimedOutOpen(url))
			) {
				return
			}

			throw error
		}
	}

	async _applyViewport() {
		await this._runCommand([
			"set",
			"viewport",
			this._viewport.width,
			this._viewport.height,
			this._deviceScaleFactor,
		])
	}

	async _ensureBrowser(initialUrl = "about:blank") {
		if (this._isBrowserReady) {
			return
		}

		await this._ensureInstalled()
		await this._openUrl(initialUrl)
		this._isBrowserReady = true
	}

	async _readState() {
		await this._ensureBrowser()
		return this._readStateFromActiveSession()
	}

	async _captureScreenshotBuffer({
		format = "png",
		quality = DEFAULT_SCREENCAST_QUALITY,
	} = {}) {
		await this._ensureBrowser()
		await fs.mkdir(this._screenshotDir, { recursive: true })

		const filePath =
			format === "jpeg" ? this._jpegScreenshotPath : this._pngScreenshotPath
		const args = ["screenshot", filePath]
		if (format === "jpeg") {
			args.push("--screenshot-format", "jpeg", "--screenshot-quality", quality)
		}

		await this._runCommand(args)
		return fs.readFile(filePath)
	}

	_getScreencastFallbackMetadata() {
		return {
			deviceWidth: Math.min(
				Math.round(this._viewport.width * this._deviceScaleFactor),
				DEFAULT_SCREENCAST_MAX_WIDTH,
			),
			deviceHeight: Math.min(
				Math.round(this._viewport.height * this._deviceScaleFactor),
				DEFAULT_SCREENCAST_MAX_HEIGHT,
			),
			pageScaleFactor: this._deviceScaleFactor,
		}
	}

	async _captureScreencastFrameBuffer() {
		return this._captureScreenshotBuffer({
			format: "jpeg",
			quality: DEFAULT_SCREENCAST_QUALITY,
		})
	}

	async _getNativeStreamStatus() {
		return this._runJsonCommand(["stream", "status"])
	}

	async _enableNativeStream() {
		return this._runJsonCommand(["stream", "enable"])
	}

	async _disableNativeStream() {
		await this._runCommand(["stream", "disable"]).catch(() => {})
	}

	_normalizeNativeStreamMetadata(rawMetadata) {
		const fallbackMetadata = this._getScreencastFallbackMetadata()
		const deviceWidth = Number.parseInt(String(rawMetadata?.deviceWidth), 10)
		const deviceHeight = Number.parseInt(String(rawMetadata?.deviceHeight), 10)
		const pageScaleFactor = Number.parseFloat(
			String(rawMetadata?.pageScaleFactor),
		)

		return {
			deviceWidth:
				Number.isFinite(deviceWidth) && deviceWidth > 0
					? deviceWidth
					: fallbackMetadata.deviceWidth,
			deviceHeight:
				Number.isFinite(deviceHeight) && deviceHeight > 0
					? deviceHeight
					: fallbackMetadata.deviceHeight,
			pageScaleFactor:
				Number.isFinite(pageScaleFactor) && pageScaleFactor > 0
					? pageScaleFactor
					: fallbackMetadata.pageScaleFactor,
		}
	}

	async _connectNativeStream(port, callback) {
		return new Promise((resolve, reject) => {
			const socket = new WebSocket(`ws://127.0.0.1:${port}`)
			let settled = false

			socket.on("open", () => {
				settled = true
				resolve(socket)
			})

			socket.on("message", (rawMessage, isBinary) => {
				if (isBinary) {
					return
				}

				const parsedMessage = parseJsonOutput(String(rawMessage))
				if (
					!parsedMessage ||
					parsedMessage.type !== "frame" ||
					typeof parsedMessage.data !== "string"
				) {
					return
				}

				callback({
					buffer: Buffer.from(parsedMessage.data, "base64"),
					metadata: this._normalizeNativeStreamMetadata(
						parsedMessage.metadata,
					),
				})
			})

			socket.on("close", () => {
				if (this._nativeStreamSocket === socket) {
					this._nativeStreamSocket = null
				}
			})

			socket.on("error", (error) => {
				if (!settled) {
					reject(error)
				}
			})
		})
	}

	async _startNativeScreencast(callback) {
		let streamStatus = await this._getNativeStreamStatus().catch(() => null)
		let port = Number.parseInt(String(streamStatus?.port), 10)
		if (streamStatus?.enabled !== true || !Number.isFinite(port) || port <= 0) {
			streamStatus = await this._enableNativeStream().catch((error) => {
				if (/already enabled/iu.test(error?.message || "")) {
					return null
				}

				throw error
			})
			const refreshedStatus = streamStatus ??
				(await this._getNativeStreamStatus().catch(() => null))
			port = Number.parseInt(String(refreshedStatus?.port), 10)
			if (
				refreshedStatus?.enabled !== true ||
				!Number.isFinite(port) ||
				port <= 0
			) {
				return false
			}
		}

		this._nativeStreamSocket = await this._connectNativeStream(port, callback)
		return true
	}

	async initialize(defaultUrl) {
		const initialUrl =
			typeof defaultUrl === "string" && defaultUrl !== "about:blank"
				? defaultUrl
				: "about:blank"
		await this._ensureBrowser(initialUrl)
	}

	async getState() {
		return this._readState()
	}

	async navigate(url) {
		await this._ensureBrowser()
		await this._openUrl(url)
	}

	async setViewport(width, height, deviceScaleFactor = this._deviceScaleFactor) {
		await this._ensureBrowser()
		this._viewport = {
			width,
			height,
		}
		this._deviceScaleFactor = clampDeviceScaleFactor(deviceScaleFactor)
		await this._applyViewport()
	}

	async back() {
		await this._ensureBrowser()
		await this._runCommand(["back"])
	}

	async forward() {
		await this._ensureBrowser()
		await this._runCommand(["forward"])
	}

	async reload() {
		await this._ensureBrowser()
		await this._runCommand(["reload"])
	}

	async click(x, y) {
		await this._ensureBrowser()
		await this._runCommand(["mouse", "move", x, y])
		await this._runCommand(["mouse", "down", "left"])
		await this._runCommand(["mouse", "up", "left"])
	}

	async clickRef(ref) {
		await this._ensureBrowser()
		await this._runCommand(["click", requireAgentBrowserRef(ref)])
	}

	async hoverRef(ref) {
		await this._ensureBrowser()
		await this._runCommand(["hover", requireAgentBrowserRef(ref)])
	}

	async fillRef(ref, text) {
		await this._ensureBrowser()
		await this._runCommand(["fill", requireAgentBrowserRef(ref), requireBrowserArgument(text, "Text")])
	}

	async typeRef(ref, text) {
		await this._ensureBrowser()
		await this._runCommand(["type", requireAgentBrowserRef(ref), requireBrowserArgument(text, "Text")])
	}

	async selectRef(ref, values) {
		await this._ensureBrowser()
		await this._runCommand(["select", requireAgentBrowserRef(ref), ...values.map((value) => requireBrowserArgument(value, "A select value"))])
	}

	async wheel(x, y, deltaX, deltaY) {
		await this._ensureBrowser()
		await this._runCommand(["mouse", "move", x, y])
		await this._runCommand(["mouse", "wheel", deltaY, deltaX])
	}

	async scroll(direction, pixels) {
		await this._ensureBrowser()
		await this._runCommand(["scroll", direction, pixels])
	}

	async press(key) {
		await this._ensureBrowser()
		await this._runCommand(["press", requireBrowserArgument(key, "A key")])
	}

	async keyEvent(eventType, key, code, text) {
		await this._ensureBrowser()
		const value =
			typeof key === "string" && key
				? key
				: typeof text === "string" && text
					? text
					: typeof code === "string" && code
						? code
						: null
		if (!value) {
			return
		}

		await this._runCommand([eventType === "keyUp" ? "keyup" : "keydown", requireBrowserArgument(value, "A key")])
	}

	async insertText(text) {
		await this._ensureBrowser()
		await this._runCommand(["keyboard", "inserttext", requireBrowserArgument(text, "Text")])
	}

	async createTab(url) {
		await this._ensureBrowser()
		const args = ["tab", "new"]
		if (url && url !== "about:blank") {
			args.push(url)
		}
		await this._runCommand(args)
	}

	async activateTab(tabIndex) {
		await this._ensureBrowser()
		await this._runCommand(["tab", tabIndex])
	}

	async closeTab(tabIndex) {
		const state = await this._readState()
		const resolvedIndex =
			typeof tabIndex === "number" ? tabIndex : state.activeTabIndex
		if (resolvedIndex < 0 || resolvedIndex >= state.tabs.length) {
			throw new Error(`Invalid tab index: ${resolvedIndex}`)
		}
		if (state.tabs.length === 1) {
			throw new Error('Cannot close the last tab. Use "close" to close the browser.')
		}

		await this._runCommand(["tab", "close", resolvedIndex])
	}

	async screenshotBuffer() {
		return this._captureScreenshotBuffer({ format: "png" })
	}

	async snapshot(options = {}) {
		await this._ensureBrowser()
		const data = await this._runJsonCommand([
			"snapshot",
			...(options.interactive ? ["-i"] : []),
		])
		const refs = Object.entries(data?.refs || {}).reduce((accumulator, [ref, entry]) => {
			accumulator[normalizeRefKey(ref)] = {
				role: entry?.role,
				name: entry?.name,
			}
			return accumulator
		}, {})

		return {
			snapshot: normalizeSnapshotText(data?.snapshot),
			refs: Object.keys(refs).length > 0 ? refs : undefined,
		}
	}

	isScreencasting() {
		return (
			this._nativeStreamSocket !== null ||
			this._nativeStreamConnectPromise !== null ||
			this._screencastInterval !== null ||
			this._screencastCapturePromise !== null
		)
	}

	async startScreencast(callback) {
		if (this.isScreencasting()) {
			return
		}
		await this._ensureBrowser()

		this._nativeStreamConnectPromise = this._startNativeScreencast(callback)
			.catch(() => false)
		const startedNativeStream = await this._nativeStreamConnectPromise
		this._nativeStreamConnectPromise = null
		if (startedNativeStream) {
			return
		}

		const emitFrame = async () => {
			if (this._screencastCapturePromise) {
				return this._screencastCapturePromise
			}

			this._screencastCapturePromise = (async () => {
				const buffer = await this._captureScreencastFrameBuffer()
				const fallbackMetadata = this._getScreencastFallbackMetadata()
				const dimensions =
					getImageDimensions(buffer, "jpeg") || fallbackMetadata
				callback({
					buffer,
					metadata: {
						deviceWidth: dimensions.width ?? fallbackMetadata.deviceWidth,
						deviceHeight: dimensions.height ?? fallbackMetadata.deviceHeight,
						pageScaleFactor: fallbackMetadata.pageScaleFactor,
					},
				})
			})().finally(() => {
				this._screencastCapturePromise = null
			})

			return this._screencastCapturePromise
		}

		await emitFrame()
		this._screencastInterval = setInterval(() => {
			void emitFrame().catch(() => {})
		}, SCREENCAST_INTERVAL_MS)
		this._screencastInterval.unref?.()
	}

	async stopScreencast() {
		if (this._screencastInterval) {
			clearInterval(this._screencastInterval)
			this._screencastInterval = null
		}

		await this._screencastCapturePromise?.catch(() => {})
		this._screencastCapturePromise = null
		await this._nativeStreamConnectPromise?.catch(() => {})
		this._nativeStreamConnectPromise = null
		if (this._nativeStreamSocket) {
			const socket = this._nativeStreamSocket
			this._nativeStreamSocket = null
			socket.close()
		}
		if (this._isBrowserReady) {
			await this._disableNativeStream()
		}
	}

	async close() {
		await this.stopScreencast()
		// A command that did not answer (an initial open included) may have left a browser.
		if (!this._isBrowserReady && !this._caller.hasTimedOut()) {
			return
		}

		this._isBrowserReady = false
		await this._runCommand(["close"]).catch(() => {})
	}
}

module.exports = {
	AgentBrowserRuntime,
	buildAgentBrowserEnv,
	DEFAULT_DEVICE_SCALE_FACTOR,
	DEFAULT_AGENT_BROWSER_EXECUTABLE_CANDIDATE_PATHS,
	DEFAULT_VIEWPORT,
	DEFAULT_SCREENCAST_QUALITY,
	DEFAULT_SCREENCAST_MAX_WIDTH,
	DEFAULT_SCREENCAST_MAX_HEIGHT,
	ensureAgentBrowserDirectories,
	ensureAgentBrowserInstalled,
	resolveAgentBrowserExecutablePath,
}
