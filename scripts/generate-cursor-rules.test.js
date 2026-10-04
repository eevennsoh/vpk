const assert = require("node:assert/strict");
const { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { renderCursorRule, syncCursorRules } = require("./generate-cursor-rules.js");

const SCOPED_RULE = `---
description: UI gotchas
paths:
  - "components/**/*.tsx"
  - "app/**/*.tsx"
---

# UI Gotchas

- No double borders on overlays.
`;

test("a scoped rule becomes an auto-attached Cursor rule with the same globs", () => {
	const rendered = renderCursorRule(SCOPED_RULE, "gotchas-ui.md");
	assert.match(rendered, /^---\ndescription: UI gotchas\nglobs: components\/\*\*\/\*\.tsx, app\/\*\*\/\*\.tsx\nalwaysApply: false\n---\n/u);
	assert.match(rendered, /Generated from \.agents\/rules\/gotchas-ui\.md/u);
	assert.match(rendered, /# UI Gotchas\n\n- No double borders on overlays\.\n$/u);
});

test("an unscoped rule is always applied in Cursor too", () => {
	const rendered = renderCursorRule("---\ndescription: Tokens\n---\n\n# Tokens\n", "token-priority.md");
	assert.match(rendered, /^---\ndescription: Tokens\nalwaysApply: true\n---\n/u);
});

test("check mode reports drift and stale mirrors without writing", () => {
	const root = mkdtempSync(path.join(os.tmpdir(), "cursor-rules-"));
	try {
		const rulesDir = path.join(root, "rules");
		const cursorDir = path.join(rulesDir, "cursor");
		mkdirSync(cursorDir, { recursive: true });
		writeFileSync(path.join(rulesDir, "gotchas-ui.md"), SCOPED_RULE);
		writeFileSync(path.join(cursorDir, "retired.mdc"), "old");
		assert.deepEqual(syncCursorRules({ cursorDir, rulesDir, write: false }), { drift: ["gotchas-ui.mdc"], stale: ["retired.mdc"] });
		syncCursorRules({ cursorDir, rulesDir });
		assert.deepEqual(syncCursorRules({ cursorDir, rulesDir, write: false }), { drift: [], stale: [] });
		assert.equal(readFileSync(path.join(cursorDir, "gotchas-ui.mdc"), "utf8"), renderCursorRule(SCOPED_RULE, "gotchas-ui.md"));
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});

test("the committed Cursor mirrors match every canonical rule", () => {
	assert.deepEqual(syncCursorRules({ write: false }), { drift: [], stale: [] });
});
