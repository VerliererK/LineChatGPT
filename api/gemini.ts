import { CONFIG } from "../config/config";
import fetchTimeout from "../utils/fetchTimeout";
import getTokens from "../utils/getTokens";

const GEMINI_API_KEY = CONFIG.GEMINI_API_KEY;
const GEMINI_MODEL = CONFIG.GEMINI_MODEL;
const API_TIMEOUT = CONFIG.OPENAI_API_TIMEOUT;

const DEFAULT_PAYLOAD = {
  generationConfig: {
    // maxOutputTokens: 256,
    // temperature: 1,
    // topP: 0.95,
    // topK: 64,
  },
  tools: [
    { googleSearch: {} },
  ],
};

export const config = {
  runtime: "edge",
};

export const generateMessage = async (
  messages: { role: string; content: string }[]
) => {
  const contents = messages.map(message => { return { role: message.role, parts: [{ text: message.content }] } });
  const payload = { ...DEFAULT_PAYLOAD, contents };
  const res = await fetchTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify(payload),
    },
    API_TIMEOUT
  );
  if (!res.ok) {
    const ret = await res.text();
    console.error(ret);
    throw new Error(res.statusText);
  }

  const data = await res.json();

  let message = "";
  let finish_reason = data.finishReason;
  let total_tokens = 0;
  if (Array.isArray(data.candidates)) {
    message = data.candidates[0].content.parts[0].text.trim();
    finish_reason = data.candidates[0].finishReason
    total_tokens = getTokens(message);
  }

  if (finish_reason === "block") {
    message = `Block by gemini: ${data}`;
  }

  return { message, finish_reason, total_tokens };
}

export default async (req: Request): Promise<Response> => {
  const { text } = (await req.json()) as { text: string };
  const { message, finish_reason, total_tokens } = await generateMessage([{ role: "user", content: text }]);
  return new Response(JSON.stringify({ message, finish_reason, total_tokens }));
};
