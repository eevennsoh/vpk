import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const refs = join(dirname(fileURLToPath(import.meta.url)), "..", "references");
const shading = JSON.parse(readFileSync(join(refs, "paper-shading.json"), "utf8"));
const fidelity = readFileSync(join(refs, "figure-fidelity.md"), "utf8");

const cell = value => (Array.isArray(value) ? value.map(n => `${n}%`).join(", ") : value);

function renderShadingTable(rows) {
	return [
		"| Part | Light | Dark | Token |",
		"| --- | --- | --- | --- |",
		...rows.map(row => `| ${row.part} | ${cell(row.light)} | ${cell(row.dark)} | ${row.token} |`),
	].join("\n");
}

test("figure-fidelity shading table equals paper-shading.json", () => {
	const block = fidelity.match(/<!-- paper-shading:begin -->\n([\s\S]*?)\n<!-- paper-shading:end -->/);
	assert.ok(block, "figure-fidelity.md has no paper-shading block");
	assert.equal(block[1], renderShadingTable(shading.rows));
});

test("paper shading keeps sides darker than tops and no black surface", () => {
	const row = part => shading.rows.find(r => r.part.startsWith(part));
	const [top, sides, hairlines] = [row("Top face"), row("Side faces"), row("Hairlines")];
	assert.ok(Math.min(...sides.light) > Math.max(...top.light), "light sides must carry more ink than tops");
	assert.ok(Math.max(...sides.dark) < Math.min(...top.dark), "dark sides must carry less ink than tops");
	for (const r of [top, sides, hairlines]) {
		for (const n of [...r.light, ...r.dark]) assert.ok(n < 50, `${r.part} reaches ${n}% ink`);
	}
});
