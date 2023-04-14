import { CONFIG } from "../config/config";

const OPENAI_API_KEY = CONFIG.OPENAI_API_KEY;

export const config = {
  runtime: "edge",
};

export const getUsage = async () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const start_date = year + "-" + ("0" + month).slice(-2) + "-01";
  const end_date = year + "-" + ("0" + (month + 1)).slice(-2) + "-01";
  const res = await fetch(`https://api.openai.com/v1/dashboard/billing/usage?start_date=${start_date}&end_date=${end_date}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    method: "GET",
  });
  if (!res.ok) throw new Error(res.statusText);
  const { total_usage } = await res.json();
  return total_usage;
}

export const getSubscription = async () => {
  const res = await fetch('https://api.openai.com/dashboard/billing/subscription', {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    method: "GET",
  });
  if (!res.ok) throw new Error(res.statusText);
  const { hard_limit_usd, soft_limit_usd, system_hard_limit_usd } = await res.json();
  return { hard_limit_usd, soft_limit_usd, system_hard_limit_usd };
}

export default async (req: Request): Promise<Response> => {
  const total_usage = await getUsage();
  const { hard_limit_usd } = await getSubscription();

  return new Response(`Usage this month: $${(total_usage / 100).toFixed(2)} / ${hard_limit_usd.toFixed(2)}`);
};
