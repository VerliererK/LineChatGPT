import { clearMessages } from "../lib/database";
import { getUsage, getSubscription } from "../api/usage";

export const COMMANDS = {
  forget: {
    keywords: ['/forget', '忘記'],
    handle: async (userId: string) => {
      await clearMessages(userId);
      return "已忘記";
    }
  },
  usage: {
    keywords: ['/usage', '用量'],
    handle: async () => {
      const [total_usage, { hard_limit_usd }] = await Promise.all([
        getUsage(),
        getSubscription(),
      ]);
      return `本月份用量: $${(total_usage / 100).toFixed(2)} / ${hard_limit_usd.toFixed(2)}`;
    }
  },
  help: {
    keywords: ['/help', '幫助', '說明', '指令'],
    handle: async () => {
      return `支援輸入以下指令:
      用量: 查詢本月用量
      忘記: 清除對話紀錄
      幫助: 查詢指令`;
    }
  }
};
