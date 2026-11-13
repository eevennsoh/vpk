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

function isRetiredControlPlanePath(requestPath) {
	try {
		requestPath = decodeURIComponent(requestPath);
	} catch {
		return true;
	}
	return /^\/(?:rovo|studio)\/(?:jobs|memories|skills|settings)(?:\/|$)/u.test(requestPath)
		|| /^\/(?:memories|jobs|settings)(?:\/|$)/u.test(requestPath);
}

function rejectRetiredControlPlaneRoute(req, res, next) {
	if (isRetiredControlPlanePath(req.path)) {
		return res.status(404).send("Not found");
	}
	return next();
}

// An optional catch-all such as `app/rovo/[[...id]]` exports only its root page (`rovo.html`) and
// marks the route with a segment file named `rovo/__next.rovo.$oc$id.__PAGE__.txt`. Read those
// markers from the export so a new catch-all route needs no list kept by hand. Longest first, so
// a nested catch-all wins over its parent.
const CATCH_ALL_SEGMENT_FILE = /^__next\..+\.\$o?c\$[^.]+\.__PAGE__\.txt$/u;

function findCatchAllRoots(publicPath, { fsModule = fs, pathModule = path } = {}) {
	const roots = [];
	const walk = (relativeDir) => {
		let entries;
		try {
			entries = fsModule.readdirSync(pathModule.join(publicPath, relativeDir), { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			if (entry.isDirectory()) {
				if (!entry.name.startsWith(".") && !(relativeDir === "" && entry.name === "_next")) walk(pathModule.join(relativeDir, entry.name));
			} else if (relativeDir !== "" && CATCH_ALL_SEGMENT_FILE.test(entry.name)) {
				try {
					if (fsModule.statSync(pathModule.join(publicPath, `${relativeDir}.html`)).isFile()) roots.push(relativeDir.split(pathModule.sep));
				} catch {
					/* a catch-all without a root page has nothing to serve */
				}
			}
		}
	};
	walk("");
	return roots.sort((left, right) => right.length - left.length);
}

function isFileInside(root, file, { fsModule = fs, pathModule = path } = {}) {
	if (!file.startsWith(`${root}${pathModule.sep}`)) return false;
	try {
		return fsModule.statSync(file).isFile();
	} catch {
		return false;
	}
}

// Next.js export writes `a/b.html` beside an `a/b/` directory of RSC segment files, while links
// address the page as `/a/b`. express.static would redirect that to the directory, so point an
// extensionless page path (with or without a trailing slash) at its `.html` file first. A path
// under an exported catch-all with no file of its own (`/rovo/<thread-id>`) gets the catch-all's
// root page. Only a file inside the public directory is used; anything else falls through.
function createCleanUrlMiddleware(publicPath, { catchAllRoots, fsModule = fs, pathModule = path } = {}) {
	const root = pathModule.resolve(requirePublicPath(publicPath));
	const roots = catchAllRoots ?? findCatchAllRoots(root, { fsModule, pathModule });
	return function cleanUrlMiddleware(req, res, next) {
		if (!["GET", "HEAD"].includes(req.method) || req.path === "/" || req.path.startsWith("/api/")) return next();
		let decoded;
		try {
			decoded = decodeURIComponent(req.path);
		} catch {
			return next();
		}
		const pagePath = decoded.replace(/\/$/u, "");
		const segments = pagePath.split("/").slice(1);
		if (segments.some((segment) => segment.startsWith(".")) || pathModule.extname(segments.at(-1)) !== "") return next();
		const query = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
		// An encoded separator is not a path separator, so it never names a page file.
		if (!/%(?:2f|5c)/iu.test(req.path) && isFileInside(root, pathModule.resolve(root, `.${pagePath}.html`), { fsModule, pathModule })) {
			req.url = `${encodeURI(pagePath)}.html${query}`;
			return next();
		}
		const catchAll = roots.find((rootSegments) => segments.length > rootSegments.length && rootSegments.every((segment, index) => segments[index] === segment));
		if (catchAll) req.url = `/${catchAll.map(encodeURIComponent).join("/")}.html${query}`;
		return next();
	};
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

		if (isRetiredControlPlanePath(req.path)) {
			return res.status(404).send("Not found");
		}

		if (req.path.startsWith("/api/")) {
			return res.status(404).json({
				error: `API route not found: ${req.path}`,
			});
		}

		if (preloadLinkHeader) {
			res.setHeader("Link", preloadLinkHeader);
		}

		const indexPath = pathModule.join(publicPath, "index.html");
		setStaticCacheHeaders(res, indexPath, pathModule.resolve(publicPath));
		try {
			if (await sendPrecompressedFile(req, res, indexPath, pathModule.resolve(publicPath))) return;
		} catch (error) {
			return next(error);
		}
		// Relative to the public root, so a dot-named parent directory (an agent worktree under
		// `.claude/`) is not mistaken for a dotfile.
		res.sendFile("index.html", { root: pathModule.resolve(publicPath) }, (err) => {
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

	app.use(rejectRetiredControlPlaneRoute);
	app.use(createCleanUrlMiddleware(publicPath, { fsModule, pathModule }));
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
	createCleanUrlMiddleware,
	findCatchAllRoots,
	isRetiredControlPlanePath,
	rejectRetiredControlPlaneRoute,
	buildPreloadLinkHeader,
	createStaticExportFallbackHandler,
	registerStaticExportServing,
};
