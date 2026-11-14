#!/usr/bin/env node

const { existsSync, readdirSync, readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const {
	LOCAL_NEXT_API_ROUTES,
	PROXY_HELPER_BYPASS_ALLOWLIST,
	PROXY_TARGET_FANOUT_EXCEPTIONS,
	SERVER_ROUTE_FILES,
} = require("./route-manifest-config");

const HTTP_METHODS = new Set(["delete", "get", "patch", "post", "put"]);
const MANIFEST_PATH = path.join(__dirname, "route-manifest.json");
const ROUTE_REGISTRAR_NAME_PATTERN = /^register[A-Z].*Routes$/u;

function parseSource(filePath, source) {
	const scriptKind = filePath.endsWith(".ts") || filePath.endsWith(".tsx")
		? ts.ScriptKind.TS
		: ts.ScriptKind.JS;
	return ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, scriptKind);
}

// `source` is the file only, never a line: a line number would change every entry below
// any edit, so unrelated PRs would rewrite (and collide on) the generated files. To find
// a handler, search its file for the route string.

function readProjectFile(cwd, filePath) {
	return readFileSync(path.join(cwd, filePath), "utf8");
}

function getStringValue(node) {
	if (!node) {
		return null;
	}
	if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
		return node.text;
	}
	return null;
}

function hasIdentifier(node, identifierName) {
	if (ts.isIdentifier(node) && node.text === identifierName) {
		return true;
	}

	let found = false;
	ts.forEachChild(node, (child) => {
		if (!found && hasIdentifier(child, identifierName)) {
			found = true;
		}
	});
	return found;
}

function getPropertyNameText(name) {
	if (!name) {
		return null;
	}
	if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
		return name.text;
	}
	return null;
}

function getObjectProperty(objectExpression, propertyName) {
	return objectExpression.properties.find((property) => {
		return ts.isPropertyAssignment(property) && getPropertyNameText(property.name) === propertyName;
	});
}

function isModuleExportsExpression(node) {
	return (
		ts.isPropertyAccessExpression(node) &&
		ts.isIdentifier(node.expression) &&
		node.expression.text === "module" &&
		node.name.text === "exports"
	);
}

function isExportsPropertyExpression(node) {
	if (!ts.isPropertyAccessExpression(node)) {
		return false;
	}
	if (ts.isIdentifier(node.expression) && node.expression.text === "exports") {
		return true;
	}
	return isModuleExportsExpression(node.expression);
}

function getExportedRegistrarNameFromExpression(expression) {
	if (!expression) {
		return null;
	}
	if (ts.isIdentifier(expression) && ROUTE_REGISTRAR_NAME_PATTERN.test(expression.text)) {
		return expression.text;
	}
	if (
		(ts.isFunctionExpression(expression) || ts.isArrowFunction(expression)) &&
		expression.name &&
		ROUTE_REGISTRAR_NAME_PATTERN.test(expression.name.text)
	) {
		return expression.name.text;
	}
	return null;
}

function collectExportedRouteRegistrarNames(sourceFile) {
	const registrarNames = new Set();

	function addObjectLiteralExports(objectExpression) {
		for (const property of objectExpression.properties) {
			if (ts.isShorthandPropertyAssignment(property)) {
				const registrarName = getExportedRegistrarNameFromExpression(property.name);
				if (registrarName) {
					registrarNames.add(registrarName);
				}
				continue;
			}

			if (!ts.isPropertyAssignment(property)) {
				continue;
			}

			const propertyName = getPropertyNameText(property.name);
			const registrarName = ROUTE_REGISTRAR_NAME_PATTERN.test(propertyName ?? "")
				? propertyName
				: getExportedRegistrarNameFromExpression(property.initializer);
			if (registrarName) {
				registrarNames.add(registrarName);
			}
		}
	}

	function visit(node) {
		if (
			ts.isBinaryExpression(node) &&
			node.operatorToken.kind === ts.SyntaxKind.EqualsToken
		) {
			if (isModuleExportsExpression(node.left) && ts.isObjectLiteralExpression(node.right)) {
				addObjectLiteralExports(node.right);
			}

			if (isExportsPropertyExpression(node.left)) {
				const propertyName = getPropertyNameText(node.left.name);
				const registrarName = ROUTE_REGISTRAR_NAME_PATTERN.test(propertyName ?? "")
					? propertyName
					: getExportedRegistrarNameFromExpression(node.right);
				if (registrarName) {
					registrarNames.add(registrarName);
				}
			}
		}

		ts.forEachChild(node, visit);
	}

	visit(sourceFile);
	return [...registrarNames].sort();
}

function findUnregisteredServerRouteRegistrars(cwd = process.cwd()) {
	const configuredRouteFiles = new Set(
		SERVER_ROUTE_FILES
			.map((routeFile) => routeFile.filePath)
			.filter((filePath) => filePath.startsWith("backend/routes/")),
	);
	const routesDir = path.join(cwd, "backend/routes");
	return readdirSync(routesDir, { withFileTypes: true })
		.filter((dirent) => dirent.isFile() && dirent.name.endsWith(".js"))
		.map((dirent) => `backend/routes/${dirent.name}`)
		.map((filePath) => {
			const sourceText = readProjectFile(cwd, filePath);
			const sourceFile = parseSource(filePath, sourceText);
			return {
				filePath,
				registrars: collectExportedRouteRegistrarNames(sourceFile),
			};
		})
		.filter((routeFile) => {
			return routeFile.registrars.length > 0 && !configuredRouteFiles.has(routeFile.filePath);
		});
}

function joinRoutePath(prefix, routePath) {
	if (!prefix) {
		return routePath;
	}
	if (routePath === "/") {
		return prefix;
	}
	return `${prefix}${routePath.startsWith("/") ? "" : "/"}${routePath}`;
}

function collectRuntimeAdminPrefixes(sourceFile) {
	const prefixes = [];

	function visit(node) {
		if (
			ts.isCallExpression(node) &&
			ts.isPropertyAccessExpression(node.expression) &&
			ts.isIdentifier(node.expression.expression) &&
			node.expression.expression.text === "app" &&
			node.expression.name.text === "use" &&
			hasIdentifier(node, "requireRuntimeAdmin")
		) {
			const routePath = getStringValue(node.arguments[0]);
			if (routePath) {
				prefixes.push(routePath);
			}
		}
		ts.forEachChild(node, visit);
	}

	visit(sourceFile);
	return prefixes;
}

function isRuntimeAdminRoute(routePath, node, runtimeAdminPrefixes) {
	if (hasIdentifier(node, "requireRuntimeAdmin")) {
		return true;
	}
	return runtimeAdminPrefixes.some((prefix) => {
		return routePath === prefix || routePath.startsWith(`${prefix}/`);
	});
}

function collectExpressRoutesFromSource(sourceFile, sourcePath, {
	calleeName,
	prefix = "",
	runtimeAdminPrefixes = [],
} = {}) {
	const routes = [];

	function visit(node) {
		if (
			ts.isCallExpression(node) &&
			ts.isPropertyAccessExpression(node.expression) &&
			ts.isIdentifier(node.expression.expression) &&
			node.expression.expression.text === calleeName
		) {
			const method = node.expression.name.text;
			const routePath = getStringValue(node.arguments[0]);
			if (HTTP_METHODS.has(method) && routePath && routePath.startsWith("/")) {
				const fullPath = joinRoutePath(prefix, routePath);
				if (!fullPath.startsWith("/api/") && fullPath !== "/healthcheck") {
					ts.forEachChild(node, visit);
					return;
				}

				routes.push({
					method: method.toUpperCase(),
					path: fullPath,
					runtimeAdmin: isRuntimeAdminRoute(fullPath, node, runtimeAdminPrefixes),
					source: sourcePath,
				});
			}
		}

		ts.forEachChild(node, visit);
	}

	visit(sourceFile);
	return routes;
}

function uniqueSortedRoutes(routes) {
	const routeByKey = new Map();
	for (const route of routes) {
		const key = `${route.method} ${route.path}`;
		if (!routeByKey.has(key)) {
			routeByKey.set(key, route);
		}
	}
	return [...routeByKey.values()].sort((a, b) => {
		return `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`);
	});
}

function collectBackendRoutes(cwd = process.cwd()) {
	const runtimeAdminPrefixes = [];
	for (const routeFile of SERVER_ROUTE_FILES) {
		const sourceText = readProjectFile(cwd, routeFile.filePath);
		const sourceFile = parseSource(routeFile.filePath, sourceText);
		runtimeAdminPrefixes.push(...collectRuntimeAdminPrefixes(sourceFile));
	}
	const routes = [];

	for (const routeFile of SERVER_ROUTE_FILES) {
		const sourceText = readProjectFile(cwd, routeFile.filePath);
		const sourceFile = parseSource(routeFile.filePath, sourceText);
		routes.push(...collectExpressRoutesFromSource(sourceFile, routeFile.filePath, {
			calleeName: routeFile.calleeName,
			prefix: routeFile.prefix,
			runtimeAdminPrefixes,
		}));
	}

	return uniqueSortedRoutes(routes);
}

function listRouteFiles(rootDir, routeFiles = []) {
	for (const dirent of readdirSync(rootDir, { withFileTypes: true })) {
		const absolutePath = path.join(rootDir, dirent.name);
		if (dirent.isDirectory()) {
			listRouteFiles(absolutePath, routeFiles);
			continue;
		}
		if (dirent.isFile() && dirent.name === "route.ts") {
			routeFiles.push(absolutePath);
		}
	}
	return routeFiles;
}

function getRouteContext(relativeRouteFile) {
	const routeRoot = "app/api/";
	const routePath = relativeRouteFile
		.slice(routeRoot.length, -"/route.ts".length)
		.split("/")
		.filter(Boolean);
	const dynamicParams = [];
	const catchAllParams = [];
	const nextSegments = routePath.map((segment) => {
		const catchAllMatch = segment.match(/^\[\.\.\.(.+)\]$/u);
		if (catchAllMatch) {
			catchAllParams.push(catchAllMatch[1]);
			return `*${catchAllMatch[1]}`;
		}

		const dynamicMatch = segment.match(/^\[(.+)\]$/u);
		if (dynamicMatch) {
			dynamicParams.push(dynamicMatch[1]);
			return `:${dynamicMatch[1]}`;
		}

		return segment;
	});

	return {
		catchAllParams,
		dynamicParams,
		nextPath: `/api/${nextSegments.join("/")}`,
		relativeRouteFile,
	};
}

function lowerFirst(value) {
	return value ? `${value[0].toLowerCase()}${value.slice(1)}` : value;
}

function getExpressionPlaceholder(expression, context) {
	if (ts.isCallExpression(expression)) {
		const callee = expression.expression;
		if (
			ts.isIdentifier(callee) &&
			callee.text === "encodeURIComponent" &&
			expression.arguments.length > 0
		) {
			return getExpressionPlaceholder(expression.arguments[0], context);
		}
		return "";
	}

	if (ts.isIdentifier(expression)) {
		const name = expression.text;
		if (["query", "queryString", "search"].includes(name)) {
			return "";
		}
		if (context.dynamicParams.includes(name)) {
			return `:${name}`;
		}
		if (context.catchAllParams.includes(name)) {
			return `*${name}`;
		}
		if (name.startsWith("encoded")) {
			const decodedName = lowerFirst(name.slice("encoded".length));
			if (context.dynamicParams.includes(decodedName)) {
				return `:${decodedName}`;
			}
			if (context.catchAllParams.includes(decodedName)) {
				return `*${decodedName}`;
			}
			return `*${decodedName}`;
		}
		return `:${name}`;
	}

	if (
		ts.isPropertyAccessExpression(expression) ||
		ts.isConditionalExpression(expression) ||
		ts.isTemplateExpression(expression)
	) {
		return "";
	}

	return "";
}

function stripQuery(pathValue) {
	return pathValue.split("?")[0];
}

function normalizeBackendTargetPath(pathValue) {
	return stripQuery(pathValue).replace(/\/+$/u, "") || "/";
}

function getRouteKey(route) {
	return `${route.method} ${route.path ?? route.nextPath}`;
}

function getConcreteRoutePath(routePath) {
	return routePath
		.replace(/:([A-Za-z0-9_]+)/gu, "__$1__")
		.replace(/\*([A-Za-z0-9_]+)/gu, "__$1__");
}

function getExpressRouterStack(appOrRouter) {
	return appOrRouter?.router?.stack ?? appOrRouter?._router?.stack ?? appOrRouter?.stack ?? [];
}

function matchExpressLayer(layer, pathname) {
	if (Array.isArray(layer.matchers)) {
		for (const matcher of layer.matchers) {
			const match = matcher(pathname);
			if (match) {
				return match;
			}
		}
	}

	if (typeof layer.match === "function") {
		return layer.match(pathname) ? { path: layer.path ?? pathname } : false;
	}

	return false;
}

function expressRouteLayerSupportsMethod(layer, method) {
	const methodKey = method.toLowerCase();
	return Boolean(layer.route?.methods?.[methodKey]);
}

function normalizeExpressRemainder(pathname, matchedPath) {
	if (!matchedPath || matchedPath === "/") {
		return pathname;
	}

	const remainder = pathname.slice(matchedPath.length);
	if (!remainder) {
		return "/";
	}
	return remainder.startsWith("/") ? remainder : `/${remainder}`;
}

function runtimeStackHasRoute(stack, route) {
	const concretePath = getConcreteRoutePath(route.path);

	function visit(layers, pathname) {
		for (const layer of layers) {
			if (layer.route) {
				if (
					expressRouteLayerSupportsMethod(layer, route.method) &&
					matchExpressLayer(layer, pathname)
				) {
					return true;
				}
				continue;
			}

			const childStack = getExpressRouterStack(layer.handle);
			if (childStack.length === 0) {
				continue;
			}

			const match = matchExpressLayer(layer, pathname);
			if (!match) {
				continue;
			}

			if (visit(childStack, normalizeExpressRemainder(pathname, match.path))) {
				return true;
			}
		}
		return false;
	}

	return visit(stack, concretePath);
}

function collectRuntimeRouteStackRoutes(appOrRouter, candidateRoutes) {
	const stack = getExpressRouterStack(appOrRouter);
	return uniqueSortedRoutes(candidateRoutes
		.filter((route) => runtimeStackHasRoute(stack, route))
		.map((route) => ({
			method: route.method,
			path: route.path,
			runtimeAdmin: route.runtimeAdmin,
			source: "runtime-route-stack",
		})));
}

function extractPathsFromExpression(expression, context) {
	if (!expression) {
		return [];
	}

	if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
		return [normalizeBackendTargetPath(expression.text)];
	}

	if (ts.isTemplateExpression(expression)) {
		let pathValue = expression.head.text;
		for (const span of expression.templateSpans) {
			pathValue += getExpressionPlaceholder(span.expression, context);
			pathValue += span.literal.text;
		}
		return [normalizeBackendTargetPath(pathValue)];
	}

	if (ts.isConditionalExpression(expression)) {
		return [
			...extractPathsFromExpression(expression.whenTrue, context),
			...extractPathsFromExpression(expression.whenFalse, context),
		];
	}

	if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression)) {
		return extractPathsFromExpression(expression.expression, context);
	}

	return [];
}

function isGetBackendUrlCall(expression) {
	return (
		ts.isCallExpression(expression) &&
		ts.isIdentifier(expression.expression) &&
		expression.expression.text === "getBackendUrl"
	);
}

function getRouteLikeTextFromFetchArgument(expression, context) {
	if (!expression) {
		return null;
	}

	if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
		return expression.text;
	}

	if (ts.isTemplateExpression(expression)) {
		let pathValue = expression.head.text;
		for (const span of expression.templateSpans) {
			pathValue += getExpressionPlaceholder(span.expression, context);
			pathValue += span.literal.text;
		}
		return pathValue;
	}

	if (
		ts.isBinaryExpression(expression) &&
		expression.operatorToken.kind === ts.SyntaxKind.PlusToken
	) {
		const left = getRouteLikeTextFromFetchArgument(expression.left, context);
		const right = getRouteLikeTextFromFetchArgument(expression.right, context);
		if (left === null || right === null) {
			return null;
		}
		return `${left}${right}`;
	}

	if (isGetBackendUrlCall(expression)) {
		return "";
	}

	if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression)) {
		return getRouteLikeTextFromFetchArgument(expression.expression, context);
	}

	return null;
}

function extractBackendFetchPathsFromExpression(expression, context) {
	if (!expression) {
		return [];
	}

	if (
		ts.isNewExpression(expression) &&
		ts.isIdentifier(expression.expression) &&
		expression.expression.text === "URL" &&
		expression.arguments?.length
	) {
		return extractBackendFetchPathsFromExpression(expression.arguments[0], context);
	}

	const pathValue = getRouteLikeTextFromFetchArgument(expression, context);
	if (pathValue === null) {
		return [];
	}

	if (!pathValue.startsWith("/api/")) {
		return [];
	}

	return [normalizeBackendTargetPath(pathValue)];
}

function getProxyTargetMethod(callExpression, exportedMethod) {
	if (callExpression.arguments.length === 0 || !ts.isObjectLiteralExpression(callExpression.arguments[0])) {
		return exportedMethod;
	}

	const methodProperty = getObjectProperty(callExpression.arguments[0], "method");
	const method = methodProperty ? getStringValue(methodProperty.initializer) : null;
	return method?.toUpperCase() ?? exportedMethod;
}

function getFetchTargetMethod(callExpression, exportedMethod) {
	const options = callExpression.arguments[1];
	if (!options || !ts.isObjectLiteralExpression(options)) {
		return exportedMethod;
	}

	const methodProperty = getObjectProperty(options, "method");
	const method = methodProperty ? getStringValue(methodProperty.initializer) : null;
	return method?.toUpperCase() ?? exportedMethod;
}

function collectProxyTargets(functionNode, sourceFile, context, exportedMethod) {
	const targets = [];

	function addTargets(callExpression, method, pathExpression) {
		for (const targetPath of extractPathsFromExpression(pathExpression, context)) {
			if (!targetPath.startsWith("/api/")) {
				continue;
			}
			targets.push({
				method,
				path: targetPath,
				source: context.relativeRouteFile,
			});
		}
	}

	function visit(node) {
		if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
			if (node.expression.text === "proxyToBackend") {
				const options = node.arguments[0];
				if (options && ts.isObjectLiteralExpression(options)) {
					const method = getProxyTargetMethod(node, exportedMethod);
					const pathProperty = getObjectProperty(options, "path");
					if (pathProperty) {
						addTargets(node, method, pathProperty.initializer);
					}
				}
			}

			if (node.expression.text === "fetchBackend") {
				const methodOptions = node.arguments[1];
				let method = exportedMethod;
				if (methodOptions && ts.isObjectLiteralExpression(methodOptions)) {
					const methodProperty = getObjectProperty(methodOptions, "method");
					method = getStringValue(methodProperty?.initializer)?.toUpperCase() ?? exportedMethod;
				}
				addTargets(node, method, node.arguments[0]);
			}

			if (/^proxy[A-Z]/u.test(node.expression.text)) {
				for (const argument of node.arguments) {
					addTargets(node, exportedMethod, argument);
				}
			}
		}

		ts.forEachChild(node, visit);
	}

	visit(functionNode);
	return targets;
}

function collectProxyHelperBypasses(functionNode, sourceFile, context, exportedMethod) {
	const bypasses = [];

	function visit(node) {
		if (
			ts.isCallExpression(node) &&
			ts.isIdentifier(node.expression) &&
			node.expression.text === "fetch"
		) {
			const method = getFetchTargetMethod(node, exportedMethod);
			for (const targetPath of extractBackendFetchPathsFromExpression(node.arguments[0], context)) {
				bypasses.push({
					method,
					path: targetPath,
					source: context.relativeRouteFile,
				});
			}
		}

		ts.forEachChild(node, visit);
	}

	visit(functionNode);
	return bypasses;
}

function isExportedFunction(node) {
	return Boolean(node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
}

function collectNextRouteEntries(cwd = process.cwd()) {
	const apiRoot = path.join(cwd, "app/api");
	const routeFiles = listRouteFiles(apiRoot)
		.map((absolutePath) => path.relative(cwd, absolutePath))
		.sort();
	const entries = [];

	for (const relativeRouteFile of routeFiles) {
		const context = getRouteContext(relativeRouteFile);
		const sourceText = readProjectFile(cwd, relativeRouteFile);
		const sourceFile = parseSource(relativeRouteFile, sourceText);

		function visit(node) {
			if (
				ts.isFunctionDeclaration(node) &&
				isExportedFunction(node) &&
				node.name &&
				HTTP_METHODS.has(node.name.text.toLowerCase())
			) {
				const method = node.name.text.toUpperCase();
				const proxyHelperBypasses = uniqueSortedRoutes(collectProxyHelperBypasses(node, sourceFile, context, method));
				const entry = {
					method,
					nextPath: context.nextPath,
					source: relativeRouteFile,
					targets: uniqueSortedRoutes(collectProxyTargets(node, sourceFile, context, method)),
				};
				if (proxyHelperBypasses.length > 0) {
					entry.proxyHelperBypasses = proxyHelperBypasses;
				}
				entries.push(entry);
			}
			ts.forEachChild(node, visit);
		}

		visit(sourceFile);
	}

	return entries.sort((a, b) => {
		return `${a.nextPath} ${a.method}`.localeCompare(`${b.nextPath} ${b.method}`);
	});
}

function collectRouteManifest(cwd = process.cwd()) {
	return {
		version: 1,
		backendRoutes: collectBackendRoutes(cwd),
		nextApiRoutes: collectNextRouteEntries(cwd),
	};
}

function readRouteManifest(filePath = MANIFEST_PATH) {
	if (!existsSync(filePath)) {
		return null;
	}
	return JSON.parse(readFileSync(filePath, "utf8"));
}

function getProxyTargetFanoutException(nextRouteKey, targetKey) {
	return PROXY_TARGET_FANOUT_EXCEPTIONS.find((exception) => {
		return exception.nextRoute === nextRouteKey && exception.target === targetKey;
	});
}

function getProxyHelperBypassAllowlistReason(nextRouteKey, targetKey) {
	return PROXY_HELPER_BYPASS_ALLOWLIST.get(`${nextRouteKey} -> ${targetKey}`) ?? null;
}

function findProxyTargetParityFailures(manifest) {
	const backendRouteKeys = new Set(manifest.backendRoutes.map((route) => `${route.method} ${route.path}`));
	const failures = [];
	for (const route of manifest.nextApiRoutes) {
		const nextRouteKey = getRouteKey(route);
		const proxyHelperBypasses = route.proxyHelperBypasses ?? [];
		for (const bypass of proxyHelperBypasses) {
			const targetKey = getRouteKey(bypass);
			const allowlistReason = getProxyHelperBypassAllowlistReason(nextRouteKey, targetKey);
			if (allowlistReason) {
				continue;
			}

			failures.push({
				nextRoute: nextRouteKey,
				source: bypass.source,
				target: targetKey,
				type: "route-proxy-helper-bypass",
			});
		}

		if (route.targets.length === 0) {
			if (proxyHelperBypasses.length > 0) {
				continue;
			}

			if (!LOCAL_NEXT_API_ROUTES.has(nextRouteKey)) {
				failures.push({
					nextRoute: nextRouteKey,
					source: route.source,
					type: "unclassified-local-next-route",
				});
			}
			continue;
		}

		for (const target of route.targets) {
			const targetKey = getRouteKey(target);
			if (backendRouteKeys.has(targetKey)) {
				continue;
			}

			const exception = getProxyTargetFanoutException(nextRouteKey, targetKey);
			if (exception) {
				const missingBackingTargets = exception.backedBy.filter((backingTarget) => !backendRouteKeys.has(backingTarget));
				if (missingBackingTargets.length === 0) {
					continue;
				}
				failures.push({
					missingBackingTargets,
					nextRoute: nextRouteKey,
					reason: exception.reason,
					source: target.source,
					target: targetKey,
					type: "incomplete-proxy-target-fanout",
				});
				continue;
			}

			failures.push({
				nextRoute: nextRouteKey,
				source: target.source,
				target: targetKey,
				type: "unbacked-proxy-target",
			});
		}
	}
	return failures;
}

function formatProxyTargetParityFailure(failure) {
	if (failure.type === "route-proxy-helper-bypass") {
		return `${failure.nextRoute} directly fetches ${failure.target}; use proxyToBackend/fetchBackend or add a PROXY_HELPER_BYPASS_ALLOWLIST reason (${failure.source})`;
	}
	if (failure.type === "unclassified-local-next-route") {
		return `${failure.nextRoute} has no backend proxy target and is not listed in LOCAL_NEXT_API_ROUTES (${failure.source})`;
	}
	if (failure.type === "incomplete-proxy-target-fanout") {
		return `${failure.nextRoute} -> ${failure.target} is an explicit fan-out exception, but these backing routes are missing: ${failure.missingBackingTargets.join(", ")} (${failure.source})`;
	}
	return `${failure.nextRoute} -> ${failure.target} (${failure.source})`;
}

function main() {
	const unregisteredRouteRegistrars = findUnregisteredServerRouteRegistrars();
	if (unregisteredRouteRegistrars.length > 0) {
		console.error("backend/routes files export route registrars missing from SERVER_ROUTE_FILES:");
		for (const routeFile of unregisteredRouteRegistrars) {
			console.error(`- ${routeFile.filePath}: ${routeFile.registrars.join(", ")}`);
		}
		process.exitCode = 1;
		return;
	}

	if (process.argv.includes("--update")) {
		const manifest = collectRouteManifest();
		writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, "\t")}\n`);
		console.log(`Updated ${path.relative(process.cwd(), MANIFEST_PATH)} with ${manifest.backendRoutes.length} backend routes and ${manifest.nextApiRoutes.length} Next API routes.`);
		return;
	}

	const manifest = collectRouteManifest();
	const checkedInManifest = readRouteManifest();
	if (!checkedInManifest) {
		console.error("Missing backend/routes/route-manifest.json. Run `node backend/routes/route-manifest.js --update`.");
		process.exitCode = 1;
		return;
	}

	if (JSON.stringify(manifest) !== JSON.stringify(checkedInManifest)) {
		console.error("Route manifest is stale. Run `node backend/routes/route-manifest.js --update` and review the route diff.");
		process.exitCode = 1;
		return;
	}

	const proxyTargetParityFailures = findProxyTargetParityFailures(manifest);
	if (proxyTargetParityFailures.length > 0) {
		console.error("Next API route manifest parity failed:");
		for (const failure of proxyTargetParityFailures) {
			console.error(`- ${formatProxyTargetParityFailure(failure)}`);
		}
		process.exitCode = 1;
		return;
	}

	console.log("Verified backend/Next API route manifest");
}

if (require.main === module) {
	main();
}

module.exports = {
	collectBackendRoutes,
	collectExportedRouteRegistrarNames,
	collectNextRouteEntries,
	collectProxyHelperBypasses,
	collectRuntimeRouteStackRoutes,
	collectRouteManifest,
	extractPathsFromExpression,
	findProxyTargetParityFailures,
	findUnregisteredServerRouteRegistrars,
	formatProxyTargetParityFailure,
	getConcreteRoutePath,
	getRouteContext,
	normalizeBackendTargetPath,
	readRouteManifest,
};
