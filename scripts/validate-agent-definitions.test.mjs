import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(new URL("./validate-agent-definitions.mjs", import.meta.url));

function runValidator(root, target = ".agents/agents") {
	return new Promise((resolve) => {
		execFile(process.execPath, [scriptPath, target, "--root", root], (error, stdout, stderr) => {
			resolve({
				code: error?.code ?? 0,
				stderr,
				stdout,
			});
		});
	});
}

async function withFixture(files, callback) {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "agent-definitions-"));
	try {
		await fs.mkdir(path.join(root, ".agents", "agents"), { recursive: true });
		await fs.mkdir(path.join(root, ".agents", "knowledge"), { recursive: true });
		for (const [relativePath, content] of Object.entries(files)) {
			const filePath = path.join(root, relativePath);
			await fs.mkdir(path.dirname(filePath), { recursive: true });
			await fs.writeFile(filePath, content, "utf8");
		}
		await callback(root);
	} finally {
		await fs.rm(root, { force: true, recursive: true });
	}
}

const validAgent = `---
name: report-agent
description: Reviews metrics inputs and drafts a concise weekly report.
tools: ["Read", "Grep", "Glob"]
skills: []
memory: project
---

# Report Agent

## Instructions

Review supplied metrics, identify gaps, and draft a concise report.

## Knowledge

\`\`\`yaml
memory:
  scope: project
  seed_files: []
\`\`\`

## Triggers

\`\`\`yaml
triggers:
  schedules: []
  events: []
\`\`\`

## Channels

\`\`\`yaml
channels:
  - name: ChatGPT
    mode: interactive
\`\`\`

## Conversation Starters

\`\`\`yaml
conversation_starters:
  - Draft the weekly metrics report from this sheet.
\`\`\`

## Validation

- Run the validator.

## Maintenance Notes

- No known unavailable tools.
`;

test("validates a complete agent definition", async () => {
	await withFixture({
		".agents/agents/report-agent.md": validAgent,
	}, async (root) => {
		const result = await runValidator(root);
		assert.equal(result.code, 0);
		assert.match(result.stdout, /Validated 1 agent file/u);
	});
});

test("fails when required frontmatter is missing", async () => {
	await withFixture({
		".agents/agents/report-agent.md": validAgent.replace("description: Reviews metrics inputs and drafts a concise weekly report.\n", ""),
	}, async (root) => {
		const result = await runValidator(root);
		assert.equal(result.code, 1);
		assert.match(result.stderr, /missing required frontmatter field "description"/u);
	});
});

test("fails on invalid frontmatter fields", async () => {
	await withFixture({
		".agents/agents/report-agent.md": validAgent.replace("memory: project", "memory: project\ninstructions: Do not put this in frontmatter."),
	}, async (root) => {
		const result = await runValidator(root);
		assert.equal(result.code, 1);
		assert.match(result.stderr, /unexpected frontmatter field "instructions"/u);
	});
});

test("warns but does not fail for unknown tools", async () => {
	await withFixture({
		".agents/agents/report-agent.md": validAgent.replace('"Glob"', '"ImaginaryTool"'),
	}, async (root) => {
		const result = await runValidator(root);
		assert.equal(result.code, 0);
		assert.match(result.stderr, /WARN .*unknown tool "ImaginaryTool"/u);
	});
});

test("fails when structured trigger YAML is malformed", async () => {
	await withFixture({
		".agents/agents/report-agent.md": validAgent.replace("triggers:\n  schedules: []\n  events: []", "triggers:\n  schedules: ["),
	}, async (root) => {
		const result = await runValidator(root);
		assert.equal(result.code, 1);
		assert.match(result.stderr, /Unclosed bracket or brace/u);
	});
});

test("fails when conversation starters are empty", async () => {
	await withFixture({
		".agents/agents/report-agent.md": validAgent.replace("conversation_starters:\n  - Draft the weekly metrics report from this sheet.", "conversation_starters: []"),
	}, async (root) => {
		const result = await runValidator(root);
		assert.equal(result.code, 1);
		assert.match(result.stderr, /Conversation Starters.*at least one starter/u);
	});
});

const withKnowledgePath = validAgent.replace("  scope: project\n", "  scope: project\n  path: .agents/knowledge/report-agent/\n");

test("fails when the declared knowledge path does not exist", async () => {
	await withFixture({
		".agents/agents/report-agent.md": withKnowledgePath,
	}, async (root) => {
		const result = await runValidator(root);
		assert.equal(result.code, 1);
		assert.match(result.stderr, /knowledge path "\.agents\/knowledge\/report-agent\/" does not exist/u);
	});
});

test("accepts a declared knowledge path that exists", async () => {
	await withFixture({
		".agents/agents/report-agent.md": withKnowledgePath,
		".agents/knowledge/report-agent/notes.md": "# Notes\n",
	}, async (root) => {
		const result = await runValidator(root);
		assert.equal(result.code, 0);
	});
});

test("fails when the knowledge path is not the agent's own folder", async () => {
	await withFixture({
		".agents/agents/report-agent.md": withKnowledgePath.replace("knowledge/report-agent/", "knowledge/other-agent/"),
		".agents/knowledge/other-agent/notes.md": "# Notes\n",
	}, async (root) => {
		const result = await runValidator(root);
		assert.equal(result.code, 1);
		assert.match(result.stderr, /knowledge path must be "\.agents\/knowledge\/report-agent\/"/u);
	});
});
