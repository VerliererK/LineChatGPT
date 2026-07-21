# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LINE chatbot deployed on Vercel Functions, powered by AI SDK v6 with tool calling, Neon PostgreSQL for persistence, and a React web UI for chat and settings management. Written in Traditional Chinese (zh-TW) context.

## Development Commands

```bash
# Type checking — backend
npx tsc --noEmit

# Type checking — frontend
cd web && npx tsc -b --noEmit

# Build frontend
cd web && npm run build

# Deploy (handled by Vercel CLI or Git push)
vercel

# Local development (backend)
vercel dev

# Local development (frontend, proxies /api to localhost:3000)
cd web && npm run dev
```

## Architecture

### Request Flow

LINE message → `api/webhook.ts` (signature validation) → `lib/neon.ts` (load user history) → `lib/ai.ts::createChat()` (stream AI response with tools) → `lib/line.ts` (reply to user) → `lib/neon.ts` (persist messages)

Image messages: the image is downloaded from LINE, downscaled and uploaded to Vercel Blob via `lib/blob.ts`, and persisted in history as an image-part URL (`{ type: 'image', image: <blob url> }`) so the model can see past images. When Blob is not configured or the upload fails, the original buffer is sent to the model for the current turn only and history stores a `"[User sent an image]"` placeholder.

### API Routes (`api/`)

Vercel Functions auto-discovered from `/api`. Each file exports named HTTP methods (`GET`, `POST`).

- **webhook.ts** — LINE webhook receiver. Validates HMAC-SHA256 signature, handles text/image messages.
- **chat.ts** — Streaming AI chat endpoint for the web UI. Protected by AUTH_KEY. Receives `UIMessage[]` from `useChat`, converts via `convertToModelMessages()`, returns `toUIMessageStreamResponse()`.
- **settings.ts** — GET/POST LLM configuration. Protected by AUTH_KEY bearer token. GET returns raw DB values (api_key stored encrypted). POST encrypts new api_key via `lib/crypto.ts`; preserves existing encrypted value when unchanged.
- **completions.ts** — Direct (non-streaming) AI chat endpoint. Protected by AUTH_KEY bearer token.

### Core Library (`lib/`)

- **ai.ts** — Central module. `createModel()` instantiates provider-specific models (Vercel/OpenAI/Google). `createTools()` conditionally registers tools based on available API keys. Both are exported for use by `api/chat.ts` and `api/webhook.ts`. `createChat()` orchestrates streaming with AI SDK v6's built-in `timeout` and `onAbort`, propagating `abortSignal` to all tool fetch calls.
- **neon.ts** — Database queries for `users` (conversation history as JSONB) and `settings` tables.
- **blob.ts** — Vercel Blob image storage. `uploadImage()` downscales images with sharp (max 1280px long edge, JPEG) before upload; `deleteImage()` removes blobs; `deleteImagesByPrefix()` deletes all blobs under a path prefix (e.g. `line/${userId}/`). The `clear` tool only wipes DB history during the tool loop; blob deletion is deferred until after the reply is sent, because later steps re-send image URLs to the provider and deleting blobs mid-conversation causes download failures. Enabled when `BLOB_READ_WRITE_TOKEN` or `BLOB_STORE_ID` (OIDC) is set; all functions degrade gracefully when disabled.
- **line.ts** — LINE Messaging API helpers (reply, push, get image content).
- **auth.ts** — Bearer token validation against `CONFIG.AUTH_KEY`.
- **DEFAULT_SYSTEM_ROLE.ts** — System prompt enforcing no-Markdown output (LINE limitation), Taiwan timezone, and tool-first behavior.
- **settings.ts** — Helper to load LLM settings from DB with defaults. Decrypts `api_key` via `lib/crypto.ts` before returning.
- **crypto.ts** — AES-256-GCM encryption/decryption using Web Crypto API (`crypto.subtle`). `encrypt()` produces `enc:<iv>:<data>` format; `decrypt()` restores plaintext. Falls back to passthrough when `ENCRYPTION_KEY` is unset or data is not encrypted.

### Configuration (`utils/config.ts`)

Environment variables loaded at runtime. `GOOGLE_MAP_API_KEY` and `TAVILY_API_KEY` are optional and control which tools are available. `ENCRYPTION_KEY` (optional, 32-byte hex) enables AES-256-GCM encryption for `api_key` in the database. `BLOB_READ_WRITE_TOKEN` or `BLOB_STORE_ID` (optional, read directly from `process.env` in `lib/blob.ts`) enables storing chat images in Vercel Blob.

### Database Schema (`database-schema.sql`)

Two tables: `users` (id, messages JSONB) and `settings` (key, value). LLM settings (provider, model, api_key, base_url, system_role, temperature, top_p, max_tokens, timeout, stop_when, reasoning_effort) are stored in `settings` and configurable via web UI.

### Tool System

Tools are conditionally registered in `createTools()` based on API key availability:
- **Always**: `clear` (clear conversation)
- **GOOGLE_MAP_API_KEY**: `geocode`, `weather`, `weather_forecast`, `google_map`
- **TAVILY_API_KEY**: `tavily_search`, `tavily_extract`

All network tools receive `abortSignal` from AI SDK and pass it to `fetch` for proper timeout cancellation.

### AI SDK v6 Patterns

- `streamText()` with `timeout: { totalMs }` and `onAbort` callback for timeout handling
- `stopWhen: stepCountIs(settings.LLM_STOP_WHEN)` (default 10) to limit tool loop iterations
- Optional `reasoning_effort` → `providerOptions` (OpenAI `reasoningEffort` + Google `thinkingConfig`); optional `topP`
- `ModelMessage` type for conversation history
- `inputSchema` with Zod for tool parameter validation
- Tools use `{ abortSignal }` from second `execute` parameter
- `convertToModelMessages()` converts `UIMessage[]` from frontend to `ModelMessage[]`
- `toUIMessageStreamResponse()` returns streaming Response for `useChat`

### Web Frontend (`web/`)

Vite + React app in `web/`, built and served as static files via `vercel.json`.

- **Tech**: React 19, `@ai-sdk/react` `useChat` hook, `DefaultChatTransport`
- **Auth gate**: Simple login form validates AUTH_KEY against `/api/settings`, stores in `sessionStorage`
- **Chat**: `useChat` with `DefaultChatTransport({ api: '/api/chat', headers })` for streaming. Supports image upload with client-side compression.
- **Settings panel**: Modal overlay opened via header gear button. Loads/saves LLM fields (provider, model, api_key, base_url, system_role, reasoning_effort, temperature, top_p, max_tokens, timeout, stop_when) via `GET/POST /api/settings`. Provider is a `<select>` limited to vercel/google/openai. Saves disabled when provider or model is empty. Success message auto-dismisses after 3 seconds.
- **UI**: LINE-style theme (#06C755 green header, green user bubbles, white assistant bubbles), responsive design. Font sizes unified to 3 tiers: `1.2rem` (headings), `1rem` (body), `0.85rem` (labels/captions).
- **Dev proxy**: `vite.config.ts` proxies `/api` to `http://localhost:3000`

### Deployment (`vercel.json`)

- `buildCommand`: `cd web && npm install && npm run build`
- `outputDirectory`: `web/dist`
- Backend API routes (`api/`) are auto-discovered by Vercel alongside the static frontend

## Key Constraints

- **No Markdown in AI output**: LINE doesn't render Markdown. The system prompt enforces plain text responses.
- **290s default timeout**: Vercel Functions have a 300s limit with Fluid Compute; default timeout is set to 290s.
- **Vercel provider**: When `LLM_PROVIDER=vercel`, the model string (e.g. `openai/gpt-5`) is passed directly as-is; other providers create SDK client instances.
