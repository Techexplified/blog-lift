import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const pathname = new URL(request.url).pathname;
  // #region agent log
  fetch("http://127.0.0.1:7697/ingest/a18a9cec-7dcc-4b42-a60d-5572eee3fb6a", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "7041f3",
    },
    body: JSON.stringify({
      sessionId: "7041f3",
      location: "app.jsx:loader:start",
      message: "app layout loader enter",
      data: { pathname },
      timestamp: Date.now(),
      hypothesisId: "H2",
      runId: "pre-fix",
    }),
  }).catch(() => {});
  // #endregion
  await authenticate.admin(request);
  // #region agent log
  fetch("http://127.0.0.1:7697/ingest/a18a9cec-7dcc-4b42-a60d-5572eee3fb6a", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "7041f3",
    },
    body: JSON.stringify({
      sessionId: "7041f3",
      location: "app.jsx:loader:auth-ok",
      message: "authenticate.admin completed",
      data: { pathname },
      timestamp: Date.now(),
      hypothesisId: "H2",
      runId: "pre-fix",
    }),
  }).catch(() => {});
  // #endregion

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <AppProvider embedded apiKey={apiKey}>
        <s-app-nav>
          <s-link href="/app">Home</s-link>
          <s-link href="/app/dashboard">Dashboard</s-link>
          <s-link href="/app/editor">Editor</s-link>
          <s-link href="/app/scheduler">Scheduler</s-link>
          <s-link href="/app/blogs">My Posts</s-link>
        </s-app-nav>
        <Outlet />
      </AppProvider>
    </div>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
