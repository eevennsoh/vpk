const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const osModule = require("node:os");
const {
	extractYamlListEntries,
	syncWorkspaceRovoConfig,
} = require("./rovo-config");

test("extractYamlListEntries reads allowed MCP server signatures", () => {
	const configText = [
		"mcp:",
		"  allowedMcpServers:",
		"  - url:https://example.com/one",
		"  - stdio:npx:custom-mcp",
		"  disabledMcpServers: []",
	].join("\n");

	assert.deepEqual(extractYamlListEntries(configText, "allowedMcpServers"), [
		"url:https://example.com/one",
		"stdio:npx:custom-mcp",
	]);
});

test("syncWorkspaceRovoConfig creates a workspace-scoped config and MCP file", () => {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rovo-config-test-"));
	const homeDir = path.join(tmpDir, "home");
	const workspaceDir = path.join(tmpDir, "workspace");
	const globalRovoDir = path.join(homeDir, ".rovo");
	const workspaceRovoDir = path.join(workspaceDir, ".rovo");
	const originalHomeDir = osModule.homedir;

	fs.mkdirSync(globalRovoDir, { recursive: true });
	fs.mkdirSync(workspaceRovoDir, { recursive: true });

	const globalConfigPath = path.join(globalRovoDir, "config.yml");
	const globalMcpPath = path.join(globalRovoDir, "mcp.json");
	const workspaceConfigPath = path.join(workspaceRovoDir, "config.generated.yml");
	const workspaceMcpPath = path.join(workspaceRovoDir, "mcp.generated.json");

	fs.writeFileSync(globalConfigPath, [
		"version: 1",
		"mcp:",
		`  mcpConfigPath: ${globalMcpPath}`,
		"  allowedMcpServers:",
		"  - url:https://example.com/one",
		"  - stdio:npx:base-mcp",
		"  disabledMcpServers: []",
		"",
	].join("\n"));
	fs.writeFileSync(globalMcpPath, JSON.stringify({
		inputs: [],
		mcpServers: {
			"base-server": {
				command: "npx",
				args: ["base-mcp"],
				type: "stdio",
			},
			playwright: {
				command: "npx",
				args: ["playwright-mcp", "--headless"],
				type: "stdio",
			},
			"chrome-devtools": {
				command: "npx",
				args: ["-y", "chrome-devtools-mcp@latest", "--browser-url=http://127.0.0.1:9222"],
				type: "stdio",
			},
		},
	}, null, "\t"));

	fs.writeFileSync(workspaceConfigPath, [
		"version: 1",
		"mcp:",
		`  mcpConfigPath: ${workspaceMcpPath}`,
		"  allowedMcpServers:",
		"  - stdio:npx:base-mcp",
		"  - stdio:node:/tmp/old-workspace/scripts/browser-workspace-mcp.js",
		"  disabledMcpServers: []",
		"",
	].join("\n"));
	fs.writeFileSync(workspaceMcpPath, JSON.stringify({
		inputs: [],
		mcpServers: {
			"local-only": {
				command: "python3",
				args: ["local-only.py"],
				type: "stdio",
			},
		},
	}, null, "\t"));

	osModule.homedir = () => homeDir;

	try {
		const result = syncWorkspaceRovoConfig({
			cwd: workspaceDir,
		});

		assert.equal(result.exists, true);
		assert.equal(result.configPath, workspaceConfigPath);
		assert.equal(result.mcpConfigPath, workspaceMcpPath);

		const workspaceConfig = fs.readFileSync(workspaceConfigPath, "utf8");
		assert.match(
			workspaceConfig,
			new RegExp(`mcpConfigPath: ${workspaceMcpPath.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}`),
		);
		assert.deepEqual(extractYamlListEntries(workspaceConfig, "allowedMcpServers"), [
			"url:https://example.com/one",
			"stdio:npx:base-mcp",
			`stdio:node:${path.join(workspaceDir, "scripts", "browser-workspace-mcp.js")}`,
		]);

		const workspaceMcp = JSON.parse(fs.readFileSync(workspaceMcpPath, "utf8"));
		assert.ok(workspaceMcp.mcpServers["base-server"]);
		assert.ok(workspaceMcp.mcpServers["browser-workspace"]);
		assert.equal(workspaceMcp.mcpServers["wiki-capture"], undefined);
		assert.ok(workspaceMcp.mcpServers["local-only"]);
		assert.equal(workspaceMcp.mcpServers.playwright, undefined);
		assert.equal(workspaceMcp.mcpServers["chrome-devtools"], undefined);
		assert.equal(workspaceMcp.mcpServers.qmd, undefined);
		assert.deepEqual(workspaceMcp.mcpServers["browser-workspace"], {
			args: [path.join(workspaceDir, "scripts", "browser-workspace-mcp.js")],
			command: "node",
			env: {
				REPO_ROOT: workspaceDir,
			},
			type: "stdio",
		});

		assert.equal(Object.keys(workspaceMcp.mcpServers).length, 3);
	} finally {
		osModule.homedir = originalHomeDir;
	}
});

test("syncWorkspaceRovoConfig removes retired wiki MCP wiring from source and prior generated config", () => {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rovo-config-optional-mcp-test-"));
	const homeDir = path.join(tmpDir, "home");
	const workspaceDir = path.join(tmpDir, "workspace");
	const globalRovoDir = path.join(homeDir, ".rovo");
	const workspaceRovoDir = path.join(workspaceDir, ".rovo");
	const originalHomeDir = osModule.homedir;

	fs.mkdirSync(globalRovoDir, { recursive: true });
	fs.mkdirSync(workspaceRovoDir, { recursive: true });

	const globalConfigPath = path.join(globalRovoDir, "config.yml");
	const globalMcpPath = path.join(globalRovoDir, "mcp.json");
	const workspaceConfigPath = path.join(workspaceRovoDir, "config.generated.yml");
	const workspaceMcpPath = path.join(workspaceRovoDir, "mcp.generated.json");

	fs.writeFileSync(globalConfigPath, [
		"version: 1",
		"mcp:",
		`  mcpConfigPath: ${globalMcpPath}`,
		"  allowedMcpServers:",
		"  - stdio:npx:base-mcp",
		"  - stdio:pnpm:exec qmd mcp",
		"  - stdio:node:/old/scripts/wiki-capture-mcp.js",
		"  disabledMcpServers: []",
		"",
	].join("\n"));
	fs.writeFileSync(globalMcpPath, JSON.stringify({
		inputs: [],
		mcpServers: {
			"base-server": {
				command: "npx",
				args: ["base-mcp"],
				type: "stdio",
			},
			"wiki-capture": { command: "node", args: ["/old/scripts/wiki-capture-mcp.js"], type: "stdio" },
			qmd: {
				command: "pnpm",
				args: ["exec", "qmd", "mcp"],
				type: "stdio",
			},
		},
	}, null, "\t"));
	fs.writeFileSync(workspaceConfigPath, [
		"version: 1",
		"mcp:",
		`  mcpConfigPath: ${workspaceMcpPath}`,
		"  allowedMcpServers:",
		"  - stdio:pnpm:exec qmd mcp",
		"  - stdio:node:/old/scripts/wiki-capture-mcp.js",
		"  disabledMcpServers: []",
		"",
	].join("\n"));
	fs.writeFileSync(workspaceMcpPath, JSON.stringify({
		inputs: [],
		mcpServers: {
			"wiki-capture": { command: "node", args: ["/old/scripts/wiki-capture-mcp.js"], type: "stdio" },
			qmd: {
				command: "pnpm",
				args: ["exec", "qmd", "mcp"],
				type: "stdio",
			},
		},
	}, null, "\t"));

	osModule.homedir = () => homeDir;

	try {
		syncWorkspaceRovoConfig({
			cwd: workspaceDir,
		});

		const workspaceConfig = fs.readFileSync(workspaceConfigPath, "utf8");
		assert.deepEqual(extractYamlListEntries(workspaceConfig, "allowedMcpServers"), [
			"stdio:npx:base-mcp",
			`stdio:node:${path.join(workspaceDir, "scripts", "browser-workspace-mcp.js")}`,
		]);

		const workspaceMcp = JSON.parse(fs.readFileSync(workspaceMcpPath, "utf8"));
		assert.equal(workspaceMcp.mcpServers.qmd, undefined);
		assert.ok(workspaceMcp.mcpServers["browser-workspace"]);
		assert.equal(workspaceMcp.mcpServers["wiki-capture"], undefined);
	} finally {
		osModule.homedir = originalHomeDir;
	}
});
