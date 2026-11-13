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

for (const [size, boxClass, glyph] of [[undefined, "size-4", "medium"], ["small", "size-3", "small"]]) {
	test(`a ${glyph} registry icon reserves its box until its module loads`, async () => {
		const view = await renderComponent({ source: PROBE, props: { size } });

		const pending = probeHtml(view);
		assert.ok(pending.includes(`aria-hidden="true"`), pending);
		assert.ok(pending.includes(boxClass), pending);
		assert.ok(!pending.includes("<svg"), pending);

		globalThis.__releaseLazyIcon();
		await view.rerender({ size });
		await view.rerender({ size });

		const loaded = probeHtml(view);
		assert.ok(loaded.includes(`data-glyph="${glyph}"`), loaded);
		assert.ok(!loaded.includes(boxClass), loaded);
		await view.unmount();
	});
}
