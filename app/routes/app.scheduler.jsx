import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import SchedulerPage from "../components/SchedulerPage";
import prisma from "../db.server";

// ─── GraphQL ─────────────────────────────────────────────────────────────────

// articleUpdate: sets publishedAt to a future date → Shopify treats it as "Scheduled"
const ARTICLE_UPDATE_MUTATION = `#graphql
  mutation articleUpdate($id: ID!, $article: ArticleUpdateInput!) {
    articleUpdate(id: $id, article: $article) {
      article {
        id
        title
        publishedAt
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// articleCreate: correct field names for ArticleCreateInput
// NOTE: publishedAt is NOT on ArticleCreateInput — we set it via articleUpdate after creation
const ARTICLE_CREATE_MUTATION = `#graphql
  mutation articleCreate($article: ArticleCreateInput!) {
    articleCreate(article: $article) {
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
`;

const BLOGS_QUERY = `#graphql
  query GetBlogs {
    blogs(first: 50) {
      edges {
        node {
          id
          title
        }
      }
    }
  }
`;

// ─── Helper: create article then schedule it ──────────────────────────────────
async function createAndSchedule({ admin, blogId, title, body, scheduledAt, tags }) {
  // Fetch shop owner name to use as author (Shopify requirement)
  const shopRes = await admin.graphql(`
    query {
      shop {
        shopOwnerName
      }
    }
  `);
  const shopData = await shopRes.json();
  const authorName = shopData.data?.shop?.shopOwnerName || "BlogLift";

  // Step 1: Create the article (unpublished)
  const createRes = await admin.graphql(ARTICLE_CREATE_MUTATION, {
    variables: {
      article: {
        blogId,
        title,
        body: body || "<p>Content coming soon.</p>",
        author: { name: authorName },
        isPublished: false,
        tags: tags || "",
      },
    },
  });
  const createJson = await createRes.json();
  const createErrors = createJson.data?.articleCreate?.userErrors || [];
  if (createErrors.length > 0) {
    return { error: createErrors.map((e) => e.message).join(", ") };
  }

  const shopifyId = createJson.data?.articleCreate?.article?.id;
  if (!shopifyId) {
    return { error: "Shopify did not return an article ID." };
  }

  // Step 2: Set publishedAt to future date → Shopify schedules it
  const updateRes = await admin.graphql(ARTICLE_UPDATE_MUTATION, {
    variables: {
      id: shopifyId,
      article: {
        publishDate: scheduledAt.toISOString(),
      },
    },
  });
  const updateJson = await updateRes.json();
  const updateErrors = updateJson.data?.articleUpdate?.userErrors || [];
  if (updateErrors.length > 0) {
    return { error: updateErrors.map((e) => e.message).join(", ") };
  }

  return { shopifyId };
}

// ─── Loader ───────────────────────────────────────────────────────────────────

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const now = new Date();

  // 1. Sync past scheduled posts: If their time has passed, mark as published
  // We keep scheduledAt for historical/calendar purposes
  const pastScheduled = await prisma.post.findMany({
    where: {
      shop: session.shop,
      scheduledAt: { lt: now },
      published: false,
    },
  });

  if (pastScheduled.length > 0) {
    await prisma.post.updateMany({
      where: {
        id: { in: pastScheduled.map((p) => p.id) },
      },
      data: {
        published: true,
      },
    });
  }

  // 2. Fetch the updated lists
  const [drafts, allScheduled, blogsResponse] = await Promise.all([
    prisma.post.findMany({
      where: { shop: session.shop, published: false, scheduledAt: null },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.post.findMany({
      where: { 
        shop: session.shop, 
        scheduledAt: { not: null }
      },
      orderBy: { scheduledAt: "asc" },
    }),
    admin.graphql(BLOGS_QUERY),
  ]);

  // Filter for the UI
  // "Upcoming queue" should only show future unpublished posts
  const scheduledPosts = allScheduled.filter(p => !p.published && new Date(p.scheduledAt) > now);
  
  // Stats and calendar can use allScheduled (to show past events and historical published counts)
  // But to keep the component simple, let's just return what it needs.
  // Actually, SchedulerPage.jsx expects 'scheduledPosts' to be used for stats too.
  // Let's return both or return the full list and filter in the component?
  // Component currently does: const { drafts, scheduledPosts, blogs, rules } = useLoaderData();
  // It uses scheduledPosts for stats AND queue.
  
  const blogsJson = await blogsResponse.json();
  const blogs = blogsJson.data?.blogs?.edges?.map((e) => e.node) || [];

  const rules = prisma.publishRule
    ? await prisma.publishRule.findMany({ where: { shop: session.shop } }).catch(() => [])
    : [];

  return { drafts, scheduledPosts, allScheduled, blogs, rules };
};

// ─── Action ───────────────────────────────────────────────────────────────────

export const action = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const intent        = formData.get("intent");
  const id            = formData.get("id");
  const scheduledAtStr = formData.get("scheduledAt");
  const postType      = formData.get("postType") || "seo";
  const title         = formData.get("title");
  const blogId        = formData.get("blogId");

  // ── Schedule intent ───────────────────────────────────────────────────────
  if (intent === "schedule" && scheduledAtStr) {
    const scheduledAt = new Date(scheduledAtStr);

    if (scheduledAt <= new Date()) {
      return { success: false, error: "Scheduled time must be in the future." };
    }

    // ── Existing draft ────────────────────────────────────────────────────
    if (id && id !== "new") {
      const post = await prisma.post.findFirst({ where: { id, shop: session.shop } });
      if (!post) return { success: false, error: "Post not found." };

      // Save to local DB
      await prisma.post.update({
        where: { id: post.id },
        data: { scheduledAt, postType },
      });

      if (post.shopifyArticleId) {
        // Already on Shopify — just update publishedAt
        const res = await admin.graphql(ARTICLE_UPDATE_MUTATION, {
          variables: {
            id: post.shopifyArticleId,
            article: { 
              publishDate: scheduledAt.toISOString(),
            },
          },
        });
        const json = await res.json();
        const errors = json.data?.articleUpdate?.userErrors || [];
        if (errors.length > 0) {
          return { success: false, error: errors.map((e) => e.message).join(", ") };
        }
      } else if (blogId) {
        // Not on Shopify yet — create then schedule
        const result = await createAndSchedule({
          admin,
          blogId,
          title: post.title || "Scheduled Post",
          body: post.content || "",
          scheduledAt,
          tags: postType,
        });
        if (result.error) return { success: false, error: result.error };

        await prisma.post.update({
          where: { id: post.id },
          data: { shopifyArticleId: result.shopifyId },
        });
      }

      return { success: true, scheduled: true };
    }

    // ── New placeholder ───────────────────────────────────────────────────
    if (id === "new" && title && blogId) {
      const result = await createAndSchedule({
        admin,
        blogId,
        title,
        body: "",
        scheduledAt,
        tags: postType,
      });
      if (result.error) return { success: false, error: result.error };

      // Save to local DB for calendar display
      await prisma.post.create({
        data: {
          shop: session.shop,
          title,
          content: "",
          keyword: "",
          score: 0,
          published: false,
          scheduledAt,
          postType,
          shopifyArticleId: result.shopifyId || null,
        },
      });

      return { success: true, scheduled: true };
    }
  }

  // ── Update Schedule ────────────────────────────────────────────────────────
  if (intent === "updateSchedule" && id && scheduledAtStr) {
    const scheduledAt = new Date(scheduledAtStr);
    const post = await prisma.post.findFirst({ where: { id, shop: session.shop } });
    if (!post) return { success: false, error: "Post not found." };

    await prisma.post.update({
      where: { id },
      data: { scheduledAt, postType }
    });

    if (post.shopifyArticleId) {
      await admin.graphql(ARTICLE_UPDATE_MUTATION, {
        variables: {
          id: post.shopifyArticleId,
          article: { publishDate: scheduledAt.toISOString() }
        }
      });
    }

    return { success: true };
  }

  // ── Delete Scheduled ───────────────────────────────────────────────────────
  if (intent === "deleteScheduled" && id) {
    const post = await prisma.post.findFirst({ where: { id, shop: session.shop } });
    if (!post) return { success: false, error: "Post not found." };

    // Placeholder check: if no content/keyword, delete entirely
    if (!post.content && (!post.keyword || post.keyword === "")) {
      await prisma.post.delete({ where: { id } });
    } else {
      // Draft: just clear schedule
      await prisma.post.update({
        where: { id },
        data: { scheduledAt: null }
      });
    }

    if (post.shopifyArticleId) {
      await admin.graphql(ARTICLE_UPDATE_MUTATION, {
        variables: {
          id: post.shopifyArticleId,
          article: { isPublished: false }
        }
      });
    }

    return { success: true };
  }

  // ── Auto-publish rule ─────────────────────────────────────────────────────
  if (intent === "saveRule" && prisma.publishRule) {
    const rulePostType = formData.get("postType");
    const enabled      = formData.get("enabled") === "true";

    await prisma.publishRule.upsert({
      where: { shop_postType: { shop: session.shop, postType: rulePostType } },
      update: { enabled },
      create: {
        shop: session.shop,
        postType: rulePostType,
        enabled,
        dayOfWeek: rulePostType === "promo" ? 6 : 2,
        timeOfDay: rulePostType === "promo" ? "18:00" : "10:00",
      },
    }).catch(() => null);
  }

  // ── CSV Import ────────────────────────────────────────────────────────────
  if (intent === "importCSV") {
    const rowsStr = formData.get("rows");
    if (!rowsStr) return { success: false, error: "No rows provided" };
    
    try {
      const rows = JSON.parse(rowsStr);
      const created = await prisma.post.createMany({
        data: rows.map(row => ({
          shop: session.shop,
          title: row.title,
          content: row.content,
          scheduledAt: new Date(row.scheduledAt),
          postType: row.postType,
          keyword: "",
          score: 0,
          published: false,
        }))
      });
      return { success: true, count: created.count };
    } catch (e) {
      return { success: false, error: "Failed to process CSV data" };
    }
  }

  return { success: true };
};

export default SchedulerPage;

export const headers = (h) => boundary.headers(h);
