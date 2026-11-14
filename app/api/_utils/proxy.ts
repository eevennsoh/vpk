import { NextResponse } from "next/server";
import {
	BackendConnectionError,
	fetchBackend,
	getBackendUrlCandidates,
} from "@/app/api/_utils/backend-url";

interface ProxyRequestOptions {
	method: "GET" | "HEAD" | "OPTIONS" | "POST" | "PUT" | "PATCH" | "DELETE";
	path: string;
	body?: unknown;
	rawBody?: string;
	contentType?: string;
	expectEventStream?: boolean;
	hasIdempotencyContract?: boolean;
	signal?: AbortSignal;
}

export function buildErrorMessage(rawText: string): string {
	const trimmedText = rawText.trim();
	if (!trimmedText) {
		return "Backend request failed";
	}

	try {
		const parsed = JSON.parse(trimmedText) as {
			error?: unknown;
			message?: unknown;
			details?: unknown;
		};
		if (typeof parsed.error === "string" && parsed.error.trim()) {
			return parsed.error.trim();
		}
		if (typeof parsed.message === "string" && parsed.message.trim()) {
			return parsed.message.trim();
		}
		if (typeof parsed.details === "string" && parsed.details.trim()) {
			return parsed.details.trim();
		}
	} catch {
		// Ignore JSON parse errors for plain-text responses.
	}

	return trimmedText;
}

async function isBackendApiRouteNotFoundResponse(
	response: Response,
	path: string,
): Promise<boolean> {
	if (response.status !== 404) {
		return false;
	}

	return buildErrorMessage(await response.text()) === `API route not found: ${path}`;
}

function getBackendConnectionDetails(error: BackendConnectionError): string {
	if (error.stateChangingTransportFailure) {
		return [
			`Backend request result is unknown after a ${error.method} transport failure.`,
			"Automatic replay is disabled for state-changing methods without an idempotency contract.",
		].join(" ");
	}

	return error.message;
}

export async function proxyToBackend(
	options: Readonly<ProxyRequestOptions>
): Promise<NextResponse> {
	let response: Response;
	try {
		const resolvedContentType = options.contentType ?? "application/json";
		let resolvedBody: string | undefined;
		if (
			options.method === "POST" ||
			options.method === "PUT" ||
			options.method === "PATCH" ||
			options.method === "DELETE"
		) {
			if (options.rawBody !== undefined) {
				resolvedBody = options.rawBody;
			} else if (options.body !== undefined) {
				resolvedBody = JSON.stringify(options.body);
			}
		}

		response = (
			await fetchBackend(options.path, {
				method: options.method,
				headers: {
					"Content-Type": resolvedContentType,
				},
				body: resolvedBody,
				hasIdempotencyContract: options.hasIdempotencyContract === true,
				signal: options.signal,
				shouldRetryResponse: (candidateResponse) =>
					isBackendApiRouteNotFoundResponse(candidateResponse, options.path),
			})
		).response;
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") {
			return new NextResponse(null, { status: 204 });
		}

		const backendUrls =
			error instanceof BackendConnectionError
				? error.backendUrls
				: getBackendUrlCandidates();
		const attemptedBackendUrls =
			error instanceof BackendConnectionError
				? error.attemptedBackendUrls
				: backendUrls;

		return NextResponse.json(
			{
				error: "Cannot connect to backend server",
				details:
					error instanceof BackendConnectionError
						? getBackendConnectionDetails(error)
						: error instanceof Error ? error.message : String(error),
				backendUrls,
				attemptedBackendUrls,
				path: options.path,
			},
			{ status: 503 }
		);
	}

	if (!response.ok) {
		const errorText = await response.text();
		return NextResponse.json(
			{ error: buildErrorMessage(errorText) },
			{ status: response.status }
		);
	}

	const contentType = response.headers.get("content-type") || "";
	if (options.expectEventStream || contentType.includes("text/event-stream")) {
		const headers = new Headers();
		headers.set("Content-Type", "text/event-stream");
		headers.set("Cache-Control", response.headers.get("cache-control") || "no-cache, no-transform");
		headers.set("X-Accel-Buffering", "no");
		return new NextResponse(response.body, {
			status: response.status,
			headers,
		});
	}

	if (contentType.includes("application/json")) {
		const data = (await response.json()) as unknown;
		return NextResponse.json(data, { status: response.status });
	}

	const headers = new Headers();
	if (contentType) {
		headers.set("Content-Type", contentType);
	}

	const contentDisposition = response.headers.get("content-disposition");
	if (contentDisposition) {
		headers.set("Content-Disposition", contentDisposition);
	}

	const contentLength = response.headers.get("content-length");
	if (contentLength) {
		headers.set("Content-Length", contentLength);
	}

	// File responses (uploads, generated media) are sandboxed by the backend; the proxy
	// serves them on the app's origin, so it keeps that sandbox and nosniff.
	for (const name of ["Content-Security-Policy", "X-Content-Type-Options"]) {
		const value = response.headers.get(name);
		if (value) {
			headers.set(name, value);
		}
	}

	return new NextResponse(response.body, {
		status: response.status,
		headers,
	});
}
