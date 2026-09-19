const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

for (const wrapper of [false, true]) {
	test(`target verification selects ${wrapper ? "build:export" : "build"} and records the actual export inventory`, (t) => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-verify-target-"));
		t.after(() => fs.rmSync(root, { recursive: true, force: true }));
		fs.mkdirSync(path.join(root, "scripts"));
		fs.mkdirSync(path.join(root, "bin"));
		fs.copyFileSync(path.resolve(__dirname, "../../../../scripts/prepare-static-export.mjs"), path.join(root, "scripts/prepare-static-export.mjs"));
		fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ scripts: wrapper ? { "build:export": "fixture" } : {} }));
		const fakePnpm = path.join(root, "bin/pnpm");
		fs.writeFileSync(fakePnpm, '#!/bin/sh\nprintf "%s\\n" "$*" >> calls.log\ncase "$*" in\n"run build"|"run build:export") mkdir -p out; printf "<html>Exported</html>" > out/index.html;;\nesac\n');
		fs.chmodSync(fakePnpm, 0o755);
		const result = spawnSync("bash", [path.join(__dirname, "verify-target.sh"), root], {
			encoding: "utf8", env: { ...process.env, PATH: `${root}/bin${path.delimiter}${process.env.PATH}` },
		});
		assert.equal(result.status, 0, result.stdout + result.stderr);
		assert.equal(fs.readFileSync(path.join(root, "calls.log"), "utf8"), `install\nrun typecheck\nrun ${wrapper ? "build:export" : "build"}\n`);
		const inventory = JSON.parse(fs.readFileSync(path.join(root, "output/export-inventory.json"), "utf8"));
		assert.equal(inventory.routes[0].html.rawBytes, 21);
		assert.equal(fs.existsSync(path.join(root, "out/index.html.gz")), false);
	});
}
