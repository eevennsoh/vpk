// useDeferredModule loads a surface's module only once the surface is needed, returns it only after
// it arrives (so the host can keep the surface closed meanwhile), reuses it synchronously on later
// mounts, and reports a failed chunk so the host can reset the surface that requested it.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const PROBE = `
import { useEffect, useState } from "react";
import { preloadDeferredModule, useDeferredModule } from "@/components/projects/shared/hooks/use-deferred-module";

const state = { calls: 0, release: null, fail: false, errors: 0 };
state.preload = () => preloadDeferredModule(load);
globalThis.__deferredProbe = state;
const load = () => {
	state.calls += 1;
	if (state.fail) return Promise.reject(new Error("chunk load failed"));
	return new Promise((resolve) => { state.release = () => resolve({ default: () => <p data-loaded="">loaded</p> }); });
};

function Host({ needed }) {
	const Surface = useDeferredModule(load, needed, { onError: () => { state.errors += 1; } })?.default ?? null;
	return <span data-probe>{Surface ? <Surface /> : "closed"}</span>;
}

// Mirrors AppLayout: the open request is host state, and a failed chunk resets it so the launcher returns.
function ResettingHost({ request }) {
	const [open, setOpen] = useState(false);
	useEffect(() => { if (request) setOpen(true); }, [request]);
	const Surface = useDeferredModule(load, open, { onError: () => setOpen(false) })?.default ?? null;
	return <span data-probe>{open ? (Surface ? <Surface /> : "loading") : "launcher"}</span>;
}

export default function Probe({ needed, second, resetting, request }) {
	if (resetting) return <ResettingHost request={request} />;
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
	assert.equal(state.errors, 1);

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

test("a failed chunk lets the host reset its open request, so the launcher comes back", async () => {
	const view = await renderComponent({ source: PROBE, props: { resetting: true, request: false } });
	const state = globalThis.__deferredProbe;
	state.fail = true;
	await view.rerender({ resetting: true, request: true });
	await view.rerender({ resetting: true, request: true });
	await view.rerender({ resetting: true, request: true });
	assert.equal(state.calls, 1);
	assert.deepEqual(probes(view), ["launcher"]);
	await view.unmount();
});

test("preloading an already loaded module reuses the cache instead of importing again", async () => {
	const view = await renderComponent({ source: PROBE, props: { needed: false } });
	const state = globalThis.__deferredProbe;
	const first = state.preload();
	assert.equal(state.calls, 1);
	state.release();
	await first;
	const second = state.preload();
	assert.equal(state.calls, 1);
	await second;
	await view.unmount();
});
