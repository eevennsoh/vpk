// App Router page discovery for the repo map: each app/**/page.tsx, the local modules it
// imports, and its primaryOwner (catalog entry, redirect, rendered shell, or inline page).
// Catalog owners carry the entry's lifecycle fields. Used by scripts/generate-repo-map.js.

const { existsSync, readFileSync, readdirSync } = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { resolveProjectImport, resolveRegistryImport } = require("./component-registry");
const { DEFAULT_LIFECYCLE_STATUS } = require("../verify-component-catalog");

const COMPONENT_MANIFEST_ENTRY = "app/data/component-manifest.ts";
const APP_DIR = "app";
const REDIRECT_MODULE = "next/navigation";
// Catalog-backed page shells: module -> exported loader -> where its slug/category arguments live.
const CATALOG_LOADERS = {
	"app/preview/_shared/render-preview-category-page": {
		RenderPreviewCategoryPage: { categoryProp: "category", slugProp: "slug" },
	},
	"components/website/demo-registry-loader": {
		loadDemoComponent: { categoryArgument: 1, slugArgument: 0 },
	},
};

function compareStrings(left, right) {
	if (left < right) {
		return -1;
	}
	if (left > right) {
		return 1;
	}
	return 0;
}

function toPosixPath(filePath) {
	return filePath.split(path.sep).join("/");
}

function walkFiles(rootDir) {
	if (!existsSync(rootDir)) {
		return [];
	}

	const entries = [];
	for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
		const entryPath = path.join(rootDir, entry.name);
		if (entry.isDirectory()) {
			entries.push(...walkFiles(entryPath));
			continue;
		}
		if (entry.isFile()) {
			entries.push(entryPath);
		}
	}
	return entries;
}

// Lifecycle fields from the manifest: status always (omitted means live), basedOn/note when set.
function getLifecycleFields(component, { includeNote = true } = {}) {
	return {
		status: component.status ?? DEFAULT_LIFECYCLE_STATUS,
		...(typeof component.basedOn === "string" ? { basedOn: component.basedOn } : {}),
		...(includeNote && typeof component.note === "string" ? { note: component.note } : {}),
	};
}

function routePathFromPageFile(filePath, appDir = APP_DIR) {
	const relativePath = toPosixPath(path.relative(appDir, filePath));
	const routePart = relativePath.replace(/\/?page\.tsx$/u, "");
	if (!routePart) {
		return "/";
	}

	const visibleSegments = routePart
		.split("/")
		.filter((segment) => !(segment.startsWith("(") && segment.endsWith(")")));
	return `/${visibleSegments.join("/")}`.replace(/\/+$/u, "") || "/";
}

function getImportSymbols(importClause) {
	if (!importClause) {
		return [];
	}

	const symbols = [];
	if (importClause.name) {
		symbols.push(importClause.name.text);
	}
	if (importClause.namedBindings && ts.isNamespaceImport(importClause.namedBindings)) {
		symbols.push(importClause.namedBindings.name.text);
	}
	if (importClause.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
		for (const element of importClause.namedBindings.elements) {
			symbols.push(element.name.text);
		}
	}
	return [...new Set(symbols)].sort(compareStrings);
}

function collectJsxIdentifiers(sourceFile) {
	const identifiers = new Set();

	function addJsxTagName(tagName) {
		if (ts.isIdentifier(tagName)) {
			if (/^[A-Z]/u.test(tagName.text)) {
				identifiers.add(tagName.text);
			}
			return;
		}
		if (ts.isPropertyAccessExpression(tagName) && /^[A-Z]/u.test(tagName.getText(sourceFile))) {
			identifiers.add(tagName.getText(sourceFile));
		}
	}

	function visit(node) {
		if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
			addJsxTagName(node.tagName);
		}
		ts.forEachChild(node, visit);
	}

	visit(sourceFile);
	return identifiers;
}

function normalizeLocalImportSource({ importPath, sourceFilePath }) {
	if (importPath.startsWith("@/")) {
		return importPath.slice(2);
	}
	if (!importPath.startsWith(".")) {
		return null;
	}

	return toPosixPath(path.normalize(path.join(path.dirname(sourceFilePath), importPath)));
}

function isAppPageOwnerImport(source) {
	return (
		source.startsWith("app/") ||
		source.startsWith("components/")
	);
}

function getStringLiteralValue(node) {
	if (node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))) {
		return node.text;
	}
	return null;
}

function collectPageBindings(sourceFile, sourceFilePath) {
	const loaders = new Map();
	const redirects = new Set();
	for (const statement of sourceFile.statements) {
		const namedBindings = ts.isImportDeclaration(statement) ? statement.importClause?.namedBindings : null;
		if (!namedBindings || !ts.isNamedImports(namedBindings) || !ts.isStringLiteral(statement.moduleSpecifier)) {
			continue;
		}
		const importPath = statement.moduleSpecifier.text;
		const moduleLoaders = CATALOG_LOADERS[normalizeLocalImportSource({ importPath, sourceFilePath }) ?? ""];
		for (const element of namedBindings.elements) {
			const importedName = element.propertyName?.text ?? element.name.text;
			if (importPath === REDIRECT_MODULE && importedName === "redirect") {
				redirects.add(element.name.text);
			}
			if (moduleLoaders && Object.hasOwn(moduleLoaders, importedName)) {
				loaders.set(element.name.text, { loader: importedName, ...moduleLoaders[importedName] });
			}
		}
	}
	return { loaders, redirects };
}

function readJsxStringProp(attributes, name) {
	for (const attribute of attributes.properties) {
		if (!ts.isJsxAttribute(attribute) || !ts.isIdentifier(attribute.name) || attribute.name.text !== name) {
			continue;
		}
		if (attribute.initializer && ts.isJsxExpression(attribute.initializer)) {
			return getStringLiteralValue(attribute.initializer.expression);
		}
		return getStringLiteralValue(attribute.initializer);
	}
	return null;
}

function collectPageSignals(sourceFile, bindings) {
	const catalogReferences = [];
	const redirectTargets = new Set();
	let hasJsx = false;

	function visit(node) {
		if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) {
			hasJsx = true;
		}
		if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
			const loader = bindings.loaders.get(node.expression.text);
			if (loader && typeof loader.slugArgument === "number") {
				catalogReferences.push({
					category: getStringLiteralValue(node.arguments[loader.categoryArgument]),
					loader: loader.loader,
					slug: getStringLiteralValue(node.arguments[loader.slugArgument]),
				});
			}
			const redirectTarget = bindings.redirects.has(node.expression.text) ? getStringLiteralValue(node.arguments[0]) : null;
			if (redirectTarget) {
				redirectTargets.add(redirectTarget);
			}
		}
		if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ts.isIdentifier(node.tagName)) {
			const loader = bindings.loaders.get(node.tagName.text);
			if (loader && typeof loader.slugProp === "string") {
				catalogReferences.push({
					category: readJsxStringProp(node.attributes, loader.categoryProp),
					loader: loader.loader,
					slug: readJsxStringProp(node.attributes, loader.slugProp),
				});
			}
		}
		ts.forEachChild(node, visit);
	}

	visit(sourceFile);
	return { catalogReferences, hasJsx, redirectTargets: [...redirectTargets].sort(compareStrings) };
}

function createCatalogIndex(components = []) {
	const categories = new Set();
	const entries = new Map();
	for (const component of components) {
		categories.add(component.category);
		entries.set(`${component.category}:${component.slug}`, component);
	}
	return { categories, entries };
}

function formatCatalogReference(reference) {
	const slug = reference.slug === null ? "<dynamic>" : JSON.stringify(reference.slug);
	const category = reference.category === null ? "<dynamic>" : JSON.stringify(reference.category);
	return `${reference.loader}(slug: ${slug}, category: ${category})`;
}

function toProjectPath(absolutePath, cwd) {
	return absolutePath ? toPosixPath(path.relative(cwd, absolutePath)) : null;
}

function resolveCatalogEntryFile(importPath, source, cwd) {
	// Project/block directories expose their route shell as page.tsx even when the catalog importPath is a directory.
	const pageEntry = `${source}/page.tsx`;
	if (existsSync(path.join(cwd, pageEntry))) {
		return pageEntry;
	}
	return toProjectPath(resolveProjectImport(importPath, cwd), cwd);
}

function resolveRegistryDemoFile(reference, registryData, cwd) {
	const imports = registryData?.primary?.[reference.category]?.[reference.slug]?.imports ?? [];
	return imports.map((entry) => toProjectPath(resolveRegistryImport(entry.importPath, cwd, entry.sourceFile), cwd)).find(Boolean) ?? null;
}

function resolveCatalogReference(reference, { catalog, cwd, registryData }) {
	const { category, loader, slug } = reference;
	if (slug === null || category === null) {
		const owner = { kind: "dynamic", dynamic: "catalog", ...(category === null ? {} : { category }), loader };
		if (category !== null && !catalog.categories.has(category)) {
			owner.error = `${formatCatalogReference(reference)} references a category with no entries in ${COMPONENT_MANIFEST_ENTRY}.`;
		}
		return owner;
	}

	const component = catalog.entries.get(`${category}:${slug}`);
	if (!component || typeof component.importPath !== "string" || component.importPath.length === 0) {
		const reason = component ? "has a catalog entry without an importPath" : "has no matching catalog entry";
		return { kind: "catalog", category, slug, loader, error: `${formatCatalogReference(reference)} ${reason} in ${COMPONENT_MANIFEST_ENTRY}.` };
	}

	const source = component.importPath.startsWith("@/") ? component.importPath.slice(2) : component.importPath;
	const entry = resolveCatalogEntryFile(component.importPath, source, cwd);
	const demo = resolveRegistryDemoFile(reference, registryData, cwd);
	return {
		kind: "catalog",
		category,
		slug,
		...getLifecycleFields(component, { includeNote: false }),
		loader,
		source,
		...(entry ? { entry } : {}),
		...(demo ? { demo } : {}),
	};
}

function resolvePrimaryOwner({ catalogContext, shellOwners, signals, source }) {
	const catalogOwners = signals.catalogReferences.map((reference) => resolveCatalogReference(reference, catalogContext));
	if (catalogOwners.length > 0) {
		return (
			catalogOwners.find((owner) => typeof owner.error === "string") ??
			catalogOwners.find((owner) => owner.kind === "catalog") ??
			catalogOwners[0]
		);
	}
	if (!signals.hasJsx && signals.redirectTargets.length === 1) {
		return { kind: "redirect", to: signals.redirectTargets[0] };
	}
	if (shellOwners.length > 0) {
		return { kind: "shell", sources: shellOwners.map((owner) => owner.source) };
	}
	return { kind: "inline", source };
}

function collectAppPageOwnerErrors(appPageRoutes = []) {
	return appPageRoutes
		.filter((route) => typeof route.primaryOwner?.error === "string")
		.map((route) => `${route.source}: ${route.primaryOwner.error}`);
}

function collectAppPageRoutes({
	appDir = APP_DIR,
	components = [],
	cwd = process.cwd(),
	registryData = null,
} = {}) {
	const absoluteAppDir = path.join(cwd, appDir);
	const catalogContext = { catalog: createCatalogIndex(components), cwd, registryData };
	return walkFiles(absoluteAppDir)
		.filter((filePath) => filePath.endsWith(`${path.sep}page.tsx`))
		.map((absolutePagePath) => {
			const source = toPosixPath(path.relative(cwd, absolutePagePath));
			const sourceFile = ts.createSourceFile(
				source,
				readFileSync(absolutePagePath, "utf8"),
				ts.ScriptTarget.Latest,
				true,
				ts.ScriptKind.TSX,
			);
			const owners = [];
			const jsxIdentifiers = collectJsxIdentifiers(sourceFile);

			for (const statement of sourceFile.statements) {
				if (
					!ts.isImportDeclaration(statement) ||
					!ts.isStringLiteral(statement.moduleSpecifier)
				) {
					continue;
				}

				const importPath = statement.moduleSpecifier.text;
				const normalizedSource = normalizeLocalImportSource({
					importPath,
					sourceFilePath: source,
				});
				if (!normalizedSource || !isAppPageOwnerImport(normalizedSource)) {
					continue;
				}

				owners.push({
					importPath,
					source: normalizedSource,
					symbols: getImportSymbols(statement.importClause),
				});
			}
			const shellOwners = owners
				.filter((owner) => owner.symbols.some((symbol) => jsxIdentifiers.has(symbol)))
				.map((owner) => ({ ...owner }))
				.sort((left, right) => compareStrings(left.source, right.source));
			const primaryOwner = resolvePrimaryOwner({
				catalogContext,
				shellOwners,
				signals: collectPageSignals(sourceFile, collectPageBindings(sourceFile, source)),
				source,
			});

			return {
				ownerCount: owners.length,
				owners: owners.sort((left, right) => compareStrings(left.source, right.source)),
				primaryOwner,
				routePath: routePathFromPageFile(source, appDir),
				shellOwnerCount: shellOwners.length,
				shellOwners,
				source,
			};
		})
		.sort((left, right) => compareStrings(left.routePath, right.routePath) || compareStrings(left.source, right.source));
}

function countPrimaryOwnerKinds(appPageRoutes) {
	return appPageRoutes
		.map((route) => route.primaryOwner?.kind)
		.filter((kind) => typeof kind === "string")
		.sort(compareStrings)
		.reduce((counts, kind) => {
			counts[kind] = (counts[kind] ?? 0) + 1;
			return counts;
		}, {});
}

function buildAppPageMap(appPageRoutes) {
	const ownerCount = appPageRoutes.reduce((total, route) => total + route.ownerCount, 0);
	return {
		summary: {
			ownerImportCount: ownerCount,
			pageCount: appPageRoutes.length,
			primaryOwnerKinds: countPrimaryOwnerKinds(appPageRoutes),
		},
		pages: appPageRoutes,
	};
}

module.exports = {
	APP_DIR,
	COMPONENT_MANIFEST_ENTRY,
	buildAppPageMap,
	collectAppPageOwnerErrors,
	collectAppPageRoutes,
	compareStrings,
	getLifecycleFields,
	normalizeLocalImportSource,
	routePathFromPageFile,
	toPosixPath,
};
