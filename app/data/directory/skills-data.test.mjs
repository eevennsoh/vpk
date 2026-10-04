import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { parseSkillMd, serializeSkillMd } from "./skill-frontmatter.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const skills = JSON.parse(fs.readFileSync(path.join(HERE, "skills.json"), "utf8"));

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const VERSION_RE = /^\d+\.\d+\.\d+$/u;
const LICENSES = new Set(["Apache-2.0", "MIT", "Proprietary"]);

function field(frontmatter, key) {
	return frontmatter.find((entry) => entry.key === key)?.value;
}

test("every skill carries a standard, round-tripping SKILL.md", () => {
	assert.ok(skills.length > 0, "catalog is non-empty");
	for (const skill of skills) {
		assert.equal(typeof skill.skillMd, "string", `${skill.id}: skillMd present`);
		const { frontmatter, body } = parseSkillMd(skill.skillMd);

		// Required frontmatter per the agentskills spec.
		assert.equal(field(frontmatter, "name"), skill.id, `${skill.id}: frontmatter name == id`);
		assert.ok(SLUG_RE.test(skill.id), `${skill.id}: id is a slug`);
		const description = field(frontmatter, "description");
		assert.equal(typeof description, "string", `${skill.id}: description is a string`);
		assert.ok(description.trim().length > 0, `${skill.id}: description non-empty`);

		// allowed-tools = the referenced apps (non-empty list). create-skill is the built-in authoring
		// flow (created-skills-store.ts): it only uses internal Editor/Knowledge tools, so it lists none.
		const allowed = field(frontmatter, "allowed-tools");
		if (skill.id === "create-skill") {
			assert.equal(allowed, undefined, "create-skill references no external apps");
		} else {
			assert.ok(Array.isArray(allowed) && allowed.length > 0, `${skill.id}: allowed-tools is a non-empty list`);
		}

		// Optional but generated keys.
		assert.ok(LICENSES.has(field(frontmatter, "license")), `${skill.id}: valid license`);
		assert.ok(VERSION_RE.test(String(field(frontmatter, "version"))), `${skill.id}: semver version`);

		// Body is pure markdown — no leading fence, no embedded frontmatter.
		assert.ok(!/^---/u.test(body), `${skill.id}: body has no frontmatter fence`);
		assert.ok(!/^#\s/u.test(body.trimStart()), `${skill.id}: body does not start with a redundant H1`);

		// Round-trips through the codec the editor uses.
		assert.equal(serializeSkillMd(frontmatter, body), skill.skillMd, `${skill.id}: skillMd round-trips`);
	}
});

test("every skill carries provenance for the detail meta row", () => {
	for (const skill of skills) {
		assert.equal(typeof skill.createdBy, "string", `${skill.id}: createdBy`);
		assert.ok(skill.createdBy.trim().length > 0, `${skill.id}: createdBy non-empty`);
		assert.equal(skill.addedBy, "You", `${skill.id}: addedBy`);
		assert.ok(!Number.isNaN(Date.parse(skill.lastUpdatedAt)), `${skill.id}: valid lastUpdatedAt`);
		assert.equal(typeof skill.verified, "boolean", `${skill.id}: verified is boolean`);
	}
});

test("personal/custom skills are attributed to Venn", () => {
	for (const skill of skills) {
		if (skill.companyId === "you" || skill.source === "custom") {
			assert.equal(skill.createdBy, "Venn", `${skill.id}: personal skill createdBy Venn`);
		}
	}
});
