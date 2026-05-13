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
    // 1. Find the post first to see if it has a Shopify ID
    const post = await prisma.post.findFirst({
      where: { id, shop },
    });

    if (!post) {
      return Response.json({ success: false, error: "Not found" }, { status: 404 });
    }

    // 2. If it's on Shopify, delete it there too
    if (post.shopifyArticleId) {
      try {
        const { admin } = await authenticate.admin(request);
        await admin.graphql(
          `#graphql
          mutation articleDelete($id: ID!) {
            articleDelete(id: $id) {
              deletedId
              userErrors {
                field
                message
              }
            }
          }
          `,
          { variables: { id: post.shopifyArticleId } }
        );
      } catch (shopErr) {
        console.error("Shopify article delete failed (skipping):", shopErr);
      }
    }

    // 3. Delete from local database
    await prisma.post.delete({
      where: { id },
    });

    return Response.json({ success: true });
  } catch (e) {
    console.error("api.seo.delete:", e);
    return Response.json(
      { success: false, error: "Database not available" },
      { status: 503 },
    );
  }
};
