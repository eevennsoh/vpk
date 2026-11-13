const test = require("node:test")
const assert = require("node:assert/strict")

const {
	AgentBrowserRuntime,
	buildAgentBrowserEnv,
	DEFAULT_AGENT_BROWSER_EXECUTABLE_CANDIDATE_PATHS,
	DEFAULT_SCREENCAST_MAX_HEIGHT,
	DEFAULT_SCREENCAST_MAX_WIDTH,
	ensureAgentBrowserInstalled,
	resolveAgentBrowserExecutablePath,
} = require("./browser-workspace-runtime")

class TestAgentBrowserRuntime extends AgentBrowserRuntime {
	constructor(options = {}) {
		super({
			sessionId: "test-workspace",
			...options,
		})
		this.commands = []
		this.jsonCommands = []
		this.jsonResults = new Map()
		this.commandFailures = new Map()
		this.screencastBuffers = []
		this.streamEnableResult = null
		this.streamStatusResult = null
		this.nativeStreamFrames = []
	}

	async _ensureInstalled() {}

	async _runCommand(args) {
		const normalizedArgs = args.map((value) => String(value))
		const key = normalizedArgs.join(" ")
		this.commands.push(normalizedArgs)
		if (this.commandFailures.has(key)) {
			throw this.commandFailures.get(key)
		}
		return ""
	}

	async _runJsonCommand(args) {
		const normalizedArgs = args.map((value) => String(value))
		const key = normalizedArgs.join(" ")
		this.jsonCommands.push(normalizedArgs)
		if (!this.jsonResults.has(key)) {
			throw new Error(`Unexpected JSON command: ${key}`)
		}

		return this.jsonResults.get(key)
	}

	async _captureScreencastFrameBuffer() {
		const nextBuffer =
			this.screencastBuffers.shift() || Buffer.from("not-a-jpeg")
		this.commands.push(["capture-screencast-frame"])
		return nextBuffer
	}

	async _getNativeStreamStatus() {
		this.commands.push(["stream", "status"])
		return this.streamStatusResult
	}

	async _enableNativeStream() {
		this.commands.push(["stream", "enable"])
		return this.streamEnableResult
	}

	async _disableNativeStream() {
		this.commands.push(["stream", "disable"])
	}

	async _connectNativeStream(port, callback) {
		this.commands.push(["connect-native-stream", String(port)])
		for (const frame of this.nativeStreamFrames) {
			callback(frame)
		}

		return {
			close() {
				return undefined
			},
		}
	}
}

test("browser workspace runtime reads tab state through agent-browser JSON commands", async () => {
	const runtime = new TestAgentBrowserRuntime()
	runtime.jsonResults.set("tab", {
		tabs: [
			{
				active: false,
				index: 0,
				title: "One",
				type: "page",
				url: "https://example.com/one",
			},
			{
				active: true,
				index: 1,
				title: "Two",
				type: "page",
				url: "https://example.com/two",
			},
		],
	})

	const state = await runtime.getState()

	assert.deepEqual(runtime.commands, [["open", "about:blank"]])
	assert.deepEqual(runtime.jsonCommands, [["tab"]])
	assert.equal(state.activeTabIndex, 1)
	assert.equal(state.title, "Two")
	assert.equal(state.url, "https://example.com/two")
	assert.equal(state.tabs.length, 2)
})

test("browser workspace runtime snapshot normalizes ref keys for interactive mode", async () => {
	const runtime = new TestAgentBrowserRuntime()
	runtime.jsonResults.set("snapshot -i", {
		snapshot:
			'- button "Sign in" [ref=e1]\n- link "More info" [ref=e2]',
		refs: {
			e1: {
				role: "button",
				name: "Sign in",
				unused: true,
			},
			e2: {
				role: "link",
				name: "More info",
			},
		},
	})

	const snapshot = await runtime.snapshot({ interactive: true })

	assert.deepEqual(runtime.commands, [["open", "about:blank"]])
	assert.deepEqual(runtime.jsonCommands, [["snapshot", "-i"]])
	assert.equal(snapshot.snapshot.includes("[ref=@e1]"), true)
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

test("browser workspace runtime initializes directly on the target URL and recovers timed-out initial opens", async () => {
	const runtime = new TestAgentBrowserRuntime()
	runtime.commandFailures.set(
		"open https://theverge.com",
		new Error("✗ Operation timed out. The page may still be loading or the element may not exist."),
	)
	runtime.jsonResults.set("tab", {
		tabs: [
			{
				active: true,
				index: 0,
				title: "The Verge",
				type: "page",
				url: "https://www.theverge.com/",
			},
		],
	})

	await runtime.initialize("https://theverge.com")

	assert.deepEqual(runtime.commands, [["open", "https://theverge.com"]])
	assert.deepEqual(runtime.jsonCommands, [["tab"]])
})

test("browser workspace runtime prefers the native agent-browser stream when available", async () => {
	const capturedFrames = []
	const runtime = new TestAgentBrowserRuntime()
	runtime.streamStatusResult = {
		enabled: true,
		port: 59029,
	}
	runtime.nativeStreamFrames = [
		{
			buffer: Buffer.from("native-frame"),
			metadata: {
				deviceWidth: 1200,
				deviceHeight: 769,
				pageScaleFactor: 1,
			},
		},
	]

	await runtime.startScreencast((frame) => {
		capturedFrames.push(frame)
	})
	await runtime.stopScreencast()

	assert.deepEqual(runtime.commands, [
		["open", "about:blank"],
		["stream", "status"],
		["connect-native-stream", "59029"],
		["stream", "disable"],
	])
	assert.equal(capturedFrames.length, 1)
	assert.equal(Buffer.isBuffer(capturedFrames[0]?.buffer), true)
	assert.deepEqual(capturedFrames[0]?.metadata, {
		deviceWidth: 1200,
		deviceHeight: 769,
		pageScaleFactor: 1,
	})
})

test("browser workspace runtime screencast falls back to screenshots with capped metadata", async () => {
	let capturedFrame = null
	const runtime = new TestAgentBrowserRuntime({
		viewport: {
			width: 1400,
			height: 1000,
		},
		deviceScaleFactor: 2,
	})
	runtime.streamEnableResult = {
		enabled: false,
		port: null,
	}

	await runtime.startScreencast((frame) => {
		capturedFrame = frame
	})
	await runtime.stopScreencast()

	assert.deepEqual(runtime.commands, [
		["open", "about:blank"],
		["stream", "status"],
		["stream", "enable"],
		["capture-screencast-frame"],
		["stream", "disable"],
	])
	assert.equal(Buffer.isBuffer(capturedFrame?.buffer), true)
	assert.deepEqual(capturedFrame?.metadata, {
		deviceWidth: DEFAULT_SCREENCAST_MAX_WIDTH,
		deviceHeight: DEFAULT_SCREENCAST_MAX_HEIGHT,
		pageScaleFactor: 2,
	})
})

test("browser workspace runtime only changes viewport when explicitly requested", async () => {
	const runtime = new TestAgentBrowserRuntime()

	await runtime.setViewport(1440, 960, 2)

	assert.deepEqual(runtime.commands, [
		["open", "about:blank"],
		["set", "viewport", "1440", "960", "2"],
	])
})

test("resolveAgentBrowserExecutablePath prefers an explicit executable path", () => {
	const executablePath = resolveAgentBrowserExecutablePath({
		env: {
			AGENT_BROWSER_EXECUTABLE_PATH: "/custom/chrome",
		},
		fsImpl: {
			existsSync() {
				throw new Error("existsSync should not be consulted for an explicit executable path")
			},
		},
	})

	assert.equal(executablePath, "/custom/chrome")
})

test("resolveAgentBrowserExecutablePath auto-detects the local stable Chrome executable", () => {
	const executablePath = resolveAgentBrowserExecutablePath({
		env: {},
		fsImpl: {
			existsSync(candidatePath) {
				return candidatePath === DEFAULT_AGENT_BROWSER_EXECUTABLE_CANDIDATE_PATHS[0]
			},
		},
	})

	assert.equal(
		executablePath,
		DEFAULT_AGENT_BROWSER_EXECUTABLE_CANDIDATE_PATHS[0],
	)
})

test("buildAgentBrowserEnv injects the detected executable path into agent-browser commands", () => {
	const env = buildAgentBrowserEnv({
		env: {
			EXISTING_VAR: "value",
		},
		agentBrowserExecutablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
	})

	assert.deepEqual(env, {
		EXISTING_VAR: "value",
		AGENT_BROWSER_HOME: env.AGENT_BROWSER_HOME,
		HOME: env.HOME,
		USERPROFILE: env.USERPROFILE,
		AGENT_BROWSER_EXECUTABLE_PATH: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
	})
	assert.match(env.AGENT_BROWSER_HOME, /vpk-agent-browser/)
	assert.match(env.HOME, /vpk-agent-browser-home/)
})

test("ensureAgentBrowserInstalled skips the install command when a system browser executable is available", async () => {
	let installWasCalled = false

	await ensureAgentBrowserInstalled({
		env: {
			AGENT_BROWSER_EXECUTABLE_PATH: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
		},
		fsImpl: {
			existsSync(candidatePath) {
				return candidatePath === "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
			},
		},
		execFileImpl: async () => {
			installWasCalled = true
			return {
				stdout: "",
			}
		},
	})

	assert.equal(installWasCalled, false)
})

test("browser workspace runtime never passes a request value that reads as an option", async () => {
	const runtime = new TestAgentBrowserRuntime()
	runtime._isBrowserReady = true
	const isInvalidInput = (error) => error?.status === 400 && error?.code === "INVALID_INPUT"
	await assert.rejects(runtime.clickRef("--help"), isInvalidInput)
	await assert.rejects(runtime.fillRef("@e1", "--executable-path=/bin/sh"), isInvalidInput)
	await assert.rejects(runtime.typeRef("@e1", "-V"), isInvalidInput)
	await assert.rejects(runtime.selectRef("@e1", ["--x"]), isInvalidInput)
	await assert.rejects(runtime.press("--version"), isInvalidInput)
	await assert.rejects(runtime.keyEvent("keyDown", "--headed"), isInvalidInput)
	await assert.rejects(runtime.insertText("--session=other"), isInvalidInput)
	assert.deepEqual(runtime.commands, [])

	// Only a whole number may follow a leading "-": "-5 items" reads like a short option.
	await assert.rejects(runtime.insertText("-5 items"), isInvalidInput)
	await assert.rejects(runtime.insertText("  --session=other"), isInvalidInput)
	await runtime.keyEvent("keyDown", "-")
	await runtime.insertText("-5")
	await runtime.insertText("- 5 items")
	assert.deepEqual(runtime.commands, [["keydown", "-"], ["keyboard", "inserttext", "-5"], ["keyboard", "inserttext", "- 5 items"]])
})
