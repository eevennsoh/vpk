"use strict";

function hasStructuredContinuationBody(requestBody) {
	if (!requestBody || typeof requestBody !== "object") {
		return false;
	}

	return Boolean(
		requestBody.clarification ||
		requestBody.approval ||
		requestBody.deferredToolResponse
	);
}

module.exports = {
	hasStructuredContinuationBody,
};
