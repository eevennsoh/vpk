"use strict";

const express = require("express");
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const {
	createRequireLocalDevRequest,
	passThrough,
} = require("../middleware/local-only");

const DEFAULT_REPO_ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_VPK_HTML_ROOT = path.resolve(__dirname, "..", "..", ".agents", "skills", "vpk-html");
const DEFAULT_NOTES_PATH = path.join(DEFAULT_REPO_ROOT, "output", "vpk-html", "notes.json");
const MAX_TOKEN_OVERRIDES = 500;
const MAX_TOKEN_VALUE_CHARS = 200;
const MAX_NOTES_BYTES = 32 * 1024;
const TOKEN_NAME_PATTERN = /^--[a-z0-9-]+$/i;
const FORBIDDEN_TOKEN_VALUE_PATTERN = /[{}<>;]/u;
const CATALOG_ROOT_FILES = new Set([
	"CHEATSHEET.md",
	"README.md",
	"SKILL.md",
	"index.html",
]);

function getWildcardRouteValue(value) {
	if (Array.isArray(value)) {
		return value.join("/");
	}

	return typeof value === "string" && value.length > 0 ? value : null;
}

function resolveVpkHtmlFilePath(assetPath, {
	pathModule = path,
	rootDir = DEFAULT_VPK_HTML_ROOT,
} = {}) {
	const normalizedAssetPath = assetPath && assetPath !== "/" ? assetPath : "index.html";
	if (normalizedAssetPath.includes("\0") || normalizedAssetPath.includes("\\")) {
		return null;
	}

	const resolvedRoot = pathModule.resolve(rootDir);
	const resolvedPath = pathModule.resolve(resolvedRoot, normalizedAssetPath);
	const rootPrefix = `${resolvedRoot}${pathModule.sep}`;

	if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(rootPrefix)) {
		return null;
	}

	const relativePath = pathModule.relative(resolvedRoot, resolvedPath);
	const normalizedRelativePath = relativePath.split(pathModule.sep).join("/");
	if (!isAllowedVpkHtmlAssetPath(normalizedRelativePath)) {
		return null;
	}

	return resolvedPath;
}

const CATALOG_MEDIA_EXTENSIONS = new Set([".mp4", ".webm", ".mov"]);
const SELECTOR_ASSET_EXTENSIONS = new Set([".css", ".js"]);

function isProduction(env) {
	return env.NODE_ENV === "production";
}

function isAllowedVpkHtmlAssetPath(relativePath) {
	if (CATALOG_ROOT_FILES.has(relativePath)) {
		return true;
	}

	if (relativePath.startsWith("assets/selector/")) {
		const selectorFileName = relativePath.slice("assets/selector/".length);
		if (!selectorFileName || selectorFileName.includes("/")) {
			return false;
		}

		const extension = path.extname(selectorFileName).toLowerCase();
		return SELECTOR_ASSET_EXTENSIONS.has(extension);
	}

	if (!relativePath.startsWith("assets/demos/")) {
		return false;
	}

	if (relativePath.endsWith(".html")) {
		return true;
	}

	const extension = path.extname(relativePath).toLowerCase();
	return CATALOG_MEDIA_EXTENSIONS.has(extension);
}

// Dev-only, read-only artifact pages for the review loop (ws1 §4.14): `local/<rel>` serves
// repo-relative .html files under artifacts/vpk-html/** or output/vpk-html*/** only. No dot or
// underscore segments (so no traversal and no _src/ sources), and the realpath must stay under
// the matched root (no symlink escape). A missing file resolves so the caller can return 404.
const LOCAL_PAGE_PREFIX = "local/";
const LOCAL_ARTIFACT_PATTERN = /^(artifacts\/vpk-html|output\/vpk-html[a-z0-9-]*)\/(?:[A-Za-z0-9][A-Za-z0-9._-]*\/)*[A-Za-z0-9][A-Za-z0-9._-]*\.html$/u;

function isLocalPagePath(pagePath) {
	return typeof pagePath === "string" && pagePath.startsWith(LOCAL_PAGE_PREFIX);
}

function resolveLocalArtifactFilePath(localPath, {
	fsModule = fs,
	pathModule = path,
	repoRoot = DEFAULT_REPO_ROOT,
} = {}) {
	if (typeof localPath !== "string" || localPath.includes("\0") || localPath.includes("\\")) {
		return null;
	}
	const match = LOCAL_ARTIFACT_PATTERN.exec(localPath);
	if (!match) {
		return null;
	}

	const resolvedRepoRoot = pathModule.resolve(repoRoot);
	const filePath = pathModule.resolve(resolvedRepoRoot, localPath);
	const rootPath = pathModule.resolve(resolvedRepoRoot, match[1]);
	if (!filePath.startsWith(`${rootPath}${pathModule.sep}`)) {
		return null;
	}

	let realRoot;
	let realFile;
	try {
		realRoot = fsModule.realpathSync(rootPath);
	} catch {
		return filePath;
	}
	try {
		realFile = fsModule.realpathSync(filePath);
	} catch {
		return filePath;
	}
	return realFile.startsWith(`${realRoot}${pathModule.sep}`) ? filePath : null;
}

function getVpkHtmlPageReference(assetPath, {
	allowLocal = false,
	fsModule = fs,
	pathModule = path,
	repoRoot = DEFAULT_REPO_ROOT,
	rootDir = DEFAULT_VPK_HTML_ROOT,
} = {}) {
	if (isLocalPagePath(assetPath)) {
		if (!allowLocal) {
			return null;
		}
		const localPath = assetPath.slice(LOCAL_PAGE_PREFIX.length);
		const localFile = resolveLocalArtifactFilePath(localPath, { fsModule, pathModule, repoRoot });
		return localFile ? { filePath: localFile, pagePath: `${LOCAL_PAGE_PREFIX}${localPath}` } : null;
	}

	const filePath = resolveVpkHtmlFilePath(assetPath, { pathModule, rootDir });
	if (!filePath) {
		return null;
	}

	return {
		filePath,
		pagePath: pathModule.relative(pathModule.resolve(rootDir), filePath).split(pathModule.sep).join("/"),
	};
}

function isPlainObject(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateTokenPayload(body) {
	const tokens = body && isPlainObject(body.tokens) ? body.tokens : null;
	if (!tokens) {
		return { error: "tokens must be an object with 1 to 500 entries" };
	}

	const entries = Object.entries(tokens);
	if (entries.length < 1 || entries.length > MAX_TOKEN_OVERRIDES) {
		return { error: "tokens must be an object with 1 to 500 entries" };
	}

	for (const [name, value] of entries) {
		if (!TOKEN_NAME_PATTERN.test(name)) {
			return { error: `Invalid token name: ${name}` };
		}
		if (
			typeof value !== "string" ||
			value.length > MAX_TOKEN_VALUE_CHARS ||
			FORBIDDEN_TOKEN_VALUE_PATTERN.test(value)
		) {
			return { error: `Invalid token value for ${name}` };
		}
	}

	return { tokens: entries };
}

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function applyTokenOverridesToHtml(html, tokenEntries) {
	let changed = false;
	const nextHtml = html.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/giu, (match, openTag, styleBody, closeTag) => {
		// Rewrite only inside base `:root { ... }` blocks. Scoped theme
		// overrides (e.g. `[data-theme="dark"] { --focal: ... }`) keep their
		// own values — flattening them breaks dark mode across artifacts.
		const nextStyleBody = styleBody.replace(/(^|[\s}])(:root\s*\{)([^{}]*)(\})/gu, (_block, lead, blockOpen, blockBody, blockClose) => {
			let nextBlockBody = blockBody;
			for (const [tokenName, tokenValue] of tokenEntries) {
				const tokenPattern = new RegExp(
					`(^|[\\s{;])(${escapeRegExp(tokenName)}\\s*:\\s*)([^;{}<>]*)(;)`,
					"gimu",
				);
				nextBlockBody = nextBlockBody.replace(tokenPattern, (_declaration, prefix, declarationStart, oldValue, suffix) => {
					if (oldValue === tokenValue) {
						return `${prefix}${declarationStart}${oldValue}${suffix}`;
					}

					changed = true;
					return `${prefix}${declarationStart}${tokenValue}${suffix}`;
				});
			}

			return `${lead}${blockOpen}${nextBlockBody}${blockClose}`;
		});

		return `${openTag}${nextStyleBody}${closeTag}`;
	});

	return { changed, html: nextHtml };
}

function collectTokenTargetFiles({
	fsModule,
	pathModule,
	rootDir,
}) {
	const files = [];
	const indexPath = pathModule.join(rootDir, "index.html");
	if (fsModule.existsSync(indexPath)) {
		files.push(indexPath);
	}

	const demosDir = pathModule.join(rootDir, "assets", "demos");
	if (!fsModule.existsSync(demosDir)) {
		return files;
	}

	for (const dirent of fsModule.readdirSync(demosDir, { withFileTypes: true })) {
		if (dirent.isFile() && dirent.name.endsWith(".html")) {
			files.push(pathModule.join(demosDir, dirent.name));
		}
	}

	return files;
}

function applyTokenOverrides({
	fsModule,
	pathModule,
	rootDir,
	tokenEntries,
}) {
	let updatedFiles = 0;
	for (const filePath of collectTokenTargetFiles({ fsModule, pathModule, rootDir })) {
		const html = fsModule.readFileSync(filePath, "utf8");
		const result = applyTokenOverridesToHtml(html, tokenEntries);
		if (result.changed && result.html !== html) {
			fsModule.writeFileSync(filePath, result.html, "utf8");
			updatedFiles += 1;
		}
	}

	return updatedFiles;
}

function readNotesStore(fsModule, notesPath) {
	try {
		const parsed = JSON.parse(fsModule.readFileSync(notesPath, "utf8"));
		return isPlainObject(parsed) ? parsed : {};
	} catch (error) {
		if (error && error.code === "ENOENT") {
			return {};
		}
		throw error;
	}
}

function writeNotesStore(fsModule, pathModule, notesPath, store) {
	fsModule.mkdirSync(pathModule.dirname(notesPath), { recursive: true });
	fsModule.writeFileSync(notesPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function statFile(fsModule, filePath) {
	try {
		const stats = fsModule.statSync(filePath);
		return stats.isFile();
	} catch {
		return false;
	}
}

function execFileAsync(execFileImpl, file, args) {
	return new Promise((resolve, reject) => {
		execFileImpl(file, args, (error, stdout = "", stderr = "") => {
			if (error) {
				reject({ error, stderr: String(stderr || ""), stdout: String(stdout || "") });
				return;
			}

			resolve({ stdout: String(stdout || ""), stderr: String(stderr || "") });
		});
	});
}

function parseGistUrl(stdout) {
	return stdout.match(/https?:\/\/\S+/u)?.[0] ?? null;
}

function createVpkHtmlRouter({
	env = process.env,
	execFileImpl = execFile,
	fsModule = fs,
	notesPath = DEFAULT_NOTES_PATH,
	pathModule = path,
	repoRoot = DEFAULT_REPO_ROOT,
	requireRuntimeAdmin = passThrough,
	rootDir = DEFAULT_VPK_HTML_ROOT,
} = {}) {
	const router = express.Router();
	const requireLocalDevRequest = createRequireLocalDevRequest({ env });

	function sendVpkHtmlAsset(req, res) {
		const assetPath = getWildcardRouteValue(req.params.assetPath) ?? "index.html";
		const isLocal = isLocalPagePath(assetPath);
		if (isLocal && isProduction(env)) {
			return res.status(404).json({ error: "Not available" });
		}
		const filePath = isLocal
			? resolveLocalArtifactFilePath(assetPath.slice(LOCAL_PAGE_PREFIX.length), { fsModule, pathModule, repoRoot })
			: resolveVpkHtmlFilePath(assetPath, { pathModule, rootDir });

		if (!filePath) {
			return res.status(400).json({ error: "Invalid vpk-html asset path" });
		}
		if (isLocal) {
			res.set("Cache-Control", "no-store");
			res.set("X-Content-Type-Options", "nosniff");
		}

		return fsModule.stat(filePath, (statError, stats) => {
			if (statError || !stats.isFile()) {
				return res.status(404).json({ error: "vpk-html asset not found" });
			}

			return res.sendFile(filePath, { dotfiles: "allow" }, (sendError) => {
				if (!sendError || res.headersSent) {
					return;
				}

				return res.status(500).json({
					error: "Failed to serve vpk-html asset",
					details: sendError instanceof Error ? sendError.message : String(sendError),
				});
			});
		});
	}

	function resolvePageRequest(req, res) {
		const page = typeof req.query.page === "string" ? req.query.page : "";
		const reference = getVpkHtmlPageReference(page, { allowLocal: true, fsModule, pathModule, repoRoot, rootDir });
		if (!reference) {
			res.status(400).json({ error: "Invalid vpk-html asset path" });
			return null;
		}
		if (!statFile(fsModule, reference.filePath)) {
			res.status(404).json({ error: "vpk-html asset not found" });
			return null;
		}
		return reference;
	}

	router.post("/apply-tokens", requireLocalDevRequest, requireRuntimeAdmin, (req, res) => {
		const validation = validateTokenPayload(req.body);
		if (validation.error) {
			return res.status(400).json({ error: validation.error });
		}

		try {
			const updatedFiles = applyTokenOverrides({
				fsModule,
				pathModule,
				rootDir,
				tokenEntries: validation.tokens,
			});
			return res.json({ ok: true, updatedFiles });
		} catch (error) {
			return res.status(500).json({
				error: error instanceof Error ? error.message : String(error),
			});
		}
	});

	router.get("/notes", (req, res) => {
		if (isProduction(env)) {
			return res.status(404).json({ error: "Not available" });
		}

		const reference = resolvePageRequest(req, res);
		if (!reference) {
			return undefined;
		}

		try {
			const store = readNotesStore(fsModule, notesPath);
			const notes = typeof store[reference.pagePath] === "string" ? store[reference.pagePath] : "";
			return res.json({ notes });
		} catch (error) {
			return res.status(500).json({
				error: error instanceof Error ? error.message : String(error),
			});
		}
	});

	router.put("/notes", requireLocalDevRequest, requireRuntimeAdmin, (req, res) => {
		const reference = resolvePageRequest(req, res);
		if (!reference) {
			return undefined;
		}

		const notes = req.body && typeof req.body.notes === "string" ? req.body.notes : null;
		if (notes === null || Buffer.byteLength(notes, "utf8") > MAX_NOTES_BYTES) {
			return res.status(400).json({ error: "notes must be a string up to 32KB" });
		}

		try {
			const store = readNotesStore(fsModule, notesPath);
			store[reference.pagePath] = notes;
			writeNotesStore(fsModule, pathModule, notesPath, store);
			return res.json({ ok: true });
		} catch (error) {
			return res.status(500).json({
				error: error instanceof Error ? error.message : String(error),
			});
		}
	});

	router.post("/publish-gist", requireLocalDevRequest, requireRuntimeAdmin, async (req, res) => {
		const page = req.body && typeof req.body.page === "string" ? req.body.page : "";
		const reference = getVpkHtmlPageReference(page, { allowLocal: false, fsModule, pathModule, repoRoot, rootDir });
		if (!reference) {
			return res.status(400).json({ error: isLocalPagePath(page) ? "Publish local artifacts with build.mjs --publish (it runs the preflight scan)" : "Invalid vpk-html asset path" });
		}
		if (!statFile(fsModule, reference.filePath)) {
			return res.status(404).json({ error: "vpk-html asset not found" });
		}

		try {
			const { stdout } = await execFileAsync(execFileImpl, "gh", [
				"gist",
				"create",
				reference.filePath,
				"--desc",
				`vpk-html: ${reference.pagePath}`,
			]);
			const url = parseGistUrl(stdout);
			if (!url) {
				return res.status(500).json({ error: "Failed to parse gist URL" });
			}
			return res.json({ ok: true, url });
		} catch (failure) {
			const stderr = failure && typeof failure.stderr === "string" ? failure.stderr.trim() : "";
			const error = failure && failure.error instanceof Error ? failure.error.message : String(failure);
			return res.status(500).json({ error: stderr || error });
		}
	});

	router.get("/", sendVpkHtmlAsset);
	router.get("/*assetPath", sendVpkHtmlAsset);

	return router;
}

function registerVpkHtmlRoutes(app, dependencies = {}) {
	app.use("/api/vpk-html", createVpkHtmlRouter(dependencies));
}

module.exports = {
	applyTokenOverridesToHtml,
	createVpkHtmlRouter,
	getWildcardRouteValue,
	getVpkHtmlPageReference,
	isAllowedVpkHtmlAssetPath,
	isLocalPagePath,
	registerVpkHtmlRoutes,
	resolveLocalArtifactFilePath,
	resolveVpkHtmlFilePath,
	validateTokenPayload,
};
