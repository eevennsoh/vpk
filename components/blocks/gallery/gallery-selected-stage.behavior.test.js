// The selected stage skips the entrance of the item shown on first render. Motion keeps that
// `initial: false` in the presence context, so it used to strip the `initial` keyframe from every
// motion element mounted inside the item later, e.g. the Butter board's handoff avatar that scales in
// from 0.85 when an agent is chosen.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const PROBE = `
import { motion } from "motion/react";
import { useState } from "react";
import { GallerySelectedStage } from "@/components/blocks/gallery/components/gallery-selected-stage";

function LateMount() {
	const [shown, setShown] = useState(false);
	return (
		<div>
			<button type="button" onClick={() => setShown(true)}>Show</button>
			{shown ? <motion.span data-testid="late" initial={{ transform: "scale(0.85)" }} animate={{ transform: "scale(1)" }} transition={{ duration: 10 }} /> : null}
			<motion.span data-testid="first" initial={{ transform: "scale(0.85)" }} animate={{ transform: "scale(1)" }} transition={{ duration: 10 }} />
		</div>
	);
}

export default function Probe() {
	return <GallerySelectedStage item={{ id: "a", title: "A", description: "", size: "1x1" }} position="center" resetKey={0} renderSelectedItem={() => <LateMount />} />;
}
`;

const transformOf = (id) => document.querySelector(`[data-testid="${id}"]`)?.style.transform ?? "";

test("motion elements mounted inside the first item after it renders keep their initial keyframe", async () => {
	const view = await renderComponent({ source: PROBE });
	assert.equal(transformOf("first"), "scale(1)", "content present on first render still skips its entrance");
	await view.click(view.getByRole("button", { name: "Show" }));
	assert.equal(transformOf("late"), "scale(0.85)");
	await view.unmount();
});
