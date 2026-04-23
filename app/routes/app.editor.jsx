import { useLoaderData, useRouteError, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import BlogEditorWorkspace from "../components/BlogEditorWorkspace";

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const isNew = url.searchParams.get("new") === "1";

  if (!id || isNew) {
    return { initialDraft: null, isNew, source: "bloglift" };
  }

  // Shopify article IDs are GIDs like: gid://shopify/Article/123
  const isShopifyArticleId =
    typeof id === "string" && id.startsWith("gid://shopify/Article/");

  if (isShopifyArticleId) {
    try {
      const response = await admin.graphql(
        `#graphql
        query getArticleForEditor($id: ID!) {
          article(id: $id) {
            id
            title
            body
            tags
            isPublished
            publishedAt
          }
        }
      `,
        { variables: { id } },
      );

      const json = await response.json();
      const article = json?.data?.article;
      if (!article)
        return { initialDraft: null, isNew: false, source: "shopify" };

      return {
        isNew: false,
        source: "shopify",
        initialDraft: {
          id: article.id,
          title: article.title,
          content: article.body || "<p></p>",
          keyword: "",
          score: 0,
          published: !!article.isPublished,
          updatedAt: article.publishedAt || null,
          tags: Array.isArray(article.tags) ? article.tags : [],
        },
      };
    } catch {
      return { initialDraft: null, isNew: false, source: "shopify" };
    }
  }

  try {
    const initialDraft = await prisma.post.findFirst({
      where: { id, shop: session.shop },
    });
    return { initialDraft, isNew: false, source: "bloglift" };
  } catch {
    return { initialDraft: null, isNew: false, source: "bloglift" };
  }
};

export default function EditorRoute() {
  const { initialDraft, isNew, source } = useLoaderData();
  const [searchParams] = useSearchParams();
  const draftKey = isNew ? "new" : searchParams.get("id") || "new";

  console.log({ initialDraft });

  return (
    <BlogEditorWorkspace
      key={draftKey}
      initialDraft={initialDraft}
      forceNew={!!isNew}
      source={source}
    />
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
