"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const express = require("express");

const {
	createDemosRouter,
	registerDemosRoutes,
} = require("./demos");

async function withServer(overrides, run) {
	const app = express();
	app.use(express.json());
	const calls = {
		advance: 0, events: [], classify: [], getClaim: [], htmlReport: [], postClaim: [], deleteClaim: [], resetState: 0, runJob: [], standup: [], writeState: [],
	};
	const stateManager = {
		readState: async () => ({}),
		resetState: async () => { calls.resetState += 1; return { reset: true }; },
		updateState: async (updater) => updater({}),
		writeState: async (state) => { calls.writeState.push(state); return { ...state, persisted: true }; },
	};

	registerDemosRoutes(app, {
		advanceAgentsRfpDemoProcessing: async () => {
			calls.advance += 1;
			return { advanced: true };
		},
		agentsRfpDemoStateManager: stateManager,
		classifyTicketsFn: async (input) => {
			calls.classify.push(input);
			return { tickets: [{ key: "RFP-1" }] };
		},
		generateAgentsRfpDemoReportPreview: async (input) => {
			calls.htmlReport.push(input);
			return { html: "<main>Report</main>", skill: "vpk-html", variant: "initial" };
		},
		generateStandupSummaryFn: async (input) => {
			calls.standup.push(input);
			return { summary: "Standup" };
		},
		handleDeleteClaimTestFn: async (query) => {
			calls.deleteClaim.push(Object.fromEntries(Object.entries(query)));
			return { body: { deleted: true }, status: 202 };
		},
		handleGetClaimTestFn: async (query) => {
			calls.getClaim.push(Object.fromEntries(Object.entries(query)));
			return { body: { claim: "ok" }, status: 203 };
		},
		handlePostClaimTestFn: async (body) => {
			calls.postClaim.push(body);
			return { body: { posted: true }, status: 201 };
		},
		resetAgentsRfpDemo: async () => stateManager.resetState(),
		saveAgentsRfpDemoState: async (state) => stateManager.writeState(state),
		handleAgentsRfpDemoTicketEvent: async ({ ticketCode, targetColumn, runId }) => {
			calls.events.push({ ticketCode, targetColumn, runId });
			if (targetColumn !== "Drafting") {
				return { job: { id: "job-1" }, state: { moved: { ticketCode, targetColumn } } };
			}
			return { job: { id: "job-1" }, state: { processed: true } };
		},
		runAgentsRfpDemoJob: async (input) => {
			calls.runJob.push(input);
			return {
				job: { id: "job-1" },
				state: { processed: true },
			};
		},
		...overrides,
	});

	const server = http.createServer(app);
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	const baseUrl = `http://127.0.0.1:${address.port}`;

	try {
		await run(baseUrl, calls);
	} finally {
		await new Promise((resolve, reject) => {
			server.close((error) => {
				if (error) {
					reject(error);
					return;
				}
				resolve();
			});
		});
	}
}

test("demos router validates required dependencies", () => {
	assert.throws(() => createDemosRouter(), /advanceAgentsRfpDemoProcessing/u);
	assert.throws(() => createDemosRouter({
		advanceAgentsRfpDemoProcessing: async () => ({}),
	}), /generateAgentsRfpDemoReportPreview/u);
});

test("ticket classification, claim-test, and standup routes preserve request mapping", async () => {
	await withServer({}, async (baseUrl, calls) => {
		const ticketResponse = await fetch(`${baseUrl}/api/ticket-classify`, {
			body: JSON.stringify({
				excludeStatuses: ["Done"],
				limit: 5,
				project: "RFP",
				siteUrl: "https://example.atlassian.net",
			}),
			headers: { "content-type": "application/json" },
			method: "POST",
		});
		assert.equal(ticketResponse.status, 200);
		assert.deepEqual(await ticketResponse.json(), { tickets: [{ key: "RFP-1" }] });
		assert.deepEqual(calls.classify, [{
			excludeStatuses: ["Done"],
			limit: 5,
			project: "RFP",
			siteUrl: "https://example.atlassian.net",
		}]);

		const claimGetResponse = await fetch(`${baseUrl}/api/claim-test?runId=run-1`);
		assert.equal(claimGetResponse.status, 203);
		assert.deepEqual(await claimGetResponse.json(), { claim: "ok" });
		assert.deepEqual(calls.getClaim, [{ runId: "run-1" }]);

		const claimPostResponse = await fetch(`${baseUrl}/api/claim-test`, {
			body: JSON.stringify({ claim: "test" }),
			headers: { "content-type": "application/json" },
			method: "POST",
		});
		assert.equal(claimPostResponse.status, 201);
		assert.deepEqual(await claimPostResponse.json(), { posted: true });
		assert.deepEqual(calls.postClaim, [{ claim: "test" }]);

		const claimDeleteResponse = await fetch(`${baseUrl}/api/claim-test?runId=run-2`, {
			method: "DELETE",
		});
		assert.equal(claimDeleteResponse.status, 202);
		assert.deepEqual(await claimDeleteResponse.json(), { deleted: true });
		assert.deepEqual(calls.deleteClaim, [{ runId: "run-2" }]);

		const standupResponse = await fetch(`${baseUrl}/api/standup`, {
			body: JSON.stringify({
				hoursAgo: 12,
				limit: 10,
				projects: ["RFP"],
				siteUrl: "https://example.atlassian.net",
			}),
			headers: { "content-type": "application/json" },
			method: "POST",
		});
		assert.equal(standupResponse.status, 200);
		assert.deepEqual(await standupResponse.json(), { summary: "Standup" });
		assert.deepEqual(calls.standup, [{
			hoursAgo: 12,
			limit: 10,
			projects: ["RFP"],
			siteUrl: "https://example.atlassian.net",
		}]);
	});
});

test("vpk-html report preview route delegates to the existing preview generator", async () => {
	await withServer({}, async (baseUrl, calls) => {
		const response = await fetch(`${baseUrl}/api/agents/rfp-demo/vpk-html-report`, {
			body: JSON.stringify({
				contextDescription: "Work item context",
				variant: "branded",
			}),
			headers: { "content-type": "application/json" },
			method: "POST",
		});

		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), {
			html: "<main>Report</main>",
			skill: "vpk-html",
			variant: "initial",
		});
		assert.deepEqual(calls.htmlReport, [{
			contextDescription: "Work item context",
			variant: "branded",
		}]);
	});
});

test("RFP demo state routes preserve persisted state and reset cleanup behavior", async () => {
	await withServer({}, async (baseUrl, calls) => {
		const getResponse = await fetch(`${baseUrl}/api/agents/rfp-demo/state`);
		assert.equal(getResponse.status, 200);
		assert.deepEqual(await getResponse.json(), { state: { advanced: true } });
		assert.equal(calls.advance, 1);

		const invalidPostResponse = await fetch(`${baseUrl}/api/agents/rfp-demo/state`, {
			body: JSON.stringify({ state: null }),
			headers: { "content-type": "application/json" },
			method: "POST",
		});
		assert.equal(invalidPostResponse.status, 400);
		assert.deepEqual(await invalidPostResponse.json(), { error: "state is required." });
		assert.deepEqual(calls.writeState, []);

		const postResponse = await fetch(`${baseUrl}/api/agents/rfp-demo/state`, {
			body: JSON.stringify({ state: { custom: true } }),
			headers: { "content-type": "application/json" },
			method: "POST",
		});
		assert.equal(postResponse.status, 200);
		assert.deepEqual(await postResponse.json(), { state: { custom: true, persisted: true } });
		assert.deepEqual(calls.writeState, [{ custom: true }]);

		const resetResponse = await fetch(`${baseUrl}/api/agents/rfp-demo/reset`, {
			method: "POST",
		});
		assert.equal(resetResponse.status, 200);
		assert.deepEqual(await resetResponse.json(), { state: { reset: true } });
		assert.equal(calls.resetState, 1);
	});
});

test("RFP demo agent apply route runs the manual demo job", async () => {
	await withServer({}, async (baseUrl, calls) => {
		const response = await fetch(`${baseUrl}/api/agents/rfp-demo/agent/apply`, {
			method: "POST",
		});

		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), {
			job: { id: "job-1" },
			state: { processed: true },
		});
		assert.deepEqual(calls.runJob, [{ source: "agent-apply" }]);
	});
});

test("RFP demo ticket event validates input and delegates non-trigger moves", async () => {
	await withServer({}, async (baseUrl, calls) => {
		const invalidResponse = await fetch(`${baseUrl}/api/agents/rfp-demo/events/ticket-entered-column`, {
			body: JSON.stringify({ ticketCode: "RFP-1" }),
			headers: { "content-type": "application/json" },
			method: "POST",
		});
		assert.equal(invalidResponse.status, 400);
		assert.deepEqual(await invalidResponse.json(), {
			error: "ticketCode and targetColumn are required.",
		});

		const response = await fetch(`${baseUrl}/api/agents/rfp-demo/events/ticket-entered-column`, {
			body: JSON.stringify({
				key: "RFP-1",
				column: "Review",
			}),
			headers: { "content-type": "application/json" },
			method: "POST",
		});
		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), {
			job: { id: "job-1" },
			state: {
				moved: { targetColumn: "Review", ticketCode: "RFP-1" },
			},
		});
		assert.deepEqual(calls.runJob, []);
	});
});

test("RFP demo ticket event runs the job when a ticket enters the trigger column", async () => {
	await withServer({
		agentsRfpDemoStateManager: {
			readState: async () => ({}),
			resetState: async () => ({}),
			updateState: async (updater) => updater({
				agent: {
					jobId: "job-1",
					trigger: { type: "jira" },
				},
			}),
			writeState: async (state) => state,
		},
	}, async (baseUrl, calls) => {
		const response = await fetch(`${baseUrl}/api/agents/rfp-demo/events/ticket-entered-column`, {
			body: JSON.stringify({
				ticketCode: "RFP-2",
				targetColumn: "Drafting",
			}),
			headers: { "content-type": "application/json" },
			method: "POST",
		});

		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), {
			job: { id: "job-1" },
			state: { processed: true },
		});
		assert.deepEqual(calls.events, [{ targetColumn: "Drafting", ticketCode: "RFP-2", runId: null }]);
	});
});

test("demo routes preserve error mapping for service failures", async () => {
	await withServer({
		classifyTicketsFn: async () => {
			const error = new Error("classification denied");
			error.statusCode = 401;
			throw error;
		},
		generateAgentsRfpDemoReportPreview: async () => {
			throw new Error("contextDescription is required");
		},
		generateStandupSummaryFn: async () => {
			const error = new Error("standup failed");
			error.statusCode = 400;
			throw error;
		},
	}, async (baseUrl) => {
		const ticketResponse = await fetch(`${baseUrl}/api/ticket-classify`, {
			body: "{}",
			headers: { "content-type": "application/json" },
			method: "POST",
		});
		assert.equal(ticketResponse.status, 401);
		assert.deepEqual(await ticketResponse.json(), {
			error: "Failed to classify tickets",
			details: "classification denied",
		});

		const reportResponse = await fetch(`${baseUrl}/api/agents/rfp-demo/vpk-html-report`, {
			body: "{}",
			headers: { "content-type": "application/json" },
			method: "POST",
		});
		assert.equal(reportResponse.status, 400);
		assert.deepEqual(await reportResponse.json(), {
			error: "contextDescription is required",
		});

		const standupResponse = await fetch(`${baseUrl}/api/standup`, {
			body: "{}",
			headers: { "content-type": "application/json" },
			method: "POST",
		});
		assert.equal(standupResponse.status, 400);
		assert.deepEqual(await standupResponse.json(), {
			error: "Failed to generate standup summary",
			details: "standup failed",
		});
	});
});
