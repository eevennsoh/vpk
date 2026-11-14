const test = require("node:test");
const assert = require("node:assert/strict");

const {
	createBodyOnlySpec,
	parseGenerativeWidget,
	resolveGenerativeWidgetMetadata,
} = require("./generative-widget.ts");
const {
	enrichGenerativeWidgetProfilePhotos,
} = require("./generative-widget-profile-photos.ts");

test("createBodyOnlySpec removes empty translated card lead-in section and separator", () => {
	const spec = {
		root: "root",
		elements: {
			root: {
				type: "Stack",
				props: { direction: "vertical", gap: "md" },
				children: ["original-section", "separator", "translated-section"],
			},
			"original-section": {
				type: "Stack",
				props: { direction: "vertical", gap: "sm" },
				children: ["original-heading", "original-text"],
			},
			"original-heading": {
				type: "Heading",
				props: { text: "Original (English)", level: "h4", className: null },
			},
			"original-text": {
				type: "Text",
				props: { content: "I want ice cream please", muted: null },
			},
			separator: {
				type: "Separator",
				props: { orientation: "horizontal" },
			},
			"translated-section": {
				type: "Stack",
				props: { direction: "vertical", gap: "sm" },
				children: ["translated-heading", "translated-text"],
			},
			"translated-heading": {
				type: "Heading",
				props: {
					text: "Translated (Chinese (Simplified))",
					level: "h4",
					className: "text-sm font-semibold",
				},
			},
			"translated-text": {
				type: "Heading",
				props: { text: "我想吃冰淇淋", level: "h4", className: "text-lg font-medium" },
			},
		},
	};

	const widget = {
		type: "genui-preview",
		spec,
		source: null,
	};

	const result = createBodyOnlySpec(widget);

	assert.deepEqual(result.elements.root.children, ["translated-section"]);
	assert.equal(result.elements["original-section"], undefined);
	assert.equal(result.elements["original-heading"], undefined);
	assert.equal(result.elements["original-text"], undefined);
	assert.equal(result.elements.separator, undefined);
	assert.equal(result.elements["translated-section"].type, "Stack");
});

test("createBodyOnlySpec normalizes translation heading and body typography", () => {
	const spec = {
		root: "root",
		elements: {
			root: {
				type: "Stack",
				props: { direction: "vertical", gap: "md" },
				children: ["original-section", "separator", "translated-section"],
			},
			"original-section": {
				type: "Stack",
				props: { direction: "vertical", gap: "sm" },
				children: ["original-heading", "original-text"],
			},
			"original-heading": {
				type: "Heading",
				props: { text: "Original (English)", level: "h4", className: null },
			},
			"original-text": {
				type: "Text",
				props: { content: "I want ice cream", muted: null },
			},
			separator: {
				type: "Separator",
				props: { orientation: "horizontal" },
			},
			"translated-section": {
				type: "Stack",
				props: { direction: "vertical", gap: "sm" },
				children: ["translated-heading", "translated-text"],
			},
			"translated-heading": {
				type: "Heading",
				props: {
					text: "Translated (Chinese (Simplified))",
					level: "h4",
					className: null,
				},
			},
			"translated-text": {
				type: "Text",
				props: { content: "我想吃冰淇淋", muted: true, size: "sm" },
			},
		},
	};

	const widget = {
		type: "genui-preview",
		spec,
		source: null,
	};

	const result = createBodyOnlySpec(widget);

	assert.equal(result.elements["translated-heading"].props.level, "h4");
	assert.equal(
		result.elements["translated-heading"].props.className,
		"text-sm font-semibold"
	);
	assert.equal(result.elements["translated-text"].type, "Heading");
	assert.equal(result.elements["translated-text"].props.level, "h4");
	assert.equal(
		result.elements["translated-text"].props.className,
		"text-lg font-medium"
	);
	assert.equal(result.elements["translated-text"].props.text, "我想吃冰淇淋");
});

test("createBodyOnlySpec normalizes usage notes spacing to md gap", () => {
	const spec = {
		root: "root",
		elements: {
			root: {
				type: "Stack",
				props: { direction: "vertical", gap: "lg" },
				children: ["translation-card", "usage-notes-card"],
			},
			"translation-card": {
				type: "Card",
				props: {
					title: "English → Mandarin Chinese",
				},
				children: ["translation-text"],
			},
			"translation-text": {
				type: "Text",
				props: {
					content: "生日快乐",
					muted: null,
				},
			},
			"usage-notes-card": {
				type: "Card",
				props: {
					title: "Usage Notes",
				},
				children: ["usage-notes-text"],
			},
			"usage-notes-text": {
				type: "Text",
				props: {
					content: "This is the standard birthday greeting in Mandarin.",
					muted: null,
				},
			},
		},
	};

	const widget = {
		type: "genui-preview",
		spec,
		source: null,
	};

	const result = createBodyOnlySpec(widget);

	assert.equal(result.elements.root.props.gap, "md");
});

test("createBodyOnlySpec reuses the same transformed spec for identical widget input", () => {
	const spec = {
		root: "root",
		elements: {
			root: {
				type: "Stack",
				props: { direction: "vertical", gap: "md" },
				children: ["title", "description", "cta", "body"],
			},
			title: {
				type: "Heading",
				props: { text: "Hermes Features", level: "h3" },
			},
			description: {
				type: "Text",
				props: {
					content: "Persistent capabilities available across sessions in VPK",
				},
			},
			cta: {
				type: "Button",
				props: { label: "Export" },
			},
			body: {
				type: "Text",
				props: { content: "Rendered body content" },
			},
		},
	};

	const widget = {
		type: "genui-preview",
		body: {
			kind: "json-render",
			spec,
		},
		title: "Hermes Features",
		description: "Persistent capabilities available across sessions in VPK",
		source: null,
	};

	const firstResult = createBodyOnlySpec(widget);
	const secondResult = createBodyOnlySpec(widget);

	assert.strictEqual(secondResult, firstResult);
});

test("createBodyOnlySpec keeps meaningful separators between remaining sections", () => {
	const spec = {
		root: "root",
		elements: {
			root: {
				type: "Stack",
				props: { direction: "vertical", gap: "md" },
				children: [
					"context-section",
					"separator-main",
					"target-section",
					"separator-tail",
					"content-section",
				],
			},
			"context-section": {
				type: "Stack",
				props: { direction: "vertical", gap: "sm" },
				children: ["context-heading", "context-text"],
			},
			"context-heading": {
				type: "Heading",
				props: { text: "Original content", level: "h4", className: null },
			},
			"context-text": {
				type: "Text",
				props: {
					content: "This description is intentionally long enough.",
					muted: null,
				},
			},
			"separator-main": {
				type: "Separator",
				props: { orientation: "horizontal" },
			},
			"target-section": {
				type: "Stack",
				props: { direction: "vertical", gap: "sm" },
				children: ["target-heading", "target-text"],
			},
			"target-heading": {
				type: "Heading",
				props: { text: "Target section", level: "h4", className: null },
			},
			"target-text": {
				type: "Text",
				props: { content: "Target body text", muted: null },
			},
			"separator-tail": {
				type: "Separator",
				props: { orientation: "horizontal" },
			},
			"content-section": {
				type: "Stack",
				props: { direction: "vertical", gap: "sm" },
				children: ["content-heading", "content-text"],
			},
			"content-heading": {
				type: "Heading",
				props: { text: "Content section", level: "h4", className: null },
			},
			"content-text": {
				type: "Text",
				props: { content: "Body content", muted: null },
			},
		},
	};

	const widget = {
		type: "genui-preview",
		spec,
		source: null,
	};

	const result = createBodyOnlySpec(widget);

	assert.deepEqual(result.elements.root.children, [
		"target-section",
		"separator-tail",
		"content-section",
	]);
	assert.equal(result.elements["separator-main"], undefined);
	assert.equal(result.elements["separator-tail"].type, "Separator");
});

test("createBodyOnlySpec falls back to original spec when root would be removed", () => {
	const spec = {
		root: "header-root",
		elements: {
			"header-root": {
				type: "Heading",
				props: { text: "Only title", level: "h2", className: null },
			},
		},
	};

	const widget = {
		type: "genui-preview",
		spec,
		source: null,
	};

	const result = createBodyOnlySpec(widget);

	assert.equal(result, spec);
});

test("createBodyOnlySpec falls back to original spec when widget elements are missing", () => {
	const spec = {
		root: "root",
		elements: null,
	};

	const widget = {
		type: "genui-preview",
		spec,
		source: null,
	};

	const result = createBodyOnlySpec(widget);

	assert.equal(result, spec);
});

test("resolveGenerativeWidgetMetadata infers calendar content type from card text", () => {
	const widget = parseGenerativeWidget("genui-preview", {
		spec: {
			root: "root",
			elements: {
				root: {
					type: "Stack",
					props: { direction: "vertical", gap: "md" },
					children: ["summary-card"],
				},
				"summary-card": {
					type: "Card",
					props: {
						title: "Google Calendar Events",
						description: "Next 7 days",
					},
					children: [],
				},
			},
		},
	});

	assert.ok(widget);
	const metadata = resolveGenerativeWidgetMetadata(widget);
	assert.equal(metadata.contentType, "calendar");
});

test("calendar inference overrides generic text contentType hints", () => {
	const widget = parseGenerativeWidget("genui-preview", {
		contentType: "text",
		spec: {
			root: "root",
			elements: {
				root: {
					type: "Stack",
					props: { direction: "vertical", gap: "md" },
					children: ["summary-card"],
				},
				"summary-card": {
					type: "Card",
					props: {
						title: "Google Calendar Events",
						description: "Upcoming meetings",
					},
					children: [],
				},
			},
		},
	});

	assert.ok(widget);
	const metadata = resolveGenerativeWidgetMetadata(widget);
	assert.equal(metadata.contentType, "calendar");
});

test("resolveGenerativeWidgetMetadata infers translation content type from title", () => {
	const widget = parseGenerativeWidget("genui-preview", {
		spec: {
			root: "root",
			elements: {
				root: {
					type: "Stack",
					props: { direction: "vertical", gap: "md" },
					children: ["summary-card"],
				},
				"summary-card": {
					type: "Card",
					props: {
						title: "Translation",
						description: "English to Mandarin Chinese",
					},
					children: [],
				},
			},
		},
	});

	assert.ok(widget);
	const metadata = resolveGenerativeWidgetMetadata(widget);
	assert.equal(metadata.contentType, "translation");
});

test("resolveGenerativeWidgetMetadata infers message content type from Slack title", () => {
	const widget = parseGenerativeWidget("genui-preview", {
		spec: {
			root: "root",
			elements: {
				root: {
					type: "Stack",
					props: { direction: "vertical", gap: "md" },
					children: ["summary-card"],
				},
				"summary-card": {
					type: "Card",
					props: {
						title: "Send Slack Message",
						description: "Fill in the channel and message, then click Send Message.",
					},
					children: [],
				},
			},
		},
	});

	assert.ok(widget);
	const metadata = resolveGenerativeWidgetMetadata(widget);
	assert.equal(metadata.contentType, "message");
});

test("resolveGenerativeWidgetMetadata infers work-item content type from work summary title", () => {
	const widget = parseGenerativeWidget("genui-preview", {
		spec: {
			root: "root",
			elements: {
				root: {
					type: "Stack",
					props: { direction: "vertical", gap: "md" },
					children: ["summary-card"],
				},
				"summary-card": {
					type: "Card",
					props: {
						title: "Work Summary — Last 7 Days",
						description: "Recent Jira issues and Confluence activity.",
					},
					children: [],
				},
			},
		},
	});

	assert.ok(widget);
	const metadata = resolveGenerativeWidgetMetadata(widget);
	assert.equal(metadata.contentType, "work-item");
});

test("explicit widgetContentType hint takes precedence for message cards", () => {
	const widget = parseGenerativeWidget("genui-preview", {
		widgetContentType: "message",
		spec: {
			root: "root",
			elements: {
				root: {
					type: "Stack",
					props: { direction: "vertical", gap: "md" },
					children: ["summary-card"],
				},
				"summary-card": {
					type: "Card",
					props: {
						title: "Generated content",
						description: "Tool results",
					},
					children: [],
				},
			},
		},
	});

	assert.ok(widget);
	const metadata = resolveGenerativeWidgetMetadata(widget);
	assert.equal(metadata.contentType, "message");
});

test("parseGenerativeWidget strips leaked system instructions from card metadata text", () => {
	const widget = parseGenerativeWidget("genui-preview", {
		summary: "[System Instructions] You are a UI generator that outputs JSON.",
		spec: {
			root: "root",
			elements: {
				root: {
					type: "Stack",
					props: { direction: "vertical", gap: "md" },
					children: ["summary-card"],
				},
				"summary-card": {
					type: "Card",
					props: {
						title: "Today's Calendar",
						description:
							"[System Instructions] You are a UI generator that outputs JSON.",
					},
					children: [],
				},
			},
		},
	});

	assert.ok(widget);
	assert.equal(widget.summary, undefined);
	assert.equal(widget.body.spec.elements["summary-card"].props.description, undefined);

	const metadata = resolveGenerativeWidgetMetadata(widget);
	assert.equal(metadata.title, "Today's Calendar");
	assert.equal(metadata.description, "Generated from your request");
});

test("parseGenerativeWidget keeps trailing metadata after system instructions wrapper", () => {
	const widget = parseGenerativeWidget("genui-preview", {
		description:
			"[System Instructions]\nInternal prompt\n[End System Instructions]\nUpcoming events from Google Calendar.",
		spec: {
			root: "root",
			elements: {
				root: {
					type: "Stack",
					props: { direction: "vertical", gap: "md" },
					children: ["summary-card"],
				},
				"summary-card": {
					type: "Card",
					props: {
						title: "Google Calendar",
						description:
							"[System Instructions]\nInternal prompt\n[End System Instructions]\nUpcoming events from Google Calendar.",
					},
					children: [],
				},
			},
		},
	});

	assert.ok(widget);
	assert.equal(widget.description, "Upcoming events from Google Calendar.");
	assert.equal(
		widget.body.spec.elements["summary-card"].props.description,
		"Upcoming events from Google Calendar."
	);

	const metadata = resolveGenerativeWidgetMetadata(widget);
	assert.equal(metadata.description, "Upcoming events from Google Calendar.");
});

test("resolveGenerativeWidgetMetadata derives dynamic description from WorkSummary data", () => {
	const widget = parseGenerativeWidget("genui-preview", {
		spec: {
			root: "root",
			elements: {
				root: {
					type: "Stack",
					props: { direction: "vertical", gap: "md" },
					children: ["summary-card", "work-summary-content"],
				},
				"summary-card": {
					type: "Card",
					props: {
						title: "Work Summary — Last 7 Days",
						description:
							"[System Instructions] You are a UI generator that outputs JSON.",
					},
					children: [],
				},
				"work-summary-content": {
					type: "WorkSummary",
					props: {
						jiraItems: [{ key: "A-1" }, { key: "A-2" }, { key: "A-3" }],
						confluencePages: [{ title: "Roadmap" }],
					},
					children: [],
				},
			},
		},
	});

	assert.ok(widget);
	const metadata = resolveGenerativeWidgetMetadata(widget);
	assert.equal(metadata.description, "3 Jira work items and 1 Confluence page found.");
});

test("resolveGenerativeWidgetMetadata derives dynamic description from CalendarTimeline data", () => {
	const widget = parseGenerativeWidget("genui-preview", {
		spec: {
			root: "root",
			elements: {
				root: {
					type: "Stack",
					props: { direction: "vertical", gap: "md" },
					children: ["summary-card", "calendar-events"],
				},
				"summary-card": {
					type: "Card",
					props: {
						title: "Today's Calendar",
						description:
							"[System Instructions] You are a UI generator that outputs JSON.",
					},
					children: [],
				},
				"calendar-events": {
					type: "CalendarTimeline",
					props: {
						events: [{ title: "Standup" }, { title: "Planning" }],
					},
					children: [],
				},
			},
		},
	});

	assert.ok(widget);
	const metadata = resolveGenerativeWidgetMetadata(widget);
	assert.equal(metadata.description, "2 calendar events in this timeline.");
});

test("resolveGenerativeWidgetMetadata derives dynamic description from Metric data", () => {
	const widget = parseGenerativeWidget("genui-preview", {
		spec: {
			root: "root",
			elements: {
				root: {
					type: "Stack",
					props: { direction: "vertical", gap: "md" },
					children: ["summary-card", "metrics"],
				},
				"summary-card": {
					type: "Card",
					props: {
						title: "Work Summary — Last 7 Days",
						description:
							"[System Instructions] You are a UI generator that outputs JSON.",
					},
					children: [],
				},
				metrics: {
					type: "Metric",
					props: {
						title: "Work Items",
						value: "5",
					},
					children: [],
				},
			},
		},
	});

	assert.ok(widget);
	const metadata = resolveGenerativeWidgetMetadata(widget);
	assert.equal(metadata.description, "Work Items: 5");
});

test("resolveGenerativeWidgetMetadata includes generated button labels for footer actions", () => {
	const widget = parseGenerativeWidget("genui-preview", {
		primaryActionLabel: "Edit in Confluence",
		actions: {
			primary: {
				label: "Edit in Confluence",
				href: "https://example.atlassian.net/wiki/spaces/TEST/pages/123/edit",
			},
			secondary: {
				label: "View Page",
				href: "https://example.atlassian.net/wiki/spaces/TEST/pages/123",
			},
		},
		spec: {
			root: "root",
			elements: {
				root: {
					type: "Stack",
					props: { direction: "vertical", gap: "md" },
					children: ["content", "actions"],
				},
				content: {
					type: "Text",
					props: { content: "Page created successfully." },
				},
				actions: {
					type: "Stack",
					props: { direction: "horizontal", gap: "sm" },
					children: ["edit-button", "view-button"],
				},
				"edit-button": {
					type: "Button",
					props: { label: "Edit in Confluence", variant: "default" },
				},
				"view-button": {
					type: "Button",
					props: { label: "View Page", variant: "outline" },
				},
			},
		},
	});

	assert.ok(widget);
	const metadata = resolveGenerativeWidgetMetadata(widget);
	assert.equal(metadata.primaryActionLabel, "Edit in Confluence");
	assert.deepEqual(metadata.actions, [
		{
			label: "Edit in Confluence",
			href: "https://example.atlassian.net/wiki/spaces/TEST/pages/123/edit",
		},
		{
			label: "View Page",
			href: "https://example.atlassian.net/wiki/spaces/TEST/pages/123",
		},
	]);
	assert.deepEqual(metadata.actionLabels, ["Edit in Confluence", "View Page"]);
});

test("resolveGenerativeWidgetMetadata hydrates view/edit links from a single known external URL", () => {
	const widget = parseGenerativeWidget("genui-preview", {
		primaryActionLabel: "Edit in Confluence",
		externalUrl: "https://example.atlassian.net/wiki/spaces/TEST/pages/789",
		spec: {
			root: "root",
			elements: {
				root: {
					type: "Stack",
					props: { direction: "vertical", gap: "md" },
					children: ["edit-button", "view-button"],
				},
				"edit-button": {
					type: "Button",
					props: { label: "Edit in Confluence", variant: "default" },
				},
				"view-button": {
					type: "Button",
					props: { label: "View Page", variant: "outline" },
				},
			},
		},
	});

	assert.ok(widget);
	const metadata = resolveGenerativeWidgetMetadata(widget);
	assert.deepEqual(metadata.actions, [
		{
			label: "Edit in Confluence",
			href: "https://example.atlassian.net/wiki/spaces/TEST/pages/789",
		},
		{
			label: "View Page",
			href: "https://example.atlassian.net/wiki/spaces/TEST/pages/789",
		},
	]);
});

test("createBodyOnlySpec removes generated action button stacks from card body", () => {
	const spec = {
		root: "root",
		elements: {
			root: {
				type: "Stack",
				props: { direction: "vertical", gap: "md" },
				children: ["summary", "action-row"],
			},
			summary: {
				type: "Text",
				props: { content: "Ready." },
			},
			"action-row": {
				type: "Stack",
				props: { direction: "horizontal", gap: "sm" },
				children: ["edit-button", "view-button"],
			},
			"edit-button": {
				type: "Button",
				props: { label: "Edit in Confluence", variant: "default" },
			},
			"view-button": {
				type: "Button",
				props: { label: "View Page", variant: "outline" },
			},
		},
	};

	const widget = {
		type: "genui-preview",
		spec,
		source: null,
	};

	const result = createBodyOnlySpec(widget);
	assert.deepEqual(result.elements.root.children, ["summary"]);
	assert.equal(result.elements["action-row"], undefined);
	assert.equal(result.elements["edit-button"], undefined);
	assert.equal(result.elements["view-button"], undefined);
});

test("enrichGenerativeWidgetProfilePhotos injects a discoverable Atlassian headshot into the profile avatar", () => {
	const widget = {
		type: "genui-preview",
		body: {
			kind: "json-render",
			spec: {
				root: "main",
				elements: {
					main: {
						type: "Stack",
						props: { gap: "md", padding: 0 },
						children: ["header"],
					},
					header: {
						type: "Stack",
						props: { direction: "horizontal", gap: "md", align: "center" },
						children: ["avatar", "title-stack"],
					},
					avatar: {
						type: "Avatar",
						props: { fallback: "DH", size: "xl", shape: "circle" },
					},
					"title-stack": {
						type: "Stack",
						props: { gap: "sm" },
						children: ["name", "role"],
					},
					name: {
						type: "Heading",
						props: { text: "David Hoang", level: "h2" },
						children: [],
					},
					role: {
						type: "Text",
						props: { content: "Head of Design, Rovo & AI, Jira, Ecosystem" },
					},
				},
			},
		},
		source: null,
	};
	const headshotUrl =
		"https://hello.atlassian.net/wiki/pages/viewpageattachments.action?pageId=6450653554&preview=%2F6450653554%2F6538248503%2FDavid+Hoang+headshot.png";

	const result = enrichGenerativeWidgetProfilePhotos(widget, [
		{
			toolName: "atlassian_search",
			state: "completed",
			output: {
				searchResponse: `- title: David Hoang headshot.png\n  url: ${headshotUrl}`,
			},
			outputPreview: `Found David Hoang headshot.png at ${headshotUrl}`,
		},
	]);

	assert.notStrictEqual(result, widget);
	assert.equal(result.body.spec.elements.avatar.props.src, headshotUrl);
	assert.equal(widget.body.spec.elements.avatar.props.src, undefined);
});

test("enrichGenerativeWidgetProfilePhotos preserves an existing avatar src", () => {
	const widget = {
		type: "genui-preview",
		body: {
			kind: "json-render",
			spec: {
				root: "main",
				elements: {
					main: {
						type: "Stack",
						props: { gap: "md", padding: 0 },
						children: ["header"],
					},
					header: {
						type: "Stack",
						props: { direction: "horizontal", gap: "md", align: "center" },
						children: ["avatar", "title-stack"],
					},
					avatar: {
						type: "Avatar",
						props: {
							src: "https://example.com/already-present.png",
							fallback: "DH",
							size: "xl",
							shape: "circle",
						},
					},
					"title-stack": {
						type: "Stack",
						props: { gap: "sm" },
						children: ["name"],
					},
					name: {
						type: "Heading",
						props: { text: "David Hoang", level: "h2" },
						children: [],
					},
				},
			},
		},
		source: null,
	};

	const result = enrichGenerativeWidgetProfilePhotos(widget, [
		{
			toolName: "atlassian_search",
			state: "completed",
			outputPreview:
				"Found David Hoang headshot.png at https://hello.atlassian.net/wiki/download/attachments/1/David+Hoang+headshot.png",
		},
	]);

	assert.strictEqual(result, widget);
	assert.equal(
		result.body.spec.elements.avatar.props.src,
		"https://example.com/already-present.png",
	);
});

test("enrichGenerativeWidgetProfilePhotos ignores non-profile cards with avatars", () => {
	const widget = {
		type: "genui-preview",
		body: {
			kind: "json-render",
			spec: {
				root: "main",
				elements: {
					main: {
						type: "Stack",
						props: { gap: "md", padding: 0 },
						children: ["header"],
					},
					header: {
						type: "Stack",
						props: { direction: "horizontal", gap: "md", align: "center" },
						children: ["avatar", "title"],
					},
					avatar: {
						type: "Avatar",
						props: { fallback: "KP", size: "xl", shape: "circle" },
					},
					title: {
						type: "Heading",
						props: { text: "Key Partners", level: "h3" },
						children: [],
					},
				},
			},
		},
		source: null,
	};

	const result = enrichGenerativeWidgetProfilePhotos(widget, [
		{
			toolName: "atlassian_search",
			state: "completed",
			outputPreview:
				"Found David Hoang headshot.png at https://hello.atlassian.net/wiki/download/attachments/1/David+Hoang+headshot.png",
		},
	]);

	assert.strictEqual(result, widget);
	assert.equal(result.body.spec.elements.avatar.props.src, undefined);
});

test("parseGenerativeWidget normalizes legacy audio widgets into the shared preview envelope", () => {
	const widget = parseGenerativeWidget("audio-preview", {
		audioUrl: "https://example.com/voice.mp3",
		transcript: "hello world",
		title: "Narration",
	});

	assert.ok(widget);
	assert.equal(widget.type, "genui-preview");
	assert.equal(widget.body.kind, "audio");
	assert.equal(widget.body.audioUrl, "https://example.com/voice.mp3");
	assert.equal(widget.body.transcript, "hello world");
});

test("parseGenerativeWidget normalizes direct video widgets into the shared preview envelope", () => {
	const widget = parseGenerativeWidget("video-preview", {
		videoUrl: "/api/rovo/generated-media?path=media%2Fvideos%2Fdemo.mp4",
		mimeType: "video/mp4",
		fileName: "demo.mp4",
		title: "Render result",
	});

	assert.ok(widget);
	assert.equal(widget.type, "genui-preview");
	assert.equal(widget.body.kind, "video");
	assert.equal(
		widget.body.videoUrl,
		"/api/rovo/generated-media?path=media%2Fvideos%2Fdemo.mp4",
	);
	assert.equal(widget.body.mimeType, "video/mp4");
	assert.equal(widget.body.fileName, "demo.mp4");
});

test("parseGenerativeWidget infers inline video playback from json-render widgets", () => {
	const widget = parseGenerativeWidget("genui-preview", {
		spec: {
			root: "main",
			elements: {
				main: {
					type: "Card",
					props: { title: "Output file", description: "Rendered video" },
					children: ["path"],
				},
				path: {
					type: "Code",
					props: { text: "media/videos/tmp/demo/VPKRovoVideo.mp4" },
					children: [],
				},
			},
		},
	});

	assert.ok(widget);
	assert.equal(widget.type, "genui-preview");
	assert.equal(widget.body.kind, "video");
	assert.equal(
		widget.body.videoUrl,
		"/api/rovo/generated-media?path=media%2Fvideos%2Ftmp%2Fdemo%2FVPKRovoVideo.mp4",
	);
	assert.equal(widget.body.fileName, "VPKRovoVideo.mp4");
	assert.equal(widget.title, "Output file");
	assert.equal(widget.description, "Rendered video");
});

test("parseGenerativeWidget accepts explicit excalidraw body payloads", () => {
	const widget = parseGenerativeWidget("genui-preview", {
		title: "Architecture diagram",
		body: {
			kind: "excalidraw",
			scene: {
				type: "excalidraw",
				version: 2,
				elements: [{ id: "node-1", type: "rectangle", x: 0, y: 0 }],
			},
		},
	});

	assert.ok(widget);
	assert.equal(widget.type, "genui-preview");
	assert.equal(widget.body.kind, "excalidraw");
	assert.equal(widget.body.scene.type, "excalidraw");
	assert.equal(widget.body.scene.elements.length, 1);
});

// One parser serves widget bodies and artifact files (artifact-preview.ts). Widgets used to
// keep array appState/files; Excalidraw reads both as records, so arrays are now dropped.
test("parseGenerativeWidget drops array appState and files from excalidraw scenes", () => {
	const widget = parseGenerativeWidget("genui-preview", {
		title: "Architecture diagram",
		body: {
			kind: "excalidraw",
			scene: {
				elements: [{ id: "node-1", type: "rectangle", x: 0, y: 0 }],
				appState: ["viewBackgroundColor"],
				files: [{ id: "file-1" }],
			},
		},
	});

	assert.equal(widget.body.kind, "excalidraw");
	assert.deepEqual(widget.body.scene, { elements: [{ id: "node-1", type: "rectangle", x: 0, y: 0 }] });
});

test("parseGenerativeWidget keeps object appState and files on excalidraw scenes", () => {
	const widget = parseGenerativeWidget("genui-preview", {
		title: "Architecture diagram",
		body: {
			kind: "excalidraw",
			scene: {
				elements: [],
				appState: { viewBackgroundColor: "#fff" },
				files: { "file-1": { id: "file-1" } },
			},
		},
	});

	assert.deepEqual(widget.body.scene.appState, { viewBackgroundColor: "#fff" });
	assert.deepEqual(widget.body.scene.files, { "file-1": { id: "file-1" } });
});
