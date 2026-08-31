import { getSettings } from "../lib/neon";
import { validateAuth } from "../lib/auth";
import { decrypt } from "../lib/crypto";
import { CONFIG } from "../utils/config";

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function validateAndFormatBaseUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/, "");
  try {
    new URL(trimmed);
  } catch {
    throw new Error(`無效的 Base URL 格式: ${trimmed}`);
  }

  return trimmed;
}

function sortModels(models: string[]): string[] {
  return Array.from(new Set(models)).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
  );
}

async function fetchModels(baseUrl: string, apiKey: string, provider: string): Promise<string[]> {
  const url = `${validateAndFormatBaseUrl(baseUrl)}/models`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (provider === "google") {
    headers["x-goog-api-key"] = apiKey;
  } else {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  try {
    const res = await fetch(url, { method: "GET", headers, signal: controller.signal });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      let message = `HTTP ${res.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        message = errorJson.error?.message || errorJson.message || message;
      } catch {
        if (errorText) message = `${message}: ${errorText.slice(0, 100)}`;
      }
      throw new Error(`API 錯誤 (${message})`);
    }

    const data = await res.json();
    const rawList = Array.isArray(data.data)
      ? data.data
      : Array.isArray(data.models)
        ? data.models
        : Array.isArray(data)
          ? data
          : [];

    const allIds: string[] = rawList
      .map((item: any) => (typeof item === "string" ? item : item?.id || item?.name))
      .filter((id: any): id is string => typeof id === "string" && id.trim().length > 0);

    return sortModels(allIds);
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: Request) {
  if (!validateAuth(req)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await req.json().catch(() => ({}));
    let provider = body.provider;
    let apiKey = body.api_key;
    let baseUrl = body.base_url;

    if (!provider) {
      return jsonResponse({ error: "請填寫 Provider", models: [] }, 400);
    }

    if (provider !== "vercel" && !apiKey) {
      return jsonResponse({ error: "請填寫 API Key", models: [] }, 400);
    }

    if (!apiKey || apiKey.startsWith("enc:")) {
      const saved = await getSettings();
      apiKey = await decrypt(saved?.api_key ?? "");
    }

    if (provider === "openai") {
      baseUrl = baseUrl || "https://api.openai.com/v1";
    } else if (provider === "google") {
      baseUrl = baseUrl || "https://generativelanguage.googleapis.com/v1beta";
    } else if (provider === "vercel") {
      baseUrl = "https://ai-gateway.vercel.sh/v1";
      apiKey = CONFIG.AI_GATEWAY_API_KEY;
    }

    try {
      const models = await fetchModels(baseUrl, apiKey, provider);
      return jsonResponse({ models }, 200);
    } catch (err: any) {
      return jsonResponse({ error: err.message || `無法取得模型列表`, models: [] }, 400);
    }
  } catch (error: any) {
    console.error("[Error] /api/models:", error);
    return jsonResponse({ error: error.message || "內部伺服器錯誤", models: [] }, 500);
  }
}
