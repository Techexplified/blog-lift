import { DEFAULT_OPENROUTER_MODEL } from "../openrouter.server";

/**
 * GET — metadata and links for OpenRouter (call before saving an API key in the client).
 */
export async function loader() {
  return Response.json({
    provider: "OpenRouter",
    homeUrl: "https://openrouter.ai/",
    keysUrl: "https://openrouter.ai/keys",
    docsUrl: "https://openrouter.ai/docs",
    apiBaseUrl: "https://openrouter.ai/api/v1",
    chatCompletionsUrl: "https://openrouter.ai/api/v1/chat/completions",
    defaultModel: DEFAULT_OPENROUTER_MODEL,
    message:
      "Create an API key on OpenRouter, paste it in BlogLift, and keep it in your browser only.",
  });
}

export async function action() {
  return Response.json(
    { error: "Use GET /api/openrouter for provider info and links." },
    { status: 405, headers: { Allow: "GET" } },
  );
}
