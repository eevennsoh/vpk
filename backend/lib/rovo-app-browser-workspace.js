const fs = require("node:fs/promises")
const os = require("node:os")
const path = require("node:path")
const { createHash } = require("node:crypto")
const { execFile } = require("node:child_process")
const { promisify } = require("node:util")
const { requireAgentBrowserRef, requireBrowserArgument, requirePreviewKey } = require("./input-schemas")

const execFileAsync = promisify(execFile)

const AGENT_BROWSER_BINARY_PATH = path.resolve(
	__dirname,
	"..",
	"..",
	"node_modules",
	".bin",
	process.platform === "win32" ? "agent-browser.cmd" : "agent-browser",
)

const DEFAULT_URL = "about:blank"
const DEFAULT_PROVIDER = "browser-workspace"
const DEFAULT_VIEWPORT = {
	width: 1280,
	height: 900,
}
const EMPTY_PAGE_SNAPSHOT = "Empty page"
const MAX_OUTPUT_BYTES = 10 * 1024 * 1024
const SCREENSHOT_OUTPUT_DIR = path.join(
	os.tmpdir(),
	"agent-browser-screenshots",
)

const threadOperationTails = new Map()
const knownThreadSessions = new Set()

function requireNonEmptyString(value, message) {
	if (typeof value !== "string" || !value.trim()) {
		throw new Error(message)
	}

	return value.trim()
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

function normalizeComparableUrl(value) {
	if (typeof value !== "string" || !value.trim()) {
		return null
	}

	try {
		const parsed = new URL(value.trim())
		parsed.hash = ""
		parsed.hostname = parsed.hostname.replace(/^www\./u, "")
		if (parsed.pathname !== "/") {
			parsed.pathname = parsed.pathname.replace(/\/+$/u, "")
		}
		if (
			(parsed.protocol === "https:" && parsed.port === "443") ||
			(parsed.protocol === "http:" && parsed.port === "80")
		) {
			parsed.port = ""
		}
		return parsed.toString()
	} catch {
		return value.trim()
	}
}

function urlsLooselyMatch(currentUrl, targetUrl) {
	const normalizedCurrentUrl = normalizeComparableUrl(currentUrl)
	const normalizedTargetUrl = normalizeComparableUrl(targetUrl)
	if (!normalizedCurrentUrl || !normalizedTargetUrl) {
		return false
	}

	return normalizedCurrentUrl === normalizedTargetUrl
}

function getTrimmedStringOrNull(value) {
	if (typeof value !== "string" || !value.trim()) {
		return null
	}

	return value.trim()
}

function getFiniteNumberOrDefault(value, defaultValue) {
	return typeof value === "number" && Number.isFinite(value) ? value : defaultValue
}

function normalizeBrowserTab(tab, tabIndex) {
	return {
		active: tab.active === true,
		index: getFiniteNumberOrDefault(tab.index, tabIndex),
		tabId: getTrimmedStringOrNull(tab.tabId),
		title: typeof tab.title === "string" ? tab.title : "",
		type: typeof tab.type === "string" ? tab.type : "page",
		url: typeof tab.url === "string" && tab.url ? tab.url : DEFAULT_URL,
	}
}

function getActiveBrowserTab(tabs) {
	return tabs.find((tab) => tab.active) ?? tabs[0] ?? null
}

function enqueueThreadOperation(threadId, operation) {
	const currentTail = threadOperationTails.get(threadId) ?? Promise.resolve()
	const nextOperation = currentTail.then(operation, operation)
	const settledTail = nextOperation.catch(() => {})
	threadOperationTails.set(threadId, settledTail)

	return nextOperation.finally(() => {
		if (threadOperationTails.get(threadId) === settledTail) {
			threadOperationTails.delete(threadId)
		}
	})
}

function getRovoAppThreadBrowserSessionName(threadId) {
	const resolvedThreadId = requireNonEmptyString(
		threadId,
		"A non-empty threadId is required.",
	)
	const sanitizedThreadId = sanitizeSessionToken(resolvedThreadId)
	const hashedThreadId = createHash("sha1")
		.update(resolvedThreadId)
		.digest("hex")
		.slice(0, 12)
	const readablePrefix = sanitizedThreadId.slice(0, 16).replace(/-+$/u, "")
	return readablePrefix
		? `rt-${readablePrefix}-${hashedThreadId}`
		: `rt-${hashedThreadId}`
}

function getRovoAppThreadBrowserWorkspaceId(threadId) {
	return `agent-browser-session:${getRovoAppThreadBrowserSessionName(threadId)}`
}

function getAgentBrowserCommandName(args) {
	return args[0] || "command"
}

async function runAgentBrowserJson(threadId, args) {
	const sessionName = getRovoAppThreadBrowserSessionName(threadId)
	const commandName = getAgentBrowserCommandName(args)

	try {
		const { stdout } = await execFileAsync(
			AGENT_BROWSER_BINARY_PATH,
			["--session", sessionName, ...args, "--json"],
			{
				env: process.env,
				maxBuffer: MAX_OUTPUT_BYTES,
			},
		)
		const payload = parseJsonOutput(stdout)
		if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
			throw new Error(
				`agent-browser ${commandName} returned invalid JSON output.`,
			)
		}
		if (payload.success === false) {
			throw new Error(
				typeof payload.error === "string" && payload.error
					? payload.error
					: `agent-browser ${commandName} failed.`,
			)
		}

		return payload.data ?? null
	} catch (error) {
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
				`agent-browser ${commandName} failed.`,
		)
	}
}

function buildBrowserState(threadId, tabsPayload) {
	const tabs = Array.isArray(tabsPayload?.tabs)
		? tabsPayload.tabs.map(normalizeBrowserTab)
		: []
	const activeTab = getActiveBrowserTab(tabs)

	return {
		activeTabIndex: activeTab?.index ?? 0,
		canGoBack: false,
		canGoForward: false,
		provider: DEFAULT_PROVIDER,
		ready: true,
		tabs,
		title: activeTab?.title ?? "",
		updatedAt: Date.now(),
		url: activeTab?.url ?? DEFAULT_URL,
		viewportHeight: DEFAULT_VIEWPORT.height,
		viewportWidth: DEFAULT_VIEWPORT.width,
		workspaceId: getRovoAppThreadBrowserWorkspaceId(threadId),
	}
}

async function resolveTabIdentifier(threadId, tabIndex) {
	const state = await readThreadBrowserState(threadId)
	const tab = Array.isArray(state.tabs)
		? state.tabs.find((entry) => entry.index === Number(tabIndex))
		: null

	if (tab?.tabId) {
		return tab.tabId
	}

	return requireBrowserArgument(String(tabIndex), "tabIndex")
}

async function readThreadBrowserState(threadId) {
	const tabsPayload = await runAgentBrowserJson(threadId, ["tab"])
	return buildBrowserState(threadId, tabsPayload)
}

function parseStreamPort(value) {
	const port = Number.parseInt(String(value), 10)
	return Number.isFinite(port) && port > 0 ? port : 0
}

async function getRovoAppThreadBrowserStreamConfig(threadId) {
	const streamStatus = await runAgentBrowserJson(threadId, ["stream", "status"])
	const port = parseStreamPort(streamStatus?.port)
	return {
		enabled: streamStatus?.enabled === true && port > 0,
		workspaceId: getRovoAppThreadBrowserWorkspaceId(threadId),
		session: getRovoAppThreadBrowserSessionName(threadId),
		port,
		wsUrl: port > 0 ? `ws://127.0.0.1:${port}` : "",
	}
}

async function buildThreadBrowserWorkspaceResult(threadId, state, {
	created,
} = {}) {
	const result = {
		state,
		streamConfig: await getRovoAppThreadBrowserStreamConfig(threadId),
		workspaceId: state.workspaceId,
	}

	if (typeof created === "boolean") {
		result.created = created
	}

	return result
}

async function ensureRovoAppThreadBrowserWorkspace({
	threadId,
} = {}) {
	const resolvedThreadId = requireNonEmptyString(
		threadId,
		"A non-empty threadId is required.",
	)

	return enqueueThreadOperation(resolvedThreadId, async () => {
		const created = !knownThreadSessions.has(resolvedThreadId)
		const state = await readThreadBrowserState(resolvedThreadId)
		knownThreadSessions.add(resolvedThreadId)
		return buildThreadBrowserWorkspaceResult(resolvedThreadId, state, {
			created,
		})
	})
}

async function getRovoAppThreadBrowserWorkspace({
	threadId,
} = {}) {
	const resolvedThreadId = requireNonEmptyString(
		threadId,
		"A non-empty threadId is required.",
	)

	return enqueueThreadOperation(resolvedThreadId, async () => {
		const state = await readThreadBrowserState(resolvedThreadId)
		return buildThreadBrowserWorkspaceResult(resolvedThreadId, state)
	})
}

// The browser-workspace MCP server (scripts/browser-workspace-mcp.js) builds these
// agent-browser arguments from an agent's tool call. They follow the same rules as the
// HTTP and socket paths: a ref is a snapshot ref, a key is a key, and no value may start
// like an option (agent-browser has no end-of-options marker).
function getBodyText(body, key, message) {
	return requireBrowserArgument(requireNonEmptyString(body[key], message), key)
}

function getBodyStringArray(body, key) {
	return Array.isArray(body[key]) ? body[key].map((value) => requireBrowserArgument(String(value), key)) : []
}

function getOptionalBodyArg(body, key) {
	return body[key] ? [requireBrowserArgument(String(body[key]), key)] : []
}

async function buildWorkspaceActionCommandArgs(threadId, action, body) {
	switch (action) {
		case "navigate":
			return ["open", getBodyText(body, "url", "A non-empty url is required.")]
		case "back":
			return ["back"]
		case "forward":
			return ["forward"]
		case "reload":
			return ["reload"]
		case "click-ref":
			return ["click", requireAgentBrowserRef(body.ref)]
		case "hover-ref":
			return ["hover", requireAgentBrowserRef(body.ref)]
		case "fill-ref":
			return ["fill", requireAgentBrowserRef(body.ref), requireBrowserArgument(String(body.text ?? ""), "text")]
		case "type-ref":
			return ["type", requireAgentBrowserRef(body.ref), requireBrowserArgument(String(body.text ?? ""), "text")]
		case "select-ref":
			return ["select", requireAgentBrowserRef(body.ref), ...getBodyStringArray(body, "values")]
		case "press":
			return ["press", requirePreviewKey(body.key)]
		case "scroll":
			return [
				"scroll",
				getBodyText(body, "direction", "A non-empty direction is required."),
				...getOptionalBodyArg(body, "pixels"),
			]
		case "tab-new":
			return ["tab", "new", ...getOptionalBodyArg(body, "url")]
		case "tab-select":
			return ["tab", await resolveTabIdentifier(threadId, body.tabIndex)]
		case "tab-close":
			return [
				"tab",
				"close",
				await resolveTabIdentifier(threadId, body.tabIndex),
			]
		default:
			throw new Error(`Unsupported browser workspace action: ${action}`)
	}
}

async function performRovoAppThreadBrowserWorkspaceAction({
	threadId,
	action,
	body = {},
} = {}) {
	const resolvedThreadId = requireNonEmptyString(
		threadId,
		"A non-empty threadId is required.",
	)
	const resolvedAction = requireNonEmptyString(
		action,
		"A non-empty action is required.",
	)

	return enqueueThreadOperation(resolvedThreadId, async () => {
		const commandArgs = await buildWorkspaceActionCommandArgs(
			resolvedThreadId,
			resolvedAction,
			body,
		)
		await runAgentBrowserJson(resolvedThreadId, commandArgs)
		return readThreadBrowserState(resolvedThreadId)
	})
}

function buildThreadBrowserSnapshotResult(state, snapshotPayload) {
	return {
		activeTabIndex: state.activeTabIndex,
		refs: snapshotPayload?.refs,
		snapshot: snapshotPayload?.snapshot || EMPTY_PAGE_SNAPSHOT,
		state,
		title: state.title,
		url: state.url,
		workspaceId: state.workspaceId,
	}
}

async function getRovoAppThreadBrowserWorkspaceSnapshot({
	threadId,
	interactive = true,
} = {}) {
	const resolvedThreadId = requireNonEmptyString(
		threadId,
		"A non-empty threadId is required.",
	)

	return enqueueThreadOperation(resolvedThreadId, async () => {
		const snapshotPayload = await runAgentBrowserJson(resolvedThreadId, [
			"snapshot",
			...(interactive ? ["-i"] : []),
		])
		const state = await readThreadBrowserState(resolvedThreadId)
		return buildThreadBrowserSnapshotResult(state, snapshotPayload)
	})
}

function buildThreadBrowserScreenshotPath(threadId) {
	return path.join(
		SCREENSHOT_OUTPUT_DIR,
		`${sanitizeSessionToken(getRovoAppThreadBrowserSessionName(threadId))}-${Date.now()}.png`,
	)
}

function resolveScreenshotPath(screenshotResult, screenshotPath) {
	return getTrimmedStringOrNull(screenshotResult?.path) ?? screenshotPath
}

async function getRovoAppThreadBrowserWorkspaceScreenshot({
	threadId,
} = {}) {
	const resolvedThreadId = requireNonEmptyString(
		threadId,
		"A non-empty threadId is required.",
	)

	return enqueueThreadOperation(resolvedThreadId, async () => {
		await fs.mkdir(SCREENSHOT_OUTPUT_DIR, { recursive: true })
		const screenshotPath = buildThreadBrowserScreenshotPath(resolvedThreadId)
		const screenshotResult = await runAgentBrowserJson(resolvedThreadId, [
			"screenshot",
			screenshotPath,
		])
		const resolvedPath = resolveScreenshotPath(screenshotResult, screenshotPath)
		const buffer = await fs.readFile(resolvedPath)
		const state = await readThreadBrowserState(resolvedThreadId)
		return {
			buffer,
			contentType: "image/png",
			state,
			workspaceId: state.workspaceId,
		}
	})
}

function buildThreadBrowserCloseResult(threadId, closed) {
	return {
		closed,
		threadId,
		workspaceId: getRovoAppThreadBrowserWorkspaceId(threadId),
	}
}

async function deleteRovoAppThreadBrowserWorkspace(threadId) {
	const resolvedThreadId = requireNonEmptyString(
		threadId,
		"A non-empty threadId is required.",
	)

	return enqueueThreadOperation(resolvedThreadId, async () => {
		knownThreadSessions.delete(resolvedThreadId)
		try {
			await runAgentBrowserJson(resolvedThreadId, ["close"])
			return buildThreadBrowserCloseResult(resolvedThreadId, true)
		} catch {
			return buildThreadBrowserCloseResult(resolvedThreadId, false)
		}
	})
}

module.exports = {
	deleteRovoAppThreadBrowserWorkspace,
	ensureRovoAppThreadBrowserWorkspace,
	getRovoAppThreadBrowserSessionName,
	getRovoAppThreadBrowserStreamConfig,
	getRovoAppThreadBrowserWorkspace,
	getRovoAppThreadBrowserWorkspaceId,
	getRovoAppThreadBrowserWorkspaceScreenshot,
	getRovoAppThreadBrowserWorkspaceSnapshot,
	buildWorkspaceActionCommandArgs,
	performRovoAppThreadBrowserWorkspaceAction,
	urlsLooselyMatch,
}
