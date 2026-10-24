const { EventEmitter } = require("node:events");
const { PassThrough, Readable } = require("node:stream");

function normalizeHeaderEntries(input) {
	if (!input || typeof input !== "object") {
		return [];
	}

	if (typeof input.entries === "function") {
		return Array.from(input.entries());
	}

	return Object.entries(input);
}

function requireFunction(name, value) {
	if (typeof value !== "function") {
		throw new Error(`dispatchInProcessHttpRequest requires ${name}`);
	}
	return value;
}

function setHeaderValue(store, name, value) {
	const normalizedName = String(name).toLowerCase();
	if (Array.isArray(value)) {
		store.set(normalizedName, value.map((entry) => String(entry)));
		return;
	}

	store.set(normalizedName, String(value));
}

function appendHeaders(target, sourceMap) {
	for (const [name, value] of sourceMap.entries()) {
		if (Array.isArray(value)) {
			for (const entry of value) {
				target.append(name, entry);
			}
			continue;
		}

		target.set(name, value);
	}
}

function createInProcessRequest({
	body,
	headers,
	protocol = "http",
	signal,
} = {}) {
	const request = new EventEmitter();
	const headerMap = new Map();
	for (const [name, value] of normalizeHeaderEntries(headers)) {
		if (value === undefined || value === null) {
			continue;
		}
		setHeaderValue(headerMap, name, value);
	}

	request.body = body;
	request.protocol = protocol;
	request.get = (name) => {
		const value = headerMap.get(String(name).toLowerCase());
		if (Array.isArray(value)) {
			return value.join(", ");
		}
		return value;
	};

	if (signal && typeof signal.addEventListener === "function") {
		const emitAbort = () => {
			request.emit("aborted");
			request.emit("close");
		};

		if (signal.aborted) {
			queueMicrotask(emitAbort);
		} else {
			signal.addEventListener("abort", emitAbort, { once: true });
		}
	}

	return request;
}

function createCapturedResponse() {
	const response = new EventEmitter();
	const bodyStream = new PassThrough();
	const headers = new Map();
	let resolveHeadersReady;
	const headersReadyPromise = new Promise((resolve) => {
		resolveHeadersReady = resolve;
	});

	function markHeadersReady() {
		resolveHeadersReady?.();
		resolveHeadersReady = null;
	}

	response.statusCode = 200;
	response.statusMessage = undefined;
	response.headersSent = false;
	response.writableFinished = false;

	bodyStream.on("drain", () => {
		response.emit("drain");
	});

	bodyStream.on("error", (error) => {
		response.emit("error", error);
	});

	response.status = (statusCode) => {
		response.statusCode = statusCode;
		return response;
	};

	response.setHeader = (name, value) => {
		setHeaderValue(headers, name, value);
		return response;
	};

	response.setHeaders = (values) => {
		for (const [name, value] of normalizeHeaderEntries(values)) {
			response.setHeader(name, value);
		}
		return response;
	};

	response.getHeader = (name) => headers.get(String(name).toLowerCase());

	response.writeHead = (statusCode, statusTextOrHeaders, maybeHeaders) => {
		response.statusCode = statusCode;

		let headerValues = maybeHeaders;
		if (
			statusTextOrHeaders &&
			typeof statusTextOrHeaders === "object" &&
			!Array.isArray(statusTextOrHeaders)
		) {
			headerValues = statusTextOrHeaders;
			response.statusMessage = undefined;
		} else if (typeof statusTextOrHeaders === "string") {
			response.statusMessage = statusTextOrHeaders;
		}

		for (const [name, value] of normalizeHeaderEntries(headerValues)) {
			if (value === undefined || value === null) {
				continue;
			}
			setHeaderValue(headers, name, value);
		}

		response.headersSent = true;
		markHeadersReady();
		return response;
	};

	response.flushHeaders = () => {
		response.headersSent = true;
		markHeadersReady();
	};

	response.write = (chunk) => {
		response.headersSent = true;
		markHeadersReady();
		return bodyStream.write(chunk);
	};

	response.end = (chunk) => {
		if (chunk !== undefined) {
			response.write(chunk);
		}

		if (!response.writableFinished) {
			response.writableFinished = true;
			bodyStream.end();
			markHeadersReady();
			response.emit("finish");
		}

		return response;
	};

	response.json = (payload) => {
		if (!headers.has("content-type")) {
			response.setHeader("Content-Type", "application/json; charset=utf-8");
		}
		response.end(JSON.stringify(payload));
		return response;
	};

	response.toWebResponse = () => {
		const responseHeaders = new Headers();
		appendHeaders(responseHeaders, headers);
		return new Response(Readable.toWeb(bodyStream), {
			status: response.statusCode,
			statusText: response.statusMessage,
			headers: responseHeaders,
		});
	};

	response.waitForHeaders = async () => {
		if (response.headersSent || response.writableFinished) {
			markHeadersReady();
			return;
		}

		await headersReadyPromise;
	};

	return response;
}

async function pipeWebResponseToExpressResponse(webResponse, res) {
	res.status(webResponse.status);
	webResponse.headers.forEach((value, key) => {
		if (key.toLowerCase() !== "content-length") {
			res.setHeader(key, value);
		}
	});

	if (!webResponse.body) {
		res.end();
		return;
	}

	const reader = webResponse.body.getReader();
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}
			if (value) {
				res.write(Buffer.from(value));
			}
		}
	} finally {
		reader.releaseLock();
		res.end();
	}
}

async function dispatchInProcessHttpRequest({
	body,
	createRequest = createInProcessRequest,
	createResponse = createCapturedResponse,
	handleRequest,
	headers,
	protocol = "http",
	signal,
} = {}) {
	requireFunction("createRequest", createRequest);
	requireFunction("createResponse", createResponse);
	requireFunction("handleRequest", handleRequest);

	const req = createRequest({
		body,
		headers,
		protocol,
		signal,
	});
	const res = createResponse();
	await handleRequest(req, res);
	return res.toWebResponse();
}

module.exports = {
	createCapturedResponse,
	createInProcessRequest,
	dispatchInProcessHttpRequest,
	pipeWebResponseToExpressResponse,
};
