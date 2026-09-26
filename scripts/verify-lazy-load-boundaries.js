#!/usr/bin/env node

const { existsSync, readFileSync } = require("node:fs");
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
		entryFile: "components/projects/jira-golden-journeys-v2/page.tsx",
		reason: "the Jira pull request review subtree must stay out of the initial project bundle",
		targetFile: "components/blocks/jira-work-item/experimental-v2/components/pull-request-detail/pull-request-detail-view.tsx",
	},
	{
		entryFile: "components/projects/jira-golden-journeys-v2/page.tsx",
		reason: "the contextual pull request rail must stay out of the initial project bundle",
		targetFile: "components/blocks/jira-work-item/experimental-v2/components/pull-request-detail/pull-request-context-rail.tsx",
	},
	{
		entryFile: "components/projects/jira-golden-journeys-v3/page.tsx",
		reason: "the Jira pull request review subtree must stay out of the initial project bundle",
		targetFile: "components/blocks/jira-work-item/experimental-v3/components/pull-request-detail/pull-request-detail-view.tsx",
	},
	{
		entryFile: "components/projects/jira-golden-journeys-v3/page.tsx",
		reason: "the contextual pull request rail must stay out of the initial project bundle",
		targetFile: "components/blocks/jira-work-item/experimental-v3/components/pull-request-detail/pull-request-context-rail.tsx",
	},
{
		entryFile: "components/projects/jira-golden-journeys-v4/page.tsx",
		reason: "the Jira pull request review subtree must stay out of the initial project bundle",
		targetFile: "components/blocks/jira-work-item/experimental-v4/components/pull-request-detail/pull-request-detail-view.tsx",
	},
{
		entryFile: "components/projects/jira-golden-journeys-v4/page.tsx",
		reason: "the contextual pull request rail must stay out of the initial project bundle",
		targetFile: "components/blocks/jira-work-item/experimental-v4/components/pull-request-detail/pull-request-context-rail.tsx",
	},
];

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

function findStaticDependencyPath({ cwd, entryFile, targetFile }) {
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

		const absolutePath = path.join(cwd, normalizedFilePath);
		if (!existsSync(absolutePath)) {
			return null;
		}

		const moduleSpecifiers = collectRuntimeStaticModuleSpecifiers(
			readFileSync(absolutePath, "utf8"),
			normalizedFilePath,
		);
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

function verifyLazyLoadBoundaries({
	cwd = process.cwd(),
	deferredModuleRules = DEFAULT_DEFERRED_MODULE_RULES,
	heavyImportRules = DEFAULT_HEAVY_IMPORT_RULES,
	routeShellFiles = DEFAULT_ROUTE_SHELL_FILES,
} = {}) {
	const failures = [];

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
	if (failure.type === "deferred-module-statically-reachable") {
		return `${failure.filePath}: ${failure.targetFile} is statically reachable via ${failure.dependencyPath.join(" -> ")}; ${failure.reason}.`;
	}
	return `${failure.filePath}: unknown lazy-load boundary failure.`;
}

function printHelp() {
	console.log([
		"Usage: node scripts/verify-lazy-load-boundaries.js [--file app/page.tsx] [--heavy-import three] [--heavy-import @tiptap/*]",
		"",
		"Verifies named route shell files do not statically import heavyweight optional runtimes.",
		"Dynamic imports and type-only imports are allowed.",
	].join("\n"));
}

function main(argv = process.argv.slice(2), cwd = process.cwd()) {
	const options = parseArgs(argv);
	if (options.help) {
		printHelp();
		return;
	}

	const failures = verifyLazyLoadBoundaries({
		cwd,
		deferredModuleRules: DEFAULT_DEFERRED_MODULE_RULES,
		heavyImportRules: options.heavyImportRules,
		routeShellFiles: options.routeShellFiles,
	});

	if (failures.length === 0) {
		console.log(`Verified lazy-load boundaries (${options.routeShellFiles.length} route shells, ${options.heavyImportRules.length} heavy import rules, ${DEFAULT_DEFERRED_MODULE_RULES.length} deferred module rules)`);
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
	DEFAULT_HEAVY_IMPORT_RULES,
	DEFAULT_ROUTE_SHELL_FILES,
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
