"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const express = require("express");

const {
	createMediaRouter,
	registerMediaRoutes,
	SOUND_GENERATION_INPUT_MAX_CHARS,
} = require("./media");

async function withServer(dependencies, run) {
	const app = express();
	app.use(express.json({ limit: "5mb" }));
	registerMediaRoutes(app, dependencies);

	const server = http.createServer(app);
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	const baseUrl = `http://127.0.0.1:${address.port}`;

	try {
		await run(baseUrl);
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

test("media router validates required dependencies", () => {
	assert.throws(() => createMediaRouter({ fetchFn: null }), /fetchFn/u);
	assert.throws(() => createMediaRouter({ synthesizeSoundFn: null }), /synthesizeSoundFn/u);
	assert.throws(() => createMediaRouter({ transcribeAudioFn: null }), /transcribeAudioFn/u);
});

test("sound generation normalizes speech payloads and returns audio headers", async () => {
	const calls = {
		resolve: [],
		synthesize: [],
	};

	await withServer({
		now: () => 1700000000000,
		resolveSpeechPayload: (input, options) => {
			calls.resolve.push({ input, options });
			return { mode: "quoted", payload: "Hello from the route" };
		},
		synthesizeSoundFn: async (input) => {
			calls.synthesize.push(input);
			return {
				audioBytes: Buffer.from([1, 2, 3, 4]),
				contentType: "audio/mpeg",
				extension: "mp3",
			};
		},
	}, async (baseUrl) => {
		const response = await fetch(`${baseUrl}/api/sound-generation`, {
			body: JSON.stringify({ input: "say \"Hello from the route\"", voice: "alloy" }),
			headers: { "content-type": "application/json" },
			method: "POST",
		});

		assert.equal(response.status, 200);
		assert.equal(response.headers.get("content-type"), "audio/mpeg");
		assert.equal(response.headers.get("content-length"), "4");
		assert.equal(
			response.headers.get("content-disposition"),
			"inline; filename=\"speech-1700000000000.mp3\"",
		);
		assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.from([1, 2, 3, 4]));
		assert.deepEqual(calls.resolve, [{
			input: "say \"Hello from the route\"",
			options: { maxChars: SOUND_GENERATION_INPUT_MAX_CHARS },
		}]);
		assert.deepEqual(calls.synthesize, [{
			input: "Hello from the route",
			voice: "alloy",
		}]);
	});
});

test("sound generation preserves existing error response shape", async () => {
	await withServer({
		resolveSpeechPayload: () => ({ mode: null, payload: null }),
		synthesizeSoundFn: async () => {
			const error = new Error("Unsupported voice");
			error.statusCode = 400;
			throw error;
		},
	}, async (baseUrl) => {
		const response = await fetch(`${baseUrl}/api/sound-generation`, {
			body: JSON.stringify({ input: "hello" }),
			headers: { "content-type": "application/json" },
			method: "POST",
		});

		assert.equal(response.status, 400);
		assert.deepEqual(await response.json(), {
			error: "Unsupported voice",
			details: "Unsupported voice",
		});
	});
});

test("speech transcription validates audio, passes abort signal, and cleans up", async () => {
	const abortController = new AbortController();
	const calls = {
		cleanup: 0,
		transcribe: [],
	};

	await withServer({
		abortControllerFromRequest: () => ({
			abortController,
			cleanup: () => {
				calls.cleanup += 1;
			},
		}),
		transcribeAudioFn: async (input) => {
			calls.transcribe.push(input);
			return "transcribed text";
		},
	}, async (baseUrl) => {
		const response = await fetch(`${baseUrl}/api/speech-transcription`, {
			body: JSON.stringify({
				audio: "base64-audio",
				language: "en",
				mimeType: "audio/wav",
				model: "stt-model",
				provider: "google",
			}),
			headers: { "content-type": "application/json" },
			method: "POST",
		});

		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), { text: "transcribed text" });
		assert.equal(calls.cleanup, 1);
		assert.equal(calls.transcribe.length, 1);
		assert.deepEqual({
			audio: calls.transcribe[0].audio,
			language: calls.transcribe[0].language,
			mimeType: calls.transcribe[0].mimeType,
			model: calls.transcribe[0].model,
			provider: calls.transcribe[0].provider,
		}, {
			audio: "base64-audio",
			language: "en",
			mimeType: "audio/wav",
			model: "stt-model",
			provider: "google",
		});
		assert.equal(calls.transcribe[0].signal, abortController.signal);
	});
});

test("speech transcription returns validation errors before transcribing and still cleans up", async () => {
	const calls = {
		cleanup: 0,
		transcribe: 0,
	};

	await withServer({
		abortControllerFromRequest: () => ({
			abortController: new AbortController(),
			cleanup: () => {
				calls.cleanup += 1;
			},
		}),
		transcribeAudioFn: async () => {
			calls.transcribe += 1;
			return "should not run";
		},
	}, async (baseUrl) => {
		const response = await fetch(`${baseUrl}/api/speech-transcription`, {
			body: JSON.stringify({ audio: null }),
			headers: { "content-type": "application/json" },
			method: "POST",
		});

		assert.equal(response.status, 400);
		assert.deepEqual(await response.json(), { error: "Base64 audio data is required" });
		assert.equal(calls.cleanup, 1);
		assert.equal(calls.transcribe, 0);
	});
});

test("speech transcription rejects a provider outside the list or a model path before transcribing", async () => {
	const calls = { cleanup: 0, transcribe: 0 };
	await withServer({
		abortControllerFromRequest: () => ({
			abortController: new AbortController(),
			cleanup: () => {
				calls.cleanup += 1;
			},
		}),
		transcribeAudioFn: async () => {
			calls.transcribe += 1;
			return "should not run";
		},
	}, async (baseUrl) => {
		for (const [field, value] of [
			["provider", "sh"],
			["model", "/tmp/evil.pt"],
			["model", "../../models/evil.pt"],
			["model", "--help"],
			["model", "m".repeat(500)],
			["language", "en --task translate"],
			["provider", ["google"]],
		]) {
			const response = await fetch(`${baseUrl}/api/speech-transcription`, {
				body: JSON.stringify({ audio: "base64-audio", provider: "local-whisper", [field]: value }),
				headers: { "content-type": "application/json" },
				method: "POST",
			});
			assert.equal(response.status, 400, `${field} ${value}`);
			assert.deepEqual(await response.json(), { error: `Invalid body.${field}.`, code: "INVALID_INPUT" });
		}
	});
	assert.equal(calls.transcribe, 0);
	assert.equal(calls.cleanup, 7);
});

test("image proxy returns image responses with upstream cache metadata", async () => {
	const calls = {
		fetch: [],
	};
	const targetUrl = new URL("https://www.figma.com/api/mcp/asset/image.png");

	await withServer({
		buildImageProxyHeaders: (url) => ({ "x-target-host": url.hostname }),
		fetchFn: async (url, options) => {
			calls.fetch.push({ options, url });
			return new Response(Buffer.from([9, 8, 7]), {
				headers: {
					"cache-control": "public, max-age=60",
					"content-type": "image/png",
				},
				status: 200,
			});
		},
		parseImageProxyTargetFn: () => ({
			source: "figma",
			targetUrl,
		}),
	}, async (baseUrl) => {
		const response = await fetch(`${baseUrl}/api/image-proxy?src=${encodeURIComponent(targetUrl.toString())}`);

		assert.equal(response.status, 200);
		assert.equal(response.headers.get("content-type"), "image/png");
		assert.equal(response.headers.get("content-length"), "3");
		assert.equal(response.headers.get("cache-control"), "public, max-age=60");
		assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.from([9, 8, 7]));
		assert.equal(calls.fetch.length, 1);
		assert.equal(calls.fetch[0].url, targetUrl.toString());
		assert.equal(calls.fetch[0].options.method, "GET");
		assert.deepEqual(calls.fetch[0].options.headers, { "x-target-host": "www.figma.com" });
	});
});

test("image proxy validates the target before fetching", async () => {
	let fetchCalls = 0;

	await withServer({
		fetchFn: async () => {
			fetchCalls += 1;
			return new Response("", { status: 200 });
		},
		parseImageProxyTargetFn: () => ({
			error: "Image URL is not allowed",
		}),
	}, async (baseUrl) => {
		const response = await fetch(`${baseUrl}/api/image-proxy?src=https://example.com/image.png`);

		assert.equal(response.status, 400);
		assert.deepEqual(await response.json(), { error: "Image URL is not allowed" });
		assert.equal(fetchCalls, 0);
	});
});

test("image proxy follows Atlassian HTML fallback image candidates", async () => {
	const targetUrl = new URL("https://site.atlassian.net/wiki/spaces/ABC/attachments/1/preview");
	const derivedUrl = new URL("https://site.atlassian.net/wiki/download/attachments/1/image.png");
	const fetchedUrls = [];

	await withServer({
		deriveAtlassianImageCandidates: () => [],
		extractAtlassianImageCandidates: (htmlText, baseUrl) => {
			assert.equal(htmlText, "<html>fallback</html>");
			assert.equal(baseUrl.toString(), targetUrl.toString());
			return [derivedUrl];
		},
		fetchFn: async (url) => {
			fetchedUrls.push(url);
			if (url === targetUrl.toString()) {
				return new Response("<html>fallback</html>", {
					headers: { "content-type": "text/html" },
					status: 200,
				});
			}
			return new Response(Buffer.from([1, 3, 5]), {
				headers: { "content-type": "image/webp" },
				status: 200,
			});
		},
		parseImageProxyTargetFn: () => ({
			source: "atlassian",
			targetUrl,
		}),
	}, async (baseUrl) => {
		const response = await fetch(`${baseUrl}/api/image-proxy?src=${encodeURIComponent(targetUrl.toString())}`);

		assert.equal(response.status, 200);
		assert.equal(response.headers.get("content-type"), "image/webp");
		assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.from([1, 3, 5]));
		assert.deepEqual(fetchedUrls, [targetUrl.toString(), derivedUrl.toString()]);
	});
});

test("image proxy maps oversized responses to 413", async () => {
	class TestTooLargeError extends Error {
		constructor() {
			super("too large");
			this.statusCode = 413;
		}
	}

	await withServer({
		fetchFn: async () => new Response(Buffer.from([1]), {
			headers: { "content-type": "image/png" },
			status: 200,
		}),
		imageProxyResponseTooLargeError: TestTooLargeError,
		parseImageProxyTargetFn: () => ({
			source: "figma",
			targetUrl: new URL("https://www.figma.com/api/mcp/asset/image.png"),
		}),
		readImageProxyPayload: async () => {
			throw new TestTooLargeError();
		},
	}, async (baseUrl) => {
		const response = await fetch(`${baseUrl}/api/image-proxy?src=https://www.figma.com/api/mcp/asset/image.png`);

		assert.equal(response.status, 413);
		assert.deepEqual(await response.json(), { error: "Image response is too large" });
	});
});

test("image proxy maps abort errors to a timeout response", async () => {
	await withServer({
		fetchFn: async () => {
			const error = new Error("aborted");
			error.name = "AbortError";
			throw error;
		},
		parseImageProxyTargetFn: () => ({
			source: "figma",
			targetUrl: new URL("https://www.figma.com/api/mcp/asset/image.png"),
		}),
	}, async (baseUrl) => {
		const response = await fetch(`${baseUrl}/api/image-proxy?src=https://www.figma.com/api/mcp/asset/image.png`);

		assert.equal(response.status, 504);
		assert.deepEqual(await response.json(), { error: "Image fetch timed out" });
	});
});

test("image proxy responses are sandboxed and typed by the same rule as uploads", async () => {
	const { FILE_RESPONSE_SECURITY_HEADERS } = require("../lib/upload-response-headers");
	const targetUrl = new URL("https://www.figma.com/api/mcp/asset/image");
	const cases = [
		["image/png", "image/png", "inline"],
		["image/svg+xml", "image/svg+xml", "inline"],
		["image/jpg", "image/jpeg", "inline"],
		["image/tiff", "application/octet-stream", "attachment"],
		["image/svg+xml; charset=utf-8", "image/svg+xml", "inline"],
	];
	for (const [upstreamType, servedType, disposition] of cases) {
		await withServer({
			fetchFn: async () => new Response("<svg xmlns='http://www.w3.org/2000/svg'><script>parent.x=1</script></svg>", {
				headers: { "content-type": upstreamType },
				status: 200,
			}),
			parseImageProxyTargetFn: () => ({ source: "figma", targetUrl }),
		}, async (baseUrl) => {
			const response = await fetch(`${baseUrl}/api/image-proxy?src=x`);
			assert.equal(response.status, 200, upstreamType);
			assert.equal(response.headers.get("content-type"), servedType, upstreamType);
			assert.equal(response.headers.get("content-disposition").split(";")[0], disposition, upstreamType);
			for (const [name, value] of Object.entries(FILE_RESPONSE_SECURITY_HEADERS)) {
				assert.equal(response.headers.get(name), value, `${upstreamType} ${name}`);
			}
			await response.arrayBuffer();
		});
	}
});
