import { authenticate } from "../shopify.server";

// app/routes/api.shopify.article.jsx

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const articleId = url.searchParams.get("id");

  if (!articleId) {
    return Response.json({ error: "Article ID missing" }, { status: 400 });
  }

  const response = await admin.graphql(
    `#graphql
    query getArticle($id: ID!) {
      article(id: $id) {
        id
        title
        body
        tags
        isPublished
        metafields(first: 20, namespace: "seo") {
          edges {
            node {
              key
              value
            }
          }
        }
        author {
          name
        }
        publishedAt
        blog {
          id
          title
        }
      }
    }
  `,
    {
      variables: { id: articleId },
    },
  );

  const json = await response.json();

  if (json.errors) {
    console.error("Shopify GraphQL Error:", json.errors);
    return Response.json({ error: json.errors }, { status: 500 });
  }

  const article = json.data.article;

  if (!article) {
    return Response.json({ error: "Article not found" }, { status: 404 });
  }

  /* -------------------------------
     Extract SEO metafields
  --------------------------------*/
  const metafields = article.metafields?.edges || [];

  const seoTitle =
    metafields.find((m) => m.node.key === "title_tag")?.node.value ||
    article.title;

  const seoDescription =
    metafields.find((m) => m.node.key === "description_tag")?.node.value || "";

  /* -------------------------------
     Return flattened response
  --------------------------------*/
  return Response.json({
    id: article.id,
    title: article.title,
    body: article.body,
    tags: article.tags,
    seoTitle,
    seoDescription,
    isPublished: !!article.isPublished,
    visibility: article.isPublished ? "Visible" : "Hidden",
    publishedAt: article.publishedAt,
  });
}
