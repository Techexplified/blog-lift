import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const { id } = await request.json();
  if (!id) {
    return Response.json({ success: false, error: "Missing id" }, { status: 400 });
  }

  try {
    const deleted = await prisma.post.deleteMany({
      where: { id, shop },
    });
    if (deleted.count === 0) {
      return Response.json(
        { success: false, error: "Not found" },
        { status: 404 },
      );
    }
    return Response.json({ success: true });
  } catch (e) {
    console.error("api.seo.delete:", e);
    return Response.json(
      { success: false, error: "Database not available" },
      { status: 503 },
    );
  }
};
