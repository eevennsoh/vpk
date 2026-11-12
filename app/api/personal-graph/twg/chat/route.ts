import { NextResponse } from "next/server";
import { fetchBackend } from "@/app/api/_utils/backend-url";
import { refuseNonLocalRequest } from "@/app/api/_utils/local-request";

export async function POST(request: Request) {
	const refused = refuseNonLocalRequest(request);
	if (refused) {
		return refused;
	}

	const rawBody = await request.text();
	let response: Response;
	try {
		const result = await fetchBackend("/api/personal-graph/twg/chat", {
			body: rawBody || "{}",
			headers: { "Content-Type": "application/json" },
			method: "POST",
			signal: request.signal,
		});
		response = result.response;
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Failed to reach backend" },
			{ status: 502 },
		);
	}

	if (!response.ok && !response.body) {
		const errorText = await response.text();
		return NextResponse.json({ error: errorText || "Backend chat failed" }, { status: response.status });
	}

	const headers = new Headers();
	headers.set("Content-Type", "application/x-ndjson; charset=utf-8");
	headers.set("Cache-Control", "no-cache, no-transform");
	headers.set("X-Accel-Buffering", "no");

	return new NextResponse(response.body, {
		headers,
		status: response.status,
	});
}
