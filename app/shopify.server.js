import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";
import { MemorySessionStorage } from "./memory-session-storage.server";

/** Set `SHOPIFY_SESSION_STORAGE=prisma` + real `DATABASE_URL` + migrations when you want Postgres sessions again. */
const isProd = process.env.NODE_ENV === "production";
const hasDatabaseUrl = !!process.env.DATABASE_URL;
const usePrismaSessions =
  process.env.SHOPIFY_SESSION_STORAGE === "prisma" || (isProd && hasDatabaseUrl);

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: usePrismaSessions
    ? new PrismaSessionStorage(prisma)
    : new MemorySessionStorage(),
  distribution: AppDistribution.AppStore,
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

// #region agent log
fetch("http://127.0.0.1:7697/ingest/a18a9cec-7dcc-4b42-a60d-5572eee3fb6a", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Debug-Session-Id": "7041f3",
  },
  body: JSON.stringify({
    sessionId: "7041f3",
    location: "shopify.server.js:boot",
    message: "shopifyApp initialized",
    data: {
      hasApiKey: Boolean(process.env.SHOPIFY_API_KEY),
      hasSecret: Boolean(process.env.SHOPIFY_API_SECRET),
      hasAppUrl: Boolean((process.env.SHOPIFY_APP_URL || "").trim()),
      appUrlLength: (process.env.SHOPIFY_APP_URL || "").length,
      usePrismaSessions,
      hasDatabaseUrl,
      isProd,
      scopesDefined: Boolean(process.env.SCOPES),
    },
    timestamp: Date.now(),
    hypothesisId: "H1",
    runId: "pre-fix",
  }),
}).catch(() => {});
// #endregion

export default shopify;
export const apiVersion = ApiVersion.October25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
