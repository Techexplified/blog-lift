import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const data = await request.json();

  // Determine publication status
  // If isPublished is true, we set the date to now. If false, we null it to hide it.
  const isPublished =
    typeof data.isPublished === "boolean" ? data.isPublished : undefined;

  const shouldWriteSeoMetafields =
    typeof data.seoTitle === "string" ||
    typeof data.seoDescription === "string";

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
          tags: Array.isArray(data.tags) ? data.tags : [],
          ...(isPublished !== undefined ? { isPublished } : {}),
          ...(shouldWriteSeoMetafields
            ? {
                metafields: [
                  ...(typeof data.seoTitle === "string"
                    ? [
                        {
                          namespace: "seo",
                          key: "title_tag",
                          value: data.seoTitle,
                          type: "single_line_text_field",
                        },
                      ]
                    : []),
                  ...(typeof data.seoDescription === "string"
                    ? [
                        {
                          namespace: "seo",
                          key: "description_tag",
                          value: data.seoDescription,
                          type: "multi_line_text_field",
                        },
                      ]
                    : []),
                ],
              }
            : {}),
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
