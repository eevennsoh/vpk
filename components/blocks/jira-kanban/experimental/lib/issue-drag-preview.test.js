const assert = require("node:assert/strict");
const test = require("node:test");
const esbuild = require("esbuild");
require("../../../../../scripts/lib/render-component.js"); // registers the happy-dom globals
const { loadCjsModuleFromText } = require("../../../../../scripts/lib/esbuild-cjs-loader.js");

const preview = loadCjsModuleFromText(esbuild.buildSync({ entryPoints: ["components/blocks/jira-kanban/experimental/lib/issue-drag-preview.ts"], bundle: true, format: "cjs", platform: "node", tsconfig: "tsconfig.json", write: false, logLevel: "silent" }).outputFiles[0].text);

function sourceCard() {
	document.body.innerHTML = `<div data-issue-key="K1"><div data-slot="jira-issue-card" style="width: 334px; height: 199px">
		<div data-slot="jira-issue-surface" style="position: absolute; box-shadow: rgba(30, 31, 33, 0.31) 0px 0px 1px 0px"></div>
		<span data-slot="avatar" data-avatar-enter="" style="opacity: 1; transform: none"></span>
		<span data-slot="avatar" data-testid="static-avatar" style="opacity: 1"></span>
	</div></div>`;
	return document.querySelector('[data-slot="jira-issue-card"]');
}

test("a settled cohort preview shows the committed lead's first frame in its landing slot", () => {
	const { node } = preview.createIssueCohortPreview(sourceCard(), new Set(["K1", "K2", "K3"]));
	const lead = node.querySelector("[data-issue-cohort-front]");
	const deck = [...node.children].filter((child) => child !== lead);
	assert.equal(deck.length, 3, "two rear sheets and the count badge travel with the lead");
	assert.notEqual(lead.style.boxShadow, "", "the travelling face wears its overlay elevation");
	lead.style.overflow = "hidden";

	preview.settleIssueCohortPreview(node, { left: 1146.5, top: 280, depth: 4 });

	assert.equal(node.style.transform, "translate3d(1146.5px, 280px, 0)");
	assert.deepEqual(deck.map((child) => child.style.visibility), ["hidden", "hidden", "hidden"], "only the lead rests in the slot");
	assert.equal(lead.style.visibility, "");
	assert.equal(lead.style.boxShadow, "", "the lead drops the travelling elevation for its resting chrome");
	assert.equal(lead.style.overflow, "", "a resting card paints its surface ring outside its bounds");
	const rings = lead.querySelector('[data-slot="jira-issue-surface"]').style.boxShadow.match(/rgba\(30, 31, 33, 0\.31\)/gu) ?? [];
	assert.equal(rings.length, 4, "the four cards stacked under the lead composite their rings on its edge");
	const [entering, fixed] = lead.querySelectorAll('[data-slot="avatar"]');
	assert.deepEqual([entering.style.opacity, entering.style.transform], ["0", "scale(0.8)"], "a remounted avatar has not played avatar.enter yet");
	assert.equal(fixed.style.opacity, "1", "avatars without a mount entrance stay as painted");
	node.remove();
});
