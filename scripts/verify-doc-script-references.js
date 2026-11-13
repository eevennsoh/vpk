#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
	assertWorkspaceDependencies,
} = require("./lib/dependency-health");

let ts;
try {
	assertWorkspaceDependencies(["typescript"], {
		commandName: "node scripts/verify-doc-script-references.js",
	});
	ts = require("typescript");
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
}

const DEFAULT_DOC_TARGETS = [
	"AGENTS.md",
	"README.md",
	"DESIGN.md",
	"WORKFLOW.md",
	".agents/docs",
	".agents/rules",
	".agents/skills",
];
const PROVIDER_COMPOSITION_DOC_PATH = ".agents/docs/architecture-overview.md";
const PROVIDERS_SOURCE_PATH = "app/providers.tsx";
const DOC_EXTENSIONS = new Set([".md", ".mdc"]);
const AGENTS_FRESHNESS_DOC_PATH = ".agents/rules/testing.md";
const AGENTS_FRESHNESS_BEGIN = "<!-- validation-freshness:begin -->";
const AGENTS_FRESHNESS_END = "<!-- validation-freshness:end -->";
const REQUIRED_AGENTS_FRESHNESS_COMMANDS = [
	"pnpm run validate:preflight",
	"pnpm run verify:route-manifest",
	"pnpm run verify:api-surfaces",
	"pnpm run verify:repo-map",
	"pnpm run verify:file-size",
	"pnpm run verify:catalog",
	"pnpm run verify:lazy-load",
	"pnpm run verify:source-guardrails",
	"pnpm run verify:doc-scripts",
	"pnpm run lint",
	"pnpm run typecheck",
];
const REQUIRED_AGENTS_FRESHNESS_LINKS = [
	".agents/docs/architecture-overview.md",
	".agents/docs/workflows-extended.md",
	".agents/rules/api-surfaces.md",
	".agents/rules/token-priority.md",
	".agents/rules/component-architecture.md",
	".agents/rules/agent-operations.md",
];

function toPosixPath(filePath) {
	return filePath.split(path.sep).join("/");
}

function compareStrings(left, right) {
	if (left < right) {
		return -1;
	}
	if (left > right) {
		return 1;
	}
	return 0;
}

function isDocumentationFile(filePath) {
	return DOC_EXTENSIONS.has(path.extname(filePath));
}

function collectDocumentationFiles({ cwd = process.cwd(), targets = DEFAULT_DOC_TARGETS } = {}) {
	const files = [];

	function visit(absolutePath) {
		if (!fs.existsSync(absolutePath)) {
			return;
		}
		const stat = fs.statSync(absolutePath);
		if (stat.isDirectory()) {
			for (const entry of fs.readdirSync(absolutePath, { withFileTypes: true })) {
				if (entry.name.startsWith(".")) {
					continue;
				}
				visit(path.join(absolutePath, entry.name));
			}
			return;
		}
		if (stat.isFile() && isDocumentationFile(absolutePath)) {
			files.push(toPosixPath(path.relative(cwd, absolutePath)));
		}
	}

	for (const target of targets) {
		visit(path.resolve(cwd, target));
	}

	return [...new Set(files)].sort(compareStrings);
}

function getLineNumber(content, index) {
	return content.slice(0, index).split(/\r?\n/u).length;
}

function extractPnpmRunScriptReferences(content, filePath = "unknown") {
	const references = [];
	const pattern = /(?:\bcorepack\s+)?\bpnpm\s+run\s+([A-Za-z0-9:_-]+)/gu;
	let match = pattern.exec(content);
	while (match) {
		references.push({
			command: match[0],
			filePath,
			line: getLineNumber(content, match.index),
			scriptName: match[1],
		});
		match = pattern.exec(content);
	}
	return references;
}

function extractLocalSkillEntrypointReferences(content, filePath = "unknown") {
	const references = [];
	const pattern = /(^|[\s`"'([:])((?:\.\/)?\.agents\/skills\/([A-Za-z0-9_-]+)\/SKILL\.md)/gmu;
	let match = pattern.exec(content);
	while (match) {
		const referencePath = match[2].replace(/^\.\//u, "");
		references.push({
			filePath,
			line: getLineNumber(content, match.index + match[1].length),
			referencePath,
			skillName: match[3],
		});
		match = pattern.exec(content);
	}
	return references;
}

// A backticked span that names a repo path: at least one slash, no spaces, globs or
// placeholders. `@/x` is the import alias for `x`; a `:12` line suffix is dropped.
function extractRepoPathReferences(content, filePath = "unknown") {
	const references = [];
	const pattern = /`([^`\n]+)`/gu;
	let match = pattern.exec(content);
	while (match) {
		const candidate = match[1]
			.replace(/^@\//u, "")
			.replace(/^\.\//u, "")
			.replace(/(?::\d+(?:-\d+)?|#[\w-]*)$/u, "")
			.replace(/\/$/u, "");
		if (candidate.includes("/") && !/[\s*?<>{}[\]$|\\…]|\.\.\.|^[@~/]|^\.\.\/|:\/\//u.test(candidate)) {
			references.push({ filePath, line: getLineNumber(content, match.index), referencePath: candidate, text: match[1] });
		}
		match = pattern.exec(content);
	}
	return references;
}

// Commands in docs: every fenced block, plus inline spans outside the fences.
function extractCommandSnippets(content) {
	const snippets = [];
	const fence = /^(\s*)```[^\n]*\n([\s\S]*?)^\1```/gmu;
	let match = fence.exec(content);
	while (match) {
		snippets.push({ index: match.index + match[0].indexOf(match[2]), text: match[2] });
		match = fence.exec(content);
	}
	const outsideFences = content.replace(fence, (block) => block.replace(/[^\n]/gu, " "));
	const span = /`([^`\n]+)`/gu;
	match = span.exec(outsideFences);
	while (match) {
		snippets.push({ index: match.index + 1, text: match[1] });
		match = span.exec(outsideFences);
	}
	return snippets;
}

// A repo CLI named bare in command position (`control-vpk doctor`, `$(control-vpk url)`)
// is "command not found" in every shell, because nothing puts it on PATH.
function extractBareCliReferences(content, filePath, cliNames) {
	if (cliNames.size === 0) return [];
	const names = [...cliNames].map((name) => name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")).join("|");
	const command = new RegExp(`(^|[\\s;|&(]|\\$\\()(${names})(?=\\s+[a-z-])`, "gmu");
	const references = [];
	for (const snippet of extractCommandSnippets(content)) {
		let match = command.exec(snippet.text);
		while (match) {
			const before = snippet.text.slice(0, match.index + match[1].length);
			if (!/\bpnpm(?:\s+-s)?\s+$/u.test(before)) {
				references.push({
					cliName: match[2],
					filePath,
					line: getLineNumber(content, snippet.index + match.index + match[1].length),
				});
			}
			match = command.exec(snippet.text);
		}
	}
	return references.sort((left, right) => left.line - right.line);
}

const PATH_SUFFIXES = ["", ".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.tsx", "/index.js"];

// Docs that describe a layout outside this checkout: an extracted app, a generic project,
// a file the user supplies. Each entry names the doc, the path, and why it is not dead.
const EXTERNAL_PATH_REFERENCES = [
	{ doc: ".agents/skills/vpk-build/SKILL.md", paths: ["types/jsx-namespace.d.ts", "scripts/dev-backend-backed.mjs"], reason: "files the extraction writes into the target app" },
	{ doc: ".agents/skills/vpk-build/references/extraction-guide.md", paths: ["types/jsx-namespace.d.ts", "scripts/dev-backend-backed.mjs"], reason: "files the extraction writes into the target app" },
	{ doc: ".agents/skills/vpk-deploy/references/guide-deployment.md", paths: ["backend/public"], reason: "created inside the image by backend/Dockerfile" },
	{ doc: ".agents/skills/vpk-deploy/references/guide-manual-deployment.md", paths: ["backend/public", "backend/public/index.html"], reason: "created inside the image by backend/Dockerfile" },
	{ doc: ".agents/skills/vpk-symphony/references/git/push.md", paths: [".github/pull_request_template.md"], reason: "generic git guidance for any repository" },
	{ doc: ".agents/skills/vpk-symphony/references/playwright-cli/spec-driven-testing.md", paths: ["tests/seed.spec.ts"], reason: "the file the playbook tells the agent to create" },
	{ doc: ".agents/skills/vpk-html/references/playbooks/x-thread.md", paths: ["media/p2-1.png"], reason: "an asset value relative to a generated page" },
	{ doc: ".agents/skills/vpk-html/assets/video/landing-demo-separation/DESIGN.md", paths: ["audio/bgm.mp3"], reason: "a slot for a user-provided track" },
	{ doc: ".agents/skills/vpk-tidy/SKILL.md", paths: ["components/blocks/shared", "components/blocks/shared-ui"], reason: "retired buckets the skill checks are gone" },
	{ doc: ".agents/rules/token-priority.md", paths: ["components/blocks/shared-ui"], reason: "a retired bucket named as the mistake" },
	{ doc: ".agents/rules/cursor/token-priority.mdc", paths: ["components/blocks/shared-ui"], reason: "a retired bucket named as the mistake" },
];

// Tracked and not-yet-added files, the directories that hold them, and tracked symlinks.
// Untracked local files (env files, output/, port files) must not make a reference pass
// here and fail in CI; documented generated paths pass because the tracked .gitignore
// ignores them.
function readTrackedTree(cwd) {
	const { spawnSync } = require("node:child_process");
	const result = spawnSync("git", ["ls-files", "-s", "-z"], { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
	if (result.status !== 0) return null;
	// New files not yet added count too, so a doc can point at a file in the same change.
	const untracked = spawnSync("git", ["ls-files", "--others", "--exclude-standard", "-z"], { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
	const entries = [
		...result.stdout.split("\0").filter(Boolean),
		...(untracked.status === 0 ? untracked.stdout.split("\0").filter(Boolean).map((file) => `100644 0 0\t${file}`) : []),
	];
	const paths = new Set();
	const symlinks = new Map();
	const executables = new Set();
	for (const entry of entries) {
		const [meta, file] = entry.split("\t");
		const parts = file.split("/");
		for (let index = 1; index <= parts.length; index += 1) paths.add(parts.slice(0, index).join("/"));
		// An extensionless executable is a repo CLI that no shell has on PATH.
		if (meta.startsWith("100755") && !path.posix.basename(file).includes(".")) executables.add(path.posix.basename(file));
		if (meta.startsWith("120000")) {
			try {
				symlinks.set(file, path.posix.normalize(path.posix.join(path.posix.dirname(file), fs.readlinkSync(path.join(cwd, file)))));
			} catch {
				// A symlink missing from the working tree resolves to nothing.
			}
		}
	}
	return { executables, paths, symlinks };
}

// The shortest ignored ancestor decides, so a path below an ignored directory (or below
// a symlink inside one, as pnpm lays out node_modules) counts as generated.
function createIgnoredPathCheck(cwd) {
	const { spawnSync } = require("node:child_process");
	const cache = new Map();
	const isIgnored = (prefix) => {
		// The trailing-slash form matches directory patterns such as `.claude/worktrees/` even
		// when the directory is absent from this checkout.
		if (!cache.has(prefix)) cache.set(prefix, [prefix, `${prefix}/`].some((query) => spawnSync("git", ["check-ignore", "--no-index", "-q", query], { cwd }).status === 0));
		return cache.get(prefix);
	};
	const parts = (relative) => relative.split("/").map((_, index, all) => all.slice(0, index + 1).join("/"));
	return (relative) => parts(relative).some(isIgnored);
}

// `hasEntry` answers "does this base hold that first segment" from the tracked tree or the
// disk. The whole path must be tracked (directly or through a tracked symlink) or ignored by
// the tracked .gitignore, so the answer is the same locally and in CI.
function createPathChecks(cwd) {
	const tree = readTrackedTree(cwd);
	if (!tree) {
		const onDisk = (relative) => fs.existsSync(path.join(cwd, relative));
		return { cliNames: new Set(), hasEntry: onDisk, isIgnored: () => false, isTracked: onDisk };
	}
	const resolve = (relative) => {
		for (const [link, target] of tree.symlinks) {
			if (relative.startsWith(`${link}/`)) return `${target}${relative.slice(link.length)}`;
		}
		return relative;
	};
	const isIgnoredPath = createIgnoredPathCheck(cwd);
	const isTracked = (relative) => tree.paths.has(relative) || tree.paths.has(resolve(relative));
	return {
		cliNames: tree.executables,
		hasEntry: (relative) => isTracked(relative) || fs.existsSync(path.join(cwd, relative)),
		isIgnored: isIgnoredPath,
		isTracked,
	};
}

function isExternalPathReference(reference) {
	return EXTERNAL_PATH_REFERENCES.some((entry) => entry.doc === reference.filePath && entry.paths.includes(reference.referencePath));
}

// A path in a doc may be repo-relative, relative to the doc, or (inside a skill) relative to
// the skill. A reference is checked against each base whose top level holds its first segment,
// so `origin/main` or `owner/repo` is never mistaken for a path; it is dead only if no such base has it.
function findDeadRepoPathReferences(references, { hasEntry, isTracked, isIgnored }) {
	return references.filter((reference) => {
		if (isExternalPathReference(reference)) return false;
		const docDir = path.posix.dirname(reference.filePath);
		const skillDir = /^\.agents\/skills\/[^/]+/u.exec(reference.filePath)?.[0];
		const bases = [...new Set(["", docDir === "." ? "" : docDir, skillDir].filter((base) => base !== undefined))];
		const firstSegment = reference.referencePath.split("/")[0];
		const candidates = bases.filter((base) => hasEntry(path.posix.join(base, firstSegment)));
		if (candidates.length === 0) return false;
		const joined = candidates.map((base) => path.posix.join(base, reference.referencePath));
		if (joined.some((candidate) => PATH_SUFFIXES.some((suffix) => isTracked(`${candidate}${suffix}`)))) return false;
		return !joined.some((candidate) => isIgnored(candidate));
	});
}

function normalizeProviderName(name) {
	const parts = name.split(/[.:]/u);
	return parts[parts.length - 1] ?? name;
}

function getJsxTagName(tagName, sourceFile) {
	return normalizeProviderName(tagName.getText(sourceFile));
}

function unwrapExpression(expression) {
	if (ts.isParenthesizedExpression(expression)) {
		return unwrapExpression(expression.expression);
	}
	return expression;
}

function getPrimaryJsxElementChain(node, sourceFile) {
	const expression = unwrapExpression(node);
	if (ts.isJsxSelfClosingElement(expression)) {
		return [getJsxTagName(expression.tagName, sourceFile)];
	}
	if (ts.isJsxElement(expression)) {
		const name = getJsxTagName(expression.openingElement.tagName, sourceFile);
		const child = expression.children.find((item) => ts.isJsxElement(item));
		return child ? [name, ...getPrimaryJsxElementChain(child, sourceFile)] : [name];
	}
	if (ts.isJsxFragment(expression)) {
		const child = expression.children.find((item) => ts.isJsxElement(item));
		return child ? getPrimaryJsxElementChain(child, sourceFile) : [];
	}
	return [];
}

function extractProviderCompositionFromSource(source, filePath = PROVIDERS_SOURCE_PATH) {
	const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
	let providerStack = null;

	function visit(node) {
		if (
			providerStack === null &&
			ts.isFunctionDeclaration(node) &&
			node.name?.text === "Providers" &&
			node.body
		) {
			function findReturn(child) {
				if (providerStack !== null) {
					return;
				}
				if (ts.isReturnStatement(child) && child.expression) {
					providerStack = getPrimaryJsxElementChain(child.expression, sourceFile);
					return;
				}
				ts.forEachChild(child, findReturn);
			}
			ts.forEachChild(node.body, findReturn);
			return;
		}

		ts.forEachChild(node, visit);
	}

	visit(sourceFile);
	return providerStack ?? [];
}

function extractProviderCompositionFromDocs(content, filePath = PROVIDER_COMPOSITION_DOC_PATH) {
	const headingMatch = /^## Provider Composition\b.*$/mu.exec(content);
	if (!headingMatch) {
		return {
			filePath,
			line: 1,
			stack: [],
		};
	}

	const sectionStart = headingMatch.index;
	const sectionBodyStart = sectionStart + headingMatch[0].length;
	const remainingContent = content.slice(sectionBodyStart);
	const nextSectionMatch = /^## /mu.exec(remainingContent);
	const sectionBody = nextSectionMatch
		? remainingContent.slice(0, nextSectionMatch.index)
		: remainingContent;
	const blockMatch = /```text\s*([\s\S]*?)```/u.exec(sectionBody);
	if (!blockMatch) {
		return {
			filePath,
			line: getLineNumber(content, sectionBodyStart),
			stack: [],
		};
	}

	const blockStart = sectionBodyStart + sectionBody.indexOf(blockMatch[0]);
	return {
		filePath,
		line: getLineNumber(content, blockStart),
		stack: blockMatch[1]
			.split(/\r?\n/u)
			.map((line) => line.trim().replace(/^->\s*/u, "").trim())
			.filter(Boolean)
			.map(normalizeProviderName),
	};
}

function readPackageScripts(cwd = process.cwd()) {
	const packageJson = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8"));
	return packageJson.scripts ?? {};
}

function formatProviderStack(stack) {
	return stack.join(" -> ");
}

function verifyProviderCompositionDocs({ cwd = process.cwd(), files = collectDocumentationFiles({ cwd }) } = {}) {
	if (!files.includes(PROVIDER_COMPOSITION_DOC_PATH)) {
		return {
			actualStack: [],
			documentedStack: [],
			failures: [],
		};
	}

	const docPath = path.join(cwd, PROVIDER_COMPOSITION_DOC_PATH);
	const sourcePath = path.join(cwd, PROVIDERS_SOURCE_PATH);
	const documented = extractProviderCompositionFromDocs(
		fs.readFileSync(docPath, "utf8"),
		PROVIDER_COMPOSITION_DOC_PATH,
	);
	const actualStack = fs.existsSync(sourcePath)
		? extractProviderCompositionFromSource(fs.readFileSync(sourcePath, "utf8"), PROVIDERS_SOURCE_PATH)
		: [];
	const documentedStack = documented.stack;

	if (
		documentedStack.length === actualStack.length &&
		documentedStack.every((item, index) => item === actualStack[index])
	) {
		return {
			actualStack,
			documentedStack,
			failures: [],
		};
	}

	return {
		actualStack,
		documentedStack,
		failures: [{
			filePath: PROVIDER_COMPOSITION_DOC_PATH,
			line: documented.line,
			message: `Provider Composition is out of sync with ${PROVIDERS_SOURCE_PATH}. Documented: ${formatProviderStack(documentedStack) || "(missing)"}. Actual: ${formatProviderStack(actualStack) || "(missing)"}.`,
			type: "provider-composition",
		}],
	};
}

function extractMarkedSection(content, beginMarker, endMarker, filePath = "unknown") {
	const beginIndex = content.indexOf(beginMarker);
	if (beginIndex === -1) {
		return {
			body: "",
			filePath,
			line: 1,
			missing: true,
		};
	}

	const bodyStart = beginIndex + beginMarker.length;
	const endIndex = content.indexOf(endMarker, bodyStart);
	if (endIndex === -1) {
		return {
			body: content.slice(bodyStart),
			filePath,
			line: getLineNumber(content, beginIndex),
			missingEnd: true,
		};
	}

	return {
		body: content.slice(bodyStart, endIndex),
		filePath,
		line: getLineNumber(content, beginIndex),
	};
}

function verifyAgentsFreshnessSection({ cwd = process.cwd(), files = collectDocumentationFiles({ cwd }) } = {}) {
	if (!files.includes(AGENTS_FRESHNESS_DOC_PATH)) {
		return {
			failures: [],
		};
	}

	const content = fs.readFileSync(path.join(cwd, AGENTS_FRESHNESS_DOC_PATH), "utf8");
	const section = extractMarkedSection(
		content,
		AGENTS_FRESHNESS_BEGIN,
		AGENTS_FRESHNESS_END,
		AGENTS_FRESHNESS_DOC_PATH,
	);
	if (section.missing) {
		return {
			failures: [{
				filePath: AGENTS_FRESHNESS_DOC_PATH,
				line: 1,
				message: `Missing ${AGENTS_FRESHNESS_BEGIN} block with validation freshness details.`,
				type: "agents-freshness",
			}],
		};
	}
	if (section.missingEnd) {
		return {
			failures: [{
				filePath: AGENTS_FRESHNESS_DOC_PATH,
				line: section.line,
				message: `Missing ${AGENTS_FRESHNESS_END} marker for validation freshness details.`,
				type: "agents-freshness",
			}],
		};
	}

	const failures = [];
	for (const command of REQUIRED_AGENTS_FRESHNESS_COMMANDS) {
		if (!section.body.includes(command)) {
			failures.push({
				filePath: AGENTS_FRESHNESS_DOC_PATH,
				line: section.line,
				message: `Validation freshness block is missing required command \`${command}\`.`,
				type: "agents-freshness",
			});
		}
	}
	for (const link of REQUIRED_AGENTS_FRESHNESS_LINKS) {
		if (!section.body.includes(link)) {
			failures.push({
				filePath: AGENTS_FRESHNESS_DOC_PATH,
				line: section.line,
				message: `Validation freshness block is missing required reference \`${link}\`.`,
				type: "agents-freshness",
			});
		}
	}

	return {
		failures,
	};
}

function verifyDocumentedScripts({
	cwd = process.cwd(),
	files = collectDocumentationFiles({ cwd }),
	packageScripts = readPackageScripts(cwd),
	pathChecks = null,
} = {}) {
	const scriptNames = new Set(Object.keys(packageScripts));
	const documents = files.map((filePath) => ({
		content: fs.readFileSync(path.join(cwd, filePath), "utf8"),
		filePath,
	}));
	const references = documents.flatMap(({ content, filePath }) => {
		return extractPnpmRunScriptReferences(content, filePath);
	});
	const skillReferences = documents.flatMap(({ content, filePath }) => {
		return extractLocalSkillEntrypointReferences(content, filePath);
	});
	const scriptFailures = references
		.filter((reference) => !scriptNames.has(reference.scriptName))
		.map((reference) => ({
			...reference,
			message: `Documented command \`${reference.command}\` references missing package.json script \`${reference.scriptName}\`.`,
		}));
	const skillFailures = skillReferences
		.filter((reference) => !fs.existsSync(path.join(cwd, reference.referencePath)))
		.map((reference) => ({
			...reference,
			message: `Documented local skill \`${reference.referencePath}\` does not exist.`,
		}));
	const pathReferences = documents.flatMap(({ content, filePath }) => extractRepoPathReferences(content, filePath));
	const checks = pathChecks ?? createPathChecks(cwd);
	const pathFailures = findDeadRepoPathReferences(pathReferences, checks).map((reference) => ({
		...reference,
		message: `Documented path \`${reference.text}\` does not exist.`,
	}));
	const cliReferences = documents.flatMap(({ content, filePath }) => extractBareCliReferences(content, filePath, checks.cliNames ?? new Set()));
	const cliFailures = cliReferences.map((reference) => ({
		...reference,
		message: scriptNames.has(reference.cliName)
			? `Documented command \`${reference.cliName} …\` is not on PATH; write \`pnpm ${reference.cliName} …\`.`
			: `Documented command \`${reference.cliName} …\` is not on PATH; call it by its repo path or add a package script.`,
	}));
	const providerComposition = verifyProviderCompositionDocs({ cwd, files });
	const agentsFreshness = verifyAgentsFreshnessSection({ cwd, files });

	return {
		failures: [...scriptFailures, ...skillFailures, ...pathFailures, ...cliFailures, ...providerComposition.failures, ...agentsFreshness.failures],
		fileCount: files.length,
		providerComposition: {
			actualStack: providerComposition.actualStack,
			documentedStack: providerComposition.documentedStack,
		},
		pathReferenceCount: pathReferences.length,
		referenceCount: references.length,
		references,
		skillReferenceCount: skillReferences.length,
		skillReferences,
	};
}

function formatFailure(failure) {
	if (failure.command) {
		return `${failure.filePath}:${failure.line} ${failure.message}`;
	}
	if (failure.referencePath) {
		return `${failure.filePath}:${failure.line} ${failure.message}`;
	}
	if (failure.type === "provider-composition") {
		return `${failure.filePath}:${failure.line} ${failure.message}`;
	}
	if (failure.type === "agents-freshness") {
		return `${failure.filePath}:${failure.line} ${failure.message}`;
	}
	return `${failure.filePath ?? "unknown"}:${failure.line ?? 0} ${failure.message ?? "Unknown documentation reference failure."}`;
}

function parseArgs(argv) {
	const options = {
		json: false,
		targets: [],
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--json") {
			options.json = true;
			continue;
		}
		if (arg === "--target") {
			const value = argv[index + 1];
			if (!value) {
				throw new Error("--target requires a value");
			}
			options.targets.push(value);
			index += 1;
			continue;
		}
		if (arg.startsWith("--target=")) {
			const value = arg.slice("--target=".length);
			if (!value) {
				throw new Error("--target requires a value");
			}
			options.targets.push(value);
			continue;
		}
		throw new Error(`Unknown argument: ${arg}`);
	}

	return options;
}

function main(argv = process.argv.slice(2), cwd = process.cwd()) {
	const options = parseArgs(argv);
	const targets = options.targets.length > 0 ? options.targets : DEFAULT_DOC_TARGETS;
	const result = verifyDocumentedScripts({
		cwd,
		files: collectDocumentationFiles({ cwd, targets }),
	});

	if (options.json) {
		console.log(JSON.stringify(result, null, "\t"));
	}

	if (result.failures.length > 0) {
		if (!options.json) {
			console.error("Documentation references are out of sync:");
			for (const failure of result.failures) {
				console.error(`- ${formatFailure(failure)}`);
			}
		}
		process.exitCode = 1;
		return;
	}

	if (!options.json) {
		console.log(`Verified documented pnpm run references (${result.referenceCount} references), local skill entrypoints (${result.skillReferenceCount} references) and repo paths (${result.pathReferenceCount} references) in ${result.fileCount} files.`);
	}
}

if (require.main === module) {
	try {
		main();
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}

module.exports = {
	DEFAULT_DOC_TARGETS,
	collectDocumentationFiles,
	extractProviderCompositionFromDocs,
	extractProviderCompositionFromSource,
	extractLocalSkillEntrypointReferences,
	extractPnpmRunScriptReferences,
	extractBareCliReferences,
	extractRepoPathReferences,
	findDeadRepoPathReferences,
	formatFailure,
	parseArgs,
	verifyAgentsFreshnessSection,
	verifyProviderCompositionDocs,
	verifyDocumentedScripts,
};
