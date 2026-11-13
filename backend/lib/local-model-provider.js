// @ts-check
const { createRouteDecisionPart } = require("./route-decision");

const LOCAL_MODEL_PORT = parseInt(process.env.LOCAL_MODEL_PORT || "8800", 10);
const LOCAL_MODEL_BASE_URL = process.env.LOCAL_MODEL_BASE_URL || `http://localhost:${LOCAL_MODEL_PORT}`;
const LOCAL_MODEL_ID = "mlx-community/Qwen3-0.6B-MLX-8bit";

function isLocalModelRequest(provider, model) {
	if (typeof model === "string" && model.startsWith("local/")) {
		return true;
	}
	if (provider === "local") {
		return true;
	}
	return false;
}

function buildLocalChatMessages(userMessage, conversationHistory) {
	const messages = [];

	messages.push({
		role: "system",
		content: "You are a helpful assistant. Keep responses concise and clear.",
	});

	if (Array.isArray(conversationHistory)) {
		for (const entry of conversationHistory) {
			if (!entry || typeof entry !== "object") continue;
			const role = entry.role === "assistant" ? "assistant" : "user";
			const content = typeof entry.content === "string" ? entry.content.trim() : "";
			if (content) {
				messages.push({ role, content });
			}
		}
	}

	if (typeof userMessage === "string" && userMessage.trim()) {
		messages.push({ role: "user", content: userMessage.trim() });
	}

	return messages;
}

async function streamLocalModel({ userMessage, conversationHistory, writer }) {
	const chatMessages = buildLocalChatMessages(userMessage, conversationHistory);

	const payload = {
		model: LOCAL_MODEL_ID,
		messages: chatMessages,
		stream: true,
		max_tokens: 2048,
		temperature: 0.7,
	};

	const url = `${LOCAL_MODEL_BASE_URL}/v1/chat/completions`;

	console.info("[LOCAL-MODEL] Streaming from", url, {
		model: LOCAL_MODEL_ID,
		messageCount: chatMessages.length,
	});

	const response = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		const errorText = await response.text().catch(() => "");
		throw new Error(
			`Local model server error (${response.status}): ${errorText.slice(0, 300)}`
		);
	}

	const reader = response.body?.getReader();
	if (!reader) {
		throw new Error("Local model server returned empty response body");
	}

	const decoder = new TextDecoder();
	let buffer = "";
	const textId = `local-text-${Date.now()}`;
	let textStarted = false;
	let fullText = "";
	let isThinking = false;

	writer.write({
		type: "data-thinking-status",
		data: {
			label: "Working",
			activity: "results",
			source: "backend",
		},
	});

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		buffer += decoder.decode(value, { stream: true });
		let newlineIndex = buffer.indexOf("\n");
		while (newlineIndex !== -1) {
			const line = buffer.slice(0, newlineIndex).trim();
			buffer = buffer.slice(newlineIndex + 1);

			if (!line.startsWith("data:")) {
				newlineIndex = buffer.indexOf("\n");
				continue;
			}

			const data = line.slice(5).trim();
			if (data === "[DONE]") {
				newlineIndex = buffer.indexOf("\n");
				continue;
			}

			let parsed;
			try {
				parsed = JSON.parse(data);
			} catch {
				newlineIndex = buffer.indexOf("\n");
				continue;
			}

			const delta = parsed?.choices?.[0]?.delta?.content;
			if (typeof delta === "string" && delta.length > 0) {
				// Qwen3 uses <think>...</think> tags for chain-of-thought.
				// Strip them so only the final answer streams to the user.
				let remaining = delta;
				while (remaining.length > 0) {
					if (isThinking) {
						const closeIdx = remaining.indexOf("</think>");
						if (closeIdx === -1) {
							// Still inside <think>, skip all content
							remaining = "";
						} else {
							isThinking = false;
							remaining = remaining.slice(closeIdx + "</think>".length);
						}
					} else {
						const openIdx = remaining.indexOf("<think>");
						if (openIdx === -1) {
							// No thinking tag, emit all content
							if (!textStarted) {
								writer.write({ type: "text-start", id: textId });
								textStarted = true;
							}
							writer.write({ type: "text-delta", id: textId, delta: remaining });
							fullText += remaining;
							remaining = "";
						} else {
							// Emit content before <think>
							const before = remaining.slice(0, openIdx);
							if (before.length > 0) {
								if (!textStarted) {
									writer.write({ type: "text-start", id: textId });
									textStarted = true;
								}
								writer.write({ type: "text-delta", id: textId, delta: before });
								fullText += before;
							}
							isThinking = true;
							remaining = remaining.slice(openIdx + "<think>".length);
						}
					}
				}
			}

			newlineIndex = buffer.indexOf("\n");
		}
	}

	// Process remaining buffer
	if (buffer.trim().startsWith("data:")) {
		const data = buffer.trim().slice(5).trim();
		if (data !== "[DONE]") {
			try {
				const parsed = JSON.parse(data);
				const delta = parsed?.choices?.[0]?.delta?.content;
				if (typeof delta === "string" && delta.length > 0 && !isThinking) {
					if (!textStarted) {
						writer.write({ type: "text-start", id: textId });
						textStarted = true;
					}
					writer.write({ type: "text-delta", id: textId, delta });
					fullText += delta;
				}
			} catch {
				// ignore
			}
		}
	}

	if (textStarted) {
		writer.write({ type: "text-end", id: textId });
	} else {
		// No text was generated
		const fallbackId = `local-fallback-${Date.now()}`;
		writer.write({ type: "text-start", id: fallbackId });
		writer.write({
			type: "text-delta",
			id: fallbackId,
			delta: "The local model did not generate a response. Make sure mlx_lm.server is running.",
		});
		writer.write({ type: "text-end", id: fallbackId });
	}

	writer.write(createRouteDecisionPart({
		intent: "chat",
		origin: "text",
		reason: "local_model",
	}));
	writer.write({
		type: "data-turn-complete",
		data: { timestamp: new Date().toISOString() },
	});

	return fullText;
}

module.exports = {
	isLocalModelRequest,
	streamLocalModel,
	LOCAL_MODEL_BASE_URL,
};
