const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const DEMO_SOURCE = fs.readFileSync(path.join(__dirname, "skill-tag-demo.tsx"), "utf8");

test("Skill Tag colors demo shows every collection on a blue colored surface", () => {
	assert.match(DEMO_SOURCE, /data-slot="skill-tag-colors-neutral"/u);
	assert.match(DEMO_SOURCE, /data-slot="skill-tag-colors-on-colored"/u);
	for (const color of ["default", "marketplace", "platform", "custom", "teamwork", "software", "strategy", "service", "product"]) {
		assert.match(
			DEMO_SOURCE,
			new RegExp(`<SkillTag color="${color}" variant="on-colored">`, "u"),
		);
	}
});
