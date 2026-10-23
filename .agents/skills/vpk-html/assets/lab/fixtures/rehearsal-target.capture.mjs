// Capture spec for rehearsal-target.html (references/media-pipeline.md, Capture). The demo build uses the default
// export: one hold segment over the fixture's 6 s rehearsal clock at 30 fps, 1280 × 720. Its id "clock" is the
// segment the demo's cues (t_s) and Gantt follow. media/pipeline.browser.test.mjs appends throwScreencast, a
// passive screencast of the live Throw button, to exercise both segment kinds in one film.
//
//   node .agents/skills/vpk-html/scripts/media/capture.mjs .agents/skills/vpk-html/assets/lab/fixtures/rehearsal-target.capture.mjs \
//        --manifest-dir output/vpk-html-capture/rehearsal-target        (unsandboxed: Playwright)

export const throwScreencast = Object.freeze({
	id: "live",
	kind: "screencast",
	label: "live throw",
	async drive({ page, mark }) {
		await page.click("#throw");
		mark("throw");
		await page.waitForTimeout(2200);
	},
});

const spec = {
	name: "rehearsal-target",
	url: "./rehearsal-target.html",
	viewport: { width: 1280, height: 720 },
	deviceScaleFactor: 1,
	fps: 30,
	jpegQuality: 90,
	colorScheme: "light",
	ready: { selector: "#stage", settleMs: 50 },
	segments: [
		{ id: "clock", kind: "hold", label: "rehearsal clock", start: 0, end: 6 },
	],
};

export default spec;
