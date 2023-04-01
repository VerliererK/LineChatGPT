export const CONFIG = {
  API_HOST: process.env.API_HOST ?? "",
  OPENAI_SYSTEM_ROLE: process.env.OPENAI_SYSTEM_ROLE ?? null,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
  OPENAI_API_TIMEOUT: Number(process.env.OPENAI_API_TIMEOUT) || 28000,
  OPENAI_TOP_P: Number(process.env.OPENAI_TOP_P) || 0.3,
  OPENAI_MAX_TOKENS: Number(process.env.OPENAI_MAX_TOKENS) || 200,
  OPENAI_PRESENCE_PENALTY: Number(process.env.OPENAI_PRESENCE_PENALTY) || 0.6,
  OPENAI_FREQUENCY_PENALTY: Number(process.env.OPENAI_FREQUENCY_PENALTY) || 0,
  LINE_CHANNEL_ACCESS_TOKEN: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "",
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ?? "",
};
