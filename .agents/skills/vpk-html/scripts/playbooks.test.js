#!/usr/bin/env node
// T6 (ws6 §8, integration K22/R9): playbook parsing and rules, baselines, routing, committed
// playbooks and their links, and the --playbook runner.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const SKILL_ROOT = path.join(__dirname, "..");
const VALIDATE_SKILLS = path.resolve(SKILL_ROOT, "..", "..", "..", "scripts", "validate-skills.js");

async function load() {
	return import("./playbooks.mjs");
}

function write(file, text) {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, text);
}

const GOOD = `---
template: alpha.html
demo: demo-alpha.html   # the catalog demo
evals: [alpha-eval]
figure_engines: [none, iso-kit]
---

# alpha playbook

Load before you draft \`alpha.html\`. Back to [SKILL.md](../../SKILL.md).

## Use when
- one decision

## Choose
- beta.html for something else

## Structure
- header then body

## Figures
- none needed

## Pitfalls
- burying the decision
`;

function fixture(t, { playbooks = { alpha: GOOD }, cheatsheet, authoring } = {}) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-playbooks-"));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));
	for (const name of ["alpha", "beta", "gamma"]) write(path.join(root, "assets", "templates", `${name}.html`), "<!doctype html>");
	write(path.join(root, "assets", "demos", "demo-alpha.html"), "<!doctype html>");
	write(path.join(root, "assets", "demos", "demo-orphan.html"), "<!doctype html>");
	write(path.join(root, "index.html"), `<a class="demo-row" href="assets/demos/demo-alpha.html">Alpha</a>`);
	write(path.join(root, "references", "schemas", "alpha.json"), "{}");
	write(path.join(root, "references", "schemas", "document.json"), "{}");
	write(path.join(root, "evals", "evals.json"), JSON.stringify({ evals: [{ id: 1, name: "alpha-eval", template: "alpha.html" }, { id: 2, name: "beta-eval", template: "beta.html" }] }));
	write(path.join(root, "CHEATSHEET.md"), cheatsheet ?? "| A | `assets/templates/alpha.html` |\n| B | assets/templates/beta.html |\n| C | `assets/templates/gamma.html` |\n");
	write(path.join(root, "references", "authoring-detail.md"), authoring ?? "| A | `alpha.html` |\n| B | beta.html |\n| C | `gamma.html` |\n");
	for (const [stem, source] of Object.entries(playbooks)) write(path.join(root, "references", "playbooks", `${stem}.md`), source);
	return root;
}

test("parsePlaybook reads list and scalar frontmatter, strips trailing comments, and collects section bullets", async () => {
	const { parsePlaybook } = await load();
	const playbook = parsePlaybook(GOOD, "/x/references/playbooks/alpha.md");
	assert.equal(playbook.stem, "alpha");
	assert.deepEqual(playbook.frontmatter, { template: "alpha.html", demo: "demo-alpha.html", evals: ["alpha-eval"], figure_engines: ["none", "iso-kit"] });
	assert.deepEqual(playbook.sections["use when"], ["one decision"]);
	assert.deepEqual(playbook.sections.figures, ["none needed"]);
	assert.equal(playbook.lineCount, GOOD.split("\n").length - 1);
	assert.deepEqual(playbook.issues, []);
	assert.match(parsePlaybook("# no frontmatter\n").issues.join("\n"), /missing the --- frontmatter block/);
	assert.deepEqual(parsePlaybook("---\nevals: []\n---\n").frontmatter.evals, []);
});

test("validatePlaybook reports every rule", async t => {
	const { validatePlaybook, parsePlaybook } = await load();
	const skillRoot = fixture(t);
	const corpus = JSON.parse(fs.readFileSync(path.join(skillRoot, "evals", "evals.json"), "utf8"));
	const check = (source, stem = "alpha") => validatePlaybook(parsePlaybook(source, path.join(skillRoot, "references", "playbooks", `${stem}.md`)), { skillRoot, corpus }).join("\n");
	assert.equal(check(GOOD), "");
	assert.match(check(GOOD.replace("## Choose\n- beta.html for something else\n", "")), /missing section "## Choose"/);
	assert.match(check(GOOD.replace("- burying the decision\n", "")), /section "## Pitfalls" needs at least one "- " bullet/);
	assert.match(check(GOOD.replace("template: alpha.html", "template: zeta.html")), /template zeta\.html does not exist[\s\S]*does not match the playbook file name alpha\.md/);
	assert.match(check(GOOD, "beta"), /template alpha\.html does not match the playbook file name beta\.md/);
	assert.match(check(GOOD.replace("demo: demo-alpha.html", "demo: demo-orphan.html")), /demo demo-orphan\.html is not linked from index\.html/);
	assert.match(check(GOOD.replace("demo: demo-alpha.html", "demo: demo-none.html")), /demo demo-none\.html does not exist/);
	assert.match(check(GOOD.replace("evals: [alpha-eval]", "evals: [missing-eval, 1]")), /"missing-eval" names no scenario[\s\S]*"1" names no scenario.*not ids/);
	assert.match(check(GOOD.replace("evals: [alpha-eval]", "evals: [beta-eval]")), /eval "beta-eval" uses beta\.html, not alpha\.html/);
	assert.match(check(GOOD.replace("evals: [alpha-eval]", "evals: alpha-eval")), /evals must be a list/);
	assert.match(check(GOOD.replace("[none, iso-kit]", "[iso, anatomy]")), /"iso" is not one of: none, iso-kit, anatomy-hero, both[\s\S]*"anatomy" is not one of/);
	assert.match(check(GOOD.replace("figure_engines: [none, iso-kit]", "figure_engines: []")), /figure_engines must list at least one/);
	assert.equal(check(GOOD.replace("figure_engines:", "schema: alpha\nfigure_engines:")), "");
	assert.match(check(GOOD.replace("figure_engines:", "schema: document\nfigure_engines:")), /schema document must equal the template stem alpha/);
	assert.match(check(GOOD.replace("figure_engines:", "schema: nope\nfigure_engines:")), /schema nope has no references\/schemas\/nope\.json/);
	assert.match(check(GOOD.replace("figure_engines:", "content_ir: vpk-x-thread/1\nfigure_engines:")), /content_ir was withdrawn; name the content schema with schema:/);
	assert.match(check(GOOD.replace("figure_engines:", "owner: ws6\nfigure_engines:")), /unknown frontmatter key "owner"/);
	assert.match(check(GOOD.replace("demo: demo-alpha.html   # the catalog demo\n", "")), /frontmatter needs demo:/);
	assert.match(check(`${GOOD}${"- filler\n".repeat(140)}`), /has \d+ lines; the limit is 150/);
	assert.match(check(GOOD.replace("Load before you draft `alpha.html`. Back to [SKILL.md](../../SKILL.md).\n\n", "")), /first line under the H1 must be "Load before you draft `alpha\.html`\. Back to \[SKILL\.md\]/);
	assert.match(check(GOOD.replace("`alpha.html`. Back", "`beta.html`. Back")), /first line under the H1 must be/);
});

test("baselines: uncovered templates are reported, and stale baseline entries may only shrink", async t => {
	const { collectPlaybookIssues } = await load();
	const skillRoot = fixture(t);
	assert.deepEqual(collectPlaybookIssues(skillRoot, { legacyWithoutPlaybook: ["beta.html", "gamma.html"], legacyWithoutEval: ["gamma.html"] }), []);
	const missing = collectPlaybookIssues(skillRoot, { legacyWithoutPlaybook: ["beta.html"], legacyWithoutEval: [] }).join("\n");
	assert.match(missing, /assets\/templates\/gamma\.html has no playbook: write references\/playbooks\/gamma\.md/);
	assert.match(missing, /assets\/templates\/gamma\.html has no eval scenario/);
	const stale = collectPlaybookIssues(skillRoot, { legacyWithoutPlaybook: ["alpha.html", "beta.html", "gamma.html", "retired.html"], legacyWithoutEval: ["beta.html", "gamma.html"] }).join("\n");
	assert.match(stale, /LEGACY_TEMPLATES_WITHOUT_PLAYBOOK lists alpha\.html, which now has a playbook: remove it; the baseline may only shrink/);
	assert.match(stale, /LEGACY_TEMPLATES_WITHOUT_PLAYBOOK lists retired\.html, which no longer exists: remove it; the baseline may only shrink/);
	assert.match(stale, /LEGACY_TEMPLATES_WITHOUT_EVAL lists beta\.html, which now has an eval scenario: remove it; the baseline may only shrink/);
	const corpus = { evals: [{ name: "alpha-eval", template: "alpha.html" }] };
	assert.match(collectPlaybookIssues(skillRoot, { corpus, legacyWithoutPlaybook: ["beta.html", "gamma.html"], legacyWithoutEval: ["gamma.html"] }).join("\n"), /beta\.html has no eval scenario/, "a passed corpus wins over evals.json");
});

test("routing accepts backticked and bare template names and reports gaps", async t => {
	const { collectRoutingIssues } = await load();
	assert.deepEqual(collectRoutingIssues(fixture(t)), []);
	const gaps = collectRoutingIssues(fixture(t, { cheatsheet: "| A | `assets/templates/alpha.html` |\n", authoring: "| A | `alpha.html` |\n| B | gamma.html.bak |\n" })).join("\n");
	assert.match(gaps, /CHEATSHEET\.md does not route assets\/templates\/beta\.html/);
	assert.match(gaps, /CHEATSHEET\.md does not route assets\/templates\/gamma\.html/);
	assert.match(gaps, /authoring-detail\.md has no template-map row for beta\.html/);
	assert.match(gaps, /authoring-detail\.md has no template-map row for gamma\.html/);
});

test("routing reports every diagram the cheatsheet does not name", async t => {
	const { collectRoutingIssues } = await load();
	const root = fixture(t, { cheatsheet: "| A | `assets/templates/alpha.html` |\n| B | assets/templates/beta.html |\n| C | `assets/templates/gamma.html` |\n| Gantt | `assets/diagrams/gantt.html` |\n" });
	for (const name of ["gantt", "force-network"]) write(path.join(root, "assets", "diagrams", `${name}.html`), "<!doctype html>");
	assert.deepEqual(collectRoutingIssues(root), ["CHEATSHEET.md does not route assets/diagrams/force-network.html"]);
});

test("the committed cheatsheet routes every template and diagram", async () => {
	const { collectRoutingIssues } = await load();
	assert.deepEqual(collectRoutingIssues(), []);
});

test("legacy baselines hold unique .html names and the figure-engine vocabulary is R3's", async () => {
	const { LEGACY_TEMPLATES_WITHOUT_PLAYBOOK, LEGACY_TEMPLATES_WITHOUT_EVAL, FIGURE_ENGINES, REQUIRED_SECTIONS } = await load();
	for (const list of [LEGACY_TEMPLATES_WITHOUT_PLAYBOOK, LEGACY_TEMPLATES_WITHOUT_EVAL]) {
		assert.equal(new Set(list).size, list.length);
		assert.ok(list.every(name => /^[a-z0-9-]+\.html$/.test(name)));
		assert.ok(Object.isFrozen(list));
	}
	assert.deepEqual([...FIGURE_ENGINES], ["none", "iso-kit", "anatomy-hero", "both"]);
	assert.deepEqual([...REQUIRED_SECTIONS], ["Use when", "Choose", "Structure", "Pitfalls"]);
});

test("committed playbooks are valid", async () => {
	const { loadPlaybooks, validatePlaybook } = await load();
	const playbooks = loadPlaybooks(SKILL_ROOT);
	assert.ok(playbooks.some(playbook => playbook.stem === "one-pager"));
	assert.ok(playbooks.some(playbook => playbook.stem === "status-report"));
	for (const playbook of playbooks) assert.deepEqual(validatePlaybook(playbook, { skillRoot: SKILL_ROOT }), [], playbook.stem);
	for (const playbook of playbooks) {
		const source = fs.readFileSync(playbook.file, "utf8");
		const line = `Load before you draft \`${playbook.frontmatter.template}\`. Back to [SKILL.md](../../SKILL.md).`;
		assert.match(source, new RegExp(`^# ${playbook.stem} playbook\n\n${line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\n`, "m"), `${playbook.stem}: load line under the H1`);
	}
});

test("relative links in contract.md, publish.md and the playbooks resolve", { skip: !fs.existsSync(VALIDATE_SKILLS) && "scripts/validate-skills.js not present (standalone skill)" }, () => {
	const { collectMarkdownLinks } = require(VALIDATE_SKILLS);
	const playbookDir = path.join(SKILL_ROOT, "references", "playbooks");
	const docs = [
		path.join(SKILL_ROOT, "references", "contract.md"),
		path.join(SKILL_ROOT, "references", "publish.md"),
		...fs.readdirSync(playbookDir).filter(name => name.endsWith(".md")).map(name => path.join(playbookDir, name)),
	];
	let links = 0;
	for (const doc of docs) {
		for (const link of collectMarkdownLinks(fs.readFileSync(doc, "utf8"))) {
			links += 1;
			assert.ok(fs.existsSync(path.resolve(path.dirname(doc), link.target)), `${path.relative(SKILL_ROOT, doc)} links to missing ${link.target}`);
		}
	}
	assert.ok(links > 0);
});

test("runPlaybook lists templates, prints one playbook, and exits 1 for a template without one", async t => {
	const { runPlaybook } = await load();
	const skillRoot = fixture(t);
	const capture = () => {
		const out = { log: [], error: [] };
		return { out, io: { skillRoot, log: line => out.log.push(line), error: line => out.error.push(line) } };
	};
	let run = capture();
	assert.equal(runPlaybook(undefined, {}, run.io), 0);
	assert.match(run.out.log.join("\n"), /^template\s+playbook\s+schema\s+evals\s+demo$/m);
	assert.match(run.out.log.join("\n"), /^alpha\.html\s+✓\s+alpha\s+alpha-eval\s+demo-alpha\.html$/m);
	assert.match(run.out.log.join("\n"), /1 of 3 templates have a playbook/);
	run = capture();
	assert.equal(runPlaybook(undefined, { json: true }, run.io), 0);
	assert.deepEqual(JSON.parse(run.out.log[0])[1], { template: "beta.html", playbook: null, schema: null, evals: ["beta-eval"], demo: null });
	run = capture();
	assert.equal(runPlaybook("alpha.html", {}, run.io), 0);
	assert.equal(run.out.log[0], GOOD.trimEnd());
	run = capture();
	assert.equal(runPlaybook("alpha", { json: true }, run.io), 0);
	assert.deepEqual(JSON.parse(run.out.log[0]).frontmatter.evals, ["alpha-eval"]);
	run = capture();
	assert.equal(runPlaybook("gamma", {}, run.io), 1);
	assert.equal(run.out.error[0], "no playbook for gamma; route via CHEATSHEET.md and references/authoring-detail.md");
});

test("every plain-text Look up entry in verification § 10 names a Failure row in anti-patterns § 7", () => {
	const read = name => fs.readFileSync(path.join(SKILL_ROOT, "references", name), "utf8");
	const section = (text, start) => text.slice(text.indexOf(start)).split(/\n## /)[0];
	const rows = text => text.split("\n").filter(line => /^\| (?!-)/.test(line)).slice(1).map(line => line.split("|").slice(1, -1).map(cell => cell.trim()));
	const failures = new Set(rows(section(read("anti-patterns.md"), "## 7.")).map(([failure]) => failure));
	const symptoms = rows(section(read("verification.md"), "10. Map each user complaint"));
	assert.ok(failures.size > 0 && symptoms.length > 0, "both tables parse");
	for (const [said, , lookUp] of symptoms) {
		for (const name of lookUp.split(";").map(part => part.trim()).filter(part => part && !part.startsWith("["))) {
			assert.ok(failures.has(name), `verification § 10 "${said}" looks up "${name}", which anti-patterns § 7 has no row for`);
		}
		// Linked fixes go straight to their owner (one hop); each anchor must name a heading there.
		for (const [, file, anchor] of lookUp.matchAll(/\]\(([\w-]+\.md)#([\w-]+)\)/g)) {
			const slugs = read(file).split("\n").filter(line => /^#{1,6} /.test(line)).map(line => line.replace(/^#+ /, "").trim().toLowerCase().replace(/[`*]/g, "").replace(/[^\p{L}\p{N} _-]/gu, "").replace(/ /g, "-"));
			assert.ok(slugs.includes(anchor), `verification § 10 "${said}" links ${file}#${anchor}, which is not a heading there`);
		}
	}
});
