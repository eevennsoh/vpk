"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createPrecompressedMiddleware, sendPrecompressedFile, setStaticCacheHeaders } = require("./static-asset-delivery");

const FALLBACK_HTML = `<!DOCTYPE html>
<html>
<head>
<title>VPK</title>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
<div id="root">
<h1>VPK Service</h1>
<p>Service is running and ready to serve content.</p>
<p><a href="/healthcheck">Health Check</a></p>
<p><a href="/api/health">API Health Check</a></p>
</div>
</body>
</html>`;

function requireFunction(name, value) {
	if (typeof value !== "function") {
		throw new Error(`registerStaticExportServing requires ${name}`);
	}
	return value;
}

function requirePublicPath(publicPath) {
	if (typeof publicPath !== "string" || publicPath.length === 0) {
		throw new Error("registerStaticExportServing requires publicPath");
	}
	return publicPath;
}

function findLargestFile(dir, predicate, { fsModule = fs, pathModule = path } = {}) {
	let best = null;
	const walk = (current) => {
		let entries;
		try {
			entries = fsModule.readdirSync(current, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			const full = pathModule.join(current, entry.name);
			if (entry.isDirectory()) {
				walk(full);
				continue;
			}
			if (!entry.isFile() || !predicate(entry.name)) {
				continue;
			}
			try {
				const { size } = fsModule.statSync(full);
				if (!best || size > best.size) {
					best = { full, size };
				}
			} catch {
				/* ignore stat failures */
			}
		}
	};
	walk(dir);
	return best?.full ?? null;
}

function buildPreloadLinkHeader({
	fsModule = fs,
	logger = console,
	pathModule = path,
	publicPath,
} = {}) {
	requirePublicPath(publicPath);
	try {
		const staticRoot = pathModule.join(publicPath, "_next", "static");
		if (!fsModule.existsSync(staticRoot)) {
			return "";
		}

		const toHref = (absolutePath) => {
			const rel = pathModule.relative(publicPath, absolutePath).split(pathModule.sep).join("/");
			return `/${rel}`;
		};

		const cssFile = findLargestFile(staticRoot, (name) => name.endsWith(".css"), {
			fsModule,
			pathModule,
		});
		const chunksDir = pathModule.join(staticRoot, "chunks");
		const jsFile = fsModule.existsSync(chunksDir)
			? findLargestFile(chunksDir, (name) => name.endsWith(".js"), {
				fsModule,
				pathModule,
			})
			: findLargestFile(staticRoot, (name) => name.endsWith(".js"), {
				fsModule,
				pathModule,
			});

		const entries = [];
		if (cssFile) {
			entries.push(`<${toHref(cssFile)}>; rel=preload; as=style`);
		}
		if (jsFile) {
			entries.push(`<${toHref(jsFile)}>; rel=preload; as=script; crossorigin`);
		}

		return entries.join(", ");
	} catch (error) {
		logger.warn?.("[STARTUP] Failed to build preload Link header:", error?.message);
		return "";
	}
}

function createStaticExportFallbackHandler({
	logger = console,
	pathModule = path,
	preloadLinkHeader = "",
	publicPath,
} = {}) {
	requirePublicPath(publicPath);
	return async function staticExportFallbackHandler(req, res, next) {
		logger.log?.(`[STATIC] Request for route: ${req.path}`);

		if (req.path.startsWith("/api/")) {
			return res.status(404).json({
				error: `API route not found: ${req.path}`,
			});
		}

		if (preloadLinkHeader) {
			res.setHeader("Link", preloadLinkHeader);
		}

		const indexPath = pathModule.join(publicPath, "index.html");
		try {
			if (await sendPrecompressedFile(req, res, indexPath, pathModule.resolve(publicPath))) return;
		} catch (error) {
			return next(error);
		}
		res.sendFile(indexPath, (err) => {
			if (err) {
				logger.log?.(`[STATIC] index.html not found at ${indexPath}`);
				res.status(200).send(FALLBACK_HTML);
			}
		});
	};
}

function registerStaticExportServing(app, {
	expressImpl,
	fsModule = fs,
	logger = console,
	pathModule = path,
	publicPath,
} = {}) {
	requireFunction("app.use", app?.use);
	requireFunction("app.get", app?.get);
	requireFunction("expressImpl.static", expressImpl?.static);
	requirePublicPath(publicPath);

	logger.log?.(`[STARTUP] Serving static files from: ${publicPath}`);
	const preloadLinkHeader = buildPreloadLinkHeader({
		fsModule,
		logger,
		pathModule,
		publicPath,
	});
	if (preloadLinkHeader) {
		logger.log?.(`[STARTUP] Preload Link header: ${preloadLinkHeader}`);
	}

	app.use(createPrecompressedMiddleware(publicPath));
	app.use(expressImpl.static(publicPath, {
		setHeaders: (res, filePath) => setStaticCacheHeaders(res, filePath, pathModule.resolve(publicPath)),
	}));
	app.get("/{*splat}", createStaticExportFallbackHandler({
		logger,
		pathModule,
		preloadLinkHeader,
		publicPath,
	}));

	return { preloadLinkHeader };
}

module.exports = {
	FALLBACK_HTML,
	buildPreloadLinkHeader,
	createStaticExportFallbackHandler,
	registerStaticExportServing,
};
