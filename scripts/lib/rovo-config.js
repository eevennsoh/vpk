const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
	getBrowserWorkspaceAllowedRovoMcpServerSignature,
	getBrowserWorkspaceRovoMcpServerConfig,
} = require("../../backend/lib/browser-workspace-mcp");

const resolveRovoConfigPath = () => {
	const ymlPath = path.join(os.homedir(), ".rovo", "config.yml");
	if (fs.existsSync(ymlPath)) {
		return ymlPath;
	}

	const yamlPath = path.join(os.homedir(), ".rovo", "config.yaml");
	if (fs.existsSync(yamlPath)) {
		return yamlPath;
	}

	return ymlPath;
};

const resolveWorkspaceRovoDir = (cwd = process.cwd()) =>
	path.join(cwd, ".rovo");

const resolveWorkspaceRovoGeneratedConfigPath = (cwd = process.cwd()) =>
	path.join(resolveWorkspaceRovoDir(cwd), "config.generated.yml");

const resolveWorkspaceRovoGeneratedMcpPath = (cwd = process.cwd()) =>
	path.join(resolveWorkspaceRovoDir(cwd), "mcp.generated.json");

function normalizeYaml(text) {
	return typeof text === "string"
		? text.replace(/\r\n?/gu, "\n")
		: "";
}

function extractYamlListEntries(text, key) {
	const lines = normalizeYaml(text).split("\n");
	const entries = [];
	let inList = false;
	let listIndent = 0;

	for (const line of lines) {
		if (!inList) {
			const startMatch = line.match(new RegExp(`^(\\s*)${key}:\\s*$`, "u"));
			if (startMatch) {
				inList = true;
				listIndent = startMatch[1].length;
			}
			continue;
		}

		const indent = (line.match(/^\s*/u) || [""])[0].length;
		const trimmed = line.trim();
		const listMatch = trimmed.match(/^-\s+(.+)$/u);
		const isContinuationLine = indent > listIndent;
		const isAlignedListItem = indent >= listIndent && listMatch;

		if (isContinuationLine || isAlignedListItem) {
			if (listMatch) {
				entries.push(listMatch[1].trim());
			}
			continue;
		}

		break;
	}

	return entries;
}

function replaceYamlListEntries(text, key, entries) {
	const lines = normalizeYaml(text).split("\n");
	const output = [];
	let replaced = false;
	let inList = false;
	let listIndent = 0;
	let itemIndent = 0;

	for (const line of lines) {
		if (!inList) {
			const startMatch = line.match(new RegExp(`^(\\s*)${key}:\\s*$`, "u"));
			if (startMatch) {
				replaced = true;
				inList = true;
				listIndent = startMatch[1].length;
				output.push(line);
				continue;
			}

			output.push(line);
			continue;
		}

		const indent = (line.match(/^\s*/u) || [""])[0].length;
		const trimmed = line.trim();
		const listMatch = trimmed.match(/^-\s+(.+)$/u);
		const isContinuationLine = indent > listIndent;
		const isAlignedListItem = indent >= listIndent && listMatch;

		if (isContinuationLine || isAlignedListItem) {
			if (listMatch && itemIndent === 0) {
				itemIndent = indent;
			}
			continue;
		}

		const resolvedItemIndent = itemIndent || listIndent;
		for (const entry of entries) {
			output.push(`${" ".repeat(resolvedItemIndent)}- ${entry}`);
		}
		inList = false;
		output.push(line);
	}

	if (inList) {
		const resolvedItemIndent = itemIndent || listIndent;
		for (const entry of entries) {
			output.push(`${" ".repeat(resolvedItemIndent)}- ${entry}`);
		}
	}

	if (replaced) {
		return output.join("\n");
	}

	const nextOutput = [...output];
	if (nextOutput.length > 0 && nextOutput[nextOutput.length - 1] !== "") {
		nextOutput.push("");
	}
	nextOutput.push(`${key}:`);
	for (const entry of entries) {
		nextOutput.push(`- ${entry}`);
	}
	return nextOutput.join("\n");
}

function replaceYamlScalar(text, key, value) {
	const pattern = new RegExp(`^(\\s*${key}:\\s*).*$`, "mu");
	if (pattern.test(text)) {
		return text.replace(pattern, `$1${value}`);
	}

	return text;
}

function mergeUniqueStrings(...lists) {
	return Array.from(
		new Set(
			lists
				.flat()
				.filter((entry) => typeof entry === "string" && entry.trim())
				.map((entry) => entry.trim()),
		),
	);
}

function isRepoLocalBrowserAutomationSignature(entry) {
	if (typeof entry !== "string") {
		return false;
	}

	return /chrome-devtools-mcp|@playwright\/mcp|playwright-mcp/u.test(entry);
}

function isWorkspaceGeneratedMcpSignature(entry) {
	if (typeof entry !== "string") {
		return false;
	}

	return /browser-workspace-mcp\.js|wiki-capture-mcp\.js|stdio:pnpm:exec qmd mcp/u.test(entry);
}

function resolveRovoMcpConfigPath(configText) {
	const match = normalizeYaml(configText).match(/^\s*mcpConfigPath:\s*(.+)\s*$/mu);
	if (match?.[1]?.trim()) {
		return match[1].trim();
	}

	return path.join(os.homedir(), ".rovo", "mcp.json");
}

const dedupeAllowedMcpServersInConfig = (configPath = resolveRovoConfigPath()) => {
	if (!fs.existsSync(configPath)) {
		return { configPath, exists: false, changed: false, removed: 0 };
	}

	const original = fs.readFileSync(configPath, "utf8");
	const currentAllowedServers = extractYamlListEntries(original, "allowedMcpServers");
	const normalizedAllowedServers = mergeUniqueStrings(currentAllowedServers);
	const removed = Math.max(0, currentAllowedServers.length - normalizedAllowedServers.length);
	const normalized = replaceYamlListEntries(original, "allowedMcpServers", normalizedAllowedServers);
	const changed = removed > 0 && normalized !== original;

	if (changed) {
		fs.writeFileSync(configPath, normalized, "utf8");
	}

	return {
		configPath,
		exists: true,
		changed,
		removed,
	};
};

function syncWorkspaceRovoConfig({ cwd = process.cwd() } = {}) {
	const sourceConfigPath = resolveRovoConfigPath();
	const workspaceConfigPath = resolveWorkspaceRovoGeneratedConfigPath(cwd);
	const workspaceMcpConfigPath = resolveWorkspaceRovoGeneratedMcpPath(cwd);
	const workspaceDir = resolveWorkspaceRovoDir(cwd);

	fs.mkdirSync(workspaceDir, { recursive: true });

	const sourceConfigText = fs.existsSync(sourceConfigPath)
		? fs.readFileSync(sourceConfigPath, "utf8")
		: [
			"version: 1",
			"",
			"mcp:",
			`  mcpConfigPath: ${workspaceMcpConfigPath}`,
			"  allowedMcpServers: []",
			"  disabledMcpServers: []",
			"",
		].join("\n");
	const existingWorkspaceConfigText = fs.existsSync(workspaceConfigPath)
		? fs.readFileSync(workspaceConfigPath, "utf8")
		: "";

	const mergedAllowedServers = mergeUniqueStrings(
		extractYamlListEntries(sourceConfigText, "allowedMcpServers").filter(
			(entry) =>
				!isWorkspaceGeneratedMcpSignature(entry) &&
				!isRepoLocalBrowserAutomationSignature(entry),
		),
		extractYamlListEntries(existingWorkspaceConfigText, "allowedMcpServers").filter(
			(entry) =>
				!isWorkspaceGeneratedMcpSignature(entry) &&
				!isRepoLocalBrowserAutomationSignature(entry),
		),
		[getBrowserWorkspaceAllowedRovoMcpServerSignature({ repoRoot: cwd })],
	);
	const browserWorkspaceMcpServers = getBrowserWorkspaceRovoMcpServerConfig({
		repoRoot: cwd,
	});

	let nextWorkspaceConfigText = replaceYamlScalar(
		sourceConfigText,
		"mcpConfigPath",
		workspaceMcpConfigPath,
	);
	nextWorkspaceConfigText = replaceYamlListEntries(
		nextWorkspaceConfigText,
		"allowedMcpServers",
		mergedAllowedServers,
	);
	if (!nextWorkspaceConfigText.endsWith("\n")) {
		nextWorkspaceConfigText += "\n";
	}

	const sourceMcpConfigPath = resolveRovoMcpConfigPath(sourceConfigText);
	let sourceMcpConfig = {};
	if (fs.existsSync(sourceMcpConfigPath)) {
		try {
			sourceMcpConfig = JSON.parse(fs.readFileSync(sourceMcpConfigPath, "utf8"));
		} catch {
			sourceMcpConfig = {};
		}
	}

	let existingWorkspaceMcpConfig = {};
	if (fs.existsSync(workspaceMcpConfigPath)) {
		try {
			existingWorkspaceMcpConfig = JSON.parse(fs.readFileSync(workspaceMcpConfigPath, "utf8"));
		} catch {
			existingWorkspaceMcpConfig = {};
		}
	}

	const sourceMcpServers =
		sourceMcpConfig.mcpServers && typeof sourceMcpConfig.mcpServers === "object"
			? { ...sourceMcpConfig.mcpServers }
			: {};
	const existingWorkspaceMcpServers =
		existingWorkspaceMcpConfig.mcpServers &&
		typeof existingWorkspaceMcpConfig.mcpServers === "object"
			? { ...existingWorkspaceMcpConfig.mcpServers }
			: {};
	delete sourceMcpServers.playwright;
	delete existingWorkspaceMcpServers.playwright;
	delete sourceMcpServers.qmd;
	delete existingWorkspaceMcpServers.qmd;
	delete sourceMcpServers["wiki-capture"];
	delete existingWorkspaceMcpServers["wiki-capture"];
	delete sourceMcpServers["chrome-devtools"];
	delete existingWorkspaceMcpServers["chrome-devtools"];

	const nextWorkspaceMcpConfig = {
		...sourceMcpConfig,
		...existingWorkspaceMcpConfig,
		mcpServers: {
			...sourceMcpServers,
			...existingWorkspaceMcpServers,
			...browserWorkspaceMcpServers,
		},
		inputs: Array.isArray(existingWorkspaceMcpConfig.inputs)
			? existingWorkspaceMcpConfig.inputs
			: Array.isArray(sourceMcpConfig.inputs)
				? sourceMcpConfig.inputs
				: [],
	};
	const nextWorkspaceMcpText = `${JSON.stringify(nextWorkspaceMcpConfig, null, "\t")}\n`;

	const previousWorkspaceConfigText = fs.existsSync(workspaceConfigPath)
		? fs.readFileSync(workspaceConfigPath, "utf8")
		: null;
	const previousWorkspaceMcpText = fs.existsSync(workspaceMcpConfigPath)
		? fs.readFileSync(workspaceMcpConfigPath, "utf8")
		: null;

	if (previousWorkspaceConfigText !== nextWorkspaceConfigText) {
		fs.writeFileSync(workspaceConfigPath, nextWorkspaceConfigText, "utf8");
	}
	if (previousWorkspaceMcpText !== nextWorkspaceMcpText) {
		fs.writeFileSync(workspaceMcpConfigPath, nextWorkspaceMcpText, "utf8");
	}

	return {
		changed:
			previousWorkspaceConfigText !== nextWorkspaceConfigText ||
			previousWorkspaceMcpText !== nextWorkspaceMcpText,
		configPath: workspaceConfigPath,
		exists: true,
		mcpConfigPath: workspaceMcpConfigPath,
		removed: Math.max(0, mergedAllowedServers.length - new Set(mergedAllowedServers).size),
		sourceConfigPath,
	};
}

module.exports = {
	resolveRovoConfigPath,
	resolveWorkspaceRovoDir,
	resolveWorkspaceRovoGeneratedConfigPath,
	resolveWorkspaceRovoGeneratedMcpPath,
	dedupeAllowedMcpServersInConfig,
	extractYamlListEntries,
	syncWorkspaceRovoConfig,
};
