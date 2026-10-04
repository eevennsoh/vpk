"use strict";

const { imageContextResolver: resolver } = require("./media-context-resolution");

module.exports = {
	IMAGE_CONTEXT_CLARIFICATION_SESSION_PREFIX: resolver.sessionPrefix,
	IMAGE_CONTEXT_QUESTION_ID: resolver.questionId,
	IMAGE_CONTEXT_LITERAL_OPTION_ID: resolver.literalOptionId,
	collectImageContextCandidates: resolver.collectCandidates,
	isContextReferentialImageRequest: resolver.isReferential,
	resolveReferencedImageContext: resolver.resolveReference,
	buildImageContextClarificationPayload: resolver.buildClarification,
	isImageContextClarificationSession: resolver.isSession,
	resolveImageContextFromClarification: resolver.resolveClarification,
};
