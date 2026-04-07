import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const url = new URL(request.url);
  const draftsOnly = url.searchParams.get("draftsOnly") === "1";
  const publishedOnly = url.searchParams.get("publishedOnly") === "1";

  try {
    const posts = await prisma.post.findMany({
      where: {
        shop,
        ...(draftsOnly
          ? { published: false }
          : publishedOnly
            ? { published: true }
            : {}),
      },
      orderBy: { updatedAt: "desc" },
    });
    return Response.json(posts);
  } catch (e) {
    console.error("api.seo.list:", e);
    return Response.json([]);
  }
}
