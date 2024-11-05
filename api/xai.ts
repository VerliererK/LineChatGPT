import { CONFIG } from "../config/config";
import fetchTimeout from "../utils/fetchTimeout";
import getTokens from "../utils/getTokens";

const XAI_MODEL = CONFIG.XAI_MODEL;
const XAI_SYSTEM_ROLE = CONFIG.OPENAI_SYSTEM_ROLE;
const XAI_API_KEY = CONFIG.XAI_API_KEY;
const XAI_API_TIMEOUT = CONFIG.OPENAI_API_TIMEOUT;

const DEFAULT_PAYLOAD = {
  model: XAI_MODEL,
  // temperature: 1,
};

export const config = {
  runtime: "edge",
};

export const createChatByText = async (text: string) => {
  const messages: { role: string; content: string }[] = [];
  if (XAI_SYSTEM_ROLE) {
    messages.push({ role: "system", content: XAI_SYSTEM_ROLE });
  }
  messages.push({ role: "user", content: text });
  return createChat(messages);
};

export const createChat = async (
  messages: { role: string; content: string }[]
) => {
  const payload = { ...DEFAULT_PAYLOAD, messages };
  const res = await fetchTimeout(
    "https://api.x.ai/v1/chat/completions",
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${XAI_API_KEY}`,
      },
      method: "POST",
      body: JSON.stringify(payload),
    },
    XAI_API_TIMEOUT
  );

  const data = await res.json();
  const choice = data["choices"][0];
  const message = choice["message"]["content"].trim();
  const finish_reason = choice["finish_reason"];
  const total_tokens = data["usage"]["total_tokens"];
  return { message, finish_reason, total_tokens };
};

export const createStreamChat = async (
  messages: { role: string; content: string }[]
) => {
  if (XAI_SYSTEM_ROLE) {
    messages.unshift({ role: "system", content: XAI_SYSTEM_ROLE });
  }
  const payload = { ...DEFAULT_PAYLOAD, messages, stream: true };
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${XAI_API_KEY}`,
    },
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(res.statusText);

  const data = res.body;
  if (!data) throw Error("Response Stream of openapi is null");

  const reader = data.getReader();
  const decoder = new TextDecoder();
  const controller = new AbortController();
  const { signal } = controller;
  setTimeout(() => controller.abort(), XAI_API_TIMEOUT);

  let message = "";
  let finish_reason = null;
  let tempChunk = "";
  while (true) {
    if (signal.aborted) break;
    const { value, done } = await reader.read();
    if (done) break;

    const chunkValues = decoder.decode(value).split("\n\n").filter(Boolean);
    if (tempChunk) {
      chunkValues[0] = tempChunk + chunkValues[0];
      tempChunk = "";
    }
    chunkValues.forEach((chunk) => {
      if (chunk === "data: [DONE]") return;
      try {
        if (!chunk.startsWith("data:")) throw Error;
        const json = JSON.parse(chunk.slice(5));
        const text = json.choices[0].delta?.content || "";
        finish_reason = json.choices[0].finish_reason;
        message += text;
      } catch {
        tempChunk = chunk;
      }
    });
  }

  const total_tokens = getTokens(message);
  return { message, finish_reason, total_tokens };
};

export default async (req: Request): Promise<Response> => {
  const { text } = (await req.json()) as { text: string };
  const { message, finish_reason, total_tokens } = await createChatByText(text);
  return new Response(JSON.stringify({ message, finish_reason, total_tokens }));
};
