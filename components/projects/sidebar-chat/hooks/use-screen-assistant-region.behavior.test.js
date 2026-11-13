const assert = require("node:assert/strict");
const test = require("node:test");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

const PROBE = `import { useScreenAssistantRegion } from "@/components/projects/sidebar-chat/hooks/use-screen-assistant-region";
	export default function RegionProbe({ enabled = true }) {
		const region = useScreenAssistantRegion(enabled);
		return <div>
			<p>{region.painting ? "painting" : "idle"}|{region.region ? region.region.label : "none"}</p>
			<button type="button" onClick={() => region.setPainting(true)}>Start painting</button>
			<button type="button" onClick={() => region.setPainting(false)}>Stop painting</button>
			<button type="button" onClick={() => region.setRegion({ id: "r1", label: "Header", rect: { height: 10, width: 10, x: 0, y: 0 } })}>Paint header</button>
			<button type="button" onClick={() => region.setRegion(null)}>Clear region</button>
		</div>;
	}`;

async function renderRegion(props) {
	const view = await renderComponent({ props, source: PROBE });
	return {
		press: (name) => view.click(view.getByRole("button", { name })),
		read: () => view.container.querySelector("p").textContent,
		view,
	};
}

test("the screen assistant paints, keeps and clears a region while enabled", async () => {
	const region = await renderRegion({ enabled: true });
	assert.equal(region.read(), "idle|none");
	await region.press("Start painting");
	assert.equal(region.read(), "painting|none");
	await region.press("Paint header");
	await region.press("Stop painting");
	assert.equal(region.read(), "idle|Header", "the region outlives the paint gesture");
	await region.press("Clear region");
	assert.equal(region.read(), "idle|none");
});

test("disabling the screen assistant drops the region and the paint gesture together, for good", async () => {
	const region = await renderRegion({ enabled: true });
	await region.press("Start painting");
	await region.press("Paint header");
	await region.view.rerender({ enabled: false });
	assert.equal(region.read(), "idle|none", "nothing stale renders once disabled");
	await region.view.rerender({ enabled: true });
	assert.equal(region.read(), "idle|none", "re-enabling does not bring the old region back");
});
