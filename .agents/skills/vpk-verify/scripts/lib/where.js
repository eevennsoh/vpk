"use strict";

// where: file/slug/route -> routes, importers, feature recipes and Playwright specs to re-check.

const fs = require("node:fs");
const path = require("node:path");

const { plural, splitOptions, usageError } = require("./cli.js");
const { REPO_ROOT, readRepoMap, readText, toPosix } = require("./repo.js");

const WHERE_USAGE = "Usage: control-vpk where <path|slug|route> [--json]";
const WHERE_STEM_EXTENSION = /\.(?:tsx|ts|jsx|js|mjs|cjs|css|mdx|md|json)$/u;
const WHERE_SCAN_EXTENSION = /\.(?:tsx|ts|jsx|js|mjs|cjs)$/u;
const WHERE_TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/u;
const WHERE_HUMAN_LIMIT = 12;
const DEMO_LOADER_CALL = /loadDemoComponent\(\s*["'`]([^"'`]+)["'`]\s*,\s*["'`]([^"'`]+)["'`]/u;
const ALIAS_IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)["'`]@\/([^"'`]+)["'`]/gu;
const ROUTE_VIA_ORDER = ["page", "doc", "template", "redirect"];
// Catalog lifecycle (app/data/component-manifest.ts): omitted means live; the others warn.
const DEFAULT_STATUS = "live";
const STATUS_WARNINGS = {
	frozen: "frozen variant — confirm the user wants this one changed",
	superseded: "superseded variant — confirm the user wants this one changed, not its successor",
};

function normalizeStem(value) {
	return toPosix(String(value ?? "").trim())
		.replace(/^@\//u, "")
		.replace(/^\.\//u, "")
		.replace(/\/+$/u, "")
		.replace(WHERE_STEM_EXTENSION, "")
		.replace(/\/index$/u, "");
}

function isWithin(child, parent) {
	return Boolean(parent) && (child === parent || child.startsWith(`${parent}/`));
}

function ancestorStems(stem) {
	const parts = stem.split("/");
	return parts.map((_, index) => parts.slice(0, parts.length - index).join("/"));
}

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function walkFiles(dir, accept, out = []) {
	let entries = [];
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return out;
	}
	for (const entry of entries) {
		if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) walkFiles(full, accept, out);
		else if (accept(entry.name)) out.push(full);
	}
	return out;
}

function whereCatalog(repoMap) {
	return (repoMap.components?.categories ?? []).flatMap((group) => (group.entries ?? []).map((entry) => ({
		category: entry.category ?? group.category,
		slug: entry.slug,
		name: entry.name ?? entry.slug,
		status: typeof entry.status === "string" ? entry.status : DEFAULT_STATUS,
		basedOn: typeof entry.basedOn === "string" ? entry.basedOn : null,
		note: typeof entry.note === "string" ? entry.note : null,
		stems: String(entry.importPath ?? "").split(/[\s,]+/u).map(normalizeStem).filter(Boolean),
	}))).filter((entry) => typeof entry.category === "string" && typeof entry.slug === "string");
}

function catalogSummary(entry) {
	return {
		category: entry.category,
		slug: entry.slug,
		name: entry.name,
		status: entry.status,
		...(entry.basedOn ? { basedOn: entry.basedOn } : {}),
		...(entry.note ? { note: entry.note } : {}),
	};
}

// The owner's lifecycle comes from the catalog entry it is, preferring a non-live one when a
// stem is shared; a directory that only contains entries (or a non-catalog owner) has none.
function ownerLifecycle(owner, entries) {
	const own = entries.filter((entry) => entry.stems.includes(owner));
	const entry = own.find((candidate) => candidate.status !== DEFAULT_STATUS) ?? own[0];
	if (!entry) return { status: null, basedOn: null, note: null, warning: null };
	return { status: entry.status, basedOn: entry.basedOn, note: entry.note, warning: STATUS_WARNINGS[entry.status] ?? null };
}

// Reads repo-map pages with or without the optional primaryOwner field.
function wherePages(repoMap, repoRoot) {
	return (repoMap.appPages?.pages ?? []).filter((page) => typeof page.routePath === "string").map((page) => {
		const source = typeof page.source === "string"
			? toPosix(page.source)
			: `app${page.routePath === "/" ? "" : page.routePath}/page.tsx`;
		const primary = page.primaryOwner && typeof page.primaryOwner === "object" ? page.primaryOwner : null;
		const owners = new Set();
		for (const owner of [
			...(page.owners ?? []), ...(page.shellOwners ?? []),
			...(Array.isArray(primary?.sources) ? primary.sources : []),
			primary?.source, primary?.entry, primary?.demo,
		]) {
			const stem = normalizeStem(typeof owner === "string" ? owner : owner?.source ?? owner?.importPath ?? "");
			if (stem) owners.add(stem);
		}
		let demo = null;
		if (primary?.kind === "catalog") {
			demo = { category: primary.category, slug: primary.slug };
		} else if (!primary) {
			const match = DEMO_LOADER_CALL.exec(readText(path.join(repoRoot, source)));
			if (match) demo = { category: match[2], slug: match[1] };
		}
		const segments = page.routePath.split("/");
		const template = page.routePath === "/components/[category]/[slug]"
			? "doc"
			: segments.at(-1) === "[slug]" ? primary?.category ?? segments.at(-2) : null;
		return {
			demo,
			owners: [...owners],
			redirectTo: primary?.kind === "redirect" && typeof primary.to === "string" ? primary.to : null,
			route: page.routePath.replace(/\/\[\[\.\.\.[^\]]+\]\]$/u, "") || "/",
			routePath: page.routePath,
			source,
			template,
		};
	});
}

function catalogRoutes(entries, pages) {
	const routes = [];
	for (const entry of entries) {
		for (const page of pages) {
			if (page.template === "doc") {
				routes.push({ route: `/components/${entry.category}/${entry.slug}`, via: "doc", source: page.source });
			} else if (page.template === entry.category) {
				routes.push({ route: page.routePath.replace("[slug]", entry.slug), via: "template", source: page.source });
			} else if ((page.demo?.slug === entry.slug && page.demo?.category === entry.category)
				|| page.owners.some((owner) => entry.stems.some((stem) => isWithin(owner, stem)))) {
				routes.push({ route: page.route, via: "page", source: page.source });
			}
		}
	}
	return routes;
}

function pageRoute(page) {
	return { route: page.route, via: "page", source: page.source };
}

function uniqueRoutes(routes) {
	const byRoute = new Map();
	for (const route of [...routes].sort((a, b) => ROUTE_VIA_ORDER.indexOf(a.via) - ROUTE_VIA_ORDER.indexOf(b.via))) {
		if (!byRoute.has(route.route)) byRoute.set(route.route, { ...route, dynamic: route.route.includes("[") });
	}
	return [...byRoute.values()];
}

function catalogLabel(entry) {
	return `${entry.category}/${entry.slug}`;
}

// One level of `@/` importers outside the owner, mapped to their own routes.
function findImporters(owner, { catalogByStem, knownRoutes, pages, repoRoot, scanRoots }) {
	if (!owner?.startsWith("components/")) return { importers: [], unmappedFiles: 0 };
	const needle = `@/${owner}`;
	const byOwner = new Map();
	let unmappedFiles = 0;
	const accept = (name) => WHERE_SCAN_EXTENSION.test(name) && !WHERE_TEST_FILE.test(name);
	for (const root of scanRoots) {
		for (const file of walkFiles(path.join(repoRoot, root), accept)) {
			const stem = normalizeStem(path.relative(repoRoot, file));
			if (isWithin(stem, owner)) continue;
			const text = readText(file);
			if (!text.includes(needle)
				|| ![...text.matchAll(ALIAS_IMPORT)].some((match) => isWithin(normalizeStem(match[1]), owner))) continue;
			const ancestor = ancestorStems(stem).find((candidate) => catalogByStem.has(candidate));
			const key = ancestor ?? stem;
			if (!byOwner.has(key)) {
				const entries = ancestor ? catalogByStem.get(ancestor) : [];
				const routes = uniqueRoutes(entries.length
					? catalogRoutes(entries, pages)
					: pages.filter((page) => normalizeStem(page.source) === stem || page.owners.includes(stem)).map(pageRoute));
				byOwner.set(key, {
					owner: key,
					catalog: entries.map(catalogLabel),
					mapped: routes.length > 0,
					routes: routes.filter((route) => !knownRoutes.has(route.route)),
					files: 0,
				});
			}
			const importer = byOwner.get(key);
			importer.files += 1;
			if (!importer.mapped) unmappedFiles += 1;
		}
	}
	// Importers whose routes are already listed (e.g. the catalog demo wrapper) add nothing new.
	const importers = [...byOwner.values()]
		.filter((importer) => importer.routes.length > 0)
		.map(({ mapped: _mapped, ...importer }) => importer);
	return { importers: importers.sort((a, b) => a.owner.localeCompare(b.owner)), unmappedFiles };
}

function mentionPattern(terms, lookbehind) {
	if (terms.length === 0) return null;
	const alternation = [...terms].sort((a, b) => b.length - a.length).map(escapeRegExp).join("|");
	return new RegExp(`${lookbehind}(?:${alternation})(?![\\w-])`, "gu");
}

function scanMentions(files, patterns, repoRoot) {
	const results = [];
	for (const file of files) {
		const terms = new Set();
		const lines = [];
		readText(file).split("\n").forEach((line, index) => {
			let hit = false;
			for (const pattern of patterns) {
				for (const match of line.matchAll(pattern)) {
					terms.add(match[0]);
					hit = true;
				}
			}
			if (hit) lines.push(index + 1);
		});
		if (terms.size > 0) results.push({ file: toPosix(path.relative(repoRoot, file)), terms: [...terms], lines });
	}
	return results.sort((a, b) => a.file.localeCompare(b.file));
}

function fallbackOwner(stem) {
	const parts = stem.split("/");
	return parts[0] === "components" && parts.length >= 3 ? parts.slice(0, 3).join("/") : null;
}

function resolveWhere(input, {
	repoRoot = REPO_ROOT,
	featuresDir = path.join(repoRoot, ".agents/skills/vpk-verify/features"),
	repoMap = readRepoMap(repoRoot),
	scanRoots = ["components", "app"],
	testsDir = path.join(repoRoot, "tests"),
} = {}) {
	let raw = String(input ?? "").trim();
	if (!raw) throw usageError("where requires a path, slug, or route.", WHERE_USAGE);
	if (path.isAbsolute(raw) && isWithin(toPosix(raw), toPosix(repoRoot))) raw = toPosix(path.relative(repoRoot, raw));
	const catalog = whereCatalog(repoMap);
	const catalogByStem = new Map();
	for (const entry of catalog) {
		for (const stem of entry.stems) catalogByStem.set(stem, [...(catalogByStem.get(stem) ?? []), entry]);
	}
	const pages = wherePages(repoMap, repoRoot);
	const diskPath = path.join(repoRoot, raw);
	const exists = !raw.startsWith("/") && raw !== "" && fs.existsSync(diskPath);
	const slugMatches = catalog.filter((entry) => raw === entry.slug || raw === catalogLabel(entry));
	let kind;
	let entries = [];
	let owner = null;
	let routes = [];
	let stem = null;

	if (raw.startsWith("/")) {
		kind = "route";
		const pathname = raw.split(/[?#]/u)[0];
		const direct = pages.filter((page) => page.route === pathname);
		entries = catalog.filter((entry) => direct.some((page) => page.demo?.slug === entry.slug && page.demo?.category === entry.category)
			|| catalogRoutes([entry], pages).some((route) => route.route === pathname));
		routes = [...direct.map(pageRoute), ...catalogRoutes(entries, pages)];
		if (routes.length === 0) {
			throw usageError(`Unknown route: ${pathname}. Inspect .agents/knowledge/repo-map.json for mapped routes.`);
		}
		const directDir = direct[0] ? path.posix.dirname(direct[0].source) : "app";
		owner = entries[0]?.stems[0] ?? (directDir === "app" ? null : directDir);
	} else if (!exists && slugMatches.length > 0) {
		kind = "slug";
		entries = slugMatches;
		owner = entries[0].stems[0] ?? null;
		routes = catalogRoutes(entries, pages);
	} else if (exists || raw.includes("/")) {
		kind = "path";
		stem = normalizeStem(raw);
		const file = toPosix(raw).replace(/^\.\//u, "").replace(/\/+$/u, "");
		const isDir = exists && fs.statSync(diskPath).isDirectory();
		owner = ancestorStems(stem).find((candidate) => catalogByStem.has(candidate)) ?? null;
		if (owner) {
			entries = catalogByStem.get(owner);
		} else if (isDir) {
			entries = catalog.filter((entry) => entry.stems.some((entryStem) => isWithin(entryStem, stem)));
			if (entries.length > 0) owner = stem;
		}
		owner ??= fallbackOwner(stem);
		const pageDir = (page) => path.posix.dirname(page.source);
		routes = [
			...catalogRoutes(entries, pages),
			...pages.filter((page) => page.owners.some((pageOwner) => pageOwner === stem || isWithin(pageOwner, owner)
				|| (isDir && isWithin(pageOwner, stem)))
				|| page.source === file
				|| (isDir && isWithin(page.source, file))
				|| (!isDir && pageDir(page) !== "app" && isWithin(file, pageDir(page)))).map(pageRoute),
		];
	} else {
		throw usageError(`Unknown slug or path: ${raw}. Pass a repo path, a catalog slug (category/slug), or a /route.`);
	}

	for (const page of pages) {
		if (page.redirectTo && routes.some((route) => route.route === page.redirectTo)) {
			routes.push({ route: page.route, via: "redirect", source: page.source });
		}
	}
	routes = uniqueRoutes(routes);
	const knownRoutes = new Set(routes.map((route) => route.route));
	const { importers, unmappedFiles } = findImporters(owner, { catalogByStem, knownRoutes, pages, repoRoot, scanRoots });
	const routeTerms = [...new Set([...routes, ...importers.flatMap((importer) => importer.routes)]
		.map((route) => route.route)
		.filter((route) => route.length > 1 && !route.includes("[")))];
	const pathTerms = [...new Set([owner, stem, ...entries.flatMap((entry) => entry.stems)].filter(Boolean))];
	const patterns = [
		mentionPattern(routeTerms, "(?:(?<![\\w\\-./])|(?<=localhost)|(?<=:\\d{2,5}))"),
		mentionPattern(pathTerms, "(?<![\\w\\-])"),
	].filter(Boolean);
	const featureFiles = walkFiles(featuresDir, (name) => name.endsWith(".md"));
	const specFiles = walkFiles(testsDir, (name) => name.endsWith(".spec.ts"));
	// capture rejects landing pages, so only suggest object routes.
	const landing = new Set(["/", "/components", ...catalog.map((entry) => `/${entry.category}`)]);
	const capturable = routes.filter((route) => !route.dynamic && !landing.has(route.route));
	const primary = capturable.find((route) => route.via === "page") ?? capturable[0];
	return {
		input: String(input),
		kind,
		exists,
		owner,
		...ownerLifecycle(owner, entries),
		catalog: entries.map(catalogSummary),
		routes,
		importers,
		unmappedImporterFiles: unmappedFiles,
		features: patterns.length ? scanMentions(featureFiles, patterns, repoRoot) : [],
		specs: patterns.length ? scanMentions(specFiles, patterns, repoRoot) : [],
		capture: primary ? `control-vpk capture ${primary.route}` : null,
	};
}

function formatWhere(result) {
	const limited = (items, render) => {
		if (items.length === 0) return ["  (none)"];
		const shown = items.slice(0, WHERE_HUMAN_LIMIT).map(render);
		return items.length > WHERE_HUMAN_LIMIT ? [...shown, `  … ${items.length - WHERE_HUMAN_LIMIT} more (use --json)`] : shown;
	};
	const width = Math.max(0, ...result.routes.slice(0, WHERE_HUMAN_LIMIT).map((route) => route.route.length));
	const mention = (item) => {
		const lines = item.lines.slice(0, 6).join(",") + (item.lines.length > 6 ? ",…" : "");
		return `  ${item.file}:${lines}  ${item.terms.slice(0, 4).join(" ")}`;
	};
	const catalog = result.catalog.map(catalogLabel).join(", ");
	const status = result.status ? ` status=${result.status}${result.basedOn ? ` (based on ${result.basedOn})` : ""}` : "";
	return [
		`where ${result.input} (${result.kind}${result.kind === "path" && !result.exists ? ", not on disk" : ""})`,
		`owner   ${result.owner ?? "(none)"}${catalog ? ` [${catalog}]` : ""}${status}`,
		...(result.warning ? [`warning ${result.warning}`] : []),
		...(result.note ? [`note    ${result.note}`] : []),
		"routes",
		...limited(result.routes, (route) => `  ${route.route.padEnd(width)}  ${route.via.padEnd(8)}  ${route.source}`),
		`imported by${result.unmappedImporterFiles ? ` (+${plural(result.unmappedImporterFiles, "file")} with no mapped route)` : ""}`,
		...limited(result.importers, (importer) => `  ${importer.owner}${importer.catalog.length ? ` [${importer.catalog.join(", ")}]` : ""} (${plural(importer.files, "file")})  ${importer.routes.slice(0, 3).map((route) => route.route).join(" ")}`),
		"recipes",
		...limited(result.features, mention),
		"specs",
		...limited(result.specs, mention),
		...(result.capture ? [`next    ${result.capture}`] : []),
		"",
	].join("\n");
}

function whereCli(args, { resolve = resolveWhere, stdout = process.stdout } = {}) {
	const { flags, positional } = splitOptions(args, { booleanFlags: ["--json"], usageText: WHERE_USAGE, valueFlags: [] });
	if (positional.length !== 1) throw usageError("where requires exactly one path, slug, or route.", WHERE_USAGE);
	const result = resolve(positional[0]);
	stdout.write(flags["--json"] ? `${JSON.stringify(result, null, "\t")}\n` : formatWhere(result));
	return 0;
}

module.exports = {
	formatWhere,
	resolveWhere,
	whereCli,
};
