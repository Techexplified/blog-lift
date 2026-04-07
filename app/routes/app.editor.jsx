import {
  useLoaderData,
  useRouteError,
  useSearchParams,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import BlogEditorWorkspace from "../components/BlogEditorWorkspace";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const isNew = url.searchParams.get("new") === "1";

  if (!id || isNew) {
    return { initialDraft: null, isNew };
  }

  try {
    const initialDraft = await prisma.post.findFirst({
      where: { id, shop: session.shop },
    });
    return { initialDraft, isNew: false };
  } catch {
    return { initialDraft: null, isNew: false };
  }
};

export default function EditorRoute() {
  const { initialDraft, isNew } = useLoaderData();
  const [searchParams] = useSearchParams();
  const draftKey = isNew ? "new" : searchParams.get("id") || "new";

  return (
    <BlogEditorWorkspace
      key={draftKey}
      initialDraft={initialDraft}
      forceNew={!!isNew}
    />
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
