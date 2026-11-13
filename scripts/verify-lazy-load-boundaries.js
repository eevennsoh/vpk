#!/usr/bin/env node

const { existsSync, readdirSync, readFileSync } = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const SOURCE_MODULE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

const DEFAULT_ROUTE_SHELL_FILES = [
	"app/page.tsx",
	"app/components/layout.tsx",
	"app/components/[category]/[slug]/page.tsx",
	"app/visual/[slug]/page.tsx",
	"app/rovo/[[...id]]/page.tsx",
	"app/studio/[[...id]]/page.tsx",
];

const DEFAULT_DEFERRED_MODULE_RULES = [
	{
		entryFile: "components/projects/studio/components/rovo-app-shell.tsx",
		reason: "the Studio Ask Rovo chat panel must stay out of the initial project bundle",
		targetFile: "components/projects/sidebar-chat/page.tsx",
	},
	{
		entryFile: "components/projects/jira-golden-journey-v2/page.tsx",
		reason: "the Jira pull request review subtree must stay out of the initial project bundle",
		targetFile: "components/blocks/jira-work-item/experimental-v2/components/pull-request-detail/pull-request-detail-view.tsx",
	},
	{
		entryFile: "components/projects/jira-golden-journey-v2/page.tsx",
		reason: "the contextual pull request rail must stay out of the initial project bundle",
		targetFile: "components/blocks/jira-work-item/experimental-v2/components/pull-request-detail/pull-request-context-rail.tsx",
	},
	{
		entryFile: "components/projects/jira-golden-journey-v3/page.tsx",
		reason: "the Jira pull request review subtree must stay out of the initial project bundle",
		targetFile: "components/blocks/jira-work-item/experimental-v3/components/pull-request-detail/pull-request-detail-view.tsx",
	},
	{
		entryFile: "components/projects/jira-golden-journey-v3/page.tsx",
		reason: "the contextual pull request rail must stay out of the initial project bundle",
		targetFile: "components/blocks/jira-work-item/experimental-v3/components/pull-request-detail/pull-request-context-rail.tsx",
	},
{
		entryFile: "components/projects/jira-golden-journey-v4/page.tsx",
		reason: "the Jira pull request review subtree must stay out of the initial project bundle",
		targetFile: "components/blocks/jira-work-item/experimental-v3/components/pull-request-detail/pull-request-detail-view.tsx",
	},
{
		entryFile: "components/projects/jira-golden-journey-v4/page.tsx",
		reason: "the contextual pull request rail must stay out of the initial project bundle",
		targetFile: "components/blocks/jira-work-item/experimental-v3/components/pull-request-detail/pull-request-context-rail.tsx",
	},
];

// Modules that load only through a dynamic import (C-8a). No route entry (the shells above,
// every App Router page and every project's entry page) may reach them statically.
const DEFAULT_LAZY_ONLY_MODULES = [
	{
		reason: "the Excalidraw runtime and its stylesheet load when a scene first renders",
		targetFile: "components/projects/shared/components/excalidraw-runtime.ts",
	},
	{
		reason: "Leaflet and its stylesheet load with the map widget",
		targetFile: "lib/json-render/map-widget-canvas.tsx",
	},
];

// Imports with one owner (C-8a): a third-party stylesheet travels with the module that renders
// it, so it reaches only the routes that can render it. Applies to TS/JS imports and CSS @import.
const DEFAULT_SINGLE_OWNER_IMPORTS = [
	{
		ownerFile: "components/ui-custom/streamdown-math.ts",
		reason: "KaTeX CSS loads with the Streamdown math plugin",
		source: "katex/dist/katex.min.css",
	},
	{
		ownerFile: "components/ui-custom/streamdown-math.ts",
		reason: "importing the math plugin from components/ui-custom/streamdown-math brings KaTeX CSS with it",
		source: "@streamdown/math",
	},
	{
		ownerFile: "lib/json-render/map-widget-canvas.tsx",
		reason: "Leaflet CSS loads with the map widget",
		source: "leaflet/dist/leaflet.css",
	},
	{
		ownerFile: "components/projects/shared/components/excalidraw-runtime.css",
		reason: "Excalidraw CSS loads with the Excalidraw runtime",
		source: "@excalidraw/excalidraw/dist/prod/index.css",
	},
	{
		ownerFile: "components/projects/shared/components/excalidraw-runtime.css",
		reason: "Excalidraw CSS loads with the Excalidraw runtime",
		source: "@excalidraw/excalidraw/index.css",
	},
];

// Files that must not statically import a module family (C-8d).
const DEFAULT_FILE_IMPORT_RULES = [
	{
		filePath: "components/projects/shared/components/icon-registry.tsx",
		rules: [
			{ match: "prefix", reason: "registry icons load on first render through createLazyIcon", source: "@atlaskit/icon/" },
			{ match: "prefix", reason: "registry icons load on first render through createLazyIcon", source: "@atlaskit/icon-lab/" },
		],
	},
];

const SOURCE_ROOTS = ["app", "components", "hooks", "lib"];

const DEFAULT_HEAVY_IMPORT_RULES = [
	{
		match: "exact",
		source: "@basementstudio/shader-lab",
		reason: "shader demo runtime",
	},
	{
		match: "exact",
		source: "@excalidraw/excalidraw",
		reason: "canvas editor runtime",
	},
	{
		match: "exact",
		source: "@paper-design/shaders-react",
		reason: "shader demo runtime",
	},
	{
		match: "exact",
		source: "@react-three/drei",
		reason: "WebGL helper runtime",
	},
	{
		match: "exact",
		source: "@react-three/fiber",
		reason: "WebGL runtime",
	},
	{
		match: "exact",
		source: "@remotion/player",
		reason: "Remotion runtime",
	},
	{
		match: "exact",
		source: "@rive-app/react-webgl2",
		reason: "WebGL animation runtime",
	},
	{
		match: "exact",
		source: "@web-kits/audio",
		reason: "audio visualization runtime",
	},
	{
		match: "exact",
		source: "@xyflow/react",
		reason: "graph editor runtime",
	},
	{
		match: "exact",
		source: "leaflet",
		reason: "map runtime",
	},
	{
		match: "exact",
		source: "p5",
		reason: "creative-coding runtime",
	},
	{
		match: "exact",
		source: "react-leaflet",
		reason: "map runtime",
	},
	{
		match: "exact",
		source: "remotion",
		reason: "Remotion runtime",
	},
	{
		match: "exact",
		source: "shiki",
		reason: "syntax-highlighting runtime",
	},
	{
		match: "exact",
		source: "three",
		reason: "WebGL runtime",
	},
	{
		match: "prefix",
		source: "@tiptap/",
		reason: "rich-text editor runtime",
	},
	{
		match: "prefix",
		source: "d3-",
		reason: "data-visualization runtime",
	},
];

function parseArgs(argv = process.argv.slice(2)) {
	const routeShellFiles = [];
	const heavyImports = [];

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--file") {
			const value = argv[index + 1];
			if (!value) {
				throw new Error("--file requires a value.");
			}
			routeShellFiles.push(value);
			index += 1;
			continue;
		}
		if (arg.startsWith("--file=")) {
			routeShellFiles.push(arg.slice("--file=".length));
			continue;
		}
		if (arg === "--heavy-import") {
			const value = argv[index + 1];
			if (!value) {
				throw new Error("--heavy-import requires a value.");
			}
			heavyImports.push(createHeavyImportRule(value));
			index += 1;
			continue;
		}
		if (arg.startsWith("--heavy-import=")) {
			heavyImports.push(createHeavyImportRule(arg.slice("--heavy-import=".length)));
			continue;
		}
		if (arg === "--help" || arg === "-h") {
			return {
				help: true,
				heavyImportRules: DEFAULT_HEAVY_IMPORT_RULES,
				routeShellFiles: DEFAULT_ROUTE_SHELL_FILES,
			};
		}
		throw new Error(`Unknown argument: ${arg}`);
	}

	return {
		help: false,
		heavyImportRules: heavyImports.length > 0 ? heavyImports : DEFAULT_HEAVY_IMPORT_RULES,
		routeShellFiles: routeShellFiles.length > 0 ? routeShellFiles : DEFAULT_ROUTE_SHELL_FILES,
	};
}

function createHeavyImportRule(rawSource) {
	if (rawSource.endsWith("*")) {
		return {
			match: "prefix",
			reason: "configured heavy runtime",
			source: rawSource.slice(0, -1),
		};
	}

	return {
		match: "exact",
		reason: "configured heavy runtime",
		source: rawSource,
	};
}

function getRuleForImport(importPath, rules = DEFAULT_HEAVY_IMPORT_RULES) {
	return rules.find((rule) => {
		if (rule.match === "prefix") {
			return importPath.startsWith(rule.source);
		}
		return importPath === rule.source;
	}) ?? null;
}

function importDeclarationHasRuntimeBinding(statement) {
	const importClause = statement.importClause;
	if (!importClause) {
		return true;
	}
	if (importClause.isTypeOnly) {
		return false;
	}
	if (importClause.name) {
		return true;
	}
	if (!importClause.namedBindings) {
		return false;
	}
	if (ts.isNamespaceImport(importClause.namedBindings)) {
		return true;
	}
	if (ts.isNamedImports(importClause.namedBindings)) {
		return importClause.namedBindings.elements.some((element) => !element.isTypeOnly);
	}
	return true;
}

function exportDeclarationHasRuntimeBinding(statement) {
	if (statement.isTypeOnly) {
		return false;
	}
	if (!statement.exportClause) {
		return true;
	}
	if (ts.isNamespaceExport(statement.exportClause)) {
		return true;
	}
	if (ts.isNamedExports(statement.exportClause)) {
		return statement.exportClause.elements.some((element) => !element.isTypeOnly);
	}
	return true;
}

function getLineColumn(sourceFile, node) {
	const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
	return {
		column: position.character + 1,
		line: position.line + 1,
	};
}

function createViolation({ filePath, importPath, kind, node, rule, sourceFile }) {
	return {
		...getLineColumn(sourceFile, node),
		filePath,
		importPath,
		kind,
		reason: rule.reason,
		type: "heavy-static-import",
	};
}

function collectHeavyStaticImportsFromSource(source, filePath, rules = DEFAULT_HEAVY_IMPORT_RULES) {
	const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
	const violations = [];

	function visit(node) {
		if (
			ts.isImportDeclaration(node) &&
			ts.isStringLiteral(node.moduleSpecifier) &&
			importDeclarationHasRuntimeBinding(node)
		) {
			const rule = getRuleForImport(node.moduleSpecifier.text, rules);
			if (rule) {
				violations.push(createViolation({
					filePath,
					importPath: node.moduleSpecifier.text,
					kind: "import",
					node,
					rule,
					sourceFile,
				}));
			}
		}

		if (
			ts.isExportDeclaration(node) &&
			node.moduleSpecifier &&
			ts.isStringLiteral(node.moduleSpecifier) &&
			exportDeclarationHasRuntimeBinding(node)
		) {
			const rule = getRuleForImport(node.moduleSpecifier.text, rules);
			if (rule) {
				violations.push(createViolation({
					filePath,
					importPath: node.moduleSpecifier.text,
					kind: "export",
					node,
					rule,
					sourceFile,
				}));
			}
		}

		if (
			ts.isCallExpression(node) &&
			ts.isIdentifier(node.expression) &&
			node.expression.text === "require" &&
			node.arguments.length === 1 &&
			ts.isStringLiteral(node.arguments[0])
		) {
			const rule = getRuleForImport(node.arguments[0].text, rules);
			if (rule) {
				violations.push(createViolation({
					filePath,
					importPath: node.arguments[0].text,
					kind: "require",
					node,
					rule,
					sourceFile,
				}));
			}
		}

		ts.forEachChild(node, visit);
	}

	visit(sourceFile);
	return violations;
}

function collectRuntimeStaticModuleSpecifiers(source, filePath) {
	const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
	const moduleSpecifiers = [];

	function visit(node) {
		if (
			ts.isImportDeclaration(node)
			&& ts.isStringLiteral(node.moduleSpecifier)
			&& importDeclarationHasRuntimeBinding(node)
		) {
			moduleSpecifiers.push(node.moduleSpecifier.text);
		}

		if (
			ts.isExportDeclaration(node)
			&& node.moduleSpecifier
			&& ts.isStringLiteral(node.moduleSpecifier)
			&& exportDeclarationHasRuntimeBinding(node)
		) {
			moduleSpecifiers.push(node.moduleSpecifier.text);
		}

		if (
			ts.isCallExpression(node)
			&& ts.isIdentifier(node.expression)
			&& node.expression.text === "require"
			&& node.arguments.length === 1
			&& ts.isStringLiteral(node.arguments[0])
		) {
			moduleSpecifiers.push(node.arguments[0].text);
		}

		ts.forEachChild(node, visit);
	}

	visit(sourceFile);
	return moduleSpecifiers;
}

function resolveLocalModule(cwd, importerFile, moduleSpecifier) {
	let basePath;
	if (moduleSpecifier.startsWith("@/")) {
		basePath = path.join(cwd, moduleSpecifier.slice(2));
	} else if (moduleSpecifier.startsWith(".")) {
		basePath = path.resolve(path.dirname(path.join(cwd, importerFile)), moduleSpecifier);
	} else {
		return null;
	}

	const extension = path.extname(basePath);
	const candidates = extension
		? (SOURCE_MODULE_EXTENSIONS.includes(extension) ? [basePath] : [])
		: [
			...(SOURCE_MODULE_EXTENSIONS.map((suffix) => `${basePath}${suffix}`)),
			...(SOURCE_MODULE_EXTENSIONS.map((suffix) => path.join(basePath, `index${suffix}`))),
		];

	const resolvedPath = candidates.find((candidate) => existsSync(candidate));
	return resolvedPath ? path.relative(cwd, resolvedPath) : null;
}

function findStaticDependencyPath({ cwd, entryFile, readSpecifiers = createSpecifierReader(cwd), targetFile }) {
	const normalizedTarget = path.normalize(targetFile);
	const visited = new Set();

	function visit(filePath, dependencyPath) {
		const normalizedFilePath = path.normalize(filePath);
		if (normalizedFilePath === normalizedTarget) {
			return dependencyPath;
		}
		if (visited.has(normalizedFilePath)) {
			return null;
		}
		visited.add(normalizedFilePath);

		if (!existsSync(path.join(cwd, normalizedFilePath))) {
			return null;
		}

		const moduleSpecifiers = readSpecifiers(normalizedFilePath);
		for (const moduleSpecifier of moduleSpecifiers) {
			const resolvedPath = resolveLocalModule(cwd, normalizedFilePath, moduleSpecifier);
			if (!resolvedPath) {
				continue;
			}
			const result = visit(resolvedPath, [...dependencyPath, resolvedPath]);
			if (result) {
				return result;
			}
		}

		return null;
	}

	return visit(entryFile, [entryFile]);
}

function walkSourceTree(cwd, roots, include) {
	const files = [];
	for (const root of roots) {
		const absoluteRoot = path.join(cwd, root);
		if (!existsSync(absoluteRoot)) {
			continue;
		}
		for (const entry of readdirSync(absoluteRoot, { recursive: true, withFileTypes: true })) {
			if (!entry.isFile()) {
				continue;
			}
			const relativePath = path.relative(cwd, path.join(entry.parentPath, entry.name));
			if (relativePath.split(path.sep).includes("node_modules") || !include(relativePath)) {
				continue;
			}
			files.push(relativePath.split(path.sep).join("/"));
		}
	}
	return files.sort();
}

// Every App Router page plus every project's entry page, so a new route or project is guarded
// without editing a list.
function discoverRouteEntryFiles(cwd = process.cwd()) {
	const appPages = walkSourceTree(cwd, ["app"], (filePath) => /(^|\/)page\.(tsx|ts|jsx|js)$/u.test(filePath) && !filePath.startsWith(`app${path.sep}api${path.sep}`));
	const projectEntries = walkSourceTree(cwd, ["components/projects"], (filePath) => /^components\/projects\/[^/]+\/page\.tsx$/u.test(filePath.split(path.sep).join("/")));
	return [...new Set([...appPages, ...projectEntries])].sort();
}

function createSpecifierReader(cwd) {
	const cache = new Map();
	return (filePath) => {
		if (!cache.has(filePath)) {
			const absolutePath = path.join(cwd, filePath);
			cache.set(filePath, existsSync(absolutePath)
				? collectRuntimeStaticModuleSpecifiers(readFileSync(absolutePath, "utf8"), filePath)
				: []);
		}
		return cache.get(filePath);
	};
}

// Breadth-first walk of an entry's static imports; returns the shortest path to each target reached.
function findStaticDependencyPaths({ cwd, entryFile, readSpecifiers = createSpecifierReader(cwd), targetFiles }) {
	const targets = new Set(targetFiles.map((targetFile) => path.normalize(targetFile)));
	const previous = new Map([[path.normalize(entryFile), null]]);
	const queue = [path.normalize(entryFile)];
	const found = new Map();
	while (queue.length > 0 && found.size < targets.size) {
		const filePath = queue.shift();
		if (targets.has(filePath) && !found.has(filePath)) {
			const chain = [];
			for (let cursor = filePath; cursor !== null; cursor = previous.get(cursor)) {
				chain.unshift(cursor);
			}
			found.set(filePath, chain);
		}
		for (const moduleSpecifier of readSpecifiers(filePath)) {
			const resolvedPath = resolveLocalModule(cwd, filePath, moduleSpecifier);
			if (resolvedPath && !previous.has(path.normalize(resolvedPath))) {
				previous.set(path.normalize(resolvedPath), filePath);
				queue.push(path.normalize(resolvedPath));
			}
		}
	}
	return found;
}

function collectCssImports(source) {
	return [...source.matchAll(/@import\s+(?:url\(\s*)?["']([^"']+)["']/gu)].map((match) => match[1]);
}

function cssImportMatches(importPath, source) {
	return importPath === source || importPath.endsWith(`node_modules/${source}`);
}

function verifySingleOwnerImports({ cwd, rules }) {
	const failures = [];
	const sourceFiles = walkSourceTree(cwd, SOURCE_ROOTS, (filePath) => SOURCE_MODULE_EXTENSIONS.includes(path.extname(filePath)) || filePath.endsWith(".css"));
	for (const filePath of sourceFiles) {
		const source = readFileSync(path.join(cwd, filePath), "utf8");
		const candidateRules = rules.filter((rule) => source.includes(rule.source));
		if (candidateRules.length === 0) {
			continue;
		}
		const importPaths = filePath.endsWith(".css")
			? collectCssImports(source)
			: collectRuntimeStaticModuleSpecifiers(source, filePath);
		for (const rule of candidateRules) {
			if (filePath === rule.ownerFile) {
				continue;
			}
			const importPath = importPaths.find((candidate) => (filePath.endsWith(".css") ? cssImportMatches(candidate, rule.source) : candidate === rule.source));
			if (importPath) {
				failures.push({ filePath, importPath, ownerFile: rule.ownerFile, reason: rule.reason, type: "single-owner-import" });
			}
		}
	}
	return failures;
}

function verifyLazyLoadBoundaries({
	cwd = process.cwd(),
	deferredModuleRules = DEFAULT_DEFERRED_MODULE_RULES,
	fileImportRules = DEFAULT_FILE_IMPORT_RULES,
	heavyImportRules = DEFAULT_HEAVY_IMPORT_RULES,
	lazyOnlyModules = DEFAULT_LAZY_ONLY_MODULES,
	routeShellFiles = DEFAULT_ROUTE_SHELL_FILES,
	singleOwnerImports = DEFAULT_SINGLE_OWNER_IMPORTS,
} = {}) {
	const failures = [];
	const readSpecifiers = createSpecifierReader(cwd);

	for (const filePath of routeShellFiles) {
		const absolutePath = path.join(cwd, filePath);
		if (!existsSync(absolutePath)) {
			failures.push({
				filePath,
				type: "missing-route-shell",
			});
			continue;
		}

		failures.push(...collectHeavyStaticImportsFromSource(
			readFileSync(absolutePath, "utf8"),
			filePath,
			heavyImportRules,
		));
	}

	for (const rule of deferredModuleRules) {
		if (!existsSync(path.join(cwd, rule.entryFile))) {
			failures.push({
				filePath: rule.entryFile,
				type: "missing-deferred-entry",
			});
			continue;
		}
		if (!existsSync(path.join(cwd, rule.targetFile))) {
			failures.push({
				filePath: rule.targetFile,
				type: "missing-deferred-target",
			});
			continue;
		}

		const dependencyPath = findStaticDependencyPath({
			cwd,
			entryFile: rule.entryFile,
			readSpecifiers,
			targetFile: rule.targetFile,
		});
		if (dependencyPath) {
			failures.push({
				dependencyPath,
				filePath: rule.entryFile,
				reason: rule.reason,
				targetFile: rule.targetFile,
				type: "deferred-module-statically-reachable",
			});
		}
	}

	for (const rule of lazyOnlyModules) {
		if (!existsSync(path.join(cwd, rule.targetFile))) {
			failures.push({ filePath: rule.targetFile, type: "missing-deferred-target" });
		}
	}
	const presentLazyOnlyModules = lazyOnlyModules.filter((rule) => existsSync(path.join(cwd, rule.targetFile)));
	if (presentLazyOnlyModules.length > 0) {
		for (const entryFile of routeShellFiles.filter((filePath) => existsSync(path.join(cwd, filePath)))) {
			const reached = findStaticDependencyPaths({
				cwd,
				entryFile,
				readSpecifiers,
				targetFiles: presentLazyOnlyModules.map((rule) => rule.targetFile),
			});
			for (const rule of presentLazyOnlyModules) {
				const dependencyPath = reached.get(path.normalize(rule.targetFile));
				if (dependencyPath) {
					failures.push({
						dependencyPath,
						filePath: entryFile,
						reason: rule.reason,
						targetFile: rule.targetFile,
						type: "deferred-module-statically-reachable",
					});
				}
			}
		}
	}

	for (const { filePath, rules } of fileImportRules) {
		const absolutePath = path.join(cwd, filePath);
		if (!existsSync(absolutePath)) {
			failures.push({ filePath, type: "missing-guarded-file" });
			continue;
		}
		failures.push(...collectHeavyStaticImportsFromSource(readFileSync(absolutePath, "utf8"), filePath, rules)
			.map((failure) => ({ ...failure, type: "file-static-import" })));
	}

	failures.push(...verifySingleOwnerImports({ cwd, rules: singleOwnerImports }));

	return failures;
}

function formatFailure(failure) {
	if (failure.type === "missing-route-shell") {
		return `${failure.filePath}: configured route shell does not exist.`;
	}
	if (failure.type === "heavy-static-import") {
		return `${failure.filePath}:${failure.line}:${failure.column}: ${failure.kind} of "${failure.importPath}" pulls ${failure.reason} into a route shell. Use a route-owned dynamic import or move it behind the feature/demo boundary.`;
	}
	if (failure.type === "missing-deferred-entry") {
		return `${failure.filePath}: configured deferred-module entry does not exist.`;
	}
	if (failure.type === "missing-deferred-target") {
		return `${failure.filePath}: configured deferred module does not exist.`;
	}
	if (failure.type === "missing-guarded-file") {
		return `${failure.filePath}: configured guarded file does not exist.`;
	}
	if (failure.type === "file-static-import") {
		return `${failure.filePath}:${failure.line}:${failure.column}: ${failure.kind} of "${failure.importPath}" is not allowed here: ${failure.reason}.`;
	}
	if (failure.type === "single-owner-import") {
		return `${failure.filePath}: imports "${failure.importPath}", which only ${failure.ownerFile} may import (${failure.reason}). Import from the owner instead.`;
	}
	if (failure.type === "deferred-module-statically-reachable") {
		return `${failure.filePath}: ${failure.targetFile} is statically reachable via ${failure.dependencyPath.join(" -> ")}; ${failure.reason}.`;
	}
	return `${failure.filePath}: unknown lazy-load boundary failure.`;
}

function printHelp() {
	console.log([
		"Usage: node scripts/verify-lazy-load-boundaries.js [--file app/page.tsx] [--heavy-import three] [--heavy-import @tiptap/*]",
		"",
		"Verifies route entries (the default shells, every app page and every project entry page) do not",
		"statically import heavyweight optional runtimes or reach lazy-only modules, that third-party",
		"stylesheets are imported only by their owner, and that the icon registry imports no icon statically.",
		"Dynamic imports and type-only imports are allowed.",
	].join("\n"));
}

function main(argv = process.argv.slice(2), cwd = process.cwd()) {
	const options = parseArgs(argv);
	if (options.help) {
		printHelp();
		return;
	}

	const routeShellFiles = options.routeShellFiles === DEFAULT_ROUTE_SHELL_FILES
		? [...new Set([...DEFAULT_ROUTE_SHELL_FILES, ...discoverRouteEntryFiles(cwd)])]
		: options.routeShellFiles;
	const failures = verifyLazyLoadBoundaries({
		cwd,
		deferredModuleRules: DEFAULT_DEFERRED_MODULE_RULES,
		heavyImportRules: options.heavyImportRules,
		routeShellFiles,
	});

	if (failures.length === 0) {
		console.log(`Verified lazy-load boundaries (${routeShellFiles.length} route entries, ${options.heavyImportRules.length} heavy import rules, ${DEFAULT_DEFERRED_MODULE_RULES.length + DEFAULT_LAZY_ONLY_MODULES.length} deferred module rules, ${DEFAULT_SINGLE_OWNER_IMPORTS.length} single-owner imports, ${DEFAULT_FILE_IMPORT_RULES.length} file import rules)`);
		return;
	}

	console.error("Lazy-load boundary failed:");
	for (const failure of failures) {
		console.error(`- ${formatFailure(failure)}`);
	}
	process.exitCode = 1;
}

if (require.main === module) {
	main();
}

module.exports = {
	DEFAULT_DEFERRED_MODULE_RULES,
	DEFAULT_FILE_IMPORT_RULES,
	DEFAULT_HEAVY_IMPORT_RULES,
	DEFAULT_LAZY_ONLY_MODULES,
	DEFAULT_ROUTE_SHELL_FILES,
	DEFAULT_SINGLE_OWNER_IMPORTS,
	discoverRouteEntryFiles,
	findStaticDependencyPaths,
	collectHeavyStaticImportsFromSource,
	collectRuntimeStaticModuleSpecifiers,
	createHeavyImportRule,
	findStaticDependencyPath,
	formatFailure,
	getRuleForImport,
	importDeclarationHasRuntimeBinding,
	parseArgs,
	verifyLazyLoadBoundaries,
};
