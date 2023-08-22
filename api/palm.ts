import { CONFIG } from "../config/config";
import fetchTimeout from "../utils/fetchTimeout";
import getTokens from "../utils/getTokens";

const PALM_API_KEY = CONFIG.PALM_API_KEY;
const API_TIMEOUT = CONFIG.OPENAI_API_TIMEOUT;

const DEFAULT_PAYLOAD = {
};

export const config = {
  runtime: "edge",
  regions: ["iad1"],
};

export const generateMessage = async (
  messages: { role: string; content: string }[]
) => {
  const prompt = {
    messages: messages.map((message) => {
      return { author: message.role, content: message.content };
    })
  };
  const payload = { ...DEFAULT_PAYLOAD, prompt };
  const res = await fetchTimeout(
    `https://generativelanguage.googleapis.com/v1beta2/models/chat-bison-001:generateMessage?key=${PALM_API_KEY}`,
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
  let finish_reason = "done";
  let total_tokens = 0;
  if (Array.isArray(data.candidates)) {
    message = data.candidates[0].content.trim();
    total_tokens = getTokens(message);
  }

  if (Array.isArray(data.filters)) {
    finish_reason = "block";
    message = `Block by reasons: ${data.filters.map(filter => filter.reason).join(', ')}`;
  }
  // If any of the reason is "safety", then the safety_feedback field will be
  if (Array.isArray(data.safety_feedback)) {
    for (const feedback of data.safety_feedback) {
      message += `\nrating: ${feedback.rating}, setting: ${feedback.setting}`;
    }
  }

  return { message, finish_reason, total_tokens };
}

export default async (req: Request): Promise<Response> => {
  const { text } = (await req.json()) as { text: string };
  const { message, finish_reason, total_tokens } = await generateMessage([{ role: "user", content: text }]);
  return new Response(JSON.stringify({ message, finish_reason, total_tokens }));
};
