#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const REQUIRED_SECTIONS = [
	"Sub-features",
	"How to get to it (user POV)",
	"Driving it with control-vpk",
	"Gotchas",
];

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const DEFAULT_FEATURES_DIR = path.join(REPO_ROOT, ".agents/skills/vpk-verify/features");
const DEFAULT_REPO_MAP_PATH = path.join(REPO_ROOT, ".agents/knowledge/repo-map.json");
const DEFAULT_PROJECTS_DIR = path.join(REPO_ROOT, "components/projects");
const UNCOVERED_PROJECTS_SECTION = "Uncovered projects";

/**
 * Directories under `components/projects/` that hold shared code, not a
 * user-facing project. None has a projects catalog entry or a route of its own,
 * so no recipe can cover them; they are verified through the projects that use them.
 */
const LIBRARY_PROJECT_DIRS = Object.freeze({
	"rovo-core": "Shared runtime behind /rovo and /studio (see its README); the /sandbox/screen-assistant page only imports a constant from it.",
	"rovo-floating-chat": "Floating chat component mounted by the shared project layout (components/projects/page.tsx); no route or catalog entry.",
	shared: "Cross-project components, hooks and lib; no project route (its Chat Configuration entry belongs to the blocks catalog).",
});

function sectionBody(content, heading) {
	const marker = `## ${heading}`;
	const start = content.indexOf(marker);
	if (start === -1) return "";
	const bodyStart = start + marker.length;
	const nextHeading = content.indexOf("\n## ", bodyStart);
	return content.slice(bodyStart, nextHeading === -1 ? content.length : nextHeading);
}

function indexedFeatureFiles(indexContent) {
	const featuresSection = sectionBody(indexContent, "Features");
	return [...featuresSection.matchAll(/\]\(\.\/([^)]+\.md)\)/gu)]
		.map((match) => match[1]);
}

function featureHeadings(content) {
	return [...content.matchAll(/^##\s+(.+)$/gmu)].map((match) => match[1].trim());
}

function subFeatureIds(content) {
	return [...sectionBody(content, "Sub-features").matchAll(/^-\s+`([^`]+)`/gmu)]
		.map((match) => match[1]);
}

function entryRoutes(content) {
	const routes = new Set();
	const entrySection = sectionBody(content, "How to get to it (user POV)");
	for (const match of entrySection.matchAll(/`([^`\n]+)`/gu)) {
		const code = match[1];
		if (code === "/") routes.add("/");
		for (const routeMatch of code.matchAll(/\/[A-Za-z0-9][A-Za-z0-9._~!$&()*+,;=:@%/-]*/gu)) {
			routes.add(routeMatch[0].replace(/[.,;:]$/u, ""));
		}
	}
	return [...routes].sort((left, right) => left.localeCompare(right));
}

function resolvableRoutes(repoMap) {
	const routes = new Set(["/"]);
	for (const page of repoMap.appPages?.pages ?? []) {
		if (typeof page.routePath !== "string") continue;
		if (!page.routePath.includes("[")) {
			routes.add(page.routePath);
			continue;
		}
		const optionalCatchAllIndex = page.routePath.indexOf("/[[...");
		if (optionalCatchAllIndex !== -1) {
			routes.add(page.routePath.slice(0, optionalCatchAllIndex) || "/");
		}
	}
	for (const categoryEntry of repoMap.components?.categories ?? []) {
		if (typeof categoryEntry.category === "string") {
			routes.add(`/${categoryEntry.category}`);
		}
		for (const component of categoryEntry.entries ?? []) {
			if (typeof component.category === "string" && typeof component.slug === "string") {
				routes.add(`/components/${component.category}/${component.slug}`);
			}
		}
	}
	return routes;
}

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function routePatternMatcher(routePath) {
	const segments = routePath.split("/").slice(1);
	const source = segments.map((segment) => {
		if (/^\[\[\.\.\.[^\]]+\]\]$/u.test(segment)) return "(?:/.*)?";
		if (/^\[\.\.\.[^\]]+\]$/u.test(segment)) return "/.+";
		if (/^\[[^\]]+\]$/u.test(segment)) return "/[^/]+";
		return `/${escapeRegExp(segment)}`;
	}).join("");
	return new RegExp(`^${source}$`, "u");
}

function dynamicRouteMatchers(repoMap) {
	return (repoMap.appPages?.pages ?? [])
		.map((page) => page.routePath)
		.filter((routePath) => (
			typeof routePath === "string" &&
			routePath.includes("[") &&
			routePath !== "/[category]" &&
			routePath !== "/components/[category]/[slug]"
		))
		.map(routePatternMatcher);
}

function projectDirectories(projectsDir) {
	return fs.readdirSync(projectsDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort((left, right) => left.localeCompare(right));
}

/** `- \`project\`: reason` lines in the index's Uncovered projects section. */
function uncoveredProjectEntries(indexContent) {
	return sectionBody(indexContent, UNCOVERED_PROJECTS_SECTION)
		.split("\n")
		.map((line) => line.match(/^-\s+`([^`]+)`\s*[:—–-]?\s*(.*)$/u))
		.filter(Boolean)
		.map((match) => ({ project: match[1], reason: (match[2] ?? "").trim() }));
}

function isProjectImport(importPath, project) {
	const base = `@/components/projects/${project}`;
	return importPath === base || (typeof importPath === "string" && importPath.startsWith(`${base}/`));
}

function isProjectSource(source, project) {
	const base = `components/projects/${project}`;
	return source === base || (typeof source === "string" && source.startsWith(`${base}/`));
}

/** Entries in the `projects` catalog category (a library dir may still host a block entry). */
function projectCatalogEntries(repoMap, project) {
	return (repoMap.components?.categories ?? [])
		.filter((categoryEntry) => categoryEntry.category === "projects")
		.flatMap((categoryEntry) => categoryEntry.entries ?? [])
		.filter((entry) => isProjectImport(entry.importPath, project));
}

/**
 * Live routes a user drives for a project: its catalog preview, app pages it
 * owns, and app pages whose first segment is its slug (routes that load the
 * project through the demo registry). The doc page alone is not coverage.
 */
function projectLiveRoutes(repoMap, project) {
	const catalogEntries = projectCatalogEntries(repoMap, project);
	const slugs = new Set([project, ...catalogEntries.map((entry) => entry.slug)]);
	const routes = new Set(catalogEntries
		.filter((entry) => typeof entry.slug === "string")
		.map((entry) => `/preview/projects/${entry.slug}`));
	for (const page of repoMap.appPages?.pages ?? []) {
		if (typeof page.routePath !== "string") continue;
		const owned = [...(page.owners ?? []), ...(page.shellOwners ?? [])]
			.some((owner) => isProjectSource(owner.source, project));
		if (owned || slugs.has(page.routePath.split("/")[1])) routes.add(page.routePath);
	}
	return [...routes].sort((left, right) => left.localeCompare(right));
}

function routeMatchesLiveRoute(route, liveRoute) {
	return route === liveRoute || (liveRoute.includes("[") && routePatternMatcher(liveRoute).test(route));
}

function verifyProjectCoverage({ indexContent, projectsDir, repoMap, routesByFile }) {
	const failures = [];
	const projects = { covered: [], excluded: [], uncovered: [] };
	for (const [project, reason] of Object.entries(LIBRARY_PROJECT_DIRS)) {
		if (projectCatalogEntries(repoMap, project).length > 0) {
			failures.push({
				file: "verify-feature-map.js",
				message: `Library exclusion ${project} now has a projects catalog entry; remove it from LIBRARY_PROJECT_DIRS (${reason}) and cover or list the project.`,
				type: "project-exclusion-invalid",
			});
		}
	}

	const allDirs = projectDirectories(projectsDir);
	projects.excluded = allDirs.filter((project) => Object.hasOwn(LIBRARY_PROJECT_DIRS, project));
	const projectDirs = allDirs.filter((project) => !Object.hasOwn(LIBRARY_PROJECT_DIRS, project));
	const coveringFiles = new Map(projectDirs.map((project) => {
		const liveRoutes = projectLiveRoutes(repoMap, project);
		const files = [...routesByFile]
			.filter(([, routes]) => routes.some((route) => liveRoutes.some((liveRoute) => routeMatchesLiveRoute(route, liveRoute))))
			.map(([file]) => file);
		return [project, { files, liveRoutes }];
	}));

	const listed = new Set();
	for (const entry of uncoveredProjectEntries(indexContent)) {
		if (listed.has(entry.project)) {
			failures.push({
				file: "README.md",
				message: `Uncovered project is listed more than once: ${entry.project}`,
				type: "uncovered-project-duplicate",
			});
			continue;
		}
		listed.add(entry.project);
		const coverage = coveringFiles.get(entry.project);
		if (!coverage) {
			failures.push({
				file: "README.md",
				message: `Uncovered entry ${entry.project} is not a project directory under components/projects/ (deleted, renamed, or a library exclusion); remove it from ## ${UNCOVERED_PROJECTS_SECTION}.`,
				type: "uncovered-project-stale",
			});
		} else if (coverage.files.length > 0) {
			failures.push({
				file: "README.md",
				message: `Uncovered entry ${entry.project} is now covered by ${coverage.files.join(", ")}; remove it from ## ${UNCOVERED_PROJECTS_SECTION}.`,
				type: "uncovered-project-stale",
			});
		} else if (!entry.reason) {
			failures.push({
				file: "README.md",
				message: `Uncovered entry ${entry.project} needs a one-line reason after the project name.`,
				type: "uncovered-project-reason-missing",
			});
		}
	}

	for (const [project, coverage] of coveringFiles) {
		if (coverage.files.length > 0) {
			projects.covered.push(project);
			continue;
		}
		projects.uncovered.push(project);
		if (listed.has(project)) continue;
		const routes = coverage.liveRoutes.length > 0 ? coverage.liveRoutes.join(", ") : "none found in the repo map";
		failures.push({
			file: `components/projects/${project}`,
			message: `Project has no feature recipe. Add one whose "How to get to it (user POV)" names a live route (${routes}), or list \`${project}\` with a one-line reason under ## ${UNCOVERED_PROJECTS_SECTION} in README.md.`,
			type: "project-coverage-missing",
		});
	}
	return { failures, projects };
}

function verifyFeatureMap({
	featuresDir = DEFAULT_FEATURES_DIR,
	projectsDir = DEFAULT_PROJECTS_DIR,
	repoMapPath = DEFAULT_REPO_MAP_PATH,
} = {}) {
	const failures = [];
	const indexPath = path.join(featuresDir, "README.md");
	const indexContent = fs.readFileSync(indexPath, "utf8");
	const indexedFiles = indexedFeatureFiles(indexContent);
	const actualFiles = fs.readdirSync(featuresDir)
		.filter((name) => name.endsWith(".md") && name !== "README.md")
		.sort((left, right) => left.localeCompare(right));
	const actualFileSet = new Set(actualFiles);
	const indexedFileSet = new Set(indexedFiles);
	const seenIndexFiles = new Set();

	for (const file of indexedFiles) {
		if (seenIndexFiles.has(file)) {
			failures.push({
				file: "README.md",
				message: `Feature is indexed more than once: ${file}`,
				type: "feature-index-duplicate",
			});
		}
		seenIndexFiles.add(file);
		if (!actualFileSet.has(file)) {
			failures.push({
				file: "README.md",
				message: `Indexed feature file does not exist: ${file}`,
				type: "feature-index-missing-file",
			});
		}
	}
	for (const file of actualFiles) {
		if (!indexedFileSet.has(file)) {
			failures.push({
				file,
				message: `Feature file is not listed in README.md: ${file}`,
				type: "feature-file-unindexed",
			});
		}
	}

	const repoMap = JSON.parse(fs.readFileSync(repoMapPath, "utf8"));
	const knownRoutes = resolvableRoutes(repoMap);
	const dynamicMatchers = dynamicRouteMatchers(repoMap);
	const allEntryRoutes = new Set();
	const routesByFile = new Map();
	const idOwners = new Map();
	let subFeatureCount = 0;

	for (const file of actualFiles) {
		const content = fs.readFileSync(path.join(featuresDir, file), "utf8");
		const headings = featureHeadings(content);
		if (
			headings.length !== REQUIRED_SECTIONS.length ||
			headings.some((heading, index) => heading !== REQUIRED_SECTIONS[index])
		) {
			failures.push({
				file,
				message: `Expected exactly these H2 sections in order: ${REQUIRED_SECTIONS.join("; ")}`,
				type: "feature-section-contract",
			});
		}

		const ids = subFeatureIds(content);
		subFeatureCount += ids.length;
		for (const id of ids) {
			const firstOwner = idOwners.get(id);
			if (firstOwner) {
				failures.push({
					file,
					message: `Sub-feature ID ${id} is already declared in ${firstOwner}`,
					type: "sub-feature-id-duplicate",
				});
			} else {
				idOwners.set(id, file);
			}
		}

		const routes = entryRoutes(content);
		routesByFile.set(file, routes);
		for (const route of routes) {
			allEntryRoutes.add(route);
			if (!knownRoutes.has(route) && !dynamicMatchers.some((pattern) => pattern.test(route))) {
				failures.push({
					file,
					message: `User-entry route is not present in the generated repo map: ${route}`,
					type: "feature-entry-route-unresolved",
				});
			}
		}
	}

	const coverage = verifyProjectCoverage({ indexContent, projectsDir, repoMap, routesByFile });
	failures.push(...coverage.failures);

	return {
		entryRoutes: [...allEntryRoutes].sort((left, right) => left.localeCompare(right)),
		failures,
		featureCount: actualFiles.length,
		ok: failures.length === 0,
		projects: coverage.projects,
		subFeatureCount,
	};
}

function printHelp() {
	process.stdout.write([
		"Usage: node .agents/skills/vpk-verify/scripts/verify-feature-map.js [--json]",
		"",
		"Checks the VPK verification-map index, feature structure, IDs, user-entry routes,",
		"and that every components/projects/ directory is covered by a recipe or listed",
		"under Uncovered projects in features/README.md.",
	].join("\n") + "\n");
}

function main(argv = process.argv.slice(2)) {
	if (argv.includes("--help") || argv.includes("-h")) {
		printHelp();
		return;
	}
	const unknown = argv.filter((arg) => arg !== "--json");
	if (unknown.length > 0) {
		throw new Error(`Unknown argument: ${unknown[0]}`);
	}
	const report = verifyFeatureMap();
	if (argv.includes("--json")) {
		process.stdout.write(`${JSON.stringify(report, null, "\t")}\n`);
	} else if (report.ok) {
		const { covered, uncovered } = report.projects;
		process.stdout.write(
			`Verified VPK feature map: ${report.featureCount} features, ${report.subFeatureCount} sub-features, ${report.entryRoutes.length} entry routes; ${covered.length}/${covered.length + uncovered.length} projects covered (${uncovered.length} listed uncovered).\n`,
		);
	} else {
		for (const failure of report.failures) {
			process.stderr.write(`${failure.file}: ${failure.message} [${failure.type}]\n`);
		}
	}
	if (!report.ok) process.exitCode = 1;
}

if (require.main === module) {
	try {
		main();
	} catch (error) {
		process.stderr.write(`${error.message}\n`);
		process.exitCode = 1;
	}
}

module.exports = {
	entryRoutes,
	dynamicRouteMatchers,
	indexedFeatureFiles,
	LIBRARY_PROJECT_DIRS,
	projectLiveRoutes,
	resolvableRoutes,
	sectionBody,
	uncoveredProjectEntries,
	verifyFeatureMap,
};
