"use strict";

// Worktree origin discovery and exact object-route validation for browser entry.

const path = require("node:path");

const { usageError } = require("./cli.js");
const { FRONTEND_PORT_FILE, REPO_ROOT, readRepoMap, readTrimmed } = require("./repo.js");

const { loadPortlessRoutes, findPortlessUrl } = require(
	path.join(REPO_ROOT, "scripts/lib/portless-routes.js"),
);
const { resolvableRoutes, dynamicRouteMatchers } = require("../verify-feature-map.js");

function resolveOrigin(frontendPort) {
	if (!frontendPort) return "";
	const portlessUrl = findPortlessUrl(loadPortlessRoutes(), frontendPort);
	if (portlessUrl) return portlessUrl;
	return `http://127.0.0.1:${frontendPort}`;
}

function targetBrowserArguments(route, {
	headed = false,
	origin = resolveOrigin(readTrimmed(FRONTEND_PORT_FILE)),
	repoMap = readRepoMap(),
} = {}) {
	if (typeof route !== "string" || !route.startsWith("/") || route.startsWith("//")) {
		throw usageError("Target route must be an explicit repository path, not an external URL.");
	}
	const parsed = new URL(route, "https://target.invalid");
	if (parsed.pathname !== route.split(/[?#]/u)[0]) {
		throw usageError("Target route must not contain traversal or normalized path segments.");
	}
	const landingRoutes = new Set([
		"/", "/components",
		...(repoMap.components?.categories ?? []).map((entry) => `/${entry.category}`),
	]);
	if (landingRoutes.has(parsed.pathname)) {
		throw usageError("Object target must name a component or project, not a catalog landing page.");
	}
	if (!resolvableRoutes(repoMap).has(parsed.pathname)
		&& !dynamicRouteMatchers(repoMap).some((pattern) => pattern.test(parsed.pathname))) {
		throw usageError(`Unknown target route: ${parsed.pathname}. Inspect the generated repo map before opening an object.`);
	}
	if (!origin) throw usageError("No worktree origin. Run `control-vpk doctor` and repair this worktree's stack.");
	return ["open", ...(headed ? ["--headed"] : []), new URL(route, origin).href];
}

module.exports = {
	resolveOrigin,
	targetBrowserArguments,
};
