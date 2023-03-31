import { CONFIG } from "../config/config";

export const getMessages = async (
  userId: string
): Promise<{ role: string; content: string }[]> => {
  const res = await fetch(`${CONFIG.API_HOST}/api/user/${userId}`);
  const { messages } = await res.json();
  return messages;
};

export const setMessages = async (
  userId: string,
  messages: { role: string; content: string }[]
) => {
  return fetch(`${CONFIG.API_HOST}/api/user/${userId}`, {
    headers: { "Content-Type": "application/json" },
    method: "POST",
    body: JSON.stringify({ messages }),
  });
};

export const clearMessages = async (userId: string) => {
  return setMessages(userId, []);
};
