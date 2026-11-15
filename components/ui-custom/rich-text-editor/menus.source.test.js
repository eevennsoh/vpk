const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

// The menu classes (.rich-text-command-menu*, .rich-text-mention-visual) live in rich-text-editor.css.
// Menu-only importers (agent, skill and assignee pickers) use the Tiptap-free menus entry instead of the
// package entry, so that entry has to bring the stylesheet or those menus render unstyled on direct loads.
test("the Tiptap-free menus entry brings the menu stylesheet", () => {
	const source = fs.readFileSync(path.join(process.cwd(), "components/ui-custom/rich-text-editor/menus.ts"), "utf8");
	assert.match(source, /^import "\.\/rich-text-editor\.css";$/mu);
});
