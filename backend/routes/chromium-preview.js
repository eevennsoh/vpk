"use strict";

const express = require("express");

const { getNonEmptyString } = require("../lib/shared-utils");
const { INVALID_INPUT_CODE, parseNavigationUrl } = require("../lib/input-schemas");
const { sendError } = require("../middleware/error-response");

const REQUIRED_MANAGER_METHODS = [
	"click",
	"clickRef",
	"fillRef",
	"getState",
	"getStreamConfig",
	"goBack",
	"goForward",
	"hoverRef",
	"insertText",
	"navigate",
	"press",
	"reload",
	"screenshot",
	"scroll",
	"selectRef",
	"setViewport",
	"snapshot",
	"typeRef",
	"wheel",
];

function getErrorMessage(error, fallback) {
	return error instanceof Error ? error.message : fallback;
}

function validateChromiumPreviewManager(manager) {
	if (!manager || typeof manager !== "object") {
		throw new Error("createChromiumPreviewRouter requires chromiumPreviewManager");
	}

	for (const method of REQUIRED_MANAGER_METHODS) {
		if (typeof manager[method] !== "function") {
			throw new Error(`createChromiumPreviewRouter requires chromiumPreviewManager.${method}`);
		}
	}
}

function createChromiumPreviewRouter({
	chromiumPreviewManager,
	getString = getNonEmptyString,
	logger = console,
} = {}) {
	validateChromiumPreviewManager(chromiumPreviewManager);
	if (typeof getString !== "function") {
		throw new Error("createChromiumPreviewRouter requires getString");
	}

	const router = express.Router();

	router.get("/", async (_req, res) => {
		try {
			const state = await chromiumPreviewManager.getState();
			return res.json(state);
		} catch (error) {
			logger.error?.("[CHROMIUM-PREVIEW] State error:", error);
			return res.status(500).json({
				error: getErrorMessage(error, "Failed to read Chromium preview state"),
			});
		}
	});

	router.get("/stream", async (_req, res) => {
		try {
			return res.json({
				enabled: true,
				...chromiumPreviewManager.getStreamConfig(),
			});
		} catch (error) {
			logger.error?.("[CHROMIUM-PREVIEW] Stream config error:", error);
			return res.status(500).json({
				error: getErrorMessage(error, "Failed to read Chromium preview stream config"),
			});
		}
	});

	router.post("/", async (req, res) => {
		try {
			const url = getString(req.body?.url);
			if (!url) {
				return res.status(400).json({
					error: "A non-empty url field is required.",
				});
			}
			const navigation = parseNavigationUrl(url);
			if (!navigation.ok) {
				return sendError(res, 400, INVALID_INPUT_CODE, navigation.message);
			}

			const state = await chromiumPreviewManager.navigate(url);
			return res.json(state);
		} catch (error) {
			logger.error?.("[CHROMIUM-PREVIEW] Navigate error:", error);
			return res.status(500).json({
				error: getErrorMessage(error, "Failed to navigate Chromium preview"),
			});
		}
	});

	router.post("/viewport", async (req, res) => {
		try {
			const width = req.body?.width;
			const height = req.body?.height;
			const state = await chromiumPreviewManager.setViewport(width, height);
			return res.json(state);
		} catch (error) {
			logger.error?.("[CHROMIUM-PREVIEW] Viewport error:", error);
			return res.status(500).json({
				error: getErrorMessage(error, "Failed to resize Chromium preview"),
			});
		}
	});

	router.post("/back", async (_req, res) => {
		try {
			const state = await chromiumPreviewManager.goBack();
			return res.json(state);
		} catch (error) {
			logger.error?.("[CHROMIUM-PREVIEW] Back error:", error);
			return res.status(500).json({
				error: getErrorMessage(error, "Failed to go back in Chromium preview"),
			});
		}
	});

	router.post("/forward", async (_req, res) => {
		try {
			const state = await chromiumPreviewManager.goForward();
			return res.json(state);
		} catch (error) {
			logger.error?.("[CHROMIUM-PREVIEW] Forward error:", error);
			return res.status(500).json({
				error: getErrorMessage(error, "Failed to go forward in Chromium preview"),
			});
		}
	});

	router.post("/reload", async (_req, res) => {
		try {
			const state = await chromiumPreviewManager.reload();
			return res.json(state);
		} catch (error) {
			logger.error?.("[CHROMIUM-PREVIEW] Reload error:", error);
			return res.status(500).json({
				error: getErrorMessage(error, "Failed to reload Chromium preview"),
			});
		}
	});

	router.post("/click", async (req, res) => {
		try {
			const state = await chromiumPreviewManager.click(req.body?.x, req.body?.y);
			return res.json(state);
		} catch (error) {
			logger.error?.("[CHROMIUM-PREVIEW] Click error:", error);
			return res.status(500).json({
				error: getErrorMessage(error, "Failed to click inside Chromium preview"),
			});
		}
	});

	router.post("/click-ref", async (req, res) => {
		try {
			const ref = getString(req.body?.ref);
			if (!ref) {
				return res.status(400).json({
					error: "A non-empty ref field is required.",
				});
			}

			const state = await chromiumPreviewManager.clickRef(ref);
			return res.json(state);
		} catch (error) {
			logger.error?.("[CHROMIUM-PREVIEW] Click ref error:", error);
			return res.status(500).json({
				error: getErrorMessage(error, "Failed to click Chromium preview ref"),
			});
		}
	});

	router.post("/hover-ref", async (req, res) => {
		try {
			const ref = getString(req.body?.ref);
			if (!ref) {
				return res.status(400).json({
					error: "A non-empty ref field is required.",
				});
			}

			const state = await chromiumPreviewManager.hoverRef(ref);
			return res.json(state);
		} catch (error) {
			logger.error?.("[CHROMIUM-PREVIEW] Hover ref error:", error);
			return res.status(500).json({
				error: getErrorMessage(error, "Failed to hover Chromium preview ref"),
			});
		}
	});

	router.post("/fill-ref", async (req, res) => {
		try {
			const ref = getString(req.body?.ref);
			if (!ref) {
				return res.status(400).json({
					error: "A non-empty ref field is required.",
				});
			}

			if (typeof req.body?.text !== "string") {
				return res.status(400).json({
					error: "A text string is required.",
				});
			}

			const state = await chromiumPreviewManager.fillRef(ref, req.body.text);
			return res.json(state);
		} catch (error) {
			logger.error?.("[CHROMIUM-PREVIEW] Fill ref error:", error);
			return res.status(500).json({
				error: getErrorMessage(error, "Failed to fill Chromium preview ref"),
			});
		}
	});

	router.post("/type-ref", async (req, res) => {
		try {
			const ref = getString(req.body?.ref);
			if (!ref) {
				return res.status(400).json({
					error: "A non-empty ref field is required.",
				});
			}

			if (typeof req.body?.text !== "string") {
				return res.status(400).json({
					error: "A text string is required.",
				});
			}

			const state = await chromiumPreviewManager.typeRef(ref, req.body.text);
			return res.json(state);
		} catch (error) {
			logger.error?.("[CHROMIUM-PREVIEW] Type ref error:", error);
			return res.status(500).json({
				error: getErrorMessage(error, "Failed to type into Chromium preview ref"),
			});
		}
	});

	router.post("/select-ref", async (req, res) => {
		try {
			const ref = getString(req.body?.ref);
			if (!ref) {
				return res.status(400).json({
					error: "A non-empty ref field is required.",
				});
			}

			const values = Array.isArray(req.body?.values)
				? req.body.values.filter((value) => typeof value === "string")
				: [];
			if (values.length === 0) {
				return res.status(400).json({
					error: "A non-empty values array is required.",
				});
			}

			const state = await chromiumPreviewManager.selectRef(ref, values);
			return res.json(state);
		} catch (error) {
			logger.error?.("[CHROMIUM-PREVIEW] Select ref error:", error);
			return res.status(500).json({
				error: getErrorMessage(error, "Failed to select Chromium preview ref value"),
			});
		}
	});

	router.post("/scroll", async (req, res) => {
		try {
			const direction = getString(req.body?.direction);
			if (!direction) {
				return res.status(400).json({
					error: "A non-empty direction field is required.",
				});
			}

			const state = await chromiumPreviewManager.scroll(
				direction,
				req.body?.pixels
			);
			return res.json(state);
		} catch (error) {
			logger.error?.("[CHROMIUM-PREVIEW] Scroll error:", error);
			return res.status(500).json({
				error: getErrorMessage(error, "Failed to scroll Chromium preview"),
			});
		}
	});

	router.post("/wheel", async (req, res) => {
		try {
			const state = await chromiumPreviewManager.wheel(
				req.body?.deltaX,
				req.body?.deltaY
			);
			return res.json(state);
		} catch (error) {
			logger.error?.("[CHROMIUM-PREVIEW] Wheel error:", error);
			return res.status(500).json({
				error: getErrorMessage(error, "Failed to scroll Chromium preview"),
			});
		}
	});

	router.post("/press", async (req, res) => {
		try {
			const key = getString(req.body?.key);
			if (!key) {
				return res.status(400).json({
					error: "A non-empty key field is required.",
				});
			}

			const state = await chromiumPreviewManager.press(key);
			return res.json(state);
		} catch (error) {
			logger.error?.("[CHROMIUM-PREVIEW] Press error:", error);
			return res.status(500).json({
				error: getErrorMessage(error, "Failed to send a key to Chromium preview"),
			});
		}
	});

	router.post("/type", async (req, res) => {
		try {
			const text = getString(req.body?.text);
			if (!text) {
				return res.status(400).json({
					error: "A non-empty text field is required.",
				});
			}

			const state = await chromiumPreviewManager.insertText(text);
			return res.json(state);
		} catch (error) {
			logger.error?.("[CHROMIUM-PREVIEW] Type error:", error);
			return res.status(500).json({
				error: getErrorMessage(error, "Failed to type into Chromium preview"),
			});
		}
	});

	router.get("/snapshot", async (req, res) => {
		try {
			const interactive = req.query.interactive === "true";
			const result = await chromiumPreviewManager.snapshot({ interactive });
			return res.json(result);
		} catch (error) {
			logger.error?.("[CHROMIUM-PREVIEW] Snapshot error:", error);
			return res.status(500).json({
				error: getErrorMessage(error, "Failed to capture Chromium preview snapshot"),
			});
		}
	});

	router.get("/screenshot", async (req, res) => {
		try {
			const width = Array.isArray(req.query.width)
				? req.query.width[0]
				: req.query.width;
			const height = Array.isArray(req.query.height)
				? req.query.height[0]
				: req.query.height;

			if (width || height) {
				await chromiumPreviewManager.setViewport(width, height);
			}

			const screenshot = await chromiumPreviewManager.screenshot();
			res.setHeader("Content-Type", screenshot.contentType);
			res.setHeader("Cache-Control", "no-store");
			return res.send(screenshot.buffer);
		} catch (error) {
			logger.error?.("[CHROMIUM-PREVIEW] Screenshot error:", error);
			return res.status(500).json({
				error: getErrorMessage(error, "Failed to capture Chromium preview screenshot"),
			});
		}
	});

	return router;
}

function registerChromiumPreviewRoutes(app, dependencies) {
	app.use("/api/chromium-preview", createChromiumPreviewRouter(dependencies));
}

module.exports = {
	createChromiumPreviewRouter,
	registerChromiumPreviewRoutes,
	validateChromiumPreviewManager,
};
