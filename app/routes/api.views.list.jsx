import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const idsRaw = url.searchParams.get("ids") || "";
  const ids = idsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 250);

  if (!ids.length) return Response.json({});

  const rows = await prisma.articleView.findMany({
    where: { shop: session.shop, articleId: { in: ids } },
    select: { articleId: true, views: true },
  });

  const map = Object.fromEntries(rows.map((r) => [r.articleId, r.views]));
  return Response.json(map);
}

