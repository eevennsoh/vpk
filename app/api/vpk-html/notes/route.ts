import { type NextRequest } from "next/server";
import { proxyToBackend } from "@/app/api/_utils/proxy";
import { readJsonBody } from "@/app/api/_utils/read-json-body";
import { refuseNonLocalRequest } from "@/app/api/_utils/local-request";

export async function GET(request: NextRequest) {
	const search = new URL(request.url).search;

	return proxyToBackend({
		method: "GET",
		path: `/api/vpk-html/notes${search}`,
	});
}

export async function PUT(request: NextRequest) {
	const refused = refuseNonLocalRequest(request);
	if (refused) {
		return refused;
	}

	const { body, errorResponse } = await readJsonBody(request);
	if (errorResponse) {
		return errorResponse;
	}

	const search = new URL(request.url).search;

	return proxyToBackend({
		method: "PUT",
		path: `/api/vpk-html/notes${search}`,
		body,
	});
}
