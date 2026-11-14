// A cheap reverse-import index over tracked source files, for picking which files to lint
// and which suites to run for a change. It reads static import/export/require/import()
// specifiers with a regex, so it is a selection heuristic, not a resolver of record:
// `pnpm run ci:pr` still lints and tests everything.

import path from "node:path";

export const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const SPECIFIER_PATTERN = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)["'`]([^"'`\n]+)["'`]/gmu;

export function isSourceFile(filePath) {
	return SOURCE_EXTENSIONS.includes(path.extname(filePath));
}

export function isTestFile(filePath) {
	return /\.test\.(?:js|mjs|cjs|ts|tsx)$/u.test(filePath);
}

export function readSpecifiers(source) {
	return [...source.matchAll(SPECIFIER_PATTERN)].map((match) => match[1]);
}

// Repo paths written as strings in a test, resolved from the repo root: the entry a test hands
// to renderComponent ({ entry: "components/x/index.ts" }), or an import inside esbuild stdin text
// (from "./components/x.tsx", which is relative to the repo root, not to the test's directory).
const REPO_PATH_STRING = /["'`](?:\.\/)?((?:app|backend|components|hooks|lib|rovo|scripts)\/[^"'`\s]+?)["'`]/gu;

export function readRepoPathStrings(source) {
	return [...source.matchAll(REPO_PATH_STRING)].map((match) => match[1]);
}

// A suite that renders or bundles code with esbuild: it runs everything the bundle reaches, so
// a change deep in that graph can break it.
const BUNDLING_SUITE = /\brenderComponent\s*\(|\bbuildSync\s*\(|\besbuild\.build\s*\(|\bloadCjsModuleFromText\s*\(/u;

export function isBundlingSuite(source) {
	return BUNDLING_SUITE.test(source);
}

// Resolves a relative or `@/` specifier to a tracked path; bare packages resolve to null.
export function resolveSpecifier(specifier, importer, trackedFiles) {
	let base;
	if (specifier.startsWith("@/")) base = specifier.slice(2);
	else if (specifier.startsWith("./") || specifier.startsWith("../")) base = path.posix.join(path.posix.dirname(importer), specifier);
	else return null;
	base = base.replace(/\?.*$/u, "");
	const candidates = [base, ...SOURCE_EXTENSIONS.map((extension) => `${base}${extension}`),
		...SOURCE_EXTENSIONS.map((extension) => `${base}/index${extension}`)];
	// `./x.js` written for a `.ts` source (allowImportingTsExtensions and ESM-style paths).
	const withoutExtension = base.replace(/\.(?:js|mjs|cjs|jsx)$/u, "");
	if (withoutExtension !== base) candidates.push(...[".ts", ".tsx"].map((extension) => `${withoutExtension}${extension}`));
	return candidates.find((candidate) => trackedFiles.has(candidate)) ?? null;
}

export function buildReverseImports(files, readSource) {
	const tracked = new Set(files);
	const importersOf = new Map();
	for (const file of files) {
		if (!isSourceFile(file)) continue;
		let source;
		try { source = readSource(file); } catch { continue; }
		const targets = readSpecifiers(source).map((specifier) => resolveSpecifier(specifier, file, tracked));
		if (isTestFile(file)) targets.push(...readRepoPathStrings(source).map((repoPath) => resolveSpecifier(`@/${repoPath}`, file, tracked)));
		for (const target of targets) {
			if (!target || target === file) continue;
			if (!importersOf.has(target)) importersOf.set(target, new Set());
			importersOf.get(target).add(file);
		}
	}
	return importersOf;
}

export function directImporters(changed, importersOf) {
	const result = new Set();
	for (const file of changed) for (const importer of importersOf.get(file) ?? []) result.add(importer);
	return result;
}

// Suites worth running for a change: changed suites, suites that import a changed module or a
// module that imports one (two levels; a test's repo-path strings count as imports), suites
// named after a changed module (`foo.ts` → `foo.test.js`, `foo.behavior.test.js`), and
// source-contract suites that read a changed source file by path.
export const RELATED_DEPTH = 2;

export function selectRelatedTests({ changed, importersOf, testFiles, readSource }) {
	const selected = new Set(changed.filter(isTestFile));
	let level = new Set(changed);
	const seen = new Set(changed);
	for (let depth = 1; depth <= RELATED_DEPTH; depth += 1) {
		const next = new Set();
		for (const importer of directImporters(level, importersOf)) {
			if (seen.has(importer)) continue;
			seen.add(importer);
			if (isTestFile(importer)) selected.add(importer);
			else next.add(importer);
		}
		level = next;
	}
	const changedByDir = new Map();
	for (const file of changed) {
		const dir = path.posix.dirname(file);
		if (!changedByDir.has(dir)) changedByDir.set(dir, []);
		changedByDir.get(dir).push(file);
	}
	for (const testFile of testFiles) {
		if (selected.has(testFile)) continue;
		const dir = path.posix.dirname(testFile);
		const testStem = path.posix.basename(testFile).replace(/\.test\.[^.]+$/u, "");
		const sameDir = changedByDir.get(dir) ?? [];
		if (sameDir.some((file) => testStem === stem(file) || testStem.startsWith(`${stem(file)}.`))) {
			selected.add(testFile);
			continue;
		}
		let source = null;
		// Only source files: a suite that names package.json or a README is not guarding it.
		for (const file of changed.filter(isSourceFile)) {
			const name = path.posix.basename(file);
			const parentAndName = `${path.posix.basename(path.posix.dirname(file))}/${name}`;
			source ??= safeRead(readSource, testFile);
			if (source === "") break;
			if (source.includes(file) || source.includes(parentAndName) || (sameDir.includes(file) && source.includes(name))) {
				selected.add(testFile);
				break;
			}
		}
	}
	return [...selected].sort();
}

function stem(file) {
	return path.posix.basename(file).replace(/\.[^.]+$/u, "");
}

function safeRead(readSource, file) {
	try { return readSource(file); } catch { return ""; }
}

// Rendered or bundling suites that depend on a change through any number of imports but were
// not selected: `check` names them in one line and runs them with `--deep`.
export function deepBundlingDependents({ changed, importersOf, selected, readSource }) {
	const chosen = new Set(selected);
	const seen = new Set(changed);
	const queue = [...changed];
	const result = [];
	while (queue.length > 0) {
		for (const importer of importersOf.get(queue.shift()) ?? []) {
			if (seen.has(importer)) continue;
			seen.add(importer);
			queue.push(importer);
			if (isTestFile(importer) && !chosen.has(importer) && isBundlingSuite(safeRead(readSource, importer))) result.push(importer);
		}
	}
	return result.sort();
}
