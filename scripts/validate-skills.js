#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_TARGET = ".agents/skills";
const SKILL_ENTRYPOINT = "SKILL.md";
const SKILL_INDEX_PATH = ".agents/skills/INDEX.md";
const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
// Codex rejects skill descriptions longer than this many characters.
const MAX_DESCRIPTION_LENGTH = 1024;
const ALLOWED_SKILLS_ROOT_FILES = new Set(["INDEX.md"]);

function toPosixPath(filePath) {
	return filePath.split(path.sep).join("/");
}

function relativePath(cwd, filePath) {
	const relative = path.relative(cwd, filePath);
	return toPosixPath(relative || ".");
}

function stripYamlScalar(value) {
	return value.trim().replace(/^["']|["']$/gu, "").trim();
}

function normalizeMarkdownTableCell(value) {
	return String(value ?? "")
		.replace(/\s+/gu, " ")
		.replace(/\|/gu, "\\|")
		.trim();
}

function collectReferenceDocs(skillDir) {
	const referencesDir = path.join(skillDir, "references");
	if (!fs.existsSync(referencesDir)) {
		return [];
	}

	return readDirectoryEntries(referencesDir)
		.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
		.map((entry) => path.join(referencesDir, entry.name))
		.sort((left, right) => left.localeCompare(right));
}

function normalizeMarkdownLinkTarget(rawTarget) {
	let target = String(rawTarget ?? "").trim();
	if (!target || target.startsWith("#")) {
		return null;
	}
	if (/^[a-z][a-z0-9+.-]*:/iu.test(target)) {
		return null;
	}
	if (target.startsWith("<") && target.endsWith(">")) {
		target = target.slice(1, -1).trim();
	}
	if (!target || target.startsWith("#")) {
		return null;
	}
	const withoutTitle = target.match(/^([^"'\s]+)(?:\s+["'][\s\S]*["'])?$/u)?.[1] ?? target;
	const [withoutFragment] = withoutTitle.split("#", 1);
	const [withoutQuery] = withoutFragment.split("?", 1);
	if (!withoutQuery || withoutQuery.startsWith("#")) {
		return null;
	}
	try {
		return decodeURIComponent(withoutQuery);
	} catch {
		return withoutQuery;
	}
}

function collectMarkdownLinks(content) {
	const links = [];
	const linkPattern = /(?<!!)\[[^\]\n]+\]\(([^)\n]+)\)/gu;
	let match = linkPattern.exec(content);
	while (match) {
		const target = normalizeMarkdownLinkTarget(match[1]);
		if (target) {
			links.push({
				index: match.index,
				target,
			});
		}
		match = linkPattern.exec(content);
	}
	return links;
}

function validateMarkdownLinks({ content, skillDir, skillPath }) {
	return collectMarkdownLinks(content).flatMap((link) => {
		const absoluteTarget = path.isAbsolute(link.target)
			? path.join(process.cwd(), link.target.slice(1))
			: path.resolve(skillDir, link.target);
		if (fs.existsSync(absoluteTarget)) {
			return [];
		}
		return [{
			message: `Markdown link target does not exist: ${link.target}`,
			path: skillPath,
			type: "skill-link-target-missing",
		}];
	});
}

function parseArgs(argv) {
	let json = false;
	let target = DEFAULT_TARGET;
	let updateIndex = false;

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--json") {
			json = true;
			continue;
		}
		if (arg === "--update-index") {
			updateIndex = true;
			continue;
		}
		if (arg === "--target") {
			const value = argv[index + 1];
			if (!value) {
				throw new Error("--target requires a value");
			}
			target = value;
			index += 1;
			continue;
		}
		if (arg.startsWith("--target=")) {
			target = arg.slice("--target=".length);
			if (!target) {
				throw new Error("--target requires a value");
			}
			continue;
		}
		throw new Error(`Unknown argument: ${arg}`);
	}

	return {
		json,
		target,
		updateIndex,
	};
}

function readDirectoryEntries(dirPath) {
	return fs.readdirSync(dirPath, {
		withFileTypes: true,
	});
}

function collectSkillDirectories(targetPath) {
	if (!fs.existsSync(targetPath)) {
		return {
			failures: [{
				message: `Skill target not found: ${targetPath}`,
				type: "target-missing",
			}],
			skillDirs: [],
			warnings: [],
		};
	}

	const stat = fs.statSync(targetPath);
	if (!stat.isDirectory()) {
		return {
			failures: [{
				message: `Skill target must be a directory: ${targetPath}`,
				type: "target-not-directory",
			}],
			skillDirs: [],
			warnings: [],
		};
	}

	if (fs.existsSync(path.join(targetPath, SKILL_ENTRYPOINT))) {
		return {
			failures: [],
			skillDirs: [targetPath],
			warnings: [],
		};
	}

	const warnings = [];
	const skillDirs = [];
	for (const entry of readDirectoryEntries(targetPath)) {
		if (entry.name.startsWith(".")) {
			continue;
		}

		const entryPath = path.join(targetPath, entry.name);
		if (entry.isFile() && ALLOWED_SKILLS_ROOT_FILES.has(entry.name)) {
			continue;
		}

		if (!entry.isDirectory()) {
			warnings.push({
				message: "Ignoring non-directory entry under skills root.",
				path: entryPath,
				type: "skills-root-file",
			});
			continue;
		}

		skillDirs.push(entryPath);
	}

	if (skillDirs.length === 0) {
		return {
			failures: [{
				message: `No skill folders found under: ${targetPath}`,
				type: "skills-empty",
			}],
			skillDirs: [],
			warnings,
		};
	}

	return {
		failures: [],
		skillDirs: skillDirs.sort((a, b) => a.localeCompare(b)),
		warnings,
	};
}

function parseFrontmatter(content) {
	const lines = content.split(/\r?\n/u);
	if (lines[0] !== "---") {
		return {
			fields: new Map(),
			body: content,
			closingLine: -1,
			failures: [{
				message: "SKILL.md must start with YAML frontmatter.",
				type: "frontmatter-missing",
			}],
			frontmatterLines: [],
		};
	}

	const closingLine = lines.findIndex((line, index) => index > 0 && line === "---");
	if (closingLine === -1) {
		return {
			fields: new Map(),
			body: "",
			closingLine: -1,
			failures: [{
				message: "SKILL.md frontmatter must close with ---.",
				type: "frontmatter-unclosed",
			}],
			frontmatterLines: lines.slice(1),
		};
	}

	const fields = new Map();
	const failures = [];
	const frontmatterLines = lines.slice(1, closingLine);
	for (let index = 0; index < frontmatterLines.length; index += 1) {
		const line = frontmatterLines[index];
		if (!line.trim() || /^\s/u.test(line) || line.trim().startsWith("#")) {
			continue;
		}

		const match = /^([A-Za-z0-9_-]+):(?:\s*(.*))?$/u.exec(line);
		if (!match) {
			continue;
		}

		const key = match[1];
		if (fields.has(key)) {
			failures.push({
				message: `Duplicate frontmatter key: ${key}`,
				type: "frontmatter-duplicate-key",
			});
			continue;
		}

		fields.set(key, {
			line: index,
			value: match[2] ?? "",
		});
	}

	return {
		body: lines.slice(closingLine + 1).join("\n"),
		closingLine,
		failures,
		fields,
		frontmatterLines,
	};
}

function hasFrontmatterValue(parsed, key) {
	const field = parsed.fields.get(key);
	if (!field) {
		return false;
	}

	const value = stripYamlScalar(field.value);
	if (value) {
		return true;
	}

	for (let index = field.line + 1; index < parsed.frontmatterLines.length; index += 1) {
		const line = parsed.frontmatterLines[index];
		if (/^[A-Za-z0-9_-]+:/u.test(line)) {
			return false;
		}
		if (line.trim()) {
			return true;
		}
	}

	return false;
}

function getFrontmatterScalar(parsed, key) {
	const field = parsed.fields.get(key);
	if (!field) {
		return "";
	}

	return stripYamlScalar(field.value);
}

function getFrontmatterTextValue(parsed, key) {
	const field = parsed.fields.get(key);
	if (!field) {
		return "";
	}

	const inlineValue = stripYamlScalar(field.value);
	const lines = [];
	if (inlineValue && !["|", "|-", "|+", ">", ">-", ">+"].includes(inlineValue)) {
		lines.push(inlineValue);
	}

	for (let index = field.line + 1; index < parsed.frontmatterLines.length; index += 1) {
		const line = parsed.frontmatterLines[index];
		if (/^[A-Za-z0-9_-]+:/u.test(line)) {
			break;
		}
		if (line.trim()) {
			lines.push(line.trim());
		}
	}

	return lines.join(" ").trim();
}

function validateSkillDirectory(skillDir) {
	const skillName = path.basename(skillDir);
	const skillPath = path.join(skillDir, SKILL_ENTRYPOINT);
	const failures = [];
	const warnings = [];

	if (!fs.existsSync(skillPath)) {
		failures.push({
			message: `Missing ${SKILL_ENTRYPOINT}.`,
			path: skillPath,
			type: "skill-entrypoint-missing",
		});
		return {
			failures,
			name: skillName,
			path: skillDir,
			relatedDocs: [],
			warnings,
		};
	}

	const content = fs.readFileSync(skillPath, "utf8");
	const parsed = parseFrontmatter(content);
	for (const failure of parsed.failures) {
		failures.push({
			...failure,
			path: skillPath,
		});
	}
	failures.push(...validateMarkdownLinks({ content, skillDir, skillPath }));

	const frontmatterName = getFrontmatterScalar(parsed, "name");
	const description = getFrontmatterTextValue(parsed, "description");
	if (!hasFrontmatterValue(parsed, "name")) {
		failures.push({
			message: "SKILL.md frontmatter must include a non-empty name.",
			path: skillPath,
			type: "skill-name-missing",
		});
	} else if (!SKILL_NAME_PATTERN.test(frontmatterName)) {
		failures.push({
			message: `Skill name must be kebab-case: ${frontmatterName}`,
			path: skillPath,
			type: "skill-name-format",
		});
	} else if (!frontmatterName.startsWith("vpk-")) {
		failures.push({
			message: `Skill name must start with "vpk-": ${frontmatterName}`,
			path: skillPath,
			type: "skill-name-prefix",
		});
	} else if (frontmatterName !== skillName) {
		failures.push({
			message: `Skill name "${frontmatterName}" must match folder "${skillName}".`,
			path: skillPath,
			type: "skill-name-folder-mismatch",
		});
	}

	if (!hasFrontmatterValue(parsed, "description")) {
		failures.push({
			message: "SKILL.md frontmatter must include a non-empty description.",
			path: skillPath,
			type: "skill-description-missing",
		});
	} else if (description.length > MAX_DESCRIPTION_LENGTH) {
		failures.push({
			message: `Skill description is ${description.length} characters; the limit is ${MAX_DESCRIPTION_LENGTH}.`,
			path: skillPath,
			type: "skill-description-too-long",
		});
	}

	if (!parsed.body.trim()) {
		failures.push({
			message: "SKILL.md must include a Markdown body after frontmatter.",
			path: skillPath,
			type: "skill-body-missing",
		});
	} else if (!/^#\s+\S/mu.test(parsed.body)) {
		warnings.push({
			message: "SKILL.md body does not include an H1 heading.",
			path: skillPath,
			type: "skill-heading-missing",
		});
	}

	return {
		description,
		failures,
		name: skillName,
		path: skillDir,
		relatedDocs: collectReferenceDocs(skillDir),
		warnings,
	};
}

function createSkillValidationReport({
	checkIndex = true,
	cwd = process.cwd(),
	target = DEFAULT_TARGET,
} = {}) {
	const targetPath = path.resolve(cwd, target);
	const collected = collectSkillDirectories(targetPath);
	const skills = collected.skillDirs.map((skillDir) => validateSkillDirectory(skillDir));
	const shouldCheckIndex = checkIndex && !fs.existsSync(path.join(targetPath, SKILL_ENTRYPOINT));
	const index = shouldCheckIndex
		? checkSkillIndex({ cwd, skills, targetPath })
		: null;
	const failures = [
		...collected.failures.map((failure) => ({
			...failure,
			message: failure.message.replace(targetPath, relativePath(cwd, targetPath)),
			path: targetPath,
		})),
		...skills.flatMap((skill) => skill.failures),
		...(index && !index.isCurrent
			? [{
				message: `${relativePath(cwd, index.path)} is out of date. Run: node scripts/validate-skills.js --update-index`,
				path: index.path,
				type: "skill-index-stale",
			}]
			: []),
	];
	const warnings = [
		...collected.warnings,
		...skills.flatMap((skill) => skill.warnings),
	];

	return {
		failures,
		index: index
			? {
				isCurrent: index.isCurrent,
				path: relativePath(cwd, index.path),
			}
			: null,
		skills: skills.map((skill) => ({
			description: skill.description,
			name: skill.name,
			path: relativePath(cwd, skill.path),
			relatedDocs: skill.relatedDocs.map((docPath) => relativePath(cwd, docPath)),
		})),
		target: relativePath(cwd, targetPath),
		warnings,
	};
}

function formatRelatedDocsCell(skill, targetPath) {
	const relatedDocs = skill.relatedDocs ?? [];
	if (relatedDocs.length === 0) {
		return "—";
	}

	if (relatedDocs.length <= 3) {
		return relatedDocs
			.map((docPath) => {
				const label = path.basename(docPath, ".md");
				const href = relativePath(targetPath, docPath);
				return `[\`${label}\`](${href})`;
			})
			.join(", ");
	}

	const skillPath = relativePath(targetPath, skill.path);
	return `[\`references/\`](${skillPath}/references/) (${relatedDocs.length} docs)`;
}

function buildSkillIndexText(skills, {
	cwd = process.cwd(),
	generatedBy = "scripts/validate-skills.js --update-index",
	targetPath = path.resolve(cwd, DEFAULT_TARGET),
} = {}) {
	const sortedSkills = skills
		.slice()
		.sort((left, right) => left.name.localeCompare(right.name));

	return [
		"# Local Skills Index",
		"",
		"<!-- This file is generated. Run `node scripts/validate-skills.js --update-index` after changing `.agents/skills/*/SKILL.md`. -->",
		"",
		`Generated by \`${generatedBy}\` from \`.agents/skills/*/SKILL.md\`.`,
		"",
		"| Skill | Use case | Related docs | Validation |",
		"| --- | --- | --- | --- |",
		...sortedSkills.map((skill) => {
			const skillPath = `${relativePath(targetPath, skill.path)}/${SKILL_ENTRYPOINT}`;
			const description = normalizeMarkdownTableCell(skill.description || "No description provided.");
			const relatedDocs = normalizeMarkdownTableCell(formatRelatedDocsCell(skill, targetPath));
			const validation = `\`node scripts/validate-skills.js --target ${relativePath(cwd, skill.path)}\``;
			return `| [\`${skill.name}\`](${skillPath}) | ${description} | ${relatedDocs} | ${validation} |`;
		}),
		"",
	].join("\n");
}

function checkSkillIndex({ cwd = process.cwd(), skills, targetPath } = {}) {
	const indexPath = path.join(targetPath, "INDEX.md");
	const expectedText = buildSkillIndexText(skills, { cwd, targetPath });
	const actualText = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, "utf8") : null;
	return {
		actualText,
		expectedText,
		isCurrent: actualText === expectedText,
		path: indexPath,
	};
}

function writeSkillIndex({ cwd = process.cwd(), target = DEFAULT_TARGET } = {}) {
	const targetPath = path.resolve(cwd, target);
	const collected = collectSkillDirectories(targetPath);
	if (collected.failures.length > 0) {
		throw new Error(collected.failures[0].message);
	}

	const skills = collected.skillDirs.map((skillDir) => validateSkillDirectory(skillDir));
	const indexText = buildSkillIndexText(skills, { cwd, targetPath });
	const indexPath = path.join(targetPath, "INDEX.md");
	fs.writeFileSync(indexPath, indexText);
	return {
		indexPath,
		indexText,
		skillCount: skills.length,
	};
}

function formatFinding(cwd, finding) {
	const findingPath = finding.path ? `${relativePath(cwd, finding.path)}: ` : "";
	return `- ${findingPath}${finding.message}`;
}

function printReport(report, { cwd = process.cwd(), json = false } = {}) {
	if (json) {
		console.log(JSON.stringify(report, null, 2));
		return;
	}

	for (const warning of report.warnings) {
		console.warn(`Warning: ${formatFinding(cwd, warning).slice(2)}`);
	}

	if (report.failures.length === 0) {
		console.log(`Skill validation passed: ${report.skills.length} skill folder${report.skills.length === 1 ? "" : "s"} checked.`);
		return;
	}

	console.error("Skill validation failed:");
	for (const failure of report.failures) {
		console.error(formatFinding(cwd, failure));
	}
}

function validateSkills({
	checkIndex = true,
	cwd = process.cwd(),
	json = false,
	target = DEFAULT_TARGET,
	updateIndex = false,
} = {}) {
	if (updateIndex) {
		const result = writeSkillIndex({ cwd, target });
		console.log(`Generated ${relativePath(cwd, result.indexPath)} for ${result.skillCount} skill folder${result.skillCount === 1 ? "" : "s"}.`);
	}

	const report = createSkillValidationReport({ checkIndex, cwd, target });
	printReport(report, { cwd, json });
	return report.failures.length === 0 ? 0 : 1;
}

function main() {
	let options;
	try {
		options = parseArgs(process.argv.slice(2));
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		console.error("Usage: validate-skills.js [--target .agents/skills] [--json] [--update-index]");
		process.exitCode = 2;
		return;
	}

	process.exitCode = validateSkills(options);
}

if (require.main === module) {
	main();
}

module.exports = {
	DEFAULT_TARGET,
	SKILL_ENTRYPOINT,
	SKILL_INDEX_PATH,
	buildSkillIndexText,
	checkSkillIndex,
	collectMarkdownLinks,
	collectReferenceDocs,
	collectSkillDirectories,
	createSkillValidationReport,
	formatRelatedDocsCell,
	getFrontmatterTextValue,
	normalizeMarkdownLinkTarget,
	parseArgs,
	parseFrontmatter,
	validateSkillDirectory,
	validateSkills,
	writeSkillIndex,
};
