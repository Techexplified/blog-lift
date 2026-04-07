import crypto from "crypto";
import prisma from "../db.server";

function verifyShopifyAppProxySignature(url) {
  const secret = process.env.SHOPIFY_API_SECRET || "";
  if (!secret) return false;

  const params = new URLSearchParams(url.searchParams);
  const signature = params.get("signature") || "";
  if (!signature) return false;
  params.delete("signature");

  // Shopify app proxy signature is built from the sorted query params
  // concatenated as: key=valuekey=value...
  const message = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("");

  const digest = crypto
    .createHmac("sha256", secret)
    .update(message)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(digest, "utf8"),
      Buffer.from(signature, "utf8"),
    );
  } catch {
    return false;
  }
}

/**
 * Shopify App Proxy endpoint for storefront view tracking.
 *
 * Configure in Shopify Partner Dashboard:
 * - App proxy prefix: /apps
 * - Subpath: /bloglift/views
 * - Proxy URL: https://YOUR_APP_DOMAIN/apps/views/track
 *
 * Storefront usage example:
 *   /apps/bloglift/views?articleId={{ article.id }}
 *
 * Shopify adds `shop`, `path_prefix`, `timestamp`, `signature` automatically.
 */
export async function loader({ request }) {
  const url = new URL(request.url);

  if (!verifyShopifyAppProxySignature(url)) {
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  }

  const shop = url.searchParams.get("shop");
  const articleId = url.searchParams.get("articleId");
  if (!shop || !articleId) {
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  }

  try {
    await prisma.articleView.upsert({
      where: { shop_articleId: { shop, articleId } },
      create: { shop, articleId, views: 1 },
      update: { views: { increment: 1 } },
    });
  } catch {
    // ignore
  }

  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

