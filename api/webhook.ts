import { CONFIG } from "../config/config";
import { createChat } from "./openai";
import { clearMessages, getMessages, setMessages } from "../lib/database";
import { replyText } from "./line";

export const config = {
  runtime: "edge",
};

const handleLineMessage = async (event) => {
  const { replyToken } = event;
  const userId = event.source.userId;
  const { type, text } = event.message;

  if (text === "忘記") {
    await clearMessages(userId);
    await replyText("已忘記", replyToken);
  } else if (type === "text") {
    const messages = await getMessages(userId);
    messages.push({ role: "user", content: text });

    const startTime = Date.now();
    const { message, finish_reason, total_tokens } = await createChat(messages);
    const elapsed = Date.now() - startTime;
    console.log(
      `[Info]: total_tokens: ${total_tokens}, finish_reason: ${finish_reason}, elapsed: ${elapsed}ms`
    );

    await replyText(message, replyToken);
    messages.push({ role: "assistant", content: message });
    await setMessages(userId, messages);
  } else {
    await replyText("不支援此訊息類別", replyToken);
  }
};

export default async (req: Request): Promise<Response> => {
  let replyToken = null;
  try {
    CONFIG.API_HOST = CONFIG.API_HOST || new URL(req.url).origin;
    const { events } = await req.json();
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
