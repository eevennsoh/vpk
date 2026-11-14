// @ts-check
"use strict";

const express = require("express");

const { createAbortControllerFromRequest } = require("../lib/http-request-abort");
const { parseOrReject, speechTranscriptionOptionsSchema } = require("../lib/input-schemas");
const {
	IMAGE_PROXY_MAX_HTML_BYTES,
	IMAGE_PROXY_MAX_UPSTREAM_FETCHES,
	ImageProxyResponseTooLargeError,
	buildImageProxyRequestHeaders,
	deriveAtlassianImageCandidatesFromUrl,
	extractAtlassianImageCandidatesFromHtml,
	fetchImageProxyUrl,
	parseImageProxyTarget,
	readImageProxyResponsePayload,
} = require("../lib/image-proxy");
const { resolveSpeechPayloadFromAudioRequest } = require("../lib/audio-input-extractor");
const { synthesizeSound } = require("../lib/sound-generation");
const { transcribeAudio } = require("../lib/speech-transcription");
const { getNonEmptyString } = require("../lib/shared-utils");
const {
	FILE_RESPONSE_SECURITY_HEADERS,
	buildContentDisposition,
	decideFileMediaType,
} = require("../lib/upload-response-headers");

const SOUND_GENERATION_INPUT_MAX_CHARS = 4096;
const IMAGE_PROXY_TIMEOUT_MS = 15_000;

function isAbortError(error) {
	return (
		typeof error === "object" &&
		error !== null &&
		"name" in error &&
		error.name === "AbortError"
	);
}

function createMediaRouter({
	abortControllerFromRequest = createAbortControllerFromRequest,
	abortControllerConstructor = AbortController,
	buildImageProxyHeaders = buildImageProxyRequestHeaders,
	deriveAtlassianImageCandidates = deriveAtlassianImageCandidatesFromUrl,
	extractAtlassianImageCandidates = extractAtlassianImageCandidatesFromHtml,
	fetchFn = globalThis.fetch,
	getString = getNonEmptyString,
	imageProxyResponseTooLargeError = ImageProxyResponseTooLargeError,
	imageProxyTimeoutMs = IMAGE_PROXY_TIMEOUT_MS,
	now = Date.now,
	parseImageProxyTargetFn = parseImageProxyTarget,
	readImageProxyPayload = readImageProxyResponsePayload,
	resolveSpeechPayload = resolveSpeechPayloadFromAudioRequest,
	soundInputMaxChars = SOUND_GENERATION_INPUT_MAX_CHARS,
	synthesizeSoundFn = synthesizeSound,
	transcribeAudioFn = transcribeAudio,
} = {}) {
	if (typeof abortControllerFromRequest !== "function") {
		throw new Error("createMediaRouter requires abortControllerFromRequest");
	}
	if (typeof abortControllerConstructor !== "function") {
		throw new Error("createMediaRouter requires abortControllerConstructor");
	}
	if (typeof buildImageProxyHeaders !== "function") {
		throw new Error("createMediaRouter requires buildImageProxyHeaders");
	}
	if (typeof deriveAtlassianImageCandidates !== "function") {
		throw new Error("createMediaRouter requires deriveAtlassianImageCandidates");
	}
	if (typeof extractAtlassianImageCandidates !== "function") {
		throw new Error("createMediaRouter requires extractAtlassianImageCandidates");
	}
	if (typeof fetchFn !== "function") {
		throw new Error("createMediaRouter requires fetchFn");
	}
	if (typeof getString !== "function") {
		throw new Error("createMediaRouter requires getString");
	}
	if (typeof now !== "function") {
		throw new Error("createMediaRouter requires now");
	}
	if (typeof parseImageProxyTargetFn !== "function") {
		throw new Error("createMediaRouter requires parseImageProxyTargetFn");
	}
	if (typeof readImageProxyPayload !== "function") {
		throw new Error("createMediaRouter requires readImageProxyPayload");
	}
	if (typeof resolveSpeechPayload !== "function") {
		throw new Error("createMediaRouter requires resolveSpeechPayload");
	}
	if (typeof synthesizeSoundFn !== "function") {
		throw new Error("createMediaRouter requires synthesizeSoundFn");
	}
	if (typeof transcribeAudioFn !== "function") {
		throw new Error("createMediaRouter requires transcribeAudioFn");
	}

	const router = express.Router();

	router.post("/sound-generation", async (req, res) => {
		try {
			const requestBody =
				req.body && typeof req.body === "object" ? { ...req.body } : {};
			const { payload: normalizedInput, mode: extractionMode } =
				resolveSpeechPayload(requestBody.input, {
					maxChars: soundInputMaxChars,
				});
			if (normalizedInput) {
				requestBody.input = normalizedInput;
			}

			console.info("[SOUND-GENERATION] Resolved speech payload", {
				extractionMode: extractionMode || null,
				hasInput: typeof requestBody.input === "string",
				payloadLength:
					typeof requestBody.input === "string" ? requestBody.input.length : 0,
			});

			const synthesisResult = await synthesizeSoundFn(requestBody);
			const filename = `speech-${now()}.${synthesisResult.extension}`;

			res.setHeader("Content-Type", synthesisResult.contentType);
			res.setHeader("Content-Length", String(synthesisResult.audioBytes.length));
			res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
			return res.status(200).send(synthesisResult.audioBytes);
		} catch (error) {
			console.error("Sound generation API error:", error);
			const statusCode =
				typeof error?.statusCode === "number" ? error.statusCode : 500;
			return res.status(statusCode).json({
				error:
					statusCode >= 500
						? "Internal server error"
						: error instanceof Error
							? error.message
							: "Request failed",
				details: error instanceof Error ? error.message : String(error),
			});
		}
	});

	router.post("/speech-transcription", async (req, res) => {
		const { abortController, cleanup } = abortControllerFromRequest(req, res, {
			onAbort: () => {
				console.log("[SPEECH-TRANSCRIPTION] Client disconnected, aborting transcription");
			},
		});

		try {
			const { audio, language: rawLanguage, mimeType: rawMimeType, model: rawModel, provider: rawProvider } = req.body || {};
			if (!audio || typeof audio !== "string") {
				return res.status(400).json({ error: "Base64 audio data is required" });
			}
			// provider and model choose the process and model file whisper loads, and the
			// model goes into the gateway URL; empty values mean "use the preset", as before.
			const options = parseOrReject(res, speechTranscriptionOptionsSchema, {
				language: rawLanguage || undefined,
				mimeType: rawMimeType || undefined,
				model: rawModel || undefined,
				provider: rawProvider || undefined,
			}, "body");
			if (!options) {
				return undefined;
			}
			const { language, mimeType, model, provider } = options;

			console.info("[SPEECH-TRANSCRIPTION] Transcribing audio", {
				language: language || null,
				mimeType: mimeType || "audio/webm",
				audioLength: audio.length,
				model: model || null,
				provider: provider || `(preset: ${process.env.STT_PRESET || "none"})`,
			});

			const text = await transcribeAudioFn({
				audio,
				language,
				mimeType,
				model,
				provider,
				signal: abortController.signal,
			});
			return res.status(200).json({ text });
		} catch (error) {
			if (isAbortError(error) && (abortController.signal.aborted || req.aborted || res.destroyed)) {
				return;
			}

			console.error("Speech transcription API error:", error);
			const statusCode =
				typeof error?.statusCode === "number" ? error.statusCode : 500;
			return res.status(statusCode).json({
				error:
					statusCode >= 500
						? "Internal server error"
						: error instanceof Error
							? error.message
							: "Request failed",
			});
		} finally {
			cleanup();
		}
	});

	router.get("/image-proxy", async (req, res) => {
		const rawSrc = Array.isArray(req.query.src) ? req.query.src[0] : req.query.src;
		const { targetUrl, source, error } = parseImageProxyTargetFn(rawSrc);
		if (error) {
			return res.status(400).json({ error });
		}

		const abortController = new abortControllerConstructor();
		const timeoutHandle = setTimeout(() => {
			abortController.abort();
		}, imageProxyTimeoutMs);

		try {
			const candidateQueue = [
				targetUrl,
				...(source === "atlassian"
					? deriveAtlassianImageCandidates(targetUrl)
					: []),
			];
			const attemptedUrls = new Set();
			const upstreamBudget = { remaining: IMAGE_PROXY_MAX_UPSTREAM_FETCHES };
			let budgetExhausted = false;
			/** @type {number | null} */
			let lastStatus = null;

			while (candidateQueue.length > 0 && attemptedUrls.size < 8) {
				const currentUrl = candidateQueue.shift();
				if (!currentUrl) {
					continue;
				}

				const currentUrlString = currentUrl.toString();
				if (attemptedUrls.has(currentUrlString)) {
					continue;
				}
				attemptedUrls.add(currentUrlString);

				const fetched = await fetchImageProxyUrl(currentUrl, {
					budget: upstreamBudget,
					buildHeaders: buildImageProxyHeaders,
					fetchFn,
					signal: abortController.signal,
				});
				if ("budgetExhausted" in fetched) {
					budgetExhausted = true;
					break;
				}
				if ("refusedStatus" in fetched) {
					lastStatus = fetched.refusedStatus;
					continue;
				}
				const { response: upstreamResponse, url: finalUrl, authenticated } = fetched;

				if (!upstreamResponse.ok) {
					lastStatus = upstreamResponse.status;
					await upstreamResponse.body?.cancel?.().catch?.(() => {});
					continue;
				}

				const contentType =
					getString(upstreamResponse.headers.get("content-type")) ||
					"application/octet-stream";

				if (contentType.toLowerCase().startsWith("image/")) {
					const payload = await readImageProxyPayload(upstreamResponse);
					const upstreamCacheControl = getString(
						upstreamResponse.headers.get("cache-control")
					);
					// The upstream's type is served by the same rule as an upload: an image
					// type outside that list is a download with a neutral type, and the
					// response is sandboxed either way, since it is served on this origin.
					const served = decideFileMediaType(contentType);

					res.setHeader("Content-Type", served.contentType);
					res.setHeader("Content-Disposition", buildContentDisposition(served.inline ? "inline" : "attachment", "image"));
					for (const [name, value] of Object.entries(FILE_RESPONSE_SECURITY_HEADERS)) {
						res.setHeader(name, value);
					}
					res.setHeader("Content-Length", String(payload.length));
					// An image fetched with the server's token is never cacheable by a shared
					// cache, whatever the upstream said.
					res.setHeader(
						"Cache-Control",
						authenticated
							? "private, max-age=300"
							: upstreamCacheControl || "public, max-age=300, stale-while-revalidate=300"
					);

					return res.status(200).send(payload);
				}

				// A body that is not an image is read only as an Atlassian page, and only up
				// to IMAGE_PROXY_MAX_HTML_BYTES; anything else is dropped unread.
				if (source !== "atlassian") {
					await upstreamResponse.body?.cancel?.().catch?.(() => {});
					continue;
				}
				let htmlText;
				try {
					htmlText = (await readImageProxyPayload(upstreamResponse, { maxBytes: IMAGE_PROXY_MAX_HTML_BYTES })).toString("utf8");
				} catch (error) {
					if (error instanceof imageProxyResponseTooLargeError) {
						continue;
					}
					throw error;
				}
				for (const derivedUrl of extractAtlassianImageCandidates(
					htmlText,
					finalUrl
				)) {
					candidateQueue.push(derivedUrl);
				}
			}

			return res.status(502).json({
				error: budgetExhausted
					? `Image fetch gave up after ${IMAGE_PROXY_MAX_UPSTREAM_FETCHES} upstream requests`
					: lastStatus !== null
						? `Image fetch failed (${lastStatus})`
						: "Upstream response is not an image",
			});
		} catch (error) {
			if (error instanceof imageProxyResponseTooLargeError) {
				return res.status(error.statusCode).json({
					error: "Image response is too large",
				});
			}

			return res.status(isAbortError(error) ? 504 : 502).json({
				error: isAbortError(error) ? "Image fetch timed out" : "Image proxy failed",
			});
		} finally {
			clearTimeout(timeoutHandle);
		}
	});

	return router;
}

function registerMediaRoutes(app, dependencies) {
	app.use("/api", createMediaRouter(dependencies));
}

module.exports = {
	IMAGE_PROXY_TIMEOUT_MS,
	SOUND_GENERATION_INPUT_MAX_CHARS,
	createMediaRouter,
	registerMediaRoutes,
};
