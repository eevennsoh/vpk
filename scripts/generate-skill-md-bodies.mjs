#!/usr/bin/env node
/**
 * Regenerate every skill-directory catalog entry to the Anthropic "Agent Skills"
 * SKILL.md standard: a full `skillMd` string (YAML frontmatter `---` block +
 * markdown body) plus provenance fields (createdBy / addedBy / lastUpdatedAt).
 *
 * The SKILL.md spec is grounded in the repo's `skill-creator` skill: frontmatter
 * requires `name` (slug) + `description` (when-to-use), optional `allowed-tools`
 * (here = the apps the skill references), `license`, `version`; the body is
 * imperative markdown instructions. We author the frontmatter shape ourselves,
 * so the body content is templated per category for realistic variety rather
 * than run through skill-creator's eval loop 86 times.
 *
 * Deterministic: every value is keyed off a hash of `skill.id` (no Date.now /
 * Math.random) so re-running produces identical output. One-shot scaffold —
 * committed skills.json is the source of truth afterward; this script stays for
 * reference / re-runs. Validates before writing and fails loudly.
 *
 * Frontmatter serialization is imported from the app codec
 * (`app/data/directory/skill-frontmatter.ts`) so generated text always
 * round-trips through the same parser the editor uses.
 *
 * Usage: `pnpm run gen:skill-bodies`
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseSkillMd, serializeSkillMd } from "../app/data/directory/skill-frontmatter.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(HERE, "..", "app", "data", "directory", "skills.json");

// Fixed base date (NOT Date.now) so lastUpdatedAt is deterministic + SSR-stable.
const BASE_DATE_MS = Date.parse("2026-06-01T00:00:00.000Z");
const DAY_MS = 86_400_000;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const VERSION_RE = /^\d+\.\d+\.\d+$/u;
const LICENSES = ["Apache-2.0", "MIT", "Proprietary"];

const ORGS = ["Atlassian", "Anthropic", "Slack", "GitHub", "Figma", "Notion", "Linear", "Zoom"];

const APPS_BY_CATEGORY = {
	"project-management": ["Jira", "Confluence", "Trello"],
	"administrative-tools": ["Confluence", "Google Calendar", "Slack"],
	"content-and-communication": ["Confluence", "Slack", "Loom"],
	"data-and-analytics": ["Atlassian Analytics", "Snowflake", "Jira"],
	"software-development": ["Bitbucket", "GitHub", "Jira"],
	"it-support-and-service": ["Jira Service Management", "Opsgenie", "Slack"],
	"design-and-diagramming": ["Figma", "Confluence", "Lucidchart"],
	"security-and-compliance": ["Jira", "Confluence", "Splunk"],
	"hr-and-team-building": ["Confluence", "Slack", "Workday"],
	"sales-and-customer-relations": ["Salesforce", "Jira", "Slack"],
};
const DEFAULT_APPS = ["Confluence", "Jira", "Slack"];

const CATEGORY_COPY = {
	"project-management": {
		when: "the user needs to plan, break down, or track delivery work",
		steps: [
			"Clarify the goal, scope, and the timeframe you are planning against.",
			"Pull the current state from the connected apps and identify gaps or blockers.",
			"Produce the breakdown — work items, owners, and estimates — and confirm dependencies.",
		],
		output: "A delivery-ready plan with owned work items, estimates, and called-out risks.",
	},
	"administrative-tools": {
		when: "the user wants to automate routine coordination or record-keeping",
		steps: [
			"Capture the request and the inputs it depends on.",
			"Cross-check the connected sources so nothing is stale or missing.",
			"Carry out the task and summarize what changed.",
		],
		output: "The completed action plus a short, auditable summary of what was done.",
	},
	"content-and-communication": {
		when: "the user needs to draft, summarize, or shape written communication",
		steps: [
			"Read the source material and identify the audience and intent.",
			"Draft the content, leading with the outcome the reader cares about.",
			"Tighten for clarity and flag anything that needs a human decision.",
		],
		output: "Audience-ready copy you can edit before sharing.",
	},
	"data-and-analytics": {
		when: "the user wants to explore, summarize, or report on data",
		steps: [
			"Confirm the question and the metrics that answer it.",
			"Query the connected sources and validate the numbers before trusting them.",
			"Surface the findings with the supporting evidence and caveats.",
		],
		output: "A decision-ready readout of findings, trends, and recommended next steps.",
	},
	"software-development": {
		when: "the user is building, reviewing, or shipping software",
		steps: [
			"Establish the change and the constraints it has to satisfy.",
			"Work through the code or pipeline in order, grounding each step in the repo.",
			"Verify the result and note follow-ups before handing back.",
		],
		output: "A reviewed, working result with clear follow-ups.",
	},
	"it-support-and-service": {
		when: "the user is triaging, resolving, or routing a service request",
		steps: [
			"Identify the issue, its impact, and who is affected.",
			"Check the connected systems for prior incidents and known fixes.",
			"Resolve or route the request and record the resolution.",
		],
		output: "A resolved or correctly routed request with an auditable trail.",
	},
	"design-and-diagramming": {
		when: "the user is designing, mapping, or visualizing a system or interface",
		steps: [
			"Understand the problem and the audience for the artifact.",
			"Draft the structure, then refine layout, hierarchy, and detail.",
			"Review against the intent and prepare it for sharing.",
		],
		output: "A polished, shareable design artifact with deliberate choices.",
	},
	"security-and-compliance": {
		when: "the user needs to assess, harden, or document security and compliance posture",
		steps: [
			"Scope the assessment and the standards it maps to.",
			"Inspect the connected systems and evidence for gaps.",
			"Report findings ranked by risk with concrete remediations.",
		],
		output: "A risk-ranked findings report with actionable remediations.",
	},
	"hr-and-team-building": {
		when: "the user is supporting people, teams, or culture work",
		steps: [
			"Clarify the need and the people it affects.",
			"Gather the relevant context from the connected sources.",
			"Produce the output and flag anything that needs a human touch.",
		],
		output: "A thoughtful, people-first result ready to review.",
	},
	"sales-and-customer-relations": {
		when: "the user is managing deals, accounts, or customer relationships",
		steps: [
			"Confirm the account, the stage, and the desired outcome.",
			"Pull the latest from the connected CRM and conversation history.",
			"Produce the output and recommend the next best action.",
		],
		output: "A customer-ready output with a recommended next step.",
	},
};

const DEFAULT_COPY = {
	when: "the user's request matches what this skill does",
	steps: [
		"Clarify the goal and the inputs it depends on.",
		"Work through the task using the connected apps.",
		"Summarize the result and note any follow-ups.",
	],
	output: "A clear, review-ready result.",
};

function hash(str) {
	let h = 2166136261;
	for (let i = 0; i < str.length; i += 1) {
		h ^= str.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

function joinList(items) {
	if (items.length <= 1) return items.join("");
	if (items.length === 2) return `${items[0]} and ${items[1]}`;
	return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function pickApps(skill, h) {
	const pool = APPS_BY_CATEGORY[skill.categoryId] ?? DEFAULT_APPS;
	const count = 2 + (h % 2); // 2 or 3
	const start = h % pool.length;
	const apps = [];
	for (let i = 0; i < count; i += 1) {
		apps.push(pool[(start + i) % pool.length]);
	}
	return [...new Set(apps)];
}

function pickLicense(skill, h) {
	if (skill.source === "2p" || skill.source === "3p" || skill.collectionId === "marketplace") {
		return "Proprietary";
	}
	return LICENSES[h % LICENSES.length];
}

function buildBody(skill, apps) {
	const copy = CATEGORY_COPY[skill.categoryId] ?? DEFAULT_COPY;
	const steps = copy.steps.map((step, i) => `${i + 1}. ${step}`).join("\n");
	return [
		skill.description,
		"",
		"## When to use",
		"",
		`Use this skill when ${copy.when}. It draws on ${joinList(apps)} to do the work.`,
		"",
		"## Instructions",
		"",
		steps,
		"",
		"## Output",
		"",
		copy.output,
	].join("\n");
}

function buildSkillMd(skill, h) {
	const apps = pickApps(skill, h);
	const frontmatter = [
		{ key: "name", value: skill.id },
		{ key: "description", value: skill.description },
		{ key: "allowed-tools", value: apps },
		{ key: "license", value: pickLicense(skill, h) },
		{ key: "version", value: `1.${h % 6}.${(h >>> 3) % 10}` },
	];
	return { skillMd: serializeSkillMd(frontmatter, buildBody(skill, apps)), apps };
}

function isPersonal(skill) {
	return skill.companyId === "you" || skill.source === "custom";
}

function main() {
	const skills = JSON.parse(fs.readFileSync(FILE, "utf8"));
	const failures = [];

	for (const skill of skills) {
		const h = hash(skill.id);
		const { skillMd } = buildSkillMd(skill, h);

		skill.skillMd = skillMd;
		skill.createdBy = isPersonal(skill) ? "Venn" : ORGS[h % ORGS.length];
		skill.addedBy = "You";
		skill.lastUpdatedAt = new Date(BASE_DATE_MS - (h % 540) * DAY_MS).toISOString();
		if (typeof skill.verified !== "boolean") {
			skill.verified = !isPersonal(skill);
		}

		// Validate.
		const { frontmatter, body } = parseSkillMd(skillMd);
		const fmName = frontmatter.find((e) => e.key === "name")?.value;
		const fmDesc = frontmatter.find((e) => e.key === "description")?.value;
		const fmTools = frontmatter.find((e) => e.key === "allowed-tools")?.value;
		const fmLicense = frontmatter.find((e) => e.key === "license")?.value;
		const fmVersion = frontmatter.find((e) => e.key === "version")?.value;

		if (!SLUG_RE.test(skill.id)) failures.push(`${skill.id}: id is not a valid slug`);
		if (fmName !== skill.id) failures.push(`${skill.id}: frontmatter name "${fmName}" != id`);
		if (typeof fmDesc !== "string" || fmDesc.trim() === "") failures.push(`${skill.id}: empty frontmatter description`);
		if (!Array.isArray(fmTools) || fmTools.length === 0) failures.push(`${skill.id}: allowed-tools missing`);
		if (!LICENSES.includes(fmLicense)) failures.push(`${skill.id}: bad license "${fmLicense}"`);
		if (!VERSION_RE.test(String(fmVersion))) failures.push(`${skill.id}: bad version "${fmVersion}"`);
		if (/^---/u.test(body)) failures.push(`${skill.id}: body contains a frontmatter fence`);
		if (serializeSkillMd(frontmatter, body) !== skillMd) failures.push(`${skill.id}: skillMd does not round-trip`);
		if (Number.isNaN(Date.parse(skill.lastUpdatedAt))) failures.push(`${skill.id}: invalid lastUpdatedAt`);
	}

	if (failures.length > 0) {
		console.error("Generation failed:\n" + failures.join("\n"));
		process.exit(1);
	}

	fs.writeFileSync(FILE, JSON.stringify(skills, null, "\t") + "\n", "utf8");
	console.log(`Regenerated SKILL.md + provenance for ${skills.length} skills.`);
}

main();
