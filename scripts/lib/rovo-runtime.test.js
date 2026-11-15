const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")

const osModule = require("node:os")
const {
	loadEnvLocal,
	prepareRovoRuntime,
	resolveRovoConfigState,
} = require("./rovo-runtime")

// The dev launchers rely on dotenv never replacing a variable that is already exported, so a
// shell or launcher value wins over .env.local. Guards that contract across dotenv majors.
test("loadEnvLocal fills unset variables from .env.local without overriding exported ones", (t) => {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rovo-runtime-env-"))
	const envLocalPath = path.join(tmpDir, ".env.local")
	const presetKey = "VPK_ROVO_RUNTIME_TEST_PRESET"
	const unsetKey = "VPK_ROVO_RUNTIME_TEST_UNSET"
	fs.writeFileSync(envLocalPath, `${presetKey}=from-file\n${unsetKey}=from-file\n`)
	process.env[presetKey] = "from-shell"
	delete process.env[unsetKey]
	t.after(() => {
		delete process.env[presetKey]
		delete process.env[unsetKey]
		fs.rmSync(tmpDir, { recursive: true, force: true })
	})

	loadEnvLocal({ envLocalPath })

	assert.equal(process.env[presetKey], "from-shell")
	assert.equal(process.env[unsetKey], "from-file")
})

test("resolveRovoConfigState writes and returns the workspace-scoped generated config for the current cwd", () => {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rovo-runtime-test-"))
	const homeDir = path.join(tmpDir, "home")
	const workspaceDir = path.join(tmpDir, "workspace")
	const globalRovoDir = path.join(homeDir, ".rovo")
	const workspaceRovoDir = path.join(workspaceDir, ".rovo")
	const originalHomeDir = osModule.homedir

	fs.mkdirSync(globalRovoDir, { recursive: true })
	fs.mkdirSync(workspaceRovoDir, { recursive: true })

	const globalConfigPath = path.join(globalRovoDir, "config.yml")
	const globalMcpPath = path.join(globalRovoDir, "mcp.json")
	const workspaceConfigPath = path.join(workspaceRovoDir, "config.generated.yml")
	const workspaceMcpPath = path.join(workspaceRovoDir, "mcp.generated.json")

	fs.writeFileSync(globalConfigPath, [
		"version: 1",
		"mcp:",
		`  mcpConfigPath: ${globalMcpPath}`,
		"  allowedMcpServers:",
		"  - stdio:npx:base-mcp",
		"  disabledMcpServers: []",
		"",
	].join("\n"))
	fs.writeFileSync(globalMcpPath, JSON.stringify({
		inputs: [],
		mcpServers: {
			"base-server": {
				command: "npx",
				args: ["base-mcp"],
				type: "stdio",
			},
		},
	}, null, "\t"))

	osModule.homedir = () => homeDir

	try {
		const configState = resolveRovoConfigState({
			cwd: workspaceDir,
			dedupeConfig: true,
		})

		assert.equal(configState.exists, true)
		assert.equal(configState.configPath, workspaceConfigPath)
		assert.equal(configState.mcpConfigPath, workspaceMcpPath)
	} finally {
		osModule.homedir = originalHomeDir
	}
})

test("prepareRovoRuntime keeps isolated mode and strips legacy browser automation wiring", () => {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rovo-runtime-browser-test-"))
	const homeDir = path.join(tmpDir, "home")
	const workspaceDir = path.join(tmpDir, "workspace")
	const globalRovoDir = path.join(homeDir, ".rovo")
	const workspaceRovoDir = path.join(workspaceDir, ".rovo")
	const originalHomeDir = osModule.homedir
	const originalBrowserMode = process.env.ROVO_BROWSER_MODE
	const originalBillingUrl = process.env.ROVO_BILLING_URL

	fs.mkdirSync(globalRovoDir, { recursive: true })
	fs.mkdirSync(workspaceRovoDir, { recursive: true })

	const globalConfigPath = path.join(globalRovoDir, "config.yml")
	const globalMcpPath = path.join(globalRovoDir, "mcp.json")
	const workspaceConfigPath = path.join(workspaceRovoDir, "config.generated.yml")
	const workspaceMcpPath = path.join(workspaceRovoDir, "mcp.generated.json")

	fs.writeFileSync(globalConfigPath, [
		"version: 1",
		"mcp:",
		`  mcpConfigPath: ${globalMcpPath}`,
		"  allowedMcpServers:",
		"  - stdio:npx:base-mcp",
		"  disabledMcpServers: []",
		"",
	].join("\n"))
	fs.writeFileSync(globalMcpPath, JSON.stringify({
		inputs: [],
		mcpServers: {
			"base-server": {
				command: "npx",
				args: ["base-mcp"],
				type: "stdio",
			},
		},
	}, null, "\t"))
	fs.writeFileSync(path.join(workspaceDir, ".env.local"), [
		"ROVO_BILLING_URL=https://example.invalid",
		"",
	].join("\n"))

	osModule.homedir = () => homeDir
	delete process.env.ROVO_BROWSER_MODE
	delete process.env.ROVO_BILLING_URL

	try {
		const result = prepareRovoRuntime({
			cwd: workspaceDir,
			logger: {
				log() {},
			},
			logBillingSite: false,
			logConfigState: false,
		})

		assert.equal(result.browserRuntimeDefaults.browserMode, "isolated")
		assert.equal(result.browserRuntimeDefaults.changed, false)
		assert.equal(process.env.ROVO_BROWSER_MODE, undefined)
		assert.equal(result.configState.configPath, workspaceConfigPath)
		assert.equal(result.configState.mcpConfigPath, workspaceMcpPath)

		const workspaceConfig = fs.readFileSync(workspaceConfigPath, "utf8")
		assert.doesNotMatch(
			workspaceConfig,
			/chrome-devtools-mcp@latest/
		)

		const workspaceMcp = JSON.parse(fs.readFileSync(workspaceMcpPath, "utf8"))
		assert.equal(workspaceMcp.mcpServers["chrome-devtools"], undefined)
	} finally {
		osModule.homedir = originalHomeDir
		if (originalBrowserMode === undefined) {
			delete process.env.ROVO_BROWSER_MODE
		} else {
			process.env.ROVO_BROWSER_MODE = originalBrowserMode
		}
		if (originalBillingUrl === undefined) {
			delete process.env.ROVO_BILLING_URL
		} else {
			process.env.ROVO_BILLING_URL = originalBillingUrl
		}
	}
})
