import { useLoaderData, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const { id } = params;

  try {
    const post = await prisma.post.findFirst({
      where: { id, shop: session.shop },
    });

    if (!post) {
      throw new Response("Blog post not found", { status: 404 });
    }

    return { post };
  } catch (e) {
    if (e instanceof Response) throw e;
    throw new Response("Blog post not found", { status: 404 });
  }
};

export default function BlogDetailPage() {
  const { post } = useLoaderData();
  const navigate = useNavigate();

  if (!post) return <div>No post data found in component.</div>;

  const sanitizeHtml = (html) => {
    if (!html) return "";

    // Lightweight sanitizer to prevent obvious XSS vectors for stored post HTML.
    // If you later need richer HTML support, swap this for a vetted sanitizer library.
    return String(html)
      .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "")
      .replace(/<\s*style[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi, "")
      .replace(/\son\w+="[^"]*"/gi, "")
      .replace(/\son\w+='[^']*'/gi, "")
      .replace(
        /\s(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi,
        ' $1="#"',
      );
  };

  const styles = {
    mainWrapper: {
      minHeight: "100vh",
      width: "100%",
      background: "var(--bg-secondary)",
      color: "var(--text-primary)",
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "San Francisco", "Segoe UI", Roboto, sans-serif',
      margin: "0",
      padding: "0",
      boxSizing: "border-box",
      transition: "background-color 0.3s ease, color 0.3s ease",
    },

    navWrapper: {
      display: "flex",
      justifyContent: "center",
      padding: "12px 0",
      backgroundColor: "#ffffff",
      borderBottom: "1px solid #e1e3e5",
      marginBottom: "40px",
      boxShadow: "0 1px 0 rgba(0, 0, 0, 0.05)",
    },

    navLinks: {
      display: "flex",
      gap: "40px",
    },

    navLinkItem: {
      fontSize: "16px",
      fontWeight: "500",
      color: "#212b36",
      cursor: "pointer",
      padding: "8px 12px",
    },

    contentContainer: {
      maxWidth: "800px",
      margin: "0 auto",
      padding: "0 20px 60px 20px",
    },

    backButton: {
      background: "none",
      border: "none",
      color: "#17a5b4",
      cursor: "pointer",
      fontSize: "16px",
      fontWeight: "600",
      marginBottom: "20px",
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },

    title: {
      fontSize: "clamp(26px, 4vw, 32px)",
      fontWeight: "800",
      marginBottom: "20px",
      color: "var(--text-primary)",
      lineHeight: "1.2",
    },

    badgeSeo: {
      padding: "6px 14px",
      background: "#e0f2fe",
      color: "#0369a1",
      borderRadius: "20px",
      fontWeight: "700",
      fontSize: "13px",
      textTransform: "uppercase",
    },

    badgeKeyword: {
      padding: "6px 14px",
      background: "rgba(23, 165, 180, 0.12)",
      color: "#115960",
      borderRadius: "20px",
      fontWeight: "700",
      fontSize: "13px",
      textTransform: "uppercase",
    },

    article: {
      fontSize: "16px",
      lineHeight: "1.75",
      color: "var(--text-secondary)",
      backgroundColor: "var(--bg-primary)",
      padding: "28px",
      borderRadius: "12px",
      border: "1px solid var(--border-primary)",
      boxShadow: "var(--card-shadow)",
    },

    articleContent: {
      wordBreak: "break-word",
    },

    badgeRow: {
      display: "flex",
      gap: "12px",
      marginBottom: "32px",
      alignItems: "center",
      flexWrap: "wrap",
    },

    dateBadge: {
      padding: "6px 14px",
      background: "var(--bg-tertiary)",
      color: "var(--text-secondary)",
      borderRadius: "20px",
      fontWeight: "600",
      fontSize: "13px",
      display: "flex",
      alignItems: "center",
      gap: "6px",
    },
  };

  return (
    <div style={styles.mainWrapper}>
      <div style={styles.contentContainer}>
        <button
          style={styles.backButton}
          onClick={() => navigate("/app/blogs")}
        >
          ← Back to all posts
        </button>

        <h1 style={styles.title}>{post.title}</h1>

        <div style={styles.badgeRow}>
          <span style={styles.dateBadge}>
            {new Date(post.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
          <span style={styles.badgeSeo}>SEO Score: {post.score}</span>
          <span style={styles.badgeKeyword}>Keyword: {post.keyword}</span>
        </div>

        <article style={styles.article}>
          <div
            style={styles.articleContent}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content) }}
          />
        </article>
      </div>
    </div>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
