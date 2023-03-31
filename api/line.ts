import { CONFIG } from "../config/config";

export const config = {
  runtime: "edge",
};

export const reply = async (
  messages: { type: string; text: string }[],
  replyToken: string | null
) => {
  if (replyToken == null) return;
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CONFIG.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken: replyToken,
      messages: messages,
    }),
  });
};

export const replyText = async (text: string, replyToken: string | null) => {
  await reply([{ type: "text", text: text }], replyToken);
};

export default async (req: Request): Promise<Response> => {
  const data = await req.json();
  const { replyToken, text } = data as { replyToken?: string; text?: string };
  if (replyToken && text) await replyText(text, replyToken);
  return new Response(null, { status: 200 });
};
