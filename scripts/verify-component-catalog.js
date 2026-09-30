#!/usr/bin/env node

const { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { buildSync } = require("esbuild");
const {
	REGISTRY_PATH,
	collectRegistryData,
	normalizeProjectPath,
	resolveProjectImport,
	resolveRegistryImport,
} = require("./lib/component-registry");

const COMPONENT_MANIFEST_ENTRY = "app/data/component-manifest.ts";
const DEMOS_ROOT = "components/website/demos";
const DETAIL_MODULES = {
	arts: {
		entry: "app/data/details/arts.ts",
		exportName: "ART_DETAILS",
	},
	blocks: {
		entry: "app/data/details/blocks.ts",
		exportName: "BLOCK_DETAILS",
	},
	projects: {
		entry: "app/data/details/projects.ts",
		exportName: "PROJECT_DETAILS",
	},
	ui: {
		entry: "app/data/details/ui.ts",
		exportName: "UI_DETAILS",
	},
	"ui-audio": {
		entry: "app/data/details/ui-audio.ts",
		exportName: "UI_AUDIO_DETAILS",
	},
	"ui-charts": {
		entry: "app/data/details/ui-charts.ts",
		exportName: "UI_CHART_DETAILS",
	},
	"ui-custom": {
		entry: "app/data/details/ui-custom.ts",
		exportName: "UI_CUSTOM_DETAILS",
	},
	utility: {
		entry: "app/data/details/utility.ts",
		exportName: "UTILITY_DETAILS",
	},
	visual: {
		entry: "app/data/details/visual.ts",
		exportName: "VISUAL_DETAILS",
	},
};
const CATEGORY_SOURCE_ROOTS = {
	arts: "components/arts",
	blocks: "components/blocks",
	projects: "components/projects",
	ui: "components/ui",
	"ui-audio": "components/ui-audio",
	"ui-charts": "components/ui-charts",
	"ui-custom": "components/ui-custom",
	utility: "components/website/demos/utils",
	visual: "components/visual",
};
const DEMO_CATEGORY_DIRS = {
	utility: "utils",
};
const PRIMARY_REGISTRY_TARGETS = {
	ui: "components/website/registry/ui/primary.ts",
	"ui-custom": "components/website/registry/ui-custom/primary.ts",
};
const VARIANT_REGISTRY_TARGETS = {
	ui: "components/website/registry/ui/variants-*.ts",
	"ui-custom": "components/website/registry/ui-custom/variants-*.ts",
};
const MANIFEST_HELPERS = {
	arts: "artComponent",
	blocks: "blockComponent",
	projects: "projectComponent",
	ui: "uiComponent",
	"ui-audio": "audioComponent",
	"ui-charts": "uiChartComponent",
	"ui-custom": "customComponent",
	utility: "utilityComponent",
	visual: "visualComponent",
};

// Mirrors COMPONENT_LIFECYCLE_STATUSES in app/data/component-manifest.ts; the first is the
// default when an entry omits status. verify-component-catalog.test.js checks they match.
const LIFECYCLE_STATUSES = ["live", "frozen", "superseded"];
const DEFAULT_LIFECYCLE_STATUS = LIFECYCLE_STATUSES[0];

function createDiagnostic(severity, message, details = {}) {
	return {
		severity,
		message,
		...details,
	};
}

function bundleModule(entryPoint, cwd = process.cwd()) {
	const tempDir = mkdtempSync(path.join(os.tmpdir(), "vpk-catalog-"));
	const outfile = path.join(tempDir, "module.cjs");
	try {
		buildSync({
			bundle: true,
			entryPoints: [path.join(cwd, entryPoint)],
			external: ["*.css"],
			format: "cjs",
			logLevel: "silent",
			outfile,
			platform: "node",
			tsconfig: path.join(cwd, "tsconfig.json"),
		});
		return {
			module: require(outfile),
			tempDir,
		};
	} catch (error) {
		rmSync(tempDir, { force: true, recursive: true });
		throw error;
	}
}

function loadComponentEntries(cwd = process.cwd()) {
	return loadComponentManifest(cwd).components;
}

// The manifest's entries plus its lifecycle table, from one bundle.
function loadComponentManifest(cwd = process.cwd()) {
	const bundled = bundleModule(COMPONENT_MANIFEST_ENTRY, cwd);
	try {
		return {
			components: bundled.module.getAllComponents(),
			lifecycleKeys: Object.keys(bundled.module.CATALOG_LIFECYCLE ?? {}),
			lifecycleStatuses: bundled.module.COMPONENT_LIFECYCLE_STATUSES ?? null,
		};
	} finally {
		rmSync(bundled.tempDir, { force: true, recursive: true });
	}
}

function loadDetailRecords(cwd = process.cwd()) {
	const records = {};
	for (const [category, detailModule] of Object.entries(DETAIL_MODULES)) {
		const bundled = bundleModule(detailModule.entry, cwd);
		try {
			records[category] = bundled.module[detailModule.exportName];
		} finally {
			rmSync(bundled.tempDir, { force: true, recursive: true });
		}
	}
	return records;
}

function collectDemoFiles(cwd = process.cwd()) {
	const demoRootPath = path.join(cwd, DEMOS_ROOT);
	if (!existsSync(demoRootPath)) {
		return [];
	}

	function walk(relativeDir) {
		const dirPath = path.join(cwd, relativeDir);
		return readdirSync(dirPath, { withFileTypes: true }).flatMap((entry) => {
			const relativePath = path.join(relativeDir, entry.name).split(path.sep).join("/");
			if (entry.isDirectory()) {
				return walk(relativePath);
			}
			if (!entry.isFile() || !/-demo(?:-.+)?\.(?:tsx|ts|jsx|js)$/u.test(entry.name) || /\.test\./u.test(entry.name)) {
				return [];
			}
			const source = readFileSync(path.join(cwd, relativePath), "utf8");
			if (!/export\s+default\s+/u.test(source)) {
				return [];
			}
			return [relativePath];
		});
	}

	return walk(DEMOS_ROOT).sort((left, right) => left.localeCompare(right));
}

function getComponentKey(component) {
	return `${component.category}/${component.slug}`;
}

function getDemoCategoryDir(category) {
	return DEMO_CATEGORY_DIRS[category] ?? category;
}

function toProjectPathFromImport(importPath) {
	if (!importPath.startsWith("@/")) {
		return null;
	}
	return importPath.slice(2);
}

function toRegistryImportPath(registryPath, targetPath) {
	const relativePath = path.relative(path.dirname(registryPath), targetPath).split(path.sep).join("/");
	const normalized = relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
	return normalized.replace(/\.(?:tsx|ts|jsx|js)$/u, "");
}

function toDetailExportName(slug) {
	return `${slug.replace(/[^a-z0-9]+/giu, "_").replace(/^_+|_+$/gu, "").toUpperCase()}_DETAIL`;
}

function toTitleCase(slug) {
	return slug
		.split("-")
		.filter(Boolean)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

// Minor words that stay lowercase mid-title in Chicago-style title case
// (e.g. "Chain of Thought", "Open in Chat", "Jira for You"). They must still
// be capitalized when they are the first word of a name.
const TITLE_CASE_MINOR_WORDS = new Set([
	"a", "an", "and", "as", "at", "but", "by", "for", "if", "in", "nor",
	"of", "on", "or", "per", "the", "to", "via", "vs", "with",
]);

// Brand names that are stylized lowercase by their owners and must not be
// "corrected" to Title Case (e.g. "Rovo p5" for p5.js). Unlike minor words
// these are content words, so they are allowed in any position.
const TITLE_CASE_BRAND_WORDS = new Set(["p5"]);

// Explicit product wording; keep this exception scoped to the named catalog entry.
const COMPONENT_NAME_OVERRIDES = new Map([["utility/cone-safezone", "Cone safezone"]]);

function isTitleCaseWord(word, index) {
	// Capitalized word, acronym, brand, or numeric segment (e.g. "Chat", "SVG", "ChatGPT", "01").
	if (/^[A-Z0-9]/u.test(word)) {
		return true;
	}
	// Brand stylized lowercase, e.g. "p5".
	if (TITLE_CASE_BRAND_WORDS.has(word)) {
		return true;
	}
	// Version suffix, e.g. "v2".
	if (/^v\d+$/u.test(word)) {
		return true;
	}
	// Minor words may stay lowercase, but never as the first word.
	return index > 0 && TITLE_CASE_MINOR_WORDS.has(word);
}

function isTitleCaseName(name) {
	if (typeof name !== "string") {
		return false;
	}
	const words = name.split(/\s+/u).filter(Boolean);
	if (words.length === 0) {
		return false;
	}
	return words.every((word, index) => isTitleCaseWord(word, index));
}

function getPrimaryRegistryTarget(category) {
	return PRIMARY_REGISTRY_TARGETS[category] ?? `components/website/registry/${category}.ts`;
}

function getVariantRegistryTarget(category) {
	return VARIANT_REGISTRY_TARGETS[category] ?? `components/website/registry/${category}.ts`;
}

function getDefaultImportPath(category, slug) {
	if (category === "utility") {
		return `@/components/website/demos/utils/${slug}-demo`;
	}
	return `@/${CATEGORY_SOURCE_ROOTS[category]}/${slug}`;
}

function getManifestEntrySnippet(category, slug, name, importPath) {
	if (category === "visual") {
		return `${MANIFEST_HELPERS[category]}("${slug}", "${name}", "${importPath}")`;
	}
	return `${MANIFEST_HELPERS[category]}("${slug}", "${name}")`;
}

function getComponentAddPlan({
	category,
	components,
	detailRecords,
	registryData,
	slug,
}) {
	if (!DETAIL_MODULES[category]) {
		throw new Error(`Unknown component category ${category}. Expected one of: ${Object.keys(DETAIL_MODULES).sort().join(", ")}`);
	}
	if (!slug) {
		throw new Error("A component slug is required.");
	}

	const key = `${category}/${slug}`;
	const component = components.find((entry) => entry.category === category && entry.slug === slug) ?? null;
	const importPath = component?.importPath ?? getDefaultImportPath(category, slug);
	const sourcePath = toProjectPathFromImport(importPath);
	const demoCategoryDir = getDemoCategoryDir(category);
	const demoPath = `components/website/demos/${demoCategoryDir}/${slug}-demo.tsx`;
	const detailLeafPath = `app/data/details/${category}/${slug}.ts`;
	const detailBarrelPath = DETAIL_MODULES[category].entry;
	const detailExportName = toDetailExportName(slug);
	const primaryRegistryPath = getPrimaryRegistryTarget(category);
	const variantRegistryPath = getVariantRegistryTarget(category);
	const primaryRegistryImportPath = toRegistryImportPath(primaryRegistryPath, demoPath);
	const detail = detailRecords[category]?.[slug] ?? null;
	const primaryRegistryEntry = registryData.primary[category]?.[slug] ?? null;
	const variantRegistrySlugs = Object.keys(registryData.variants[category] ?? {})
		.filter((variantSlug) => variantSlug === slug || variantSlug.startsWith(`${slug}-`))
		.sort((left, right) => left.localeCompare(right));

	return {
		category,
		detailExportName,
		importPath,
		key,
		name: component?.name ?? toTitleCase(slug),
		paths: {
			detailBarrel: detailBarrelPath,
			detailLeaf: detailLeafPath,
			demo: demoPath,
			manifest: COMPONENT_MANIFEST_ENTRY,
			primaryRegistry: primaryRegistryPath,
			source: sourcePath,
			variantRegistry: variantRegistryPath,
		},
		slug,
		snippets: {
			detailImport: `import { ${detailExportName} } from "./${category}/${slug}";`,
			detailRecord: `"${slug}": ${detailExportName},`,
			manifestEntry: getManifestEntrySnippet(category, slug, component?.name ?? toTitleCase(slug), importPath),
			primaryRegistryEntry: `"${slug}": dynamic(() => import("${primaryRegistryImportPath}"), { ssr: false }),`,
		},
		status: {
			detail: Boolean(detail),
			manifest: Boolean(component),
			primaryRegistry: Boolean(primaryRegistryEntry),
			variantRegistrySlugs,
		},
		validationCommands: [
			"corepack pnpm run verify:catalog",
			"corepack pnpm run test:catalog",
			"corepack pnpm run verify:repo-map",
		],
	};
}

function parseAddPlanTarget(args) {
	const targetIndex = args.indexOf("--add-plan");
	if (targetIndex === -1) {
		return null;
	}

	const targetArgs = args.slice(targetIndex + 1).filter((arg) => arg !== "--");
	const first = targetArgs[0];
	const second = targetArgs[1];
	if (!first) {
		throw new Error("Usage: node scripts/verify-component-catalog.js --add-plan <category>/<slug>");
	}
	if (first.includes("/")) {
		const [category, slug] = first.split("/");
		return { category, slug };
	}
	if (!second) {
		throw new Error("Usage: node scripts/verify-component-catalog.js --add-plan <category> <slug>");
	}
	return { category: first, slug: second };
}

function printComponentAddPlan(plan) {
	const existing = (value) => value ? "present" : "missing";
	console.log(`Catalog add plan for ${plan.key}`);
	console.log("");
	console.log("Status:");
	console.log(`- manifest entry: ${existing(plan.status.manifest)}`);
	console.log(`- detail record: ${existing(plan.status.detail)}`);
	console.log(`- primary registry entry: ${existing(plan.status.primaryRegistry)}`);
	console.log(`- related variant demos: ${plan.status.variantRegistrySlugs.length > 0 ? plan.status.variantRegistrySlugs.join(", ") : "none"}`);
	console.log("");
	console.log("Edit targets:");
	console.log(`- component source: ${plan.paths.source ?? plan.importPath}`);
	console.log(`- manifest: ${plan.paths.manifest}`);
	console.log(`- detail leaf: ${plan.paths.detailLeaf}`);
	console.log(`- detail barrel: ${plan.paths.detailBarrel}`);
	console.log(`- primary demo: ${plan.paths.demo}`);
	console.log(`- primary registry: ${plan.paths.primaryRegistry}`);
	console.log(`- variant registry: ${plan.paths.variantRegistry}`);
	console.log("");
	console.log("Useful snippets:");
	console.log(`- manifest: ${plan.snippets.manifestEntry}`);
	console.log(`- detail import: ${plan.snippets.detailImport}`);
	console.log(`- detail record: ${plan.snippets.detailRecord}`);
	console.log(`- primary registry: ${plan.snippets.primaryRegistryEntry}`);
	console.log("");
	console.log("Validation:");
	for (const command of plan.validationCommands) {
		console.log(`- ${command}`);
	}
}

function buildCategorySets(components) {
	const byCategory = new Map();
	for (const component of components) {
		if (!byCategory.has(component.category)) {
			byCategory.set(component.category, new Set());
		}
		byCategory.get(component.category).add(component.slug);
	}
	return byCategory;
}

function getComponentDetail(component, detailRecords) {
	return component.detail ?? detailRecords[component.category]?.[component.slug];
}

function validateLifecycle(components, lifecycleKeys) {
	const diagnostics = [];
	const manifestKeys = new Set(components.map(getComponentKey));
	const manifestByCategory = buildCategorySets(components);
	for (const key of lifecycleKeys) {
		if (!manifestKeys.has(key)) {
			diagnostics.push(createDiagnostic("error", `Lifecycle entry ${key} matches no manifest entry.`, { key }));
		}
	}
	for (const component of components) {
		const key = getComponentKey(component);
		const details = { category: component.category, slug: component.slug };
		if (component.status !== undefined && !LIFECYCLE_STATUSES.includes(component.status)) {
			diagnostics.push(createDiagnostic("error", `Component ${key} has unknown status ${JSON.stringify(component.status)} (expected ${LIFECYCLE_STATUSES.join(", ")}).`, details));
		}
		if (component.basedOn !== undefined) {
			if (component.basedOn === component.slug) {
				diagnostics.push(createDiagnostic("error", `Component ${key} cannot be basedOn itself.`, details));
			} else if (typeof component.basedOn !== "string" || !manifestByCategory.get(component.category)?.has(component.basedOn)) {
				diagnostics.push(createDiagnostic("error", `Component ${key} basedOn ${JSON.stringify(component.basedOn)} is not a ${component.category} slug in the manifest.`, details));
			}
		}
		if (component.note !== undefined && (typeof component.note !== "string" || component.note.trim() === "")) {
			diagnostics.push(createDiagnostic("error", `Component ${key} note must be a non-empty string.`, details));
		}
		if (component.status === "superseded" && typeof component.note !== "string") {
			diagnostics.push(createDiagnostic("error", `Component ${key} is superseded but has no note naming its successor.`, details));
		}
	}
	return diagnostics;
}

function validateComponentCatalog({
	components,
	demoFiles = [],
	detailRecords,
	lifecycleKeys = [],
	registryData,
	cwd = process.cwd(),
}) {
	const diagnostics = validateLifecycle(components, lifecycleKeys);
	const componentCategories = new Set(components.map((component) => component.category));
	const detailCategories = new Set(Object.keys(detailRecords));
	const primaryRegistryCategories = new Set(Object.keys(registryData.primary));

	for (const category of componentCategories) {
		if (!detailCategories.has(category)) {
			diagnostics.push(createDiagnostic("error", `Missing detail category ${category}.`, { category }));
		}
		if (!primaryRegistryCategories.has(category)) {
			diagnostics.push(createDiagnostic("error", `Missing primary registry category ${category}.`, { category }));
		}
	}

	for (const category of primaryRegistryCategories) {
		if (!componentCategories.has(category)) {
			diagnostics.push(createDiagnostic("error", `Primary registry category ${category} is not in the component manifest.`, { category }));
		}
	}

	const seenComponents = new Set();
	for (const component of components) {
		const key = getComponentKey(component);
		if (seenComponents.has(key)) {
			diagnostics.push(createDiagnostic("error", `Duplicate component manifest entry ${key}.`, {
				category: component.category,
				slug: component.slug,
			}));
		}
		seenComponents.add(key);

		if (!isTitleCaseName(component.name) && COMPONENT_NAME_OVERRIDES.get(key) !== component.name) {
			diagnostics.push(createDiagnostic("error", `Component ${key} name "${component.name}" is not Title Case (expected "${toTitleCase(component.slug)}"-style capitalization).`, {
				category: component.category,
				name: component.name,
				slug: component.slug,
			}));
		}
	}

	for (const [registryKind, registries] of Object.entries(registryData)) {
		for (const [category, registry] of Object.entries(registries)) {
			for (const [slug, entry] of Object.entries(registry)) {
				if (entry.imports.length === 0) {
					diagnostics.push(createDiagnostic("error", `${registryKind} registry ${category}/${slug} has no demo import.`, {
						category,
						registryKind,
						slug,
					}));
				}
				for (const importReference of entry.imports) {
					const importPath = typeof importReference === "string" ? importReference : importReference.importPath;
					const sourceFile = typeof importReference === "string" ? REGISTRY_PATH : importReference.sourceFile;
					if (!resolveRegistryImport(importPath, cwd, sourceFile)) {
						diagnostics.push(createDiagnostic("error", `${registryKind} registry ${category}/${slug} imports missing module ${importPath}.`, {
							category,
							importPath,
							registryKind,
							slug,
							sourceFile,
						}));
					}
				}
			}
		}
	}

	const referencedDemoFiles = new Set();
	for (const registries of Object.values(registryData)) {
		for (const registry of Object.values(registries)) {
			for (const entry of Object.values(registry)) {
				for (const importReference of entry.imports) {
					const importPath = typeof importReference === "string" ? importReference : importReference.importPath;
					const sourceFile = typeof importReference === "string" ? REGISTRY_PATH : importReference.sourceFile;
					const resolvedImport = resolveRegistryImport(importPath, cwd, sourceFile);
					if (resolvedImport) {
						referencedDemoFiles.add(normalizeProjectPath(cwd, resolvedImport));
					}
				}
			}
		}
	}
	for (const component of components) {
		const resolvedImport = resolveProjectImport(component.importPath, cwd);
		if (resolvedImport) {
			referencedDemoFiles.add(normalizeProjectPath(cwd, resolvedImport));
		}
	}
	for (const demoFile of demoFiles) {
		if (!referencedDemoFiles.has(demoFile)) {
			diagnostics.push(createDiagnostic("warning", `Demo file ${demoFile} is not referenced by the registry or component manifest.`, {
				demoFile,
			}));
		}
	}

	const manifestByCategory = buildCategorySets(components);
	const referencedDemoSlugsByCategory = new Map();
	for (const component of components) {
		if (!referencedDemoSlugsByCategory.has(component.category)) {
			referencedDemoSlugsByCategory.set(component.category, new Set());
		}
		const referencedDemoSlugs = referencedDemoSlugsByCategory.get(component.category);
		const detail = getComponentDetail(component, detailRecords);
		for (const example of detail?.examples ?? []) {
			if (typeof example.demoSlug === "string" && example.demoSlug) {
				referencedDemoSlugs.add(example.demoSlug);
			}
		}
	}
	for (const component of components) {
		const detail = getComponentDetail(component, detailRecords);
		if (!detail) {
			diagnostics.push(createDiagnostic("warning", `Manifest entry ${getComponentKey(component)} has no detail record.`, {
				category: component.category,
				slug: component.slug,
			}));
		}

		const primaryRegistry = registryData.primary[component.category] ?? {};
		if (!primaryRegistry[component.slug]) {
			diagnostics.push(createDiagnostic("warning", `Manifest entry ${getComponentKey(component)} has no primary registry entry.`, {
				category: component.category,
				slug: component.slug,
			}));
		}

		const variantRegistry = registryData.variants[component.category] ?? {};
		const availableDemoSlugs = new Set([
			...Object.keys(primaryRegistry),
			...Object.keys(variantRegistry),
		]);
		for (const example of detail?.examples ?? []) {
			if (!availableDemoSlugs.has(example.demoSlug)) {
				diagnostics.push(createDiagnostic("warning", `Example ${getComponentKey(component)} references missing demoSlug ${example.demoSlug}.`, {
					category: component.category,
					demoSlug: example.demoSlug,
					slug: component.slug,
				}));
			}
		}
	}

	for (const [category, details] of Object.entries(detailRecords)) {
		const manifestSlugs = manifestByCategory.get(category) ?? new Set();
		for (const slug of Object.keys(details)) {
			if (!manifestSlugs.has(slug)) {
				diagnostics.push(createDiagnostic("warning", `Detail record ${category}/${slug} is not referenced by the manifest.`, {
					category,
					slug,
				}));
			}
		}
	}

	for (const [category, registry] of Object.entries(registryData.primary)) {
		const manifestSlugs = manifestByCategory.get(category) ?? new Set();
		const referencedDemoSlugs = referencedDemoSlugsByCategory.get(category) ?? new Set();
		for (const slug of Object.keys(registry)) {
			if (!manifestSlugs.has(slug) && !referencedDemoSlugs.has(slug)) {
				diagnostics.push(createDiagnostic("warning", `Primary registry entry ${category}/${slug} is not referenced by the manifest.`, {
					category,
					slug,
				}));
			}
		}
	}

	return diagnostics;
}

function summarizeDiagnostics(diagnostics) {
	const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error");
	const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === "warning");
	return {
		errors,
		warnings,
	};
}

function printDiagnostics(diagnostics) {
	const { errors, warnings } = summarizeDiagnostics(diagnostics);
	if (errors.length > 0) {
		console.error(`Component catalog verification failed with ${errors.length} error(s):`);
		for (const error of errors) {
			console.error(`- ${error.message}`);
		}
	}
	if (warnings.length > 0) {
		console.warn(`Component catalog verification reported ${warnings.length} warning(s):`);
		for (const warning of warnings) {
			console.warn(`- ${warning.message}`);
		}
	}
}

function main() {
	const addPlanTarget = parseAddPlanTarget(process.argv);
	if (addPlanTarget) {
		const components = loadComponentEntries();
		const detailRecords = loadDetailRecords();
		const registryData = collectRegistryData();
		printComponentAddPlan(getComponentAddPlan({
			...addPlanTarget,
			components,
			detailRecords,
			registryData,
		}));
		return;
	}

	const strictWarnings = process.argv.includes("--strict-warnings");
	const { components, lifecycleKeys } = loadComponentManifest();
	const demoFiles = collectDemoFiles();
	const detailRecords = loadDetailRecords();
	const registryData = collectRegistryData();
	const diagnostics = validateComponentCatalog({
		components,
		demoFiles,
		detailRecords,
		lifecycleKeys,
		registryData,
	});
	const { errors, warnings } = summarizeDiagnostics(diagnostics);
	printDiagnostics(diagnostics);

	if (errors.length > 0 || (strictWarnings && warnings.length > 0)) {
		process.exitCode = 1;
		return;
	}

	console.log(`Verified component catalog structure (${components.length} manifest entries, ${warnings.length} warning(s))`);
}

if (require.main === module) {
	main();
}

module.exports = {
	DEFAULT_LIFECYCLE_STATUS,
	LIFECYCLE_STATUSES,
	collectDemoFiles,
	collectRegistryData,
	getComponentAddPlan,
	isTitleCaseName,
	loadComponentEntries,
	loadComponentManifest,
	resolveRegistryImport,
	resolveProjectImport,
	summarizeDiagnostics,
	validateComponentCatalog,
};
