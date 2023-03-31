import { CONFIG } from "../config/config";
import fetchTimeout from "../utils/fetchTimeout";

const OPENAI_SYSTEM_ROLE = CONFIG.OPENAI_SYSTEM_ROLE;
const OPENAI_API_KEY = CONFIG.OPENAI_API_KEY;
const OPENAI_API_TIMEOUT = CONFIG.OPENAI_API_TIMEOUT;

// https://platform.openai.com/docs/api-reference/chat/create
const DEFAULT_PAYLOAD = {
  model: "gpt-3.5-turbo",
  // temperature: 1,
  top_p: CONFIG.OPENAI_TOP_P,
  max_tokens: CONFIG.OPENAI_MAX_TOKENS,
  presence_penalty: CONFIG.OPENAI_PRESENCE_PENALTY,
  frequency_penalty: CONFIG.OPENAI_FREQUENCY_PENALTY,
};

export const config = {
  runtime: "edge",
};

export const createChatByText = async (text: string) => {
  const messages: { role: string; content: string }[] = [];
  if (OPENAI_SYSTEM_ROLE) {
    messages.push({ role: "system", content: `OPENAI_SYSTEM_ROLE` });
  }
  messages.push({ role: "user", content: text });
  return createChat(messages);
};

export const createChat = async (
  messages: { role: string; content: string }[]
) => {
  const payload = { ...DEFAULT_PAYLOAD, messages };
  const res = await fetchTimeout(
    "https://api.openai.com/v1/chat/completions",
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      method: "POST",
      body: JSON.stringify(payload),
    },
    OPENAI_API_TIMEOUT
  );

  const data = await res.json();
  const choice = data["choices"][0];
  const message = choice["message"]["content"].trim();
  const finish_reason = choice["finish_reason"];
  const total_tokens = data["usage"]["total_tokens"];
  return { message, finish_reason, total_tokens };
};

export default async (req: Request): Promise<Response> => {
  const { text } = (await req.json()) as { text: string };
  const { message, finish_reason, total_tokens } = await createChatByText(text);
  return new Response(JSON.stringify({ message, finish_reason, total_tokens }));
};
