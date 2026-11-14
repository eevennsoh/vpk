// Static parsing of the demo registry (components/website/registry/*): reads the category map
// in components/website/demo-registry-loader.ts, follows each table's imports and spreads, and
// resolves each entry's demo import.
// Shared by scripts/verify-component-catalog.js and scripts/generate-repo-map.js.

const { existsSync, readFileSync, statSync } = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const LOADER_PATH = "components/website/demo-registry-loader.ts";

function parseSource(filePath, cwd = process.cwd()) {
	const source = readFileSync(path.join(cwd, filePath), "utf8");
	return ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function getPropertyKey(propertyName) {
	if (!propertyName) {
		return null;
	}
	if (ts.isIdentifier(propertyName) || ts.isStringLiteral(propertyName) || ts.isNumericLiteral(propertyName)) {
		return propertyName.text;
	}
	return null;
}

function findVariableObjectLiterals(sourceFile) {
	const objectLiterals = new Map();

	function visit(node) {
		if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && ts.isObjectLiteralExpression(node.initializer)) {
			objectLiterals.set(node.name.text, node.initializer);
		}
		ts.forEachChild(node, visit);
	}

	visit(sourceFile);
	return objectLiterals;
}

function normalizeProjectPath(cwd, absolutePath) {
	return path.relative(cwd, absolutePath).split(path.sep).join("/");
}

function getImportModuleCandidates(absoluteBase) {
	return [
		absoluteBase,
		`${absoluteBase}.ts`,
		`${absoluteBase}.tsx`,
		`${absoluteBase}.js`,
		`${absoluteBase}.jsx`,
		path.join(absoluteBase, "index.ts"),
		path.join(absoluteBase, "index.tsx"),
		path.join(absoluteBase, "index.js"),
		path.join(absoluteBase, "index.jsx"),
	];
}

function resolveImportModule(sourceFilePath, importPath, cwd = process.cwd()) {
	if (!importPath.startsWith(".")) {
		return null;
	}

	const absoluteBase = path.resolve(cwd, path.dirname(sourceFilePath), importPath);
	const match = getImportModuleCandidates(absoluteBase).find((candidate) => {
		return existsSync(candidate) && statSync(candidate).isFile();
	});
	return match ? normalizeProjectPath(cwd, match) : null;
}

function findNamedImports(sourceFile, sourceFilePath, cwd = process.cwd()) {
	const imports = new Map();

	for (const statement of sourceFile.statements) {
		if (
			!ts.isImportDeclaration(statement) ||
			!ts.isStringLiteral(statement.moduleSpecifier) ||
			!statement.importClause?.namedBindings ||
			!ts.isNamedImports(statement.importClause.namedBindings)
		) {
			continue;
		}

		const importedFilePath = resolveImportModule(sourceFilePath, statement.moduleSpecifier.text, cwd);
		if (!importedFilePath) {
			continue;
		}

		for (const specifier of statement.importClause.namedBindings.elements) {
			imports.set(specifier.name.text, {
				importedName: specifier.propertyName?.text ?? specifier.name.text,
				sourceFile: importedFilePath,
			});
		}
	}

	return imports;
}

function findImportStrings(node, sourceFilePath) {
	const imports = [];

	function visit(child) {
		if (
			ts.isCallExpression(child) &&
			child.expression.kind === ts.SyntaxKind.ImportKeyword &&
			child.arguments.length === 1 &&
			ts.isStringLiteral(child.arguments[0])
		) {
			imports.push({
				importPath: child.arguments[0].text,
				sourceFile: sourceFilePath,
			});
		}
		ts.forEachChild(child, visit);
	}

	visit(node);
	return imports;
}

function collectRegistryEntriesFromObject(objectLiteral, sourceFilePath, cwd = process.cwd(), moduleCache = new Map(), seenObjects = new Set()) {
	const objectKey = `${sourceFilePath}:${objectLiteral.pos}:${objectLiteral.end}`;
	if (seenObjects.has(objectKey)) {
		throw new Error(`Circular registry map spread detected in ${sourceFilePath}`);
	}
	seenObjects.add(objectKey);

	const entries = {};
	for (const property of objectLiteral.properties) {
		if (!ts.isPropertyAssignment(property)) {
			if (ts.isSpreadAssignment(property) && ts.isIdentifier(property.expression)) {
				const moduleContext = getRegistryModule(sourceFilePath, cwd, moduleCache);
				const spreadObject = getObjectLiteralForInitializer(property.expression, moduleContext, cwd, moduleCache);
				if (!spreadObject) {
					throw new Error(`Could not resolve spread registry object ${property.expression.text} from ${sourceFilePath}`);
				}
				Object.assign(
					entries,
					collectRegistryEntriesFromObject(spreadObject.objectLiteral, spreadObject.sourceFile, cwd, moduleCache, seenObjects),
				);
			}
			continue;
		}

		const slug = getPropertyKey(property.name);
		if (!slug) {
			continue;
		}

		entries[slug] = {
			imports: findImportStrings(property.initializer, sourceFilePath),
		};
	}
	seenObjects.delete(objectKey);
	return entries;
}

function getRegistryModule(filePath, cwd = process.cwd(), moduleCache = new Map()) {
	if (moduleCache.has(filePath)) {
		return moduleCache.get(filePath);
	}

	const sourceFile = parseSource(filePath, cwd);
	const moduleContext = {
		filePath,
		imports: findNamedImports(sourceFile, filePath, cwd),
		objectLiterals: findVariableObjectLiterals(sourceFile),
		sourceFile,
	};
	moduleCache.set(filePath, moduleContext);
	return moduleContext;
}

function getObjectLiteralForInitializer(initializer, moduleContext, cwd = process.cwd(), moduleCache = new Map()) {
	if (ts.isObjectLiteralExpression(initializer)) {
		return {
			objectLiteral: initializer,
			sourceFile: moduleContext.filePath,
		};
	}
	if (ts.isIdentifier(initializer)) {
		const objectLiteral = moduleContext.objectLiterals.get(initializer.text);
		if (objectLiteral) {
			return {
				objectLiteral,
				sourceFile: moduleContext.filePath,
			};
		}

		const imported = moduleContext.imports.get(initializer.text);
		if (!imported) {
			return null;
		}

		const importedModule = getRegistryModule(imported.sourceFile, cwd, moduleCache);
		const importedObjectLiteral = importedModule.objectLiterals.get(imported.importedName);
		if (!importedObjectLiteral) {
			throw new Error(`Could not resolve imported registry object ${initializer.text} (${imported.importedName}) from ${imported.sourceFile}`);
		}

		return {
			objectLiteral: importedObjectLiteral,
			sourceFile: imported.sourceFile,
		};
	}
	return null;
}

function findVariableInitializer(sourceFile, name) {
	let initializer = null;

	function visit(node) {
		if (initializer) {
			return;
		}
		if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
			initializer = node.initializer ?? null;
			return;
		}
		ts.forEachChild(node, visit);
	}

	visit(sourceFile);
	return initializer;
}

// The per-category loader is the one place that maps a category to its tables:
// `category: () => import("@/components/website/registry/<file>").then((module) => ({ demos: module.X, variants: module.Y }))`.
function readLoaderTables(cwd = process.cwd()) {
	const sourceFile = parseSource(LOADER_PATH, cwd);
	const loaders = findVariableInitializer(sourceFile, "CATEGORY_REGISTRY_LOADERS");
	if (!loaders || !ts.isObjectLiteralExpression(loaders)) throw new Error(`Could not find CATEGORY_REGISTRY_LOADERS in ${LOADER_PATH}`);
	const tables = [];
	for (const property of loaders.properties) {
		if (!ts.isPropertyAssignment(property)) continue;
		const category = getPropertyKey(property.name);
		let importPath = null;
		const exportsByRole = {};
		const visit = (node) => {
			if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
				importPath = node.arguments[0].text;
			}
			if (ts.isPropertyAssignment(node) && ts.isPropertyAccessExpression(node.initializer)) {
				exportsByRole[getPropertyKey(node.name)] = node.initializer.name.text;
			}
			ts.forEachChild(node, visit);
		};
		visit(property.initializer);
		if (!category || !importPath || !exportsByRole.demos) throw new Error(`Could not read the ${category ?? "<unknown>"} loader in ${LOADER_PATH}`);
		const file = resolveProjectImport(importPath, cwd);
		if (!file) throw new Error(`${LOADER_PATH}: ${category} imports missing module ${importPath}`);
		tables.push({ category, demos: exportsByRole.demos, file: normalizeProjectPath(cwd, file), variants: exportsByRole.variants ?? null });
	}
	return tables;
}

function collectRegistryData(cwd = process.cwd()) {
	const moduleCache = new Map();
	const primary = {};
	const variants = {};
	for (const table of readLoaderTables(cwd)) {
		const moduleContext = getRegistryModule(table.file, cwd, moduleCache);
		for (const [role, name, target] of [["demos", table.demos, primary], ["variants", table.variants, variants]]) {
			if (!name) continue;
			const registryLiteral = getObjectLiteralForInitializer(ts.factory.createIdentifier(name), moduleContext, cwd, moduleCache);
			if (!registryLiteral) throw new Error(`Could not resolve ${table.category} ${role} table ${name} in ${table.file}`);
			target[table.category] = collectRegistryEntriesFromObject(registryLiteral.objectLiteral, registryLiteral.sourceFile, cwd, moduleCache);
		}
	}
	return { primary, variants };
}

// sourceFilePath: the repo-relative file the import appears in (every collected import carries it).
function resolveRegistryImport(importPath, cwd, sourceFilePath) {
	if (!importPath.startsWith(".")) {
		return null;
	}

	const absoluteBase = path.resolve(cwd, path.dirname(sourceFilePath), importPath);
	const candidates = [
		absoluteBase,
		`${absoluteBase}.tsx`,
		`${absoluteBase}.ts`,
		`${absoluteBase}.jsx`,
		`${absoluteBase}.js`,
		path.join(absoluteBase, "index.tsx"),
		path.join(absoluteBase, "index.ts"),
		path.join(absoluteBase, "index.jsx"),
		path.join(absoluteBase, "index.js"),
	];
	return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
}

function resolveProjectImport(importPath, cwd = process.cwd()) {
	if (!importPath.startsWith("@/")) {
		return null;
	}

	const absoluteBase = path.resolve(cwd, importPath.slice(2));
	return getImportModuleCandidates(absoluteBase).find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
}

module.exports = {
	collectRegistryData,
	normalizeProjectPath,
	resolveProjectImport,
	resolveRegistryImport,
};
