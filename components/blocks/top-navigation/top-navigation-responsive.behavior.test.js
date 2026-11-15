const assert = require("node:assert/strict");
const { test } = require("node:test");
const { act } = require("react");
const { renderComponent } = require("../../../scripts/lib/render-component.js");

const ENTRY = "components/blocks/top-navigation/page.tsx";

// The shell's own sidebar and search state are under test; the context-backed
// hook and the presentational chrome are replaced by minimal stand-ins that
// expose that state as accessible names and pressed states.
const MOCKS = {
	"@/components/blocks/top-navigation/hooks/use-top-navigation": `
		import { useRef, useState } from "react";
		import { useWindowWidth } from "@/components/hooks/use-window-width";
		const noop = () => {};
		export function useTopNavigation() {
			const [searchValue, setSearchValue] = useState("");
			const searchContainerRef = useRef(null);
			const searchPanelRef = useRef(null);
			return {
				searchValue,
				setSearchValue,
				isAppSwitcherOpen: false,
				isSearchFocused: false,
				windowWidth: useWindowWidth(),
				isVisible: false,
				toggleSidebar: noop,
				toggleChat: noop,
				openChat: noop,
				isSidebarChatOpen: false,
				searchContainerRef,
				searchPanelRef,
				centerSectionStyle: {},
				handleNavigate: noop,
				handleSearchKeyDown: noop,
				handleSearchAllApps: noop,
				handleRecentItemClick: noop,
				handleRecentSearchClick: noop,
				handleCloseSearch: noop,
				handleFocusSearch: noop,
				handleToggleAppSwitcher: noop,
				handleCloseAppSwitcher: noop,
				handleHoverEnter: noop,
				handleHoverLeave: noop,
			};
		}
	`,
	"@/components/blocks/top-navigation/components/left-navigation": `
		export function LeftNavigation({ isVisible, onToggleSidebar }) {
			return <button type="button" aria-pressed={isVisible} onClick={onToggleSidebar}>Toggle sidebar</button>;
		}
	`,
	"@/components/blocks/top-navigation/components/right-navigation": `
		export function RightNavigation({ ref }) {
			return <div ref={ref} />;
		}
	`,
	"@/components/blocks/top-navigation/components/create-button": `
		export function CreateButton() {
			return null;
		}
	`,
	// Stands in for the sidebar's own close paths (resize-drag collapse, the
	// provider's \`setOpen(false)\`): both reach the shell through \`onOpenChange\`.
	"@/components/blocks/top-navigation/components/studio-sidebar": `
		import { useSidebar } from "@/components/ui/sidebar";
		export function StudioSidebar() {
			const { setOpen } = useSidebar();
			return <button type="button" onClick={() => setOpen(false)}>Request sidebar close</button>;
		}
	`,
	"@/components/blocks/top-navigation/components/search-suggestions-panel": `
		export default function SearchSuggestionsPanel() {
			return null;
		}
	`,
};

async function resizeWindow(width) {
	await act(async () => {
		globalThis.happyDOM.setInnerWidth(width);
		window.dispatchEvent(new Event("resize"));
	});
}

async function renderShell(width, props = {}) {
	globalThis.happyDOM.setInnerWidth(width);
	const view = await renderComponent({ entry: ENTRY, mocks: MOCKS, props });
	// Let the window-width and container measurements settle.
	await resizeWindow(width);
	return view;
}

function isSidebarOpen(view) {
	return view.getByRole("button", { name: "Toggle sidebar" }).getAttribute("aria-pressed") === "true";
}

test("the shell releases its pinned sidebar in small viewports and restores it when they grow", async () => {
	const view = await renderShell(1400);
	assert.equal(isSidebarOpen(view), true);

	await resizeWindow(600);
	assert.equal(isSidebarOpen(view), false);

	await resizeWindow(1400);
	assert.equal(isSidebarOpen(view), true);
});

test("a sidebar the user closed stays closed across a small viewport", async () => {
	const view = await renderShell(1400);
	await view.click(view.getByRole("button", { name: "Toggle sidebar" }));
	assert.equal(isSidebarOpen(view), false);

	await resizeWindow(600);
	await resizeWindow(1400);
	assert.equal(isSidebarOpen(view), false);
});

test("a shell that starts collapsed stays collapsed after a small viewport", async () => {
	const view = await renderShell(1400, { defaultSidebarOpen: false });
	assert.equal(isSidebarOpen(view), false);

	await resizeWindow(600);
	await resizeWindow(1400);
	assert.equal(isSidebarOpen(view), false);
});

test("opening the sidebar in a small viewport is deferred until the viewport grows", async () => {
	const view = await renderShell(1400);
	await view.click(view.getByRole("button", { name: "Toggle sidebar" }));
	await resizeWindow(600);

	await view.click(view.getByRole("button", { name: "Toggle sidebar" }));
	assert.equal(isSidebarOpen(view), false);

	await resizeWindow(1400);
	assert.equal(isSidebarOpen(view), true);
});

test("a close request while the viewport is small keeps the pin for when it grows", async () => {
	const view = await renderShell(1400);
	await resizeWindow(600);
	assert.equal(isSidebarOpen(view), false);

	await view.click(view.getByRole("button", { name: "Request sidebar close" }));
	assert.equal(isSidebarOpen(view), false);

	await resizeWindow(1400);
	assert.equal(isSidebarOpen(view), true);
});

test("the expanded search icon collapses again after the viewport leaves the icon range", async () => {
	const view = await renderShell(300);
	assert.equal(view.queryByRole("textbox", { name: "Search" }), null);

	await view.click(view.getByRole("button", { name: "Search" }));
	assert.ok(view.queryByRole("textbox", { name: "Search" }));

	await resizeWindow(1400);
	assert.ok(view.queryByRole("textbox", { name: "Search" }));

	await resizeWindow(300);
	assert.equal(view.queryByRole("textbox", { name: "Search" }), null);
	assert.equal(view.getByRole("button", { name: "Search" }).getAttribute("aria-label"), "Search");
});
