const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { renderComponent } = require("../../scripts/lib/render-component.js");

const PANEL_SOURCE = fs.readFileSync(path.join(__dirname, "panel.tsx"), "utf8");
const PANEL_DEMO_SOURCE = fs.readFileSync(
	path.join(__dirname, "../website/demos/ui/panel-demo.tsx"),
	"utf8",
);

test("Panel mirrors @atlassian/panel-system presentational exports", () => {
	for (const exportName of [
		"PanelContainer",
		"PanelHeader",
		"PanelTitle",
		"PanelSubheader",
		"PanelContent",
		"PanelBody",
		"PanelFooter",
		"PanelDisclaimer",
		"PanelAction",
		"PanelActionGroup",
		"PanelActionClose",
	]) {
		assert.match(PANEL_SOURCE, new RegExp(`\\b${exportName}\\b`, "u"));
	}

	assert.match(PANEL_SOURCE, /const Panel = PanelContainer/u);
	assert.doesNotMatch(PANEL_SOURCE, /PanelStateless|isExpanded|isDefaultExpanded/u);
});

test("Panel layout uses fixed header and footer with a scrollable content region", () => {
	assert.match(PANEL_SOURCE, /data-slot="panel-header"[\s\S]*h-14/u);
	assert.match(PANEL_SOURCE, /data-slot="panel-content"[\s\S]*overflow-y-auto/u);
	assert.match(PANEL_SOURCE, /data-slot="panel-body"[\s\S]*px-6/u);
	assert.match(PANEL_SOURCE, /data-slot="panel-footer"[\s\S]*border-t/u);
	assert.match(PANEL_SOURCE, /data-slot="panel-disclaimer"[\s\S]*bg-surface-sunken/u);
});

test("Panel action variants use panel-system labels and icons", async () => {
	assert.match(PANEL_SOURCE, /@atlaskit\/icon\/core\/arrow-left/u);
	assert.match(PANEL_SOURCE, /@atlaskit\/icon\/core\/cross/u);
	assert.match(PANEL_SOURCE, /@atlaskit\/icon\/core\/grow-diagonal/u);
	assert.match(PANEL_SOURCE, /@atlaskit\/icon\/core\/link-external/u);
	assert.match(PANEL_SOURCE, /label \?\? "Close panel"/u);
	assert.match(PANEL_SOURCE, /onBeforeClose/u);
	const view = await renderComponent({
		source: `import { PanelAction } from "@/components/ui/panel";
			import ArrowLeftIcon from "@atlaskit/icon/core/arrow-left";
			export default function Probe() {
				return <PanelAction href="/components" icon={ArrowLeftIcon} label="Back to catalog" />;
			}`,
	});
	assert.equal(view.getByRole("link", { name: "Back to catalog" }).getAttribute("href"), "/components");
	assert.doesNotMatch(PANEL_SOURCE, /href && !iconOnly/u);
});

test("Panel demos cover panel-system composition, not accordion state", () => {
	assert.match(PANEL_DEMO_SOURCE, /export function PanelDemoDefault/u);
	assert.match(PANEL_DEMO_SOURCE, /export function PanelDemoWithSubheader/u);
	assert.match(PANEL_DEMO_SOURCE, /export function PanelDemoWithFooter/u);
	assert.match(PANEL_DEMO_SOURCE, /<PanelHeader>[\s\S]*<PanelTitle/u);
	assert.match(PANEL_DEMO_SOURCE, /<PanelContent>[\s\S]*<PanelSubheader/u);
	assert.match(PANEL_DEMO_SOURCE, /<PanelFooter[\s\S]*<PanelDisclaimer>/u);
	assert.doesNotMatch(PANEL_DEMO_SOURCE, /PanelStateless|isExpanded|isDefaultExpanded/u);
});
