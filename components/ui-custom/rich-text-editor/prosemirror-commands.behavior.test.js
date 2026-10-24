const assert = require("node:assert/strict");
const test = require("node:test");

test("editor commands wrap and split paragraphs using the same model", async () => {
	const { Schema } = await import("@tiptap/pm/model");
	const { EditorState, TextSelection } = await import("@tiptap/pm/state");
	const { wrapIn, splitBlock } = await import("@tiptap/pm/commands");
	const schema = new Schema({
		nodes: {
			doc: { content: "block+" },
			paragraph: { content: "inline*", group: "block" },
			blockquote: { content: "block+", group: "block" },
			text: { group: "inline" },
		},
	});
	const doc = schema.node("doc", null, [
		schema.node("paragraph", null, [schema.text("Hello")]),
	]);
	let state = EditorState.create({
		doc,
		selection: TextSelection.create(doc, 3),
	});
	const dispatch = (transaction) => {
		state = state.apply(transaction);
	};

	assert.equal(wrapIn(schema.nodes.blockquote)(state, dispatch), true);
	assert.equal(splitBlock(state, dispatch), true);
	assert.deepEqual(state.doc.toJSON(), {
		type: "doc",
		content: [{
			type: "blockquote",
			content: [
				{ type: "paragraph", content: [{ type: "text", text: "He" }] },
				{ type: "paragraph", content: [{ type: "text", text: "llo" }] },
			],
		}],
	});
});
