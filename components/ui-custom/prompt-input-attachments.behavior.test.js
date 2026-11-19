"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { act } = require("react");
const { renderComponent } = require("../../scripts/lib/render-component.js");

const source = `
import { StrictMode } from "react";
import {
	PromptInput,
	PromptInputProvider,
	usePromptInputAttachments,
	useProviderAttachments,
} from "@/components/ui-custom/prompt-input";

function AttachmentControls() {
	const attachments = usePromptInputAttachments();
	const add = (name) => attachments.add([new File(["abc"], name, { type: "text/plain" })]);
	return <>
		<span role="status" aria-label="Attached files">{attachments.files.map((file) => file.filename).join(",") || "empty"}</span>
		<button type="button" onClick={() => add("first.txt")}>Add first</button>
		<button type="button" onClick={() => { add("first.txt"); add("second.txt"); }}>Add twice</button>
		<button type="button" onClick={() => attachments.remove(attachments.files[0]?.id || "missing")}>Remove first</button>
		<button type="button" onClick={attachments.clear}>Clear files</button>
	</>;
}

function ProviderControls() {
	const attachments = useProviderAttachments();
	return <button type="button" onClick={() => attachments.add([
		new File(["x"], "outside-a.png", { type: "image/png" }),
		new File(["x"], "outside-b.png", { type: "image/png" }),
	])}>Provider add</button>;
}

export function AttachmentHarness({ provider = false, strict = false, visible = true, onSubmit, onError, maxFiles = 2, accept, maxFileSize }) {
	const form = visible ? <PromptInput onSubmit={onSubmit} onError={onError} maxFiles={maxFiles} accept={accept} maxFileSize={maxFileSize}>
		<input name="message" data-slot="prompt-input-message" defaultValue="Draft" />
		<AttachmentControls />
		<button type="submit">Submit</button>
	</PromptInput> : null;
	const contents = provider ? <PromptInputProvider><ProviderControls />{form}</PromptInputProvider> : form;
	return strict ? <StrictMode>{contents}</StrictMode> : contents;
}
`;

async function createHarness(t, options = {}) {
	const allocated = [];
	const revoked = [];
	const submissions = [];
	const errors = [];
	t.mock.method(URL, "createObjectURL", (file) => {
		const url = `blob:prompt-${allocated.length}`;
		allocated.push([file.name, url]);
		return url;
	});
	t.mock.method(URL, "revokeObjectURL", (url) => revoked.push(url));
	t.mock.method(globalThis, "fetch", async () => { throw new Error("test exercises the existing conversion fallback"); });
	const props = { onError: (error) => errors.push(error), onSubmit: (message) => submissions.push(message), ...options };
	const view = await renderComponent({ source, exportName: "AttachmentHarness", props });
	const filenames = () => view.container.querySelector('span[aria-label="Attached files"]')?.textContent;
	return { allocated, revoked, submissions, errors, view, filenames, rerender: (nextProps) => view.rerender({ ...props, ...nextProps }) };
}

for (const provider of [false, true]) {
	const mode = provider ? "provider" : "local";
	test(`${mode} form caps same-event additions and keeps attachment controls usable`, async (t) => {
		const { allocated, errors, filenames, revoked, view } = await createHarness(t, { provider, maxFiles: 1, strict: true });
		await view.click(view.getByRole("button", { name: "Add twice" }));
		assert.equal(filenames(), "first.txt");
		assert.equal(allocated.length, 1);
		assert.deepEqual(errors, [{ code: "max_files", message: "Too many files. Some were not added." }]);
		await view.click(view.getByRole("button", { name: "Remove first" }));
		assert.equal(filenames(), "empty");
		await view.unmount();
		assert.deepEqual(revoked, ["blob:prompt-0"]);
	});

	test(`${mode} rejected submit retains files and successful submit clears each URL once`, async (t) => {
		let rejectSubmit = true;
		const submissions = [];
		const { allocated, filenames, revoked, view } = await createHarness(t, { provider, onSubmit: async (message) => {
			submissions.push(message);
			if (rejectSubmit) { throw new Error("retry this turn"); }
		} });
		await view.click(view.getByRole("button", { name: "Add first" }));
		await view.click(view.getByRole("button", { name: "Submit" }));
		assert.equal(filenames(), "first.txt");
		assert.deepEqual(revoked, []);
		rejectSubmit = false;
		await view.click(view.getByRole("button", { name: "Submit" }));
		assert.equal(filenames(), "empty");
		assert.equal(submissions.length, 2);
		assert.equal(submissions[0].text, "Draft");
		assert.equal(submissions[0].files[0].url, "blob:prompt-0");
		assert.equal("id" in submissions[0].files[0], false);
		await view.unmount();
		assert.deepEqual(revoked, allocated.map((entry) => entry[1]));
	});

	test(`${mode} owner unmount revokes pending submit files once`, async (t) => {
		let release;
		const pending = new Promise((resolve) => { release = resolve; });
		const { allocated, revoked, view } = await createHarness(t, { provider, onSubmit: () => pending });
		await view.click(view.getByRole("button", { name: "Add first" }));
		await view.click(view.getByRole("button", { name: "Submit" }));
		await view.unmount();
		assert.deepEqual(revoked, allocated.map((entry) => entry[1]));
		await act(async () => { release(); await pending; });
		assert.deepEqual(revoked, allocated.map((entry) => entry[1]));
	});
}

test("provider attachments survive form unmount while unrestricted external admission stays available", async (t) => {
	const { allocated, filenames, revoked, view, rerender } = await createHarness(t, { provider: true, maxFiles: 1, accept: "text/plain", strict: true });
	await view.click(view.getByRole("button", { name: "Provider add" }));
	assert.equal(filenames(), "outside-a.png,outside-b.png");
	await rerender({ visible: false });
	assert.deepEqual(revoked, []);
	await rerender({ visible: true });
	assert.equal(filenames(), "outside-a.png,outside-b.png");
	await view.unmount();
	assert.deepEqual(revoked, allocated.map((entry) => entry[1]));
});

test("root StrictMode effect replay releases only the previous setup's URLs", async (t) => {
	const React = require("react");
	const { createRoot } = require("react-dom/client");
	const esbuild = require("esbuild");
	const { loadCjsModuleFromText } = require("../../scripts/lib/esbuild-cjs-loader.js");
	const allocated = [];
	const revoked = [];
	t.mock.method(URL, "createObjectURL", () => {
		const url = `blob:strict-${allocated.length}`;
		allocated.push(url);
		return url;
	});
	t.mock.method(URL, "revokeObjectURL", (url) => revoked.push(url));
	const compiled = esbuild.buildSync({
		stdin: {
			contents: `import { useEffect } from "react";
			import { PromptInputProvider, useProviderAttachments } from "@/components/ui-custom/prompt-input";
			function SeededAttachments() {
				const attachments = useProviderAttachments();
				useEffect(() => attachments.add([new File(["x"], "seed.txt", { type: "text/plain" })]), [attachments.add]);
				return <span>{attachments.files.map((file) => file.filename).join(",")}</span>;
			}
			export function Root() { return <PromptInputProvider><SeededAttachments /></PromptInputProvider>; }`,
			loader: "tsx",
			resolveDir: process.cwd(),
		},
		bundle: true,
		external: ["react", "react-dom"],
		format: "cjs",
		jsx: "automatic",
		loader: { ".css": "empty" },
		platform: "node",
		tsconfig: "tsconfig.json",
		write: false,
	});
	const { Root } = loadCjsModuleFromText(compiled.outputFiles[0].text);
	const container = document.body.appendChild(document.createElement("div"));
	const root = createRoot(container);
	try {
		await act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(Root))));
		assert.equal(container.textContent, "seed.txt");
		assert.deepEqual(allocated, ["blob:strict-0", "blob:strict-1"]);
		assert.deepEqual(revoked, ["blob:strict-0"]);
	} finally {
		await act(async () => root.unmount());
		container.remove();
	}
	assert.deepEqual(revoked, allocated);
});

test("submit retains disabled state and stops submitted or streaming work without submitting the form", async (t) => {
	const stops = [];
	const submissions = [];
	const view = await renderComponent({
		source: `
import { PromptInputSubmit } from "@/components/ui-custom/prompt-input";
export default function SubmitHarness({ status, disabled, onStop, onSubmit }) {
	return <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
		<PromptInputSubmit status={status} disabled={disabled} onStop={onStop} />
	</form>;
}`,
		props: { status: "ready", disabled: true },
	});
	t.after(() => view.unmount());
	assert.equal(view.getByRole("button", { name: "Submit" }).disabled, true);
	for (const status of ["submitted", "streaming"]) {
		await view.rerender({ status, disabled: true, onStop: () => stops.push(status), onSubmit: () => submissions.push(status) });
		const stop = view.getByRole("button", { name: "Stop" });
		assert.equal(stop.disabled, false);
		assert.equal(stop.type, "button");
		assert.equal(stop.className.includes("bg-transparent"), true);
		assert.equal(stop.className.includes("text-icon-danger"), false);
		await view.click(stop);
	}
	assert.deepEqual(stops, ["submitted", "streaming"]);
	assert.deepEqual(submissions, []);
	await view.rerender({ status: "ready", disabled: false, onSubmit: () => submissions.push("ready") });
	await view.click(view.getByRole("button", { name: "Submit" }));
	assert.deepEqual(submissions, ["ready"]);
});

test("header without children lists pending attachments as removable Attachment chips", async (t) => {
	t.mock.method(URL, "createObjectURL", (file) => `blob:header-${file.name}`);
	t.mock.method(URL, "revokeObjectURL", () => {});
	const view = await renderComponent({
		source: `
import { PromptInput, PromptInputHeader, usePromptInputAttachments } from "@/components/ui-custom/prompt-input";
function AddFile() {
	const attachments = usePromptInputAttachments();
	return <button type="button" onClick={() => attachments.add([new File(["abc"], "notes.txt", { type: "text/plain" })])}>Add file</button>;
}
export default function HeaderHarness() {
	return <PromptInput onSubmit={() => {}}>
		<PromptInputHeader><span>Context chip</span></PromptInputHeader>
		<PromptInputHeader />
		<AddFile />
	</PromptInput>;
}`,
	});
	t.after(() => view.unmount());
	const addons = () => view.container.querySelectorAll('[data-slot="input-group-addon"]');
	assert.equal(addons().length, 1, "an empty attachment header renders nothing");
	assert.equal(addons()[0].dataset.align, "block-start");
	assert.equal(addons()[0].textContent, "Context chip");
	await view.click(view.getByRole("button", { name: "Add file" }));
	const chip = view.container.querySelector('[data-slot="attachment"]');
	assert.equal(chip?.dataset.size, "sm");
	assert.equal(chip?.textContent, "notes.txt");
	await view.click(view.getByRole("button", { name: "Remove notes.txt" }));
	assert.equal(view.container.querySelector('[data-slot="attachment"]'), null);
	assert.equal(addons().length, 1);
});

test("action menu trigger and submit default to shadcn's round icon buttons and accept a composer radius", async (t) => {
	const view = await renderComponent({
		source: `
import { PromptInput, PromptInputActionMenu, PromptInputActionMenuTrigger, PromptInputSubmit } from "@/components/ui-custom/prompt-input";
export default function ButtonsHarness({ className }) {
	return <PromptInput onSubmit={() => {}}>
		<PromptInputActionMenu><PromptInputActionMenuTrigger aria-label="Add" className={className} /></PromptInputActionMenu>
		<PromptInputSubmit className={className} />
	</PromptInput>;
}`,
		props: {},
	});
	t.after(() => view.unmount());
	const classes = (name) => view.getByRole("button", { name }).className.split(/\s+/u);
	for (const name of ["Add", "Submit"]) {
		const button = view.getByRole("button", { name });
		assert.equal(button.dataset.size, "icon-sm");
		assert.equal(classes(name).includes("rounded-full"), true);
		assert.notEqual(button.querySelector("svg"), null, "renders its default icon");
	}
	assert.equal(classes("Add").includes("bg-bg-neutral-subtle"), true, "trigger uses the outline variant");
	assert.equal(view.getByRole("button", { name: "Submit" }).type, "submit");
	await view.rerender({ className: "rounded-md" });
	for (const name of ["Add", "Submit"]) {
		assert.equal(classes(name).includes("rounded-full"), false);
	}
});
