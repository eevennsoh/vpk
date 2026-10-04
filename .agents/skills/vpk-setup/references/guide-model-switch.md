# AI Model Switching Guide

> **Applies to: AI Gateway-backed routes only.**
> Model switching via `.env.local` has no effect on standard Rovo chat turns.
> Rovo Serve manages main chat internally.

This guide explains how to switch between Claude (Bedrock), GPT, and Gemini
(Google) models for AI Gateway-backed routes in VPK, and how to verify TTS
model routing.

---

## Quick Reference

| Provider | Model ID | Endpoint Path |
|----------|----------|---------------|
| **Claude (Default)** | `anthropic.claude-sonnet-5` | `/v1/bedrock/model/{MODEL_ID}/invoke-with-response-stream` |
| **GPT** | `gpt-6.1-sol` | `/v1/openai/v1/chat/completions` |
| **Gemini (Google)** | `gemini-3-pro-image` | `/v1/google/publishers/google/v1/chat/completions` |
| **TTS (Audio Speech)** | `tts-latest` | `/v1/google/v1/text:synthesize` (when model maps to `vendor: GOOGLE`) |

---

## For AI Agents: Model Switching Workflow

### Step 1: Determine Current Model

Check `.env.local` for the `AI_GATEWAY_URL`:

- Contains `/v1/bedrock/model/` → Currently using **Claude**
- Contains `/v1/openai/` → Currently using **GPT**
- Contains `/v1/google/` → Currently using **Gemini**

### Step 2: Switch to Desired Model

#### Switch to GPT

Edit `.env.local` and change `AI_GATEWAY_URL` to:

```bash
AI_GATEWAY_URL=https://ai-gateway.us-east-1.staging.atl-paas.net/v1/openai/v1/chat/completions
```

#### Switch to Gemini (Image Generation)

Edit `.env.local` and change `AI_GATEWAY_URL` to:

```bash
AI_GATEWAY_URL=https://ai-gateway.us-east-1.staging.atl-paas.net/v1/google/publishers/google/v1/chat/completions
```

#### Switch to Claude (Default)

Edit `.env.local` and change `AI_GATEWAY_URL` to:

```bash
AI_GATEWAY_URL=https://ai-gateway.us-east-1.staging.atl-paas.net/v1/bedrock/model/anthropic.claude-sonnet-5/invoke-with-response-stream
```

### Step 3: Restart Dev Servers

Instruct user: "Restart dev servers with `pnpm run dev`"

---

## How It Works

The VPK backend AI Gateway helpers automatically detect the endpoint type from `AI_GATEWAY_URL` and format payloads accordingly:

- **Bedrock endpoint** (`/v1/bedrock/model/`): Uses Claude format with `anthropic_version` and `max_tokens`
- **GPT endpoint** (`/v1/openai/`): Uses GPT format with `model` in payload and `max_completion_tokens`
- **Google endpoint** (`/v1/google/`): Uses Gemini format with `model` in payload; supports image generation

No code changes needed - just update the URL in `.env.local` and restart.

---

## Per-Request Provider Routing

Instead of switching the default model for all AI Gateway-backed routes, you
can add **additional provider endpoints** that are used only when a request
includes `provider: "google"` in its body. This keeps standard chat on
Rovo while routing specific features, such as image generation, to Gemini.

### How It Works

In this repo:

- `/api/chat-sdk`: keeps standard turns on Rovo, but certain explicit
  AI Gateway-backed flows can target Google when `provider: "google"` and
  `AI_GATEWAY_URL_GOOGLE` are set.
- `/api/sound-generation`: dedicated voice route; routes to the Google synth
  endpoint and is intended for `tts-latest` voice output.

| Env var                  | Used by                                  | Purpose                        |
| ------------------------ | ---------------------------------------- | ------------------------------ |
| `AI_GATEWAY_URL`         | AI Gateway-backed helper flows and default gateway routes | Default model (Bedrock/OpenAI) |
| `AI_GATEWAY_URL_GOOGLE`  | `provider: "google"` image flows + voice synthesis route | Google endpoint for image + voice |

### Setup

Add to `.env.local` alongside the existing `AI_GATEWAY_URL`:

```bash
AI_GATEWAY_URL_GOOGLE=https://ai-gateway.us-east-1.staging.atl-paas.net/v1/google/publishers/google/v1/chat/completions
```

These are independent — adding `AI_GATEWAY_URL_GOOGLE` does NOT affect normal chat flows. If `AI_GATEWAY_URL_GOOGLE` is not set, requests with `provider: "google"` fall back to the default `AI_GATEWAY_URL`.

### Verification

1. Restart dev servers: `pnpm run dev`
2. `/components/utility/image-generation` — should generate images via Gemini
3. `/components/utility/sound-generation` — should return playable MP3 audio
4. Sidebar/fullscreen chat — should still use the default model (Claude/GPT)
5. Sidebar/fullscreen chat — should work with Gemini

---

## TTS with AI Gateway

Use `tts-latest` with the AI Gateway Google synth endpoint when `atlas` shows `vendor: GOOGLE`:

- Docs: https://developer.atlassian.com/platform/ai-gateway/rest/v1/api-group-google/#api-v1-google-v1-text-synthesize-post
- Route: `POST /v1/google/v1/text:synthesize`
- In VPK, voice synthesis is a dedicated backend route (`/api/sound-generation`)
- Always verify mapping before implementation:
  - `atlas ml aigateway model view --modelId tts-latest`
  - `atlas ml aigateway usecase view --id YOUR-USE-CASE-ID -e stg-west`

Expected payload shape for Google synth is not chat-completions. It uses nested `input`/`voice`/`audioConfig` fields.

---

## Default Configuration (AI Gateway Fallback Mode)

By default, VPK uses **Claude via Bedrock** when AI Gateway is active:

```bash
# .env.local (default - Claude)
AI_GATEWAY_URL=https://ai-gateway.us-east-1.staging.atl-paas.net/v1/bedrock/model/anthropic.claude-sonnet-5/invoke-with-response-stream
```

---

## Default Models

OpenAI gateway requests use `OPENAI_MODEL`, defaulting to `gpt-6.1-sol`.
Bedrock and Google model IDs are resolved from their configured endpoint URLs.

---

## Using a Different Model

### For Claude Models

Update the model ID in the URL:

```bash
# Example: Using Claude Sonnet instead of Haiku
AI_GATEWAY_URL=https://ai-gateway.us-east-1.staging.atl-paas.net/v1/bedrock/model/anthropic.claude-sonnet-5/invoke-with-response-stream
```

### For GPT Models

Set the URL to the OpenAI endpoint and select the model in `.env.local`:

```bash
AI_GATEWAY_URL=https://ai-gateway.us-east-1.staging.atl-paas.net/v1/openai/v1/chat/completions
OPENAI_MODEL=gpt-6.1-sol
```

Restart the backend after changing these values. GPT-6.1 Sol is available via
AI Gateway v1 and v2 and shares the `gpt-sol-family` quota. VPK uses the existing
v1 chat completions integration. VPK omits temperature for GPT-6 Sol models
and reserves a minimum 2,048 completion tokens because that budget includes
reasoning as well as visible output.

---

## Checking Available Models

To see which models are whitelisted for your use case:

```bash
atlas ml aigateway usecase view --id YOUR-USE-CASE-ID -e stg-west
```

Look for the `offerings` section in the output.

### Check Provider Mapping (Recommended)

Before changing models, verify provider/category for a specific model:

```bash
atlas ml aigateway model view --modelId gemini-3-pro-image
atlas ml aigateway model view --modelId tts-latest
```

Provider mappings can vary by environment, so treat Atlas CLI output as the source of truth.

### Common Models

**Claude (Bedrock):**
- `anthropic.claude-haiku-4-5-20251001-v1:0` (fast, cheap)
- `anthropic.claude-sonnet-5` (latest)
- `anthropic.claude-opus-4-6` (most capable)

**GPT:**
- `gpt-6.1-sol` (latest)

**Gemini (Google):**
- `gemini-3-pro-image` (image generation + text)

**TTS (Audio):**
- `tts-latest` (text to speech via `/v1/google/v1/text:synthesize` when mapped to Google)

---

## Troubleshooting

### "Model Id [X] not found"

The model isn't whitelisted for your use case. Run:
```bash
atlas ml aigateway usecase view --id YOUR-USE-CASE-ID -e stg-west
```

Use one of the models listed in `offerings`.

### "Unsupported parameter: 'max_tokens'"

You're using a newer GPT model that requires `max_completion_tokens` instead of `max_tokens`. This is already handled in the codebase - make sure you have the latest `backend/lib/ai-gateway-helpers.js`.

### "not available for the OpenAI vendor"

You're hitting an OpenAI endpoint with a model that maps to Google (for example `tts-latest`).

Fix:
- Ensure `AI_GATEWAY_URL_GOOGLE` is set
- Route voice requests through `/api/sound-generation` (Google synth path)
- Restart backend dev server to clear stale endpoint logic

### Bedrock returns `403 poco: rejected authenticated request` but OpenAI works

If OpenAI endpoint calls succeed but Bedrock fails, check for legacy URL translation in your branch.
Older code rewrote Bedrock URLs from:

`/v1/bedrock/model/{MODEL_ID}/invoke-with-response-stream`

to:

`/provider/bedrock/format/openai/v1/chat/completions`

That rewritten path can fail POCO auth in some environments.

Fix:
- Pull latest changes where Bedrock URLs are kept unchanged in `backend/lib/ai-gateway-helpers.js` (`resolveGatewayUrl` should return the original Bedrock URL).
- Restart backend dev server after updating.
- Re-test with a simple route such as `POST /api/chat-title`.

If Bedrock still fails after the fix, verify principal/model access with:

```bash
atlas ml aigateway usecase view --id YOUR-USE-CASE-ID -e stg-east --active
atlas ml aigateway model view --modelId anthropic.claude-sonnet-5
```

### Changes not taking effect

Restart the dev servers:
```bash
# Stop current servers (Ctrl+C)
# Then restart
pnpm run dev
```

---

## Technical Details

### Claude (Bedrock) Payload Format

```json
{
  "anthropic_version": "bedrock-2023-05-31",
  "max_tokens": 2000,
  "system": "You are an AI assistant...",
  "messages": [
    {
      "role": "user",
      "content": [{ "type": "text", "text": "Hello" }]
    }
  ]
}
```

### GPT Payload Format

```json
{
  "model": "gpt-6.1-sol",
  "messages": [
    { "role": "system", "content": "You are an AI assistant..." },
    { "role": "user", "content": "Hello" }
  ],
  "max_completion_tokens": 2000,
  "temperature": 1,
  "stream": true
}
```

### Gemini (Google) Payload Format

```json
{
  "model": "gemini-3-pro-image",
  "messages": [
    { "role": "system", "content": "You are an AI assistant..." },
    { "role": "user", "content": "Hello" }
  ],
  "max_completion_tokens": 2000,
  "temperature": 1,
  "stream": true
}
```

### Google TTS Payload Format (`text:synthesize`)

```json
{
  "input": { "text": "Hello world" },
  "voice": { "languageCode": "en-US" },
  "audioConfig": {
    "audioEncoding": "MP3",
    "speakingRate": 1
  }
}
```

### Response Parsing

- **Claude (Bedrock)**: `data.delta?.text`
- **GPT**: `data.choices?.[0]?.delta?.content`
- **Gemini (Google)**: `data.choices?.[0]?.delta?.content` (text) and `data.choices?.[0]?.delta?.audio?.data` (image, base64-encoded)

The backend handles all formats automatically. For Gemini image responses, the backend extracts inline image data and emits it as `file` events in the UI message stream.

### Image Generation (Gemini Only)

When using the Gemini endpoint with a model that supports image generation (e.g., `gemini-3-pro-image`):

- The system prompt automatically enables image generation for Google endpoints
- Ask the model to "generate an image" and it will return inline base64 image data
- The backend detects image data in `choices[0].delta.audio.data` and emits it as a `file` event
- The frontend renders images with a download link
- Test at `/preview/utility/image-generation`

---

## Files Reference

| File | Purpose |
|------|---------|
| `.env.local` | Contains `AI_GATEWAY_URL` (default provider) and optional `AI_GATEWAY_URL_GOOGLE` (Google chat/image routing + voice route derivation) |
| `backend/lib/ai-gateway-helpers.js` | Contains model resolution, endpoint detection, and provider-specific request/stream helpers |
| `backend/server.js` | Backend routing, gateway-backed behavior, and endpoint handlers |
| `rovo/config.js` | Rovo user-message formatting (`buildUserMessage`) |
