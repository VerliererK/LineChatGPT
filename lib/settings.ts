import { getSettings } from '../lib/neon';
import { decrypt } from '../lib/crypto';

/** Parse optional numeric setting; empty/null/invalid → undefined (keeps 0). */
const optionalNumber = (value: unknown): number | undefined => {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

export const getLLMSettings = async () => {
  const settings = await getSettings();

  return {
    LLM_PROVIDER: settings?.provider ?? "vercel",
    LLM_BASE_URL: settings?.base_url ?? "",
    LLM_API_KEY: await decrypt(settings?.api_key ?? ""),
    LLM_MODEL: settings?.model ?? "openai/gpt-5",
    LLM_SYSTEM_ROLE: settings?.system_role ?? "",
    LLM_MAX_TOKENS: Number(settings?.max_tokens) || 4096,
    LLM_TEMPERATURE: optionalNumber(settings?.temperature),
    LLM_TOP_P: optionalNumber(settings?.top_p),
    LLM_TIMEOUT: Number(settings?.timeout) || 290, // default to 290 seconds to avoid Vercel's 300 second limit
    LLM_STOP_WHEN: Number(settings?.stop_when) || 10,
    LLM_REASONING_EFFORT: settings?.reasoning_effort || undefined,
  };
};
