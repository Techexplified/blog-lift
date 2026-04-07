import {
  openRouterChat,
  parseJsonFromModel,
  DEFAULT_OPENROUTER_MODEL,
} from "../openrouter.server";

export async function action({ request }) {
  try {
    const body = await request.json();
    const apiKey = body.apiKey || body.userApiKey;
    const title = String(body.title || "");
    const primaryKeyword = String(body.primaryKeyword || "");
    const bodyText = String(body.bodyText || "").slice(0, 12000);
    const hasH2 = !!body.hasH2;

    if (!apiKey?.trim()) {
      return Response.json({ error: "API key is required" }, { status: 400 });
    }

    const prompt = `You are an SEO analyst. Analyze this blog draft and respond with ONLY valid JSON (no markdown, no commentary).

Schema:
{
  "score": <integer 0-100, overall on-page SEO quality>,
  "tips": [ { "tone": "warn" | "info" | "ok", "text": "<short actionable tip>" } ],
  "suggestedKeywords": [ "<keyword or short phrase>" ]
}

Rules:
- tips: 3-6 items, specific to this content
- suggestedKeywords: 4-8 items: **keywords and short phrases** (how people search) that **typically rank on high-performing pages about the same or closely related topic** as this draft—not random synonyms. Think: terms you’d see targeting the same topic cluster, related searches, or titles of strong pages with **similar intent**.
  - Same niche and searcher intent as the draft; expand to sibling and long-tail angles (e.g. how-to, comparison, best X, fix Y) where appropriate.
  - Natural wording; 2-6 words typical; no duplicate of the primary keyword (case-insensitive), no near-duplicate strings.
  - Do NOT output generic single words unless they are clearly high-volume query forms (prefer phrases).
- Be honest: generic thin content should score lower

primaryKeyword: ${JSON.stringify(primaryKeyword)}
title: ${JSON.stringify(title)}
body (plain text, truncated): ${JSON.stringify(bodyText)}
hasH2: ${hasH2}`;

    const raw = await openRouterChat({
      apiKey,
      messages: [{ role: "user", content: prompt }],
      maxTokens: 1024,
    });

    let parsed;
    try {
      parsed = parseJsonFromModel(raw);
    } catch {
      return Response.json(
        { error: "AI returned invalid JSON for SEO insight" },
        { status: 502 },
      );
    }

    let score = Number(parsed.score);
    if (!Number.isFinite(score)) score = 0;
    score = Math.min(100, Math.max(0, Math.round(score)));

    const tips = Array.isArray(parsed.tips)
      ? parsed.tips
          .filter((x) => x && typeof x.text === "string")
          .map((x) => ({
            tone: ["warn", "info", "ok"].includes(x.tone) ? x.tone : "info",
            text: x.text.slice(0, 280),
          }))
          .slice(0, 8)
      : [];

    const pk = primaryKeyword.toLowerCase().trim();
    const suggestedKeywords = Array.isArray(parsed.suggestedKeywords)
      ? parsed.suggestedKeywords
          .filter((s) => typeof s === "string" && s.trim())
          .map((s) => s.trim().replace(/\s+/g, " "))
          .filter((s) => s.toLowerCase() !== pk)
          .filter((s, i, a) => a.findIndex((x) => x.toLowerCase() === s.toLowerCase()) === i)
          .slice(0, 10)
      : [];

    return Response.json({
      score,
      tips,
      suggestedKeywords,
      model: DEFAULT_OPENROUTER_MODEL,
    });
  } catch (error) {
    console.error("api.ai.seo-insight:", error);
    return Response.json(
      { error: error.message || "SEO insight failed" },
      { status: 500 },
    );
  }
}

export async function loader() {
  return Response.json({
    message: "POST JSON: { apiKey, title, primaryKeyword, bodyText, hasH2? }",
    getProviderInfo: "GET /api/openrouter",
  });
}
