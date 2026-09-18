#!/usr/bin/env node
/**
 * trace-imports.mjs
 *
 * Walks the import graph starting from a VPK route entry (app/<route>/page.tsx)
 * and produces an extraction plan describing every file, npm package, asset,
 * and CSS import the route transitively depends on.
 *
 * Usage:
 *   node trace-imports.mjs <route-path> [--repo <vpk-root>] [--out <json-path>]
 *
 * Example:
 *   node trace-imports.mjs /awake
 *   node trace-imports.mjs /awake --out .cache/awake.plan.json
 *
 * Output (JSON): { route, entry, files, npmPackages, assets, cssImports,
 *                  backendRoutes, sourceRevision, sourceWasDirty, warnings }
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const RESOLVE_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js", ".mjs", ".mts", ".cjs", ".cts", ".json"];

// Files we never follow, even if statically imported. These are "dispatcher"
// modules whose sole job is to centralize imports across many unrelated
// features — traversing them would pull in the entire VPK demo tree, which
// is the opposite of what route extraction wants. We still log them so the
// plan can note the replacement strategy (usually: rewrite the calling code
// to import the specific target directly).
const FILE_BLACKLIST_EXACT = new Set([
	"components/website/demo-registry-loader.ts",
	"components/website/registry.ts",
]);

function isBlacklistedRelativePath(relPath) {
	if (FILE_BLACKLIST_EXACT.has(relPath)) return true;
	// Also skip any other components/website/* file except the demos themselves.
	// The demo files ARE the intended traversal targets (we queue them via the
	// loadDemoComponent special case), but the rest of components/website/
	// (navigation, docs pages, layout chrome) is pure VPK catalog scaffolding
	// and has no place in a single-route extraction.
	if (relPath.startsWith("components/website/") && !relPath.startsWith("components/website/demos/")) {
		return true;
	}
	return false;
}
const ASSET_EXTENSIONS = new Set([
	".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif",
	".mp3", ".wav", ".m4a", ".ogg",
	".glb", ".gltf",
	".json",
	".ttf", ".otf", ".woff", ".woff2",
]);
const CSS_EXTENSIONS = new Set([".css", ".scss", ".sass"]);

// -------- CLI ------------------------------------------------------------

function parseArgs(argv) {
	const args = { route: null, repo: null, out: null };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--repo") args.repo = argv[++i];
		else if (a === "--out") args.out = argv[++i];
		else if (a.startsWith("--")) throw new Error(`Unknown flag: ${a}`);
		else if (!args.route) args.route = a;
	}
	if (!args.route) {
		throw new Error("Usage: trace-imports.mjs <route-path> [--repo <vpk-root>] [--out <json-path>]");
	}
	return args;
}

function findRepoRoot(startDir) {
	let dir = path.resolve(startDir);
	while (dir !== path.dirname(dir)) {
		const pkg = path.join(dir, "package.json");
		if (fs.existsSync(pkg) && fs.existsSync(path.join(dir, "app")) && fs.existsSync(path.join(dir, "components"))) {
			return dir;
		}
		dir = path.dirname(dir);
	}
	throw new Error(`Could not find VPK repo root from ${startDir}`);
}

function sourceGitState(repoRoot) {
	try {
		const options = { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] };
		return {
			revision: execFileSync("git", ["rev-parse", "HEAD"], options).trim(),
			dirty: Boolean(execFileSync("git", ["status", "--porcelain"], options).trim()),
		};
	} catch {
		return { revision: null, dirty: null };
	}
}

// -------- Path resolution -----------------------------------------------

function resolveLocalSpecifier(specifier, fromFile, repoRoot) {
	let candidate;
	if (specifier.startsWith("@/")) {
		candidate = path.join(repoRoot, specifier.slice(2));
	} else if (specifier.startsWith("./") || specifier.startsWith("../")) {
		candidate = path.resolve(path.dirname(fromFile), specifier);
	} else {
		return null;
	}
	return resolveWithExtensions(candidate);
}

function resolveWithExtensions(base) {
	// 1. Exact match (e.g. already has extension like .css or .svg)
	if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;

	// 2. Try appending each extension
	for (const ext of RESOLVE_EXTENSIONS) {
		const withExt = base + ext;
		if (fs.existsSync(withExt)) return withExt;
	}

	// 3. Try index.* inside directory
	if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
		for (const ext of RESOLVE_EXTENSIONS) {
			const indexFile = path.join(base, "index" + ext);
			if (fs.existsSync(indexFile)) return indexFile;
		}
	}
	return null;
}

function classifySpecifier(specifier) {
	const ext = path.extname(specifier).toLowerCase();
	if (specifier.startsWith("@/") || specifier.startsWith("./") || specifier.startsWith("../")) {
		if (CSS_EXTENSIONS.has(ext)) return "css";
		if (ASSET_EXTENSIONS.has(ext) && ext !== ".json") return "asset";
		return "local";
	}
	if (CSS_EXTENSIONS.has(ext)) return "css";
	if (ASSET_EXTENSIONS.has(ext)) return "asset";
	return "npm";
}

function npmPackageRoot(specifier) {
	// "motion/react" -> "motion"
	// "@atlaskit/tokens/css-reset.css" -> "@atlaskit/tokens"
	// "@ai-sdk/react" -> "@ai-sdk/react"
	if (specifier.startsWith("@")) {
		const parts = specifier.split("/");
		return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : specifier;
	}
	return specifier.split("/")[0];
}

// -------- AST walking ----------------------------------------------------

/**
 * Extract all import specifiers and special calls from a source file.
 * Returns: { imports: string[], dynamicImports: string[],
 *            demoCalls: Array<{slug, category}>, nonLiteralWarnings: string[] }
 */
function extractFromSource(sourceFile) {
	const imports = [];
	const dynamicImports = [];
	const demoCalls = [];
	const nonLiteralWarnings = [];

	function stringLiteralValue(node) {
		if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
		return null;
	}

	function visit(node) {
		// Static: import "x", import X from "x", export { y } from "x"
		if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
			if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
				imports.push(node.moduleSpecifier.text);
			}
		}

		if (ts.isCallExpression(node)) {
			// import("x") dynamic
			if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
				const arg = node.arguments[0];
				const lit = arg && stringLiteralValue(arg);
				if (lit) dynamicImports.push(lit);
				else nonLiteralWarnings.push(`Non-literal dynamic import() at ${node.getStart()}`);
			}

			// require("x") (used in some .js files like backend/lib)
			if (ts.isIdentifier(node.expression) && node.expression.text === "require") {
				const arg = node.arguments[0];
				const lit = arg && stringLiteralValue(arg);
				if (lit) imports.push(lit);
			}

			// loadDemoComponent("slug", "category") — VPK convention
			if (ts.isIdentifier(node.expression) && node.expression.text === "loadDemoComponent") {
				const [slugArg, categoryArg] = node.arguments;
				const slug = slugArg && stringLiteralValue(slugArg);
				const category = categoryArg && stringLiteralValue(categoryArg);
				if (slug && category) {
					demoCalls.push({ slug, category });
				} else {
					nonLiteralWarnings.push(`Non-literal loadDemoComponent(...) call`);
				}
			}
		}

		ts.forEachChild(node, visit);
	}

	visit(sourceFile);
	return { imports, dynamicImports, demoCalls, nonLiteralWarnings };
}

/**
 * Scan a source file's raw text for `/`-prefixed asset paths in string literals.
 * Returns array of asset paths like ["/sound/click-002.mp3", "/illustration/foo.svg"].
 */
function extractAssetRefs(text) {
	const results = new Set();
	// Match "..." or '...' strings that start with / and end with a known asset extension
	const re = /["'`](\/[a-zA-Z0-9_\-./]+\.(svg|png|jpg|jpeg|webp|gif|avif|mp3|wav|m4a|ogg|glb|gltf|ttf|otf|woff|woff2))["'`]/gi;
	let m;
	while ((m = re.exec(text)) !== null) results.add(m[1]);
	return [...results];
}

function publicAssetExists(repoRoot, assetPath) {
	const rel = assetPath.startsWith("/") ? assetPath.slice(1) : assetPath;
	return fs.existsSync(path.join(repoRoot, "public", rel));
}

function companionAssetRefs(assetPath, repoRoot) {
	const companions = [];

	if (assetPath.startsWith("/avatar-agent/")) {
		const unmaskedPath = assetPath.replace("/avatar-agent/", "/avatar-agent-unmasked/");
		if (publicAssetExists(repoRoot, unmaskedPath)) companions.push(unmaskedPath);
	}

	const thirdPartyMatch = assetPath.match(/^\/3p\/([^/]+)\/\d+\.svg$/);
	if (thirdPartyMatch) {
		const borderlessPath = `/3p/${thirdPartyMatch[1]}/16-borderless.svg`;
		if (publicAssetExists(repoRoot, borderlessPath)) companions.push(borderlessPath);
	}

	return companions;
}

// -------- Main trace ----------------------------------------------------

function trace({ route, repoRoot }) {
	const routeDir = path.join(repoRoot, "app", route.replace(/^\//, ""));
	const pagePath = resolveWithExtensions(path.join(routeDir, "page"));
	if (!pagePath) {
		throw new Error(`Could not find entry: app${route}/page.{tsx,ts,jsx,js}`);
	}
	const layoutPath = resolveWithExtensions(path.join(routeDir, "layout"));

	const visited = new Set();
	const queue = [pagePath];
	if (layoutPath) queue.push(layoutPath);

	const npmPackages = new Map(); // name -> Set(specifiers)
	const assets = new Set();
	const cssImports = new Set();
	const backendRoutes = new Set();
	const warnings = [];
	const skippedDispatchers = new Set();

	// Context files (under app/contexts/) that got pulled in transitively.
	// These tell the scaffold which providers to wrap the layout with.
	const contextFiles = new Set();

	// Runtime fetches of /api/* that the component tree will do at runtime.
	// Static analysis can see the URL literals but not which component hits them;
	// we collect them here and surface as warnings for the user to wire up.
	const apiCalls = new Set();

	function addAsset(assetPath) {
		assets.add(assetPath);
		for (const companion of companionAssetRefs(assetPath, repoRoot)) {
			assets.add(companion);
		}
	}

	while (queue.length > 0) {
		const file = queue.shift();
		if (visited.has(file)) continue;
		visited.add(file);

		const text = fs.readFileSync(file, "utf8");
		const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
		const extracted = extractFromSource(sf);

		// Record if this file lives under app/contexts/ — the scaffold needs
		// to wrap the layout with any provider exports it finds.
		const relFile = path.relative(repoRoot, file);
		if (relFile.startsWith("app/contexts/")) {
			contextFiles.add(relFile);
		}

		// Asset literals in source
		for (const a of extractAssetRefs(text)) addAsset(a);

		// Runtime fetch("/api/...") references. Regex is sufficient — we just
		// need the URL literals to warn the user about required backend wiring.
		const fetchRe = /fetch\(\s*(?:["'`])(\/api\/[^"'`?]+)/g;
		let fetchMatch;
		while ((fetchMatch = fetchRe.exec(text)) !== null) apiCalls.add(fetchMatch[1]);

		// Static + dynamic imports
		const allImports = [...extracted.imports, ...extracted.dynamicImports];
		for (const spec of allImports) {
			const kind = classifySpecifier(spec);

			if (kind === "css") {
				if (spec.startsWith("@/") || spec.startsWith("./") || spec.startsWith("../")) {
					const resolved = resolveLocalSpecifier(spec, file, repoRoot);
					if (resolved) {
						cssImports.add(path.relative(repoRoot, resolved));
					}
				} else {
					// npm CSS import, e.g. "@atlaskit/tokens/css-reset.css"
					cssImports.add(spec);
					const pkg = npmPackageRoot(spec);
					if (!npmPackages.has(pkg)) npmPackages.set(pkg, new Set());
					npmPackages.get(pkg).add(spec);
				}
				continue;
			}

			if (kind === "asset") {
				// e.g. import logo from "./logo.svg"
				if (spec.startsWith("@/") || spec.startsWith("./") || spec.startsWith("../")) {
					const resolved = resolveLocalSpecifier(spec, file, repoRoot);
					if (resolved) addAsset("/" + path.relative(repoRoot, resolved).replace(/^public\//, ""));
				}
				continue;
			}

			if (kind === "local") {
				// Flag backend/* imports — out of scope for v1
				if (spec.startsWith("@/backend/") || spec.includes("/backend/")) {
					backendRoutes.add(spec);
				}
				const resolved = resolveLocalSpecifier(spec, file, repoRoot);
				if (!resolved) {
					warnings.push(`Unresolved local import "${spec}" in ${path.relative(repoRoot, file)}`);
					continue;
				}
				const relResolved = path.relative(repoRoot, resolved);
				if (isBlacklistedRelativePath(relResolved)) {
					skippedDispatchers.add(relResolved);
					continue;
				}
				queue.push(resolved);
				continue;
			}

			// npm
			const pkg = npmPackageRoot(spec);
			if (!npmPackages.has(pkg)) npmPackages.set(pkg, new Set());
			npmPackages.get(pkg).add(spec);
		}

		// loadDemoComponent("slug", "category") → demos/<category>/<slug>-demo.tsx
		for (const { slug, category } of extracted.demoCalls) {
			const demoPath = resolveWithExtensions(
				path.join(repoRoot, "components", "website", "demos", category, `${slug}-demo`)
			);
			if (demoPath) {
				queue.push(demoPath);
			} else {
				warnings.push(`loadDemoComponent("${slug}", "${category}") did not resolve to a demo file`);
			}
		}

		for (const w of extracted.nonLiteralWarnings) {
			warnings.push(`${path.relative(repoRoot, file)}: ${w}`);
		}
	}

	return {
		pagePath, layoutPath, visited, npmPackages, assets, cssImports,
		backendRoutes, warnings, skippedDispatchers, contextFiles, apiCalls,
	};
}

// -------- Plan assembly -------------------------------------------------

function readJSON(p) {
	return JSON.parse(fs.readFileSync(p, "utf8"));
}

function resolvePinnedVersion(pkgName, rootManifest) {
	const deps = rootManifest.dependencies || {};
	const dev = rootManifest.devDependencies || {};
	return deps[pkgName] || dev[pkgName] || null;
}

/**
 * Parse the top-level `catalog:` map from `pnpm-workspace.yaml`. The sibling
 * extract is not a pnpm workspace, so every `"catalog:"` specifier must be
 * replaced with the concrete version from this block.
 */
function readPnpmCatalog(repoRoot) {
	const yamlPath = path.join(repoRoot, "pnpm-workspace.yaml");
	if (!fs.existsSync(yamlPath)) return {};
	const catalog = {};
	let inCatalog = false;
	for (const rawLine of fs.readFileSync(yamlPath, "utf8").split("\n")) {
		const line = rawLine.replace(/\s+#.*$/, "");
		if (!inCatalog) {
			if (/^catalog:\s*$/.test(line)) inCatalog = true;
			continue;
		}
		if (/^\S/.test(line) && line.trim() !== "") break;
		const match = line.match(/^\s+['"]?([^'"#:]+)['"]?\s*:\s*['"]?([^'"#\s]+)['"]?\s*$/);
		if (match) catalog[match[1].trim()] = match[2].trim();
	}
	return catalog;
}

function resolveCatalogSpecifier(pkgName, version, catalog) {
	if (version !== "catalog:") return version;
	return catalog[pkgName] || version;
}

const HOST_PACKAGE_PEERS = [
	{ host: "react-leaflet", runtime: ["leaflet"], types: ["@types/leaflet"] },
	{ host: "three", runtime: [], types: ["@types/three"] },
];

function addHostPackagePeers(npmPackages, rootManifest, catalog, warnings) {
	for (const { host, runtime, types } of HOST_PACKAGE_PEERS) {
		if (!npmPackages[host]) continue;
		for (const peer of [...runtime, ...types]) {
			if (npmPackages[peer]) continue;
			const raw = resolvePinnedVersion(peer, rootManifest);
			if (!raw) {
				warnings.push(`Host package "${host}" is in the graph but peer "${peer}" is missing from source package.json`);
				continue;
			}
			npmPackages[peer] = resolveCatalogSpecifier(peer, raw, catalog);
		}
	}
}

function collectAmbientTypeFiles(repoRoot, files) {
	const extra = [];
	const typesDir = path.join(repoRoot, "types");
	if (fs.existsSync(typesDir) && fs.statSync(typesDir).isDirectory()) {
		for (const name of fs.readdirSync(typesDir).sort()) {
			if (name.endsWith(".d.ts")) extra.push(path.posix.join("types", name));
		}
	}
	for (const rel of files) {
		if (!/\.(mjs|cjs|js)$/.test(rel)) continue;
		const dtsRel = rel.replace(/\.(mjs|cjs|js)$/, ".d.ts");
		if (fs.existsSync(path.join(repoRoot, dtsRel))) extra.push(dtsRel);
	}
	return extra;
}

function collectLocalCssImportsFromText(cssText, fromDir) {
	const found = [];
	const re = /@import\s+["'](\.\.?\/[^"']+\.css)["']/g;
	let match;
	while ((match = re.exec(cssText)) !== null) {
		found.push(path.posix.normalize(path.posix.join(fromDir, match[1])));
	}
	return found;
}

function buildPlan({ route, repoRoot, trace: t, gitState }) {
	const manifest = readJSON(path.join(repoRoot, "package.json"));
	const catalog = readPnpmCatalog(repoRoot);

	const files = [...t.visited]
		.map(f => path.relative(repoRoot, f))
		.sort();
	const ambientTypes = collectAmbientTypeFiles(repoRoot, files);
	const allFiles = [...new Set([...files, ...ambientTypes])].sort();

	const npmPackages = {};
	const unresolvedNpm = [];
	const unresolvedCatalog = [];
	for (const pkg of [...t.npmPackages.keys()].sort()) {
		const rawVersion = resolvePinnedVersion(pkg, manifest);
		if (rawVersion) {
			const version = resolveCatalogSpecifier(pkg, rawVersion, catalog);
			npmPackages[pkg] = version;
			if (rawVersion === "catalog:" && version === "catalog:") {
				unresolvedCatalog.push(pkg);
			}
		} else if (pkg.startsWith("react") || pkg === "next" || pkg === "typescript") {
			// Core always assumed present in the scaffold even if not explicit
			npmPackages[pkg] = "latest";
		} else {
			unresolvedNpm.push(pkg);
		}
	}

	const peerWarnings = [];
	addHostPackagePeers(npmPackages, manifest, catalog, peerWarnings);

	// Always mark the two universal CSS prerequisites so the scaffold copies them.
	// These are Tailwind-build-time dependencies that the AST won't catch if they're
	// only referenced transitively through layout.tsx.
	const universalCss = [
		"app/tailwind-theme.css",
		"@atlaskit/tokens/css-reset.css",
	];
	const cssImportSet = new Set([...t.cssImports, ...universalCss]);
	const globalsCssRel = "app/globals.css";
	const globalsCssAbs = path.join(repoRoot, globalsCssRel);
	if (fs.existsSync(globalsCssAbs)) {
		for (const rel of collectLocalCssImportsFromText(fs.readFileSync(globalsCssAbs, "utf8"), "app")) {
			cssImportSet.add(rel);
		}
	}
	const cssImports = [...cssImportSet].sort();

	// If tailwind-theme.css is local and @atlaskit/tokens is npm, ensure the latter is in deps
	if (cssImports.includes("@atlaskit/tokens/css-reset.css") && !npmPackages["@atlaskit/tokens"]) {
		const v = resolvePinnedVersion("@atlaskit/tokens", manifest);
		if (v) npmPackages["@atlaskit/tokens"] = resolveCatalogSpecifier("@atlaskit/tokens", v, catalog);
	}

	const warnings = [...t.warnings, ...peerWarnings];
	for (const pkg of unresolvedNpm) {
		warnings.push(`npm dep "${pkg}" not found in root package.json — extraction may fail`);
	}
	for (const pkg of unresolvedCatalog) {
		warnings.push(`npm dep "${pkg}" uses catalog: but has no entry in pnpm-workspace.yaml`);
	}

	const backendRoutes = [...t.backendRoutes].sort();
	if (backendRoutes.length > 0) {
		warnings.push(
			`Route imports backend code (${backendRoutes.length} specifier(s)). ` +
			`v1 of /vpk-build only supports pure frontend routes. ` +
			`Keep deploying this route via VPK's /vpk-deploy instead.`
		);
	}

	const contextFiles = [...t.contextFiles].sort();
	const apiCalls = [...t.apiCalls].sort();

	if (apiCalls.length > 0) {
		warnings.push(
			`Route makes ${apiCalls.length} runtime fetch call(s) to /api/*: ${apiCalls.join(", ")}. ` +
			`The extracted project does not include these backend routes. ` +
			`Either add stub handlers to the extracted backend/server.js, proxy to VPK, or extract a route that doesn't hit /api/*.`,
		);
	}

	return {
		route,
		repoRoot,
		sourceRevision: gitState.revision,
		sourceWasDirty: gitState.dirty,
		entry: path.relative(repoRoot, t.pagePath),
		layout: t.layoutPath ? path.relative(repoRoot, t.layoutPath) : null,
		files: allFiles,
		npmPackages,
		assets: [...t.assets].sort(),
		cssImports,
		contextFiles,
		apiCalls,
		backendRoutes,
		skippedDispatchers: [...t.skippedDispatchers].sort(),
		warnings,
		summary: {
			fileCount: allFiles.length,
			npmCount: Object.keys(npmPackages).length,
			assetCount: t.assets.size,
			cssCount: cssImports.length,
			contextFileCount: contextFiles.length,
			apiCallCount: apiCalls.length,
			warningCount: warnings.length,
			backendRouteCount: backendRoutes.length,
			skippedDispatcherCount: t.skippedDispatchers.size,
		},
	};
}

// -------- Entry ----------------------------------------------------------

function main() {
	const args = parseArgs(process.argv.slice(2));
	const repoRoot = args.repo ? path.resolve(args.repo) : findRepoRoot(process.cwd());
	const selectedGitState = sourceGitState(repoRoot);
	const result = trace({ route: args.route, repoRoot });
	const plan = buildPlan({ route: args.route, repoRoot, trace: result, gitState: selectedGitState });
	const finalGitState = sourceGitState(repoRoot);
	if (selectedGitState.revision && finalGitState.revision !== selectedGitState.revision) {
		throw new Error("Source Git revision changed while tracing. Re-run the trace from the intended checkout.");
	}
	if (selectedGitState.dirty !== finalGitState.dirty) {
		console.error("Source working-tree state changed while tracing; review the selected files before scaffolding.");
	}

	const json = JSON.stringify(plan, null, 2);
	if (args.out) {
		const outPath = path.resolve(args.out);
		fs.mkdirSync(path.dirname(outPath), { recursive: true });
		fs.writeFileSync(outPath, json + "\n");
		console.error(`Plan written to ${outPath}`);
		console.error(`Files: ${plan.summary.fileCount} | npm: ${plan.summary.npmCount} | assets: ${plan.summary.assetCount} | css: ${plan.summary.cssCount} | warnings: ${plan.summary.warningCount}`);
	} else {
		process.stdout.write(json + "\n");
	}
}

try {
	main();
} catch (err) {
	console.error(`trace-imports: ${err.message}`);
	process.exit(1);
}
