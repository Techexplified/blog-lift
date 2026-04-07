import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return Response.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const post = await prisma.post.findFirst({
      where: { id, shop },
    });

    if (!post) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json(post);
  } catch (e) {
    console.error("api.seo.get:", e);
    return Response.json({ error: "Database error" }, { status: 503 });
  }
}
