"use strict";

const express = require("express");

const { isBrowserWorkspaceLimitError } = require("../lib/browser-workspace-lifecycle");
const { getNonEmptyString } = require("../lib/shared-utils");

const REQUIRED_MANAGER_METHODS = [
	"activateWorkspaceTab",
	"clickWorkspace",
	"clickWorkspaceRef",
	"closeWorkspaceTab",
	"createWorkspace",
	"createWorkspacePreviewSession",
	"createWorkspaceTab",
	"deleteWorkspace",
	"deleteWorkspacePreviewSession",
	"fillWorkspaceRef",
	"getWorkspaceScreenshot",
	"getWorkspaceSnapshot",
	"getWorkspaceState",
	"getWorkspaceStream",
	"getWorkspaceTabs",
	"goBack",
	"goForward",
	"hoverWorkspaceRef",
	"listWorkspaces",
	"navigateWorkspace",
	"pressWorkspaceKey",
	"reloadWorkspace",
	"resizeWorkspace",
	"scrollWorkspace",
	"selectWorkspaceRef",
	"typeWorkspaceRef",
	"typeWorkspaceText",
	"wheelWorkspace",
];

function resolveBrowserWorkspaceId(request, getString = getNonEmptyString) {
	return getString(request.params?.workspaceId);
}

function resolveBrowserWorkspaceTabIndex(request) {
	const parsedIndex = Number.parseInt(String(request.params?.tabIndex ?? ""), 10);
	return Number.isInteger(parsedIndex) && parsedIndex >= 0 ? parsedIndex : null;
}

function sendBrowserWorkspaceError(response, error, fallbackMessage, {
	isBrowserWorkspaceNotFoundError,
} = {}) {
	const message =
		error instanceof Error && error.message
			? error.message
			: fallbackMessage;
	// Gone (missing, closing, closed, crashed) is 404, which the client answers by
	// creating a new workspace; the live-workspace cap is 503.
	const statusCode =
		isBrowserWorkspaceNotFoundError(error) ||
		(typeof message === "string" &&
			message.startsWith("Browser workspace not found:"))
			? 404
			: isBrowserWorkspaceLimitError(error)
				? 503
				: 500;

	return response.status(statusCode).json({
		error: message,
	});
}

function logBrowserWorkspaceError(label, error, {
	isBrowserWorkspaceNotFoundError,
	logger = console,
} = {}) {
	if (isBrowserWorkspaceNotFoundError(error)) {
		const message =
			error instanceof Error && error.message
				? error.message
				: "Browser workspace not found.";
		logger.warn?.(`${label}: ${message}`);
		return;
	}

	logger.error?.(`${label}:`, error);
}

function validateBrowserWorkspaceManager(manager) {
	if (!manager || typeof manager !== "object") {
		throw new Error("createBrowserWorkspacesRouter requires browserWorkspaceManager");
	}

	for (const method of REQUIRED_MANAGER_METHODS) {
		if (typeof manager[method] !== "function") {
			throw new Error(`createBrowserWorkspacesRouter requires browserWorkspaceManager.${method}`);
		}
	}
}

function createBrowserWorkspacesRouter({
	appendRuntimeSocketToken,
	browserWorkspaceManager,
	getMirrorBrowser = () => null,
	getString = getNonEmptyString,
	isBrowserWorkspaceNotFoundError,
	logger = console,
	runtimePort,
} = {}) {
	validateBrowserWorkspaceManager(browserWorkspaceManager);
	if (typeof appendRuntimeSocketToken !== "function") {
		throw new Error("createBrowserWorkspacesRouter requires appendRuntimeSocketToken");
	}
	if (typeof getMirrorBrowser !== "function") {
		throw new Error("createBrowserWorkspacesRouter requires getMirrorBrowser");
	}
	if (typeof getString !== "function") {
		throw new Error("createBrowserWorkspacesRouter requires getString");
	}
	if (typeof isBrowserWorkspaceNotFoundError !== "function") {
		throw new Error("createBrowserWorkspacesRouter requires isBrowserWorkspaceNotFoundError");
	}
	if (runtimePort === undefined || runtimePort === null || runtimePort === "") {
		throw new Error("createBrowserWorkspacesRouter requires runtimePort");
	}

	const errorOptions = {
		isBrowserWorkspaceNotFoundError,
		logger,
	};
	const router = express.Router();

	router.get("/", async (_req, res) => {
		try {
			return res.json({
				workspaces: browserWorkspaceManager.listWorkspaces(),
			});
		} catch (error) {
			logBrowserWorkspaceError("[BROWSER-WORKSPACE] List error", error, errorOptions);
			return sendBrowserWorkspaceError(
				res,
				error,
				"Failed to list browser workspaces",
				errorOptions,
			);
		}
	});

	router.post("/", async (req, res) => {
		try {
			const defaultUrl = getString(req.body?.defaultUrl);
			const state = await browserWorkspaceManager.createWorkspace({
				defaultUrl: defaultUrl || undefined,
			});
			return res.status(201).json(state);
		} catch (error) {
			logBrowserWorkspaceError("[BROWSER-WORKSPACE] Create error", error, errorOptions);
			return sendBrowserWorkspaceError(
				res,
				error,
				"Failed to create browser workspace",
				errorOptions,
			);
		}
	});

	router.get("/:workspaceId", async (req, res) => {
		try {
			const workspaceId = resolveBrowserWorkspaceId(req, getString);
			if (!workspaceId) {
				return res.status(400).json({
					error: "A non-empty workspaceId route param is required.",
				});
			}

			const state = await browserWorkspaceManager.getWorkspaceState(workspaceId);
			return res.json(state);
		} catch (error) {
			logBrowserWorkspaceError("[BROWSER-WORKSPACE] State error", error, errorOptions);
			return sendBrowserWorkspaceError(
				res,
				error,
				"Failed to read browser workspace state",
				errorOptions,
			);
		}
	});

	router.delete("/:workspaceId", async (req, res) => {
		try {
			const workspaceId = resolveBrowserWorkspaceId(req, getString);
			if (!workspaceId) {
				return res.status(400).json({
					error: "A non-empty workspaceId route param is required.",
				});
			}

			const result = await browserWorkspaceManager.deleteWorkspace(workspaceId);
			return res.json(result);
		} catch (error) {
			logBrowserWorkspaceError("[BROWSER-WORKSPACE] Delete error", error, errorOptions);
			return sendBrowserWorkspaceError(
				res,
				error,
				"Failed to delete browser workspace",
				errorOptions,
			);
		}
	});

	router.get("/:workspaceId/tabs", async (req, res) => {
		try {
			const workspaceId = resolveBrowserWorkspaceId(req, getString);
			if (!workspaceId) {
				return res.status(400).json({
					error: "A non-empty workspaceId route param is required.",
				});
			}

			const tabs = await browserWorkspaceManager.getWorkspaceTabs(workspaceId);
			return res.json(tabs);
		} catch (error) {
			logBrowserWorkspaceError("[BROWSER-WORKSPACE] Tab list error", error, errorOptions);
			return sendBrowserWorkspaceError(
				res,
				error,
				"Failed to list browser workspace tabs",
				errorOptions,
			);
		}
	});

	router.post("/:workspaceId/tabs", async (req, res) => {
		try {
			const workspaceId = resolveBrowserWorkspaceId(req, getString);
			if (!workspaceId) {
				return res.status(400).json({
					error: "A non-empty workspaceId route param is required.",
				});
			}

			const url = getString(req.body?.url);
			const state = await browserWorkspaceManager.createWorkspaceTab(
				workspaceId,
				url || undefined,
			);
			return res.json(state);
		} catch (error) {
			logBrowserWorkspaceError("[BROWSER-WORKSPACE] Tab create error", error, errorOptions);
			return sendBrowserWorkspaceError(
				res,
				error,
				"Failed to create browser workspace tab",
				errorOptions,
			);
		}
	});

	router.post("/:workspaceId/tabs/:tabIndex/activate", async (req, res) => {
		try {
			const workspaceId = resolveBrowserWorkspaceId(req, getString);
			if (!workspaceId) {
				return res.status(400).json({
					error: "A non-empty workspaceId route param is required.",
				});
			}

			const tabIndex = resolveBrowserWorkspaceTabIndex(req);
			if (tabIndex === null) {
				return res.status(400).json({
					error: "A non-negative tabIndex route param is required.",
				});
			}

			const state = await browserWorkspaceManager.activateWorkspaceTab(
				workspaceId,
				tabIndex,
			);
			return res.json(state);
		} catch (error) {
			logBrowserWorkspaceError("[BROWSER-WORKSPACE] Tab activate error", error, errorOptions);
			return sendBrowserWorkspaceError(
				res,
				error,
				"Failed to activate browser workspace tab",
				errorOptions,
			);
		}
	});

	router.delete("/:workspaceId/tabs/:tabIndex", async (req, res) => {
		try {
			const workspaceId = resolveBrowserWorkspaceId(req, getString);
			if (!workspaceId) {
				return res.status(400).json({
					error: "A non-empty workspaceId route param is required.",
				});
			}

			const tabIndex = resolveBrowserWorkspaceTabIndex(req);
			if (tabIndex === null) {
				return res.status(400).json({
					error: "A non-negative tabIndex route param is required.",
				});
			}

			const state = await browserWorkspaceManager.closeWorkspaceTab(
				workspaceId,
				tabIndex,
			);
			return res.json(state);
		} catch (error) {
			logBrowserWorkspaceError("[BROWSER-WORKSPACE] Tab close error", error, errorOptions);
			return sendBrowserWorkspaceError(
				res,
				error,
				"Failed to close browser workspace tab",
				errorOptions,
			);
		}
	});

	router.post("/:workspaceId/preview-session", async (req, res) => {
		try {
			const workspaceId = resolveBrowserWorkspaceId(req, getString);
			if (!workspaceId) {
				return res.status(400).json({
					error: "A non-empty workspaceId route param is required.",
				});
			}

			const offerSdp =
				typeof req.body?.offerSdp === "string" && req.body.offerSdp.trim()
					? req.body.offerSdp
					: null;
			if (!offerSdp) {
				return res.status(400).json({
					error: "A non-empty offerSdp field is required.",
				});
			}

			const session = await browserWorkspaceManager.createWorkspacePreviewSession(
				workspaceId,
				offerSdp,
			);
			return res.status(201).json(session);
		} catch (error) {
			logBrowserWorkspaceError(
				"[BROWSER-WORKSPACE] Preview session create error",
				error,
				errorOptions,
			);
			return sendBrowserWorkspaceError(
				res,
				error,
				"Failed to create browser preview session",
				errorOptions,
			);
		}
	});

	router.delete("/:workspaceId/preview-session/:sessionId", async (req, res) => {
		try {
			const workspaceId = resolveBrowserWorkspaceId(req, getString);
			if (!workspaceId) {
				return res.status(400).json({
					error: "A non-empty workspaceId route param is required.",
				});
			}

			const sessionId = getString(req.params?.sessionId);
			if (!sessionId) {
				return res.status(400).json({
					error: "A non-empty sessionId route param is required.",
				});
			}

			const result = await browserWorkspaceManager.deleteWorkspacePreviewSession(
				workspaceId,
				sessionId,
			);
			return res.json(result);
		} catch (error) {
			logBrowserWorkspaceError(
				"[BROWSER-WORKSPACE] Preview session delete error",
				error,
				errorOptions,
			);
			return sendBrowserWorkspaceError(
				res,
				error,
				"Failed to delete browser preview session",
				errorOptions,
			);
		}
	});

	router.get("/:workspaceId/:action", async (req, res) => {
		try {
			const workspaceId = resolveBrowserWorkspaceId(req, getString);
			if (!workspaceId) {
				return res.status(400).json({
					error: "A non-empty workspaceId route param is required.",
				});
			}

			const action = getString(req.params?.action);
			if (!action) {
				return res.status(400).json({
					error: "A non-empty action route param is required.",
				});
			}

			if (action === "snapshot") {
				const interactive = req.query.interactive === "true";
				const snapshot = await browserWorkspaceManager.getWorkspaceSnapshot(
					workspaceId,
					{ interactive },
				);
				return res.json(snapshot);
			}

			if (action === "stream") {
				const socketScope = `browser-preview:${workspaceId}`;
				const mirrorBrowser = getMirrorBrowser(workspaceId);
				if (mirrorBrowser) {
					const streamConfig = mirrorBrowser.getStreamConfig(runtimePort);
					return res.json({
						...streamConfig,
						wsUrl: appendRuntimeSocketToken(
							streamConfig.wsUrl,
							socketScope,
							"previewToken",
						),
					});
				}

				const streamConfig = browserWorkspaceManager.getWorkspaceStream(workspaceId);
				return res.json({
					...streamConfig,
					wsUrl: appendRuntimeSocketToken(
						`ws://127.0.0.1:${runtimePort}/api/browser-workspaces/${encodeURIComponent(workspaceId)}/live`,
						socketScope,
						"previewToken",
					),
				});
			}

			if (action === "screenshot") {
				const width = Array.isArray(req.query.width)
					? req.query.width[0]
					: req.query.width;
				const height = Array.isArray(req.query.height)
					? req.query.height[0]
					: req.query.height;

				if (width || height) {
					await browserWorkspaceManager.resizeWorkspace(
						workspaceId,
						width,
						height,
					);
				}

				const screenshot =
					await browserWorkspaceManager.getWorkspaceScreenshot(workspaceId);
				res.setHeader("Content-Type", screenshot.contentType);
				res.setHeader("Cache-Control", "no-store");
				return res.send(screenshot.buffer);
			}

			return res.status(404).json({
				error: "Unsupported browser workspace action.",
			});
		} catch (error) {
			logBrowserWorkspaceError("[BROWSER-WORKSPACE] Read action error", error, errorOptions);
			return sendBrowserWorkspaceError(
				res,
				error,
				"Failed to handle browser workspace action",
				errorOptions,
			);
		}
	});

	router.post("/:workspaceId/:action", async (req, res) => {
		try {
			const workspaceId = resolveBrowserWorkspaceId(req, getString);
			if (!workspaceId) {
				return res.status(400).json({
					error: "A non-empty workspaceId route param is required.",
				});
			}

			const action = getString(req.params?.action);
			if (!action) {
				return res.status(400).json({
					error: "A non-empty action route param is required.",
				});
			}

			switch (action) {
				case "navigate": {
					const url = getString(req.body?.url);
					if (!url) {
						return res.status(400).json({
							error: "A non-empty url field is required.",
						});
					}

					const state = await browserWorkspaceManager.navigateWorkspace(
						workspaceId,
						url,
					);
					return res.json(state);
				}
				case "back":
					return res.json(await browserWorkspaceManager.goBack(workspaceId));
				case "forward":
					return res.json(await browserWorkspaceManager.goForward(workspaceId));
				case "reload":
					return res.json(
						await browserWorkspaceManager.reloadWorkspace(workspaceId),
					);
				case "viewport":
					return res.json(
						await browserWorkspaceManager.resizeWorkspace(
							workspaceId,
							req.body?.width,
							req.body?.height,
							req.body?.deviceScaleFactor,
						),
					);
				case "click":
					return res.json(
						await browserWorkspaceManager.clickWorkspace(
							workspaceId,
							req.body?.x,
							req.body?.y,
						),
					);
				case "click-ref": {
					const ref = getString(req.body?.ref);
					if (!ref) {
						return res.status(400).json({
							error: "A non-empty ref field is required.",
						});
					}

					return res.json(
						await browserWorkspaceManager.clickWorkspaceRef(workspaceId, ref),
					);
				}
				case "hover-ref": {
					const ref = getString(req.body?.ref);
					if (!ref) {
						return res.status(400).json({
							error: "A non-empty ref field is required.",
						});
					}

					return res.json(
						await browserWorkspaceManager.hoverWorkspaceRef(workspaceId, ref),
					);
				}
				case "fill-ref": {
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

					return res.json(
						await browserWorkspaceManager.fillWorkspaceRef(
							workspaceId,
							ref,
							req.body.text,
						),
					);
				}
				case "type-ref": {
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

					return res.json(
						await browserWorkspaceManager.typeWorkspaceRef(
							workspaceId,
							ref,
							req.body.text,
						),
					);
				}
				case "select-ref": {
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

					return res.json(
						await browserWorkspaceManager.selectWorkspaceRef(
							workspaceId,
							ref,
							values,
						),
					);
				}
				case "scroll": {
					const direction = getString(req.body?.direction);
					if (!direction) {
						return res.status(400).json({
							error: "A non-empty direction field is required.",
						});
					}

					return res.json(
						await browserWorkspaceManager.scrollWorkspace(
							workspaceId,
							direction,
							req.body?.pixels,
						),
					);
				}
				case "wheel":
					return res.json(
						await browserWorkspaceManager.wheelWorkspace(
							workspaceId,
							req.body?.deltaX,
							req.body?.deltaY,
						),
					);
				case "press": {
					const key = getString(req.body?.key);
					if (!key) {
						return res.status(400).json({
							error: "A non-empty key field is required.",
						});
					}

					return res.json(
						await browserWorkspaceManager.pressWorkspaceKey(workspaceId, key),
					);
				}
				case "type": {
					const text = getString(req.body?.text);
					if (!text) {
						return res.status(400).json({
							error: "A non-empty text field is required.",
						});
					}

					return res.json(
						await browserWorkspaceManager.typeWorkspaceText(workspaceId, text),
					);
				}
				default:
					return res.status(404).json({
						error: "Unsupported browser workspace action.",
					});
			}
		} catch (error) {
			logBrowserWorkspaceError("[BROWSER-WORKSPACE] Mutation action error", error, errorOptions);
			return sendBrowserWorkspaceError(
				res,
				error,
				"Failed to mutate browser workspace state",
				errorOptions,
			);
		}
	});

	return router;
}

function registerBrowserWorkspacesRoutes(app, {
	requireRuntimeAdmin,
	...dependencies
} = {}) {
	if (typeof requireRuntimeAdmin !== "function") {
		throw new Error("registerBrowserWorkspacesRoutes requires requireRuntimeAdmin");
	}

	app.use("/api/browser-workspaces", requireRuntimeAdmin);
	app.use("/api/browser-workspaces", createBrowserWorkspacesRouter(dependencies));
}

module.exports = {
	createBrowserWorkspacesRouter,
	logBrowserWorkspaceError,
	registerBrowserWorkspacesRoutes,
	resolveBrowserWorkspaceId,
	resolveBrowserWorkspaceTabIndex,
	sendBrowserWorkspaceError,
	validateBrowserWorkspaceManager,
};
