import { openRouterChat } from "../openrouter.server";

const OPS = {
  rewrite:
    "Rewrite for clarity and flow. Keep the same facts and meaning. Output ONLY the full article as plain text. Use blank lines between paragraphs. Use ## for main subheadings and ### for smaller ones where helpful. No preamble or closing remarks.",
  expand:
    "Add one short substantive paragraph where it fits the flow. Output ONLY the full updated article as plain text. Preserve existing structure. Use ## and ### for headings. No preamble.",
  simplify:
    "Simplify vocabulary and shorten sentences. Output ONLY the full article as plain text. Preserve headings marked with ## and ###. No preamble.",
};

export async function action({ request }) {
  try {
    const body = await request.json();
    const apiKey = body.apiKey || body.userApiKey;
    const { content, op } = body;

    if (!apiKey?.trim()) {
      return Response.json({ error: "API key is required" }, { status: 400 });
    }

    const instruction = OPS[op];
    if (!instruction) {
      return Response.json({ error: "Invalid op" }, { status: 400 });
    }

    const text = await openRouterChat({
      apiKey,
      messages: [
        {
          role: "user",
          content: `${instruction}\n\nARTICLE:\n${content}`,
        },
      ],
      maxTokens: 8192,
    });

    return Response.json({ content: text });
  } catch (error) {
    console.error("blog-transform:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
