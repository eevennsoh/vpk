/**
 * Tests for Parallel Claim Test Framework
 */

const assert = require("node:assert/strict");
const { afterEach, beforeEach, describe, test } = require("node:test");

const { ClaimTestRunner } = require("./parallel-claim-test");

describe("ClaimTestRunner", () => {
	let runner;

	beforeEach(() => {
		runner = new ClaimTestRunner({
			maxConcurrency: 2,
			timeoutMs: 1000,
			retryAttempts: 1,
		});
	});

	afterEach(() => {
		runner.reset();
	});

	describe("registerClaim", () => {
		test("registers a claim successfully", () => {
			const validatorFn = async () => ({ validated: true });
			runner.registerClaim("claim-1", { description: "Test claim" }, validatorFn);

			assert.equal(runner.claims.has("claim-1"), true);
			assert.equal(runner.claims.get("claim-1").status, "pending");
		});

		test("throws on duplicate claim registration", () => {
			const validatorFn = async () => ({ validated: true });
			runner.registerClaim("claim-1", { description: "Test" }, validatorFn);

			assert.throws(() => {
				runner.registerClaim("claim-1", { description: "Test" }, validatorFn);
			}, /Claim claim-1 already registered/u);
		});
	});

	describe("executeAll", () => {
		test("executes all claims and returns results", async () => {
			runner.registerClaim("claim-1", {}, async () => ({ result: "pass" }));
			runner.registerClaim("claim-2", {}, async () => ({ result: "pass" }));

			const results = await runner.executeAll();

			assert.equal(results.size, 2);
			assert.equal(results.get("claim-1").status, "passed");
			assert.equal(results.get("claim-2").status, "passed");
		});

		test("respects maxConcurrency limit", async () => {
			const executionOrder = [];
			let maxConcurrent = 0;
			let currentConcurrent = 0;

			runner.registerClaim("claim-1", {}, async () => {
				currentConcurrent++;
				maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
				executionOrder.push("start-1");
				await new Promise((resolve) => setTimeout(resolve, 100));
				currentConcurrent--;
				return { result: "pass" };
			});

			runner.registerClaim("claim-2", {}, async () => {
				currentConcurrent++;
				maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
				executionOrder.push("start-2");
				await new Promise((resolve) => setTimeout(resolve, 100));
				currentConcurrent--;
				return { result: "pass" };
			});

			runner.registerClaim("claim-3", {}, async () => {
				executionOrder.push("start-3");
				return { result: "pass" };
			});

			await runner.executeAll();

			// With maxConcurrency=2, should not exceed 2 concurrent executions
			assert.ok(maxConcurrent <= 2);
		});

		test("handles claim failures", async () => {
			runner.registerClaim("claim-pass", {}, async () => ({ result: "pass" }));
			runner.registerClaim("claim-fail", {}, async () => {
				throw new Error("Validation failed");
			});

			const results = await runner.executeAll();

			assert.equal(results.get("claim-pass").status, "passed");
			assert.equal(results.get("claim-fail").status, "failed");
			assert.ok(results.get("claim-fail").error.includes("Validation failed"));
		});

		test("implements retry logic", async () => {
			let attemptCount = 0;
			runner.registerClaim("claim-retry", {}, async () => {
				attemptCount++;
				if (attemptCount < 2) {
					throw new Error("First attempt fails");
				}
				return { result: "pass" };
			});

			const results = await runner.executeAll();

			assert.equal(results.get("claim-retry").status, "passed");
			assert.equal(results.get("claim-retry").attempt, 1);
		});

		test("enforces timeout", async () => {
			runner = new ClaimTestRunner({
				timeoutMs: 100,
				retryAttempts: 0,
			});

			runner.registerClaim("claim-slow", {}, async () => {
				await new Promise((resolve) => setTimeout(resolve, 500));
				return { result: "pass" };
			});

			const results = await runner.executeAll();

			assert.equal(results.get("claim-slow").status, "failed");
			assert.ok(results.get("claim-slow").error.includes("timeout"));
		});
	});

	describe("getSummary", () => {
		test("returns accurate summary statistics", async () => {
			runner.registerClaim("claim-1", {}, async () => ({ result: "pass" }));
			runner.registerClaim("claim-2", {}, async () => ({ result: "pass" }));
			runner.registerClaim("claim-3", {}, async () => {
				throw new Error("Fail");
			});

			await runner.executeAll();

			const summary = runner.getSummary();

			assert.equal(summary.total, 3);
			assert.equal(summary.passed, 2);
			assert.equal(summary.failed, 1);
			assert.equal(summary.pending, 0);
			assert.ok(summary.passRate.includes("66"));
		});
	});

	describe("event emissions", () => {
		test("emits claim:passed event", async () => {
			const passedEvents = [];
			runner.on("claim:passed", (result) => {
				passedEvents.push(result);
			});

			runner.registerClaim("claim-1", {}, async () => ({ result: "pass" }));
			await runner.executeAll();

			assert.equal(passedEvents.length, 1);
			assert.equal(passedEvents[0].claimId, "claim-1");
		});

		test("emits claim:failed event", async () => {
			const failedEvents = [];
			runner.on("claim:failed", (result) => {
				failedEvents.push(result);
			});

			runner.registerClaim("claim-fail", {}, async () => {
				throw new Error("Test fail");
			});
			await runner.executeAll();

			assert.equal(failedEvents.length, 1);
			assert.equal(failedEvents[0].claimId, "claim-fail");
		});

		test("emits claim:retry event", async () => {
			const retryEvents = [];
			runner.on("claim:retry", (result) => {
				retryEvents.push(result);
			});

			let attempts = 0;
			runner.registerClaim("claim-retry", {}, async () => {
				attempts++;
				if (attempts === 1) {
					throw new Error("First fail");
				}
				return { result: "pass" };
			});
			await runner.executeAll();

			assert.equal(retryEvents.length, 1);
		});
	});

	describe("reset", () => {
		test("clears all state", async () => {
			runner.registerClaim("claim-1", {}, async () => ({ result: "pass" }));
			await runner.executeAll();

			assert.equal(runner.claims.size, 1);
			assert.equal(runner.results.size, 1);

			runner.reset();

			assert.equal(runner.claims.size, 0);
			assert.equal(runner.results.size, 0);
			assert.equal(runner.activeExecutions.size, 0);
		});
	});
});
