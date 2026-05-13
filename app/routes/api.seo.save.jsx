import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const body = await request.json();
  const { id, title, content, keyword, score, published, shopifyArticleId } = body;

  if (!title) return Response.json({ error: "Missing title" }, { status: 400 });

  const contentStr = typeof content === "string" ? content : "";
  const keywordStr = typeof keyword === "string" ? keyword : "";
  const scoreNum = Number.isFinite(Number(score)) ? Number(score) : 0;
  const publishedBool = Boolean(published);

  try {
    // If it's a Shopify article, we might have a local draft linked to it
    const findId = shopifyArticleId || (id && !id.startsWith("gid://") ? id : null);

    if (findId) {
      const existing = await prisma.post.findFirst({
        where: {
          OR: [
            { id: findId },
            { shopifyArticleId: findId }
          ],
          shop
        },
      });

      if (existing) {
        const updated = await prisma.post.update({
          where: { id: existing.id },
          data: {
            title,
            content: contentStr,
            keyword: keywordStr,
            score: scoreNum,
            published: publishedBool,
            shopifyArticleId: shopifyArticleId || existing.shopifyArticleId,
          },
        });
        return Response.json(updated);
      }
    }

    const created = await prisma.post.create({
      data: {
        title,
        content: contentStr,
        keyword: keywordStr,
        score: scoreNum,
        shop,
        published: publishedBool,
        shopifyArticleId,
      },
    });

    return Response.json(created);
  } catch (e) {
    console.error("api.seo.save:", e);
    return Response.json(
      {
        error:
          "Database not configured or migration missing. Set DATABASE_URL (Neon), run prisma migrate deploy, then try again.",
      },
      { status: 503 },
    );
  }
}
