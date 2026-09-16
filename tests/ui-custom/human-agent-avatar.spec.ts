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

test("12px human initials fit when the photo cannot load", async ({ page }) => {
	await page.route("**/avatar-user/ting-chen/color/asow-strategy-orange-64.png", route => route.abort());
	await page.goto(`${BASE_URL}/components/ui-custom/human-agent-avatar#sizes`);
	const fallback = page.locator('[data-human-agent-avatar-sizes] [data-avatar-size="24"] [data-avatar-role="human"] [data-slot="avatar-fallback"]');
	await expect(fallback).toHaveText("PR");
	await expect(fallback).toHaveCSS("font-size", "6px");
	const text = await fallback.evaluate(el => {
		const range = document.createRange();
		range.selectNodeContents(el);
		const rect = range.getBoundingClientRect();
		return { width: rect.width, height: rect.height };
	});
	expect(text.width).toBeLessThanOrEqual(12);
	expect(text.height).toBeLessThanOrEqual(12);
});

for (const variant of [
	{ frame: 24, agent: 24, human: 12, agentTarget: 12, inset: 0, badge: 12 },
	{ frame: 32, agent: 30, human: 16, agentTarget: 22, inset: 1, badge: 16 },
] as const) {
	test(`${variant.frame}px original swap caps the human at 24px and matches the agent downscale`, async ({ page }) => {
		await page.goto(`${BASE_URL}/components/ui-custom/human-agent-avatar#animated`);
		const playground = page.locator('[data-human-agent-avatar-playground]');
		await playground.getByRole('button', { name: `${variant.frame}×${variant.frame}`, exact: true }).click();
		const avatar = playground.locator('[data-slot="human-agent-avatar"]');
		await avatar.scrollIntoViewIfNeeded();
		await expect.poll(() => avatar.evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(4);
		let previousHuman = variant.human as number;
		let previousAgent = variant.agent as number;
		for (const time of [0, 37.5, 75, 150, 225, 300, 425, 500, 650]) {
			await avatar.evaluate(async (frame, time) => {
				frame.getAnimations({ subtree: true }).forEach(animation => { animation.pause(); animation.currentTime = time; });
				await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
			}, time);
			const pose = await geometry(avatar);
			expect(pose.size).toBe(variant.frame);
			expect(pose.human.size).toBeLessThanOrEqual(24.1);
			expect(pose.human.size).toBeGreaterThanOrEqual(variant.human - 0.1);
			expect(pose.agent.size + pose.human.size).toBeCloseTo(variant.agent + variant.human, 1);
			if (time <= 300) {
				expect(pose.human.size).toBeGreaterThanOrEqual(previousHuman - 0.1);
				expect(pose.agent.size).toBeLessThanOrEqual(previousAgent + 0.1);
			} else {
				expect(pose.human.size).toBeLessThanOrEqual(previousHuman + 0.1);
				expect(pose.agent.size).toBeGreaterThanOrEqual(previousAgent - 0.1);
			}
			previousHuman = pose.human.size;
			previousAgent = pose.agent.size;
			if (time === 0 || time === 300 || time === 650) {
				const swapped = time === 300;
				expect(pose.agent.size).toBeCloseTo(swapped ? variant.agentTarget : variant.agent, 1);
				expect(pose.human.size).toBeCloseTo(swapped ? 24 : variant.human, 1);
				expect(pose.agent.x).toBeCloseTo(swapped ? variant.frame - variant.agentTarget : variant.inset, 1);
				expect(pose.human.x).toBeCloseTo(swapped ? variant.inset : variant.badge, 1);
				const box = (await avatar.boundingBox())!;
				await page.screenshot({ path: `output/agent-browser/human-agent-avatar/capped-original-${variant.frame}-${time}.png`, clip: { x: box.x-4, y: box.y-4, width: box.width+8, height: box.height+8 } });
			}
		}
		await expect(avatar.locator('[data-avatar-role]')).toHaveCount(2);
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await expect(avatar).toHaveAttribute('data-animated', 'false');
		expect(await geometry(avatar)).toEqual({ size: variant.frame, agent: { x: variant.inset, y: variant.inset, size: variant.agent }, human: { x: variant.badge, y: variant.badge, size: variant.human } });
	});
}

for (const variant of [
	{ size: 24, agent: 24, human: 12, inset: 0, badge: 12 },
	{ size: 32, agent: 30, human: 16, inset: 1, badge: 16 },
] as const) {
	test(`${variant.size}px variant uses the existing agent avatar on desktop and mobile`, async ({ page }) => {
		await page.goto(`${BASE_URL}/components/ui-custom/human-agent-avatar#sizes`);
		const avatar = page.locator(`[data-human-agent-avatar-sizes] [data-avatar-size="${variant.size}"] [data-slot="human-agent-avatar"]`);
		for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
			await page.setViewportSize(viewport);
			await avatar.scrollIntoViewIfNeeded();
			expect(await geometry(avatar)).toEqual({
				size: variant.size,
				agent: { x: variant.inset, y: variant.inset, size: variant.agent },
				human: { x: variant.badge, y: variant.badge, size: variant.human },
			});
			const leaf = await avatar.locator('[data-slot="avatar-hexagon-artwork"]').boundingBox();
			expect(leaf!.width).toBe(variant.agent);
			expect(leaf!.height).toBe(variant.agent);
			expect(await avatar.locator('[data-slot="avatar-hexagon-artwork"]').evaluate(el => getComputedStyle(el).clipPath)).toMatch(/^polygon\(/);
			await expect(avatar.locator("clipPath")).toHaveCount(0);
			await expect(avatar.locator('[data-avatar-role="agent"] polygon')).toHaveCount(1);
			await avatar.screenshot({ path: `output/agent-browser/human-agent-avatar/figma-${variant.size}-${viewport.width}.png` });
		}
	});

}

test("24px horizontal group uses two 12px avatars and restores the compact footprint", async ({ page }) => {
	await page.goto(`${BASE_URL}/components/ui-custom/human-agent-avatar#horizontal-group`);
	const playground = page.locator('[data-human-agent-avatar-group-playground]');
	await playground.getByRole('button', { name: '24×24', exact: true }).click();
	await playground.getByRole('textbox', { name: 'Pause between turns', exact: true }).fill('1200');
	await playground.getByRole('button', { name: 'Replay avatar animation', exact: true }).click();
	const group = playground.getByRole('group', { name: 'Cursor, used by Jordan Okafor', exact: true });
	await expect(async () => {
		expect(await geometry(group)).toEqual({ size: 20, human: { x: 0, y: 0, size: 12 }, agent: { x: 8, y: 0, size: 12 } });
	}).toPass({ timeout: 10000 });
	await playground.getByRole('button', { name: 'Pause animation', exact: true }).click();
	expect(await geometry(playground.locator('[data-slot="human-agent-avatar"]'))).toEqual({ size: 24, agent: { x: 0, y: 0, size: 24 }, human: { x: 12, y: 12, size: 12 } });
});


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
		agent: { x: 1, y: 1, size: 30 },
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
		'[data-human-agent-avatar-playground] [data-slot="human-agent-avatar"][data-animated="true"]',
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
						box.right <= rect.right + 2.1 &&
						box.bottom <= rect.bottom + 2.1,
				),
			});
			await new Promise(requestAnimationFrame);
		}
		return samples;
	});
	const swapped = samples.findIndex(
		(sample) =>
			Math.abs(sample.human - 24) < 0.1 && Math.abs(sample.agent - 22) < 0.1,
	);
	expect(swapped).toBeGreaterThan(-1);
	expect(
		samples
			.slice(swapped + 1)
			.some(
				(sample) =>
					Math.abs(sample.human - 16) < 0.1 &&
					Math.abs(sample.agent - 30) < 0.1,
			),
	).toBe(true);
	expect(samples.every((sample) => sample.contained)).toBe(true);
	await avatar.screenshot({
		path: "output/agent-browser/human-agent-avatar/animated-browser-test.png",
	});
});

test("both turns complete in 300ms with matching easing", async ({ page }) => {
	await page.goto(`${BASE_URL}/components/ui-custom/human-agent-avatar`);
	const avatar = page.locator(
		'[data-human-agent-avatar-playground] [data-slot="human-agent-avatar"][data-animated="true"]',
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
						? (size("agent") - 22) / 8
						: (30 - size("agent")) / 8,
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
		'[data-human-agent-avatar-playground] [data-slot="human-agent-avatar"][data-animated="true"]',
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
			for (const elapsed of [0, 142.5, 150, 157.5, 300]) {
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
				x: points[2][role].x - points[1][role].x,
				y: points[2][role].y - points[1][role].y,
			};
			const outgoing = {
				x: points[3][role].x - points[2][role].x,
				y: points[3][role].y - points[2][role].y,
			};
			const incomingSpeed = Math.hypot(incoming.x, incoming.y);
			const outgoingSpeed = Math.hypot(outgoing.x, outgoing.y);
			// Compare motion to its travel distance so the smaller capped swap
			// has the same continuity requirement as main's larger movement.
			const minimumStep = Math.hypot(points[4][role].x - points[0][role].x, points[4][role].y - points[0][role].y) * 0.005;
			expect(incomingSpeed).toBeGreaterThan(minimumStep);
			expect(outgoingSpeed).toBeGreaterThan(minimumStep);
			expect(
				(incoming.x * outgoing.x + incoming.y * outgoing.y) /
					(incomingSpeed * outgoingSpeed),
			).toBeGreaterThan(0.98);
		}
	}
});

for (const size of [24, 32] as const) {
	test(`${size}px swap preserves main's 1px border and 2px separation ring`, async ({ page }) => {
		await page.goto(`${BASE_URL}/components/ui-custom/human-agent-avatar#animated`);
		const playground = page.locator('[data-human-agent-avatar-playground]');
		await playground.getByRole('button', { name: `${size}×${size}`, exact: true }).click();
		const avatar = playground.locator('[data-slot="human-agent-avatar"]');
		await avatar.scrollIntoViewIfNeeded();
		await expect.poll(() => avatar.evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(4);
		for (const time of [0, 75, 150, 225, 300, 425, 500, 650]) {
			const outline = await avatar.evaluate(async (frame, time) => {
				frame.getAnimations({ subtree: true }).forEach(animation => { animation.pause(); animation.currentTime = time; });
				await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
				const human = frame.querySelector('[data-avatar-role="human"] [data-slot="avatar"]') as HTMLElement;
				const scale = human.getBoundingClientRect().width / human.offsetWidth;
				const stroke = (slot: string) => parseFloat(getComputedStyle(human.querySelector(`[data-slot="${slot}"] circle`)!).strokeWidth) * scale;
				return { border: stroke("avatar-circle-border"), ring: stroke("avatar-circle-ring") / 2 };
			}, time);
			expect(outline.border).toBeCloseTo(1, 2);
			expect(outline.ring).toBeCloseTo(2, 2);
		}
		await playground.getByRole('button', { name: 'Pause animation', exact: true }).click();
		const staticHuman = playground.locator('[data-avatar-role="human"] [data-slot="avatar"]');
		const style = await staticHuman.evaluate(el => {
			const frame = el.closest('[data-slot="human-agent-avatar"]')!.getBoundingClientRect();
			const photo = el.getBoundingClientRect();
			return { border: getComputedStyle(el, "::after").borderTopWidth, ring: getComputedStyle(el).boxShadow, overhangX: photo.right + 2 - frame.right, overhangY: photo.bottom + 2 - frame.bottom };
		});
		expect(style.border).toBe("1px");
		expect(style.ring).toContain("0px 0px 0px 2px");
		expect(style.overhangX).toBe(2);
		expect(style.overhangY).toBe(2);
	});
}

test("the offscreen animated identity stops and restores its starting composition", async ({
	page,
}) => {
	await page.goto(`${BASE_URL}/components/ui-custom/human-agent-avatar`);
	const avatar = page.locator(
		'[data-human-agent-avatar-playground] [data-slot="human-agent-avatar"][data-animated="true"]',
	);
	await avatar.scrollIntoViewIfNeeded();
	await expect
		.poll(async () => (await geometry(avatar)).human.size, { intervals: [16] })
		.toBeGreaterThan(16.5);
	await page
		.getByRole("heading", { name: "Human Agent Avatar", exact: true })
		.scrollIntoViewIfNeeded();
	await expect(avatar).not.toBeInViewport();
	await expect
		.poll(async () => (await geometry(avatar)).human.size, { intervals: [16] })
		.toBe(16);
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
	const playground = page.locator("[data-human-agent-avatar-playground]");
	const pause = playground.getByRole("button", {
		name: "Pause animation",
		exact: true,
	});
	await pause.scrollIntoViewIfNeeded();
	await pause.focus();
	await page.keyboard.press("Enter");
	await expect(
		playground.getByRole("button", { name: "Animate avatar", exact: true }),
	).toBeFocused();
	await expect(playground.locator('[data-animated="true"]')).toHaveCount(0);
	await playground
		.getByRole("button", { name: "Animate avatar", exact: true })
		.press("Enter");
	const animated = page.locator(
		'[data-human-agent-avatar-playground] [data-slot="human-agent-avatar"][data-animated="true"]',
	);
	await expect(animated).toHaveCount(1);
	await expect
		.poll(async () => (await geometry(animated)).human.size, {
			intervals: [16],
		})
		.toBeGreaterThan(16.5);
	await page.emulateMedia({ reducedMotion: "reduce" });
	await expect(animated).toHaveCount(0);
	const avatar = playground
		.getByRole("button", { name: "Pause animation", exact: true })
		.locator("..")
		.locator('[data-slot="human-agent-avatar"]');
	expect(await geometry(avatar)).toEqual({
		size: 32,
		agent: { x: 1, y: 1, size: 30 },
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

test("horizontal-group variation morphs into the shared human-first 16px group", async ({
	page,
}) => {
	await page.goto(
		`${BASE_URL}/components/ui-custom/human-agent-avatar#horizontal-group`,
	);
	const playground = page.locator("[data-human-agent-avatar-group-playground]");
	await playground
		.getByRole("textbox", { name: "Pause between turns", exact: true })
		.fill("1200");
	const frame = playground.locator('[data-slot="human-agent-avatar"]');
	await frame.scrollIntoViewIfNeeded();
	await playground
		.getByRole("button", { name: "Replay avatar animation", exact: true })
		.click();
	const widths = await frame.evaluate(async (el) => {
		const widths: number[] = [];
		const start = performance.now();
		while (performance.now() - start < 1_100) {
			const agent = el.querySelector(
				'[data-slot="avatar-group"] [data-avatar-role="agent"] [data-slot="avatar"]',
			);
			if (agent) widths.push(agent.getBoundingClientRect().width);
			await new Promise(requestAnimationFrame);
		}
		return widths;
	});
	expect(widths.some((width) => width > 16.2 && width < 23.8)).toBe(true);
	const group = playground.getByRole("group", {
		name: "Cursor, used by Jordan Okafor",
		exact: true,
	});
	await expect(group).toHaveAttribute("data-slot", "avatar-group");
	await expect(async () => {
		const position = await geometry(group);
		expect(position).toEqual({
			size: 28,
			human: { x: 0, y: 0, size: 16 },
			agent: { x: 12, y: 0, size: 16 },
		});
	}).toPass({ timeout: 10_000 });
	const avatarSizes = await group
		.locator('[data-slot="avatar"]')
		.evaluateAll((avatars) =>
			avatars.map((avatar) => {
				const { width, height } = avatar.getBoundingClientRect();
				return { width, height };
			}),
		);
	expect(avatarSizes).toEqual([
		{ width: 16, height: 16 },
		{ width: 16, height: 16 },
	]);
	expect(
		await group
			.locator("[data-avatar-role]")
			.evaluateAll((avatars) =>
				avatars.map((el) => el.getAttribute("data-avatar-role")),
			),
	).toEqual(["human", "agent"]);
	expect(await frame.evaluate((el) => el.getBoundingClientRect().width)).toBe(
		32,
	);
	await group.screenshot({
		path: "output/agent-browser/human-agent-avatar/horizontal-group.png",
	});

	await playground
		.getByRole("button", { name: "Pause animation", exact: true })
		.click();
	await expect(playground.locator('[data-animated="true"]')).toHaveCount(0);
	const compact = playground.locator('[data-slot="human-agent-avatar"]');
	expect(await geometry(compact)).toEqual({
		size: 32,
		agent: { x: 1, y: 1, size: 30 },
		human: { x: 16, y: 16, size: 16 },
	});
	await page.emulateMedia({ reducedMotion: "reduce" });
	await playground
		.getByRole("button", { name: "Animate avatar", exact: true })
		.click();
	await expect(playground.locator('[data-animated="true"]')).toHaveCount(0);
	expect(await geometry(compact)).toEqual({
		size: 32,
		agent: { x: 1, y: 1, size: 30 },
		human: { x: 16, y: 16, size: 16 },
	});
});

test("the original playground can select the horizontal-group variation", async ({
	page,
}) => {
	await page.goto(
		`${BASE_URL}/components/ui-custom/human-agent-avatar#animated`,
	);
	const playground = page.locator("[data-human-agent-avatar-playground]");
	await playground
		.getByRole("button", { name: "Horizontal group", exact: true })
		.click();
	const frame = playground.locator('[data-slot="human-agent-avatar"]');
	await expect(frame).toHaveAttribute(
		"data-animation-variant",
		"horizontal-group",
	);
	await expect(
		playground.getByRole("textbox", { name: "Orbit curvature", exact: true }),
	).toHaveCount(0);
	await playground.getByRole("button", { name: "Orbit", exact: true }).click();
	await expect(
		playground.getByRole("textbox", { name: "Orbit curvature", exact: true }),
	).toHaveValue("2");
});
