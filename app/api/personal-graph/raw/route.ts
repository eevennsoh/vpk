import { NextResponse, type NextRequest } from "next/server";
import { fetchBackend, getBackendUrlCandidates, BackendConnectionError } from "@/app/api/_utils/backend-url";
import { proxyToBackend } from "@/app/api/_utils/proxy";
import { readJsonBody } from "@/app/api/_utils/read-json-body";
import { refuseNonLocalRequest } from "@/app/api/_utils/local-request";

export async function POST(request: NextRequest) {
	const refused = refuseNonLocalRequest(request);
	if (refused) {
		return refused;
	}

	const contentType = request.headers.get("content-type") ?? "";
	if (contentType.includes("multipart/form-data")) {
		try {
			const response = (await fetchBackend("/api/personal-graph/raw", {
				body: await request.arrayBuffer(),
				headers: { "Content-Type": contentType },
				method: "POST",
				signal: request.signal,
			})).response;
			const data = await response.json();
			return NextResponse.json(data, { status: response.status });
		} catch (error) {
			const backendUrls = error instanceof BackendConnectionError ? error.backendUrls : getBackendUrlCandidates();
			return NextResponse.json({
				backendUrls,
				error: "Cannot connect to backend server",
			}, { status: 503 });
		}
	}

	const { body, errorResponse } = await readJsonBody(request);
	if (errorResponse) {
		return errorResponse;
	}
	return proxyToBackend({
		body,
		method: "POST",
		path: "/api/personal-graph/raw",
	});
}
