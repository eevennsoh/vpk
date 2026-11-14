#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	renameSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
	assertRegularFile,
	canonicalizeWorkspaceRoot,
	listCopyFiles,
	listGlobMatches,
	normalizeRelativePath,
	resolveWorkspacePath,
} from "./lib/jira-variant-filesystem.mjs";
import { prepareRegistrationRule } from "./lib/jira-variant-registration-rules.mjs";
import {
	assertNoAmbiguousTargetIdentifiers,
	assertNoSourceIdentifiers,
	rewriteText,
} from "./lib/jira-variant-text.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_MANIFEST_PATH = path.join(
	SCRIPT_DIR,
	"fixtures/jira-variant-manifest.json",
);

const TEXT_EXTENSIONS = new Set([
	".cjs",
	".css",
	".html",
	".js",
	".json",
	".jsx",
	".md",
	".mjs",
	".scss",
	".svg",
	".ts",
	".tsx",
	".txt",
	".yaml",
	".yml",
]);

function hashContent(content) {
	return createHash("sha256").update(content).digest("hex");
}

function normalizeVersion(value, label) {
	const match = String(value ?? "").match(/^v?(\d+)$/u);
	if (!match) {
		throw new Error(`${label} must be a version such as v2`);
	}
	return Number(match[1]);
}

export function createVersionIdentity(value, label = "version") {
	const number = normalizeVersion(value, label);
	return {
		camel: `jiraGoldenJourneyV${number}`,
		experimentalCamel: `experimentalV${number}`,
		experimentalPascal: `ExperimentalV${number}`,
		experimentalSlug: `experimental-v${number}`,
		experimentalUpper: `EXPERIMENTAL_V${number}`,
		number,
		pascal: `JiraGoldenJourneyV${number}`,
		previousVersion: `v${number - 1}`,
		slug: `jira-golden-journey-v${number}`,
		title: `Jira Golden Journey v${number}`,
		upper: `JIRA_GOLDEN_JOURNEY_V${number}`,
		version: `v${number}`,
	};
}

function buildTemplateValues(source, target) {
	const values = {};
	for (const [key, value] of Object.entries(source)) {
		values[`source${key[0].toUpperCase()}${key.slice(1)}`] = String(value);
	}
	for (const [key, value] of Object.entries(target)) {
		values[`target${key[0].toUpperCase()}${key.slice(1)}`] = String(value);
	}
	return values;
}

function expandTemplate(template, values) {
	if (typeof template !== "string") {
		throw new Error("manifest templates must be strings");
	}
	return template.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/gu, (placeholder, key) => {
		if (!(key in values)) {
			throw new Error(`unknown manifest placeholder: ${placeholder}`);
		}
		return values[key];
	});
}

function expandManifestTemplates(value, values) {
	if (typeof value === "string") return expandTemplate(value, values);
	if (Array.isArray(value)) {
		return value.map((entry) => expandManifestTemplates(entry, values));
	}
	if (value && typeof value === "object") {
		return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
			key,
			expandManifestTemplates(entry, values),
		]));
	}
	return value;
}

function resolveRewriteRules(manifest, values) {
	const rules = (manifest.rewrites ?? []).map((entry) => ({
		from: expandTemplate(entry.from, values),
		to: expandTemplate(entry.to, values),
	}));
	const seen = new Map();
	for (const rule of rules) {
		if (!rule.from || rule.from === rule.to) {
			throw new Error(`invalid rewrite rule: ${JSON.stringify(rule)}`);
		}
		if (seen.has(rule.from)) {
			throw new Error(`ambiguous rewrite source: ${rule.from}`);
		}
		seen.set(rule.from, rule.to);
	}
	return rules.sort((left, right) => {
		return right.from.length - left.from.length || left.from.localeCompare(right.from);
	});
}

function isTextFile(filePath) {
	return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function prepareCopyOperation({
	absoluteSource,
	relativeSource,
	relativeTarget,
	rewriteRules,
	source,
	target,
}) {
	const rawContent = readFileSync(absoluteSource);
	let preparedContent = rawContent;
	let rewriteCount = 0;
	const text = isTextFile(relativeSource);
	if (text) {
		const sourceContent = rawContent.toString("utf8");
		assertNoAmbiguousTargetIdentifiers(sourceContent, target, relativeSource);
		const rewritten = rewriteText(sourceContent, rewriteRules);
		assertNoSourceIdentifiers(rewritten.content, source, relativeTarget);
		preparedContent = Buffer.from(rewritten.content);
		rewriteCount = rewritten.rewriteCount;
	}
	assertNoSourceIdentifiers(relativeTarget, source, relativeTarget);
	return {
		binary: !text,
		bytes: preparedContent.byteLength,
		outputHash: hashContent(preparedContent),
		preparedContent,
		rewriteCount,
		source: relativeSource,
		sourceHash: hashContent(rawContent),
		target: relativeTarget,
	};
}

function prepareCopyOperations({ manifest, reusedTargetsById, rewriteRules, root, source, target, values }) {
	const operations = [];
	const targetRoots = new Set();
	const skipped = [];
	for (const template of manifest.copyTemplates ?? []) {
		if (template.reusableTarget && reusedTargetsById.has(template.reusableTarget)) continue;
		if (template.sourceGlob) {
			const sourceGlob = expandTemplate(template.sourceGlob, values);
			const matches = listGlobMatches(root, sourceGlob);
			if (matches.length === 0) {
				if (template.optional) {
					skipped.push(sourceGlob);
					continue;
				}
				throw new Error(`required source glob has no matches: ${sourceGlob}`);
			}
			for (const relativeSource of matches) {
				const { content: rewrittenTarget } = rewriteText(relativeSource, rewriteRules);
				const relativeTarget = normalizeRelativePath(rewrittenTarget, "target path");
				const targetPath = resolveWorkspacePath(root, relativeTarget, "target path");
				if (existsSync(targetPath.absolutePath)) {
					throw new Error(`target path already exists: ${relativeTarget}`);
				}
				targetRoots.add(relativeTarget);
				operations.push(prepareCopyOperation({
					absoluteSource: resolveWorkspacePath(root, relativeSource, "source path").absolutePath,
					relativeSource,
					relativeTarget,
					rewriteRules,
					source,
					target,
				}));
			}
			continue;
		}

		const sourceRoot = expandTemplate(template.source, values);
		const targetRoot = expandTemplate(template.target, values);
		const sourcePath = resolveWorkspacePath(root, sourceRoot, "source path");
		const targetPath = resolveWorkspacePath(root, targetRoot, "target path");
		if (!existsSync(sourcePath.absolutePath)) {
			if (template.optional) {
				skipped.push(sourceRoot);
				continue;
			}
			throw new Error(`required source path does not exist: ${sourceRoot}`);
		}
		if (existsSync(targetPath.absolutePath)) {
			throw new Error(`target path already exists: ${targetRoot}`);
		}
		targetRoots.add(targetRoot);
		for (const absoluteSource of listCopyFiles(sourcePath.absolutePath)) {
			const suffix = absoluteSource === sourcePath.absolutePath
				? ""
				: path.relative(sourcePath.absolutePath, absoluteSource).split(path.sep).join("/");
			const relativeSource = suffix ? `${sourceRoot}/${suffix}` : sourceRoot;
			const rewrittenSuffix = suffix ? rewriteText(suffix, rewriteRules).content : "";
			const relativeTarget = rewrittenSuffix ? `${targetRoot}/${rewrittenSuffix}` : targetRoot;
			operations.push(prepareCopyOperation({
				absoluteSource,
				relativeSource,
				relativeTarget,
				rewriteRules,
				source,
				target,
			}));
		}
	}

	operations.sort((left, right) => left.target.localeCompare(right.target));
	const seenTargets = new Set();
	for (const operation of operations) {
		if (seenTargets.has(operation.target)) {
			throw new Error(`duplicate target path in plan: ${operation.target}`);
		}
		seenTargets.add(operation.target);
	}
	return {
		operations,
		skipped: skipped.sort((left, right) => left.localeCompare(right)),
		targetRoots: [...targetRoots].sort((left, right) => left.localeCompare(right)),
	};
}

/**
 * Resolves which reusable targets already exist in the workspace. A reusable
 * target (for example an experimental block variant that was added on its own,
 * before the matching project) keeps its files and registrations as they are:
 * the plan skips the copies and registrations tagged with its id and only
 * checks that every registration file already names the existing target.
 */
function resolveReusedTargets({ manifest, root, values }) {
	const declared = new Map();
	for (const template of manifest.reusableTargets ?? []) {
		const entry = expandManifestTemplates(template, values);
		const markers = entry.registeredMarkers;
		const validMarkers = Array.isArray(markers) && markers.length > 0
			&& markers.every((marker) => typeof marker === "string" && marker.length > 0);
		if (!entry.id || !entry.path || !validMarkers || declared.has(entry.id)) {
			throw new Error(`invalid reusable target: ${JSON.stringify(template)}`);
		}
		declared.set(entry.id, entry);
	}
	for (const entry of [...(manifest.copyTemplates ?? []), ...(manifest.registrations ?? [])]) {
		if (entry.reusableTarget && !declared.has(entry.reusableTarget)) {
			throw new Error(`unknown reusable target: ${entry.reusableTarget}`);
		}
	}
	const reused = [];
	for (const entry of declared.values()) {
		const resolved = resolveWorkspacePath(root, entry.path, "reusable target");
		if (existsSync(resolved.absolutePath)) {
			reused.push({ id: entry.id, path: entry.path, registeredMarkers: entry.registeredMarkers });
		}
	}
	return reused.sort((left, right) => left.id.localeCompare(right.id));
}

/**
 * The text a registration rule would have written for its target, and the text
 * it copies from.
 */
function registrationRuleTexts(rule) {
	if (rule.kind === "line" || rule.kind === "replace") {
		return { source: rule.source, target: rule.target };
	}
	if (rule.kind === "block") return { source: rule.start, target: rule.targetStart };
	return { source: rule.sourceMarker, target: rule.targetMarker };
}

const REGISTRATION_TOKEN_PATTERN = /[A-Za-z0-9_@/.-]+/gu;

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

/**
 * The identifiers a skipped registration rule would have written for a reused
 * target: every token of its target text that names one of the target's
 * markers (for example `jira-work-item-demo-experimental-v5-empty` or
 * `ExperimentalV5JiraWorkItem`). Checking these tokens rather than the exact
 * target text tolerates formatting drift in hand-registered variants, while
 * still catching a single missing registration.
 */
export function registrationTokens(target, markers) {
	const tokens = new Set();
	for (const token of target.match(REGISTRATION_TOKEN_PATTERN) ?? []) {
		const trimmed = token.replace(/^[./-]+|[./-]+$/gu, "");
		if (markers.some((marker) => trimmed.includes(marker))) tokens.add(trimmed);
	}
	return [...tokens];
}

function containsToken(content, token) {
	return new RegExp(`(?<![A-Za-z0-9_-])${escapeRegExp(token)}(?![A-Za-z0-9_-])`, "u").test(content);
}

function assertReusedRegistration(root, rule, reusedTarget) {
	const resolved = resolveWorkspacePath(root, rule.file, "registration file");
	if (!existsSync(resolved.absolutePath)) {
		if (rule.optional) return;
		throw new Error(`registration file does not exist: ${rule.file}`);
	}
	assertRegularFile(resolved.absolutePath, `registration file ${rule.file}`);
	const { source, target } = registrationRuleTexts(rule);
	if (typeof target !== "string") return;
	// Rules whose output names no marker (prose rewrites) register nothing.
	const tokens = registrationTokens(target, reusedTarget.registeredMarkers);
	if (tokens.length === 0) return;
	const content = readFileSync(resolved.absolutePath, "utf8");
	if (rule.optional && typeof source === "string" && !content.includes(source)) return;
	const missing = tokens.filter((token) => !containsToken(content, token));
	if (missing.length > 0) {
		throw new Error(
			`existing ${reusedTarget.id} target ${reusedTarget.path} is not registered in ${rule.file}: missing ${missing.join(", ")}`,
		);
	}
}

function prepareRegistrationOperations({ manifest, reusedTargetsById, rewriteRules, root, source, values }) {
	const fileOperations = new Map();
	const summaries = [];
	for (const template of manifest.registrations ?? []) {
		const rule = expandManifestTemplates(template, values);
		if (rule.reusableTarget && reusedTargetsById.has(rule.reusableTarget)) {
			assertReusedRegistration(root, rule, reusedTargetsById.get(rule.reusableTarget));
			summaries.push({ file: rule.file, insertedCount: 0, kind: rule.kind, reused: true, skipped: true });
			continue;
		}
		const resolved = resolveWorkspacePath(root, rule.file, "registration file");
		if (!existsSync(resolved.absolutePath)) {
			if (rule.optional) {
				summaries.push({ file: rule.file, insertedCount: 0, kind: rule.kind, skipped: true });
				continue;
			}
			throw new Error(`registration file does not exist: ${rule.file}`);
		}
		assertRegularFile(resolved.absolutePath, `registration file ${rule.file}`);
		const current = fileOperations.get(rule.file) ?? {
			file: rule.file,
			originalContent: readFileSync(resolved.absolutePath),
		};
		const input = current.preparedContent?.toString("utf8") ?? current.originalContent.toString("utf8");
		const result = prepareRegistrationRule(input, rule, rewriteRules, source);
		current.preparedContent = Buffer.from(result.content);
		fileOperations.set(rule.file, current);
		summaries.push({
			file: rule.file,
			insertedCount: result.insertedCount,
			kind: rule.kind,
			skipped: result.insertedCount === 0,
		});
	}

	const operations = [...fileOperations.values()]
		.map((operation) => ({
			file: operation.file,
			outputHash: hashContent(operation.preparedContent),
			preparedContent: operation.preparedContent,
			sourceHash: hashContent(operation.originalContent),
		}))
		.sort((left, right) => left.file.localeCompare(right.file));
	return { operations, summaries };
}

export function loadVariantManifest(manifestPath = DEFAULT_MANIFEST_PATH) {
	const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
	if (manifest.schemaVersion !== 1 || manifest.family !== "jira-golden-journey") {
		throw new Error(`unsupported Jira variant manifest: ${manifestPath}`);
	}
	return manifest;
}

export function createJiraVariantPlan({
	manifest = loadVariantManifest(),
	root = process.cwd(),
	source: sourceValue,
	target: targetValue,
}) {
	const absoluteRoot = canonicalizeWorkspaceRoot(root);
	if (absoluteRoot === path.parse(absoluteRoot).root) {
		throw new Error("workspace root cannot be a filesystem root");
	}
	const source = createVersionIdentity(sourceValue, "source");
	const target = createVersionIdentity(targetValue, "target");
	if (target.number !== source.number + 1) {
		throw new Error(
			`target version must be the immediate successor of source version ${source.version}`,
		);
	}
	const values = buildTemplateValues(source, target);
	const rewriteRules = resolveRewriteRules(manifest, values);
	const reusedTargets = resolveReusedTargets({ manifest, root: absoluteRoot, values });
	const reusedTargetsById = new Map(reusedTargets.map((entry) => [entry.id, entry]));
	const copies = prepareCopyOperations({
		manifest,
		reusedTargetsById,
		rewriteRules,
		root: absoluteRoot,
		source,
		target,
		values,
	});
	const registrations = prepareRegistrationOperations({
		manifest,
		reusedTargetsById,
		rewriteRules,
		root: absoluteRoot,
		source,
		values,
	});
	return {
		copyOperations: copies.operations,
		family: manifest.family,
		postApplyCommands: structuredClone(manifest.postApplyCommands ?? []),
		registrationOperations: registrations.operations,
		registrationSummaries: registrations.summaries,
		reusedTargets,
		rewriteRules,
		root: absoluteRoot,
		schemaVersion: 1,
		skippedCopySources: copies.skipped,
		source,
		target,
		targetRoots: copies.targetRoots,
		validationCommands: structuredClone(manifest.validationCommands ?? []),
	};
}

export function summarizePlan(plan) {
	const summary = {
		copies: plan.copyOperations.map((operation) => ({
			binary: operation.binary,
			bytes: operation.bytes,
			outputHash: operation.outputHash,
			rewriteCount: operation.rewriteCount,
			source: operation.source,
			target: operation.target,
		})),
		family: plan.family,
		isolation: {
			duplicateTargetPaths: [],
			unresolvedSourceIdentifiers: [],
		},
		postApplyCommands: structuredClone(plan.postApplyCommands),
		registrationFiles: plan.registrationOperations.map((operation) => ({
			file: operation.file,
			outputHash: operation.outputHash,
			sourceHash: operation.sourceHash,
		})),
		registrations: structuredClone(plan.registrationSummaries),
		reusedTargets: structuredClone(plan.reusedTargets),
		rewrites: structuredClone(plan.rewriteRules),
		schemaVersion: plan.schemaVersion,
		skippedCopySources: [...plan.skippedCopySources],
		source: structuredClone(plan.source),
		target: structuredClone(plan.target),
		targetRoots: [...plan.targetRoots],
		validationCommands: structuredClone(plan.validationCommands),
	};
	return {
		...summary,
		planFingerprint: hashContent(JSON.stringify(summary)),
	};
}

function assertPlanInputsUnchanged(plan) {
	for (const operation of plan.copyOperations) {
		const source = resolveWorkspacePath(plan.root, operation.source, "source path");
		assertRegularFile(source.absolutePath, `source path ${operation.source}`);
		if (!existsSync(source.absolutePath) || hashContent(readFileSync(source.absolutePath)) !== operation.sourceHash) {
			throw new Error(`source changed after planning: ${operation.source}`);
		}
		const target = resolveWorkspacePath(plan.root, operation.target, "target path");
		if (existsSync(target.absolutePath)) {
			throw new Error(`target path already exists: ${operation.target}`);
		}
	}
	for (const operation of plan.registrationOperations) {
		const registration = resolveWorkspacePath(plan.root, operation.file, "registration file");
		assertRegularFile(registration.absolutePath, `registration file ${operation.file}`);
		if (
			!existsSync(registration.absolutePath) ||
			hashContent(readFileSync(registration.absolutePath)) !== operation.sourceHash
		) {
			throw new Error(`registration changed after planning: ${operation.file}`);
		}
	}
}

function writePreparedFile(root, relativePath, content) {
	const resolved = resolveWorkspacePath(root, relativePath, "prepared file");
	mkdirSync(path.dirname(resolved.absolutePath), { recursive: true });
	writeFileSync(resolved.absolutePath, content);
}

function stagePlan(plan, stagingRoot) {
	for (const operation of plan.copyOperations) {
		writePreparedFile(stagingRoot, operation.target, operation.preparedContent);
	}
	for (const operation of plan.registrationOperations) {
		writePreparedFile(stagingRoot, operation.file, operation.preparedContent);
	}
	for (const operation of [...plan.copyOperations, ...plan.registrationOperations]) {
		const relativePath = operation.target ?? operation.file;
		const staged = resolveWorkspacePath(stagingRoot, relativePath, "staged file");
		if (hashContent(readFileSync(staged.absolutePath)) !== operation.outputHash) {
			throw new Error(`staged output hash mismatch: ${relativePath}`);
		}
	}
}

function snapshotCommandWrites(plan) {
	const snapshots = new Map();
	for (const command of plan.postApplyCommands) {
		if (!Array.isArray(command.writes) || command.writes.length === 0) {
			throw new Error(`post-apply command ${command.id} must declare writes`);
		}
		for (const relativePath of command.writes) {
			if (snapshots.has(relativePath)) continue;
			const resolved = resolveWorkspacePath(plan.root, relativePath, "post-apply output");
			snapshots.set(relativePath, existsSync(resolved.absolutePath)
				? { content: readFileSync(resolved.absolutePath), existed: true }
				: { content: null, existed: false });
		}
	}
	return snapshots;
}

function runPlanCommand(commandSpec, root, runner) {
	if (!commandSpec.id || !Array.isArray(commandSpec.command) || commandSpec.command.length === 0) {
		throw new Error("plan commands require an id and a non-empty command array");
	}
	const [rawCommand, ...args] = commandSpec.command;
	const command = rawCommand === "node" ? process.execPath : rawCommand;
	const result = runner(command, args, {
		cwd: root,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});
	if (result.status !== 0) {
		const detail = [result.stderr, result.stdout]
			.filter(Boolean)
			.join("\n")
			.trim();
		throw new Error(
			`command ${commandSpec.id} failed with status ${result.status ?? "unknown"}${detail ? `: ${detail}` : ""}`,
		);
	}
	return {
		command: [...commandSpec.command],
		id: commandSpec.id,
		status: result.status,
	};
}

function restoreSnapshot(root, relativePath, snapshot) {
	const resolved = resolveWorkspacePath(root, relativePath, "rollback path");
	if (!snapshot.existed) {
		rmSync(resolved.absolutePath, { force: true, recursive: true });
		return;
	}
	mkdirSync(path.dirname(resolved.absolutePath), { recursive: true });
	writeFileSync(resolved.absolutePath, snapshot.content);
}

function rollbackPlan(plan, registrationSnapshots, commandWriteSnapshots) {
	for (const targetRoot of [...plan.targetRoots].sort((left, right) => right.length - left.length)) {
		const resolved = resolveWorkspacePath(plan.root, targetRoot, "rollback target");
		rmSync(resolved.absolutePath, { force: true, recursive: true });
	}
	for (const [file, snapshot] of registrationSnapshots) {
		restoreSnapshot(plan.root, file, snapshot);
	}
	for (const [file, snapshot] of commandWriteSnapshots) {
		restoreSnapshot(plan.root, file, snapshot);
	}
}

export function applyJiraVariantPlan(plan, {
	commandRunner = spawnSync,
} = {}) {
	assertPlanInputsUnchanged(plan);
	const registrationSnapshots = new Map(plan.registrationOperations.map((operation) => [
		operation.file,
		{ content: readFileSync(path.join(plan.root, operation.file)), existed: true },
	]));
	const commandWriteSnapshots = snapshotCommandWrites(plan);
	const stagingRoot = mkdtempSync(path.join(plan.root, ".jira-variant-stage-"));
	const commands = [];
	try {
		stagePlan(plan, stagingRoot);
		for (const operation of plan.copyOperations) {
			const staged = resolveWorkspacePath(stagingRoot, operation.target, "staged target");
			const target = resolveWorkspacePath(plan.root, operation.target, "target path");
			mkdirSync(path.dirname(target.absolutePath), { recursive: true });
			renameSync(staged.absolutePath, target.absolutePath);
		}
		for (const operation of plan.registrationOperations) {
			const staged = resolveWorkspacePath(stagingRoot, operation.file, "staged registration");
			const target = resolveWorkspacePath(plan.root, operation.file, "registration file");
			renameSync(staged.absolutePath, target.absolutePath);
		}
		for (const operation of [...plan.copyOperations, ...plan.registrationOperations]) {
			const relativePath = operation.target ?? operation.file;
			const written = resolveWorkspacePath(plan.root, relativePath, "written file");
			if (hashContent(readFileSync(written.absolutePath)) !== operation.outputHash) {
				throw new Error(`written output hash mismatch: ${relativePath}`);
			}
		}
		for (const command of plan.postApplyCommands) {
			commands.push(runPlanCommand(command, plan.root, commandRunner));
		}
		for (const command of plan.validationCommands) {
			commands.push(runPlanCommand(command, plan.root, commandRunner));
		}
		return {
			commands,
			copiedFileCount: plan.copyOperations.length,
			planFingerprint: summarizePlan(plan).planFingerprint,
			registrations: structuredClone(plan.registrationSummaries),
			source: structuredClone(plan.source),
			status: "applied",
			target: structuredClone(plan.target),
		};
	} catch (error) {
		rollbackPlan(plan, registrationSnapshots, commandWriteSnapshots);
		throw error;
	} finally {
		rmSync(stagingRoot, { force: true, recursive: true });
	}
}

export function parseArgs(argv) {
	const options = {
		apply: false,
		help: false,
		json: false,
		manifestPath: DEFAULT_MANIFEST_PATH,
		planFingerprint: null,
		root: process.cwd(),
		source: null,
		target: null,
	};
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (index === 0 && arg === "--") {
			continue;
		}
		if (arg === "--apply") {
			options.apply = true;
			continue;
		}
		if (arg === "--dry-run") {
			options.apply = false;
			continue;
		}
		if (arg === "--json") {
			options.json = true;
			continue;
		}
		if (arg === "--help" || arg === "-h") {
			options.help = true;
			continue;
		}
		const namedOption = ["--manifest", "--plan-fingerprint", "--root", "--source", "--target"]
			.find((name) => arg === name || arg.startsWith(`${name}=`));
		if (namedOption) {
			const value = arg === namedOption ? argv[++index] : arg.slice(namedOption.length + 1);
			if (!value) throw new Error(`${namedOption} requires a value`);
			const key = namedOption === "--manifest"
				? "manifestPath"
				: namedOption === "--plan-fingerprint"
					? "planFingerprint"
					: namedOption.slice(2);
			options[key] = value;
			continue;
		}
		throw new Error(`unknown argument: ${arg}`);
	}
	if (!options.help && (!options.source || !options.target)) {
		throw new Error("--source and --target are required");
	}
	if (!options.help && options.apply && !options.planFingerprint) {
		throw new Error("--apply requires --plan-fingerprint from a reviewed dry run");
	}
	return options;
}

function printHelp() {
	console.log([
		"Usage: node scripts/scaffold-jira-variant.mjs --source <version> --target <version> [options]",
		"",
		"Options:",
		"  --dry-run          Print the proposed plan without writing (default).",
		"  --apply            Apply the exact plan, regenerate repo-map, and validate.",
		"  --plan-fingerprint <sha256>  Required with --apply; copied from the reviewed dry run.",
		"  --root <path>      Workspace root (default: current directory).",
		"  --manifest <path>  Planner manifest override.",
		"  --json             Emit machine-readable JSON.",
	].join("\n"));
}

function formatPlanText(summary) {
	return [
		`Jira variant dry run: ${summary.source.version} -> ${summary.target.version}`,
		`Copies: ${summary.copies.length}`,
		`Registrations: ${summary.registrations.filter((entry) => !entry.skipped).length}`,
		...summary.reusedTargets.map((entry) => `Reusing existing ${entry.id}: ${entry.path}`),
		`Post-apply commands: ${summary.postApplyCommands.map((entry) => entry.id).join(", ")}`,
		`Validations: ${summary.validationCommands.map((entry) => entry.id).join(", ")}`,
		`Plan fingerprint: ${summary.planFingerprint}`,
		"No files were written. Re-run with --apply and this --plan-fingerprint after review.",
	].join("\n");
}

function main() {
	const options = parseArgs(process.argv.slice(2));
	if (options.help) {
		printHelp();
		return;
	}
	const manifestPath = path.resolve(process.cwd(), options.manifestPath);
	const plan = createJiraVariantPlan({
		manifest: loadVariantManifest(manifestPath),
		root: options.root,
		source: options.source,
		target: options.target,
	});
	const summary = summarizePlan(plan);
	if (!options.apply) {
		const dryRun = { mode: "dry-run", ...summary };
		console.log(options.json ? JSON.stringify(dryRun, null, 2) : formatPlanText(dryRun));
		return;
	}
	if (options.planFingerprint !== summary.planFingerprint) {
		throw new Error(
			`reviewed plan fingerprint does not match current plan: expected ${summary.planFingerprint}`,
		);
	}
	const report = { mode: "apply", ...applyJiraVariantPlan(plan) };
	console.log(options.json ? JSON.stringify(report, null, 2) : [
		`Created ${report.target.slug} from ${report.source.slug}.`,
		`Copied files: ${report.copiedFileCount}`,
		`Commands: ${report.commands.map((entry) => entry.id).join(", ")}`,
	].join("\n"));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		main();
	} catch (error) {
		console.error(`scaffold-jira-variant: ${error.message}`);
		process.exitCode = 1;
	}
}
