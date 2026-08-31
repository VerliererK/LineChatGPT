export const CONFIG = {
  API_HOST: `https://${process.env.VERCEL_URL}`,

  // required
  LINE_CHANNEL_ACCESS_TOKEN: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "",
  LINE_CHANNEL_SECRET: process.env.LINE_CHANNEL_SECRET ?? "",
  AUTH_KEY: process.env.AUTH_KEY ?? "",

  // optional
  GOOGLE_MAP_API_KEY: process.env.GOOGLE_MAP_API_KEY,
  TAVILY_API_KEY: process.env.TAVILY_API_KEY,
  AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY ?? "",
};
