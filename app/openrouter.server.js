const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

export const DEFAULT_OPENROUTER_MODEL =
  typeof process !== "undefined" && process.env?.OPENROUTER_MODEL
    ? process.env.OPENROUTER_MODEL
    : "openai/gpt-4o-mini";

/**
 * @param {object} opts
 * @param {string} opts.apiKey
 * @param {Array<{ role: string, content: string }>} opts.messages
 * @param {string} [opts.model]
 * @param {number} [opts.maxTokens]
 */
export async function openRouterChat({
  apiKey,
  messages,
  model = DEFAULT_OPENROUTER_MODEL,
  maxTokens = 4096,
}) {
  if (!apiKey?.trim()) {
    throw new Error("API key is required");
  }

  const referer =
    (typeof process !== "undefined" && process.env?.OPENROUTER_REFERER) ||
    "https://localhost";

  const res = await fetch(OPENROUTER_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey.trim()}`,
      "HTTP-Referer": referer,
      "X-Title": "BlogLift",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      data?.error?.message ||
      data?.message ||
      (typeof data === "string" ? data : null) ||
      `OpenRouter error (${res.status})`;
    throw new Error(msg);
  }

  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Empty response from OpenRouter");
  }

  return text.trim();
}

export function parseJsonFromModel(text) {
  let t = String(text).trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
  if (fence) t = fence[1].trim();
  return JSON.parse(t);
}
