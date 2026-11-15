const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const SOURCE = `
import { useRef } from "react";
import { useNearViewport } from "@/components/website/component-doc/components/use-near-viewport";

const observers = [];
globalThis.IntersectionObserver = class {
	constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
	observe() {}
	disconnect() { this.disconnected = true; }
};
globalThis.__enterViewport = (isIntersecting) => {
	for (const observer of observers) if (!observer.disconnected) observer.callback([{ isIntersecting }]);
};

export default function Probe({ enabled }) {
	const ref = useRef(null);
	const isNear = useNearViewport(ref, enabled);
	return <div ref={ref}>{isNear ? "mounted" : "deferred"}</div>;
}
`;

test("useNearViewport is true from the start when deferral is off", async () => {
	const view = await renderComponent({ source: SOURCE, props: { enabled: false } });
	assert.equal(view.container.textContent, "mounted");
});

test("useNearViewport defers until the element nears the viewport, then stays mounted", async () => {
	const view = await renderComponent({ source: SOURCE, props: { enabled: true } });
	assert.equal(view.container.textContent, "deferred");
	await view.rerender({ enabled: true });
	globalThis.__enterViewport(false);
	await view.rerender({ enabled: true });
	assert.equal(view.container.textContent, "deferred");
	globalThis.__enterViewport(true);
	await view.rerender({ enabled: true });
	assert.equal(view.container.textContent, "mounted");
	globalThis.__enterViewport(false);
	await view.rerender({ enabled: true });
	assert.equal(view.container.textContent, "mounted");
});
