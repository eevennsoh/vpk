// A registry icon downloads on first render. Until it arrives, a placeholder holds the
// glyph's box (16px, 12px at size="small") so the tile around it does not move.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const PROBE = `
import { createLazyIcon } from "@/components/projects/shared/components/lazy-icon";

let release;
const gate = new Promise((resolve) => { release = resolve; });
globalThis.__releaseLazyIcon = () => release({ default: (props) => <svg data-glyph={props.size ?? "medium"} /> });
const LazyIcon = createLazyIcon(() => gate);

export default function Probe({ size }) {
	return <span data-probe>{size === undefined ? <LazyIcon label="" /> : <LazyIcon label="" size={size} />}</span>;
}
`;

function probeHtml(view) {
	return view.container.querySelector("[data-probe]").innerHTML;
}

for (const [size, boxClass, glyph] of [[undefined, "height:16px;width:16px", "medium"], ["small", "height:12px;width:12px", "small"]]) {
	test(`a ${glyph} registry icon reserves its box until its module loads`, async () => {
		const view = await renderComponent({ source: PROBE, props: { size } });

		const pending = probeHtml(view).replaceAll(" ", "");
		assert.ok(pending.includes(`aria-hidden="true"`), pending);
		assert.ok(pending.includes(boxClass), pending);
		assert.ok(!pending.includes("<svg"), pending);

		globalThis.__releaseLazyIcon();
		await view.rerender({ size });
		await view.rerender({ size });

		const loaded = probeHtml(view).replaceAll(" ", "");
		assert.ok(loaded.includes(`data-glyph="${glyph}"`), loaded);
		assert.ok(!loaded.includes(boxClass), loaded);
		await view.unmount();
	});
}

test("an icon whose module fails to load keeps its empty box instead of breaking the surface", async () => {
	const view = await renderComponent({
		source: `
import { createLazyIcon } from "@/components/projects/shared/components/lazy-icon";
const LazyIcon = createLazyIcon(() => Promise.reject(new Error("chunk load failed")));
export default function Probe() { return <span data-probe><LazyIcon label="" /></span>; }
`,
	});
	await view.rerender({});
	await view.rerender({});
	const html = probeHtml(view).replaceAll(" ", "");
	assert.ok(html.includes("height:16px;width:16px"), html);
	assert.ok(!html.includes("<svg"), html);
	await view.unmount();
});
