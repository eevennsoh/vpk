const assert = require("node:assert/strict");
const test = require("node:test");

const {
	createStudioScreenAssistantRegion,
	createStudioScreenAssistantSnapshot,
	activateStudioScreenAssistantTarget,
	getStudioScreenAssistantRegionRect,
	getStudioScreenAssistantRegionTargetHints,
	getStudioScreenAssistantPointerContext,
	getStudioScreenAssistantVisibleTargets,
	getViewportPointFromScreenAssistantTarget,
	groundStudioScreenAssistantTarget,
} = require("./screen-assistant.ts");

function createFakeElement({
	attrs = {},
	height = 20,
	id = "",
	text = "",
	width = 100,
	x = 0,
	y = 0,
	tagName = "button",
	onClick,
}) {
	return {
		id,
		innerText: text,
		tagName: tagName.toUpperCase(),
		textContent: text,
		click() {
			onClick?.();
		},
		getAttribute(name) {
			return attrs[name] ?? null;
		},
		getBoundingClientRect() {
			return {
				height,
				width,
				x,
				y,
			};
		},
		scrollIntoView() {},
	};
}

function getFakeElementAttr(element, name) {
	return element.getAttribute?.(name) ?? null;
}

function getQuotedAttributeValue(selector, attribute) {
	const escapedAttribute = attribute.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
	const match = selector.match(new RegExp(`\\[${escapedAttribute}="([^"]+)"\\]`, "u"));
	return match?.[1] ?? null;
}

function fakeElementMatchesSelector(element, selector) {
	const screenTarget = getQuotedAttributeValue(selector, "data-screen-assistant-target");
	if (screenTarget && getFakeElementAttr(element, "data-screen-assistant-target") === screenTarget) {
		return true;
	}

	const testId = getQuotedAttributeValue(selector, "data-testid");
	if (testId && getFakeElementAttr(element, "data-testid") === testId) {
		return true;
	}

	const id = getQuotedAttributeValue(selector, "id");
	if (id && element.id === id) {
		return true;
	}

	const fieldId = getQuotedAttributeValue(selector, "data-agent-field");
	return Boolean(fieldId && getFakeElementAttr(element, "data-agent-field") === fieldId);
}

function withFakeDom({ elements, pointerElement }, callback) {
	const previousDocument = global.document;
	const previousWindow = global.window;

	global.window = {
		innerHeight: 720,
		innerWidth: 1280,
		scrollX: 10,
		scrollY: 20,
		getComputedStyle() {
			return {
				display: "block",
				opacity: "1",
				visibility: "visible",
			};
		},
	};
	global.document = {
		elementFromPoint() {
			return pointerElement ?? null;
		},
		getElementById() {
			return null;
		},
		querySelectorAll() {
			return elements;
		},
		querySelector(selector) {
			return elements.find((element) => fakeElementMatchesSelector(element, selector)) ?? null;
		},
	};

	try {
		return callback();
	} finally {
		global.document = previousDocument;
		global.window = previousWindow;
	}
}

test("collects visible Studio screen assistant targets from DOM metadata", () => {
	const nameElement = createFakeElement({
		attrs: {
			"data-agent-field": "name",
			"data-screen-assistant-target": "studio-agent-config:name",
		},
		text: "Support Agent",
		x: 20,
		y: 30,
	});
	const hiddenElement = createFakeElement({
		attrs: {
			"data-screen-assistant-target": "hidden",
		},
		height: 0,
		text: "Hidden",
		width: 0,
	});

	withFakeDom({ elements: [nameElement, hiddenElement], pointerElement: null }, () => {
		assert.deepEqual(getStudioScreenAssistantVisibleTargets(), [
			{
				fieldId: "name",
				id: "studio-agent-config:name",
				label: "Support Agent",
				rect: {
					height: 20,
					width: 100,
					x: 20,
					y: 30,
				},
				role: "button",
			},
		]);
	});
});

test("extracts pointer context from elementFromPoint", () => {
	const pointerElement = createFakeElement({
		attrs: {
			"aria-label": "Start live voice",
			"data-screen-assistant-target": "studio-composer:voice",
		},
		x: 100,
		y: 200,
	});

	withFakeDom({ elements: [], pointerElement }, () => {
		assert.deepEqual(getStudioScreenAssistantPointerContext({ x: 110, y: 210 }), {
			x: 110,
			y: 210,
			viewport: {
				height: 720,
				scrollX: 10,
				scrollY: 20,
				width: 1280,
			},
			target: {
				id: "studio-composer:voice",
				label: "Start live voice",
				rect: {
					height: 20,
					width: 100,
					x: 100,
					y: 200,
				},
				role: "button",
			},
		});
	});
});

test("grounds targets by id, field, and label", () => {
	const visibleTargets = [
		{
			fieldId: "instructions",
			id: "studio-agent-config:instructions",
			label: "Instructions",
			rect: { height: 100, width: 400, x: 40, y: 80 },
		},
		{
			fieldId: "tools",
			id: "studio-agent-config:tools",
			label: "Add tools",
			rect: { height: 44, width: 180, x: 40, y: 220 },
		},
		{
			id: "top-navigation:studio-logo",
			label: "Open Studio",
			rect: { height: 32, width: 96, x: 92, y: 12 },
		},
		{
			fieldId: "name",
			id: "studio-agent-config:name",
			label: "RFP Drafter",
			rect: { height: 40, width: 220, x: 40, y: 20 },
		},
		{
			fieldId: "description",
			id: "studio-agent-config:description",
			label: "Drafts first-pass RFP response packages",
			rect: { height: 32, width: 320, x: 40, y: 60 },
		},
		{
			fieldId: "avatar",
			id: "studio-agent-config:avatar",
			label: "Change agent avatar",
			rect: { height: 48, width: 42, x: 40, y: 8 },
		},
	];
	const pointerTarget = {
		id: "pointer-target",
		label: "Pointer fallback",
		rect: { height: 20, width: 20, x: 1, y: 2 },
	};

	assert.equal(
		groundStudioScreenAssistantTarget({
			id: "studio-agent-config:tools",
			pointerTarget,
			visibleTargets,
		}),
		visibleTargets[1],
	);
	assert.equal(
		groundStudioScreenAssistantTarget({
			fieldId: "instructions",
			pointerTarget,
			visibleTargets,
		}),
		visibleTargets[0],
	);
	assert.equal(
		groundStudioScreenAssistantTarget({
			label: "tools",
			pointerTarget,
			visibleTargets,
		}),
		visibleTargets[1],
	);
	assert.equal(
		groundStudioScreenAssistantTarget({
			label: "Studio logo",
			pointerTarget,
			visibleTargets,
		}),
		visibleTargets[2],
	);
	assert.equal(
		groundStudioScreenAssistantTarget({
			label: "agent name",
			pointerTarget,
			visibleTargets,
		}),
		visibleTargets[3],
	);
	assert.equal(
		groundStudioScreenAssistantTarget({
			id: "studio-agent-config:description",
			label: "agent name",
			pointerTarget,
			visibleTargets,
		}),
		visibleTargets[4],
	);
	assert.equal(
		groundStudioScreenAssistantTarget({
			fieldId: "description",
			label: "agent name",
			pointerTarget,
			visibleTargets,
		}),
		visibleTargets[4],
	);
	assert.equal(
		groundStudioScreenAssistantTarget({
			label: "agent avatar",
			pointerTarget,
			visibleTargets,
		}),
		visibleTargets[5],
	);
	assert.equal(
		groundStudioScreenAssistantTarget({
			fieldId: "description",
			label: "agent avatar",
			pointerTarget,
			visibleTargets,
		}),
		visibleTargets[4],
	);
	assert.equal(
		groundStudioScreenAssistantTarget({
			label: "missing",
			pointerTarget,
			visibleTargets,
		}),
		null,
	);
});

test("activates visible targets by every snapshot id source", () => {
	const clicked = [];
	const testIdElement = createFakeElement({
		attrs: { "data-testid": "agent-menu-trigger" },
		text: "Open agent menu",
		x: 20,
		y: 20,
		onClick: () => clicked.push("testid"),
	});
	const domIdElement = createFakeElement({
		id: "agent-help-link",
		tagName: "a",
		text: "Open help",
		x: 20,
		y: 60,
		onClick: () => clicked.push("dom-id"),
	});
	const autoElement = createFakeElement({
		text: "Open avatar picker",
		x: 20,
		y: 100,
		onClick: () => clicked.push("auto"),
	});

	withFakeDom({ elements: [testIdElement, domIdElement, autoElement], pointerElement: null }, () => {
		const visibleTargets = getStudioScreenAssistantVisibleTargets();
		assert.deepEqual(
			visibleTargets.map((target) => target.id),
			["agent-menu-trigger", "agent-help-link", "auto:button-open-avatar-picker"],
		);

		assert.deepEqual(
			activateStudioScreenAssistantTarget({ id: "agent-menu-trigger", visibleTargets }),
			{
				activated: {
					id: "agent-menu-trigger",
					label: "Open agent menu",
				},
				ok: true,
			},
		);
		assert.deepEqual(
			activateStudioScreenAssistantTarget({ id: "agent-help-link", visibleTargets }),
			{
				activated: {
					id: "agent-help-link",
					label: "Open help",
				},
				ok: true,
			},
		);
		assert.deepEqual(
			activateStudioScreenAssistantTarget({
				id: "auto:button-open-avatar-picker",
				visibleTargets,
			}),
			{
				activated: {
					label: "Open avatar picker",
				},
				ok: true,
			},
		);
	});

	assert.deepEqual(clicked, ["testid", "dom-id", "auto"]);
});

test("creates painted screen regions from freeform paths and target intersections", () => {
	const visibleTargets = [
		{
			fieldId: "avatar",
			id: "studio-agent-config:avatar",
			label: "Change agent avatar",
			rect: { height: 48, width: 48, x: 40, y: 40 },
		},
		{
			fieldId: "name",
			id: "studio-agent-config:name",
			label: "RFP Drafter",
			rect: { height: 32, width: 220, x: 120, y: 40 },
		},
	];
	const path = [
		{ x: 20, y: 20 },
		{ x: 100, y: 25 },
		{ x: 110, y: 110 },
		{ x: 24, y: 120 },
	];

	assert.deepEqual(getStudioScreenAssistantRegionRect(path), {
		height: 100,
		width: 90,
		x: 20,
		y: 20,
	});
	assert.deepEqual(
		getStudioScreenAssistantRegionTargetHints({
			rect: { height: 100, width: 90, x: 20, y: 20 },
			visibleTargets,
		}),
		[visibleTargets[0]],
	);
	assert.deepEqual(createStudioScreenAssistantRegion({
		createdAt: 123,
		id: "screen-region-test",
		path,
		visibleTargets,
	}), {
		createdAt: 123,
		id: "screen-region-test",
		label: "Painted screen area",
		path,
		rect: {
			height: 100,
			width: 90,
			x: 20,
			y: 20,
		},
		targetHints: [visibleTargets[0]],
	});
	assert.equal(createStudioScreenAssistantRegion({
		id: "too-small",
		path: [{ x: 1, y: 1 }, { x: 2, y: 2 }],
		visibleTargets,
	}), null);
});

test("creates an instructions target hint when painting over the instructions body", () => {
	const visibleTargets = [
		{
			fieldId: "instructions",
			id: "studio-agent-config:instructions",
			label: "Agent instructions",
			rect: { height: 260, width: 720, x: 320, y: 180 },
		},
		{
			fieldId: "description",
			id: "studio-agent-config:description",
			label: "Agent description",
			rect: { height: 48, width: 720, x: 320, y: 112 },
		},
	];
	const region = createStudioScreenAssistantRegion({
		createdAt: 456,
		id: "screen-region-instructions",
		path: [
			{ x: 344, y: 210 },
			{ x: 640, y: 236 },
			{ x: 700, y: 370 },
			{ x: 360, y: 400 },
		],
		visibleTargets,
	});

	assert.ok(region);
	assert.deepEqual(region.targetHints, [visibleTargets[0]]);
	assert.equal(region.targetHints[0]?.fieldId, "instructions");
	assert.equal(region.targetHints[0]?.id, "studio-agent-config:instructions");
});

test("includes activeRegion in screen snapshots and uses region target hints for pointing", () => {
	const visibleTargets = [
		{
			fieldId: "avatar",
			id: "studio-agent-config:avatar",
			label: "Change agent avatar",
			rect: { height: 48, width: 48, x: 40, y: 40 },
		},
	];
	const activeRegion = createStudioScreenAssistantRegion({
		createdAt: 123,
		id: "screen-region-test",
		path: [
			{ x: 20, y: 20 },
			{ x: 100, y: 25 },
			{ x: 110, y: 110 },
		],
		visibleTargets,
	});

	assert.ok(activeRegion);
	withFakeDom({ elements: [], pointerElement: null }, () => {
		assert.equal(
			createStudioScreenAssistantSnapshot({
				activePanel: "agent-config",
				activeRegion,
			}).activeRegion,
			activeRegion,
		);
	});
	assert.equal(
		groundStudioScreenAssistantTarget({
			activeRegion,
			label: "this area",
			pointerTarget: null,
			visibleTargets: [],
		}),
		visibleTargets[0],
	);
	assert.equal(
		groundStudioScreenAssistantTarget({
			activeRegion,
			label: "this area",
			pointerTarget: null,
			visibleTargets: [
				{
					fieldId: "name",
					id: "studio-agent-config:name",
					label: "Agent name",
					rect: { height: 32, width: 220, x: 120, y: 40 },
				},
			],
		}),
		visibleTargets[0],
	);
});

test("grounds to pointer fallback only when no explicit locator is provided", () => {
	const visibleTargets = [
		{
			id: "studio-agent-config:tools",
			label: "Add tools",
			rect: { height: 44, width: 180, x: 40, y: 220 },
		},
	];
	const pointerTarget = {
		id: "pointer-target",
		label: "Pointer fallback",
		rect: { height: 20, width: 20, x: 1, y: 2 },
	};

	assert.equal(
		groundStudioScreenAssistantTarget({
			pointerTarget,
			visibleTargets,
		}),
		pointerTarget,
	);
});

test("a grounded target's viewport point is its centre, labelled by label, field id or id", () => {
	const rect = { height: 20, width: 100, x: 10, y: 40 };
	assert.deepEqual(getViewportPointFromScreenAssistantTarget({ fieldId: "name", label: "Agent name", rect }), { coordinateSpace: "viewport", label: "Agent name", x: 60, y: 50 });
	assert.equal(getViewportPointFromScreenAssistantTarget({ fieldId: "name", id: "agent-name", rect }).label, "name");
	assert.equal(getViewportPointFromScreenAssistantTarget({ id: "agent-name", rect }).label, "agent-name");
	assert.equal(getViewportPointFromScreenAssistantTarget({ rect }).label, "Target");
	assert.equal(getViewportPointFromScreenAssistantTarget({ label: "No rect" }), null);
	assert.equal(getViewportPointFromScreenAssistantTarget(null), null);
});
