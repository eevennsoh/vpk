#!/usr/bin/env node

// port-kami source resolution, preflight and write target; migrate-identity guard (ws0 T-K*).
// Never passes --in-place: every run writes only under a temp folder.

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");

const SCRIPT = path.join(__dirname, "port-kami.mjs");
const load = name => import(pathToFileURL(path.join(__dirname, name)).href);

function tempDir(t, prefix) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
	return dir;
}

function runPortKami(args, env) {
	return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8", env: { ...process.env, ...env } });
}

test("T-K1 a missing source fails before any write with an actionable message", t => {
	const home = tempDir(t, "vpk-kami-home-");
	const envSource = tempDir(t, "vpk-kami-env-");
	const source = tempDir(t, "vpk-kami-src-");
	const out = path.join(tempDir(t, "vpk-kami-out-"), "out");
	const result = runPortKami(["--source", source, "--out", out], { HOME: home, VPK_HTML_KAMI_SOURCE: envSource });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Kami source not found/);
	assert.match(result.stderr, /--source/);
	assert.match(result.stderr, /git clone --depth 1 https:\/\/github\.com\/tw93\/Kami/);
	assert.doesNotMatch(result.stdout, /Inlining local Geist fonts/, "preflight runs before the first log line");
	assert.equal(fs.existsSync(out), false, "nothing is written");

	const missing = runPortKami(["--source", path.join(source, "nope"), "--out", out], { HOME: home, VPK_HTML_KAMI_SOURCE: envSource });
	assert.equal(missing.status, 1, "an explicit --source that does not exist never falls through");
	assert.equal(fs.existsSync(out), false);
});

test("T-K2 resolveKamiSource detects the repo, plugin and skill layouts", async t => {
	const { KAMI_SOURCE_ENV, resolveKamiSource } = await load("port-kami.mjs");
	const make = (root, dirs) => { for (const dir of dirs) fs.mkdirSync(path.join(root, dir), { recursive: true }); return root; };
	const base = tempDir(t, "vpk-kami-layouts-");
	const repo = make(path.join(base, "repo"), ["skills/kami/assets/templates", "skills/kami/assets/diagrams", "site/assets/demos"]);
	const plugin = make(path.join(base, "plugin"), ["plugins/kami/skills/kami/assets/templates", "plugins/kami/skills/kami/assets/diagrams"]);
	const skill = make(path.join(base, "skill"), ["assets/templates", "assets/diagrams"]);

	const fromRepo = resolveKamiSource({ source: repo, env: {}, home: base });
	assert.equal(fromRepo.root, repo);
	assert.equal(fromRepo.dirs.templates, path.join(repo, "skills/kami/assets/templates"));
	assert.equal(fromRepo.dirs.demos, path.join(repo, "site/assets/demos"));
	assert.equal(fromRepo.layouts.diagrams, "repo");

	const fromPlugin = resolveKamiSource({ env: { [KAMI_SOURCE_ENV]: plugin }, home: base });
	assert.equal(fromPlugin.root, plugin, "the env var is the second candidate");
	assert.equal(fromPlugin.dirs.diagrams, path.join(plugin, "plugins/kami/skills/kami/assets/diagrams"));
	assert.equal(fromPlugin.dirs.demos, null);

	const fromSkill = resolveKamiSource({ source: skill, env: {}, home: base });
	assert.equal(fromSkill.dirs.templates, path.join(skill, "assets/templates"));
	assert.equal(fromSkill.dirs.demos, null, "a skill-layout root without assets/demos");

	const home = make(path.join(base, "home"), [".agents/skills/kami/assets/templates"]);
	assert.equal(resolveKamiSource({ env: {}, home }).dirs.templates, path.join(home, ".agents/skills/kami/assets/templates"), "~/.agents/skills/kami is the default");
	const absent = resolveKamiSource({ source: path.join(base, "missing"), env: { [KAMI_SOURCE_ENV]: repo }, home });
	assert.equal(absent.root, null);
	assert.match(absent.error, /does not exist/);
});

test("T-K3 a write target is required; --out writes only the ported files", t => {
	const usage = runPortKami(["--templates", "--source", os.tmpdir()], {});
	assert.equal(usage.status, 1);
	assert.match(usage.stderr, /pass exactly one of --out <dir> \(recommended\) or --in-place/);

	const fixture = tempDir(t, "vpk-kami-fixture-");
	const templates = path.join(fixture, "skills/kami/assets/templates");
	fs.mkdirSync(templates, { recursive: true });
	fs.writeFileSync(path.join(templates, "one-pager-en.html"), '<!doctype html><html><head><meta charset="utf-8"><title>x</title><style>body{}</style></head><body><main>x</main></body></html>');
	const out = path.join(tempDir(t, "vpk-kami-out-"), "port");
	const result = runPortKami(["--templates", "--source", fixture, "--out", out], {});
	assert.equal(result.status, 0, result.stderr);
	const written = fs.readdirSync(out, { recursive: true }).filter(entry => entry.endsWith(".html"));
	assert.deepEqual(written, [path.join("templates", "one-pager.html")]);
	assert.match(fs.readFileSync(path.join(out, "templates", "one-pager.html"), "utf8"), /<meta name="generator" content="vpk-html">/);
});

test("T-K4 migrate-identity runs only with --legacy-one-shot", async () => {
	const { shouldRunLegacyMigration } = await load("migrate-identity.mjs");
	assert.equal(shouldRunLegacyMigration([]), false);
	assert.equal(shouldRunLegacyMigration(["--legacy-one-shot"]), true);
});
