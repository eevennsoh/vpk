import { proxyToBackend } from "@/app/api/_utils/proxy";
import { readJsonBody } from "@/app/api/_utils/read-json-body";
import { refuseNonLocalRequest } from "@/app/api/_utils/local-request";

export async function GET() {
	return proxyToBackend({
		method: "GET",
		path: "/api/personal-graph/source",
	});
}

export async function POST(request: Request) {
	const refused = refuseNonLocalRequest(request);
	if (refused) {
		return refused;
	}

	const { body, errorResponse } = await readJsonBody(request, {
		defaultBody: {},
		required: false,
	});
	if (errorResponse) {
		return errorResponse;
	}

	return proxyToBackend({
		method: "POST",
		path: "/api/personal-graph/source",
		body: body ?? {},
	});
}
