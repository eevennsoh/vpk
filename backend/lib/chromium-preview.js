const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const { createInvalidInputError, parseNavigationUrl } = require("./input-schemas");

const execFileAsync = promisify(execFile);

const BINARY_PATH = path.resolve(
	__dirname,
	"..",
	"..",
	"node_modules",
	".bin",
	process.platform === "win32" ? "agent-browser.cmd" : "agent-browser"
);

const DEFAULT_URL = "about:blank";
const DEFAULT_VIEWPORT = {
	width: 1280,
	height: 900,
};
const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;
const SCREENSHOT_DIR = path.join(os.tmpdir(), "vpk-chromium-preview");
const SCREENSHOT_PATH = path.join(SCREENSHOT_DIR, "latest.png");
const SCROLL_DIRECTIONS = new Set(["up", "down", "left", "right"]);
const PREVIEW_BACKEND_PORT = (() => {
	const rawPort = process.env.BACKEND_PORT || process.env.PORT || "8080";
	const parsedPort = Number.parseInt(String(rawPort), 10);
	return Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 8080;
})();
const PREVIEW_SESSION_NAME = `vpk-embedded-preview-${PREVIEW_BACKEND_PORT}`;
const PREVIEW_STREAM_PORT = Math.min(
	Math.max(PREVIEW_BACKEND_PORT + 1000, 1024),
	65535
);

function delay(milliseconds) {
	return new Promise((resolve) => {
		setTimeout(resolve, milliseconds);
	});
}

function clampViewportDimension(value, fallback) {
	const parsed = Number.parseInt(String(value), 10);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return fallback;
	}
	return Math.min(Math.max(parsed, 320), 3840);
}

// The one normalizer for browser-workspace and Chromium-preview navigation; the routes
// check the same rule first so a rejected URL is a 400.
function normalizeUrl(url) {
	const navigation = parseNavigationUrl(url);
	if (!navigation.ok) {
		throw createInvalidInputError(navigation.message);
	}
	return navigation.url;
}

function requireNonEmptyString(value, message) {
	if (typeof value !== "string" || !value.trim()) {
		throw new Error(message);
	}

	return value.trim();
}

function normalizeScrollDirection(direction) {
	const normalizedDirection = requireNonEmptyString(
		direction,
		"A non-empty scroll direction is required."
	).toLowerCase();

	if (!SCROLL_DIRECTIONS.has(normalizedDirection)) {
		throw new Error('Scroll direction must be one of: "up", "down", "left", "right".');
	}

	return normalizedDirection;
}

function normalizeScrollDistance(value, fallback = 300) {
	const parsed = Number.parseInt(String(value), 10);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return fallback;
	}

	return Math.min(Math.max(parsed, 1), 5000);
}

class ChromiumPreviewManager {
	constructor({ delayFn = delay } = {}) {
		this._queue = Promise.resolve();
		this._isInstalled = false;
		this._isBrowserReady = false;
		this._title = "";
		this._currentUrl = DEFAULT_URL;
		this._viewport = { ...DEFAULT_VIEWPORT };
		this._history = [DEFAULT_URL];
		this._historyIndex = 0;
		this._pendingHistoryAction = null;
		this._delay = delayFn;
		this._latestScreenshotBuffer = null;
		this._latestScreenshotContentType = "image/png";
		this._screenshotDirty = true;
		this._screenshotPromise = null;
	}

	_markScreenshotDirty() {
		this._screenshotDirty = true;
	}

	_enqueue(task) {
		const nextTask = this._queue.then(task, task);
		this._queue = nextTask.catch(() => {});
		return nextTask;
	}

	async _run(args) {
		try {
			const { stdout } = await execFileAsync(BINARY_PATH, args, {
				env: {
					...process.env,
					AGENT_BROWSER_SESSION: PREVIEW_SESSION_NAME,
					AGENT_BROWSER_STREAM_PORT: String(PREVIEW_STREAM_PORT),
				},
				maxBuffer: MAX_OUTPUT_BYTES,
			});
			return stdout.trim();
		} catch (error) {
			const message =
				error instanceof Error && error.message
					? error.message
					: "Chromium preview command failed.";
			throw new Error(message);
		}
	}

	async _ensureInstalled() {
		if (this._isInstalled) {
			return;
		}

		await this._run(["install"]);
		this._isInstalled = true;
	}

	async _applyViewport() {
		await this._run([
			"set",
			"viewport",
			String(this._viewport.width),
			String(this._viewport.height),
		]);
		this._markScreenshotDirty();
	}

	async _ensureBrowser() {
		if (this._isBrowserReady) {
			return;
		}

		await this._ensureInstalled();
		await this._run(["open", this._currentUrl]);
		await this._applyViewport();
		this._isBrowserReady = true;
		await this._delay(100);
		await this._refreshState();
	}

	_recordUrl(nextUrl) {
		if (typeof nextUrl !== "string" || !nextUrl.trim()) {
			return;
		}

		if (this._pendingHistoryAction === "back") {
			this._historyIndex = Math.max(0, this._historyIndex - 1);
		} else if (this._pendingHistoryAction === "forward") {
			this._historyIndex = Math.min(
				this._history.length - 1,
				this._historyIndex + 1
			);
		} else if (this._history[this._historyIndex] !== nextUrl) {
			this._history = this._history.slice(0, this._historyIndex + 1);
			this._history.push(nextUrl);
			this._historyIndex = this._history.length - 1;
		}

		this._pendingHistoryAction = null;
		this._currentUrl = nextUrl;
		if (this._history[this._historyIndex] !== nextUrl) {
			this._history[this._historyIndex] = nextUrl;
		}
	}

	async _refreshState() {
		await this._ensureBrowser();

		const [title, url] = await Promise.all([
			this._run(["get", "title"]).catch(() => this._title),
			this._run(["get", "url"]).catch(() => this._currentUrl),
		]);

		this._title = title;
		this._recordUrl(url || this._currentUrl);
		return this._getStateSnapshot();
	}

	_getStateSnapshot() {
		return {
			ready: this._isBrowserReady,
			title: this._title,
			url: this._currentUrl,
			viewportWidth: this._viewport.width,
			viewportHeight: this._viewport.height,
			canGoBack: this._historyIndex > 0,
			canGoForward: this._historyIndex < this._history.length - 1,
		};
	}

	getState() {
		return this._enqueue(async () => {
			return this._refreshState();
		});
	}

	navigate(url) {
		return this._enqueue(async () => {
			const normalizedUrl = normalizeUrl(url);
			this._pendingHistoryAction = "navigate";
			this._currentUrl = normalizedUrl;
			await this._ensureBrowser();
			await this._run(["open", normalizedUrl]);
			await this._delay(250);
			this._markScreenshotDirty();
			return this._refreshState();
		});
	}

	setViewport(width, height) {
		return this._enqueue(async () => {
			this._viewport = {
				width: clampViewportDimension(width, DEFAULT_VIEWPORT.width),
				height: clampViewportDimension(height, DEFAULT_VIEWPORT.height),
			};

			if (this._isBrowserReady) {
				await this._applyViewport();
				await this._delay(75);
				return this._refreshState();
			}

			return this._getStateSnapshot();
		});
	}

	goBack() {
		return this._enqueue(async () => {
			await this._ensureBrowser();
			this._pendingHistoryAction = "back";
			await this._run(["eval", "window.history.back()"]);
			await this._delay(250);
			this._markScreenshotDirty();
			return this._refreshState();
		});
	}

	goForward() {
		return this._enqueue(async () => {
			await this._ensureBrowser();
			this._pendingHistoryAction = "forward";
			await this._run(["eval", "window.history.forward()"]);
			await this._delay(250);
			this._markScreenshotDirty();
			return this._refreshState();
		});
	}

	reload() {
		return this._enqueue(async () => {
			await this._ensureBrowser();
			this._pendingHistoryAction = "reload";
			await this._run(["eval", "window.location.reload()"]);
			await this._delay(250);
			this._markScreenshotDirty();
			return this._refreshState();
		});
	}

	click(x, y) {
		return this._enqueue(async () => {
			await this._ensureBrowser();
			const resolvedX = Math.max(0, Math.round(Number(x) || 0));
			const resolvedY = Math.max(0, Math.round(Number(y) || 0));
			await this._run(["mouse", "move", String(resolvedX), String(resolvedY)]);
			await this._run(["mouse", "down", "left"]);
			await this._run(["mouse", "up", "left"]);
			await this._delay(250);
			this._markScreenshotDirty();
			return this._refreshState();
		});
	}

	clickRef(ref) {
		return this._enqueue(async () => {
			const resolvedRef = requireNonEmptyString(
				ref,
				"A non-empty accessibility ref is required."
			);
			await this._ensureBrowser();
			await this._run(["click", resolvedRef]);
			await this._delay(250);
			this._markScreenshotDirty();
			return this._refreshState();
		});
	}

	hoverRef(ref) {
		return this._enqueue(async () => {
			const resolvedRef = requireNonEmptyString(
				ref,
				"A non-empty accessibility ref is required."
			);
			await this._ensureBrowser();
			await this._run(["hover", resolvedRef]);
			await this._delay(150);
			this._markScreenshotDirty();
			return this._refreshState();
		});
	}

	fillRef(ref, text) {
		return this._enqueue(async () => {
			const resolvedRef = requireNonEmptyString(
				ref,
				"A non-empty accessibility ref is required."
			);
			if (typeof text !== "string") {
				throw new Error("A text string is required.");
			}
			await this._ensureBrowser();
			await this._run(["fill", resolvedRef, text]);
			await this._delay(150);
			this._markScreenshotDirty();
			return this._refreshState();
		});
	}

	typeRef(ref, text) {
		return this._enqueue(async () => {
			const resolvedRef = requireNonEmptyString(
				ref,
				"A non-empty accessibility ref is required."
			);
			if (typeof text !== "string") {
				throw new Error("A text string is required.");
			}
			await this._ensureBrowser();
			await this._run(["type", resolvedRef, text]);
			await this._delay(150);
			this._markScreenshotDirty();
			return this._refreshState();
		});
	}

	selectRef(ref, values) {
		return this._enqueue(async () => {
			const resolvedRef = requireNonEmptyString(
				ref,
				"A non-empty accessibility ref is required."
			);
			const resolvedValues = Array.isArray(values)
				? values
						.map((value) =>
							typeof value === "string" ? value.trim() : ""
						)
						.filter(Boolean)
				: [];
			if (resolvedValues.length === 0) {
				throw new Error("At least one select value is required.");
			}
			await this._ensureBrowser();
			await this._run(["select", resolvedRef, ...resolvedValues]);
			await this._delay(150);
			this._markScreenshotDirty();
			return this._refreshState();
		});
	}

	wheel(deltaX, deltaY) {
		return this._enqueue(async () => {
			await this._ensureBrowser();
			const resolvedDeltaX = Math.round(Number(deltaX) || 0);
			const resolvedDeltaY = Math.round(Number(deltaY) || 0);
			await this._run([
				"mouse",
				"wheel",
				String(resolvedDeltaY),
				String(resolvedDeltaX),
			]);
			await this._delay(125);
			this._markScreenshotDirty();
			return this._refreshState();
		});
	}

	scroll(direction, pixels) {
		return this._enqueue(async () => {
			const resolvedDirection = normalizeScrollDirection(direction);
			const resolvedPixels = normalizeScrollDistance(pixels);
			await this._ensureBrowser();
			await this._run([
				"scroll",
				resolvedDirection,
				String(resolvedPixels),
			]);
			await this._delay(125);
			this._markScreenshotDirty();
			return this._refreshState();
		});
	}

	press(key) {
		return this._enqueue(async () => {
			await this._ensureBrowser();
			await this._run([
				"press",
				requireNonEmptyString(key, "A keyboard key is required."),
			]);
			await this._delay(125);
			this._markScreenshotDirty();
			return this._refreshState();
		});
	}

	insertText(text) {
		return this._enqueue(async () => {
			await this._ensureBrowser();
			if (typeof text !== "string" || !text) {
				throw new Error("Text input is required.");
			}
			await this._run(["keyboard", "inserttext", text]);
			await this._delay(100);
			this._markScreenshotDirty();
			return this._refreshState();
		});
	}

	async _captureScreenshotBuffer() {
		await this._ensureBrowser();
		await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
		await this._run(["screenshot", SCREENSHOT_PATH]);
		return fs.readFile(SCREENSHOT_PATH);
	}

	getStreamConfig() {
		return {
			session: PREVIEW_SESSION_NAME,
			port: PREVIEW_STREAM_PORT,
			wsUrl: `ws://127.0.0.1:${PREVIEW_STREAM_PORT}`,
		};
	}

	async screenshot() {
		return this._enqueue(async () => {
			if (!this._screenshotDirty && this._latestScreenshotBuffer) {
				return {
					buffer: this._latestScreenshotBuffer,
					contentType: this._latestScreenshotContentType,
					state: this._getStateSnapshot(),
				};
			}

			if (!this._screenshotPromise) {
				this._screenshotPromise = (async () => {
					const buffer = await this._captureScreenshotBuffer();
					this._latestScreenshotBuffer = buffer;
					this._screenshotDirty = false;
					return buffer;
				})().finally(() => {
					this._screenshotPromise = null;
				});
			}

			const buffer = await this._screenshotPromise;
			return {
				buffer,
				contentType: this._latestScreenshotContentType,
				state: this._getStateSnapshot(),
			};
		});
	}

	snapshot(options) {
		return this._enqueue(async () => {
			await this._ensureBrowser();
			const args = ["snapshot"];
			if (options?.interactive) args.push("-i");
			const tree = await this._run(args);
			return { snapshot: tree, state: this._getStateSnapshot() };
		});
	}

	// Closes the preview browser if one was opened; queued behind in-flight commands.
	// Resolves true when it closed one, false when there was none.
	close() {
		return this._enqueue(async () => {
			if (!this._isBrowserReady) {
				return false;
			}
			this._isBrowserReady = false;
			this._latestScreenshotBuffer = null;
			this._screenshotDirty = true;
			await this._run(["close"]).catch(() => {});
			return true;
		});
	}
}

const chromiumPreviewManager = new ChromiumPreviewManager();

module.exports = {
	ChromiumPreviewManager,
	chromiumPreviewManager,
	normalizeChromiumPreviewUrl: normalizeUrl,
};
