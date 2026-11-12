const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const SIDEBAR_SOURCE = fs.readFileSync(path.join(__dirname, "admin-sidebar-items.tsx"), "utf8");
const AUDIT_LOG_SOURCE = fs.readFileSync(path.join(__dirname, "audit-log-view.tsx"), "utf8");

test("admin sidebar disclosure buttons expose expanded state", () => {
	const expandedAttributeMatches = SIDEBAR_SOURCE.match(/aria-expanded=\{isExpanded\}/g) ?? [];

	assert.equal(expandedAttributeMatches.length, 2);
});

test("audit log row disclosure button exposes expanded state", () => {
	assert.match(
		AUDIT_LOG_SOURCE,
		/<Button[\s\S]*aria-label=\{isExpanded \? `Collapse \$\{log\.action\}` : `Expand \$\{log\.action\}`\}[\s\S]*aria-expanded=\{isExpanded\}/,
	);
});
