import { readFileSync, writeFileSync } from "node:fs";
import { expect, test, type Locator } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${readFileSync(".dev-frontend-port", "utf8").trim()}`;
const PEEL_URL = `${BASE_URL}/preview/visual/peel`;
const ILLUSTRATION_NAME = /Blue illustration of overlapping speech bubbles/;

async function expectHorizontalAvatarHandoff(overlay: Locator) {
	const pose = await overlay.evaluate((root) => {
		const measure = (selector: string) => {
			const avatar = root.querySelector(selector)!;
			const present = [...avatar.children].find((element) => element.getAttribute("aria-hidden") !== "true")!;
			const origin = avatar.getBoundingClientRect();
			return [...present.querySelectorAll('[data-avatar-role]')].map((element) => {
				const box = element.getBoundingClientRect();
				return { x: box.x + box.width / 2 - origin.x, y: box.y + box.height / 2 - origin.y, width: box.width };
			});
		};
		return { native: measure('[data-peel-native-source] [data-slot="human-agent-avatar"]'), capture: measure('[data-peel-capture-source] [data-slot="human-agent-avatar"]') };
	});
	expect(pose.native).toHaveLength(2);
	expect(Math.abs(pose.native[0].y - pose.native[1].y)).toBeLessThan(0.5);
	for (let index = 0; index < pose.native.length; index++) {
		for (const dimension of ["x", "y", "width"] as const) {
			expect(Math.abs(pose.native[index][dimension] - pose.capture[index][dimension])).toBeLessThan(0.5);
		}
	}
}

test("Team EU26 defaults Peel visual on, persists its switch, and prepares only an intended session", async ({ page }) => {
	await page.addInitScript(() => {
		if (!localStorage.getItem("ui-design-variants")) localStorage.setItem("ui-design-variants", JSON.stringify({ sessionBloom: true, schemaVersion: 2 }));
	});
	await page.goto(`${BASE_URL}/jira-team-eu26`, { waitUntil: "networkidle" });
	await page.getByRole("button", { name: "Settings", exact: true }).click();
	const setting = page.getByRole("menuitemcheckbox", { name: "Peel visual", exact: true });
	await expect(setting).toHaveAttribute("aria-checked", "true");
	await setting.click();
	await page.reload({ waitUntil: "networkidle" });
	await page.getByRole("button", { name: "Settings", exact: true }).click();
	await expect(setting).toHaveAttribute("aria-checked", "false");
	await setting.click();
	await page.keyboard.press("Escape");
	const expand = page.getByRole("button", { name: "Expand Unlink sessions column", exact: true });
	if (await expand.isVisible()) await expand.click();
	await expect(page.locator("[data-peel-surface]")).toHaveCount(0);
	const source = page.getByTestId("agent-session-row-lw-scope-thread").locator("article");
	await source.scrollIntoViewIfNeeded();
	await source.hover();
	await expect(page.locator("[data-peel-prepared=true]")).toHaveCount(1);
	await expect(page.locator("[data-peel-surface]")).toHaveCount(1);
	const box = (await source.boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width / 2 + 65, box.y + box.height / 2 + 40, { steps: 8 });
	await expect(page.locator("[data-session-drag-overlay] [data-peel-ready=true]")).toBeAttached();
	await expect(page.locator('[data-session-drag-overlay] [data-peel-native-source] [data-slot="human-agent-avatar"]')).toHaveAttribute("data-animated", "false");
	await expect(page.locator("[data-session-fusion-chip]")).toHaveCount(1);
	await page.screenshot({ path: "output/agent-browser/peel/team-eu26-peel-enabled.png" });
	await page.mouse.up();
	await page.mouse.move(5, 5);
	await expect(page.locator("[data-session-drag-overlay]")).toHaveCount(0);
	await expect(page.locator("[data-session-preview-idle] [data-peel-prepared=true]")).toHaveCount(1);
});

test("Claude's avatar-coloured flash passes through the card face and fades without an exterior halo", async ({ page }) => {
	await page.goto(PEEL_URL, { waitUntil: "networkidle" });
	await page.getByRole("button", { name: "Agent session", exact: true }).click();
	const source = page.getByTestId("agent-session-row-peel-claude").locator("article");
	const accent = await source.evaluate((element) => getComputedStyle(element).getPropertyValue("--card-glow-tile-accent").trim());
	const box = (await source.boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	// Move clear of the resting source so its own hover glow cannot enter the
	// measured area around the travelling card.
	await page.mouse.move(box.x + box.width / 2 + 140, box.y + box.height / 2 + 125, { steps: 8 });
	const overlay = page.locator("[data-session-drag-overlay]");
	await expect(overlay.locator("[data-peel-ready=true]")).toBeAttached();
	expect(await overlay.locator("[data-peel-surface]").evaluate((element) => getComputedStyle(element).getPropertyValue("--peel-flash-color").trim())).toBe(accent);
	const { pill, identity, canvasBox } = await page.evaluate(() => {
		const overlay = document.querySelector("[data-session-drag-overlay]")!;
		const rect = (selector: string) => {
			const box = overlay.querySelector(selector)!.getBoundingClientRect();
			return { x: box.x, y: box.y, width: box.width, height: box.height };
		};
		return {
			pill: rect("[data-peel-native-source] [data-session-drag-pill]"),
			identity: rect("[data-peel-native-source] [data-session-drag-identity]"),
			canvasBox: rect("canvas"),
		};
	});
	// Capture the rendered frame directly: locator screenshots wait for the
	// pointer spring to become stationary, which can outlast this short flash.
	const glowing = await page.screenshot({ clip: canvasBox, path: "output/agent-browser/peel/claude-peel-flash.png" });
	await page.waitForTimeout(700);
	const faded = await page.screenshot({ clip: canvasBox, path: "output/agent-browser/peel/claude-peel-flash-faded.png" });
	const countFlashPixels = async (png: Buffer) => page.evaluate(async ({ png, pill, identity, canvasBox }) => {
		const image = new Image();
		image.src = `data:image/png;base64,${png}`;
		await image.decode();
		const bitmap = document.createElement("canvas");
		bitmap.width = image.width;
		bitmap.height = image.height;
		const context = bitmap.getContext("2d")!;
		context.drawImage(image, 0, 0);
		const scale = image.width / canvasBox.width;
		const pixels = context.getImageData(0, 0, image.width, image.height).data;
		let face = 0;
		let exterior = 0;
		for (let y = 0; y < image.height; y++) {
			for (let x = 0; x < image.width; x++) {
				const cssX = canvasBox.x + x / scale;
				const cssY = canvasBox.y + y / scale;
				const i = (y * image.width + x) * 4;
				if (pixels[i] - pixels[i + 1] <= 6 || pixels[i + 1] - pixels[i + 2] <= 2) continue;
				// Read the white face beyond the avatars, preserving its text.
				if (cssX >= identity.x + identity.width + 12 && cssX <= pill.x + pill.width - 10 && cssY >= pill.y + 6 && cssY <= pill.y + pill.height - 6 && pixels[i + 2] > 130) face++;
				// Clear the bent outline and shadow, and avoid the receiver above.
				if (cssX >= pill.x - 4 && cssX <= pill.x + pill.width + 4 && cssY >= pill.y + pill.height + 14 && cssY <= pill.y + pill.height + 28) exterior++;
			}
		}
		return { face, exterior };
	}, { png: png.toString("base64"), pill, identity, canvasBox });
	const litPixels = await countFlashPixels(glowing);
	expect(litPixels.face).toBeGreaterThan(10);
	expect(litPixels.exterior).toBe(0);
	expect((await countFlashPixels(faded)).face).toBeLessThan(litPixels.face / 4);
	await expect(overlay).toContainText("Venn");
	await page.mouse.up();
	await expect(overlay).toHaveCount(0);
});

test("the prepared Claude wave joins the completed card and avatar within two frames and parks between drags", async ({ page }) => {
	await page.addInitScript(() => {
		const probe = { morphEnd: 0, identityEnd: 0, preparedAt: 0, settledFrames: 0, wave: 0, frames: 0 };
		Object.assign(window, { peelHandoff: probe });
		const animate = Element.prototype.animate;
		Element.prototype.animate = function (...args) {
			const animation = animate.apply(this, args);
			if (this.matches("[data-session-drag-surface], [data-session-drag-identity], [data-session-drag-label]")) {
				void animation.finished.then(() => { probe.morphEnd = performance.now(); }).catch(() => {});
			}
			return animation;
		};
		for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
			const draw = prototype.drawElements;
			prototype.drawElements = function (...args) {
				if (this.canvas instanceof HTMLCanvasElement && this.canvas.closest("[data-peel-surface]")) probe.frames++;
				return draw.apply(this, args);
			};
		}
		let identityFrame = 0;
		const watchIdentity = () => {
			identityFrame = 0;
			const overlay = document.querySelector("[data-session-drag-overlay]");
			if (!overlay || probe.identityEnd > 0) return;
			const avatar = overlay.querySelector<HTMLElement>('[data-peel-native-source] [data-slot="human-agent-avatar"]');
			const captured = overlay.querySelector<HTMLElement>('[data-peel-capture-source] [data-slot="human-agent-avatar"]');
			const positions = (root: HTMLElement) => {
				const origin = root.getBoundingClientRect();
				const present = [...root.children].find((element) => element.getAttribute("aria-hidden") !== "true");
				return [...present?.querySelectorAll('[data-avatar-role]') ?? []].map((element) => {
					const box = element.getBoundingClientRect();
					return { x: box.x - origin.x, y: box.y - origin.y, width: box.width, height: box.height };
				});
			};
			if (probe.morphEnd > 0 && avatar?.dataset.composition === "group" && captured) {
				const native = positions(avatar);
				const print = positions(captured);
				probe.settledFrames = native.length === 2 && print.length === 2 && native.every((box, index) => (["x", "y", "width", "height"] as const).every((key) => Math.abs(box[key] - print[index][key]) < 0.5)) ? probe.settledFrames + 1 : 0;
				if (probe.settledFrames >= 2) probe.identityEnd = performance.now();
			}
			if (probe.identityEnd === 0) identityFrame = requestAnimationFrame(watchIdentity);
		};
		new MutationObserver(() => {
			if (probe.preparedAt === 0 && document.querySelector("[data-peel-prepared=true]")) probe.preparedAt = performance.now();
			if (identityFrame === 0 && probe.identityEnd === 0 && document.querySelector("[data-session-drag-overlay]")) identityFrame = requestAnimationFrame(watchIdentity);
			if (probe.wave === 0 && document.querySelector("[data-session-drag-overlay] [data-peel-ready=true]")) probe.wave = performance.now();
		}).observe(document, { subtree: true, attributes: true, attributeFilter: ["data-peel-ready", "data-peel-prepared", "data-session-drag-overlay"] });
	});
	await page.goto(PEEL_URL, { waitUntil: "networkidle" });
	await page.getByRole("button", { name: "Agent session", exact: true }).click();
	const source = page.getByTestId("agent-session-row-peel-claude").locator("article");
	const prepared = page.locator("[data-session-preview-idle] [data-peel-prepared=true]");
	// Begin the first drag as soon as the real card is visible. Do not wait for
	// a test-only preparation signal to conceal first-use capture latency.
	await expect(source).toBeVisible();
	let canvas: Awaited<ReturnType<typeof prepared.elementHandle>> | null = null;
	for (let attempt = 0; attempt < 2; attempt++) {
		await page.evaluate(() => {
			const probe = (window as typeof window & { peelHandoff: { morphEnd: number; identityEnd: number; preparedAt: number; settledFrames: number; wave: number } }).peelHandoff;
			probe.morphEnd = probe.identityEnd = probe.wave = 0;
			probe.settledFrames = 0;
			probe.preparedAt = document.querySelector("[data-peel-prepared=true]") ? performance.now() : 0;
		});
		const box = (await source.boundingBox())!;
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 45, { steps: 8 });
		const overlay = page.locator("[data-session-drag-overlay]");
		await expect(overlay.locator("[data-peel-ready=true]")).toBeAttached();
		await expectHorizontalAvatarHandoff(overlay);
		canvas ??= await overlay.locator("canvas").elementHandle();
		const timing = await page.evaluate(() => (window as typeof window & { peelHandoff: { morphEnd: number; identityEnd: number; preparedAt: number; wave: number; frames: number } }).peelHandoff);
		const entranceEnd = Math.max(timing.morphEnd, timing.identityEnd, timing.preparedAt);
		await test.info().attach(`claude-handoff-${attempt + 1}`, { body: JSON.stringify({ morphToWaveMs: timing.wave - timing.morphEnd, entranceToWaveMs: timing.wave - entranceEnd }), contentType: "application/json" });
		expect(timing.morphEnd).toBeGreaterThan(0);
		expect(timing.identityEnd).toBeGreaterThan(0);
		expect(timing.frames).toBeGreaterThan(0);
		expect(timing.wave - entranceEnd).toBeGreaterThanOrEqual(0);
		// The wave immediately follows both completed entrance animations.
		expect(timing.wave - entranceEnd).toBeLessThan(50);
		expect(await canvas!.evaluate((element) => element === document.querySelector("[data-session-drag-overlay] canvas"))).toBe(true);
		await page.mouse.up();
		await expect(overlay).toHaveCount(0);
		await expect(page.locator("[data-session-fusion-chip]")).toHaveCount(0);
		await expect(prepared).toBeAttached();
		expect(await prepared.evaluate((element) => Boolean(element.closest("[inert][aria-hidden=true]")))).toBe(true);
		await page.waitForTimeout(100);
		const parkedFrames = await page.evaluate(() => (window as typeof window & { peelHandoff: { frames: number } }).peelHandoff.frames);
		await page.waitForTimeout(200);
		expect(await page.evaluate(() => (window as typeof window & { peelHandoff: { frames: number } }).peelHandoff.frames)).toBe(parkedFrames);
	}
	await page.getByRole("button", { name: "Illustration", exact: true }).click();
	await expect(page.locator("[data-session-drag-overlay]")).toHaveCount(0);
	await expect(page.locator('[data-peel-session-visibility="hidden"][aria-hidden="true"][inert]')).toHaveCount(1);
	await expect(page.locator('[data-peel-session-visibility="hidden"] .shimmer')).toHaveCount(0);
	await page.waitForTimeout(100);
	const frames = await page.evaluate(() => (window as typeof window & { peelHandoff: { frames: number } }).peelHandoff.frames);
	await page.waitForTimeout(200);
	expect(await page.evaluate(() => (window as typeof window & { peelHandoff: { frames: number } }).peelHandoff.frames)).toBe(frames);
});

test("the font stylesheet stays readable and drag capture logs no CSSOM security errors", async ({ page }) => {
	const securityErrors: string[] = [];
	page.on("console", (message) => {
		if (message.type() === "error" && /cssRules|CSS rules|inlining remote css|SecurityError/i.test(message.text())) securityErrors.push(message.text());
	});
	page.on("pageerror", (error) => {
		if (error.name === "SecurityError") securityErrors.push(error.message);
	});
	// A real cross-origin stylesheet response with CORS support. Without the
	// link's crossorigin mode, cssRules still throws despite this response header.
	await page.route("https://fonts.googleapis.com/**", (route) => route.fulfill({
		status: 200,
		contentType: "text/css",
		headers: { "access-control-allow-origin": "*" },
		body: '@font-face { font-family: "Peel regression font"; src: local("Arial"); }',
	}));
	await page.goto(PEEL_URL, { waitUntil: "networkidle" });
	expect(await page.evaluate(() => {
		const link = document.querySelector<HTMLLinkElement>('link[rel="stylesheet"][href^="https://fonts.googleapis.com/"]');
		if (!link?.sheet) throw new Error("Font stylesheet did not load");
		try { return { readable: true, count: link.sheet.cssRules.length }; }
		catch (error) { return { readable: false, name: (error as Error).name }; }
	})).toEqual({ readable: true, count: 1 });
	await page.getByRole("button", { name: "Agent session", exact: true }).click();
	const source = page.getByTestId("agent-session-row-peel-claude").locator("article");
	await expect(source).toBeVisible();
	const box = (await source.boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 45, { steps: 8 });
	await expect(page.locator("[data-session-drag-overlay] [data-peel-ready=true]")).toBeAttached();
	await page.mouse.up();
	expect(securityErrors).toEqual([]);
});

test("clicking peels once, the paper settles, and clicking it again lays it down", async ({ page }) => {
	await page.goto(PEEL_URL, { waitUntil: "networkidle" });
	const stamp = page.getByRole("button", { name: ILLUSTRATION_NAME });
	const canvas = page.locator("main canvas");
	await expect(canvas).toBeVisible();
	await expect(stamp).toHaveAttribute("aria-pressed", "false");
	const box = await stamp.boundingBox();
	if (!box) throw new Error("Stamp has no hit area");
	await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.9);
	await page.mouse.down();
	await expect(stamp).toHaveAttribute("aria-pressed", "true");
	await page.mouse.up();
	await expect(stamp).toHaveAttribute("aria-pressed", "true");
	await page.waitForTimeout(200);
	const curled = await canvas.screenshot({ path: "output/agent-browser/peel/curled-paper.png" });
	await page.waitForTimeout(1_800);
	const lifted = await canvas.screenshot({ path: "output/agent-browser/peel/lifted-paper.png" });
	expect(curled.equals(lifted)).toBe(false);
	await page.waitForTimeout(300);
	expect((await canvas.screenshot()).equals(lifted)).toBe(true);
	await stamp.click();
	await expect(stamp).toHaveAttribute("aria-pressed", "false");
	await page.waitForTimeout(1_800);
	expect((await canvas.screenshot({ path: "output/agent-browser/peel/landed-paper.png" })).equals(lifted)).toBe(false);
});

test("native keyboard activation toggles the peel and arrow keys move the paper", async ({ page }) => {
	await page.goto(PEEL_URL, { waitUntil: "networkidle" });
	const stamp = page.getByRole("button", { name: ILLUSTRATION_NAME });
	await stamp.focus();
	await stamp.press("Enter");
	await expect(stamp).toHaveAttribute("aria-pressed", "true");
	const before = await stamp.boundingBox();
	await stamp.press("ArrowRight");
	await expect.poll(async () => (await stamp.boundingBox())!.x - before!.x).toBeGreaterThan(10);
	await stamp.press("Space");
	await expect(stamp).toHaveAttribute("aria-pressed", "false");
	await stamp.press("Enter");
	await expect(stamp).toHaveAttribute("aria-pressed", "true");
	await stamp.press("Escape");
	await expect(stamp).toHaveAttribute("aria-pressed", "false");
});

test("touch toggles the stamp at mobile size and live reduced motion leaves a static surface", async ({ browser }) => {
	const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
	const page = await context.newPage();
	try {
		await page.goto(PEEL_URL, { waitUntil: "networkidle" });
		const stamp = page.getByRole("button", { name: ILLUSTRATION_NAME });
		await stamp.tap();
		await expect(stamp).toHaveAttribute("aria-pressed", "true");
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.waitForTimeout(1_500);
		const canvas = page.locator("main canvas");
		const still = await canvas.screenshot({ path: "output/agent-browser/peel/mobile-reduced-motion.png" });
		await page.waitForTimeout(350);
		expect((await canvas.screenshot()).equals(still)).toBe(true);
		await stamp.tap();
		await expect(stamp).toHaveAttribute("aria-pressed", "false");
	} finally {
		await context.close();
	}
});

test("the standalone Claude drag bends its real preview and links with the glow drop effect", async ({ page }) => {
	await page.goto(PEEL_URL, { waitUntil: "networkidle" });
	await page.getByRole("button", { name: "Agent session", exact: true }).click();
	const source = page.getByTestId("agent-session-row-peel-claude").locator("article");
	const target = page.getByTestId("peel-work-item");
	await expect(source).toBeVisible();
	await expect(page.getByRole("img", { name: "medium priority", exact: true })).toBeVisible();
	await expect(page.getByRole("region", { name: /Unlink sessions/ })).toHaveCount(0);
	const box = (await source.boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 45, { steps: 8 });
	const overlay = page.locator("[data-session-drag-overlay]");
	await expect(overlay).toContainText("Venn");
	await expect(overlay.locator('[data-peel-native-source] [data-slot="human-agent-avatar"]')).toHaveAttribute("data-animated", "false");
	await expect(overlay.locator('[data-peel-capture-source] [data-slot="human-agent-avatar"]')).toHaveAttribute("data-animated", "false");
	await expect(overlay.locator('[data-peel-capture-source] [data-slot="human-agent-avatar"]')).toHaveAttribute("data-composition", "group");
	await expect(overlay.locator("[data-peel-ready=true]")).toBeAttached();
	// The paper handoff happens after the compact-card morph has completed.
	await expectHorizontalAvatarHandoff(overlay);
	expect(await overlay.locator("[data-peel-native-source] [data-session-drag-surface]").evaluate((element) => getComputedStyle(element).transform)).toBe("matrix(1, 0, 0, 1, 0, 0)");
	expect(await overlay.locator("[data-peel-native-source] [data-session-drag-label]").evaluate((element) => getComputedStyle(element).opacity)).toBe("1");
	const canvas = overlay.locator("canvas");
	const first = await canvas.screenshot();
	const identityBox = (await overlay.locator("[data-peel-native-source] [data-session-drag-identity]").boundingBox())!;
	const canvasBox = (await canvas.boundingBox())!;
	const colorfulPixels = await page.evaluate(async ({ png, identityBox, canvasBox }) => {
		const image = new Image();
		image.src = `data:image/png;base64,${png}`;
		await image.decode();
		const bitmap = document.createElement("canvas");
		bitmap.width = image.width;
		bitmap.height = image.height;
		const context = bitmap.getContext("2d")!;
		context.drawImage(image, 0, 0);
		// Ignore the source ghost behind the padding. Inside the pill, its
		// orange Claude mark and Venn's photo must survive the DOM capture.
		const scale = image.width / canvasBox.width;
		const x = Math.max(0, Math.floor((identityBox.x - canvasBox.x) * scale) - 6);
		const y = Math.max(0, Math.floor((identityBox.y - canvasBox.y) * scale) - 6);
		const width = Math.min(image.width - x, Math.ceil(identityBox.width * scale) + 12);
		const height = Math.min(image.height - y, Math.ceil(identityBox.height * scale) + 12);
		const pixels = context.getImageData(x, y, width, height).data;
		let count = 0;
		for (let i = 0; i < pixels.length; i += 4) {
			if (Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) - Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) > 30) count++;
		}
		return count;
	}, { png: first.toString("base64"), identityBox, canvasBox });
	expect(colorfulPixels).toBeGreaterThan(40);
	await page.waitForTimeout(300);
	expect((await canvas.screenshot({ path: "output/agent-browser/peel/claude-wave.png" })).equals(first)).toBe(false);
	const receiver = (await target.boundingBox())!;
	await page.mouse.move(receiver.x + receiver.width / 2, receiver.y + receiver.height / 2, { steps: 12 });
	await expect(target.locator('[data-slot="jira-issue-attach-trace"]')).toBeVisible();
	await page.screenshot({ path: "output/agent-browser/peel/claude-approach.png" });
	await page.mouse.up();
	await expect(page.locator('[data-jira-linking-variant="glow"] [data-jira-linking-flight]')).toBeVisible();
	await expect(page.getByTestId("agent-session-row-peel-claude")).toHaveCount(0);
	await expect(overlay).toHaveCount(0);
	await expect(target).toContainText("Working");
	await expect(target.locator("[data-jira-linking-glow-halo]")).toBeAttached();
	await expect(target.locator("[data-jira-linking-glow-backdrop]")).toBeAttached();
	await page.screenshot({ path: "output/agent-browser/peel/claude-link-flash.png" });
	await page.getByRole("button", { name: "Reset", exact: true }).click();
	await expect(source).toBeVisible();
	await expect(target).not.toContainText("Working");
	await expect(page.locator("[data-jira-linking-flight], [data-jira-linking-glow-halo], [data-jira-linking-glow-backdrop]")).toHaveCount(0);
});

test("outside and cancelled Claude drops leave the session detached and no preview running", async ({ page }) => {
	await page.goto(PEEL_URL, { waitUntil: "networkidle" });
	await page.getByRole("button", { name: "Agent session", exact: true }).click();
	const source = page.getByTestId("agent-session-row-peel-claude").locator("article");
	for (const cancelled of [false, true]) {
		const box = (await source.boundingBox())!;
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width / 2, box.y + box.height + 80, { steps: 6 });
		await expect(page.locator("[data-session-drag-overlay]")).toBeAttached();
		if (cancelled) {
			const receiver = (await page.getByTestId("peel-work-item").boundingBox())!;
			await page.mouse.move(receiver.x + receiver.width / 2, receiver.y + receiver.height / 2);
			await source.dispatchEvent("pointercancel", { pointerId: 1, clientX: receiver.x, clientY: receiver.y });
		}
		await page.mouse.up();
		await expect(page.locator("[data-session-drag-overlay]")).toHaveCount(0);
		await expect(source).toBeVisible();
		await expect(page.getByTestId("peel-work-item")).not.toContainText("Working");
		await expect(page.locator("[data-jira-linking-flight], [data-jira-linking-glow-halo]")).toHaveCount(0);
	}
});

test("the session menu links by keyboard and restores focus through Reset", async ({ page }) => {
	await page.goto(PEEL_URL, { waitUntil: "networkidle" });
	await page.getByRole("button", { name: "Agent session", exact: true }).click();
	const menu = page.getByRole("button", { name: /^More actions for Final readiness/ });
	await menu.focus();
	await menu.press("Enter");
	await page.getByRole("menuitem", { name: /Link work item/ }).press("ArrowRight");
	const option = page.getByRole("button", { name: /task PAY-118 Carry card-artwork/ });
	await expect(option).toBeVisible();
	await option.press("Enter");
	await expect(page.getByTestId("peel-work-item")).toContainText("Working");
	const reset = page.getByRole("button", { name: "Reset", exact: true });
	await expect(reset).toBeFocused();
	await reset.press("Enter");
	await expect(menu).toBeFocused();
});

test("a real touch drag drops Claude at mobile size", async ({ browser }) => {
	const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
	const page = await context.newPage();
	try {
		await page.goto(PEEL_URL, { waitUntil: "networkidle" });
		await page.getByRole("button", { name: "Agent session", exact: true }).click();
		const source = (await page.getByTestId("agent-session-row-peel-claude").locator("article").boundingBox())!;
		const x = source.x + source.width / 2;
		const y = source.y + source.height / 2;
		const input = await context.newCDPSession(page);
		await input.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
		await input.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + 40, y: y + 40 }] });
		await expect(page.locator("[data-session-drag-overlay]")).toContainText("Venn");
		const target = (await page.getByTestId("peel-work-item").boundingBox())!;
		await input.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: target.x + target.width / 2, y: target.y + target.height / 2 }] });
		await input.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
		await expect(page.getByTestId("peel-work-item")).toContainText("Working");
		await page.screenshot({ path: "output/agent-browser/peel/claude-mobile-linked.png" });
	} finally {
		await context.close();
	}
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`the normal Team EU26 drag forms a horizontal avatar group (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.addInitScript(() => localStorage.setItem("ui-design-variants", JSON.stringify({ sessionPeel: false, schemaVersion: 2 })));
		await page.goto(`${BASE_URL}/jira-team-eu26`, { waitUntil: "networkidle" });
		const expand = page.getByRole("button", { name: "Expand Unlink sessions column", exact: true });
		if (await expand.isVisible()) await expand.click();
		const source = page.getByTestId("agent-session-row-lw-scope-thread").locator("article");
		await expect(source).toBeVisible();
		await source.hover();
		await page.evaluate(() => {
			const frames: { composition: string | undefined; verticalGap: number; agentWidth: number }[] = [];
			Object.assign(window, { normalDragFrames: frames });
			const deadline = performance.now() + 2_000;
			const sample = () => {
				const avatar = document.querySelector<HTMLElement>('[data-session-drag-overlay] [data-slot="human-agent-avatar"]');
				const present = avatar ? [...avatar.children].find((element) => element.getAttribute("aria-hidden") !== "true") : undefined;
				const human = present?.querySelector('[data-avatar-role="human"]')?.getBoundingClientRect();
				const agent = present?.querySelector('[data-avatar-role="agent"]')?.getBoundingClientRect();
				if (human && agent) frames.push({ composition: avatar?.dataset.composition, verticalGap: Math.abs(human.y + human.height / 2 - agent.y - agent.height / 2), agentWidth: agent.width });
				if (performance.now() < deadline) requestAnimationFrame(sample);
			};
			requestAnimationFrame(sample);
		});
		const box = (await source.boundingBox())!;
		await page.mouse.down();
		await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 30);
		const overlay = page.locator("[data-session-drag-overlay]");
		await expect(overlay).toContainText("Priya Raman");
		const avatar = overlay.locator('[data-slot="human-agent-avatar"]');
		// The shared group holds its pose; the drag owner moves these same slots from the captured card.
		await expect(avatar).toHaveAttribute("data-animated", "false");
		await expect(avatar).toHaveAttribute("data-composition", "group");
		await expect.poll(async () => avatar.evaluate((root) => {
			const present = [...root.children].find((element) => element.getAttribute("aria-hidden") !== "true")!;
			const human = present.querySelector('[data-avatar-role="human"]')!.getBoundingClientRect();
			const agent = present.querySelector('[data-avatar-role="agent"]')!.getBoundingClientRect();
			return Math.max(Math.abs(human.y + human.height / 2 - agent.y - agent.height / 2), Math.abs(human.width - agent.width));
		})).toBeLessThan(0.5);
		const frames = await page.evaluate(() => (window as unknown as { normalDragFrames: { composition?: string; verticalGap: number; agentWidth: number }[] }).normalDragFrames);
		if (reducedMotion === "no-preference") {
			expect(frames.some(({ agentWidth }) => agentWidth > 29)).toBe(true);
			expect(frames.some(({ composition, agentWidth }) => composition === "group" && agentWidth > 17 && agentWidth < 29)).toBe(true);
		} else {
			expect(frames.every(({ composition, verticalGap }) => composition === "group" && verticalGap < 0.5)).toBe(true);
		}
		await expect(overlay.locator("[data-peel-surface], canvas")).toHaveCount(0);
		await expect(overlay.locator("[data-session-drag-flash-layer]")).toHaveCount(reducedMotion === "no-preference" ? 1 : 0);
		await page.screenshot({ path: `output/agent-browser/peel/team-eu26-horizontal-drag-${reducedMotion}.png` });
		await page.mouse.up();
		await expect(overlay).toHaveCount(0);
	});
}

test("the normal glow fills the source card while it contracts to the drag chip", async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem("ui-design-variants", JSON.stringify({ sessionPeel: false, schemaVersion: 2 })));
	await page.goto(`${BASE_URL}/jira-team-eu26`, { waitUntil: "networkidle" });
	const source = page.getByTestId("agent-session-row-lw-scope-thread").locator("article");
	await source.hover();
	const sourceBox = (await source.boundingBox())!;
	await page.evaluate(() => {
		const probe = { frames: [] as { t: number; x: number; y: number; width: number; height: number; opacity: number; beamX: number }[], complete: false };
		Object.assign(window, { dragFlashProbe: probe });
		const observer = new MutationObserver(() => {
			const layer = document.querySelector<HTMLElement>("[data-session-drag-overlay] [data-session-drag-flash-layer]");
			const beam = layer?.querySelector<HTMLElement>("[data-session-drag-flash-beam]");
			if (!layer || !beam) return;
			observer.disconnect();
			const start = performance.now();
			const sample = () => {
				const style = getComputedStyle(beam);
				const t = performance.now() - start;
				const box = layer.getBoundingClientRect();
				probe.frames.push({ t, x: box.x, y: box.y, width: box.width, height: box.height, opacity: Number(style.opacity), beamX: style.transform === "none" ? 0 : new DOMMatrixReadOnly(style.transform).m41 });
				if (t < 650) requestAnimationFrame(sample);
				else probe.complete = true;
			};
			requestAnimationFrame(sample);
		});
		observer.observe(document.body, { childList: true, subtree: true });
	});
	await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
	await page.mouse.down();
	await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 65, sourceBox.y + sourceBox.height / 2 + 35);
	const layer = page.locator("[data-session-drag-overlay] [data-session-drag-flash-layer]");
	await expect(layer).toBeAttached();
	const beam = layer.locator("[data-session-drag-flash-beam]");
	await expect(beam).toHaveCSS("animation-name", "session-drag-face-flash");
	await expect(beam).toHaveCSS("animation-duration", "0.55s");
	await expect(beam).not.toHaveCSS("background-image", "none");
	await expect.poll(() => page.evaluate(() => (window as unknown as { dragFlashProbe: { frames: { t: number }[] } }).dragFlashProbe.frames.some(({ t }) => t > 200))).toBe(true);
	await page.screenshot({ path: "output/agent-browser/peel/team-eu26-normal-drag-glow-mid-transition.png" });
	await expect.poll(() => page.evaluate(() => (window as unknown as { dragFlashProbe: { complete: boolean } }).dragFlashProbe.complete)).toBe(true);
	const frames = await page.evaluate(() => (window as unknown as { dragFlashProbe: { frames: { t: number; x: number; y: number; width: number; height: number; opacity: number; beamX: number }[] } }).dragFlashProbe.frames);
	const first = frames[0];
	const last = frames.at(-1)!;
	expect(first.width).toBeGreaterThan(sourceBox.width * 0.85);
	expect(first.height).toBeGreaterThan(sourceBox.height * 0.85);
	expect(Math.abs(first.x - sourceBox.x)).toBeLessThan(15);
	expect(Math.abs(first.y - sourceBox.y)).toBeLessThan(15);
	expect(first.width).toBeGreaterThan(last.width * 1.5);
	expect(frames.some(({ t, opacity }) => t < 250 && opacity > 0.8)).toBe(true);
	expect(last.opacity).toBeLessThan(0.05);
	expect(last.beamX).toBeGreaterThan(first.beamX + 30);
	await page.mouse.up();
});

for (const grab of [{ name: "avatar", x: 0.09, y: 0.5 }, { name: "title", x: 0.7, y: 0.3 }, { name: "byline", x: 0.7, y: 0.8 }]) {
	test(`dragged avatars stay on their own session's path when grabbed at the ${grab.name}`, async ({ page }) => {
		await page.addInitScript(() => localStorage.setItem("ui-design-variants", JSON.stringify({ sessionPeel: false, schemaVersion: 2 })));
		await page.goto(`${BASE_URL}/jira-team-eu26`, { waitUntil: "networkidle" });
		const source = page.getByTestId("agent-session-row-lw-scope-thread").locator("article");
		await source.hover();
		await page.evaluate(() => {
			// Slots are decorative; filter the exiting composition, rather than their own aria-hidden.
			const pose = (avatar: Element) => {
				const composition = [...avatar.children].find((element) => element.getAttribute("aria-hidden") !== "true");
				return [...(composition ?? avatar).querySelectorAll<HTMLElement>('[data-avatar-role]')].map((element) => {
					const box = element.getBoundingClientRect();
					return { role: element.dataset.avatarRole!, x: box.x + box.width / 2, y: box.y + box.height / 2, width: box.width };
				});
			};
			const sourceAvatar = document.querySelector('[data-testid="agent-session-row-lw-scope-thread"] [data-slot="human-agent-avatar"]')!;
			const probe = { source: pose(sourceAvatar), frames: [] as ReturnType<typeof pose>[], timestamps: [] as number[], complete: false };
			Object.assign(window, { avatarDragProbe: probe });
			let started = 0;
			const observer = new MutationObserver(() => {
				const avatar = document.querySelector('[data-session-drag-overlay] [data-slot="human-agent-avatar"]');
				if (!avatar || started) return;
				started = performance.now();
				observer.disconnect();
				const sample = () => {
					probe.timestamps.push(performance.now() - started);
					probe.frames.push(pose(avatar));
					if (performance.now() - started < 500) requestAnimationFrame(sample);
					else probe.complete = true;
				};
				sample();
			});
			observer.observe(document.body, { childList: true, subtree: true });
		});
		const box = (await source.boundingBox())!;
		await page.mouse.move(box.x + box.width * grab.x, box.y + box.height * grab.y);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width * grab.x + 65, box.y + box.height * grab.y + 35);
		await expect(page.locator("[data-session-drag-overlay]")).toContainText("Priya Raman");
		await expect.poll(() => page.evaluate(() => (window as unknown as { avatarDragProbe: { complete: boolean } }).avatarDragProbe.complete)).toBe(true);
		const probe = await page.evaluate(() => (window as unknown as { avatarDragProbe: { source: { role: string; x: number; y: number; width: number }[]; frames: { role: string; x: number; y: number; width: number }[][]; timestamps: number[] } }).avatarDragProbe);
		// The diagonal-to-horizontal transformation stays visibly in progress beyond the old 150ms entrance.
		expect(probe.frames.some((frame, index) => probe.timestamps[index] > 180 && probe.timestamps[index] < 300 && frame.some(({ role, width }) => role === "agent" && width > 17 && width < 29))).toBe(true);
		writeFileSync(`output/agent-browser/peel/avatar-origin-${grab.name}.json`, JSON.stringify(probe, null, 2));
		await page.screenshot({ path: `output/agent-browser/peel/avatar-origin-${grab.name}.png` });
		for (const start of probe.source) {
			const first = probe.frames[0].find(({ role }) => role === start.role)!;
			for (const dimension of ["x", "y", "width"] as const) expect(Math.abs(first[dimension] - start[dimension])).toBeLessThan(0.5);
			const end = probe.frames.at(-1)!.find(({ role }) => role === start.role)!;
			for (const frame of probe.frames) {
				const point = frame.find(({ role }) => role === start.role)!;
				for (const dimension of ["x", "y", "width"] as const) {
					expect(point[dimension], `${grab.name}: ${start.role} ${dimension}`).toBeGreaterThanOrEqual(Math.min(start[dimension], end[dimension]) - 2);
					expect(point[dimension], `${grab.name}: ${start.role} ${dimension}`).toBeLessThanOrEqual(Math.max(start[dimension], end[dimension]) + 2);
				}
			}
		}
		await page.mouse.up();
		await expect(page.locator("[data-session-drag-overlay]")).toHaveCount(0);
	});
}

test("reduced motion keeps the native Claude drag and still commits the work item drop", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(PEEL_URL, { waitUntil: "networkidle" });
	await page.getByRole("button", { name: "Agent session", exact: true }).click();
	const source = page.getByTestId("agent-session-row-peel-claude").locator("article");
	const box = (await source.boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 40);
	const overlay = page.locator("[data-session-drag-overlay]");
	await expect(overlay).toContainText("Venn");
	await expect(overlay.locator("canvas")).toHaveCount(0);
	const target = page.getByTestId("peel-work-item");
	const receiver = (await target.boundingBox())!;
	await page.mouse.move(receiver.x + receiver.width / 2, receiver.y + receiver.height / 2);
	await page.mouse.up();
	await expect(target).toContainText("Working");
	await expect(target.locator(".jira-issue-link-flash")).toHaveCount(0);
	await expect(page.locator("[data-jira-linking-flight], [data-jira-linking-glow-halo]")).toHaveCount(0);
});
