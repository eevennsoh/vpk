const assert = require("node:assert/strict");
const path = require("node:path");
const { afterEach, test } = require("node:test");
const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const mocks = {
	"@/components/utils/theme-wrapper": 'export const useTheme = () => ({theme:"light",actualTheme:"light"});',
	"@/hooks/use-media-query": "export const useMediaQuery = () => globalThis.__guiTimelineTestReduced ?? false;",
};

const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));
const liveMediaMocks = { "@/components/utils/theme-wrapper": mocks["@/components/utils/theme-wrapper"] };

function reducedMotionPreference(context) {
	const queries = new Map();
	let reduced = false;
	context.mock.method(window, "matchMedia", (query) => {
		if (!queries.has(query)) {
			queries.set(query, Object.assign(new EventTarget(), { media: query, matches: query === "(prefers-reduced-motion: reduce)" && reduced }));
		}
		return queries.get(query);
	});
	return (value) => {
		reduced = value;
		for (const media of queries.values()) {
			if (media.media === "(prefers-reduced-motion: reduce)") {
				media.matches = value;
				media.dispatchEvent(new Event("change"));
			}
		}
	};
}

afterEach(() => { delete globalThis.__guiTimelineTestReduced; });

const config = {
	duration: 2,
	Card: { at: 0, duration: 1, from: { opacity: 0, y: 20 }, to: { opacity: 1, y: 0 }, transition: { type: "easing", duration: 1, ease: [0, 0, 1, 1] } },
	Title: { at: 0.2, duration: 0.6, from: { opacity: 0 }, to: { opacity: 1 }, transition: { type: "easing", duration: 0.6, ease: [0, 0, 1, 1] } },
};

const source = `
import { useState } from "react";
import { GUI, useGUITimeline } from "@/components/utils/gui";
function Animation({name, config, options}) {
	const timeline = useGUITimeline(name, config, options);
	if (!timeline) return <p>Registering</p>;
	return <>
		<output data-timeline-value={name}>{JSON.stringify({id:timeline.id,time:timeline.time,playing:timeline.playing,duration:timeline.duration,card:timeline.Card,title:timeline.Title})}</output>
		<button onClick={() => timeline.seek(0.5)}>Seek {name}</button>
		<button onClick={() => timeline.play()}>Play {name}</button>
		<button onClick={() => timeline.pause()}>Pause {name}</button>
		<button onClick={() => timeline.reset()}>Reset {name}</button>
		<button onClick={() => timeline.setValue("Title.at",0.8)}>Retime {name}</button>
	</>;
}
export default function Example({config,options,second=false,surface=true,onPreferenceChange}) {
	const [show,setShow] = useState(true);
	return <>
		<button onClick={() => setShow(!show)}>Toggle animation</button>
		{onPreferenceChange ? <><button onClick={() => onPreferenceChange(true)}>Reduce motion</button><button onClick={() => onPreferenceChange(false)}>Allow motion</button></> : null}
		{show ? <Animation name="Entrance" config={config} options={options}/> : null}
		{second ? <Animation name="Second" config={config} options={options}/> : null}
		{surface ? <GUI.Timeline label="Animation timeline"/> : null}
	</>;
}`;

const snapshot = (view, name = "Entrance") => JSON.parse(view.container.querySelector(`[data-timeline-value="${name}"]`).textContent);
const render = (props = {}, extra = {}) => renderComponent({ source, props: { config, ...props }, mocks, ...extra });

test("the timeline demo opens with a visible completed preview and retains later scrub and reset", async () => {
	const view = await renderComponent({
		entry: "components/website/demos/utils/gui-timeline-demo.tsx",
		mocks,
	});
	const card = () => view.container.querySelector('[data-timeline-preview="card"]');
	assert.equal(card().style.opacity, "1");
	assert.equal(view.getByRole("slider", { name: "Timeline current time" }).getAttribute("aria-valuenow"), "1.2");
	await view.fill(view.getByRole("textbox", { name: "Playhead" }), "0.3");
	assert.equal(view.getByRole("slider", { name: "Timeline current time" }).getAttribute("aria-valuenow"), "0.3");
	assert.equal(Number(card().style.opacity) < 1, true);
	await view.click(view.getByRole("button", { name: "Reset timeline" }));
	assert.equal(view.getByRole("slider", { name: "Timeline current time" }).getAttribute("aria-valuenow"), "0");
	assert.equal(card().style.opacity, "0");
});

test("timeline scrubbing samples real clip values and keyboard seeking updates the preview", async () => {
	const view = await render();
	assert.equal(snapshot(view).playing, false);
	assert.equal(snapshot(view).card.current.opacity, 0);
	await view.click(view.getByRole("button", { name: "Seek Entrance" }));
	assert.equal(snapshot(view).time, 0.5);
	assert.equal(snapshot(view).card.current.opacity, 0.5);
	assert.equal(snapshot(view).card.current.y, 10);
	const playhead = view.getByRole("slider", { name: "Timeline current time" });
	await view.press(playhead, "ArrowRight", { shiftKey: true });
	assert.equal(snapshot(view).time, 0.6);
	await view.press(playhead, "End");
	assert.equal(snapshot(view).time, 2);
	assert.equal(snapshot(view).card.current.opacity, 1);
	await view.press(playhead, "Home");
	assert.equal(snapshot(view).time, 0);
});

test("native timeline transport, retiming and reset share the same registration", async (context) => {
	const view = await render();
	context.mock.method(window, "requestAnimationFrame", () => 1);
	await view.click(view.getByRole("button", { name: "Play timeline" }));
	assert.equal(snapshot(view).playing, true);
	await view.click(view.getByRole("button", { name: "Pause timeline" }));
	assert.equal(snapshot(view).playing, false);
	await view.click(view.getByRole("button", { name: "Retime Entrance" }));
	assert.equal(snapshot(view).title.at, 0.8);
	await view.click(view.getByRole("button", { name: "Seek Entrance" }));
	assert.equal(snapshot(view).title.current.opacity, 0);
	await view.click(view.getByRole("button", { name: "Reset Entrance" }));
	assert.equal(snapshot(view).title.at, 0.2);
	assert.equal(snapshot(view).time, 0);
});

test("native versions preserve separate authored values and can be removed", async () => {
	const view = await render();
	const versions = () => view.click(view.getByRole("button", { name: "Versions" }));
	await versions();
	await view.click(view.getByRole("menuitem", { name: "New version" }));
	await view.click(view.getByRole("button", { name: "Retime Entrance" }));
	assert.equal(snapshot(view).title.at, 0.8);
	await versions();
	await view.click(view.getByRole("menuitemradio", { name: "Version 1" }));
	assert.equal(snapshot(view).title.at, 0.2);
	await versions();
	await view.click(view.getByRole("menuitemradio", { name: "Version 2" }));
	assert.equal(snapshot(view).title.at, 0.8);
	await versions();
	await view.click(view.getByRole("menuitem", { name: "Delete Version 2" }));
	assert.equal(view.queryByRole("menuitemradio", { name: "Version 2" }) === null, true);
});

test("native clipboard exports current authored timeline parameters", async (context) => {
	const copied = [];
	context.mock.method(navigator.clipboard, "writeText", async (value) => { copied.push(value); });
	const view = await render();
	await view.click(view.getByRole("button", { name: "Retime Entrance" }));
	await view.click(view.getByRole("button", { name: "Copy parameters" }));
	assert.equal(copied.length, 1);
	assert.equal(copied[0].startsWith('Update the createDialTimeline configuration for "Entrance"'), true);
	const values = JSON.parse(copied[0].split("```json\n")[1].split("\n```")[0]);
	assert.equal(values["Title.at"], 0.8);
	assert.equal(values["Card.at"], 0);
	assert.deepEqual(values["Card.transition"], { type: "easing", duration: 1, ease: [0, 0, 1, 1] });
	assert.equal(Object.keys(values).some((key) => key.endsWith(".__mode")), false);
});

test("the actual clip editor opens with a keyboard and cleans up its portal", async () => {
	const view = await render();
	await view.press(view.getByRole("button", { name: "Edit Card" }), "Enter");
	assert.equal(view.getByRole("dialog", { name: "Edit Card" }).getAttribute("role"), "dialog");
	await view.press(view.getByRole("button", { name: "Close editor" }), "Escape");
	assert.equal(view.queryByRole("dialog", { name: "Edit Card" }) === null, true);
	await view.press(view.getByRole("button", { name: "Edit Card" }), "Enter");
	await view.unmount();
	assert.equal(document.querySelector(".dialkit-timeline-popover") === null, true);
});

test("ordinary clip editors expose each From and To value once", async () => {
	const view = await render();
	await view.press(view.getByRole("button", { name: "Edit Card" }), "Enter");
	assert.equal(view.getAllByRole("button", { name: "From" }).length, 1);
	assert.equal(view.getAllByRole("button", { name: "To" }).length, 1);
	assert.equal(view.getAllByRole("slider", { name: "Opacity" }).length, 2);
	const from = view.getByRole("button", { name: "From" }).closest(".dialkit-folder");
	await view.press(from.querySelector('[role="slider"][aria-label="Opacity"]'), "ArrowRight");
	assert.equal(snapshot(view).card.from.opacity, 0.01);
});

test("the first sequence leg retains From while later legs expose only their target", async () => {
	const view = await render({ config: {
		...config,
		Card: {
			at: 0,
			from: { opacity: 0 },
			steps: [
				{ duration: 0.5, to: { opacity: 1 } },
				{ duration: 0.5, to: { opacity: 0.5 } },
			],
		},
	} });
	Object.defineProperty(view.container.querySelector(".dialkit-timeline-ruler"), "clientWidth", { configurable: true, value: 512 });
	await view.click(view.getByRole("button", { name: "Retime Entrance" }));
	const clip = () => view.getByRole("button", { name: "Edit Card" });
	await view.click(clip().querySelector('[data-step="step1"]'));
	assert.equal(view.queryByRole("dialog", { name: "Edit Card · Step 1" }) !== null, true);
	assert.equal(view.getAllByRole("button", { name: "From" }).length, 1);
	assert.equal(view.getAllByRole("button", { name: "To" }).length, 1);
	assert.equal(view.getAllByRole("slider", { name: "Opacity" }).length, 2);
	await view.click(view.getByRole("button", { name: "Close editor" }));
	await view.click(clip().querySelector('[data-step="step2"]'));
	assert.equal(view.queryByRole("dialog", { name: "Edit Card · Step 2" }) !== null, true);
	assert.equal(view.queryByRole("button", { name: "From" }) === null, true);
	assert.equal(view.getAllByRole("button", { name: "To" }).length, 1);
	assert.equal(view.getAllByRole("slider", { name: "Opacity" }).length, 1);
});

test("distinct clip popovers retain their own From controls and values", async () => {
	const view = await render({ second: true });
	await view.press(view.getAllByRole("button", { name: "Edit Card" })[0], "Enter");
	await view.press(view.getAllByRole("button", { name: "Edit Card" })[1], "Enter");
	assert.equal(view.getAllByRole("dialog", { name: "Edit Card" }).length, 2);
	const fromButtons = view.getAllByRole("button", { name: "From" });
	assert.equal(fromButtons.length, 2);
	const firstFrom = fromButtons[0].closest(".dialkit-folder");
	await view.press(firstFrom.querySelector('[role="slider"][aria-label="Opacity"]'), "ArrowRight");
	assert.equal(snapshot(view).card.from.opacity, 0.01);
	assert.equal(snapshot(view, "Second").card.from.opacity, 0);
});

test("dismissing a clip editor returns keyboard focus to its clip", async () => {
	const view = await render();
	const clip = view.getByRole("button", { name: "Edit Card" });
	await view.focus(clip);
	await view.press(clip, "Enter");
	await view.press(view.getByRole("button", { name: "Close editor" }), "Escape");
	await nextTask();
	assert.equal(view.isFocused(view.getByRole("button", { name: "Edit Card" })), true);
});

test("closing a clip editor restores its live clip after timing edits redraw the row", async () => {
	const view = await render();
	await view.press(view.getByRole("button", { name: "Edit Card" }), "Enter");
	await view.press(view.getByRole("slider", { name: "Duration" }), "ArrowRight");
	assert.equal(snapshot(view).card.duration, 1.01);
	await view.click(view.getByRole("button", { name: "Close editor" }));
	await nextTask();
	assert.equal(view.queryByRole("dialog", { name: "Edit Card" }) === null, true);
	assert.equal(view.isFocused(view.getByRole("button", { name: "Edit Card" })), true);
});

test("outside pointer dismissal keeps focus on the clicked control", async () => {
	const view = await render();
	await view.press(view.getByRole("button", { name: "Edit Card" }), "Enter");
	const seek = view.getByRole("button", { name: "Seek Entrance" });
	await view.click(seek);
	assert.equal(view.queryByRole("dialog", { name: "Edit Card" }) === null, true);
	assert.equal(view.isFocused(seek), true);
	assert.equal(snapshot(view).time, 0.5);
});

test("unmount cancels a pending editor focus restoration task", async (context) => {
	const view = await render();
	await view.press(view.getByRole("button", { name: "Edit Card" }), "Enter");
	context.mock.timers.enable({ apis: ["setTimeout"] });
	const pendingTimer = globalThis.setTimeout;
	let callbacks = 0;
	context.mock.method(globalThis, "setTimeout", (callback, delay, ...args) => pendingTimer(() => {
		callbacks += 1;
		callback(...args);
	}, delay));
	await view.click(view.getByRole("button", { name: "Close editor" }));
	assert.equal(callbacks, 0);
	await view.unmount();
	context.mock.timers.tick(0);
	assert.equal(callbacks, 0);
});

test("removing the aggregate editor cleans portals without disposing registered animation state", async () => {
	const view = await render();
	const id = snapshot(view).id;
	await view.click(view.getByRole("button", { name: "Retime Entrance" }));
	await view.press(view.getByRole("button", { name: "Edit Card" }), "Enter");
	await view.rerender({ config, surface: false });
	assert.equal(view.queryByRole("dialog", { name: "Edit Card" }) === null, true);
	assert.equal(snapshot(view).id, id);
	assert.equal(snapshot(view).title.at, 0.8);
	await view.rerender({ config, surface: true });
	assert.equal(view.container.querySelectorAll(".dialkit-timeline-section").length, 1);
	assert.equal(snapshot(view).id, id);
	assert.equal(snapshot(view).title.at, 0.8);
});

test("multiple timeline registrations have separate transport and one aggregate surface", async () => {
	const view = await render({ second: true });
	assert.equal(view.container.querySelectorAll(".dialkit-timeline-section").length, 2);
	assert.notEqual(snapshot(view).id, snapshot(view, "Second").id);
	await view.click(view.getByRole("button", { name: "Seek Entrance" }));
	assert.equal(snapshot(view).time, 0.5);
	assert.equal(snapshot(view, "Second").time, 0);
	await view.click(view.getByRole("button", { name: "Toggle animation" }));
	assert.equal(view.container.querySelectorAll(".dialkit-timeline-section").length, 1);
	assert.equal(snapshot(view, "Second").time, 0);
});

test("removing one timeline closes its version menu and leaves its sibling editable", async () => {
	const view = await render({ second: true });
	await view.click(view.getAllByRole("button", { name: "Versions" })[0]);
	await view.click(view.getByRole("menuitem", { name: "New version" }));
	await view.click(view.getAllByRole("button", { name: "Versions" })[0]);
	assert.equal(view.queryByRole("menuitemradio", { name: "Version 2" }) !== null, true);
	await view.click(view.getByRole("button", { name: "Toggle animation" }));
	assert.equal(view.queryByRole("menuitemradio", { name: "Version 2" }) === null, true);
	assert.equal(view.container.querySelectorAll(".dialkit-timeline-section").length, 1);
	await view.click(view.getByRole("button", { name: "Seek Second" }));
	assert.equal(snapshot(view, "Second").time, 0.5);
	await view.click(view.getByRole("button", { name: "Versions" }));
	assert.equal(view.queryByRole("menuitemradio", { name: "Version 1" }) !== null, true);
	assert.equal(view.queryByRole("menuitemradio", { name: "Version 2" }) === null, true);
});

test("StrictMode removal and remount discard unsaved timeline values", async () => {
	const view = await render({}, { strictMode: true });
	assert.equal(view.container.querySelectorAll(".dialkit-timeline-section").length, 1);
	const initialId = snapshot(view).id;
	await view.click(view.getByRole("button", { name: "Retime Entrance" }));
	await view.click(view.getByRole("button", { name: "Toggle animation" }));
	assert.equal(view.container.querySelectorAll(".dialkit-timeline-section").length, 0);
	await view.click(view.getByRole("button", { name: "Toggle animation" }));
	assert.equal(view.container.querySelectorAll(".dialkit-timeline-section").length, 1);
	assert.equal(snapshot(view).title.at, 0.2);
	assert.notEqual(snapshot(view).id, initialId);
});

test("external schema updates preserve edits and add newly authored clips", async () => {
	const view = await render();
	await view.click(view.getByRole("button", { name: "Retime Entrance" }));
	await view.rerender({ config: { ...config, Details: { at: 0.4, duration: 0.5, from: { opacity: 0 }, to: { opacity: 1 } } } });
	assert.equal(snapshot(view).title.at, 0.8);
	assert.equal(view.getByRole("button", { name: "Edit Details" }).getAttribute("role"), "button");
});

test("changing registration options starts a fresh timeline without stale authored values", async (context) => {
	const view = await render({ options: { loop: false } });
	const initialId = snapshot(view).id;
	await view.click(view.getByRole("button", { name: "Retime Entrance" }));
	context.mock.method(window, "requestAnimationFrame", () => 1);
	await view.rerender({ config, options: { autoplay: true, loop: { from: 0.5 } } });
	assert.notEqual(snapshot(view).id, initialId);
	assert.equal(snapshot(view).title.at, 0.2);
	assert.equal(snapshot(view).playing, true);
	assert.equal(view.container.querySelectorAll(".dialkit-timeline-section").length, 1);
});

test("reduced motion settles playback while preserving manual scrubbing", async () => {
	globalThis.__guiTimelineTestReduced = true;
	const view = await render({ options: { autoplay: true } });
	assert.equal(snapshot(view).playing, false);
	assert.equal(snapshot(view).time, snapshot(view).duration);
	assert.equal(snapshot(view).card.current.opacity, 1);
	await view.click(view.getByRole("button", { name: "Play Entrance" }));
	assert.equal(snapshot(view).playing, false);
	assert.equal(snapshot(view).time, snapshot(view).duration);
	await view.click(view.getByRole("button", { name: "Seek Entrance" }));
	assert.equal(snapshot(view).time, 0.5);
	assert.equal(snapshot(view).card.current.opacity, 0.5);
});

test("changing reduced motion settles live timelines and updates native playback availability", async (context) => {
	const view = await render({ second: true });
	context.mock.method(window, "requestAnimationFrame", () => 1);
	await view.click(view.getByRole("button", { name: "Play Entrance" }));
	assert.equal(snapshot(view).playing, true);
	globalThis.__guiTimelineTestReduced = true;
	await view.rerender({ config, second: true });
	assert.equal(snapshot(view).playing, false);
	assert.equal(snapshot(view).time, 2);
	assert.equal(snapshot(view, "Second").time, 2);
	assert.equal(view.getAllByRole("button", { name: "Play timeline" }).every((button) => button.disabled), true);
	await view.click(view.getByRole("button", { name: "Toggle animation" }));
	assert.equal(view.getByRole("button", { name: "Replay timeline" }).disabled, true);
	await view.click(view.getByRole("button", { name: "Toggle animation" }));
	assert.equal(snapshot(view).time, 2);
	assert.equal(view.getAllByRole("button", { name: "Play timeline" }).every((button) => button.disabled), true);
	await view.click(view.getByRole("button", { name: "Toggle animation" }));
	globalThis.__guiTimelineTestReduced = false;
	await view.rerender({ config, second: true });
	assert.equal(view.getByRole("button", { name: "Play timeline" }).disabled, false);
	assert.equal(snapshot(view, "Second").playing, false);
	await view.click(view.getByRole("button", { name: "Play Second" }));
	assert.equal(snapshot(view, "Second").playing, true);
});

test("real media-query change subscriptions settle playback and restore native transport", async (context) => {
	const changePreference = reducedMotionPreference(context);
	const view = await render({ onPreferenceChange: changePreference }, { mocks: liveMediaMocks });
	const id = snapshot(view).id;
	context.mock.method(window, "requestAnimationFrame", () => 1);
	await view.click(view.getByRole("button", { name: "Play timeline" }));
	assert.equal(snapshot(view).playing, true);
	await view.click(view.getByRole("button", { name: "Reduce motion" }));
	assert.equal(snapshot(view).id, id);
	assert.equal(snapshot(view).playing, false);
	assert.equal(snapshot(view).time, 2);
	assert.equal(snapshot(view).card.current.opacity, 1);
	assert.equal(view.getByRole("button", { name: "Play timeline" }).disabled, true);
	assert.equal(view.getByRole("button", { name: "Replay timeline" }).disabled, true);
	await view.click(view.getByRole("button", { name: "Allow motion" }));
	assert.equal(view.getByRole("button", { name: "Play timeline" }).disabled, false);
	assert.equal(view.getByRole("button", { name: "Replay timeline" }).disabled, false);
	assert.equal(snapshot(view).playing, false);
	await view.click(view.getByRole("button", { name: "Play timeline" }));
	assert.equal(snapshot(view).playing, true);
	assert.equal(snapshot(view).time, 0);
});

test("the demo responds to real media-query changes without remounting", async (context) => {
	const changePreference = reducedMotionPreference(context);
	const view = await renderComponent({
		source: `
import GUITimelineDemo from "@/components/website/demos/utils/gui-timeline-demo";
export default function Example({onPreferenceChange}) {
	return <><button onClick={() => onPreferenceChange(true)}>Reduce motion</button><button onClick={() => onPreferenceChange(false)}>Allow motion</button><GUITimelineDemo/></>;
}`,
		props: { onPreferenceChange: changePreference },
		mocks: liveMediaMocks,
	});
	context.mock.method(window, "requestAnimationFrame", () => 1);
	const preview = view.container.querySelector('[data-timeline-preview="card"]');
	await view.fill(view.getByRole("textbox", { name: "Playhead" }), "0.3");
	assert.equal(Number(preview.style.opacity) < 1, true);
	await view.click(view.getByRole("button", { name: "Play preview" }));
	assert.equal(view.queryByRole("button", { name: "Pause preview" }) !== null, true);
	await view.click(view.getByRole("button", { name: "Reduce motion" }));
	assert.equal(preview.style.opacity, "1");
	assert.equal(preview.style.transform, "translateY(0px)");
	assert.equal(view.getByRole("button", { name: "Play preview" }).disabled, true);
	assert.equal(view.getByRole("button", { name: "Replay preview" }).disabled, true);
	assert.equal(view.getByRole("slider", { name: "Timeline current time" }).getAttribute("aria-valuenow"), "1.2");
	await view.fill(view.getByRole("textbox", { name: "Playhead" }), "0");
	assert.equal(preview.style.opacity, "1");
	await view.click(view.getByRole("button", { name: "Allow motion" }));
	assert.equal(preview.style.opacity, "0");
	assert.equal(view.getByRole("button", { name: "Play preview" }).disabled, false);
	assert.equal(view.getByRole("button", { name: "Replay preview" }).disabled, false);
});

test("the reduced-motion demo reflects edited completed values", async () => {
	globalThis.__guiTimelineTestReduced = true;
	const view = await renderComponent({
		entry: "components/website/demos/utils/gui-timeline-demo.tsx",
		mocks,
	});
	const preview = view.container.querySelector('[data-timeline-preview="card"]');
	assert.equal(preview.style.opacity, "1");
	await view.press(view.getByRole("button", { name: "Edit Card" }), "Enter");
	const toFolder = view.getByRole("button", { name: "To" }).closest(".dialkit-folder");
	const opacity = toFolder.querySelector('[role="slider"][aria-label="Opacity"]');
	await view.press(opacity, "Enter");
	const input = opacity.querySelector("input");
	await view.fill(input, "0.4");
	await view.press(input, "Enter");
	assert.equal(preview.style.opacity, "0.4");
});
