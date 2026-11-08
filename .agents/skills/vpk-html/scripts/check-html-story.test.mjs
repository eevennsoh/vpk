// Story-explainer checks in check-html (references/quality-gates.md § Story-explainer checks): one red and one green case each.
import assert from "node:assert/strict";
import test from "node:test";
import { validateHtmlString } from "./check-html.mjs";
import { collectStoryExplainerIssues } from "./check-html-story.mjs";

const page = (body, layout = "story") => `<!doctype html><html><head><style>:root{}</style></head><body data-vpk-layout="${layout}"><main>${body}</main></body></html>`;
const issues = body => collectStoryExplainerIssues(page(body)).join("\n");

test("rail-title: a control with title= fails, aria-label plus data-tip passes", () => {
	assert.match(issues('<button type="button" title="Slides">S</button>'), /^rail-title: 1 control set a tooltip with title=/);
	assert.equal(issues('<button type="button" aria-label="Slides" data-tip="Slides">S</button>'), "");
	assert.equal(issues('<svg aria-label="x"><title>Figure</title></svg>'), "", "an SVG <title> element is not a title attribute");
});

test("duplicate-id: one id on two elements fails, scoped ids pass", () => {
	assert.match(issues('<div id="card"></div><svg aria-hidden="true"><g id="card"></g></svg>'), /^duplicate-id: card \(2×\)/);
	assert.equal(issues('<div id="step-1-card"></div><svg aria-hidden="true"><g id="thumb-1-card"></g></svg>'), "");
	assert.equal(issues('<template><div id="card"></div></template><div id="card"></div>'), "", "inert template copies do not count");
});

test("straight-apostrophe: a straight quote in prose or a data-tip fails, typographic quotes and code pass", () => {
	assert.match(issues("<p>The wall doesn't stop.</p>"), /^straight-apostrophe: .*doesn't stop/);
	assert.match(issues('<button aria-label="Next" data-tip="Next step\'s figure">N</button>'), /straight-apostrophe: .*data-tip/);
	assert.match(issues("<p>Team &#39;26</p>"), /straight-apostrophe/, "an entity renders the same straight quote");
	assert.equal(issues("<p>The wall doesn’t stop, “one card” at a time.</p>"), "");
	assert.equal(issues("<pre><code>const a = 'x';</code></pre><p>Code: <code>\"y\"</code></p>"), "", "code keeps its quotes");
});

test("inline-script-syntax: a classic script that does not parse fails, module and JSON islands are skipped", () => {
	assert.match(issues("<script>const label = 'Team '26';</script>"), /^inline-script-syntax: inline script 1 does not parse \(SyntaxError/);
	assert.equal(issues("<script>const label = \"Team ’26\";</script>"), "");
	assert.equal(issues('<script type="module">import x from "./x.js"; export { x };</script><script type="application/json">{"a":1}</script>'), "");
});

test("the story checks run only on story pages and reach validateHtmlString", () => {
	const body = '<button type="button" title="Slides">S</button><p>It doesn\'t.</p>';
	assert.deepEqual(collectStoryExplainerIssues(page(body, "report")), [], "other layouts are untouched");
	const failures = validateHtmlString(page(body)).failures.join("\n");
	assert.match(failures, /rail-title/);
	assert.match(failures, /straight-apostrophe/);
	assert.doesNotMatch(validateHtmlString(page(body, "report")).failures.join("\n"), /rail-title|straight-apostrophe/);
});
