import { openRouterChat } from "../openrouter.server";

export const action = async ({ request }) => {
  try {
    const body = await request.json();
    const apiKey = body.apiKey || body.userApiKey;
    const { content, keyword } = body;

    if (!apiKey?.trim()) {
      return Response.json({ error: "API key is required" }, { status: 400 });
    }

    const prompt = `You are an SEO content editor.

TASK:
Improve the SEO of the blog content below.

STRICT RULES:
- DO NOT add any introduction, explanation, notes, or commentary.
- DO NOT include phrases like "Here is", "Optimized content", "*" , "**" or "---".
- DO NOT explain what you changed.
- DO NOT add bullet points outside the article.
- Return ONLY the optimized blog content.

CONTENT RULES:
- Preserve the original meaning.
- Do not invent new facts.
- Improve readability and structure.
- Optimize for the keyword: "${keyword}".
- Use proper headings (H2/H3).
- Keep length roughly the same.

BLOG CONTENT:
${content}`;

    const text = await openRouterChat({
      apiKey,
      messages: [{ role: "user", content: prompt }],
      maxTokens: 8192,
    });

    return Response.json({ content: text });
  } catch (error) {
    console.error("AI Generation Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
};
