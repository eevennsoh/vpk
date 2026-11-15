// Characterization suite for the realtime voice session lifecycle owned by
// useRealtimeVoice (SM-FE-16): connect, speaking, interrupt (barge-in), error,
// reconnect and close. It renders the real hook with fake browser transports:
// an in-memory WebSocket the test drives as the server, a fake microphone
// (getUserMedia + AudioContext) and a fixed socket URL, so no realtime model
// session is ever opened.
const assert = require("node:assert/strict");
const test = require("node:test");
const esbuild = require("esbuild");
require("../../../../scripts/lib/render-component.js");
const React = require("react");
const { createRoot } = require("react-dom/client");
const { loadCjsModuleFromText } = require("../../../../scripts/lib/esbuild-cjs-loader.js");

const WS_URL = "ws://voice.test/api/realtime/audio-conversation";

const mocks = {
	"@/components/projects/rovo-core/lib/rovo-realtime-ws-url": `
		export async function buildRealtimeWsUrl() {
			if (window.testVoiceEnv.wsUrlError) throw window.testVoiceEnv.wsUrlError;
			return ${JSON.stringify(WS_URL)};
		}
	`,
};

let harnessPromise = null;
function loadHarness() {
	harnessPromise ??= esbuild.build({
		stdin: {
			contents: `
				import { useRealtimeVoice } from "@/components/projects/rovo-core/hooks/use-realtime-voice";
				export function Harness({ chatMessages, mode }) {
					const events = window.testVoiceEnv.events;
					window.testVoice = useRealtimeVoice({
						sessionPolicyMode: mode,
						chatMessages,
						onDelegateToRovo: (request) => events.push(["delegate", request]),
						onSpeechStarted: () => events.push(["speechStarted"]),
						onSpeechTranscriptDelta: (payload) => events.push(["transcriptDelta", payload]),
						onSpeechTranscriptCompleted: (payload) => events.push(["transcriptCompleted", payload]),
						onTextResponseStart: (payload) => events.push(["textStart", payload]),
						onAssistantTextDelta: (payload) => events.push(["assistantDelta", payload]),
						onAssistantTextCompleted: (payload) => events.push(["assistantCompleted", payload]),
						onEndVoiceSession: () => events.push(["endSession"]),
						onToolCall: (call) => events.push(["toolCall", call]),
					});
					return null;
				}
			`,
			loader: "tsx", resolveDir: process.cwd(), sourcefile: "realtime-voice-harness.tsx",
		},
		bundle: true, platform: "node", format: "cjs", jsx: "automatic", write: false,
		external: ["react", "react-dom"], loader: { ".css": "empty" },
		plugins: [{ name: "voice-adapters", setup(build) {
			build.onResolve({ filter: /.*/ }, ({ path }) => Object.hasOwn(mocks, path) ? { path, namespace: "test-adapter" } : undefined);
			build.onLoad({ filter: /.*/, namespace: "test-adapter" }, ({ path }) => ({ contents: mocks[path], loader: "tsx", resolveDir: process.cwd() }));
		} }],
	}).then((result) => loadCjsModuleFromText(result.outputFiles[0].text));
	return harnessPromise;
}

// -- Fake browser transports ------------------------------------------------

function createVoiceEnvironment() {
	const sockets = [];
	const audioContexts = [];
	const micStreams = [];
	const env = { events: [], sockets, audioContexts, micStreams, wsUrlError: null, micError: null, clock: 0 };

	class FakeWebSocket {
		static CONNECTING = 0;
		static OPEN = 1;
		static CLOSING = 2;
		static CLOSED = 3;

		constructor(url) {
			this.url = url;
			this.readyState = FakeWebSocket.CONNECTING;
			this.sent = [];
			this.onopen = null;
			this.onmessage = null;
			this.onclose = null;
			this.onerror = null;
			sockets.push(this);
		}

		send(data) {
			this.sent.push(JSON.parse(data));
		}

		// Client-initiated close: like a browser, the close event arrives later
		// and only reaches whatever handler is still attached at that point.
		close() {
			if (this.readyState === FakeWebSocket.CLOSED) return;
			this.readyState = FakeWebSocket.CLOSED;
			setTimeout(() => this.onclose?.({ code: 1000 }), 0);
		}

		// Server side controls used by the tests.
		serverOpen() {
			this.readyState = FakeWebSocket.OPEN;
			this.onopen?.({});
		}

		serverSend(message) {
			this.onmessage?.({ data: JSON.stringify(message) });
		}

		serverClose() {
			this.readyState = FakeWebSocket.CLOSED;
			this.onclose?.({ code: 1006 });
		}

		sentTypes() {
			return this.sent.map((message) => message.type);
		}
	}

	class FakeAudioContext {
		constructor(options = {}) {
			this.sampleRate = options.sampleRate ?? 48_000;
			this.state = "running";
			this.destination = {};
			this.processors = [];
			audioContexts.push(this);
		}

		get currentTime() { return env.clock; }
		createAnalyser() {
			return { fftSize: 32, smoothingTimeConstant: 0, connect() {}, getByteTimeDomainData(array) { array.fill(128); } };
		}
		createBuffer(_channels, length, sampleRate) {
			const data = new Float32Array(length);
			return { duration: length / sampleRate, getChannelData: () => data };
		}
		createBufferSource() { return { buffer: null, connect() {}, start() {} }; }
		createMediaStreamSource() { return { connect() {} }; }
		createScriptProcessor() {
			const processor = { onaudioprocess: null, connected: true, connect() {}, disconnect() { processor.connected = false; } };
			this.processors.push(processor);
			return processor;
		}
		async resume() { this.state = "running"; }
		async suspend() { this.state = "suspended"; }
		async close() { this.state = "closed"; }
	}

	const mediaDevices = {
		async getUserMedia() {
			if (env.micError) throw env.micError;
			const track = { enabled: true, stopped: false, stop() { track.stopped = true; } };
			const stream = { track, getAudioTracks: () => [track], getTracks: () => [track] };
			micStreams.push(stream);
			return stream;
		},
	};

	env.install = () => {
		const saved = {
			WebSocket: globalThis.WebSocket,
			AudioContext: globalThis.AudioContext,
			hasFocus: document.hasFocus,
			mediaDevices: Object.getOwnPropertyDescriptor(navigator, "mediaDevices"),
		};
		globalThis.WebSocket = FakeWebSocket;
		globalThis.AudioContext = FakeAudioContext;
		document.hasFocus = () => true;
		Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: mediaDevices });
		return () => {
			globalThis.WebSocket = saved.WebSocket;
			globalThis.AudioContext = saved.AudioContext;
			document.hasFocus = saved.hasFocus;
			if (saved.mediaDevices) Object.defineProperty(navigator, "mediaDevices", saved.mediaDevices);
			else delete navigator.mediaDevices;
		};
	};

	// The microphone delivers one buffer; the hook forwards it as audio_buffer_append.
	env.speakIntoMic = () => {
		const processor = audioContexts.flatMap((context) => context.processors).filter((item) => item.connected).at(-1);
		processor.onaudioprocess({ inputBuffer: { getChannelData: () => new Float32Array(480) } });
	};

	return env;
}

// 10 ms of silent PCM16 at 24 kHz.
const AUDIO_DELTA = Buffer.alloc(480).toString("base64");

function voiceState() {
	const voice = window.testVoice;
	return {
		voice: voice.voiceState,
		connection: voice.connectionState,
		generation: voice.generationState,
		connected: voice.isConnected,
		reconnecting: voice.isReconnecting,
		status: voice.statusMessage,
		transcript: voice.currentTranscript,
		model: voice.modelTranscript,
		mic: voice.micStream !== null,
	};
}

async function settle(ms = 5) {
	await React.act(async () => {
		await new Promise((resolve) => setTimeout(resolve, ms));
	});
}

async function waitFor(description, predicate, timeoutMs = 5000) {
	const startedAt = Date.now();
	while (!predicate()) {
		if (Date.now() - startedAt > timeoutMs) {
			throw new Error(`Timed out waiting for ${description}; state: ${JSON.stringify(voiceState())}`);
		}
		await settle();
	}
}

async function act(callback) {
	await React.act(async () => {
		callback();
	});
}

async function mountVoice(t, { mode = "auto", chatMessages = [] } = {}) {
	// Failure paths log on purpose; keep the expected noise out of the test output.
	t.mock.method(console, "error", () => {});
	t.mock.method(console, "warn", () => {});
	const harness = await loadHarness();
	const env = createVoiceEnvironment();
	const restore = env.install();
	window.testVoiceEnv = env;
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	await React.act(async () => root.render(React.createElement(harness.Harness, { chatMessages, mode })));
	let mounted = true;
	const unmount = async () => {
		if (!mounted) return;
		mounted = false;
		await React.act(async () => root.unmount());
	};
	t.after(async () => {
		await unmount();
		container.remove();
		restore();
		delete window.testVoice;
		delete window.testVoiceEnv;
	});
	return { env, voice: () => window.testVoice, unmount };
}

async function connectAndOpen(env, voice, options) {
	await act(() => voice().connect(options));
	await waitFor("the socket", () => env.sockets.length === 1);
	const socket = env.sockets[0];
	await act(() => socket.serverOpen());
	await waitFor("the microphone", () => voice().micStream !== null);
	return socket;
}

async function startSession(env, voice, options) {
	const socket = await connectAndOpen(env, voice, options);
	await act(() => socket.serverSend({ type: "session_ready" }));
	return socket;
}

const eventNames = (env) => env.events.map(([name]) => name);

// -- Connect -----------------------------------------------------------------

test("connect moves idle to connecting, opens the mic on socket open, and listens on session_ready", async (t) => {
	const chatMessages = [
		{ id: "u", role: "user", parts: [{ type: "text", text: "What changed?" }] },
		{ id: "a", role: "assistant", parts: [{ type: "text", text: "Two fixes." }] },
	];
	const { env, voice } = await mountVoice(t, { chatMessages });
	assert.deepEqual(voiceState(), {
		voice: "idle", connection: "idle", generation: "idle", connected: false, reconnecting: false,
		status: null, transcript: "", model: "", mic: false,
	});

	await act(() => voice().connect());
	assert.equal(voice().voiceState, "connecting");
	assert.equal(voice().connectionState, "connecting");
	await waitFor("the socket", () => env.sockets.length === 1);
	const [socket] = env.sockets;
	assert.equal(socket.url, WS_URL);
	assert.equal(voice().micStream, null);

	await act(() => socket.serverOpen());
	await waitFor("the microphone", () => voice().micStream !== null);
	assert.equal(voice().isConnected, false);

	await act(() => socket.serverSend({ type: "session_ready" }));
	assert.deepEqual(voiceState(), {
		voice: "listening", connection: "connected", generation: "idle", connected: true, reconnecting: false,
		status: null, transcript: "", model: "", mic: true,
	});
	// Auto mode keeps the server's default turn detection and seeds thread context.
	assert.deepEqual(socket.sent, [
		{ type: "context_inject", data: { type: "thread_context", summary: "User: What changed?\nAssistant: Two fixes." } },
	]);

	await act(() => env.speakIntoMic());
	assert.equal(socket.sent.at(-1).type, "audio_buffer_append");
	assert.equal(typeof socket.sent.at(-1).audio, "string");
});

test("connect is ignored while a session is already active", async (t) => {
	const { env, voice } = await mountVoice(t);
	await startSession(env, voice);
	await act(() => voice().connect());
	await settle(20);
	assert.equal(env.sockets.length, 1);
	assert.equal(voice().voiceState, "listening");
});

test("manual-turn-taking and transcription-only sessions send their session_update policy", async (t) => {
	const { env, voice } = await mountVoice(t, { mode: "manual-turn-taking" });
	const socket = await startSession(env, voice);
	assert.deepEqual(socket.sent, [{
		type: "session_update",
		config: { turn_detection: { type: "semantic_vad", eagerness: "low", create_response: false, interrupt_response: true } },
	}]);
	await act(() => voice().disconnect());

	await act(() => voice().connect({ transcriptionOnly: true }));
	await waitFor("the second socket", () => env.sockets.length === 2);
	const transcriptionSocket = env.sockets[1];
	await act(() => transcriptionSocket.serverOpen());
	await act(() => transcriptionSocket.serverSend({ type: "session_ready" }));
	assert.deepEqual(transcriptionSocket.sent, [{
		type: "session_update",
		config: {
			transcription_only: true,
			turn_detection: { type: "semantic_vad", eagerness: "auto", create_response: false, interrupt_response: false },
		},
	}]);
});

test("text input sent before the session is open queues and dispatches on session_ready", async (t) => {
	const { env, voice } = await mountVoice(t);
	await act(() => voice().connect());
	await waitFor("the socket", () => env.sockets.length === 1);
	const [socket] = env.sockets;
	await act(() => {
		void voice().sendTextInput({ text: "  Summarize this  ", contextDescription: " Board: Alpha " });
		void voice().sendTextInput({ text: "   " });
	});
	assert.deepEqual(socket.sent, []);
	await act(() => socket.serverOpen());
	await act(() => socket.serverSend({ type: "session_ready" }));
	assert.deepEqual(socket.sent, [
		{ type: "context_inject", data: { type: "thread_message", content: "Board: Alpha" } },
		{ type: "text_message_from_user", text: "Summarize this" },
	]);
	assert.equal(voice().generationState, "generating");
});

// -- Speaking ----------------------------------------------------------------

test("assistant audio switches to speaking, streams the transcript, and drains back to listening", async (t) => {
	const { env, voice } = await mountVoice(t);
	const socket = await startSession(env, voice);
	await act(() => socket.serverSend({ type: "response_created" }));
	await act(() => socket.serverSend({ type: "audio_delta", delta: AUDIO_DELTA }));
	assert.equal(voice().voiceState, "speaking");
	assert.equal(voice().isConnected, true);
	assert.equal(voice().generationState, "generating");

	await act(() => socket.serverSend({ type: "audio_transcript_delta", delta: "Hello", itemId: "item-1" }));
	await act(() => socket.serverSend({ type: "audio_transcript_delta", delta: " there", itemId: "item-1" }));
	assert.equal(voice().modelTranscript, "Hello there");
	await act(() => socket.serverSend({ type: "response_done" }));
	assert.equal(voice().generationState, "complete");
	assert.deepEqual(env.events.filter(([name]) => name === "textStart" || name === "assistantCompleted"), [
		["textStart", { messageId: "item-1" }],
		["assistantCompleted", { messageId: "item-1", text: "Hello there" }],
	]);
	assert.deepEqual(
		env.events.filter(([name]) => name === "assistantDelta").map(([, payload]) => payload.text),
		["Hello", "Hello there"],
	);

	await waitFor("generation to reset", () => voice().generationState === "idle");
	// Playback drained and no audio arrived for the speaking grace window.
	await waitFor("speaking to end", () => voice().voiceState === "listening");
	assert.equal(voice().connectionState, "connected");
});

test("text deltas stream into modelTranscript and complete on response_done", async (t) => {
	const { env, voice } = await mountVoice(t);
	const socket = await startSession(env, voice);
	await act(() => {
		void voice().sendTextInput({ text: "Hi" });
	});
	await act(() => socket.serverSend({ type: "text_delta", delta: "Sure", itemId: "t-1" }));
	await act(() => socket.serverSend({ type: "text_delta", delta: ", done.", itemId: "t-1" }));
	assert.equal(voice().modelTranscript, "Sure, done.");
	assert.equal(voice().voiceState, "listening");
	await act(() => socket.serverSend({ type: "response_done" }));
	assert.deepEqual(env.events.find(([name]) => name === "assistantCompleted"), ["assistantCompleted", { messageId: "t-1", text: "Sure, done." }]);
});

// -- Interrupt ---------------------------------------------------------------

test("speech_started barges in: playback flushes, model text clears, and voice returns to listening", async (t) => {
	const { env, voice } = await mountVoice(t);
	const socket = await startSession(env, voice);
	await act(() => socket.serverSend({ type: "response_created" }));
	await act(() => socket.serverSend({ type: "audio_delta", delta: AUDIO_DELTA }));
	await act(() => socket.serverSend({ type: "audio_transcript_delta", delta: "Let me explain", itemId: "item-1" }));
	assert.equal(voice().voiceState, "speaking");
	const contextsBefore = env.audioContexts.length;

	await act(() => env.speakIntoMic());
	await act(() => socket.serverSend({ type: "speech_started" }));
	assert.equal(voice().voiceState, "listening");
	assert.equal(voice().modelTranscript, "");
	assert.deepEqual(voice().outputWaveformBars, []);
	assert.equal(eventNames(env).includes("speechStarted"), true);
	// flushPlayback swaps in a fresh output AudioContext.
	assert.equal(env.audioContexts.length, contextsBefore + 1);

	await act(() => socket.serverSend({ type: "transcription_delta", delta: "Wait," }));
	await act(() => socket.serverSend({ type: "transcription_delta", delta: " stop" }));
	assert.equal(voice().currentTranscript, "Wait, stop");
	await act(() => socket.serverSend({ type: "speech_stopped" }));
	await act(() => socket.serverSend({ type: "transcription_completed", transcript: "Wait, stop." }));
	assert.equal(voice().currentTranscript, "Wait, stop.");
	assert.deepEqual(
		env.events.filter(([name]) => name === "transcriptDelta" || name === "transcriptCompleted"),
		[
			["transcriptDelta", { delta: "Wait,", text: "Wait," }],
			["transcriptDelta", { delta: " stop", text: "Wait, stop" }],
			["transcriptCompleted", { transcript: "Wait, stop.", text: "Wait, stop." }],
		],
	);
});

test("speech_started without fresh mic audio is ignored and does not barge in", async (t) => {
	const { env, voice } = await mountVoice(t);
	const socket = await startSession(env, voice);
	await act(() => socket.serverSend({ type: "audio_delta", delta: AUDIO_DELTA }));
	await act(() => socket.serverSend({ type: "speech_started" }));
	assert.equal(voice().voiceState, "speaking");
	assert.equal(eventNames(env).includes("speechStarted"), false);
});

test("auto mode asks for a response when a completed utterance gets none, and not when one starts", async (t) => {
	const { env, voice } = await mountVoice(t);
	const socket = await startSession(env, voice);
	await act(() => env.speakIntoMic());
	await act(() => socket.serverSend({ type: "speech_started" }));
	await act(() => socket.serverSend({ type: "transcription_completed", transcript: "Hello?" }));
	await waitFor("the fallback response_create", () => socket.sentTypes().includes("response_create"));

	const sentBefore = socket.sent.length;
	await act(() => env.speakIntoMic());
	await act(() => socket.serverSend({ type: "speech_started" }));
	await act(() => socket.serverSend({ type: "transcription_completed", transcript: "Second" }));
	await act(() => socket.serverSend({ type: "response_created" }));
	await settle(1400);
	assert.deepEqual(socket.sent.slice(sentBefore).map((message) => message.type).filter((type) => type !== "audio_buffer_append"), []);
});

test("manual-turn-taking never sends the fallback response_create", async (t) => {
	const { env, voice } = await mountVoice(t, { mode: "manual-turn-taking" });
	const socket = await startSession(env, voice);
	await act(() => env.speakIntoMic());
	await act(() => socket.serverSend({ type: "speech_started" }));
	await act(() => socket.serverSend({ type: "transcription_completed", transcript: "Hello?" }));
	await settle(1400);
	assert.equal(socket.sentTypes().includes("response_create"), false);
	assert.equal(eventNames(env).includes("transcriptCompleted"), true);
});

// -- Function calls ----------------------------------------------------------

test("function calls delegate to Rovo, hand screen tools to the executor, and return tool output", async (t) => {
	const { env, voice } = await mountVoice(t);
	const socket = await startSession(env, voice);
	await act(() => socket.serverSend({
		type: "function_call",
		name: "delegate_to_rovo",
		callId: "call-1",
		arguments: JSON.stringify({ prompt: "Draft a plan", intent_type: "plan", urgency: "normal" }),
	}));
	assert.equal(voice().generationState, "delegating");
	assert.deepEqual(env.events.find(([name]) => name === "delegate"), ["delegate", {
		prompt: "Draft a plan", intentType: "plan", conversationSummary: undefined, urgency: "normal", referencedFiles: undefined,
	}]);
	await waitFor("generation to reset", () => voice().generationState === "idle");

	await act(() => socket.serverSend({ type: "function_call", name: "delegate_to_rovo", callId: "bad", arguments: "{" }));
	assert.equal(env.events.filter(([name]) => name === "delegate").length, 1);

	await act(() => socket.serverSend({
		type: "function_call", name: "point_at_target", callId: "call-2", arguments: JSON.stringify({ targetId: "save" }),
	}));
	assert.deepEqual(env.events.find(([name]) => name === "toolCall"), ["toolCall", { name: "point_at_target", args: { targetId: "save" }, callId: "call-2" }]);
	await act(() => voice().sendFunctionCallOutput({ callId: "call-2", output: { ok: true } }));
	await act(() => voice().sendFunctionCallOutput({ callId: "call-3", output: "done", createResponse: false }));
	await act(() => voice().sendFunctionCallOutput({ callId: "", output: "ignored" }));
	assert.deepEqual(socket.sent.filter((message) => message.type === "function_call_output"), [
		{ type: "function_call_output", callId: "call-2", output: "{\"ok\":true}" },
		{ type: "function_call_output", callId: "call-3", output: "done", createResponse: false },
	]);
});

// -- Error -------------------------------------------------------------------

test("a server error surfaces its message without dropping the session", async (t) => {
	const { env, voice } = await mountVoice(t);
	const socket = await startSession(env, voice);
	await act(() => socket.serverSend({ type: "error", error: { message: "Rate limited upstream" } }));
	await settle(20);
	assert.equal(voice().statusMessage, "Rate limited upstream");
	assert.equal(voice().voiceState, "listening");
	assert.equal(voice().connectionState, "connected");
	assert.equal(env.sockets.length, 1);
	assert.equal(socket.readyState, 1);
});

test("a microphone failure ends the session as disconnected", async (t) => {
	const { env, voice } = await mountVoice(t);
	env.micError = new Error("Permission denied");
	await act(() => voice().connect());
	await waitFor("the socket", () => env.sockets.length === 1);
	await act(() => env.sockets[0].serverOpen());
	await waitFor("the disconnect", () => voice().connectionState === "disconnected");
	assert.deepEqual(voiceState(), {
		voice: "idle", connection: "disconnected", generation: "idle", connected: false, reconnecting: false,
		status: "Voice disconnected", transcript: "", model: "", mic: false,
	});
	assert.equal(env.sockets[0].readyState, 3);
});

test("a socket URL failure ends the session as disconnected without opening a socket", async (t) => {
	const { env, voice } = await mountVoice(t);
	env.wsUrlError = new Error("no backend");
	await act(() => voice().connect());
	await waitFor("the disconnect", () => voice().connectionState === "disconnected");
	assert.equal(voice().voiceState, "idle");
	assert.equal(voice().statusMessage, "Voice disconnected");
	assert.equal(env.sockets.length, 0);
	// connect works again after the failure.
	env.wsUrlError = null;
	await act(() => voice().connect());
	await waitFor("the retry socket", () => env.sockets.length === 1);
});

// -- Reconnect ---------------------------------------------------------------

test("an upstream connection_closed error reconnects and a new session_ready restores the session", async (t) => {
	const { env, voice } = await mountVoice(t);
	const socket = await startSession(env, voice);
	const firstMic = env.micStreams[0];
	await act(() => socket.serverSend({ type: "error", error: { message: "Upstream closed", code: "connection_closed" } }));
	await waitFor("reconnecting", () => voice().connectionState === "reconnecting");
	assert.deepEqual(voiceState(), {
		voice: "connecting", connection: "reconnecting", generation: "idle", connected: false, reconnecting: true,
		status: "Reconnecting voice...", transcript: "", model: "", mic: false,
	});
	assert.equal(firstMic.track.stopped, true);

	await waitFor("the reconnect socket", () => env.sockets.length === 2, 2000);
	const second = env.sockets[1];
	await act(() => second.serverOpen());
	await waitFor("the new microphone", () => voice().micStream !== null);
	await act(() => second.serverSend({ type: "session_ready" }));
	assert.equal(voice().connectionState, "connected");
	assert.equal(voice().statusMessage, null);
	assert.equal(voice().voiceState, "listening");
});

test("reconnect backs off three times and then gives up as disconnected", async (t) => {
	const { env, voice } = await mountVoice(t);
	const socket = await startSession(env, voice);
	const startedAt = Date.now();
	await act(() => socket.serverClose());
	for (let attempt = 1; attempt <= 3; attempt += 1) {
		assert.equal(voice().connectionState, "reconnecting");
		await waitFor(`reconnect socket ${attempt}`, () => env.sockets.length === attempt + 1, 4000);
		await act(() => env.sockets[attempt].serverClose());
	}
	// Delays are 500 ms, 1 s and 2 s.
	assert.equal(Date.now() - startedAt >= 3400, true);
	assert.deepEqual(voiceState(), {
		voice: "idle", connection: "disconnected", generation: "idle", connected: false, reconnecting: false,
		status: "Voice disconnected", transcript: "", model: "", mic: false,
	});
	await settle(600);
	assert.equal(env.sockets.length, 4);
});

// -- Close -------------------------------------------------------------------

test("disconnect closes the socket and mic, resets state, and ignores late server messages", async (t) => {
	const { env, voice } = await mountVoice(t);
	const socket = await startSession(env, voice);
	await act(() => socket.serverSend({ type: "audio_delta", delta: AUDIO_DELTA }));
	await act(() => socket.serverSend({ type: "audio_transcript_delta", delta: "Partial", itemId: "i" }));
	await act(() => voice().disconnect());
	assert.deepEqual(voiceState(), {
		voice: "idle", connection: "idle", generation: "idle", connected: false, reconnecting: false,
		status: null, transcript: "", model: "", mic: false,
	});
	assert.equal(socket.readyState, 3);
	assert.equal(env.micStreams[0].track.stopped, true);
	assert.equal(env.audioContexts.every((context) => context.state === "closed"), true);

	socket.onmessage?.({ data: JSON.stringify({ type: "session_ready" }) });
	await settle(700);
	assert.equal(voice().voiceState, "idle");
	assert.equal(env.sockets.length, 1);
});

test("end_voice_session notifies the shell and disconnects after the goodbye window", async (t) => {
	const { env, voice } = await mountVoice(t);
	const socket = await startSession(env, voice);
	await act(() => socket.serverSend({ type: "function_call", name: "end_voice_session", callId: "end", arguments: "{}" }));
	assert.deepEqual(eventNames(env).filter((name) => name === "endSession"), ["endSession"]);
	assert.equal(voice().voiceState, "listening");
	await waitFor("the disconnect", () => voice().voiceState === "idle", 3000);
	assert.equal(voice().connectionState, "idle");
	assert.equal(socket.readyState, 3);
});

test("unmounting mid-session closes the socket and releases the microphone", async (t) => {
	const { env, voice, unmount } = await mountVoice(t);
	const socket = await startSession(env, voice);
	await unmount();
	assert.equal(socket.readyState, 3);
	assert.equal(env.micStreams[0].track.stopped, true);
	await settle(700);
	assert.equal(env.sockets.length, 1);
});
