import { expect, test, type Locator } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL;

if (!BASE_URL) {
	throw new Error("Set PLAYWRIGHT_BASE_URL to the target dev server URL.");
}

async function geometry(avatar: Locator) {
	return avatar.evaluate((frame) => {
		const rect = frame.getBoundingClientRect();
		const role = (name: string) => {
			const el = frame.querySelector(
				`[data-avatar-role="${name}"] [data-slot="avatar"]`,
			)!;
			const box = el.getBoundingClientRect();
			return { x: box.x - rect.x, y: box.y - rect.y, size: box.width };
		};
		return { size: rect.width, agent: role("agent"), human: role("human") };
	});
}

test("the default identity preserves the 32px static agent-first composition", async ({
	page,
}) => {
	await page.goto(`${BASE_URL}/preview/ui-custom/human-agent-avatar`);
	const avatar = page.getByRole("img", {
		name: "Cursor, used by Priya Raman",
		exact: true,
	});
	await expect(avatar).toHaveAttribute("data-animated", "false");
	expect(await geometry(avatar)).toEqual({
		size: 32,
		agent: { x: 0, y: 0, size: 24 },
		human: { x: 16, y: 16, size: 16 },
	});
	await expect(avatar.locator('[data-shape="hexagon"]')).toHaveCount(1);
	await expect(avatar.locator('[data-shape="circle"]')).toHaveCount(1);
	expect(
		await avatar.evaluate(
			(el) =>
				el
					.getAnimations({ subtree: true })
					.filter((animation) => animation.playState === "running").length,
		),
	).toBe(0);
	await page.setViewportSize({ width: 390, height: 844 });
	expect((await geometry(avatar)).size).toBe(32);
	await expect(avatar).toBeInViewport();
	await avatar.screenshot({
		path: "output/agent-browser/human-agent-avatar/static-mobile.png",
	});
});

test("the optional swap exchanges sizes, stays inside its frame, and returns", async ({
	page,
}) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(`${BASE_URL}/components/ui-custom/human-agent-avatar`);
	const avatar = page.locator(
		'[data-slot="human-agent-avatar"][data-animated="true"]',
	);
	await avatar.scrollIntoViewIfNeeded();
	await expect(avatar).toHaveCount(1);

	const samples = await avatar.evaluate(async (frame) => {
		const samples: {
			human: number;
			agent: number;
			humanAngle: number;
			agentAngle: number;
			contained: boolean;
		}[] = [];
		const start = performance.now();
		while (performance.now() - start < 4_800) {
			const rect = frame.getBoundingClientRect();
			const human = frame
				.querySelector('[data-avatar-role="human"] [data-slot="avatar"]')!
				.getBoundingClientRect();
			const agent = frame
				.querySelector('[data-avatar-role="agent"] [data-slot="avatar"]')!
				.getBoundingClientRect();
			samples.push({
				human: human.width,
				agent: agent.width,
				humanAngle: Math.atan2(
					human.y + human.height / 2 - rect.y - rect.height / 2,
					human.x + human.width / 2 - rect.x - rect.width / 2,
				),
				agentAngle: Math.atan2(
					agent.y + agent.height / 2 - rect.y - rect.height / 2,
					agent.x + agent.width / 2 - rect.x - rect.width / 2,
				),
				contained: [human, agent].every(
					(box) =>
						box.left >= rect.left - 0.1 &&
						box.top >= rect.top - 0.1 &&
						box.right <= rect.right + 0.1 &&
						box.bottom <= rect.bottom + 0.1,
				),
			});
			await new Promise(requestAnimationFrame);
		}
		return samples;
	});
	const swapped = samples.findIndex(
		(sample) =>
			Math.abs(sample.human - 24) < 0.1 && Math.abs(sample.agent - 16) < 0.1,
	);
	expect(swapped).toBeGreaterThan(-1);
	expect(
		samples
			.slice(swapped + 1)
			.some(
				(sample) =>
					Math.abs(sample.human - 16) < 0.1 &&
					Math.abs(sample.agent - 24) < 0.1,
			),
	).toBe(true);
	expect(samples.every((sample) => sample.contained)).toBe(true);
	for (const role of ["humanAngle", "agentAngle"] as const) {
		let rotation = 0;
		for (let index = 1; index < samples.length; index++) {
			const delta = samples[index][role] - samples[index - 1][role];
			const wrappedDelta = Math.atan2(Math.sin(delta), Math.cos(delta));
			expect(wrappedDelta).toBeGreaterThanOrEqual(-0.01);
			rotation += wrappedDelta;
		}
		expect(rotation).toBeGreaterThan(2 * Math.PI - 0.1);
	}
	await avatar.screenshot({
		path: "output/agent-browser/human-agent-avatar/animated-browser-test.png",
	});
});

test("both turns complete in 300ms with matching easing", async ({ page }) => {
	await page.goto(`${BASE_URL}/components/ui-custom/human-agent-avatar`);
	const avatar = page.locator(
		'[data-slot="human-agent-avatar"][data-animated="true"]',
	);
	await avatar.scrollIntoViewIfNeeded();
	await expect
		.poll(() =>
			avatar.evaluate((el) => el.getAnimations({ subtree: true }).length),
		)
		.toBe(4);

	const profiles = await avatar.evaluate(async (frame) => {
		const animations = frame.getAnimations({ subtree: true });
		animations.forEach((animation) => animation.pause());
		const size = (role: string) =>
			frame
				.querySelector(`[data-avatar-role="${role}"] [data-slot="avatar"]`)!
				.getBoundingClientRect().width;
		const profile = async (start: number, returning: boolean) => {
			const samples: { human: number; agent: number }[] = [];
			for (const elapsed of [0, 37.5, 75, 112.5, 150, 187.5, 225, 262.5, 300]) {
				animations.forEach((animation) => {
					animation.currentTime = start + elapsed;
				});
				await new Promise<void>((resolve) =>
					requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
				);
				samples.push({
					human: returning
						? (24 - size("human")) / 8
						: (size("human") - 16) / 8,
					agent: returning
						? (size("agent") - 16) / 8
						: (24 - size("agent")) / 8,
				});
			}
			return samples;
		};
		return {
			first: await profile(0, false),
			second: await profile(350, true),
		};
	});
	for (const role of ["human", "agent"] as const) {
		expect(profiles.first[0][role]).toBeCloseTo(0, 2);
		expect(profiles.second[0][role]).toBeCloseTo(0, 2);
		expect(profiles.first.at(-1)![role]).toBeCloseTo(1, 2);
		expect(profiles.second.at(-1)![role]).toBeCloseTo(1, 2);
		profiles.first.forEach((sample, index) =>
			expect(profiles.second[index][role]).toBeCloseTo(sample[role], 2),
		);
	}
});

test("each turn keeps moving smoothly through its midpoint", async ({
	page,
}) => {
	await page.goto(`${BASE_URL}/components/ui-custom/human-agent-avatar`);
	const avatar = page.locator(
		'[data-slot="human-agent-avatar"][data-animated="true"]',
	);
	await avatar.scrollIntoViewIfNeeded();
	await expect
		.poll(() =>
			avatar.evaluate((el) => el.getAnimations({ subtree: true }).length),
		)
		.toBe(4);
	const turns = await avatar.evaluate(async (frame) => {
		const animations = frame.getAnimations({ subtree: true });
		animations.forEach((animation) => animation.pause());
		const turns: {
			human: { x: number; y: number };
			agent: { x: number; y: number };
		}[][] = [];
		for (const start of [0, 350]) {
			const points: {
				human: { x: number; y: number };
				agent: { x: number; y: number };
			}[] = [];
			for (const elapsed of [142.5, 150, 157.5]) {
				animations.forEach((animation) => {
					animation.currentTime = start + elapsed;
				});
				await new Promise<void>((resolve) =>
					requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
				);
				const center = (role: string) => {
					const rect = frame
						.querySelector(`[data-avatar-role="${role}"] [data-slot="avatar"]`)!
						.getBoundingClientRect();
					return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
				};
				points.push({ human: center("human"), agent: center("agent") });
			}
			turns.push(points);
		}
		return turns;
	});
	for (const points of turns) {
		for (const role of ["human", "agent"] as const) {
			const incoming = {
				x: points[1][role].x - points[0][role].x,
				y: points[1][role].y - points[0][role].y,
			};
			const outgoing = {
				x: points[2][role].x - points[1][role].x,
				y: points[2][role].y - points[1][role].y,
			};
			const incomingSpeed = Math.hypot(incoming.x, incoming.y);
			const outgoingSpeed = Math.hypot(outgoing.x, outgoing.y);
			expect(incomingSpeed).toBeGreaterThan(0.1);
			expect(outgoingSpeed).toBeGreaterThan(0.1);
			expect(
				(incoming.x * outgoing.x + incoming.y * outgoing.y) /
					(incomingSpeed * outgoingSpeed),
			).toBeGreaterThan(0.98);
		}
	}
});

test("the human outline keeps its painted thickness when enlarged", async ({
	page,
}) => {
	await page.goto(`${BASE_URL}/components/ui-custom/human-agent-avatar`);
	const avatar = page.locator(
		'[data-slot="human-agent-avatar"][data-animated="true"]',
	);
	await avatar.scrollIntoViewIfNeeded();
	await expect
		.poll(() =>
			avatar.evaluate((el) => el.getAnimations({ subtree: true }).length),
		)
		.toBe(4);
	await avatar.evaluate((frame) => {
		// A contrasting background makes the white separator measurable in screenshot pixels.
		const el = frame as HTMLElement;
		Object.assign(el.style, {
			position: "fixed",
			left: "600px",
			top: "300px",
			zIndex: "9999",
			backgroundColor: "#ff00ff",
			boxShadow: "0 0 0 8px #ff00ff",
		});
		frame
			.getAnimations({ subtree: true })
			.forEach((animation) => animation.pause());
	});
	const thicknesses: number[] = [];
	for (const [name, time] of [
		["small", 0],
		["large", 300],
	] as const) {
		await avatar.evaluate(async (frame, time) => {
			frame.getAnimations({ subtree: true }).forEach((animation) => {
				animation.currentTime = time;
			});
			await new Promise<void>((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
			);
		}, time);
		const human = (await geometry(avatar)).human;
		const frame = (await avatar.boundingBox())!;
		const screenshot = await page.screenshot({
			clip: {
				x: frame.x + human.x + human.size / 2 - 1,
				y: frame.y + human.y - 4,
				width: 2,
				height: 4,
			},
			scale: "css",
			path: `output/agent-browser/human-agent-avatar/human-outline-${name}.png`,
		});
		thicknesses.push(
			await page.evaluate(async (base64) => {
				const bytes = Uint8Array.from(atob(base64), (char) =>
					char.charCodeAt(0),
				);
				const bitmap = await createImageBitmap(
					new Blob([bytes], { type: "image/png" }),
				);
				const canvas = document.createElement("canvas");
				canvas.width = bitmap.width;
				canvas.height = bitmap.height;
				const context = canvas.getContext("2d")!;
				context.drawImage(bitmap, 0, 0);
				const pixels = context.getImageData(
					0,
					0,
					canvas.width,
					canvas.height,
				).data;
				let green = 0;
				for (let index = 1; index < pixels.length; index += 4)
					green += pixels[index];
				bitmap.close();
				return green / 255 / canvas.width;
			}, screenshot.toString("base64")),
		);
	}
	expect(thicknesses[0]).toBeGreaterThan(1);
	expect(thicknesses[0]).toBeLessThan(2.5);
	expect(Math.abs(thicknesses[1] - thicknesses[0])).toBeLessThan(0.25);
});

test("the offscreen animated identity stops and restores its starting composition", async ({
	page,
}) => {
	await page.goto(`${BASE_URL}/components/ui-custom/human-agent-avatar`);
	const avatar = page.locator(
		'[data-slot="human-agent-avatar"][data-animated="true"]',
	);
	await avatar.scrollIntoViewIfNeeded();
	await expect
		.poll(async () => (await geometry(avatar)).human.size, { intervals: [16] })
		.toBeGreaterThan(16.5);
	await page
		.getByRole("heading", { name: "Human Agent Avatar", exact: true })
		.scrollIntoViewIfNeeded();
	await expect(avatar).not.toBeInViewport();
	await expect.poll(async () => (await geometry(avatar)).human.size, { intervals: [16] }).toBe(16);
	expect(
		await avatar.evaluate(
			(el) =>
				el
					.getAnimations({ subtree: true })
					.filter((animation) => animation.playState === "running").length,
		),
	).toBe(0);
});

test("pause and live reduced motion restore the static layout before restarting", async ({
	page,
}) => {
	await page.goto(`${BASE_URL}/components/ui-custom/human-agent-avatar`);
	const pause = page.getByRole("button", {
		name: "Pause animation",
		exact: true,
	});
	await pause.scrollIntoViewIfNeeded();
	await pause.focus();
	await page.keyboard.press("Enter");
	await expect(
		page.getByRole("button", { name: "Animate avatar", exact: true }),
	).toBeFocused();
	await expect(page.locator('[data-animated="true"]')).toHaveCount(0);
	await page
		.getByRole("button", { name: "Animate avatar", exact: true })
		.press("Enter");
	const animated = page.locator(
		'[data-slot="human-agent-avatar"][data-animated="true"]',
	);
	await expect(animated).toHaveCount(1);
	await expect
		.poll(async () => (await geometry(animated)).human.size, { intervals: [16] })
		.toBeGreaterThan(16.5);
	await page.emulateMedia({ reducedMotion: "reduce" });
	await expect(animated).toHaveCount(0);
	const avatar = page
		.getByRole("button", { name: "Pause animation", exact: true })
		.locator("..")
		.locator('[data-slot="human-agent-avatar"]');
	expect(await geometry(avatar)).toEqual({
		size: 32,
		agent: { x: 0, y: 0, size: 24 },
		human: { x: 16, y: 16, size: 16 },
	});
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await expect(animated).toHaveCount(1);
	expect((await geometry(animated)).human.size).toBeGreaterThanOrEqual(16);
	expect((await geometry(animated)).human.size).toBeLessThanOrEqual(24);
});

test("motion controls update the real timeline, orbit, and reusable JSON", async ({
	page,
}) => {
	await page.goto(
		`${BASE_URL}/components/ui-custom/human-agent-avatar#animated`,
	);
	const playground = page.locator("[data-human-agent-avatar-playground]");
	const avatar = playground.locator('[data-slot="human-agent-avatar"]');
	const duration = playground.getByRole("textbox", {
		name: "Turn duration",
		exact: true,
	});
	await duration.fill("500");
	await expect(duration).toBeFocused();
	await duration.press("Tab");
	await playground
		.getByRole("textbox", { name: "Initial delay", exact: true })
		.fill("0");
	await playground
		.getByRole("textbox", { name: "Pause between turns", exact: true })
		.fill("50");
	await expect
		.poll(() =>
			avatar.evaluate((el) =>
				el.getAnimations({ subtree: true }).map((animation) => ({
					duration: animation.effect!.getTiming().duration,
					delay: animation.effect!.getTiming().delay,
				})),
			),
		)
		.toEqual(Array.from({ length: 4 }, () => ({ duration: 2_250, delay: 0 })));

	await playground
		.getByRole("combobox", { name: "Easing preset", exact: true })
		.click();
	await page.getByRole("option", { name: "Custom", exact: true }).click();
	await playground
		.getByRole("textbox", { name: "Bezier X1", exact: true })
		.fill("0.2");
	await playground
		.getByRole("textbox", { name: "Size swap", exact: true })
		.fill("80");
	await playground
		.getByRole("button", { name: "Counter-clockwise", exact: true })
		.click();
	await avatar.scrollIntoViewIfNeeded();
	await expect
		.poll(() =>
			avatar.evaluate((el) => el.getAnimations({ subtree: true }).length),
		)
		.toBe(4);
	await avatar.evaluate(async (el) => {
		el.getAnimations({ subtree: true }).forEach((animation) => {
			animation.pause();
			animation.currentTime = 125;
		});
		await new Promise<void>((resolve) =>
			requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
		);
	});
	const position = await geometry(avatar);
	expect(position.agent.y).toBeGreaterThan(position.agent.x);
	await avatar.evaluate(async (el) => {
		el.getAnimations({ subtree: true }).forEach((animation) => {
			animation.currentTime = 500;
		});
		await new Promise<void>((resolve) =>
			requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
		);
	});
	expect((await geometry(avatar)).human.size).toBeCloseTo(22.4, 1);

	let copied = "";
	await page.exposeFunction(
		"captureHumanAvatarMotionValues",
		(text: string) => {
			copied = text;
		},
	);
	await page.evaluate(() =>
		Object.defineProperty(navigator.clipboard, "writeText", {
			value: (text: string) =>
				Reflect.get(window, "captureHumanAvatarMotionValues")(text),
		}),
	);
	await playground
		.getByRole("button", { name: "Copy values as JSON", exact: true })
		.click();
	await expect.poll(() => copied).not.toBe("");
	expect(JSON.parse(copied)).toMatchObject({
		durationMs: 500,
		initialDelayMs: 0,
		betweenTurnsMs: 50,
		ease: [0.2, 0, 0, 1],
		direction: "counter-clockwise",
		scaleAmount: 0.8,
		repeat: "infinite",
	});
});

test("controls preserve edits across collapse and repeat modes, then reset and replay", async ({
	page,
}) => {
	await page.goto(
		`${BASE_URL}/components/ui-custom/human-agent-avatar#animated`,
	);
	const playground = page.locator("[data-human-agent-avatar-playground]");
	const pause = playground.getByRole("button", {
		name: "Pause animation",
		exact: true,
	});
	await pause.click();
	const between = playground.getByRole("textbox", {
		name: "Pause between turns",
		exact: true,
	});
	await between.fill("-100");
	await between.press("Tab");
	await expect(between).toHaveValue("0");
	await playground
		.getByRole("button", { name: "Collapse controls", exact: true })
		.click();
	await expect(between).toHaveCount(0);
	await playground
		.getByRole("button", { name: "Expand controls", exact: true })
		.click();
	await expect(between).toHaveValue("0");
	const loop = playground.getByRole("switch", {
		name: "Loop continuously",
		exact: true,
	});
	await loop.click();
	const repeat = playground.getByRole("textbox", {
		name: "Repeat count",
		exact: true,
	});
	await repeat.fill("3");
	await loop.click();
	await expect(repeat).toHaveCount(0);
	await loop.click();
	await expect(repeat).toHaveValue("3");
	await playground
		.getByRole("button", { name: "Reset motion", exact: true })
		.click();
	await expect(between).toHaveValue("50");
	await expect(loop).toBeChecked();
	await expect(
		playground.getByRole("button", { name: "Animate avatar", exact: true }),
	).toHaveCount(1);
	await playground
		.getByRole("button", { name: "Replay avatar animation", exact: true })
		.click();
	await expect(playground.locator('[data-animated="true"]')).toHaveCount(1);
});
