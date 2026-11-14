// Golden corpus for the generative widget card chain.
//
// Each fixture in `generative-widget.golden-fixtures.json` runs through the same
// chain `GenerativeWidgetCard` runs (parse -> profile-photo enrichment -> metadata
// -> card description -> body-only spec), and the result must equal the readable
// JSON recorded in `generative-widget.golden-expected.json`. The fixtures cover the
// existing unit-test inputs, backend producer payloads and genui specs, the
// json-render catalog demos, and synthetic cases for every body kind, content-type
// matcher row, action and URL rule.
//
// Enrichment runs with no tool-call observations, so it passes the widget through;
// profile photos have their own suite.
//
// Re-record only when a behaviour change is intended (refused under CI):
//   UPDATE_GENERATIVE_WIDGET_GOLDEN=1 node --import ./scripts/lib/register-alias-hook.mjs \
//     --test components/projects/shared/lib/generative-widget.golden.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");

const {
	createBodyOnlySpec,
	formatGenerativeWidgetCardDescription,
	parseGenerativeWidget,
	resolveGenerativeWidgetMetadata,
} = require("./generative-widget.ts");
const {
	enrichGenerativeWidgetProfilePhotos,
} = require("./generative-widget-profile-photos.ts");

const FIXTURES_PATH = path.join(__dirname, "generative-widget.golden-fixtures.json");
const EXPECTED_PATH = path.join(__dirname, "generative-widget.golden-expected.json");
const UNDEFINED_MARKER = "__undefined__";

function readFixtures() {
	return JSON.parse(readFileSync(FIXTURES_PATH, "utf8"));
}

// Keeps `undefined`-valued keys visible, since the card treats them differently
// from absent keys in a few spreads.
function toComparable(value) {
	return JSON.parse(
		JSON.stringify(value, (_key, entry) => (entry === undefined ? UNDEFINED_MARKER : entry)) ?? "null"
	);
}

function describeBodyOnly(widget) {
	if (!widget || widget.body?.kind !== "json-render") {
		return null;
	}

	const first = createBodyOnlySpec(widget);
	return {
		spec: first,
		cachedIdentity: createBodyOnlySpec(widget) === first,
		returnsOriginalSpec: first === widget.body.spec,
	};
}

function describeMetadata(widget) {
	const metadata = resolveGenerativeWidgetMetadata(widget);
	return {
		metadata,
		cardDescription: formatGenerativeWidgetCardDescription(metadata.description),
	};
}

function runFixture(fixture) {
	if (fixture.fn === "parse") {
		const parsed = parseGenerativeWidget(fixture.widgetType, fixture.widgetData);
		if (!parsed) {
			return { parsed: null };
		}

		const enriched = enrichGenerativeWidgetProfilePhotos(parsed, []);
		return {
			parsed,
			...describeMetadata(enriched),
			bodyOnly: describeBodyOnly(enriched),
		};
	}

	if (fixture.fn === "metadata") {
		return {
			...describeMetadata(fixture.widget),
			bodyOnly: describeBodyOnly(fixture.widget),
		};
	}

	if (fixture.fn === "bodyOnly") {
		const first = createBodyOnlySpec(fixture.input);
		return {
			spec: first,
			cachedIdentity: createBodyOnlySpec(fixture.input) === first,
		};
	}

	throw new Error(`Unknown golden fixture fn: ${fixture.fn}`);
}

function computeCorpus() {
	return Object.fromEntries(
		readFixtures().map((fixture) => [fixture.name, toComparable(runFixture(fixture))])
	);
}

const isUpdating = process.env.UPDATE_GENERATIVE_WIDGET_GOLDEN === "1";

if (isUpdating) {
	if (process.env.CI) {
		throw new Error("UPDATE_GENERATIVE_WIDGET_GOLDEN is refused under CI; re-record locally.");
	}

	writeFileSync(EXPECTED_PATH, `${JSON.stringify(computeCorpus(), null, "\t")}\n`);
}

test("golden fixture names are unique", () => {
	const names = readFixtures().map((fixture) => fixture.name);
	assert.equal(new Set(names).size, names.length);
});

test("golden expected output covers exactly the fixture corpus", () => {
	const expected = JSON.parse(readFileSync(EXPECTED_PATH, "utf8"));
	assert.deepEqual(
		Object.keys(expected).sort(),
		readFixtures().map((fixture) => fixture.name).sort()
	);
});

test("every golden fixture produces its recorded card chain output", { skip: isUpdating && "re-recorded this run; rerun without UPDATE_GENERATIVE_WIDGET_GOLDEN" }, async (t) => {
	const expected = JSON.parse(readFileSync(EXPECTED_PATH, "utf8"));
	for (const fixture of readFixtures()) {
		await t.test(fixture.name, () => {
			assert.deepEqual(toComparable(runFixture(fixture)), expected[fixture.name]);
		});
	}
});
