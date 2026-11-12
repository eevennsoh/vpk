"use strict";

const express = require("express");

const { captureUrl } = require("../lib/personal-graph-capture");
const { buildExplorer } = require("../lib/personal-graph-explorer");
const librarian = require("../lib/personal-graph-librarian");
const qmd = require("../lib/personal-graph-qmd");
const { getActiveSource, setActiveSource } = require("../lib/personal-graph-source-state");
const summaryContext = require("../lib/personal-graph-summary-context");
const { readCache, writeCache } = require("../lib/personal-graph-twg-cache");
const { handleTwgChat } = require("../lib/personal-graph-twg-chat");
const twgSource = require("../lib/personal-graph-twg-source");
const { getPositiveInteger } = require("../lib/shared-utils");
const {
	createRequireLocalDevRequest,
	passThrough,
} = require("../middleware/local-only");
const {
	clearVaultConfig,
	parseLogEntries,
	readPage,
	getVaultSettings,
	selectVaultRoot,
	unprocessedRawSources,
	writePage,
	writeRaw,
} = require("../lib/personal-graph-vault");

function getWildcardRouteValue(value) {
	if (Array.isArray(value)) {
		return value.join("/");
	}

	return typeof value === "string" ? value : "";
}

function getStatusForError(error) {
	if (error?.code === "TWG_AUTH_REQUIRED") {
		return 401;
	}
	if (error?.code === "TWG_NOT_FOUND") {
		return 503;
	}
	if (error?.code === "VAULT_NOT_FOUND") {
		return 503;
	}
	if (error?.code === "INVALID_PAGE_SLUG") {
		return 400;
	}
	if (error?.code === "PAGE_NOT_FOUND") {
		return 404;
	}
	if (error?.code === "VAULT_PATH_OUTSIDE_ROOT") {
		return 400;
	}
	if (error?.code === "INVALID_FRONTMATTER" || error?.code === "INVALID_RAW_SLUG" || error?.code === "INVALID_URL") {
		return 400;
	}
	if (error?.code === "CONFIRMATION_NOT_FOUND") {
		return 404;
	}
	if (error?.code === "NODE_SELECTION_REQUIRED" || error?.code === "NODE_NOT_FOUND" || error?.code === "INVALID_SUMMARY_LENGTH") {
		return 400;
	}
	if (error?.code === "TWG_CACHE_REQUIRED") {
		return 409;
	}
	if (error?.code === "VAULT_SELECTION_CANCELLED") {
		return 400;
	}
	if (error?.code === "VAULT_SELECTOR_UNAVAILABLE") {
		return 501;
	}
	return 500;
}

const router = express.Router();
const activeSummarizeRuns = new Map();
const summaryArticleCache = new Map();
let activeTwgCacheHydration = null;
const DEFAULT_CACHED_TWG_ARTIFACT_TITLE_HYDRATION_LIMIT = 32;
const CACHED_TWG_ARTIFACT_TITLE_HYDRATION_LIMIT_ENV_KEY = "PERSONAL_GRAPH_TWG_CACHED_ARTIFACT_HYDRATION_LIMIT";
const DEFAULT_SUMMARY_ARTICLE_CACHE_MAX_ENTRIES = 64;
const SUMMARY_ARTICLE_CACHE_MAX_ENTRIES_ENV_KEY = "PERSONAL_GRAPH_SUMMARY_ARTICLE_CACHE_MAX_ENTRIES";
const DEFAULT_TWG_SUMMARY_WORK_WINDOW = "7d";

function getCachedTwgArtifactTitleHydrationLimit() {
	return getPositiveInteger(
		process.env[CACHED_TWG_ARTIFACT_TITLE_HYDRATION_LIMIT_ENV_KEY],
		DEFAULT_CACHED_TWG_ARTIFACT_TITLE_HYDRATION_LIMIT,
	);
}

function getSummaryArticleCacheMaxEntries() {
	return getPositiveInteger(
		process.env[SUMMARY_ARTICLE_CACHE_MAX_ENTRIES_ENV_KEY],
		DEFAULT_SUMMARY_ARTICLE_CACHE_MAX_ENTRIES,
	);
}

function getSummaryArticleCacheEntry(cacheKey) {
	const cached = summaryArticleCache.get(cacheKey);
	if (!cached) return null;
	summaryArticleCache.delete(cacheKey);
	summaryArticleCache.set(cacheKey, cached);
	return cached;
}

function setSummaryArticleCacheEntry(cacheKey, article) {
	summaryArticleCache.set(cacheKey, article);
	const maxEntries = getSummaryArticleCacheMaxEntries();
	while (summaryArticleCache.size > maxEntries) {
		const oldestKey = summaryArticleCache.keys().next().value;
		if (oldestKey === undefined) break;
		summaryArticleCache.delete(oldestKey);
	}
}

function scheduleCachedTwgArtifactTitleHydration(cached) {
	if (activeTwgCacheHydration) {
		return;
	}

	activeTwgCacheHydration = (async () => {
		try {
			const hydrated = await twgSource.hydrateTwgArtifactTitles(cached, {
				limit: getCachedTwgArtifactTitleHydrationLimit(),
			});
			if (hydrated !== cached) {
				writeCache(hydrated);
			}
		} catch (error) {
			console.warn(
				"Failed to hydrate cached TWG artifact titles:",
				error instanceof Error ? error.message : String(error),
			);
		} finally {
			activeTwgCacheHydration = null;
		}
	})();
}

router.get("/vault", (_req, res) => {
	try {
		return res.json(getVaultSettings());
	} catch (error) {
		return res.status(getStatusForError(error)).json({
			error: "Failed to read Personal Graph vault settings",
			code: error?.code ?? "PERSONAL_GRAPH_VAULT_SETTINGS_FAILED",
			details: error instanceof Error ? error.message : String(error),
		});
	}
});

router.post("/vault/select", async (_req, res) => {
	try {
		return res.json(await selectVaultRoot());
	} catch (error) {
		return res.status(getStatusForError(error)).json({
			error: error?.code === "VAULT_SELECTION_CANCELLED"
				? "Folder selection was cancelled."
				: "Failed to select Personal Graph vault folder",
			code: error?.code ?? "PERSONAL_GRAPH_VAULT_SELECT_FAILED",
			details: error instanceof Error ? error.message : String(error),
		});
	}
});

router.post("/vault/reset", (_req, res) => {
	try {
		return res.json(clearVaultConfig());
	} catch (error) {
		return res.status(getStatusForError(error)).json({
			error: "Failed to reset Personal Graph vault selection",
			code: error?.code ?? "PERSONAL_GRAPH_VAULT_RESET_FAILED",
			details: error instanceof Error ? error.message : String(error),
		});
	}
});

function getFirstQueryValue(value) {
	return Array.isArray(value) ? value.find(Boolean) : value;
}

function parseMultipartFile(buffer, contentType) {
	const boundary = contentType?.match(/boundary=([^;]+)/iu)?.[1];
	if (!boundary) {
		return null;
	}
	const raw = buffer.toString("binary");
	const part = raw.split(`--${boundary}`).find((entry) => entry.includes("Content-Disposition"));
	if (!part) {
		return null;
	}
	const [, headerText, bodyText = ""] = part.match(/\r\n([\s\S]*?)\r\n\r\n([\s\S]*)\r\n$/u) ?? [];
	const filename = headerText?.match(/filename="([^"]+)"/iu)?.[1] ?? "dropped.md";
	return {
		content: Buffer.from(bodyText, "binary").toString("utf8"),
		filename,
	};
}

function sendSse(res, event) {
	res.write(`data: ${JSON.stringify(event)}\n\n`);
}

async function streamIterable(res, iterable) {
	res.writeHead(200, {
		"Cache-Control": "no-cache, no-transform",
		Connection: "keep-alive",
		"Content-Type": "text/event-stream",
	});
	try {
		for await (const event of iterable) {
			sendSse(res, event);
		}
	} catch (error) {
		sendSse(res, {
			code: error?.code ?? "PERSONAL_GRAPH_STREAM_FAILED",
			error: error instanceof Error ? error.message : String(error),
			stage: "error",
			type: "error",
		});
	} finally {
		res.end();
	}
}

function normalizeTwgWorkWindow(value) {
	if (typeof value !== "string") return DEFAULT_TWG_SUMMARY_WORK_WINDOW;
	const trimmed = value.trim().toLowerCase();
	return /^\d{1,3}[dwm]$/u.test(trimmed) ? trimmed : DEFAULT_TWG_SUMMARY_WORK_WINDOW;
}

function getSummaryCacheKey({ length, nodeId, source, sourceFingerprint }) {
	return [
		summaryContext.SUMMARY_RENDERER_VERSION,
		source,
		nodeId,
		length,
		sourceFingerprint,
	].join(":");
}

async function getActiveExplorerForSummary({ nodeId, signal, workWindow } = {}) {
	const source = getActiveSource();
	if (source === "twg") {
		const cached = readCache();
		if (!cached) {
			const error = new Error("Team Work Graph summary setup is required. Run `twg login`, refresh Team Work Graph, then retry.");
			error.code = "TWG_CACHE_REQUIRED";
			throw error;
		}
		try {
			const expanded = await twgSource.expandTwgExplorerNode({
				explorer: cached,
				nodeId,
				signal,
				since: workWindow,
			});
			if (expanded.explorer !== cached) {
				writeCache(expanded.explorer);
			}
			return { explorer: expanded.explorer, source, sourceNotice: null, workWindow };
		} catch (error) {
			if (error?.code === "NODE_NOT_FOUND" || error?.code === "NODE_SELECTION_REQUIRED") {
				throw error;
			}
			return {
				explorer: cached,
				source,
				sourceNotice: "Selected Team Work Graph expansion was unavailable, so this article uses the cached one-hop context.",
				workWindow,
			};
		}
	}
	return { explorer: buildExplorer(), source, sourceNotice: null, workWindow: null };
}

function normalizeSummaryRequestBody(body) {
	const action = body?.action === "deck" ? "deck" : body?.action === "summary" ? "summary" : null;
	if (!action) {
		const error = new Error("Personal Graph summarize action must be `summary` or `deck`.");
		error.code = "INVALID_SUMMARY_ACTION";
		throw error;
	}
	return {
		action,
		bypassCache: body?.bypassCache === true,
		clientId: typeof body?.clientId === "string" && body.clientId.trim()
			? body.clientId.trim().slice(0, 128)
			: "default",
		length: body?.length ?? "medium",
		nodeId: typeof body?.nodeId === "string" ? body.nodeId : "",
		summary: typeof body?.summary === "string" ? body.summary : "",
		takeaways: Array.isArray(body?.takeaways)
			? body.takeaways.filter((entry) => typeof entry === "string" && entry.trim())
			: [],
		workWindow: normalizeTwgWorkWindow(body?.workWindow),
	};
}

async function* runSummarizeStream(body) {
	const request = normalizeSummaryRequestBody(body);
	const controller = new AbortController();
	const previousController = activeSummarizeRuns.get(request.clientId);
	if (previousController) {
		previousController.abort();
	}
	activeSummarizeRuns.set(request.clientId, controller);

	try {
		yield { action: request.action, nodeId: request.nodeId, stage: "validating", type: "stage" };
		const { explorer, source, sourceNotice, workWindow } = await getActiveExplorerForSummary({
			nodeId: request.nodeId,
			signal: controller.signal,
			workWindow: request.workWindow,
		});
		if (request.action === "deck") {
			const selection = summaryContext.getSelectedNodeContext(explorer, request.nodeId);
			const deck = summaryContext.buildMarpDeck({
				length: request.length,
				selection,
				summary: request.summary,
				takeaways: request.takeaways,
			});
			yield {
				action: "deck",
				deck,
				nodeId: request.nodeId,
				stage: "deck",
				type: "deck",
			};
			yield { action: "deck", nodeId: request.nodeId, source, stage: "done", type: "done" };
			return;
		}

		const selection = summaryContext.getSelectedNodeContext(explorer, request.nodeId);
		const sourceFingerprint = summaryContext.createSourceFingerprint({
			explorer,
			selection,
			source,
			workWindow,
		});
		const cacheKey = getSummaryCacheKey({
			length: request.length,
			nodeId: request.nodeId,
			source,
			sourceFingerprint,
		});
		const cachedArticle = request.bypassCache ? null : getSummaryArticleCacheEntry(cacheKey);

		yield { action: "summary", length: request.length, nodeId: request.nodeId, source, stage: "enriching", type: "stage" };
		if (cachedArticle) {
			yield { action: "summary", length: request.length, nodeId: request.nodeId, source, stage: "rendering", type: "stage" };
			yield {
				action: "summary",
				articleMarkdown: cachedArticle.articleMarkdown,
				cache: "hit",
				inputKind: cachedArticle.inputKind,
				length: request.length,
				nodeId: request.nodeId,
				source,
				sourceFingerprint,
				sourceNotice,
				type: "article",
				workWindow,
			};
			yield { action: "summary", nodeId: request.nodeId, source, stage: "done", type: "done" };
			return;
		}

		yield { action: "summary", length: request.length, nodeId: request.nodeId, source, stage: "writing", type: "stage" };
		const result = await summaryContext.summarizeSelection({
			explorer,
			length: request.length,
			nodeId: request.nodeId,
			signal: controller.signal,
		});
		const articleMarkdown = result.summary;
		setSummaryArticleCacheEntry(cacheKey, {
			articleMarkdown,
			inputKind: result.inputKind,
		});
		yield { action: "summary", length: request.length, nodeId: request.nodeId, source, stage: "rendering", type: "stage" };
		yield {
			action: "summary",
			articleMarkdown,
			cache: request.bypassCache ? "bypass" : "miss",
			inputKind: result.inputKind,
			length: request.length,
			nodeId: request.nodeId,
			source,
			sourceFingerprint,
			sourceNotice,
			type: "article",
			workWindow,
		};
		yield { action: "summary", nodeId: request.nodeId, source, stage: "done", type: "done" };
	} finally {
		if (activeSummarizeRuns.get(request.clientId) === controller) {
			activeSummarizeRuns.delete(request.clientId);
		}
	}
}

async function getTwgExplorerCachedOrFresh({ signal } = {}) {
	const cached = readCache();
	if (cached) {
		scheduleCachedTwgArtifactTitleHydration(cached);
		return cached;
	}
	const fresh = await twgSource.buildTwgExplorer({ signal });
	writeCache(fresh);
	return fresh;
}

function getRequestSignal(req) {
	try {
		const signal = req?.signal;
		return signal && typeof signal.addEventListener === "function" ? signal : undefined;
	} catch {
		return undefined;
	}
}

router.get("/explorer", async (req, res) => {
	const source = getActiveSource();
	try {
		if (source === "twg") {
			return res.json(await getTwgExplorerCachedOrFresh({ signal: getRequestSignal(req) }));
		}
		return res.json(buildExplorer());
	} catch (error) {
		const status = getStatusForError(error);
		const errorBody = {
			error: error instanceof twgSource.TwgAuthError
				? "twg_auth_required"
				: error instanceof twgSource.TwgNotFoundError
					? "twg_not_found"
					: "Failed to build Personal Graph explorer",
			code: error?.code ?? "PERSONAL_GRAPH_EXPLORER_FAILED",
			details: error instanceof Error ? error.message : String(error),
		};
		if (error instanceof twgSource.TwgAuthError) {
			errorBody.remediation = "Run `twg login` and retry.";
		}
		return res.status(status).json(errorBody);
	}
});

router.get("/source", (_req, res) => {
	try {
		const source = getActiveSource();
		const cached = source === "twg" ? readCache() : null;
		return res.json({ source, generatedAt: cached?.generatedAt ?? null });
	} catch (error) {
		return res.status(500).json({
			error: "Failed to read graph source",
			code: error?.code ?? "PERSONAL_GRAPH_SOURCE_READ_FAILED",
			details: error instanceof Error ? error.message : String(error),
		});
	}
});

router.post("/source", (req, res) => {
	try {
		const requestedSource = typeof req.body?.source === "string" ? req.body.source : "";
		const next = setActiveSource(requestedSource);
		const cached = next === "twg" ? readCache() : null;
		return res.json({ source: next, generatedAt: cached?.generatedAt ?? null });
	} catch (error) {
		return res.status(400).json({
			error: "Failed to set graph source",
			code: error?.code ?? "PERSONAL_GRAPH_SOURCE_WRITE_FAILED",
			details: error instanceof Error ? error.message : String(error),
		});
	}
});

router.post("/twg/chat", async (req, res) => {
	try {
		await handleTwgChat(req, res);
	} catch (error) {
		if (!res.headersSent) {
			res.status(500).json({
				error: "Failed to handle TWG chat",
				code: error?.code ?? "PERSONAL_GRAPH_TWG_CHAT_FAILED",
				details: error instanceof Error ? error.message : String(error),
			});
		}
	}
});

router.post("/twg/refresh", async (req, res) => {
	try {
		const fresh = await twgSource.buildTwgExplorer({
			signal: getRequestSignal(req),
			since: normalizeTwgWorkWindow(req.body?.since),
		});
		writeCache(fresh);
		return res.json(fresh);
	} catch (error) {
		const status = getStatusForError(error);
		const errorBody = {
			error: error instanceof twgSource.TwgAuthError ? "twg_auth_required" : "Failed to refresh TWG explorer",
			code: error?.code ?? "PERSONAL_GRAPH_TWG_REFRESH_FAILED",
			details: error instanceof Error ? error.message : String(error),
		};
		if (error instanceof twgSource.TwgAuthError) {
			errorBody.remediation = "Run `twg login` and retry.";
		}
		return res.status(status).json(errorBody);
	}
});

router.post("/twg/expand", async (req, res) => {
	try {
		const cached = readCache();
		if (!cached) {
			const error = new Error("Team Work Graph expansion requires a cached explorer. Refresh TWG first.");
			error.code = "TWG_CACHE_REQUIRED";
			throw error;
		}
		const result = await twgSource.expandTwgExplorerNode({
			explorer: cached,
			nodeId: req.body?.nodeId,
			signal: getRequestSignal(req),
		});
		writeCache(result.explorer);
		return res.json(result);
	} catch (error) {
		const status = getStatusForError(error);
		const errorBody = {
			error: error instanceof twgSource.TwgAuthError
				? "twg_auth_required"
				: error instanceof twgSource.TwgNotFoundError
					? "twg_not_found"
					: "Failed to expand TWG explorer node",
			code: error?.code ?? "PERSONAL_GRAPH_TWG_EXPAND_FAILED",
			details: error instanceof Error ? error.message : String(error),
		};
		if (error instanceof twgSource.TwgAuthError) {
			errorBody.remediation = "Run `twg login` and retry.";
		}
		return res.status(status).json(errorBody);
	}
});

router.get("/page/*slug", (req, res) => {
	const slug = getWildcardRouteValue(req.params.slug);
	try {
		return res.json(readPage(slug));
	} catch (error) {
		return res.status(getStatusForError(error)).json({
			error: "Failed to read Personal Graph page",
			code: error?.code ?? "PERSONAL_GRAPH_PAGE_FAILED",
			details: error instanceof Error ? error.message : String(error),
		});
	}
});

router.put("/page/*slug", (req, res) => {
	const slug = getWildcardRouteValue(req.params.slug);
	const content = typeof req.body?.content === "string" ? req.body.content : "";
	try {
		return res.json(writePage(slug, content));
	} catch (error) {
		return res.status(getStatusForError(error)).json({
			error: "Failed to write Personal Graph page",
			code: error?.code ?? "PERSONAL_GRAPH_PAGE_WRITE_FAILED",
			details: error instanceof Error ? error.message : String(error),
		});
	}
});

router.post("/raw", express.raw({ limit: "50mb", type: "multipart/form-data" }), (req, res) => {
	try {
		let slug = typeof req.body?.slug === "string" ? req.body.slug : "";
		let content = typeof req.body?.content === "string" ? req.body.content : "";
		if (Buffer.isBuffer(req.body)) {
			const file = parseMultipartFile(req.body, req.headers["content-type"]);
			slug = file?.filename ?? "";
			content = file?.content ?? "";
		}
		if (!slug || !content) {
			return res.status(400).json({ error: "Raw source slug and content are required." });
		}
		return res.status(201).json(writeRaw(slug, content));
	} catch (error) {
		return res.status(getStatusForError(error)).json({
			error: "Failed to write Personal Graph raw source",
			code: error?.code ?? "PERSONAL_GRAPH_RAW_WRITE_FAILED",
			details: error instanceof Error ? error.message : String(error),
		});
	}
});

router.get("/unprocessed-count", (_req, res) => {
	try {
		return res.json(unprocessedRawSources());
	} catch (error) {
		return res.status(getStatusForError(error)).json({
			error: "Failed to count unprocessed Personal Graph sources",
			code: error?.code ?? "PERSONAL_GRAPH_UNPROCESSED_FAILED",
			details: error instanceof Error ? error.message : String(error),
		});
	}
});

router.post("/capture", async (req, res) => {
	try {
		const url = typeof req.body?.url === "string" ? req.body.url.trim() : "";
		if (!url) {
			return res.status(400).json({ error: "A URL is required." });
		}
		return res.status(201).json(await captureUrl(url));
	} catch (error) {
		return res.status(getStatusForError(error)).json({
			error: "Failed to capture Personal Graph URL",
			code: error?.code ?? "PERSONAL_GRAPH_CAPTURE_FAILED",
			details: error instanceof Error ? error.message : String(error),
		});
	}
});

router.get("/search", async (req, res) => {
	try {
		const query = getFirstQueryValue(req.query.q ?? req.query.query);
		if (typeof query !== "string" || !query.trim()) {
			return res.json({ backend: "none", results: [] });
		}
		const limit = Math.min(getPositiveInteger(getFirstQueryValue(req.query.limit), 10), 25);
		return res.json({ results: await qmd.search(query, { limit }) });
	} catch (error) {
		return res.status(getStatusForError(error)).json({
			error: "Failed to search Personal Graph",
			code: error?.code ?? "PERSONAL_GRAPH_SEARCH_FAILED",
			details: error instanceof Error ? error.message : String(error),
		});
	}
});

router.get("/log", (_req, res) => {
	try {
		return res.json({ entries: parseLogEntries() });
	} catch (error) {
		return res.status(getStatusForError(error)).json({
			error: "Failed to read Personal Graph log",
			code: error?.code ?? "PERSONAL_GRAPH_LOG_FAILED",
			details: error instanceof Error ? error.message : String(error),
		});
	}
});

router.post("/summarize", async (req, res) => {
	return streamIterable(res, runSummarizeStream(req.body));
});

router.post("/ingest", async (req, res) => {
	const confirmToken = typeof req.query?.confirm === "string"
		? req.query.confirm
		: typeof req.body?.confirmToken === "string"
			? req.body.confirmToken
			: "";
	if (confirmToken) {
		return streamIterable(res, librarian.confirm(confirmToken));
	}

	const sourcePath = typeof req.body?.sourcePath === "string" ? req.body.sourcePath : "";
	if (!sourcePath) {
		return res.status(400).json({ error: "A sourcePath is required." });
	}
	const summaryOverride = req.body?.summaryOverride && typeof req.body.summaryOverride === "object"
		? req.body.summaryOverride
		: null;
	return streamIterable(res, librarian.run({
		confirmation: Boolean(summaryOverride),
		sourcePath,
		summaryOverride,
	}));
});

const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Writes touch the local vault, run the TWG CLI with the owner's credentials,
// or open a browser on a supplied URL, so they only accept local requests.
function createPersonalGraphRouter({ env = process.env, requireRuntimeAdmin = passThrough } = {}) {
	const requireLocalDevRequest = createRequireLocalDevRequest({ env });
	const guardedRouter = express.Router();
	guardedRouter.use((req, res, next) => {
		if (READ_ONLY_METHODS.has(req.method)) {
			return next();
		}
		return requireLocalDevRequest(req, res, () => requireRuntimeAdmin(req, res, next));
	});
	guardedRouter.use(router);
	return guardedRouter;
}

function registerPersonalGraphRoutes(app, dependencies = {}) {
	app.use("/api/personal-graph", createPersonalGraphRouter(dependencies));
}

module.exports = {
	createPersonalGraphRouter,
	registerPersonalGraphRoutes,
};
