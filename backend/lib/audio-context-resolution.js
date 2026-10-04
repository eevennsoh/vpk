"use strict";

const { audioContextResolver: resolver } = require("./media-context-resolution");

module.exports = {
	AUDIO_CONTEXT_CLARIFICATION_SESSION_PREFIX: resolver.sessionPrefix,
	AUDIO_CONTEXT_QUESTION_ID: resolver.questionId,
	AUDIO_CONTEXT_LITERAL_OPTION_ID: resolver.literalOptionId,
	collectAudioTextCandidates: resolver.collectCandidates,
	isContextReferentialAudioRequest: resolver.isReferential,
	resolveReferencedAudioText: resolver.resolveReference,
	buildAudioContextClarificationPayload: resolver.buildClarification,
	isAudioContextClarificationSession: resolver.isSession,
	resolveAudioContextVoiceInputFromClarification: resolver.resolveClarification,
};
