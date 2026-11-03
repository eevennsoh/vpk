"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFile } = require("node:child_process");

const SELECTED_VAULT_ENV_KEY = "PERSONAL_GRAPH_SELECTED_VAULT";
const CONFIG_PATH_ENV_KEY = "PERSONAL_GRAPH_VAULT_CONFIG_PATH";
const LOCAL_CONFIG_PATH = path.join(__dirname, "..", "..", ".tmp", "personal-graph", "vault.json");
const RAW_SOURCE_EXTENSIONS = new Set([".html", ".htm", ".md", ".markdown", ".txt"]);

let appendLogQueue = Promise.resolve();

function getNonEmptyString(value) {
	if (typeof value !== "string") {
		return null;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function createVaultNotFoundError(reason, cause) {
	const error = new Error(reason);
	error.code = "VAULT_NOT_FOUND";
	if (cause) {
		error.cause = cause;
	}
	return error;
}

function getConfigPath(configPath) {
	return path.resolve(
		getNonEmptyString(configPath)
			?? getNonEmptyString(process.env[CONFIG_PATH_ENV_KEY])
			?? LOCAL_CONFIG_PATH,
	);
}

function readLocalVaultConfig(configPath) {
	const resolvedConfigPath = getConfigPath(configPath);
	let rawConfig;
	try {
		rawConfig = fs.readFileSync(resolvedConfigPath, "utf8");
	} catch (error) {
		if (error?.code === "ENOENT") {
			return null;
		}
		throw error;
	}

	try {
		const parsed = JSON.parse(rawConfig);
		return getNonEmptyString(parsed?.vaultRoot);
	} catch (error) {
		const configError = new Error(`Personal Graph vault config is not valid JSON: ${resolvedConfigPath}`);
		configError.code = "VAULT_CONFIG_INVALID";
		configError.cause = error;
		throw configError;
	}
}

function getConfiguredVault(configPath) {
	const selectedRoot = getNonEmptyString(process.env[SELECTED_VAULT_ENV_KEY]);
	if (selectedRoot) {
		return { configuredRoot: selectedRoot, source: "folder-picker" };
	}

	const localRoot = readLocalVaultConfig(configPath);
	if (localRoot) {
		return { configuredRoot: localRoot, source: "folder-picker" };
	}

	return { configuredRoot: null, source: null };
}

function inspectVaultRoot(configuredRoot, source) {
	if (!configuredRoot) {
		return {
			message: "Select a folder to get started.",
			rawDirectoryExists: false,
			root: null,
			source: null,
			status: "unconfigured",
			wikiDirectoryExists: false,
		};
	}

	const vaultRoot = path.resolve(configuredRoot);
	let stats;
	try {
		stats = fs.statSync(vaultRoot);
	} catch {
		return {
			message: `Vault path does not exist: ${vaultRoot}`,
			rawDirectoryExists: false,
			root: vaultRoot,
			source,
			status: "missing",
			wikiDirectoryExists: false,
		};
	}

	if (!stats.isDirectory()) {
		return {
			message: `Vault path is not a directory: ${vaultRoot}`,
			rawDirectoryExists: false,
			root: vaultRoot,
			source,
			status: "invalid",
			wikiDirectoryExists: false,
		};
	}

	return {
		message: "Personal Graph vault is ready.",
		rawDirectoryExists: fs.existsSync(path.join(vaultRoot, "raw")),
		root: vaultRoot,
		source,
		status: "ready",
		wikiDirectoryExists: fs.existsSync(path.join(vaultRoot, "wiki")),
	};
}

function getVaultSettings(options = {}) {
	const { configuredRoot, source } = getConfiguredVault(options.configPath);
	return inspectVaultRoot(configuredRoot, source);
}

function getVaultRoot() {
	const settings = getVaultSettings();
	if (settings.status !== "ready" || !settings.root) {
		throw createVaultNotFoundError(settings.message);
	}

	return settings.root;
}

function toPosixPath(value) {
	return value.split(path.sep).join("/");
}

function isPathInside(rootPath, candidatePath) {
	const relativePath = path.relative(rootPath, candidatePath);
	return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function resolveInside(rootPath, ...segments) {
	const candidatePath = path.resolve(rootPath, ...segments);
	if (!isPathInside(rootPath, candidatePath)) {
		const error = new Error(`Path escapes vault root: ${segments.join("/")}`);
		error.code = "VAULT_PATH_OUTSIDE_ROOT";
		throw error;
	}
	return candidatePath;
}

function listFiles(rootPath, relativeDir, shouldInclude, shouldDescend = () => true) {
	const basePath = resolveInside(rootPath, relativeDir);
	let entries;
	try {
		entries = fs.readdirSync(basePath, { withFileTypes: true });
	} catch (error) {
		if (error?.code === "ENOENT") {
			return [];
		}
		throw error;
	}

	const files = [];
	for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
		if (entry.name.startsWith(".")) {
			continue;
		}

		const fullPath = path.join(basePath, entry.name);
		const relativePath = toPosixPath(path.relative(rootPath, fullPath));
		if (entry.isDirectory()) {
			if (shouldDescend(fullPath, relativePath)) {
				files.push(...listFiles(rootPath, relativePath, shouldInclude, shouldDescend));
			}
			continue;
		}

		if (entry.isFile() && shouldInclude(fullPath, relativePath)) {
			files.push(fullPath);
		}
	}

	return files;
}

function removeContentExtension(value) {
	return value.replace(/\.(?:html?|m(?:arkdown|d)|txt)$/iu, "");
}

function ensureMarkdownFrontmatter(content) {
	if (typeof content !== "string" || !content.match(/^---\n[\s\S]*?\n---\n?/u)) {
		const error = new Error("Markdown content must start with YAML frontmatter.");
		error.code = "INVALID_FRONTMATTER";
		throw error;
	}
}

function buildFileEntry(filePath, vaultRoot, baseDir) {
	const basePath = resolveInside(vaultRoot, baseDir);
	const stats = fs.statSync(filePath);
	const slug = removeContentExtension(toPosixPath(path.relative(basePath, filePath)));

	return {
		name: path.basename(filePath),
		path: filePath,
		relativePath: toPosixPath(path.relative(vaultRoot, filePath)),
		size: stats.size,
		slug,
		updatedAt: stats.mtime.toISOString(),
	};
}

function listRaw() {
	const vaultRoot = getVaultRoot();
	return listFiles(
		vaultRoot,
		"raw",
		(filePath) => RAW_SOURCE_EXTENSIONS.has(path.extname(filePath).toLowerCase()),
		(_dirPath, relativePath) => relativePath !== "raw/assets" && !relativePath.startsWith("raw/assets/"),
	).map((filePath) => buildFileEntry(filePath, vaultRoot, "raw"));
}

function listWiki() {
	const vaultRoot = getVaultRoot();
	return listFiles(vaultRoot, "wiki", (filePath) => {
		const extension = path.extname(filePath).toLowerCase();
		return extension === ".md" || extension === ".markdown";
	}).map((filePath) => buildFileEntry(filePath, vaultRoot, "wiki"));
}

function parseQuotedValue(value) {
	const trimmed = value.trim();
	if (
		(trimmed.startsWith("\"") && trimmed.endsWith("\""))
		|| (trimmed.startsWith("'") && trimmed.endsWith("'"))
	) {
		return trimmed.slice(1, -1);
	}

	return trimmed;
}

function parseInlineList(value) {
	const inner = value.slice(1, -1).trim();
	if (!inner) {
		return [];
	}

	return inner
		.split(",")
		.map((item) => parseQuotedValue(item))
		.filter(Boolean);
}

function parseFrontmatter(text) {
	if (typeof text !== "string") {
		return { body: "", frontmatter: {} };
	}

	const normalizedText = text.replace(/\r\n?/gu, "\n");
	const match = normalizedText.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/u);
	if (!match) {
		return { body: normalizedText, frontmatter: {} };
	}

	const frontmatter = {};
	let listKey = null;
	for (const line of match[1].split("\n")) {
		const trimmedLine = line.trim();
		if (!trimmedLine || trimmedLine.startsWith("#")) {
			continue;
		}

		const listItemMatch = trimmedLine.match(/^-\s+(.+)$/u);
		if (listItemMatch && listKey) {
			frontmatter[listKey].push(parseQuotedValue(listItemMatch[1]));
			continue;
		}

		listKey = null;
		const colonIndex = line.indexOf(":");
		if (colonIndex < 0) {
			continue;
		}

		const key = line.slice(0, colonIndex).trim();
		const rawValue = line.slice(colonIndex + 1).trim();
		if (!key) {
			continue;
		}

		if (!rawValue) {
			frontmatter[key] = [];
			listKey = key;
			continue;
		}

		if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
			frontmatter[key] = parseInlineList(rawValue);
			continue;
		}

		frontmatter[key] = parseQuotedValue(rawValue);
	}

	return {
		body: match[2],
		frontmatter,
	};
}

function normalizeWikiSlug(slug) {
	const rawSlug = getNonEmptyString(slug);
	if (!rawSlug) {
		const error = new Error("A wiki page slug is required");
		error.code = "INVALID_PAGE_SLUG";
		throw error;
	}

	let normalizedSlug;
	try {
		normalizedSlug = decodeURIComponent(rawSlug);
	} catch {
		normalizedSlug = rawSlug;
	}

	normalizedSlug = normalizedSlug
		.replace(/\\/gu, "/")
		.replace(/^\/+/u, "")
		.replace(/^wiki\//u, "");

	if (!/\.m(?:arkdown|d)$/iu.test(normalizedSlug)) {
		normalizedSlug = `${normalizedSlug}.md`;
	}

	return normalizedSlug;
}

function normalizeRawSlug(slug) {
	const rawSlug = getNonEmptyString(slug);
	if (!rawSlug) {
		const error = new Error("A raw source slug is required");
		error.code = "INVALID_RAW_SLUG";
		throw error;
	}

	let normalizedSlug;
	try {
		normalizedSlug = decodeURIComponent(rawSlug);
	} catch {
		normalizedSlug = rawSlug;
	}

	normalizedSlug = normalizedSlug
		.replace(/\\/gu, "/")
		.replace(/^\/+/u, "")
		.replace(/^raw\//u, "");

	if (!RAW_SOURCE_EXTENSIONS.has(path.extname(normalizedSlug).toLowerCase())) {
		normalizedSlug = `${normalizedSlug}.md`;
	}

	return normalizedSlug;
}

function atomicWriteFileSync(filePath, content) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
	fs.writeFileSync(tempPath, content, "utf8");
	fs.renameSync(tempPath, filePath);
}

function writeVaultConfig(vaultRoot, options = {}) {
	const settings = inspectVaultRoot(vaultRoot, "folder-picker");
	if (settings.status !== "ready" || !settings.root) {
		throw createVaultNotFoundError(settings.message);
	}

	const configPath = getConfigPath(options.configPath);
	atomicWriteFileSync(
		configPath,
		`${JSON.stringify({
			updatedAt: new Date().toISOString(),
			vaultRoot: settings.root,
		}, null, "\t")}\n`,
	);
	process.env[SELECTED_VAULT_ENV_KEY] = settings.root;
	return settings;
}

function clearVaultConfig(options = {}) {
	const configPath = getConfigPath(options.configPath);
	fs.rmSync(configPath, { force: true });
	delete process.env[SELECTED_VAULT_ENV_KEY];
	return getVaultSettings(options);
}

function runExecFile(execFileImpl, command, args, options) {
	return new Promise((resolve, reject) => {
		execFileImpl(command, args, options, (error, stdout, stderr) => {
			if (error) {
				error.stderr = stderr;
				reject(error);
				return;
			}

			resolve({ stdout, stderr });
		});
	});
}

async function selectLocalFolder(options = {}) {
	const platform = options.platform ?? process.platform;
	if (platform !== "darwin") {
		const error = new Error("Folder selection is only available in the local macOS app runtime.");
		error.code = "VAULT_SELECTOR_UNAVAILABLE";
		throw error;
	}

	const prompt = options.prompt ?? "Choose the Personal Graph vault folder";
	let result;
	try {
		result = await runExecFile(
			options.execFileImpl ?? execFile,
			"osascript",
			["-e", `POSIX path of (choose folder with prompt "${prompt.replace(/"/gu, "\\\"")}")`],
			{ timeout: 120000 },
		);
	} catch (error) {
		const stderr = typeof error?.stderr === "string" ? error.stderr : "";
		if (/user canceled|cancelled|canceled/iu.test(`${error?.message ?? ""}\n${stderr}`)) {
			const cancelError = new Error("Folder selection was cancelled.");
			cancelError.code = "VAULT_SELECTION_CANCELLED";
			throw cancelError;
		}
		throw error;
	}

	const selectedRoot = getNonEmptyString(result.stdout);
	if (!selectedRoot) {
		const error = new Error("Folder selection did not return a path.");
		error.code = "VAULT_SELECTION_CANCELLED";
		throw error;
	}

	return selectedRoot;
}

async function selectVaultRoot(options = {}) {
	return writeVaultConfig(await selectLocalFolder(options), options);
}

function readPage(slug) {
	const vaultRoot = getVaultRoot();
	const wikiRoot = resolveInside(vaultRoot, "wiki");
	const normalizedSlug = normalizeWikiSlug(slug);
	const pagePath = resolveInside(wikiRoot, normalizedSlug);

	let content;
	try {
		content = fs.readFileSync(pagePath, "utf8");
	} catch (error) {
		if (error?.code === "ENOENT") {
			const pageError = new Error(`Wiki page not found: ${normalizedSlug}`);
			pageError.code = "PAGE_NOT_FOUND";
			pageError.cause = error;
			throw pageError;
		}
		throw error;
	}

	const stats = fs.statSync(pagePath);
	const parsed = parseFrontmatter(content);
	return {
		body: parsed.body,
		content,
		frontmatter: parsed.frontmatter,
		path: pagePath,
		relativePath: toPosixPath(path.relative(vaultRoot, pagePath)),
		slug: removeContentExtension(toPosixPath(path.relative(wikiRoot, pagePath))),
		updatedAt: stats.mtime.toISOString(),
	};
}

function writePage(slug, content) {
	ensureMarkdownFrontmatter(content);
	const vaultRoot = getVaultRoot();
	const wikiRoot = resolveInside(vaultRoot, "wiki");
	const normalizedSlug = normalizeWikiSlug(slug);
	const pagePath = resolveInside(wikiRoot, normalizedSlug);
	atomicWriteFileSync(pagePath, content.replace(/\r\n?/gu, "\n"));
	return readPage(normalizedSlug);
}

function readRaw(relativePath) {
	const vaultRoot = getVaultRoot();
	const rawRoot = resolveInside(vaultRoot, "raw");
	const normalizedSlug = normalizeRawSlug(relativePath);
	const rawPath = resolveInside(rawRoot, normalizedSlug);
	const content = fs.readFileSync(rawPath, "utf8");
	const stats = fs.statSync(rawPath);
	return {
		content,
		path: rawPath,
		relativePath: toPosixPath(path.relative(vaultRoot, rawPath)),
		slug: removeContentExtension(toPosixPath(path.relative(rawRoot, rawPath))),
		updatedAt: stats.mtime.toISOString(),
	};
}

function writeRaw(slug, body) {
	const vaultRoot = getVaultRoot();
	const rawRoot = resolveInside(vaultRoot, "raw");
	const normalizedSlug = normalizeRawSlug(slug);
	const rawPath = resolveInside(rawRoot, normalizedSlug);
	if (toPosixPath(path.relative(vaultRoot, rawPath)).startsWith("raw/assets/")) {
		const error = new Error("Raw source writes cannot target raw/assets.");
		error.code = "INVALID_RAW_SLUG";
		throw error;
	}
	atomicWriteFileSync(rawPath, String(body ?? "").replace(/\r\n?/gu, "\n"));
	return buildFileEntry(rawPath, vaultRoot, "raw");
}

function readLogText() {
	const vaultRoot = getVaultRoot();
	const logPath = resolveInside(vaultRoot, "wiki", "log.md");
	try {
		return fs.readFileSync(logPath, "utf8");
	} catch (error) {
		if (error?.code === "ENOENT") {
			return "";
		}
		throw error;
	}
}

function appendLog(entry) {
	const run = async () => {
		const vaultRoot = getVaultRoot();
		const logPath = resolveInside(vaultRoot, "wiki", "log.md");
		fs.mkdirSync(path.dirname(logPath), { recursive: true });
		const line = typeof entry === "string" ? entry.trimEnd() : JSON.stringify(entry);
		fs.appendFileSync(logPath, `${line}\n`, "utf8");
		return { relativePath: "wiki/log.md" };
	};
	appendLogQueue = appendLogQueue.then(run, run);
	return appendLogQueue;
}

function parseLogEntries() {
	return readLogText()
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => {
			try {
				const parsed = JSON.parse(line);
				return typeof parsed === "object" && parsed ? parsed : { raw: line };
			} catch {
				const source = line.match(/source:\s*([^,\s]+)/u)?.[1] ?? null;
				return { raw: line, source };
			}
		});
}

function unprocessedRawSources() {
	const processedSources = new Set();
	for (const entry of parseLogEntries()) {
		for (const value of [entry.source, ...(Array.isArray(entry.sources) ? entry.sources : [])]) {
			if (typeof value === "string" && value.trim()) {
				processedSources.add(value.replace(/^raw\//u, ""));
				processedSources.add(`raw/${value.replace(/^raw\//u, "")}`);
			}
		}
	}

	const paths = listRaw()
		.filter((entry) => !processedSources.has(entry.relativePath) && !processedSources.has(entry.slug) && !processedSources.has(`${entry.slug}.md`))
		.map((entry) => entry.relativePath);

	return { count: paths.length, paths };
}

module.exports = {
	appendLog,
	clearVaultConfig,
	getVaultSettings,
	getVaultRoot,
	listRaw,
	listWiki,
	parseFrontmatter,
	parseLogEntries,
	readLogText,
	readPage,
	readRaw,
	selectVaultRoot,
	selectLocalFolder,
	unprocessedRawSources,
	writeVaultConfig,
	writePage,
	writeRaw,
};
