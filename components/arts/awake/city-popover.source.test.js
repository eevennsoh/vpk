const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { renderComponent } = require("../../../scripts/lib/render-component.js");

const CITY_POPOVER_FILE = path.join(__dirname, "city-popover.tsx");
const CITY_POPOVER_SOURCE = fs.readFileSync(CITY_POPOVER_FILE, "utf8");

const editorProps = {
	cities: [], selectedIndex: 0, setSelectedIndex() {}, addCity() {},
};
const editorMocks = {
	"@/components/arts/awake/glass-slider": 'export function GlassSlider() { return <button role="slider" aria-label="Cities" />; }',
	"@/components/arts/awake/use-city-search": 'export function useCitySearch() { return { results: [], isLoading: false, error: null }; }',
	"@/components/website/demos/visual/shaders/liquid-glass": 'export default function LiquidGlass() { return null; }',
};

test("CityRailEditor consumes each parent open request only once so Escape can close the manager", async (t) => {
	const sounds = [];
	t.mock.method(HTMLMediaElement.prototype, "play", function play() {
		if (this.volume > 0) sounds.push(new URL(this.src).pathname);
		return Promise.resolve();
	});
	t.mock.method(HTMLMediaElement.prototype, "pause", () => {});
	const view = await renderComponent({
		entry: "components/arts/awake/city-popover.tsx", exportName: "CityRailEditor",
		props: { ...editorProps, openRequestKey: 0 }, mocks: editorMocks,
	});
	assert.equal(view.getByRole("button", { name: "Add city" }).getAttribute("aria-expanded"), "false");
	await view.rerender({ ...editorProps, openRequestKey: -1 });
	assert.equal(view.getByRole("button", { name: "Add city" }).getAttribute("aria-expanded"), "false");
	assert.deepEqual(sounds, []);
	await view.rerender({ ...editorProps, openRequestKey: 1 });
	assert.equal(view.getByRole("button", { name: "Close city manager" }).getAttribute("aria-expanded"), "true");
	assert.deepEqual(sounds, ["/sound/click-001.mp3"]);
	await view.press(view.getByRole("textbox", { name: "Search cities" }), "Escape");
	assert.equal(view.getByRole("button", { name: "Add city" }).getAttribute("aria-expanded"), "false");
	assert.deepEqual(sounds, ["/sound/click-001.mp3", "/sound/click-004.mp3"]);
	await view.rerender({ ...editorProps, openRequestKey: 1 });
	assert.equal(view.getByRole("button", { name: "Add city" }).getAttribute("aria-expanded"), "false");
	assert.deepEqual(sounds, ["/sound/click-001.mp3", "/sound/click-004.mp3"]);
	await view.rerender({ ...editorProps, openRequestKey: 2 });
	assert.equal(view.getByRole("button", { name: "Close city manager" }).getAttribute("aria-expanded"), "true");
	assert.deepEqual(sounds, ["/sound/click-001.mp3", "/sound/click-004.mp3", "/sound/click-001.mp3"]);
});

test("CityRailEditor keeps the manager open when mouse clicks toggle a city row", () => {
	assert.match(
		CITY_POPOVER_SOURCE,
		/const toggleCitySelection = useCallback\(\s*\(city: LockscreenLocation, cityIndex: number\) => \{\s*const isRemoving = cityIndex !== -1 && Boolean\(removeCity\);\s*playSound\(isRemoving \? "\/sound\/click-004\.mp3" : "\/sound\/click-001\.mp3"\);\s*if \(cityIndex !== -1 && removeCity\) \{\s*removeCity\(city\.id\);\s*\} else \{\s*addCity\(city\);\s*handleCommit\(cities\.length\);\s*\}\s*\},\s*\[addCity, cities\.length, handleCommit, removeCity\],\s*\);/s,
	);
	assert.match(
		CITY_POPOVER_SOURCE,
		/const handleCityRowPress = useCallback\(\s*\(city: LockscreenLocation, cityIndex: number\) => \{\s*toggleCitySelection\(city, cityIndex\);\s*\},\s*\[toggleCitySelection\],\s*\);/s,
	);
	assert.match(
		CITY_POPOVER_SOURCE,
		/if \(event\.key === "Enter"\) \{\s*event\.preventDefault\(\);\s*const city = filteredCities\[highlightedIndex\];\s*if \(!city\) return;\s*const cityIndex = cities\.findIndex\(\(item\) => item\.id === city\.id\);\s*toggleCitySelection\(city, cityIndex\);\s*\}/s,
	);
	assert.doesNotMatch(
		CITY_POPOVER_SOURCE,
		/const handleCityRowPress = useCallback\(\s*\(city: LockscreenLocation, cityIndex: number\) => \{[\s\S]*setIsOpen\(false\);[\s\S]*\},\s*\[toggleCitySelection\],\s*\);/s,
	);
});

test("CityRailEditor resets the highlighted result when search input changes or the manager closes", async () => {
	const addedCities = [];
	const props = { ...editorProps, openRequestKey: 1, addCity: (city) => addedCities.push(city.id) };
	const view = await renderComponent({
		entry: "components/arts/awake/city-popover.tsx", exportName: "CityRailEditor",
		props, mocks: editorMocks,
	});
	const search = view.getByRole("textbox", { name: "Search cities" });
	await view.press(search, "ArrowDown");
	await view.fill(search, "Tokyo");
	await view.press(search, "Enter");
	const { PRESET_CITIES } = require("./preset-cities.ts");
	assert.deepEqual(addedCities, [PRESET_CITIES.find((city) => city.name === "Tokyo").id]);
	assert.equal(view.getByRole("button", { name: "Close city manager" }).getAttribute("aria-expanded"), "true");
	await view.fill(search, "");
	await view.press(search, "ArrowDown");
	await view.press(search, "Enter");
	assert.equal(addedCities[1], PRESET_CITIES[1].id);
	await view.press(search, "Escape");
	await view.rerender({ ...props, openRequestKey: 2 });
	assert.equal(view.getByRole("textbox", { name: "Search cities" }).value, "");
	await view.press(view.getByRole("textbox", { name: "Search cities" }), "Enter");
	assert.equal(addedCities[2], PRESET_CITIES[0].id);
});

test("CityRailEditor lets the city rows use the full list width", () => {
	assert.match(
		CITY_POPOVER_SOURCE,
		/className="scrollbar-auto-hide absolute inset-0 overflow-y-auto"/,
	);
	assert.match(
		CITY_POPOVER_SOURCE,
		/scrollbarGutter: "auto",/,
	);
	assert.match(
		CITY_POPOVER_SOURCE,
		/scrollbarWidth: "none",/,
	);
});

test("CityRailEditor gives the floating add and pin buttons the standard VPK focus ring", () => {
	// Both floating chips share the same VPK focus-ring pattern
	// (`focus-visible:ring-ring/50 focus-visible:ring-3 focus-visible:outline-none`).
	// The Add-city button label switches to "Close city manager" when the
	// popover is open, but the focus-ring classes are identical in both
	// states — match the suffix of the className regardless of label.
	assert.match(
		CITY_POPOVER_SOURCE,
		/aria-label=\{isOpen \? "Close city manager" : "Add city"\}/,
	);
	// Add-city / close button focus ring (both buttons share the same
	// className suffix; just match the canonical fragment in source).
	const focusRingFragment =
		/focus-visible:ring-ring\/50 focus-visible:ring-3 focus-visible:outline-none/;
	assert.match(CITY_POPOVER_SOURCE, focusRingFragment);
	// Pin button keeps the same focus-ring class set (use a separate
	// match to ensure it appears at least twice in source).
	const focusRingMatches = CITY_POPOVER_SOURCE.match(
		/focus-visible:ring-ring\/50 focus-visible:ring-3 focus-visible:outline-none/g,
	);
	assert.ok(
		focusRingMatches && focusRingMatches.length >= 2,
		"expected focus-ring class fragment to appear on both floating buttons",
	);
	assert.match(
		CITY_POPOVER_SOURCE,
		/group-focus-within\/city-rail:opacity-100/,
	);
});

test("CityRailEditor keeps the Add-city button mounted while the popover is open and morphs the + glyph into an × via 45° rotation", () => {
	// Button is no longer wrapped in `{!isOpen ? ... : null}` — instead
	// the wrapper div toggles its opacity classes based on `isOpen` so
	// the same button serves both as "Add city" and "Close city manager".
	assert.doesNotMatch(
		CITY_POPOVER_SOURCE,
		/\{!isOpen \? \(\s*<div[\s\S]*aria-label="Add city"/,
	);
	// Verify the `aria-expanded` attribute is wired so screen-reader users
	// know the button toggles a disclosure.
	assert.match(CITY_POPOVER_SOURCE, /aria-expanded=\{isOpen\}/);
	// Verify the + glyph rotates 45° (visually morphing into an ×) when
	// the popover is open.
	assert.match(
		CITY_POPOVER_SOURCE,
		/animate=\{\{ rotate: isOpen \? 45 : 0 \}\}/,
	);
});
