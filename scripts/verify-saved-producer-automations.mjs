#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const EXPECTED_PRODUCER_AUTOMATION_IDS = [
	"bug-scan",
	"code-simplification",
	"correction-ladder",
	"dependency-sweep",
	"deprecation-audit",
	"engineering-improvement-map",
	"frontend-runtime-audit",
	"interface-contract-audit",
	"performance-audit",
	"test-coverage",
	"ui-design-quality-audit",
	"update-agents-md",
	"verification-maintenance",
];

const SHARED_POLICY_PATTERN = /^Invoke `\$vpk-scheduled-automation`(?:[,.]?\s|$)/u;
const DUPLICATED_SHARED_RULES = [
	{
		category: "corepack-policy",
		pattern: /run all pnpm commands via\s+`?corepack pnpm|repo-pinned pnpm version/iu,
	},
	{
		category: "full-pr-validation",
		pattern: /corepack pnpm run ci:pr/iu,
	},
	{
		category: "no-self-merge",
		pattern: /do not merge from this producer job|never merge|separate review\/merge workflow owns review and merge/iu,
	},
	{
		category: "repo-safety",
		pattern: /git status --short --branch|git worktree list --porcelain/iu,
	},
	{
		category: "supplied-worktree-policy",
		pattern: /clean worktree supplied by the automation|do not create a second worktree|clean detached head is valid/iu,
	},
];

function parseBasicString(value) {
	if (!value.startsWith('"')) {
		throw new Error("expected TOML basic string");
	}
	return JSON.parse(value);
}

function parseAutomationRecord(source) {
	const fields = new Map();
	for (const line of source.split(/\r?\n/u)) {
		const match = line.match(/^([a-z_]+)\s*=\s*(.+)$/u);
		if (!match) {
			continue;
		}
		fields.set(match[1], match[2]);
	}

	return {
		id: parseBasicString(fields.get("id") ?? ""),
		kind: parseBasicString(fields.get("kind") ?? ""),
		prompt: parseBasicString(fields.get("prompt") ?? ""),
	};
}

function addDiagnostic(diagnostics, automationId, ...categories) {
	diagnostics.push({ automationId, categories });
}

export function validateAutomationStore({
	automationRoot,
	expectedIds = EXPECTED_PRODUCER_AUTOMATION_IDS,
}) {
	const diagnostics = [];
	const automationIds = [...expectedIds].sort();

	for (const automationId of automationIds) {
		const recordPath = path.join(automationRoot, automationId, "automation.toml");
		if (!existsSync(recordPath)) {
			addDiagnostic(diagnostics, automationId, "missing-record");
			continue;
		}

		let record;
		try {
			record = parseAutomationRecord(readFileSync(recordPath, "utf8"));
		} catch {
			addDiagnostic(diagnostics, automationId, "malformed-record");
			continue;
		}

		if (record.id !== automationId || record.kind !== "cron" || !record.prompt.trim()) {
			addDiagnostic(diagnostics, automationId, "malformed-record");
			continue;
		}

		if (!SHARED_POLICY_PATTERN.test(record.prompt)) {
			addDiagnostic(diagnostics, automationId, "missing-shared-policy");
		}

		const duplicatedCategories = DUPLICATED_SHARED_RULES
			.filter(({ pattern }) => pattern.test(record.prompt))
			.map(({ category }) => category);
		if (duplicatedCategories.length > 0) {
			addDiagnostic(diagnostics, automationId, ...duplicatedCategories);
		}
	}

	return { automationIds, diagnostics };
}

export function formatDiagnostics({ automationIds, diagnostics }) {
	if (diagnostics.length === 0) {
		return `OK saved-producer-automations[${automationIds.join(",")}]`;
	}

	return diagnostics.map(({ automationId, categories }) => {
		if (categories.length === 1) {
			return `ERROR ${automationId}: ${categories[0]}`;
		}
		return `ERROR ${automationId}: duplicated-shared-policy[${categories.join(",")}]`;
	}).join("\n");
}

function parseArgs(argv) {
	let automationRoot = path.join(process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex"), "automations");
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === "--automation-root") {
			automationRoot = argv[index + 1];
			if (!automationRoot) {
				throw new Error("--automation-root requires a value");
			}
			index += 1;
			continue;
		}
		if (argument.startsWith("--automation-root=")) {
			automationRoot = argument.slice("--automation-root=".length);
			continue;
		}
		throw new Error(`Unknown argument: ${argument}`);
	}
	return { automationRoot };
}

function main() {
	try {
		const result = validateAutomationStore(parseArgs(process.argv.slice(2)));
		console.log(formatDiagnostics(result));
		if (result.diagnostics.length > 0) {
			process.exitCode = 1;
		}
	} catch (error) {
		console.error(`ERROR saved-producer-automations: ${error instanceof Error ? error.message : "unknown-error"}`);
		process.exitCode = 1;
	}
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
	main();
}
