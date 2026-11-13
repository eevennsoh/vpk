// The loader imports one category's table at a time; registry/index.ts keeps the combined tables
// that catalog tooling reads. The two must map every category to the same exports, or a demo
// would resolve in the catalog and render nothing on its route (or the reverse).
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const read = (file) => readFileSync(path.join(process.cwd(), file), "utf8");

function indexMapping() {
	const source = read("components/website/registry/index.ts");
	const fileOf = new Map();
	for (const match of source.matchAll(/import \{([^}]+)\} from "\.\/([^"]+)";/gu)) {
		for (const name of match[1].split(",").map((entry) => entry.trim()).filter(Boolean)) {
			fileOf.set(name, match[2]);
		}
	}
	const table = (constName) => {
		const body = new RegExp(`const ${constName}[^=]*= \\{([^}]+)\\}`, "u").exec(source)[1];
		return Object.fromEntries([...body.matchAll(/["']?([\w-]+)["']?:\s*(\w+)/gu)].map(([, category, name]) => [category, `${fileOf.get(name)}#${name}`]));
	};
	return { demos: table("CATEGORY_REGISTRIES"), variants: table("VARIANT_REGISTRIES") };
}

function loaderMapping() {
	const source = read("components/website/demo-registry-loader.ts");
	const demos = {};
	const variants = {};
	for (const match of source.matchAll(/["']?([\w-]+)["']?: \(\) => import\("@\/components\/website\/registry\/([^"]+)"\)\.then\(\(module\) => \(\{ demos: module\.(\w+)(?:, variants: module\.(\w+))? \}\)\)/gu)) {
		const [, category, file, demoName, variantName] = match;
		demos[category] = `${file}#${demoName}`;
		if (variantName) variants[category] = `${file}#${variantName}`;
	}
	return { demos, variants };
}

test("the per-category loader maps every category to the same tables as registry/index.ts", () => {
	const expected = indexMapping();
	const actual = loaderMapping();
	assert.equal(Object.keys(expected.demos).length, 8);
	assert.deepEqual(sortKeys(actual.demos), sortKeys(expected.demos));
	assert.deepEqual(sortKeys(actual.variants), sortKeys(expected.variants));
});

test("the loader never imports the combined registry", () => {
	const source = read("components/website/demo-registry-loader.ts");
	assert.doesNotMatch(source, /import\(["']@\/components\/website\/registry["']\)/u);
	assert.doesNotMatch(source, /import\(["']@\/components\/website\/registry\/index["']\)/u);
});

function sortKeys(object) {
	return Object.fromEntries(Object.entries(object).sort(([left], [right]) => left.localeCompare(right)));
}
