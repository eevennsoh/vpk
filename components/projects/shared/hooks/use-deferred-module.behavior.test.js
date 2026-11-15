// useDeferredModule loads a surface's module only once the surface is needed, returns it only after
// it arrives (so the host can keep the surface closed meanwhile), reuses it synchronously on later
// mounts, and keeps the surface closed if the chunk fails to load.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const PROBE = `
import { useDeferredModule } from "@/components/projects/shared/hooks/use-deferred-module";

const state = { calls: 0, release: null, fail: false };
globalThis.__deferredProbe = state;
const load = () => {
	state.calls += 1;
	if (state.fail) return Promise.reject(new Error("chunk load failed"));
	return new Promise((resolve) => { state.release = () => resolve({ default: () => <p data-loaded="">loaded</p> }); });
};

function Host({ needed }) {
	const Surface = useDeferredModule(load, needed)?.default ?? null;
	return <span data-probe>{Surface ? <Surface /> : "closed"}</span>;
}

export default function Probe({ needed, second }) {
	return <>{<Host needed={needed} />}{second ? <Host needed={false} /> : null}</>;
}
`;

function probes(view) {
	return [...view.container.querySelectorAll("[data-probe]")].map((element) => element.textContent);
}

test("a deferred surface does not load until needed, and stays closed until its module arrives", async () => {
	const view = await renderComponent({ source: PROBE, props: { needed: false } });
	const state = globalThis.__deferredProbe;
	assert.equal(state.calls, 0);
	assert.deepEqual(probes(view), ["closed"]);

	await view.rerender({ needed: true });
	assert.equal(state.calls, 1);
	assert.deepEqual(probes(view), ["closed"]);

	state.release();
	await view.rerender({ needed: true });
	await view.rerender({ needed: true });
	assert.deepEqual(probes(view), ["loaded"]);

	// A host that mounts after the load renders the module on its first render, without loading again.
	await view.rerender({ needed: true, second: true });
	assert.deepEqual(probes(view), ["loaded", "loaded"]);
	await view.unmount();
});

test("a chunk that fails to load keeps the surface closed and retries when it is needed again", async () => {
	const view = await renderComponent({ source: PROBE, props: { needed: false } });
	const state = globalThis.__deferredProbe;
	state.fail = true;
	await view.rerender({ needed: true });
	await view.rerender({ needed: true });
	assert.deepEqual(probes(view), ["closed"]);
	assert.equal(state.calls, 1);

	state.fail = false;
	await view.rerender({ needed: false });
	await view.rerender({ needed: true });
	assert.equal(state.calls, 2);
	state.release();
	await view.rerender({ needed: true });
	await view.rerender({ needed: true });
	assert.deepEqual(probes(view), ["loaded"]);
	await view.unmount();
});
