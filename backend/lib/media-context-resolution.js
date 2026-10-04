"use strict";

const { clipToMaxChars, normalizeSpeechPayload } = require("./audio-input-extractor");
const { getNonEmptyString, extractTextFromUiParts } = require("./shared-utils");

const DEFAULT_CONTEXT_WINDOW_SIZE = 16;
const DEFAULT_CANDIDATE_LIMIT = 24;
const DEFAULT_CLARIFICATION_OPTION_LIMIT = 3;
const DEFAULT_CONFIDENCE_THRESHOLD = 0.72;
const DEFAULT_AMBIGUITY_THRESHOLD = 0.08;
const DEFAULT_MIN_SUBSTANTIVE_CHARS = 24;

const QUOTED_SEGMENT_PATTERN =
	/"([^"\n]{2,200})"|"([^"\n]{2,200})"|`([^`\n]{2,200})`|'([^'\n]{2,200})'/gu;

const IMAGE_POLICY = {
	sessionPrefix: "image-context-clarification-",
	questionId: "image_context",
	literalOptionId: "image-context-literal-request",
	optionPrefix: "image-context-option-",
	outputField: "contextText",
	allowImplicitReference: false,
	normalizeInput: getNonEmptyString,
	widgets: [
		{ type: "image-preview", field: "prompt", kind: "image-prompt" },
		{ type: "genui-preview", field: "summary", kind: "genui-description" },
	],
	sourceSuffixes: { "image-prompt": " (image prompt)", "genui-description": " (UI summary)" },
	title: "Choose context for the image",
	description: "I found multiple possible contexts in this chat. Pick one, or describe what to illustrate.",
	questionLabel: "Which context should I use for the image?",
	placeholder: "Describe what to illustrate...",
	literalDescription: "Use your latest request text as the image prompt.",
	customSource: "clarification-custom-description",
	referentialPatterns: [
		/\b(?:above|earlier|previous|prior|same|entire|full|whole)\b/i,
		/\b(?:in|from)\s+(?:the\s+)?(?:above\s+)?(?:chat|conversation)\b/i,
		/\b(?:last|previous)\s+(?:response|message|reply)\b/i,
		/\b(?:that|this|it)\s+(?:poem|story|article|summary|text|response|message|character|scene|description)\b/i,
		/\b(?:poem|story|article|summary|text|response|message|character|scene|description)\b[\s\S]{0,24}\b(?:above|previous|earlier|entire|full|whole|that|this|it)\b/i,
		/\b(?:draw|illustrate|picture|image|depict|visualize|sketch)\b[\s\S]{0,32}\b(?:that|this|it|above|earlier|previous|what\s+we\s+discussed)\b/i,
		/\b(?:based\s+on|from)\b[\s\S]{0,32}\b(?:above|earlier|previous|prior|conversation|chat|discussion)\b/i,
	],
	phrasePatterns: [
		/\b(?:for|about|from|of)\s+(?:the\s+)?([a-z0-9][a-z0-9\s'-]{2,80})\s+(?:poem|story|article|summary|response|message|text|character|scene|description)\b/giu,
		/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,5})\s+(?:poem|story|article|summary|response|message|text|character|scene|description)\b/gu,
	],
	stopwords: new Set([
		"a",
		"an",
		"and",
		"are",
		"as",
		"at",
		"be",
		"but",
		"by",
		"can",
		"create",
		"depict",
		"do",
		"draw",
		"for",
		"from",
		"generate",
		"i",
		"illustrate",
		"image",
		"in",
		"is",
		"it",
		"make",
		"of",
		"on",
		"or",
		"photo",
		"picture",
		"please",
		"render",
		"show",
		"sketch",
		"that",
		"the",
		"this",
		"to",
		"visualize",
		"with",
	]),
};

const AUDIO_POLICY = {
	sessionPrefix: "audio-context-clarification-",
	questionId: "audio_source",
	literalOptionId: "audio-context-literal-request",
	optionPrefix: "audio-context-option-",
	outputField: "voiceInput",
	allowImplicitReference: true,
	normalizeInput: normalizeSpeechPayload,
	widgets: [{ type: "audio-preview", field: "transcript", kind: "audio-transcript" }],
	sourceSuffixes: { "audio-transcript": " transcript" },
	title: "Choose text for the audio clip",
	description: "I found multiple possible passages in this chat. Pick one, or type the exact text to read aloud.",
	questionLabel: "Which text should I read aloud?",
	placeholder: "Paste exact text to read aloud...",
	literalDescription: "Use your latest request text exactly as typed.",
	customSource: "clarification-custom-script",
	referentialPatterns: [
		/\b(?:above|earlier|previous|prior|same|entire|full|whole)\b/i,
		/\b(?:in|from)\s+(?:the\s+)?(?:above\s+)?(?:chat|conversation)\b/i,
		/\b(?:last|previous)\s+(?:response|message|reply)\b/i,
		/\b(?:that|this|it)\s+(?:poem|story|article|summary|text|response|message)\b/i,
		/\b(?:poem|story|article|summary|text|response|message)\b[\s\S]{0,24}\b(?:above|previous|earlier|entire|full|whole|that|this|it)\b/i,
	],
	phrasePatterns: [
		/\b(?:for|about|from|of)\s+(?:the\s+)?([a-z0-9][a-z0-9\s'-]{2,80})\s+(?:poem|story|article|summary|response|message|text)\b/giu,
		/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,5})\s+(?:poem|story|article|summary|response|message|text)\b/gu,
	],
	stopwords: new Set([
		"a",
		"an",
		"and",
		"are",
		"as",
		"at",
		"be",
		"but",
		"by",
		"can",
		"clip",
		"create",
		"do",
		"for",
		"from",
		"generate",
		"i",
		"in",
		"is",
		"it",
		"make",
		"of",
		"on",
		"or",
		"please",
		"read",
		"say",
		"speak",
		"speech",
		"tell",
		"text",
		"that",
		"the",
		"this",
		"to",
		"tts",
		"voice",
		"with",
	]),
};

function createMediaContextResolver(policy) {
	function sanitizeOptionToken(value) {
		return String(value)
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/-+/g, "-")
			.replace(/^-|-$/g, "");
	}

	function buildCandidateOptionId({
		messageId,
		messageIndex,
		candidateKind,
	}) {
		const candidateKindToken = sanitizeOptionToken(candidateKind || "text") || "text";
		const sourceToken = messageId
			? sanitizeOptionToken(messageId)
			: `idx-${messageIndex}`;
		return `${policy.optionPrefix}${sourceToken}-${candidateKindToken}`;
	}

	function clipText(value, maxChars = 120) {
		const normalizedValue = getNonEmptyString(value);
		if (!normalizedValue) {
			return "";
		}

		if (normalizedValue.length <= maxChars) {
			return normalizedValue;
		}

		return `${normalizedValue.slice(0, Math.max(1, maxChars - 3)).trimEnd()}...`;
	}

	function collapseWhitespace(value) {
		return value.replace(/\s+/gu, " ").trim();
	}

	function getFirstNonEmptyLine(value) {
		const normalizedValue = getNonEmptyString(value);
		if (!normalizedValue) {
			return "";
		}

		const firstNonEmptyLine = normalizedValue
			.split(/\r?\n/gu)
			.map((line) => line.trim())
			.find((line) => line.length > 0);

		return firstNonEmptyLine ? collapseWhitespace(firstNonEmptyLine) : "";
	}

	function tokenizeForScoring(value) {
		const normalizedValue = getNonEmptyString(value);
		if (!normalizedValue) {
			return [];
		}

		const tokens = normalizedValue.toLowerCase().match(/[a-z0-9]+/gu) || [];
		return tokens.filter((token) => token.length >= 3 && !policy.stopwords.has(token));
	}

	function toTokenSet(value) {
		return new Set(tokenizeForScoring(value));
	}

	function computeLexicalOverlapScore(requestTokenSet, candidateTokenSet) {
		if (!requestTokenSet || !candidateTokenSet) {
			return 0;
		}

		if (requestTokenSet.size === 0 || candidateTokenSet.size === 0) {
			return 0;
		}

		let overlapCount = 0;
		for (const token of requestTokenSet) {
			if (candidateTokenSet.has(token)) {
				overlapCount += 1;
			}
		}

		if (overlapCount === 0) {
			return 0;
		}

		const denominator = requestTokenSet.size + candidateTokenSet.size;
		if (denominator <= 0) {
			return 0;
		}

		// Sorensen-Dice coefficient.
		return Math.min(1, (2 * overlapCount) / denominator);
	}

	function extractReferencePhrases(latestUserMessage) {
		const normalizedMessage = getNonEmptyString(latestUserMessage);
		if (!normalizedMessage) {
			return [];
		}

		const seenPhrases = new Set();
		const phrases = [];
		for (const match of normalizedMessage.matchAll(QUOTED_SEGMENT_PATTERN)) {
			const phrase = getNonEmptyString(
				match[1] || match[2] || match[3] || match[4] || ""
			);
			if (!phrase) {
				continue;
			}

			const normalizedPhrase = phrase.toLowerCase();
			if (seenPhrases.has(normalizedPhrase)) {
				continue;
			}

			seenPhrases.add(normalizedPhrase);
			phrases.push(phrase);
		}

		for (const pattern of policy.phrasePatterns) {
			for (const match of normalizedMessage.matchAll(pattern)) {
				const phrase = getNonEmptyString(match[1]);
				if (!phrase || phrase.length < 3) {
					continue;
				}

				const normalizedPhrase = phrase.toLowerCase();
				if (seenPhrases.has(normalizedPhrase)) {
					continue;
				}

				seenPhrases.add(normalizedPhrase);
				phrases.push(phrase);
			}
		}

		return phrases;
	}

	function isReferential(latestUserMessage) {
		const normalizedMessage = getNonEmptyString(latestUserMessage);
		if (!normalizedMessage) {
			return false;
		}

		return policy.referentialPatterns.some((pattern) =>
			pattern.test(normalizedMessage)
		);
	}

	function scoreCandidate({
		candidate,
		latestUserMessage,
		requestTokenSet,
		referencePhrases,
		totalCandidates,
	}) {
		const candidateTokenSet = toTokenSet(candidate.text);
		const lexicalOverlapScore = computeLexicalOverlapScore(
			requestTokenSet,
			candidateTokenSet
		);

		const phraseMatchScore = referencePhrases.reduce((score, phrase) => {
			const normalizedPhrase = phrase.toLowerCase();
			if (!normalizedPhrase) {
				return score;
			}
			if (candidate.text.toLowerCase().includes(normalizedPhrase)) {
				return score + 0.18;
			}
			return score;
		}, 0);
		const candidateHeading = getFirstNonEmptyLine(candidate.text).toLowerCase();
		const titleLineMatchScore = referencePhrases.reduce((score, phrase) => {
			const normalizedPhrase = collapseWhitespace(phrase).toLowerCase();
			if (!normalizedPhrase || normalizedPhrase.length < 3) {
				return score;
			}

			if (candidateHeading === normalizedPhrase) {
				return Math.max(score, 0.24);
			}

			if (
				candidateHeading.startsWith(`${normalizedPhrase} `) ||
				candidateHeading.includes(normalizedPhrase)
			) {
				return Math.max(score, 0.18);
			}

			return score;
		}, 0);

		const normalizedLatestMessage = getNonEmptyString(latestUserMessage);
		const explicitTitlePrefixScore =
			normalizedLatestMessage &&
			candidate.text
				.toLowerCase()
				.startsWith(collapseWhitespace(normalizedLatestMessage).toLowerCase())
				? 0.08
				: 0;

		const recencyRatio =
			totalCandidates > 0
				? (totalCandidates - candidate.recencyRank) / totalCandidates
				: 0;
		const recencyScore = Math.min(0.26, Math.max(0, recencyRatio) * 0.26);

		const roleScore = candidate.messageRole === "assistant" ? 0.08 : 0.02;

		const textLength = candidate.text.length;
		let lengthScore = 0;
		if (textLength >= 120 && textLength <= 2600) {
			lengthScore = 0.14;
		} else if (textLength >= 60 && textLength <= 3200) {
			lengthScore = 0.08;
		} else if (textLength >= 24) {
			lengthScore = 0.04;
		}

		const compositeScore =
			lexicalOverlapScore * 0.48 +
			Math.min(0.36, phraseMatchScore) +
			Math.min(0.24, titleLineMatchScore) +
			explicitTitlePrefixScore +
			recencyScore +
			roleScore +
			lengthScore;

		return {
			...candidate,
			lexicalOverlapScore,
			phraseMatchScore: Math.min(0.36, phraseMatchScore),
			titleLineMatchScore: Math.min(0.24, titleLineMatchScore),
			score: Math.max(0, Math.min(1, Number(compositeScore.toFixed(4)))),
		};
	}

	function isSubstantiveCandidate(text) {
		const normalizedText = getNonEmptyString(text);
		if (!normalizedText) {
			return false;
		}

		if (normalizedText.length >= DEFAULT_MIN_SUBSTANTIVE_CHARS) {
			return true;
		}

		const wordCount = normalizedText.split(/\s+/u).filter(Boolean).length;
		return wordCount >= 6;
	}

	function collectCandidates(messages, {
		windowSize = DEFAULT_CONTEXT_WINDOW_SIZE,
		latestUserMessage,
		candidateLimit = DEFAULT_CANDIDATE_LIMIT,
	} = {}) {
		if (!Array.isArray(messages) || messages.length === 0) {
			return [];
		}

		const normalizedLatestUserMessage = getNonEmptyString(latestUserMessage);
		const effectiveWindowSize =
			typeof windowSize === "number" && Number.isInteger(windowSize) && windowSize > 0
				? windowSize
				: DEFAULT_CONTEXT_WINDOW_SIZE;
		const startIndex = Math.max(0, messages.length - effectiveWindowSize);
		const candidates = [];

		for (let index = messages.length - 1; index >= startIndex; index -= 1) {
			const message = messages[index];
			if (!message || (message.role !== "assistant" && message.role !== "user")) {
				continue;
			}

			const visibility = getNonEmptyString(message?.metadata?.visibility);
			const source = getNonEmptyString(message?.metadata?.source);
			if (visibility === "hidden" || source === "clarification-submit") {
				continue;
			}

			const role = message.role === "assistant" ? "assistant" : "user";
			const messageText = extractTextFromUiParts(message.parts);
			if (
				isSubstantiveCandidate(messageText) &&
				(!normalizedLatestUserMessage ||
					messageText.trim() !== normalizedLatestUserMessage)
			) {
				candidates.push({
					optionId: buildCandidateOptionId({
						messageId: getNonEmptyString(message.id),
						messageIndex: index,
						candidateKind: "message-text",
					}),
					text: messageText,
					preview: clipText(messageText, 112),
					messageId: getNonEmptyString(message.id),
					messageRole: role,
					messageIndex: index,
					candidateKind: "message-text",
				});
			}

			if (!Array.isArray(message.parts)) {
				continue;
			}

			for (const part of message.parts) {
				if (part?.type !== "data-widget-data" || !part?.data) {
					continue;
				}

				const widgetType = getNonEmptyString(part?.data?.type);
				const widget = policy.widgets.find((candidate) => candidate.type === widgetType);
				if (!widget) {
					continue;
				}
				const text = getNonEmptyString(part?.data?.payload?.[widget.field]);
				if (!isSubstantiveCandidate(text)) {
					continue;
				}
				candidates.push({
					optionId: buildCandidateOptionId({
						messageId: getNonEmptyString(message.id),
						messageIndex: index,
						candidateKind: widget.kind,
					}),
					text,
					preview: clipText(text, 112),
					messageId: getNonEmptyString(message.id),
					messageRole: role,
					messageIndex: index,
					candidateKind: widget.kind,
				});
			}
		}

		const dedupedCandidates = [];
		const seenNormalizedText = new Set();
		for (const candidate of candidates) {
			const normalizedText = collapseWhitespace(candidate.text).toLowerCase();
			if (seenNormalizedText.has(normalizedText)) {
				continue;
			}

			seenNormalizedText.add(normalizedText);
			dedupedCandidates.push(candidate);
			if (dedupedCandidates.length >= candidateLimit) {
				break;
			}
		}

		return dedupedCandidates.map((candidate, index) => ({
			...candidate,
			recencyRank: index,
		}));
	}

	function resolveReference({
		latestUserMessage,
		messages,
		maxChars = 4000,
		windowSize = DEFAULT_CONTEXT_WINDOW_SIZE,
		confidenceThreshold = DEFAULT_CONFIDENCE_THRESHOLD,
		ambiguityThreshold = DEFAULT_AMBIGUITY_THRESHOLD,
		allowImplicitReference = false,
	} = {}) {
		const normalizedLatestUserMessage = getNonEmptyString(latestUserMessage);
		if (!normalizedLatestUserMessage) {
			return {
				status: "not-found",
				referential: false,
				[policy.outputField]: null,
				confidence: 0,
				candidateCount: 0,
				candidates: [],
			};
		}

		const referential = isReferential(normalizedLatestUserMessage);
		const implicitReferenceEnabled = policy.allowImplicitReference && allowImplicitReference === true;
		const hasReferenceSignal = referential || implicitReferenceEnabled;
		if (!hasReferenceSignal) {
			return {
				status: "not-referential",
				referential: false,
				[policy.outputField]: null,
				confidence: 0,
				candidateCount: 0,
				candidates: [],
			};
		}

		const candidates = collectCandidates(messages, {
			windowSize,
			latestUserMessage: normalizedLatestUserMessage,
		});
		if (candidates.length === 0) {
			return {
				status: "not-found",
				referential: hasReferenceSignal,
				[policy.outputField]: null,
				confidence: 0,
				candidateCount: 0,
				candidates: [],
			};
		}

		const requestTokenSet = toTokenSet(normalizedLatestUserMessage);
		const referencePhrases = extractReferencePhrases(normalizedLatestUserMessage);
		const scoredCandidates = candidates
			.map((candidate) =>
				scoreCandidate({
					candidate,
					latestUserMessage: normalizedLatestUserMessage,
					requestTokenSet,
					referencePhrases,
					totalCandidates: candidates.length,
				})
			)
			.map((candidate) => {
				if (referential) {
					return candidate;
				}

				const hasStrongTitleSignal =
					candidate.titleLineMatchScore >= 0.18 ||
					candidate.phraseMatchScore >= 0.18;
				if (hasStrongTitleSignal) {
					return candidate;
				}

				const adjustedScore = Math.max(0, candidate.score - 0.06);
				return {
					...candidate,
					score: Number(adjustedScore.toFixed(4)),
				};
			})
			.sort((left, right) => right.score - left.score);

		const topCandidate = scoredCandidates[0] || null;
		const secondCandidate = scoredCandidates[1] || null;
		const topScore = topCandidate?.score || 0;
		const secondScore = secondCandidate?.score || 0;
		const scoreGap = topScore - secondScore;
		const isConfident =
			topCandidate &&
			topScore >= confidenceThreshold &&
			(!secondCandidate || scoreGap >= ambiguityThreshold);

		if (isConfident) {
			return {
				status: "resolved",
				referential: hasReferenceSignal,
				[policy.outputField]: clipToMaxChars(topCandidate.text, maxChars),
				confidence: topScore,
				candidateCount: scoredCandidates.length,
				candidates: scoredCandidates,
				topCandidate,
				secondCandidate,
			};
		}

		return {
			status: "ambiguous",
			referential: hasReferenceSignal,
			[policy.outputField]: null,
			confidence: topScore,
			candidateCount: scoredCandidates.length,
			candidates: scoredCandidates,
			topCandidate,
			secondCandidate,
		};
	}

	function createClarificationSessionId() {
		return `${policy.sessionPrefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	}

	function getCandidateSourceDescription(candidate) {
		const roleLabel = candidate.messageRole === "assistant"
			? "assistant response"
			: "user message";
		return `From a previous ${roleLabel}${policy.sourceSuffixes[candidate.candidateKind] || ""}.`;
	}

	function buildClarification({
		latestUserMessage,
		candidates,
		sessionId,
	} = {}) {
		if (!Array.isArray(candidates) || candidates.length === 0) {
			return null;
		}

		const normalizedLatestUserMessage = getNonEmptyString(latestUserMessage);
		const optionLimit = Math.min(
			DEFAULT_CLARIFICATION_OPTION_LIMIT,
			candidates.length
		);
		const options = candidates.slice(0, optionLimit).map((candidate, index) => ({
			id: candidate.optionId,
			label: clipText(candidate.preview || candidate.text, 96),
			description: getCandidateSourceDescription(candidate),
			recommended: index === 0,
		}));

		if (normalizedLatestUserMessage) {
			options.push({
				id: policy.literalOptionId,
				label: clipText(normalizedLatestUserMessage, 96),
				description: policy.literalDescription,
				recommended: false,
			});
		}

		if (options.length === 0) {
			return null;
		}

		return {
			type: "question-card",
			sessionId:
				getNonEmptyString(sessionId) ||
				createClarificationSessionId(),
			round: 1,
			maxRounds: 1,
			title: policy.title,
			description:
				policy.description,
			questions: [
				{
					id: policy.questionId,
					label: policy.questionLabel,
					description: "Choose one option, or use the custom input field below.",
					required: true,
					kind: "single-select",
					options,
					placeholder: policy.placeholder,
				},
			],
		};
	}

	function isSession(sessionId) {
		const normalizedSessionId = getNonEmptyString(sessionId);
		if (!normalizedSessionId) {
			return false;
		}

		return normalizedSessionId.startsWith(
			policy.sessionPrefix
		);
	}

	function getSelectionValueFromClarification(clarificationSubmission) {
		if (!clarificationSubmission || typeof clarificationSubmission !== "object") {
			return null;
		}

		const answers =
			clarificationSubmission.answers &&
			typeof clarificationSubmission.answers === "object"
				? clarificationSubmission.answers
				: null;
		if (!answers) {
			return null;
		}

		const preferredValue = answers[policy.questionId];
		if (typeof preferredValue === "string") {
			return getNonEmptyString(preferredValue);
		}
		if (Array.isArray(preferredValue)) {
			const firstValue = preferredValue.find((value) => typeof value === "string");
			return getNonEmptyString(firstValue);
		}

		for (const answerValue of Object.values(answers)) {
			if (typeof answerValue === "string") {
				const normalizedValue = getNonEmptyString(answerValue);
				if (normalizedValue) {
					return normalizedValue;
				}
			}
			if (Array.isArray(answerValue)) {
				for (const value of answerValue) {
					const normalizedValue = getNonEmptyString(value);
					if (normalizedValue) {
						return normalizedValue;
					}
				}
			}
		}

		return null;
	}

	function resolveClarification({
		clarificationSubmission,
		messages,
		latestVisibleUserMessage,
		maxChars = 4000,
		windowSize = DEFAULT_CONTEXT_WINDOW_SIZE,
	} = {}) {
		if (!isSession(clarificationSubmission?.sessionId)) {
			return {
				[policy.outputField]: null,
				source: null,
				selectedValue: null,
			};
		}

		const selectedValue = getSelectionValueFromClarification(clarificationSubmission);
		if (!selectedValue) {
			return {
				[policy.outputField]: null,
				source: null,
				selectedValue: null,
			};
		}

		if (selectedValue === policy.literalOptionId) {
			const literalInput = policy.normalizeInput(latestVisibleUserMessage);
			return {
				[policy.outputField]: literalInput ? clipToMaxChars(literalInput, maxChars) : null,
				source: "clarification-literal",
				selectedValue,
			};
		}

		const candidates = collectCandidates(messages, {
			windowSize,
			latestUserMessage: latestVisibleUserMessage,
		});
		const selectedCandidate = candidates.find(
			(candidate) => candidate.optionId === selectedValue
		);
		if (selectedCandidate) {
			return {
				[policy.outputField]: clipToMaxChars(selectedCandidate.text, maxChars),
				source: "context-reference",
				selectedValue,
			};
		}

		if (selectedValue.startsWith(policy.optionPrefix)) {
			return {
				[policy.outputField]: null,
				source: null,
				selectedValue,
			};
		}

		const customInput = policy.normalizeInput(selectedValue);
		return {
			[policy.outputField]: customInput ? clipToMaxChars(customInput, maxChars) : null,
			source: policy.customSource,
			selectedValue,
		};
	}

	return {
		sessionPrefix: policy.sessionPrefix,
		questionId: policy.questionId,
		literalOptionId: policy.literalOptionId,
		collectCandidates,
		isReferential,
		resolveReference,
		buildClarification,
		isSession,
		resolveClarification,
	};
}

module.exports = {
	imageContextResolver: createMediaContextResolver(IMAGE_POLICY),
	audioContextResolver: createMediaContextResolver(AUDIO_POLICY),
};
