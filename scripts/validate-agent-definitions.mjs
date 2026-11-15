#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ALLOWED_FRONTMATTER_FIELDS = new Set([
	"name",
	"description",
	"tools",
	"skills",
	"model",
	"memory",
	"background",
	"effort",
	"maxTurns",
	"isolation",
	"color",
]);

const REQUIRED_SECTIONS = [
	"Instructions",
	"Knowledge",
	"Triggers",
	"Channels",
	"Conversation Starters",
	"Validation",
	"Maintenance Notes",
];

const STRUCTURED_SECTIONS = new Set([
	"Knowledge",
	"Triggers",
	"Channels",
	"Conversation Starters",
]);

const KNOWN_TOOL_NAMES = new Set([
	"Read",
	"Write",
	"Edit",
	"MultiEdit",
	"Glob",
	"Grep",
	"Bash",
	"WebFetch",
	"WebSearch",
	"Task",
	"TodoWrite",
	"NotebookRead",
	"NotebookEdit",
	"Skill",
]);

function stripQuotes(value) {
	const trimmed = String(value ?? "").trim();
	const match = trimmed.match(/^(['"])([\s\S]*)\1$/u);
	return match ? match[2] : trimmed;
}

function parseScalar(rawValue) {
	const value = stripQuotes(rawValue);
	if (value === "true") return true;
	if (value === "false") return false;
	if (/^\d+$/u.test(value)) return Number(value);
	return value;
}

function parseInlineArray(rawValue) {
	const trimmed = rawValue.trim();
	if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
		return null;
	}
	const inner = trimmed.slice(1, -1).trim();
	if (!inner) {
		return [];
	}
	return inner
		.split(",")
		.map((item) => stripQuotes(item.trim()))
		.filter(Boolean);
}

function parseFrontmatter(frontmatterText) {
	const metadata = {};
	const lines = frontmatterText.split(/\r?\n/u);

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
		if (!line.trim() || line.trim().startsWith("#")) {
			continue;
		}
		if (/^\s/u.test(line)) {
			continue;
		}

		const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/u);
		if (!match) {
			throw new Error(`Cannot parse frontmatter line: ${line}`);
		}

		const [, key, rawValue] = match;
		const value = rawValue.trim();
		if (value === "|") {
			const block = [];
			while (index + 1 < lines.length && (/^\s/u.test(lines[index + 1]) || !lines[index + 1].trim())) {
				index += 1;
				block.push(lines[index].replace(/^\s{2}/u, ""));
			}
			metadata[key] = block.join("\n").trim();
			continue;
		}

		if (value.startsWith("[") && !value.endsWith("]")) {
			const parts = [value];
			while (index + 1 < lines.length) {
				index += 1;
				parts.push(lines[index].trim());
				if (lines[index].trim().endsWith("]")) {
					break;
				}
			}
			metadata[key] = parseInlineArray(parts.join(" "));
			continue;
		}

		const inlineArray = parseInlineArray(value);
		metadata[key] = inlineArray ?? parseScalar(value);
	}

	return metadata;
}

function splitFrontmatter(content) {
	if (!content.startsWith("---\n")) {
		throw new Error("Missing YAML frontmatter.");
	}
	const endIndex = content.indexOf("\n---", 4);
	if (endIndex === -1) {
		throw new Error("Unclosed YAML frontmatter.");
	}
	return {
		body: content.slice(endIndex + "\n---".length).replace(/^\r?\n/u, ""),
		frontmatter: parseFrontmatter(content.slice(4, endIndex).trim()),
	};
}

function collectSections(body) {
	const sections = new Map();
	const matches = [...body.matchAll(/^##\s+(.+?)\s*$/gmu)];
	for (let index = 0; index < matches.length; index += 1) {
		const title = matches[index][1].trim();
		const start = matches[index].index + matches[index][0].length;
		const end = index + 1 < matches.length ? matches[index + 1].index : body.length;
		sections.set(title, body.slice(start, end).trim());
	}
	return sections;
}

function findYamlBlocks(sectionBody) {
	return [...sectionBody.matchAll(/```ya?ml\s*\n([\s\S]*?)\n```/gmu)].map((match) => match[1].trim());
}

function checkYamlLikeBlock(block) {
	const stack = [];
	for (const char of block) {
		if (char === "[" || char === "{") {
			stack.push(char);
		} else if (char === "]") {
			if (stack.pop() !== "[") {
				return "Mismatched ] in YAML block.";
			}
		} else if (char === "}") {
			if (stack.pop() !== "{") {
				return "Mismatched } in YAML block.";
			}
		}
	}
	if (stack.length > 0) {
		return "Unclosed bracket or brace in YAML block.";
	}
	const invalidLine = block
		.split(/\r?\n/u)
		.find((line) => {
			const trimmed = line.trim();
			return trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("-") && !trimmed.includes(":");
		});
	return invalidLine ? `YAML block has a non key/value line: ${invalidLine}` : null;
}

function extractKnowledgePath(sections) {
	const knowledge = sections.get("Knowledge") ?? "";
	const [block] = findYamlBlocks(knowledge);
	if (!block) {
		return null;
	}
	const match = block.match(/^\s*path:\s*["']?([^"'\n]+)["']?\s*$/mu);
	return match ? match[1].trim() : null;
}

function inspectConversationStarters(sections) {
	const sectionBody = sections.get("Conversation Starters") ?? "";
	const [block] = findYamlBlocks(sectionBody);
	if (!block) {
		return {
			hasKey: false,
			count: 0,
		};
	}

	const keyMatch = block.match(/^\s*conversation_starters\s*:\s*(.*)$/mu);
	if (!keyMatch) {
		return {
			hasKey: false,
			count: 0,
		};
	}

	const inlineValue = keyMatch[1].trim();
	if (inlineValue.startsWith("[") && inlineValue.endsWith("]")) {
		const inner = inlineValue.slice(1, -1).trim();
		return {
			hasKey: true,
			count: inner ? inner.split(",").filter((item) => stripQuotes(item.trim()).length > 0).length : 0,
		};
	}

	return {
		hasKey: true,
		count: block.split(/\r?\n/u).filter((line) => /^\s*-\s+\S/u.test(line)).length,
	};
}

function usesStructuredAgentDefinitionSchema(frontmatter, sections) {
	return frontmatter.memory === "project" || REQUIRED_SECTIONS.some((section) => sections.has(section));
}

function isKnownTool(toolName) {
	return KNOWN_TOOL_NAMES.has(toolName)
		|| toolName.startsWith("mcp__")
		|| /^[a-z][a-z0-9_-]*:[a-z0-9_-]+$/u.test(toolName)
		|| /^[a-z][a-z0-9_-]*\.[a-z0-9_-]+$/u.test(toolName);
}

async function pathExists(targetPath) {
	try {
		await fs.access(targetPath);
		return true;
	} catch {
		return false;
	}
}

async function findAgentFiles(targetPath) {
	const stat = await fs.stat(targetPath);
	if (!stat.isDirectory()) {
		return [targetPath];
	}
	const entries = await fs.readdir(targetPath);
	return entries
		.filter((entry) => entry.endsWith(".md"))
		.map((entry) => path.join(targetPath, entry));
}

async function validateAgentFile(filePath, allAgentFiles, rootDir) {
	const errors = [];
	const warnings = [];
	const content = await fs.readFile(filePath, "utf8");
	let parsed;

	try {
		parsed = splitFrontmatter(content);
	} catch (error) {
		return {
			errors: [`${filePath}: ${error.message}`],
			filePath,
			name: null,
			warnings,
		};
	}

	const { body, frontmatter } = parsed;
	const name = frontmatter.name;
	const description = frontmatter.description;
	const relativeFile = path.relative(rootDir, filePath).split(path.sep).join("/");

	if (!name) {
		errors.push(`${relativeFile}: missing required frontmatter field "name".`);
	} else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(String(name)) || String(name).length > 64) {
		errors.push(`${relativeFile}: name must be lowercase hyphen-case and <=64 characters.`);
	}

	if (!description) {
		errors.push(`${relativeFile}: missing required frontmatter field "description".`);
	}

	const unexpected = Object.keys(frontmatter).filter((key) => !ALLOWED_FRONTMATTER_FIELDS.has(key));
	for (const key of unexpected) {
		errors.push(`${relativeFile}: unexpected frontmatter field "${key}".`);
	}

	const filenameStem = path.basename(filePath, ".md");
	if (name && filenameStem !== name) {
		errors.push(`${relativeFile}: filename stem must match frontmatter name "${name}".`);
	}

	const duplicates = allAgentFiles.filter((candidate) => candidate !== filePath);
	for (const candidate of duplicates) {
		try {
			const candidateParsed = splitFrontmatter(await fs.readFile(candidate, "utf8"));
			if (candidateParsed.frontmatter.name === name) {
				errors.push(`${relativeFile}: duplicate agent name also found in ${path.relative(rootDir, candidate).split(path.sep).join("/")}.`);
			}
		} catch {
			// Other files report their own parse errors.
		}
	}

	const sections = collectSections(body);
	const structuredSchema = usesStructuredAgentDefinitionSchema(frontmatter, sections);

	if (structuredSchema) {
		for (const section of REQUIRED_SECTIONS) {
			if (!sections.has(section)) {
				errors.push(`${relativeFile}: missing required section "## ${section}".`);
			}
		}

		for (const section of STRUCTURED_SECTIONS) {
			if (!sections.has(section)) {
				continue;
			}
			const blocks = findYamlBlocks(sections.get(section));
			if (blocks.length === 0) {
				errors.push(`${relativeFile}: section "## ${section}" must include a fenced YAML block.`);
				continue;
			}
			for (const block of blocks) {
				const yamlError = checkYamlLikeBlock(block);
				if (yamlError) {
					errors.push(`${relativeFile}: section "## ${section}" ${yamlError}`);
				}
			}
		}

		if (sections.has("Conversation Starters")) {
			const starters = inspectConversationStarters(sections);
			if (!starters.hasKey) {
				errors.push(`${relativeFile}: section "## Conversation Starters" must define "conversation_starters".`);
			} else if (starters.count === 0) {
				errors.push(`${relativeFile}: section "## Conversation Starters" must include at least one starter.`);
			}
		}
	} else {
		warnings.push(`${relativeFile}: legacy Claude-style agent; structured agent definition body sections were not enforced.`);
	}

	// A knowledge path is optional, but a declared one must be this agent's
	// `.agents/knowledge/<name>/` folder and must exist, so it is never a dead pointer.
	const knowledgePath = extractKnowledgePath(sections);
	if (knowledgePath !== null) {
		const expectedPath = `.agents/knowledge/${name}/`;
		if (knowledgePath !== expectedPath) {
			errors.push(`${relativeFile}: knowledge path must be "${expectedPath}".`);
		} else if (!(await pathExists(path.join(rootDir, knowledgePath)))) {
			errors.push(`${relativeFile}: knowledge path "${knowledgePath}" does not exist.`);
		}
	}

	if (Array.isArray(frontmatter.tools)) {
		for (const tool of frontmatter.tools) {
			if (!isKnownTool(tool)) {
				warnings.push(`${relativeFile}: unknown tool "${tool}" recorded as a warning.`);
			}
		}
	}

	return {
		errors,
		filePath,
		name,
		warnings,
	};
}

async function main() {
	const args = process.argv.slice(2);
	const targetArg = args.find((arg) => !arg.startsWith("--"));
	const rootIndex = args.indexOf("--root");
	const rootDir = rootIndex === -1
		? process.cwd()
		: path.resolve(args[rootIndex + 1] ?? process.cwd());
	const json = args.includes("--json");

	if (!targetArg) {
		console.error("Usage: validate-agent-definitions.mjs <agent-file-or-directory> [--root <repo-root>] [--json]");
		process.exit(2);
	}

	const targetPath = path.resolve(rootDir, targetArg);
	const files = await findAgentFiles(targetPath);
	const results = [];
	for (const file of files) {
		results.push(await validateAgentFile(file, files, rootDir));
	}

	const errors = results.flatMap((result) => result.errors);
	const warnings = results.flatMap((result) => result.warnings);
	if (json) {
		console.log(JSON.stringify({ errors, ok: errors.length === 0, warnings }, null, 2));
	} else {
		for (const warning of warnings) {
			console.warn(`WARN ${warning}`);
		}
		for (const error of errors) {
			console.error(`ERROR ${error}`);
		}
		if (errors.length === 0) {
			console.log(`Validated ${files.length} agent file${files.length === 1 ? "" : "s"}.`);
		}
	}

	process.exit(errors.length === 0 ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	});
}

export {
	collectSections,
	parseFrontmatter,
	splitFrontmatter,
	validateAgentFile,
};
