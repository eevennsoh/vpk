"use strict";

const express = require("express");
const { selectLocalFolder } = require("../lib/personal-graph-vault");

function isLocalRequest(req, { env = process.env, platform = process.platform } = {}) {
	if (env.NODE_ENV === "production" || platform !== "darwin") return false;
	if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress)) return false;
	if (!["localhost", "127.0.0.1", "::1"].includes(req.hostname)) return false;
	try {
		const origin = new URL(req.get("origin"));
		return ["http:", "https:"].includes(origin.protocol)
			&& (origin.hostname === "localhost" || origin.hostname.endsWith(".localhost"))
			&& origin.origin === req.get("origin");
	} catch {
		return false;
	}
}

function createLocalFolderRouter({ choose = selectLocalFolder, env, platform } = {}) {
	const router = express.Router();
	let selecting = false;
	router.use((req, res, next) => {
		if (!isLocalRequest(req, { env, platform })) return res.sendStatus(403);
		res.set("Access-Control-Allow-Origin", req.get("origin"));
		res.set("Vary", "Origin");
		res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
		res.set("Access-Control-Allow-Headers", "Content-Type");
		res.set("Access-Control-Allow-Private-Network", "true");
		if (req.method === "OPTIONS") return res.sendStatus(204);
		return next();
	});
	router.post("/", async (req, res) => {
		if (!req.is("application/json")) return res.sendStatus(415);
		if (selecting) return res.status(409).json({ error: "A folder chooser is already open." });
		selecting = true;
		try {
			const path = await choose({ prompt: "Choose a workspace folder" });
			return res.json({ path });
		} catch (error) {
			if (error?.code === "VAULT_SELECTION_CANCELLED") return res.status(200).json({ path: null });
			return res.status(500).json({ error: "Unable to open the folder chooser." });
		} finally {
			selecting = false;
		}
	});
	return router;
}

module.exports = { createLocalFolderRouter, isLocalRequest };
