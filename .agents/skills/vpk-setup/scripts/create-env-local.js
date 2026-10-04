#!/usr/bin/env node
/**
 * Creates .env.local from .asap-config
 * Usage: node create-env-local.js <use-case-id> [email]
 *        use-case-id: REQUIRED - Your AI Gateway use case ID
 *        email: Optional - defaults to git config user.email
 */

const fs = require('fs');
const { execSync } = require('child_process');
const DEFAULT_GOOGLE_GATEWAY_URL =
	'https://ai-gateway.us-east-1.staging.atl-paas.net/v1/google/publishers/google/v1/chat/completions';
const DEFAULT_GOOGLE_IMAGE_MODEL = 'gemini-3-pro-image';
const LEGACY_GENERATED_GOOGLE_IMAGE_MODEL = 'gemini-3-pro-image-preview';
const DEFAULT_ROVO_BILLING_URL = 'https://product-fabric.atlassian.net';

function getEnvValueFromText(envText, key) {
	if (!envText || typeof envText !== 'string') {
		return null;
	}

	const pattern = new RegExp(`^\\s*${key}\\s*=\\s*(.+)$`, 'm');
	const match = envText.match(pattern);
	if (!match || !match[1]) {
		return null;
	}

	return match[1].trim();
}

function isGoogleGatewayUrl(url) {
	if (!url || typeof url !== 'string') {
		return false;
	}

	return /\/v1\/google\//.test(url.trim());
}

function resolveGoogleImageModel(preserved) {
	if (!preserved || typeof preserved !== 'string') {
		return DEFAULT_GOOGLE_IMAGE_MODEL;
	}

	const trimmed = preserved.trim();
	if (trimmed.length === 0 || trimmed === LEGACY_GENERATED_GOOGLE_IMAGE_MODEL) {
		return DEFAULT_GOOGLE_IMAGE_MODEL;
	}

	return trimmed;
}

// Get use case ID from args (REQUIRED)
const useCaseId = process.argv[2];
if (!useCaseId) {
	console.error('❌ Use case ID is required. Usage:');
	console.error('   node create-env-local.js <use-case-id> [email]');
	console.error('');
	console.error('Example:');
	console.error('   node create-env-local.js my-use-case your-email@atlassian.com');
	process.exit(1);
}

// Get email from args or git config
let email = process.argv[3];
if (!email) {
	try {
		email = execSync('git config user.email', { encoding: 'utf8' }).trim();
	} catch {
		console.error('❌ Could not determine email. Please provide as argument:');
		console.error('   node create-env-local.js ' + useCaseId + ' your-email@atlassian.com');
		process.exit(1);
	}
}

// Check for .asap-config
if (!fs.existsSync('.asap-config')) {
	console.error('❌ .asap-config not found. Generate it first with:');
	console.error('   TIMESTAMP=$(date +%s)');
	console.error('   atlas asap key generate --key ' + useCaseId + '/$TIMESTAMP --file .asap-config');
	process.exit(1);
}

const config = JSON.parse(fs.readFileSync('.asap-config', 'utf8'));
const escaped = config.privateKey.replace(/\n/g, '\\n');
const existingEnvText = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '';
const preservedGoogleUrl = getEnvValueFromText(existingEnvText, 'AI_GATEWAY_URL_GOOGLE');
const preservedRovoPoolSize = getEnvValueFromText(existingEnvText, 'ROVO_POOL_SIZE');
const preservedOpenaiModel = getEnvValueFromText(existingEnvText, 'OPENAI_MODEL');
const preservedGoogleImageModel = getEnvValueFromText(existingEnvText, 'GOOGLE_IMAGE_MODEL');
const preservedGoogleTtsModel = getEnvValueFromText(existingEnvText, 'GOOGLE_TTS_MODEL');
const preservedGoogleSttModel = getEnvValueFromText(existingEnvText, 'GOOGLE_STT_MODEL');
const preservedSttPreset = getEnvValueFromText(existingEnvText, 'STT_PRESET');
const preservedSttPresetGoogleProvider = getEnvValueFromText(existingEnvText, 'STT_PRESET_GOOGLE_PROVIDER');
const preservedSttPresetWhisperTinyProvider = getEnvValueFromText(existingEnvText, 'STT_PRESET_WHISPER_TINY_PROVIDER');
const preservedSttPresetWhisperTinyModel = getEnvValueFromText(existingEnvText, 'STT_PRESET_WHISPER_TINY_MODEL');
const preservedSttPresetWhisperLargeV3Provider = getEnvValueFromText(existingEnvText, 'STT_PRESET_WHISPER_LARGE_V3_PROVIDER');
const preservedSttPresetWhisperLargeV3Model = getEnvValueFromText(existingEnvText, 'STT_PRESET_WHISPER_LARGE_V3_MODEL');
const preservedSttPresetQwenProvider = getEnvValueFromText(existingEnvText, 'STT_PRESET_QWEN3_0_6B_PROVIDER');
const preservedSttPresetQwenModel = getEnvValueFromText(existingEnvText, 'STT_PRESET_QWEN3_0_6B_MODEL');
const preservedSttPresetQwenAsrProvider = getEnvValueFromText(existingEnvText, 'STT_PRESET_QWEN3_ASR_PROVIDER');
const preservedSttPresetQwenAsrModel = getEnvValueFromText(existingEnvText, 'STT_PRESET_QWEN3_ASR_MODEL');
const preservedLocalWhisperModel = getEnvValueFromText(existingEnvText, 'LOCAL_WHISPER_MODEL');
const preservedLocalWhisperBin = getEnvValueFromText(existingEnvText, 'LOCAL_WHISPER_BIN');
const preservedOpenAiCompatibleSttModel = getEnvValueFromText(existingEnvText, 'OPENAI_COMPATIBLE_STT_MODEL');
const preservedOpenAiCompatibleSttBaseUrl = getEnvValueFromText(existingEnvText, 'OPENAI_COMPATIBLE_STT_BASE_URL');
const preservedOpenAiCompatibleSttApiKey = getEnvValueFromText(existingEnvText, 'OPENAI_COMPATIBLE_STT_API_KEY');
const preservedSessionToken = getEnvValueFromText(existingEnvText, 'ROVO_SESSION_TOKEN');
const preservedDebug = getEnvValueFromText(existingEnvText, 'DEBUG');
const preservedPort = getEnvValueFromText(existingEnvText, 'PORT');
const preservedBackendUrl = getEnvValueFromText(existingEnvText, 'BACKEND_URL');
const preservedPublicApiUrl = getEnvValueFromText(existingEnvText, 'NEXT_PUBLIC_API_URL');
const preservedRovoSiteUrl = getEnvValueFromText(existingEnvText, 'ROVO_BILLING_URL');
const preservedRealtimeModel = getEnvValueFromText(existingEnvText, 'OPENAI_REALTIME_MODEL');
const preservedRealtimeWsUrl = getEnvValueFromText(existingEnvText, 'OPENAI_REALTIME_WS_URL');
const preservedRealtimeVoice = getEnvValueFromText(existingEnvText, 'OPENAI_REALTIME_VOICE');
const preservedRealtimeApiKey = getEnvValueFromText(existingEnvText, 'OPENAI_REALTIME_API_KEY');
const resolvedGoogleGatewayUrl = isGoogleGatewayUrl(preservedGoogleUrl)
	? preservedGoogleUrl
	: DEFAULT_GOOGLE_GATEWAY_URL;
const preservedCloudId = getEnvValueFromText(existingEnvText, 'AI_GATEWAY_CLOUD_ID');
const resolvedCloudId =
	typeof preservedCloudId === 'string' && /^(internal|external)-dummy-/i.test(preservedCloudId.trim())
		? preservedCloudId.trim()
		: `internal-dummy-${useCaseId}`;
const resolvedRovoSiteUrl =
	typeof preservedRovoSiteUrl === 'string' && preservedRovoSiteUrl.trim().length > 0
		? preservedRovoSiteUrl.trim()
		: DEFAULT_ROVO_BILLING_URL;

const envContent = `# Chat routing
# - Standard /api/chat-sdk turns require Rovo Serve.
# - AI Gateway credentials below power gateway-backed routes such as image,
#   sound, suggestions, plan/title metadata, and Realtime voice.
#
# AI Gateway configuration
# Default: Claude via Bedrock (to switch to OpenAI, see guide-model-switch.md)
# Claude: /v1/bedrock/model/{MODEL_ID}/invoke-with-response-stream
# OpenAI: /v1/openai/v1/chat/completions
AI_GATEWAY_URL=https://ai-gateway.us-east-1.staging.atl-paas.net/v1/bedrock/model/anthropic.claude-sonnet-5/invoke-with-response-stream

# OpenAI model ID (used when AI_GATEWAY_URL points to an OpenAI endpoint)
${preservedOpenaiModel ? `OPENAI_MODEL=${preservedOpenaiModel}` : '# OPENAI_MODEL=gpt-6.1-sol'}

# Google/Gemini endpoint (for provider: "google" chat/image requests and Google TTS route derivation)
AI_GATEWAY_URL_GOOGLE=${resolvedGoogleGatewayUrl}
GOOGLE_IMAGE_MODEL=${resolveGoogleImageModel(preservedGoogleImageModel)}
${preservedGoogleTtsModel ? `GOOGLE_TTS_MODEL=${preservedGoogleTtsModel}` : 'GOOGLE_TTS_MODEL=tts-latest'}
${preservedGoogleSttModel ? `GOOGLE_STT_MODEL=${preservedGoogleSttModel}` : 'GOOGLE_STT_MODEL=gemini-3-flash-preview'}

# Speech-to-text preset used by live voice mode and /api/speech-transcription
# Supported presets:
# - whisper-tiny
# - whisper-large-v3
# - google
# - qwen3-0.6b
# - qwen3-asr
${preservedSttPreset ? `STT_PRESET=${preservedSttPreset}` : 'STT_PRESET=qwen3-asr'}

${preservedSttPresetWhisperTinyProvider ? `STT_PRESET_WHISPER_TINY_PROVIDER=${preservedSttPresetWhisperTinyProvider}` : 'STT_PRESET_WHISPER_TINY_PROVIDER=local-whisper'}
${preservedSttPresetWhisperTinyModel ? `STT_PRESET_WHISPER_TINY_MODEL=${preservedSttPresetWhisperTinyModel}` : 'STT_PRESET_WHISPER_TINY_MODEL=tiny'}

${preservedSttPresetWhisperLargeV3Provider ? `STT_PRESET_WHISPER_LARGE_V3_PROVIDER=${preservedSttPresetWhisperLargeV3Provider}` : 'STT_PRESET_WHISPER_LARGE_V3_PROVIDER=local-whisper'}
${preservedSttPresetWhisperLargeV3Model ? `STT_PRESET_WHISPER_LARGE_V3_MODEL=${preservedSttPresetWhisperLargeV3Model}` : 'STT_PRESET_WHISPER_LARGE_V3_MODEL=large-v3'}

${preservedSttPresetGoogleProvider ? `STT_PRESET_GOOGLE_PROVIDER=${preservedSttPresetGoogleProvider}` : 'STT_PRESET_GOOGLE_PROVIDER=google'}
# Uses GOOGLE_STT_MODEL as the selected Google STT model.

${preservedSttPresetQwenProvider ? `STT_PRESET_QWEN3_0_6B_PROVIDER=${preservedSttPresetQwenProvider}` : 'STT_PRESET_QWEN3_0_6B_PROVIDER=openai-compatible'}
${preservedSttPresetQwenModel ? `STT_PRESET_QWEN3_0_6B_MODEL=${preservedSttPresetQwenModel}` : 'STT_PRESET_QWEN3_0_6B_MODEL=qwen3-0.6b'}

${preservedSttPresetQwenAsrProvider ? `STT_PRESET_QWEN3_ASR_PROVIDER=${preservedSttPresetQwenAsrProvider}` : 'STT_PRESET_QWEN3_ASR_PROVIDER=openai-compatible'}
${preservedSttPresetQwenAsrModel ? `STT_PRESET_QWEN3_ASR_MODEL=${preservedSttPresetQwenAsrModel}` : 'STT_PRESET_QWEN3_ASR_MODEL=qwen3-asr'}

${preservedLocalWhisperModel ? `LOCAL_WHISPER_MODEL=${preservedLocalWhisperModel}` : 'LOCAL_WHISPER_MODEL=tiny'}
${preservedLocalWhisperBin ? `LOCAL_WHISPER_BIN=${preservedLocalWhisperBin}` : 'LOCAL_WHISPER_BIN=whisper'}
# Optional fallback model for openai-compatible audio transcription endpoints
${preservedOpenAiCompatibleSttModel ? `OPENAI_COMPATIBLE_STT_MODEL=${preservedOpenAiCompatibleSttModel}` : '# OPENAI_COMPATIBLE_STT_MODEL=qwen3-asr'}
# Defaults to http://localhost:8801/v1 for qwen3-0.6b and qwen3-asr presets.
# Uncomment to override:
${preservedOpenAiCompatibleSttBaseUrl ? `OPENAI_COMPATIBLE_STT_BASE_URL=${preservedOpenAiCompatibleSttBaseUrl}` : '# OPENAI_COMPATIBLE_STT_BASE_URL=http://localhost:8801/v1'}
# Optional auth for the openai-compatible STT endpoint:
${preservedOpenAiCompatibleSttApiKey ? `OPENAI_COMPATIBLE_STT_API_KEY=${preservedOpenAiCompatibleSttApiKey}` : '# OPENAI_COMPATIBLE_STT_API_KEY='}

AI_GATEWAY_USE_CASE_ID=${useCaseId}
AI_GATEWAY_CLOUD_ID=${resolvedCloudId}
AI_GATEWAY_USER_ID=${email}

# ASAP Credentials (Required for AI Gateway-backed routes and production)
ASAP_PRIVATE_KEY="${escaped}"
ASAP_KID=${config.kid}
ASAP_ISSUER=${config.issuer}

# Default billing site for rovo serve (override as needed)
ROVO_BILLING_URL=${resolvedRovoSiteUrl}

# Rovo Session Token (one-time setup — does not expire)
# On first launch, Rovo Serve prints a session token to the terminal.
# Copy it here, then restart the dev stack.
${preservedSessionToken ? `ROVO_SESSION_TOKEN=${preservedSessionToken}` : '# ROVO_SESSION_TOKEN=<paste-token-from-rovo-serve-output>'}

# Rovo Serve pool size (number of concurrent Rovo instances for agents team, default: 1)${preservedRovoPoolSize ? `\nROVO_POOL_SIZE=${preservedRovoPoolSize}` : '\n# ROVO_POOL_SIZE=1'}

# OpenAI Realtime API (live voice conversation mode via AI Gateway)
${preservedRealtimeApiKey ? `OPENAI_REALTIME_API_KEY=${preservedRealtimeApiKey}` : '# OPENAI_REALTIME_API_KEY='}
${preservedRealtimeModel ? `OPENAI_REALTIME_MODEL=${preservedRealtimeModel}` : 'OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview'}
${preservedRealtimeWsUrl ? `OPENAI_REALTIME_WS_URL=${preservedRealtimeWsUrl}` : 'OPENAI_REALTIME_WS_URL=wss://ai-gateway.us-east-1.staging.atl-paas.net/v1/openai/v1/realtime'}
${preservedRealtimeVoice ? `OPENAI_REALTIME_VOICE=${preservedRealtimeVoice}` : 'OPENAI_REALTIME_VOICE=alloy'}

# Frontend configuration (for production builds)
# NEXT_PUBLIC_API_URL=https://your-service-name.us-west-2.platdev.atl-paas.net${preservedPublicApiUrl ? `\nNEXT_PUBLIC_API_URL=${preservedPublicApiUrl}` : ''}
${preservedDebug ? `\nDEBUG=${preservedDebug}` : ''}${preservedPort ? `\nPORT=${preservedPort}` : ''}${preservedBackendUrl ? `\nBACKEND_URL=${preservedBackendUrl}` : ''}
`;

fs.writeFileSync('.env.local', envContent);
console.log('✅ Created .env.local with Rovo chat + AI Gateway-backed route configuration');
console.log(`   AI_GATEWAY_USE_CASE_ID: ${useCaseId}`);
console.log(`   AI_GATEWAY_USER_ID: ${email}`);
console.log('   AI Gateway-assisted routes: configured');
console.log(`   ROVO_BILLING_URL: ${resolvedRovoSiteUrl}`);
console.log(`   ROVO_SESSION_TOKEN: ${preservedSessionToken ? 'preserved from existing .env.local' : '⚠️  NOT SET — copy from Rovo Serve first-launch output'}`);
console.log('   Main chat backend: Rovo Serve');
console.log('   Google image + voice endpoints: enabled');
console.log(`   STT_PRESET: ${preservedSttPreset || 'qwen3-asr'}`);
console.log(`   OPENAI_REALTIME_WS_URL: ${preservedRealtimeWsUrl || 'wss://ai-gateway.us-east-1.staging.atl-paas.net/v1/openai/v1/realtime'} (via AI Gateway)`);
if (preservedGoogleUrl && !isGoogleGatewayUrl(preservedGoogleUrl)) {
	console.warn('⚠️  Existing AI_GATEWAY_URL_GOOGLE was not a Google endpoint and was reset to default.');
}
console.log('');
console.log('💡 To switch default model, see: .agents/skills/vpk-setup/references/guide-model-switch.md');
