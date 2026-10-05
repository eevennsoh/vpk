const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

function fixture(t, source) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-asset-audit-"));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));
	fs.symlinkSync(path.resolve(__dirname, "../../../../node_modules"), path.join(root, "node_modules"));
	const write = (file, value = "asset") => {
		fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
		fs.writeFileSync(path.join(root, file), value);
	};
	write("package.json", "{}"); write(".vpk-source.json", '{"version":1}');
	write("app/page.tsx", source);
	return { root, write };
}

test("asset audit retains dynamic directories, nested data, CSS dependencies and public filesystem reads", async t => {
	const { audit, applyAudit } = await import("./audit-public-assets.mjs");
	const { root, write } = fixture(t, 'const icon = `/brands/${id}/24.svg`; const frame="/kit"; const match=src.includes(`/people/${name}/`); const encoded="/encoded%20image.png";');
	write("components/project/data/cards.ts", 'export const cover="/people/alice.png";');
	write("backend/read.js", 'path.join(process.cwd(), "public", "runtime", name);');
	write("public/brands/app/24.svg", "<svg/>"); write("public/people/alice.png"); write("public/people/unused.png");
	write("public/kit/style.css", 'body{background:url("../image with space.png")}');
	write("public/image with space.png"); write("public/encoded image.png"); write("public/runtime/data.json", "{}"); write("public/unused.mp4");
	const plan = audit(root);
	assert.deepEqual(plan.removed.map(item => item.path), ["public/people/unused.png", "public/unused.mp4"]);
	assert.equal(plan.summary.beforeBytes, plan.summary.afterBytes + plan.summary.removedBytes);
	applyAudit(plan);
	assert.equal(fs.existsSync(path.join(root, "public/unused.mp4")), false);
	assert.equal(fs.existsSync(path.join(root, "public/image with space.png")), true);
	assert.equal(audit(root).summary.removedCount, 0);
});

test("asset audit keeps all files for an unbounded runtime root", async t => {
	const { audit } = await import("./audit-public-assets.mjs");
	const { root, write } = fixture(t, 'const image=`/${name}.png`;');
	write("public/a.png"); write("public/b.png");
	const plan = audit(root);
	assert.equal(plan.summary.removedCount, 0);
	assert.equal(plan.warnings.length, 1);
});

test("asset deletion refuses source-tree use, late edits and new runtime source files", async t => {
	const { audit, applyAudit } = await import("./audit-public-assets.mjs");
	const { root, write } = fixture(t, 'const image="/used.png";');
	write("public/used.png"); write("public/unused.png");
	const plan = audit(root);
	fs.unlinkSync(path.join(root, ".vpk-source.json"));
	assert.throws(() => applyAudit(plan), /extracted target/u);
	write(".vpk-source.json", '{"version":1}');
	write("app/new.ts", 'export const image="/unused.png";');
	assert.throws(() => applyAudit(plan), /inventory changed/u);
	fs.unlinkSync(path.join(root, "app/new.ts"));
	write("app/page.tsx", 'const image="/unused.png";');
	assert.throws(() => applyAudit(plan), /Source changed/u);
	assert.equal(fs.existsSync(path.join(root, "public/unused.png")), true);
});

test("asset deletion rejects replaced public-directory symlinks", async t => {
	const { audit, applyAudit } = await import("./audit-public-assets.mjs");
	const { root, write } = fixture(t, "export default null;");
	write("public/dir/unused.png");
	const plan = audit(root);
	fs.renameSync(path.join(root, "public/dir"), path.join(root, "saved"));
	fs.symlinkSync(path.join(root, "saved"), path.join(root, "public/dir"));
	assert.throws(() => applyAudit(plan), /inventory changed|symbolic/u);
	assert.equal(fs.existsSync(path.join(root, "saved/unused.png")), true);
});
