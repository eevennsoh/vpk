const {
	ensureRovoAppThreadBrowserWorkspace,
	getRovoAppThreadBrowserWorkspace,
	getRovoAppThreadBrowserWorkspaceScreenshot,
} = require("./rovo-app-browser-workspace")

const SCREENSHOT_TOOL_NAMES = new Set([
	"browser_take_screenshot",
])

function getTrimmedString(value) {
	if (typeof value !== "string") {
		return null
	}

	const trimmedValue = value.trim()
	return trimmedValue || null
}

function getBaseBrowserToolName(toolName) {
	if (typeof toolName !== "string") {
		return null
	}

	if (toolName.startsWith("mcp__")) {
		return toolName.replace(/^mcp__.*?__/u, "")
	}

	return toolName
}

function isBrowserToolCall(toolName) {
	const baseName = getBaseBrowserToolName(toolName)
	if (!baseName) {
		return false
	}

	return baseName.startsWith("browser_")
}

function isScreenshotToolCall(toolName) {
	const baseName = getBaseBrowserToolName(toolName)
	return SCREENSHOT_TOOL_NAMES.has(baseName)
}

function toWorkspaceResult(result) {
	if (!result) {
		return null
	}

	return {
		state: result.state,
		streamConfig: result.streamConfig,
		workspaceId: result.workspaceId,
	}
}

function buildEnsureWorkspaceInput(threadId, defaultUrl) {
	const normalizedDefaultUrl = getTrimmedString(defaultUrl)
	if (!normalizedDefaultUrl) {
		return { threadId }
	}

	return {
		threadId,
		defaultUrl: normalizedDefaultUrl,
	}
}

function createDefaultWorkspaceBindings({
	ensureThreadSessionWorkspaceImpl = ensureRovoAppThreadBrowserWorkspace,
	getThreadSessionWorkspaceImpl = getRovoAppThreadBrowserWorkspace,
	getThreadSessionWorkspaceScreenshotImpl = getRovoAppThreadBrowserWorkspaceScreenshot,
} = {}) {
	return {
		async ensureThreadWorkspace(threadId, defaultUrl) {
			const result = await ensureThreadSessionWorkspaceImpl(
				buildEnsureWorkspaceInput(threadId, defaultUrl),
			)
			return toWorkspaceResult(result)
		},
		async getThreadWorkspace(threadId) {
			const result = await getThreadSessionWorkspaceImpl({ threadId })
			return toWorkspaceResult(result)
		},
		async getThreadWorkspaceScreenshot(threadId) {
			return getThreadSessionWorkspaceScreenshotImpl({ threadId })
		},
	}
}

// A browser tool call acts on the request's own thread. Its `thread_id` input comes from
// the model and is never trusted to name another thread's workspace; without a request
// thread the call is not mirrored.
function resolveToolThreadId(toolInput, requestThreadId) {
	const threadId = getTrimmedString(requestThreadId)
	const requested = getTrimmedString(toolInput?.thread_id)
	if (threadId && requested && requested !== threadId) {
		console.warn("[BROWSER-BRIDGE] Ignoring a browser tool thread_id that is not the request's thread.")
	}
	return threadId ?? null
}

function resolveRequestedUrl(baseName, toolInput) {
	const canUseToolUrl =
		baseName === "browser_navigate" ||
		baseName === "browser_tab_new"
	if (canUseToolUrl) {
		return getTrimmedString(toolInput?.url) ?? undefined
	}

	return undefined
}

function resolvePendingWorkspaceStatus() {
	return "navigating"
}

function buildBrowserStateData({
	state,
	status,
	streamConfig,
	workspaceId,
	url,
	title,
}) {
	const data = {
		status,
		streamConfig,
		title: title ?? state?.title ?? "",
		url: url ?? state?.url ?? "",
		workspaceId,
	}
	const provider = getTrimmedString(state?.provider)
	if (!provider) {
		return data
	}

	return {
		...data,
		provider,
	}
}

async function persistWorkspaceScreenshot({
	resolvedThreadId,
	screenshot,
	screenshotStore,
}) {
	if (
		typeof screenshotStore?.persistScreenshot !== "function" ||
		!Buffer.isBuffer(screenshot?.buffer)
	) {
		return null
	}

	return screenshotStore.persistScreenshot({
		buffer: screenshot.buffer,
		contentType: screenshot.contentType,
		state: screenshot.state,
		threadId: resolvedThreadId,
		workspaceId: screenshot.workspaceId,
	})
}

function buildScreenshotImageData(screenshot, persistedScreenshot) {
	if (persistedScreenshot?.imageUrl) {
		return {
			imageUrl: persistedScreenshot.imageUrl,
		}
	}

	if (persistedScreenshot?.imageData) {
		return {
			imageData: persistedScreenshot.imageData,
		}
	}

	if (Buffer.isBuffer(screenshot?.buffer)) {
		return {
			imageData: screenshot.buffer.toString("base64"),
		}
	}

	return {}
}

function buildWorkspaceScreenshotData(screenshot, persistedScreenshot) {
	const data = {
		contentType:
			persistedScreenshot?.contentType ?? screenshot.contentType ?? "image/png",
		height: persistedScreenshot?.height,
		timestamp: persistedScreenshot?.timestamp ?? new Date().toISOString(),
		url: screenshot.state?.url ?? "",
		width: persistedScreenshot?.width,
		workspaceId: screenshot.workspaceId,
		...buildScreenshotImageData(screenshot, persistedScreenshot),
	}
	if (!persistedScreenshot?.thumbnailUrl) {
		return data
	}

	return {
		...data,
		thumbnailUrl: persistedScreenshot.thumbnailUrl,
	}
}

function createThreadBrowserBridge({
	screenshotStore = null,
	threadId,
	writer,
	workspaceBindings = createDefaultWorkspaceBindings(),
}) {
	const toolCallContexts = new Map()
	let hasEmittedBrowserScreenshot = false
	let hasEmittedBrowserState = false

	function emitBrowserState({
		state,
		status,
		streamConfig,
		workspaceId,
		url,
		title,
	}) {
		hasEmittedBrowserState = true
		writer.write({
			type: "data-browser-state",
			data: buildBrowserStateData({
				state,
				status,
				streamConfig,
				workspaceId,
				url,
				title,
			}),
		})
	}

	async function emitWorkspaceScreenshot(resolvedThreadId) {
		try {
			const screenshot =
				await workspaceBindings.getThreadWorkspaceScreenshot(resolvedThreadId)
			const persistedScreenshot = await persistWorkspaceScreenshot({
				resolvedThreadId,
				screenshot,
				screenshotStore,
			})
			hasEmittedBrowserScreenshot = true
			writer.write({
				type: "data-browser-screenshot",
				data: buildWorkspaceScreenshotData(screenshot, persistedScreenshot),
			})
		} catch (error) {
			console.warn(
				"[BROWSER-BRIDGE] Screenshot fetch error:",
				error?.message || error,
			)
		}
	}

	async function handleToolCallStart(toolCall) {
		if (!isBrowserToolCall(toolCall?.toolName)) {
			return false
		}

		const baseName = getBaseBrowserToolName(toolCall.toolName)
		const resolvedThreadId = resolveToolThreadId(toolCall.toolInput, threadId)
		if (!resolvedThreadId) {
			return false
		}

		try {
			const requestedUrl = resolveRequestedUrl(baseName, toolCall.toolInput)
			const workspace = await workspaceBindings.ensureThreadWorkspace(
				resolvedThreadId,
				requestedUrl,
			)
			if (toolCall.toolCallId) {
				toolCallContexts.set(toolCall.toolCallId, {
					toolName: baseName,
					threadId: resolvedThreadId,
					workspaceId: workspace.workspaceId,
				})
			}

			emitBrowserState({
				state: workspace.state,
				status: resolvePendingWorkspaceStatus(requestedUrl, workspace.state),
				streamConfig: workspace.streamConfig,
				title: workspace.state?.title ?? "",
				url: requestedUrl ?? workspace.state?.url ?? "",
				workspaceId: workspace.workspaceId,
			})
		} catch (error) {
			console.warn(
				"[BROWSER-BRIDGE] Workspace start error:",
				error?.message || error,
			)
		}

		return true
	}

	async function handleToolCallResult(toolCallResult) {
		if (!isBrowserToolCall(toolCallResult?.toolName)) {
			return false
		}

		const baseName = getBaseBrowserToolName(toolCallResult.toolName)
		const context = toolCallResult.toolCallId
			? toolCallContexts.get(toolCallResult.toolCallId) ?? null
			: null
		if (toolCallResult.toolCallId) {
			toolCallContexts.delete(toolCallResult.toolCallId)
		}

		const resolvedThreadId = context?.threadId ?? threadId
		if (!resolvedThreadId) {
			return false
		}

		try {
			const workspace = await workspaceBindings.getThreadWorkspace(
				resolvedThreadId,
			)
			if (workspace) {
				emitBrowserState({
					state: workspace.state,
					status: "ready",
					streamConfig: workspace.streamConfig,
					workspaceId: workspace.workspaceId,
				})
			}

			if (
				!toolCallResult?.errorText &&
				isScreenshotToolCall(baseName)
			) {
				await emitWorkspaceScreenshot(resolvedThreadId)
			}
		} catch (error) {
			console.warn(
				"[BROWSER-BRIDGE] Workspace result error:",
				error?.message || error,
			)
		}

		return true
	}

	async function cleanup() {
		toolCallContexts.clear()
	}

	return {
		cleanup,
		handleToolCallResult,
		handleToolCallStart,
		hasAuthoritativeOutput() {
			return hasEmittedBrowserState || hasEmittedBrowserScreenshot
		},
		hasScreenshotOutput() {
			return hasEmittedBrowserScreenshot
		},
	}
}

module.exports = {
	createDefaultWorkspaceBindings,
	createThreadBrowserBridge,
	getBaseBrowserToolName,
	isBrowserToolCall,
	isScreenshotToolCall,
}
