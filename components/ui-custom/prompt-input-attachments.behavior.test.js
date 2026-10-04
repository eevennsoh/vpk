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
