const assert = require("node:assert/strict");
const test = require("node:test");
const { act } = require("react");
const { renderComponent } = require("../../../scripts/lib/render-component.js");

const baseProps = {
	onboardingOpen: false,
	onboarding: null,
	onOpenChange() {},
	insights: null,
	insightsStage: "hidden",
	onInsightsDismiss() {},
	onInsightsPrimaryAction() {},
	onInsightsSecondaryAction() {},
	ariaLabel: "Open Rovo chat",
	onButtonClick() {},
	persistentBar: null,
	shouldReduceMotion: false,
};

async function renderLauncher(props = {}) {
	return renderComponent({
		entry: "components/blocks/rovo-button/surface.tsx",
		exportName: "FloatingRovoButtonSurface",
		mocks: { "@/components/ui-custom/animated-rovo": `import React from "react"; export const AnimatedRovo = { Root: () => <span data-animated-rovo /> };` },
		props: { ...baseProps, ...props },
	});
}

async function nextFrame() {
	await act(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)); });
}

test("the insights pill and launcher scale from the center", async () => {
	const view = await renderLauncher();
	const button = view.container.querySelector('[aria-label="Open Rovo chat"]');
	assert.equal(button.parentElement.style.transformOrigin, "center");
	await view.rerender({ ...baseProps, insightsStage: "pill", insights: { id: "digest", count: 7, rows: [] } });
	const pill = view.container.querySelector('[aria-label="Open 7 new insights"]');
	assert.equal(pill.parentElement.style.transformOrigin, "center");
	await view.unmount();
});

test("the insights logo animates on its first mouse hover only", async () => {
	const view = await renderLauncher({ insightsStage: "pill", insights: { id: "digest", count: 7, rows: [] } });
	const pill = view.container.querySelector('[aria-label="Open 7 new insights"]');
	await act(async () => { pill.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" })); });
	assert.equal(view.container.querySelector("[data-animated-rovo]") !== null, true);
	await act(async () => { await new Promise((resolve) => setTimeout(resolve, 2600)); });
	assert.equal(view.container.querySelector("[data-animated-rovo]") === null, true);
	await act(async () => {
		pill.dispatchEvent(new PointerEvent("pointerout", { bubbles: true, pointerType: "mouse" }));
		pill.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" }));
	});
	assert.equal(view.container.querySelector("[data-animated-rovo]") === null, true);
	await view.unmount();
});

test("the insights logo remains static when reduced motion is enabled", async () => {
	const view = await renderLauncher({ insightsStage: "pill", insights: { id: "digest", count: 7, rows: [] }, shouldReduceMotion: true });
	const pill = view.container.querySelector('[aria-label="Open 7 new insights"]');
	await act(async () => { pill.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" })); });
	assert.equal(view.container.querySelector("[data-animated-rovo]") === null, true);
	await view.unmount();
});

test("each agent arrival starts or restarts the existing logo cycle", async () => {
	const view = await renderLauncher();
	assert.equal(view.container.querySelector("[data-animated-rovo]") === null, true);
	const launcher = view.container.querySelector('[aria-label="Open Rovo chat"]');
	await act(async () => { launcher.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" })); });
	const hoverCycle = view.container.querySelector("[data-animated-rovo]");
	assert.equal(hoverCycle !== null, true);
	await view.rerender({ ...baseProps, logoAnimationTrigger: "first" });
	await nextFrame();
	const first = view.container.querySelector("[data-animated-rovo]");
	assert.equal(first !== null, true);
	assert.equal(first !== hoverCycle, true);
	await view.rerender({ ...baseProps, logoAnimationTrigger: "first" });
	await nextFrame();
	assert.equal(view.container.querySelector("[data-animated-rovo]") === first, true);
	await view.rerender({ ...baseProps, logoAnimationTrigger: "second" });
	await nextFrame();
	assert.equal(view.container.querySelector("[data-animated-rovo]") !== first, true);
	await act(async () => { await new Promise((resolve) => setTimeout(resolve, 2600)); });
	assert.equal(view.container.querySelector("[data-animated-rovo]") === null, true);
	await view.unmount();
});

test("agent arrivals leave the logo static with reduced motion", async () => {
	const view = await renderLauncher({ shouldReduceMotion: true, logoAnimationTrigger: "first" });
	await nextFrame();
	assert.equal(view.container.querySelector("[data-animated-rovo]") === null, true);
	assert.equal(view.container.querySelector('[aria-label="Open Rovo chat"] svg') !== null, true);
	await view.unmount();
});
