// Static parsing of the demo registry (components/website/registry*): follows the
// category maps, their imports and spreads, and resolves each entry's demo import.
// Shared by scripts/verify-component-catalog.js and scripts/generate-repo-map.js.

const { existsSync, readFileSync, statSync } = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const REGISTRY_PATH = "components/website/registry.ts";
const REGISTRY_INDEX_PATH = "components/website/registry/index.ts";

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

function getRegistryEntryPath(cwd = process.cwd()) {
	const registrySource = parseSource(REGISTRY_PATH, cwd);
	if (
		findVariableInitializer(registrySource, "CATEGORY_REGISTRIES") &&
		findVariableInitializer(registrySource, "VARIANT_REGISTRIES")
	) {
		return REGISTRY_PATH;
	}

	if (existsSync(path.join(cwd, REGISTRY_INDEX_PATH))) {
		return REGISTRY_INDEX_PATH;
	}

	return REGISTRY_PATH;
}

function getRegistryObject(moduleContext, name, cwd = process.cwd(), moduleCache = new Map()) {
	let registryObject = null;

	function visit(node) {
		if (registryObject) {
			return;
		}
		if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
			registryObject = ts.isObjectLiteralExpression(node.initializer) ? node.initializer : null;
			return;
		}
		ts.forEachChild(node, visit);
	}

	visit(moduleContext.sourceFile);
	if (!registryObject) {
		throw new Error(`Could not find ${name} in ${moduleContext.filePath}`);
	}

	const registries = {};
	for (const property of registryObject.properties) {
		if (!ts.isPropertyAssignment(property)) {
			continue;
		}

		const category = getPropertyKey(property.name);
		const registryLiteral = getObjectLiteralForInitializer(property.initializer, moduleContext, cwd, moduleCache);
		if (!category || !registryLiteral) {
			throw new Error(`Could not resolve ${name}.${category ?? "<unknown>"} in ${moduleContext.filePath}`);
		}

		registries[category] = collectRegistryEntriesFromObject(registryLiteral.objectLiteral, registryLiteral.sourceFile, cwd, moduleCache);
	}

	return registries;
}

function collectRegistryData(cwd = process.cwd()) {
	const moduleCache = new Map();
	const registryEntryPath = getRegistryEntryPath(cwd);
	const moduleContext = getRegistryModule(registryEntryPath, cwd, moduleCache);
	return {
		primary: getRegistryObject(moduleContext, "CATEGORY_REGISTRIES", cwd, moduleCache),
		variants: getRegistryObject(moduleContext, "VARIANT_REGISTRIES", cwd, moduleCache),
	};
}

function resolveRegistryImport(importPath, cwd = process.cwd(), sourceFilePath = REGISTRY_PATH) {
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
	REGISTRY_PATH,
	collectRegistryData,
	normalizeProjectPath,
	resolveProjectImport,
	resolveRegistryImport,
};
