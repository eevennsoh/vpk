"use strict";

// Starts the real backend (backend/server.js) with one extra shutdown step after
// stop-accepting that holds the drain open until a line arrives on stdin. Tests
// use it to send requests while the backend is draining, without timing.

const backendShutdown = require("../lib/backend-shutdown");

const { createBackendProcess } = backendShutdown;

backendShutdown.createBackendProcess = (options) =>
	createBackendProcess({
		...options,
		getSteps: () => {
			const [first, ...rest] = options.getSteps();
			const hold = {
				name: "test-hold",
				run: () =>
					new Promise((resolve) => {
						process.stdin.once("data", () => resolve("released"));
						console.log("[TEST] drain held");
					}),
			};
			return [first, hold, ...rest];
		},
	});

require("../server");
