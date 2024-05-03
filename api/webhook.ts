import { CONFIG } from "../config/config";
import { createStreamChat as createChat_openai } from "./openai";
import { generateMessage as createChat_palm } from "./palm";
import { clearMessages, getMessages, setMessages } from "../lib/database";
import { replyText } from "./line";
import { COMMANDS } from "../lib/command";

export const config = {
  runtime: "edge",
  regions: ["iad1"],
};

const validateSignature = async (
  xLineSignature: string | null,
  body: string
) => {
  const channelSecret = CONFIG.LINE_CHANNEL_SECRET;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(channelSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle
    .sign("HMAC", key, enc.encode(body))
    .then((data) =>
      Buffer.from(
        String.fromCharCode(...new Uint8Array(data)),
        "binary"
      ).toString("base64")
    );

  return xLineSignature === signature;
};

const handleLineMessage = async (event) => {
  const { replyToken } = event;
  const userId = event.source.userId;
  const { type, text } = event.message;

  const command = Object.keys(COMMANDS).find((command) => {
    return COMMANDS[command].keywords.includes(text);
  });
  if (command) {
    const message = await COMMANDS[command].handle(userId);
    await replyText(message, replyToken);
  } else if (type === "text") {
    const messages = await getMessages(userId);
    messages.push({ role: "user", content: text });

    const startTime = Date.now();
    const createChat = CONFIG.LLM_API === 'palm' ? createChat_palm : createChat_openai;
    const { message, finish_reason, total_tokens } = await createChat(messages);
    const elapsed = Date.now() - startTime;
    console.log(
      `[Info]: total_tokens: ${total_tokens}, finish_reason: ${finish_reason}, elapsed: ${elapsed}ms`
    );

    await replyText(message, replyToken);
    messages.push({ role: "assistant", content: message });

    if (CONFIG.LLM_API === "palm" && finish_reason === "block") {
      return;
    }
    await setMessages(userId, messages);
  } else {
    await replyText("不支援此訊息類別", replyToken);
  }
};

export default async (req: Request): Promise<Response> => {
  let replyToken = null;
  try {
    CONFIG.API_HOST = CONFIG.API_HOST || new URL(req.url).origin;
    const body = await req.text();
    const xLineSignature = req.headers.get("x-line-signature");
    const isValidate = await validateSignature(xLineSignature, body);
    if (!isValidate) {
      throw Error("Validate Failed!");
    }
    const { events } = JSON.parse(body);
    replyToken = events[0].replyToken;
    if (events[0].type === "message") {
      await handleLineMessage(events[0]);
    }
  } catch (e) {
    let ret = e instanceof Error ? e.message : e;
    const timeout = e instanceof Error && e.name === "AbortError";
    if (timeout) {
      ret = "AI 已讀不回。";
    } else {
      console.error(e);
    }
    if (replyToken) {
      await replyText(`[Error]: ${ret}`, replyToken);
    }
  }

  return new Response(null, { status: 200 });
};
