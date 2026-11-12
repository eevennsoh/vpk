import { type NextRequest } from "next/server";
import { proxyToBackend } from "@/app/api/_utils/proxy";
import { readJsonBody } from "@/app/api/_utils/read-json-body";
import { refuseNonLocalRequest } from "@/app/api/_utils/local-request";

export async function POST(request: NextRequest) {
	const refused = refuseNonLocalRequest(request);
	if (refused) {
		return refused;
	}

	const { body, errorResponse } = await readJsonBody(request);
	if (errorResponse) {
		return errorResponse;
	}
	return proxyToBackend({
		body,
		expectEventStream: true,
		method: "POST",
		path: "/api/personal-graph/summarize",
		signal: request.signal,
	});
}
