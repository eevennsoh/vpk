"use strict";

// The extracted app owns one route. Keep explicit Create destinations in VPK.
function registerCrossRouteRedirects(app, env = process.env) {
	app.get("/api/realtime/ws-url", (req, res) => {
		const protocol = req.get("x-forwarded-proto") === "https" ? "wss" : "ws";
		res.json({ wsUrl: `${protocol}://${req.get("host")}` });
	});
	app.get(/^\/(studio|skills)(?:\/|$)/, (req, res) => {
		if (!env.VPK_ORIGIN) {
			res.status(503).send("VPK_ORIGIN is required for this action");
			return;
		}
		let destination;
		try {
			destination = new URL(req.originalUrl, env.VPK_ORIGIN);
		} catch {
			res.status(503).send("VPK_ORIGIN must be an absolute URL");
			return;
		}
		res.redirect(307, destination.href);
	});
}

module.exports = { registerCrossRouteRedirects };
