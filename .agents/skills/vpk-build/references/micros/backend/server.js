"use strict";

// Tiny Express server that serves the Next.js static export from ./public.
// Used only in production (inside the Docker container). Dev uses `next dev`.

const express = require("express");
const path = require("node:path");
const { registerStaticExportServing } = require("./lib/static-export-serving");

const app = express();
const PORT = process.env.PORT || 8080;
const STATIC_DIR = path.join(__dirname, "public");

app.get("/api/health", (_req, res) => {
	res.json({ status: "ok", time: new Date().toISOString() });
});

registerStaticExportServing(app, {
	expressImpl: express,
	publicPath: STATIC_DIR,
});

app.listen(PORT, () => {
	console.log(`Serving static export from ${STATIC_DIR} on :${PORT}`);
});
