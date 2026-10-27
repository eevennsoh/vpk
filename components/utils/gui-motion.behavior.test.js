const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const PRELUDE = `
import { useState } from "react";
import { GUI } from "@/components/utils/gui";
`;

const readOutput = (view, id = "value") => JSON.parse(view.container.querySelector(`output[id="${id}"]`).textContent);

test("easing numbers emit fresh tuples and retain Y overshoot", async () => {
	const changes = [];
	const initial = Object.freeze([0.25, 0.1, 0.25, 1]);
	const view = await renderComponent({
		source: PRELUDE + `
export default function Example({initial, onChange}) {
	const [value, setValue] = useState(initial);
	return <><GUI.Easing id="ease" label="Curve" value={value} onChange={(next) => {onChange(next);setValue(next);}}/><output id="value">{JSON.stringify(value)}</output></>;
}`,
		props: { initial, onChange: (value) => changes.push(value) },
	});

	for (const [name, value] of [["Bezier X1", "0.35"], ["Bezier Y1", "-0.45"], ["Bezier X2", "0.8"], ["Bezier Y2", "1.2"]]) {
		await view.fill(view.getByRole("textbox", { name }), value);
	}

	assert.deepEqual(readOutput(view), [0.35, -0.45, 0.8, 1.2]);
	assert.deepEqual(initial, [0.25, 0.1, 0.25, 1]);
	assert.equal(changes.length, 4);
	assert.equal(changes.every((value) => Array.isArray(value) && value.length === 4 && value.every(Number.isFinite)), true);
	assert.equal(new Set(changes).size, changes.length);
});

test("easing remains externally controlled when a parent rejects or replaces an edit", async () => {
	const changes = [];
	const source = PRELUDE + `
export default function Example({value, onChange}) {
	return <><GUI.Easing id="ease" label="Curve" description="Timing curve" value={value} onChange={onChange}/><button>Blur</button></>;
}`;
	const onChange = (value) => changes.push(value);
	const view = await renderComponent({ source, props: { value: [0.2, 0.3, 0.4, 0.5], onChange } });
	const x1 = view.getByRole("textbox", { name: "Bezier X1" });
	await view.focus(x1);
	await view.fill(x1, "0.7");
	assert.deepEqual(changes, [[0.7, 0.3, 0.4, 0.5]]);
	await view.click(view.getByRole("button", { name: "Blur" }));
	assert.equal(x1.value, "0.2");

	await view.rerender({ value: [0.1, -0.2, 0.9, 1.2], onChange });
	assert.deepEqual(["Bezier X1", "Bezier Y1", "Bezier X2", "Bezier Y2"].map((name) => view.getByRole("textbox", { name }).value), ["0.1", "-0.2", "0.9", "1.2"]);
	assert.equal(view.getByText("Timing curve").textContent, "Timing curve");
	assert.equal(changes.length, 1);
});

test("easing reset emits a fresh default tuple and disappears without a default", async () => {
	const changes = [];
	const defaultValue = Object.freeze([0.16, 1, 0.3, 1]);
	const onChange = (value) => changes.push(value);
	const source = PRELUDE + `
export default function Example(props) { return <GUI.Easing id="ease" label="Curve" {...props}/>; }
`;
	const view = await renderComponent({ source, props: { value: [0, 0, 1, 1], defaultValue, onChange } });
	await view.click(view.getByRole("button", { name: "Reset Curve" }));
	assert.deepEqual(changes, [[0.16, 1, 0.3, 1]]);
	assert.equal(changes[0] === defaultValue, false);

	await view.rerender({ value: [...defaultValue], defaultValue, onChange });
	assert.equal(view.getByRole("button", { name: "Reset Curve" }).disabled, true);
	await view.rerender({ value: [...defaultValue], onChange });
	assert.equal(view.queryByRole("button", { name: "Reset Curve" }) === null, true);
});

test("the actual easing graph supports keyboard edits including Y overshoot", async () => {
	const changes = [];
	const view = await renderComponent({
		source: PRELUDE + `
export default function Example({onChange}) {
	const [value, setValue] = useState([0.25,0.1,0.25,1]);
	return <><GUI.Easing id="ease" label="Curve" value={value} onChange={(next) => {onChange(next);setValue(next);}}/><output id="value">{JSON.stringify(value)}</output></>;
}`,
		props: { onChange: (value) => changes.push(value) },
	});
	await view.press(view.getByRole("button", { name: "Bézier handle 1: X 0.25, Y 0.1" }), "ArrowRight");
	assert.deepEqual(readOutput(view), [0.26, 0.1, 0.25, 1]);
	await view.press(view.getByRole("button", { name: "Bézier handle 2: X 0.25, Y 1" }), "ArrowUp", { shiftKey: true });
	assert.deepEqual(readOutput(view), [0.26, 0.1, 0.25, 1.1]);
	assert.equal(view.getByRole("textbox", { name: "Bezier Y2" }).value, "1.1");
	assert.equal(changes.length, 2);
});

test("a parent can reject a graphical edit without leaving the graph out of sync", async () => {
	const changes = [];
	const onChange = (value) => changes.push(value);
	const view = await renderComponent({
		source: PRELUDE + `
export default function Example(props) { return <GUI.Easing id="ease" label="Curve" {...props}/>; }
`,
		props: { value: [0.25, 0.1, 0.25, 1], onChange },
	});
	await view.press(view.getByRole("button", { name: "Bézier handle 1: X 0.25, Y 0.1" }), "ArrowRight");
	assert.deepEqual(changes, [[0.26, 0.1, 0.25, 1]]);
	assert.equal(view.queryByRole("button", { name: "Bézier handle 1: X 0.25, Y 0.1" }) !== null, true);
	await view.rerender({ value: [0.7, -0.3, 0.9, 1.4], onChange });
	assert.equal(view.queryByRole("button", { name: "Bézier handle 1: X 0.7, Y -0.3" }) !== null, true);
	assert.equal(view.queryByRole("button", { name: "Bézier handle 2: X 0.9, Y 1.4" }) !== null, true);
	assert.equal(changes.length, 1);
});

test("easing presets replace a custom value through the controlled callback", async () => {
	const view = await renderComponent({
		source: PRELUDE + `
export default function Example() {
	const [value, setValue] = useState([0.25,0.1,0.25,1]);
	return <><GUI.Easing id="ease" label="Curve" value={value} onChange={setValue}/><output id="value">{JSON.stringify(value)}</output></>;
}`,
	});
	await view.click(view.getByRole("combobox", { name: "Curve preset" }));
	await view.click(view.getByRole("option", { name: "Ease out practical" }));
	assert.deepEqual(readOutput(view), [0.4, 1, 0.6, 1]);
	assert.equal(view.getByRole("textbox", { name: "Bezier X1" }).value, "0.4");
	assert.equal(view.queryByRole("button", { name: "Bézier handle 2: X 0.6, Y 1" }) !== null, true);
});

test("spring numbers emit controlled physical parameters and reset copies the default", async () => {
	const changes = [];
	const defaults = Object.freeze({ stiffness: 200, damping: 25, mass: 1 });
	const view = await renderComponent({
		source: PRELUDE + `
export default function Example({defaults, onChange}) {
	const [value, setValue] = useState(defaults);
	return <><GUI.Spring id="spring" label="Physics" value={value} defaultValue={defaults} onChange={(next) => {onChange(next);setValue(next);}}/><output id="value">{JSON.stringify(value)}</output></>;
}`,
		props: { defaults, onChange: (value) => changes.push(value) },
	});

	for (const [name, value] of [["Stiffness", "320"], ["Damping", "18"], ["Mass", "1.5"]]) {
		await view.fill(view.getByRole("textbox", { name }), value);
	}
	assert.deepEqual(readOutput(view), { stiffness: 320, damping: 18, mass: 1.5 });
	await view.click(view.getByRole("button", { name: "Reset Physics" }));
	assert.deepEqual(readOutput(view), { stiffness: 200, damping: 25, mass: 1 });
	assert.equal(changes.at(-1) === defaults, false);
	assert.equal(view.getByRole("button", { name: "Reset Physics" }).disabled, true);
});

test("spring graph and fields follow external physical values without emitting edits", async () => {
	const changes = [];
	const onChange = (value) => changes.push(value);
	const view = await renderComponent({
		source: PRELUDE + `
export default function Example(props) { return <GUI.Spring id="spring" label="Physics" {...props}/>; }
`,
		props: { value: { stiffness: 200, damping: 25, mass: 1 }, onChange },
	});
	const initialCurve = view.getByRole("img", { name: "Physics response curve" }).querySelector("path").getAttribute("d");
	await view.rerender({ value: { stiffness: 400, damping: 0, mass: 2 }, onChange });
	const nextCurve = view.getByRole("img", { name: "Physics response curve" }).querySelector("path").getAttribute("d");
	assert.equal(nextCurve !== initialCurve, true);
	assert.equal(nextCurve.includes("NaN") || nextCurve.includes("Infinity"), false);
	assert.deepEqual(["Stiffness", "Damping", "Mass"].map((name) => view.getByRole("textbox", { name }).value), ["400", "0", "2"]);
	assert.deepEqual(changes, []);
});

test("disabled motion editors remove every edit path from keyboard access", async () => {
	const changes = [];
	const view = await renderComponent({
		source: PRELUDE + `
export default function Example({onChange}) {
	return <>
		<GUI.Easing id="ease" label="Curve" disabled value={[0.25,0.1,0.25,1]} defaultValue={[0,0,1,1]} onChange={onChange}/>
		<GUI.Spring id="spring" label="Physics" disabled value={{stiffness:200,damping:25,mass:1}} defaultValue={{stiffness:300,damping:20,mass:1}} onChange={onChange}/>
	</>;
}`,
		props: { onChange: (value) => changes.push(value) },
	});
	assert.deepEqual(view.tabOrder(), []);
	for (const handle of view.getAllByRole("button", { name: /^Bézier handle/u })) {
		assert.equal(handle.disabled, true);
		await view.press(handle, "ArrowRight");
	}
	for (const reset of view.getAllByRole("button", { name: /^Reset /u })) {
		await view.click(reset);
	}
	assert.deepEqual(changes, []);
});

test("disabling an easing editor closes an already open preset popup", async () => {
	const changes = [];
	const onChange = (value) => changes.push(value);
	const view = await renderComponent({
		source: PRELUDE + `
export default function Example(props) { return <GUI.Easing id="ease" label="Curve" value={[0.25,0.1,0.25,1]} {...props}/>; }
`,
		props: { onChange },
	});
	await view.click(view.getByRole("combobox", { name: "Curve preset" }));
	assert.equal(view.queryByRole("option", { name: "Linear" }) !== null, true);
	await view.rerender({ onChange, disabled: true });
	assert.equal(view.queryByRole("option", { name: "Linear" }) === null, true);
	assert.deepEqual(changes, []);
});

test("two easing instances keep graphical values and edits independent", async () => {
	const view = await renderComponent({
		source: PRELUDE + `
export default function Example() {
	const [first, setFirst] = useState([0.1,0.2,0.3,0.4]);
	const [second, setSecond] = useState([0.5,0.6,0.7,0.8]);
	return <><GUI.Easing id="first" label="First" value={first} onChange={setFirst}/><GUI.Easing id="second" label="Second" value={second} onChange={setSecond}/><output id="value">{JSON.stringify({first,second})}</output></>;
}`,
	});
	await view.press(view.getByRole("button", { name: "Bézier handle 1: X 0.1, Y 0.2" }), "ArrowRight");
	assert.deepEqual(readOutput(view), { first: [0.11, 0.2, 0.3, 0.4], second: [0.5, 0.6, 0.7, 0.8] });
	assert.equal(view.queryByRole("button", { name: "Bézier handle 1: X 0.5, Y 0.6" }) !== null, true);
	const helpIds = view.getAllByRole("button", { name: /^Bézier handle 1/u }).map((handle) => handle.getAttribute("aria-describedby"));
	assert.equal(new Set(helpIds).size, 2);
	assert.equal(helpIds.every((id) => document.getElementById(id)?.textContent.includes("Arrow keys")), true);
});

test("collapsing and remounting an easing editor recreates one graph from its controlled value", async () => {
	const view = await renderComponent({
		strictMode: true,
		source: PRELUDE + `
export default function Example({value}) {
	return <GUI.Section title="Curve section"><GUI.Easing id="ease" label="Curve" value={value} onChange={() => {}}/></GUI.Section>;
}`,
		props: { value: [0.25, 0.1, 0.25, 1] },
	});
	assert.equal(view.getAllByRole("button", { name: /^Bézier handle/u }).length, 2);
	await view.click(view.getByRole("button", { name: "Curve section" }));
	assert.equal(view.queryByRole("button", { name: /^Bézier handle/u }) === null, true);
	await view.rerender({ value: [0.7, -0.3, 0.9, 1.4] });
	await view.click(view.getByRole("button", { name: "Curve section" }));
	assert.equal(view.getAllByRole("button", { name: /^Bézier handle/u }).length, 2);
	assert.equal(view.queryByRole("button", { name: "Bézier handle 1: X 0.7, Y -0.3" }) !== null, true);
});

test("motion editors participate in scoped mounted-key copying and section cleanup", async (context) => {
	const copied = [];
	context.mock.method(navigator.clipboard, "writeText", async (value) => { copied.push(value); });
	const view = await renderComponent({
		strictMode: true,
		source: PRELUDE + `
export default function Example({easeKey = "ease"}) {
	return <GUI.Panel title="Motion" values={{ease:[0.25,0.1,0.25,1],alternate:[0,0,1,1],physics:{stiffness:200,damping:25,mass:1},visible:"Always",hidden:true}}>
		<GUI.TextInput id="visible" label="Visible" value="Always" onChange={() => {}} valueKeys="visible"/>
		<GUI.Easing id="ease" label="Curve" value={[0.25,0.1,0.25,1]} onChange={() => {}} valueKeys={easeKey}/>
		<GUI.Section title="Spring section"><GUI.Spring id="spring" label="Physics" disabled value={{stiffness:200,damping:25,mass:1}} onChange={() => {}} valueKeys="physics"/></GUI.Section>
	</GUI.Panel>;
}`,
	});
	const copy = () => view.click(view.getByRole("button", { name: "Copy values as JSON" }));
	await copy();
	assert.deepEqual(JSON.parse(copied.at(-1)), { visible: "Always", ease: [0.25, 0.1, 0.25, 1], physics: { stiffness: 200, damping: 25, mass: 1 } });
	assert.equal(copied.at(-1).includes('\n\t"ease"'), true);
	await view.click(view.getByRole("button", { name: "Spring section" }));
	await copy();
	assert.deepEqual(JSON.parse(copied.at(-1)), { visible: "Always", ease: [0.25, 0.1, 0.25, 1] });
	await view.rerender({ easeKey: "alternate" });
	await copy();
	assert.deepEqual(JSON.parse(copied.at(-1)), { visible: "Always", alternate: [0, 0, 1, 1] });
});

test("avatar motion controls bind easing edits, reset, replay and copied values", async (context) => {
	const copied = [];
	context.mock.method(navigator.clipboard, "writeText", async (value) => { copied.push(value); });
	const view = await renderComponent({
		source: PRELUDE + `
import { HumanAgentAvatarMotionControls } from "@/components/website/demos/ui-custom/human-agent-avatar-motion-controls";
import { resolveHumanAgentAvatarMotion } from "@/components/ui-custom/human-agent-avatar-motion-config";
export default function Example() {
	const [config, setConfig] = useState(() => resolveHumanAgentAvatarMotion());
	const [replays, setReplays] = useState(0);
	return <><HumanAgentAvatarMotionControls config={config} sizePx={32} onChange={(patch) => setConfig((current) => resolveHumanAgentAvatarMotion({...current,...patch}))} onReplay={() => setReplays((value) => value + 1)}/><output id="value">{JSON.stringify({ease:config.ease,replays})}</output></>;
}`,
	});
	await view.fill(view.getByRole("textbox", { name: "Bezier X1" }), "0.7");
	assert.deepEqual(readOutput(view), { ease: [0.7, 0, 0, 1], replays: 0 });
	await view.click(view.getByRole("button", { name: "Copy values as JSON" }));
	assert.deepEqual(JSON.parse(copied.at(-1)).ease, [0.7, 0, 0, 1]);
	await view.click(view.getByRole("button", { name: "Reset Easing curve" }));
	assert.deepEqual(readOutput(view).ease, [0.4, 0, 0, 1]);
	await view.click(view.getByRole("button", { name: "Replay avatar animation" }));
	assert.equal(readOutput(view).replays, 1);
	assert.equal(view.getByRole("textbox", { name: "Turn duration" }).value, "300");
});
