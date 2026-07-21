import DEFAULT_SYSTEM_ROLE from "./DEFAULT_SYSTEM_ROLE";
import { CONFIG } from "../utils/config";
import { getLLMSettings } from "../lib/settings";
import { z } from 'zod';
import { tool, stepCountIs, streamText, LanguageModel, ModelMessage, APICallError } from 'ai';
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createOpenAI } from "@ai-sdk/openai";

export interface ToolExecutors {
  clear?: () => Promise<boolean>;
}

export interface ChatOptions {
  enableTools?: boolean;
  toolExecutors?: ToolExecutors;
}

const createModel = (settings: any) => {
  let model: LanguageModel | undefined;

  if (settings.LLM_PROVIDER === "vercel") {
    return settings.LLM_MODEL;
  }

  if (settings.LLM_PROVIDER === "openai") {
    const openai = createOpenAI({
      apiKey: settings.LLM_API_KEY,
      baseURL: settings.LLM_BASE_URL || 'https://api.openai.com/v1',
    });
    model = openai.chat(settings.LLM_MODEL);
  }
  else if (settings.LLM_PROVIDER === "google") {
    const google = createGoogleGenerativeAI({
      apiKey: settings.LLM_API_KEY,
      baseURL: settings.LLM_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
    });
    model = google(settings.LLM_MODEL);
  }
  return model;
}

const createTools = (toolExecutors: ToolExecutors = {}) => {
  const tools: Record<string, any> = {};
  tools.current_time = tool({
    description: "取得當前台北時間 (Asia/Taipei, UTC+8)，用於理解今天、明天、現在等相對時間，或進行時區換算。",
    inputSchema: z.object({}),
    execute: async () => {
      const now = new Date();
      return {
        taipeiTime: now.toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false }),
        timeZone: "Asia/Taipei",
        utcOffset: "UTC+8",
        utcTime: now.toISOString(),
      };
    },
  });
  if (toolExecutors?.clear) {
    const clear = toolExecutors.clear;
    tools.clear = tool({
      description: '清除與 AI 的聊天紀錄 (Clear the chat history with the AI)',
      inputSchema: z.object({}),
      execute: async () => {
        const success = await clear();
        return success ? "Successfully cleared chat history" : "Failed to clear chat history";
      },
    });
  }
  if (CONFIG.GOOGLE_MAP_API_KEY) {
    const apiKey = CONFIG.GOOGLE_MAP_API_KEY;
    tools.geocode = tool({
      description: "使用 Google Maps 取得地點的經緯度。輸入地址或地點名稱，回傳該地點的經緯度。例如：'台北車站'。",
      inputSchema: z.object({
        address: z.string().describe("要查詢的地址或地點名稱，例如：'台北車站'。"),
      }),
      execute: async ({ address }, { abortSignal }) => {
        const result = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`, { signal: abortSignal })
          .then(response => response.json())
          .catch(err => {
            console.error('[Error] geocode: ', err);
            return `Error: ${err.message}`;
          });
        return result;
      },
    });
    tools.weather = tool({
      description: "使用 Google Maps 取得地點的天氣資訊。輸入經緯度，回傳該地點的天氣資訊。例如：'25.0478, 121.517'。",
      inputSchema: z.object({
        latitude: z.number().describe("要查詢的地點緯度，例如：25.0478。"),
        longitude: z.number().describe("要查詢的地點經度，例如：121.517。"),
      }),
      execute: async ({ latitude, longitude }, { abortSignal }) => {
        const result = await fetch(`https://weather.googleapis.com/v1/currentConditions:lookup?key=${apiKey}&location.latitude=${latitude}&location.longitude=${longitude}`, { signal: abortSignal })
          .then(response => response.json())
          .catch(err => {
            console.error('[Error] weather: ', err);
            return `Error: ${err.message}`;
          });
        return result;
      },
    });
    tools.weather_forecast = tool({
      description: "使用 Google Maps 取得地點的天氣預報。輸入經緯度，回傳該地點的天氣預報。例如：'25.0478, 121.517'。",
      inputSchema: z.object({
        latitude: z.number().describe("要查詢的地點緯度，例如：25.0478。"),
        longitude: z.number().describe("要查詢的地點經度，例如：121.517。"),
        time_range: z.enum(["days", "hours"]).describe("要查詢預報的時間範圍，例如：'days' 或 'hours'。"),
        hours: z.number().optional().default(24).describe("要查詢的小時數，例如：24。僅在 time_range 為 'hours' 時有效。最大值為 240。"),
        days: z.number().optional().default(3).describe("要查詢的天數，例如：3。僅在 time_range 為 'days' 時有效。最大值為 10。"),
      }),
      execute: async ({ latitude, longitude, time_range, hours, days }, { abortSignal }) => {
        const result = await fetch(`https://weather.googleapis.com/v1/forecast/${time_range}:lookup?key=${apiKey}&location.latitude=${latitude}&location.longitude=${longitude}&${time_range}=${time_range === "hours" ? hours : days}`, { signal: abortSignal })
          .then(response => response.json())
          .catch(err => {
            console.error('[Error] weather: ', err);
            return `Error: ${err.message}`;
          });
        return result;
      },
    });
    tools.google_map = tool({
      description: `使用 Google Maps Places API 搜尋地點資訊。可根據指定的經緯度與半徑，查詢附近的商家、餐廳、景點等，並回傳地點名稱、Google Map連結、評分、價格等級等資料。
適用情境：
- 想知道某地附近有什麼推薦的餐廳、咖啡廳、景點等
- 查詢特定地點的詳細資訊（如名稱、地址、評分）
- 需要根據使用者輸入的關鍵字與地理位置，提供地點建議

請提供搜尋關鍵字、中心點經緯度與半徑，系統會回傳整理過的地點資訊，方便在 LINE 上閱讀。`,
      inputSchema: z.object({
        query: z.string().describe("要搜尋的關鍵字，例如：'台北車站附近的咖啡廳'。"),
        latitude: z.number().describe("搜尋中心點的緯度，例如台北車站為 25.0478。"),
        longitude: z.number().describe("搜尋中心點的經度，例如台北車站為 121.5170。"),
        radius: z.number().optional().default(1000).describe("搜尋半徑（公尺），最大 50,000 公尺，預設為 1000 公尺。"),
        language: z.string().optional().default('zh-TW').describe("搜尋結果的語言，預設為 'zh-TW'。"),
      }),
      execute: async ({ query, latitude, longitude, radius, language }, { abortSignal }) => {
        console.log(`[Info] google_map: ${query}, ${latitude}, ${longitude}, ${radius}, ${language}`);
        const result = await fetch('https://places.googleapis.com/v1/places:searchText', {
          signal: abortSignal,
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'places.displayName,places.googleMapsUri,places.rating,places.priceLevel',
            // places.rating only 1000 free requests per month, others are 5000 free requests per month
          },
          method: 'POST',
          body: JSON.stringify({
            textQuery: query,
            locationBias: { circle: { center: { latitude, longitude }, radius } },
            languageCode: language,
          }),
        })
          .then(res => res.json())
          .then(data => data.places)
          .catch(err => {
            console.error('[Error] google_map: ', err);
            return `Error: ${err.message}`;
          });
        return result;
      },
    });
  }
  if (CONFIG.TAVILY_API_KEY) {
    tools.tavily_search = tool({
      description: '使用 Tavily 在網路上搜尋最新資訊，如果用戶想要搜尋地點或餐廳，請使用 google_map 工具。 (Search the latest information on the web using Tavily)',
      inputSchema: z.object({
        query: z.string().describe('The search query.'),
        // topic: z.enum(['general', 'news']).optional().default('general').describe('The topic of the search. Default is general. If you want to search for news, use "news".'),
        days: z.number().optional().default(3).describe("The number of days back from the current date to include in the search results. This specifies the time frame of data to be retrieved. Please note that this feature is only available when using the 'news' search topic"),
        time_range: z.enum(['day', 'week', 'month', 'year']).optional().default('day').describe('The time range of the search. Default is day.'),
        max_results: z.number().optional().default(5).describe('The maximum number of results to return. Default is 5.'),
      }),
      execute: async ({ query, time_range, max_results }, { abortSignal }) => {
        const result = await fetch("https://api.tavily.com/search", {
          signal: abortSignal,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${CONFIG.TAVILY_API_KEY}`,
          },
          body: JSON.stringify({ query, time_range, max_results }),
        })
          .then(res => res.json())
          .then(data => data.results)
          .catch(err => {
            console.error('[Error] tavily: ', err);
            return `Error: ${err.message}`;
          });
        return result;
      },
    });
    tools.tavily_extract = tool({
      description: '使用 Tavily API 從一個或多個指定的 URL 中提取網頁內容',
      inputSchema: z.object({
        urls: z.string().describe('要提取內容的網頁 URL，可以是多個 URL，以逗號分隔'),
      }),
      execute: async ({ urls }, { abortSignal }) => {
        const result = await fetch("https://api.tavily.com/extract", {
          signal: abortSignal,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${CONFIG.TAVILY_API_KEY}`,
          },
          body: JSON.stringify({ urls: urls.split(',').map(url => url.trim()) }),
        })
          .then(res => res.json())
          .then(data => data.results)
          .catch(err => {
            console.error('[Error] tavily: ', err);
            return `Error: ${err.message}`;
          });
        return result;
      },
    });
  }
  return tools;
}

export const createChatConfig = async (messages: ModelMessage[], options: ChatOptions = {}) => {
  const { enableTools = true, toolExecutors } = options;
  const settings = await getLLMSettings();
  const model = createModel(settings);
  if (!model) {
    throw new Error("No model found");
  }

  const tools = enableTools ? createTools(toolExecutors) : undefined;
  const effort = settings.LLM_REASONING_EFFORT as string | undefined;

  return {
    model,
    maxOutputTokens: settings.LLM_MAX_TOKENS,
    temperature: settings.LLM_TEMPERATURE,
    topP: settings.LLM_TOP_P,
    system: settings.LLM_SYSTEM_ROLE || DEFAULT_SYSTEM_ROLE,
    messages,
    tools,
    stopWhen: stepCountIs(settings.LLM_STOP_WHEN),
    timeout: { totalMs: settings.LLM_TIMEOUT * 1000 },
    // 同時填 openai + google，讓 Vercel gateway 字串 model 也能吃到
    ...(effort ? {
      providerOptions: {
        openai: { reasoningEffort: effort },
        google: {
          thinkingConfig: effort === "none"
            ? { thinkingBudget: 0 }
            : { thinkingLevel: (effort === "xhigh" || effort === "max" ? "high" : effort) },
        },
      },
    } : {}),
    onError: ({ error }: { error: unknown }) => {
      console.error('[Error] streamText:', error);
    }
  };
}

// 失敗時回給使用者的訊息，附上截斷後的錯誤摘要方便除錯
// 注意：不要使用 APICallError 的 url 欄位（可能含 API key）
const errorReply = (error: unknown, fallback = "") => {
  let detail = error instanceof Error ? error.message : error ? String(error) : fallback;
  if (APICallError.isInstance(error)) {
    detail = `HTTP ${error.statusCode ?? "?"}: ${error.responseBody ?? error.message}`;
  }
  return `AI 發生錯誤，請點「重試」再試一次。${detail ? `\n(${detail.slice(0, 200)})` : ""}`;
};

export const createChat = async (messages: ModelMessage[], options: ChatOptions = {}) => {
  const startTime = Date.now();
  let aborted = false;
  let partialSteps: any[] = [];
  let streamError: unknown;

  const config = await createChatConfig(messages, options);

  const result = streamText({
    ...config,
    onError: ({ error }: { error: unknown }) => {
      streamError = error;
      console.error('[Error] streamText:', error);
    },
    onAbort: ({ steps }) => {
      aborted = true;
      partialSteps = steps;
    },
  });

  let message = "";
  try {
    for await (const textPart of result.textStream) {
      message += textPart;
    }
  } catch (e) {
    if (!aborted) streamError ??= e;
  }

  if (aborted) {
    const elapsed = Date.now() - startTime;
    const toolUsage = partialSteps.flatMap(step => step.toolResults).map(r => r.toolName).join(',');
    console.log(`[Info] token: , finish_reason: timeout, tool_usage: ${toolUsage}, elapsed: ${elapsed}ms`);
    if (message)
      message += "...";
    else
      message = "抱歉，AI 處理逾時，請點「重試」再試一次。";
    return { message, finishReason: 'timeout', failed: true };
  }

  if (streamError) {
    return { message: errorReply(streamError), finishReason: 'error', failed: true };
  }

  const steps = await result.steps;
  const toolResults = steps.flatMap(step => step.toolResults);
  const toolUsage = toolResults.map(r => r.toolName).join(',');
  const finishReason = await result.finishReason;
  const usage = await result.usage;
  const totalTokens = usage?.totalTokens;
  const elapsed = Date.now() - startTime;
  console.log(`[Info] token: ${totalTokens}, finish_reason: ${finishReason}, tool_usage: ${toolUsage}, elapsed: ${elapsed}ms`);

  if (!message) {
    console.error(`[Error] empty response, finish_reason: ${finishReason}`);
    return { message: errorReply(undefined, `finish_reason: ${finishReason}`), finishReason, failed: true };
  }
  return { message, finishReason, failed: false };
}
