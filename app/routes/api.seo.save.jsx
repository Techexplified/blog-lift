import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const body = await request.json();
  const { id, title, content, keyword, score, published } = body;

  if (!title) return Response.json({ error: "Missing title" }, { status: 400 });

  const contentStr = typeof content === "string" ? content : "";
  const keywordStr = typeof keyword === "string" ? keyword : "";
  const scoreNum = Number.isFinite(Number(score)) ? Number(score) : 0;
  const publishedBool = Boolean(published);

  try {
    if (id) {
      const existing = await prisma.post.findFirst({
        where: { id, shop },
      });
      if (!existing) {
        return Response.json({ error: "Draft not found" }, { status: 404 });
      }
      const updated = await prisma.post.update({
        where: { id },
        data: {
          title,
          content: contentStr,
          keyword: keywordStr,
          score: scoreNum,
          published: publishedBool,
        },
      });
      return Response.json(updated);
    }

    const created = await prisma.post.create({
      data: {
        title,
        content: contentStr,
        keyword: keywordStr,
        score: scoreNum,
        shop,
        published: publishedBool,
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
