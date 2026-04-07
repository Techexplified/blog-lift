import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const { id } = await request.json();

  if (!id) {
    return Response.json({ error: "Article ID is required" }, { status: 400 });
  }

  const response = await admin.graphql(
    `#graphql
    mutation articleDelete($id: ID!) {
      articleDelete(id: $id) {
        deletedArticleId
        userErrors {
          field
          message
        }
      }
    }
    `,
    {
      variables: { id },
    },
  );

  const result = await response.json();

  const errors = result.data?.articleDelete?.userErrors;

  if (errors?.length || result.errors) {
    console.error("Shopify delete error:", result);
    return Response.json(
      { error: errors?.[0]?.message || "Failed to delete article" },
      { status: 400 },
    );
  }

  return Response.json({
    success: true,
    deletedArticleId: result.data.articleDelete.deletedArticleId,
  });
};
