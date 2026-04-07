import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const data = await request.json();

  // Determine publication status
  // If isPublished is true, we set the date to now. If false, we null it to hide it.
  // const publishedAt = data.isPublished ? new Date().toISOString() : null;

  const response = await admin.graphql(
    `#graphql
    mutation articleUpdate($id: ID!, $article: ArticleUpdateInput!) {
      articleUpdate(id: $id, article: $article) {
        article {
          id
          title
        }
        userErrors {
          field
          message
        }
      }
    }
    `,
    {
      variables: {
        id: data.id,
        article: {
          title: data.title,
          body: data.bodyHtml,
          tags: data.tags,
          // Visibility toggle
          // publishedAt: publishedAt,
          // SEO Metadata via Metafields
          metafields: [
            {
              namespace: "seo",
              key: "title_tag",
              value: data.seoTitle,
              type: "single_line_text_field",
            },
            {
              namespace: "seo",
              key: "description_tag",
              value: data.seoDescription,
              type: "multi_line_text_field",
            },
          ],
        },
      },
    },
  );

  const result = await response.json();

  if (result.errors || result.data?.articleUpdate?.userErrors?.length > 0) {
    console.error("Shopify errors:", JSON.stringify(result, null, 2));
    const errorMessage =
      result.data?.articleUpdate?.userErrors?.[0]?.message || "GraphQL Error";
    return Response.json({ error: errorMessage }, { status: 400 });
  }

  return Response.json({
    success: true,
    article: result.data.articleUpdate.article,
  });
};
