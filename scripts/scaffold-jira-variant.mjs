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

function countOccurrences(content, value) {
	if (!value) return 0;
	let count = 0;
	let cursor = 0;
	while (true) {
		const index = content.indexOf(value, cursor);
		if (index < 0) return count;
		count += 1;
		cursor = index + value.length;
	}
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

function rewriteText(content, rewriteRules) {
	let output = content;
	let rewriteCount = 0;
	for (const { from, to } of rewriteRules) {
		const count = countOccurrences(output, from);
		if (count === 0) continue;
		output = output.replaceAll(from, to);
		rewriteCount += count;
	}
	return { content: output, rewriteCount };
}

function sourceIdentifiers(identity) {
	return [
		identity.pascal,
		identity.upper,
		identity.camel,
		identity.title,
		identity.slug,
		identity.experimentalPascal,
		identity.experimentalUpper,
		identity.experimentalCamel,
		identity.experimentalSlug,
		identity.version,
	].sort((left, right) => right.length - left.length || left.localeCompare(right));
}

function targetIdentifiers(identity) {
	return sourceIdentifiers(identity);
}

function assertNoAmbiguousTargetIdentifiers(content, target, filePath) {
	const identifier = targetIdentifiers(target).find((candidate) => content.includes(candidate));
	if (identifier) {
		throw new Error(
			`ambiguous rewrite in ${filePath}: source content already contains target identifier ${identifier}`,
		);
	}
}

function assertNoSourceIdentifiers(content, source, filePath) {
	const identifier = sourceIdentifiers(source).find((candidate) => content.includes(candidate));
	if (identifier) {
		throw new Error(`unresolved source identifier in ${filePath}: ${identifier}`);
	}
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

function prepareCopyOperations({ manifest, rewriteRules, root, source, target, values }) {
	const operations = [];
	const targetRoots = new Set();
	const skipped = [];
	for (const template of manifest.copyTemplates ?? []) {
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

function findMatchingDelimiter(content, startIndex, open, close) {
	let depth = 0;
	let quote = null;
	let escaped = false;
	let lineComment = false;
	let blockComment = false;
	for (let index = startIndex; index < content.length; index += 1) {
		const char = content[index];
		const next = content[index + 1];
		if (lineComment) {
			if (char === "\n") lineComment = false;
			continue;
		}
		if (blockComment) {
			if (char === "*" && next === "/") {
				blockComment = false;
				index += 1;
			}
			continue;
		}
		if (quote) {
			if (escaped) {
				escaped = false;
				continue;
			}
			if (char === "\\") {
				escaped = true;
				continue;
			}
			if (char === quote) quote = null;
			continue;
		}
		if (char === "/" && next === "/") {
			lineComment = true;
			index += 1;
			continue;
		}
		if (char === "/" && next === "*") {
			blockComment = true;
			index += 1;
			continue;
		}
		if (char === '"' || char === "'" || char === "`") {
			quote = char;
			continue;
		}
		if (char === open) depth += 1;
		if (char === close) {
			depth -= 1;
			if (depth === 0) return index;
		}
	}
	throw new Error(`unclosed ${open}${close} block at offset ${startIndex}`);
}

function extractArrayObjects(content, arrayStart) {
	const startCount = countOccurrences(content, arrayStart);
	if (startCount !== 1) {
		throw new Error(`registration array anchor must occur exactly once: ${arrayStart}`);
	}
	const anchorIndex = content.indexOf(arrayStart);
	const openIndex = content.indexOf("[", anchorIndex);
	const closeIndex = findMatchingDelimiter(content, openIndex, "[", "]");
	const objects = [];
	for (let cursor = openIndex + 1; cursor < closeIndex; cursor += 1) {
		if (content[cursor] !== "{") continue;
		const endBrace = findMatchingDelimiter(content, cursor, "{", "}");
		let end = endBrace + 1;
		while (end < closeIndex && /[ \t]/u.test(content[end])) end += 1;
		if (content[end] === ",") end += 1;
		objects.push({ content: content.slice(cursor, end), end, start: cursor });
		cursor = end - 1;
	}
	return { closeIndex, objects };
}

function prepareRegistrationRule(content, rule, rewriteRules, source) {
	if (rule.kind === "replace") {
		const sourceCount = countOccurrences(content, rule.source);
		if (countOccurrences(content, rule.target) > 0) {
			if (rule.optional && sourceCount === 0) {
				return { content, insertedCount: 0 };
			}
			throw new Error(`target registration already exists in ${rule.file}`);
		}
		if (sourceCount === 0 && rule.optional) {
			return { content, insertedCount: 0 };
		}
		if (sourceCount !== 1) {
			throw new Error(
				`registration replacement is missing or ambiguous in ${rule.file}: ${rule.source}`,
			);
		}
		return {
			content: content.replace(rule.source, rule.target),
			insertedCount: 1,
		};
	}

	if (rule.kind === "line") {
		if (countOccurrences(content, rule.target) > 0) {
			throw new Error(`target registration already exists in ${rule.file}`);
		}
		if (countOccurrences(content, rule.source) !== 1) {
			throw new Error(`registration source is missing or ambiguous in ${rule.file}`);
		}
		return {
			content: content.replace(rule.source, `${rule.source}\n${rule.target}`),
			insertedCount: 1,
		};
	}

	if (rule.kind === "block") {
		if (countOccurrences(content, rule.targetStart) > 0) {
			throw new Error(`target registration already exists in ${rule.file}`);
		}
		if (countOccurrences(content, rule.start) !== 1) {
			throw new Error(`registration block is missing or ambiguous in ${rule.file}`);
		}
		const start = content.indexOf(rule.start);
		const endMarker = content.indexOf(rule.end, start);
		if (endMarker < 0) {
			throw new Error(`registration block end is missing in ${rule.file}`);
		}
		const end = endMarker + rule.end.length;
		const sourceBlock = content.slice(start, end);
		let targetBlock = rewriteText(sourceBlock, rewriteRules).content;
		for (const replacement of rule.postRewrites ?? []) {
			const replacementCount = countOccurrences(targetBlock, replacement.from);
			if (replacementCount === 0 && !replacement.optional) {
				throw new Error(`registration post-rewrite source is missing in ${rule.file}`);
			}
			targetBlock = targetBlock.replaceAll(replacement.from, replacement.to);
		}
		assertNoSourceIdentifiers(targetBlock, source, rule.file);
		return {
			content: `${content.slice(0, end)}\n${targetBlock}${content.slice(end)}`,
			insertedCount: 1,
		};
	}

	if (rule.kind === "matching-lines") {
		if (content.includes(rule.targetMarker)) {
			throw new Error(`target registration already exists in ${rule.file}`);
		}
		let insertedCount = 0;
		const lines = content.split("\n").flatMap((line) => {
			if (!line.includes(rule.sourceMarker)) return [line];
			insertedCount += 1;
			const targetLine = rewriteText(line, rewriteRules).content;
			return rule.replaceSource ? [targetLine] : [line, targetLine];
		});
		if (insertedCount === 0 && !rule.optional) {
			throw new Error(
				`registration source lines are missing in ${rule.file}: ${rule.sourceMarker}`,
			);
		}
		return { content: lines.join("\n"), insertedCount };
	}

	if (rule.kind === "array-object-all") {
		const { objects } = extractArrayObjects(content, rule.arrayStart);
		if (objects.some((entry) => entry.content.includes(rule.targetMarker))) {
			throw new Error(`target registration already exists in ${rule.file}`);
		}
		const matches = objects.filter((entry) => entry.content.includes(rule.sourceMarker));
		if (matches.length === 0) {
			if (rule.optional) return { content, insertedCount: 0 };
			throw new Error(`registration source objects are missing in ${rule.file}`);
		}
		const targetBlocks = matches.map((entry) => {
			let targetBlock = rewriteText(entry.content, rewriteRules).content;
			for (const replacement of rule.postRewrites ?? []) {
				const replacementCount = countOccurrences(targetBlock, replacement.from);
				if (replacementCount === 0 && !replacement.optional) {
					throw new Error(`registration post-rewrite source is missing in ${rule.file}`);
				}
				targetBlock = targetBlock.replaceAll(replacement.from, replacement.to);
			}
			return targetBlock;
		});
		for (const targetBlock of targetBlocks) {
			assertNoSourceIdentifiers(targetBlock, source, rule.file);
		}
		const insertionIndex = matches.at(-1).end;
		return {
			content: `${content.slice(0, insertionIndex)}\n${targetBlocks.join("\n")}${content.slice(insertionIndex)}`,
			insertedCount: targetBlocks.length,
		};
	}

	throw new Error(`unsupported registration kind: ${rule.kind}`);
}

function prepareRegistrationOperations({ manifest, rewriteRules, root, source, values }) {
	const fileOperations = new Map();
	const summaries = [];
	for (const template of manifest.registrations ?? []) {
		const rule = expandManifestTemplates(template, values);
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
	const copies = prepareCopyOperations({ manifest, rewriteRules, root: absoluteRoot, source, target, values });
	const registrations = prepareRegistrationOperations({
		manifest,
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
