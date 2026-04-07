import { openRouterChat } from "../openrouter.server";

export async function action({ request }) {
  try {
    const body = await request.json();
    const {
      topic,
      keywords,
      tone,
      length,
      outline,
      outlineOnly,
    } = body;
    const apiKey = body.apiKey || body.userApiKey;

    if (!apiKey?.trim()) {
      return Response.json(
        { error: "Missing OpenRouter API key" },
        { status: 400 },
      );
    }

    const lengthStr = String(length).toLowerCase();
    const toneStr = String(tone).toLowerCase();
    const kwList = Array.isArray(keywords) ? keywords : [];

    const outlinePrompt = `
You are an SEO content strategist. Create a detailed blog OUTLINE only (no full body paragraphs).

Topic: ${topic}
Primary keywords: ${kwList.join(", ")}
Tone: ${toneStr}
Target article size: ${lengthStr}

Output format ONLY (use this exact markdown-style heading pattern, nothing else):
# Proposed H1 title here
## First major section
## Second major section
### Optional subsection when helpful
## Conclusion or CTA section

Rules:
- One H1 line, then several H2 lines (use ### sparingly for subsections).
- Title and headings must be specific to the topic and keyword.
- No bullet lists unless under a heading as short phrase lines.
- No preamble or closing commentary — only the outline lines.
`;

    const fullPrompt = `
You are an expert SEO blog writer.

Write a ${lengthStr} length, ${toneStr} tone blog post.

Topic: ${topic}
Primary Keywords: ${kwList.join(", ")}
Outline (follow this structure; expand into full prose): ${outline || "Create a logical SEO structure."}

Requirements:
- SEO optimized title (H1)
- Use clear H2/H3 headings
- Naturally include keywords
- 100% human-readable
- No explanations, only the final blog content
`;

    const prompt = outlineOnly ? outlinePrompt : fullPrompt;

    const content = await openRouterChat({
      apiKey,
      messages: [{ role: "user", content: prompt }],
      maxTokens: outlineOnly ? 2048 : 8192,
    });

    return Response.json({ content });
  } catch (err) {
    console.error("OpenRouter generate-blog:", err);
    return Response.json(
      { error: err.message || "AI generation failed" },
      { status: 500 },
    );
  }
}
