const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const React = require("react");
const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const mocks = {
	"@/components/website/demos/utils/hooks/use-browser-preview-session": `
		import { useRef } from "react";
		export function useBrowserPreviewSession(workspaceId) {
			return {
				liveCanvasRef: useRef(null), status: "live", error: null, overlayState: null,
				sourceMetadata: { width: 320, height: 240 }, canSendControl: workspaceId !== "unavailable",
				sendControlMessage(message) {
					window.dispatchEvent(new CustomEvent("test-preview-control", { detail: message }));
					return workspaceId === "accepted";
				},
			};
		}
	`,
	"@/components/projects/shared/components/browser-preview-overlay": `export function BrowserPreviewOverlay() { return null; }`,
};

async function renderPreview(workspaceId = "accepted") {
	const preview = [];
	const workspace = [];
	const observePreview = (event) => preview.push(event.detail);
	window.addEventListener("test-preview-control", observePreview);
	const view = await renderComponent({
		entry: "components/website/demos/utils/components/browser-preview-panel.tsx",
		exportName: "BrowserPreviewPanel",
		mocks,
		props: {
			onClose: () => { workspace.push({ action: "close-preview" }); },
			workspace: {
				workspaceId,
				workspaceState: { title: "Browser preview", url: "about:blank", viewportWidth: 320, viewportHeight: 240, tabs: [] },
				workspaceError: null, isWorkspaceInitializing: false, isWorkspaceMutating: false,
				runWorkspaceAction: async (action, body) => { workspace.push({ action, body }); return null; },
				refreshWorkspace: async () => null, resetWorkspace: async () => null,
				fetchWorkspaceSnapshot: async () => null,
				createWorkspaceTab: async () => null, activateWorkspaceTab: async () => null, closeWorkspaceTab: async () => null,
			},
		},
	});
	return {
		view, preview, workspace,
		viewport: view.getByRole("application", { name: "Browser preview" }),
		async dispose() {
			await view.unmount();
			window.removeEventListener("test-preview-control", observePreview);
		},
	};
}

async function sendWheel(viewport, deltaX, deltaY) {
	await React.act(async () => {
		const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaX, deltaY });
		// happy-dom's WheelEvent does not currently populate MouseEvent coordinates.
		Object.defineProperties(event, { clientX: { value: 100 }, clientY: { value: 60 } });
		viewport.dispatchEvent(event);
	});
}

async function flushWheel() {
	await React.act(async () => { await new Promise((resolve) => setTimeout(resolve, 60)); });
}

test("rendered preview dispatches pointer and key controls through the real delivery module", async () => {
	const preview = await renderPreview();
	try {
		await React.act(async () => {
			preview.viewport.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 100, clientY: 60, button: 0 }));
		});
		await preview.view.press(preview.viewport, "a", { code: "KeyA" });
		assert.deepEqual(preview.preview, [
			{ type: "preview-click", x: 100, y: 60 },
			{ type: "preview-key", eventType: "keyDown", key: "a", code: "KeyA", text: "a" },
			{ type: "preview-key", eventType: "keyUp", key: "a", code: "KeyA" },
		]);
		assert.deepEqual(preview.workspace, []);
		assert.equal(preview.view.isFocused(preview.viewport), true);
	} finally {
		await preview.dispose();
	}
});

test("rendered wheel events still coalesce at the panel owner for both transports", async () => {
	for (const workspaceId of ["accepted", "unavailable", "rejected"]) {
		const preview = await renderPreview(workspaceId);
		try {
			await sendWheel(preview.viewport, 2.4, 20.4);
			await sendWheel(preview.viewport, -1.4, 30.4);
			assert.deepEqual(preview.workspace, []);
			assert.deepEqual(preview.preview, []);
			await flushWheel();
			const message = { type: "preview-wheel", x: 100, y: 60, deltaX: 1, deltaY: 50 };
			assert.deepEqual(preview.preview, workspaceId === "unavailable" ? [] : [message]);
			assert.deepEqual(preview.workspace, workspaceId === "accepted" ? [] : [{ action: "wheel", body: { deltaX: 1, deltaY: 50 } }]);
		} finally {
			await preview.dispose();
		}
	}
});

test("switching to Snapshot cancels pending wheel delivery before hidden preview unmounts", async () => {
	const preview = await renderPreview();
	try {
		await sendWheel(preview.viewport, 0, 40);
		await preview.view.click(preview.view.getByRole("button", { name: "Snapshot" }));
		await flushWheel();
		assert.equal(preview.view.queryByRole("application") === null, true);
		assert.deepEqual(preview.preview, []);
		assert.deepEqual(preview.workspace, []);
	} finally {
		await preview.dispose();
	}
});
