import { useEffect, useState } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { useNavigate } from "react-router";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

// Assuming this component is located at /app/seo
export default function BlogsPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    const loadPosts = async () => {
      try {
        const res = await fetch("/api/shopify/blogs");
        const data = await res.json();

        // Flatten Shopify blogs -> articles into a single list.
        const flattened =
          (Array.isArray(data) ? data : [])
            .flatMap((edge) => {
              const blog = edge?.node;
              const blogTitle = blog?.title || "Blog";
              const articles = blog?.articles?.edges || [];
              return articles.map((a) => ({
                id: a?.node?.id,
                title: a?.node?.title || "Untitled",
                tags: Array.isArray(a?.node?.tags) ? a.node.tags : [],
                publishedAt: a?.node?.publishedAt || null,
                blogTitle,
              }));
            })
            .filter((x) => !!x.id) || [];

        // Newest first (publishedAt desc; drafts/unknown last)
        flattened.sort((a, b) => {
          const ta = a.publishedAt ? Date.parse(a.publishedAt) : -1;
          const tb = b.publishedAt ? Date.parse(b.publishedAt) : -1;
          return tb - ta;
        });

        setPosts(flattened);
      } catch (err) {
        console.error("Cannot load posts:", err);
      } finally {
        setLoading(false);
      }
    };

    loadPosts();
  }, []);

  /* ------------------------------------------ */
  /* STYLES                       */
  /* ------------------------------------------ */

  const styles = {
    mainWrapper: {
      minHeight: "100vh",
      width: "100%",
      padding: "0px 0px",
      background:
        "linear-gradient(135deg, #f5f7fa 0%, #ffffff 50%, #f0f9ff 100%)", // Gradient background from Index
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "San Francisco", "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
      overflowX: "hidden",
      margin: "0",
      boxSizing: "border-box",
    },

    contentContainer: {
      maxWidth: "1080px",
      margin: "0 auto",
      padding: "0 16px",
      position: "relative",
      zIndex: 10,
    },

    // --- TYPOGRAPHY & HEADER ---
    title: {
      fontSize: "clamp(28px, 4vw, 36px)",
      fontWeight: "800",
      textAlign: "center",
      marginBottom: "28px",
      // Gradient text from Index page
      background: "linear-gradient(135deg, #0f172a 0%, #17a5b4 100%)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      lineHeight: "1.2",
      paddingBottom: "0.12em",
    },

    // --- WORDPRESS-LIKE LIST ---
    list: {
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      width: "100%",
      margin: "0 auto",
      padding: "0",
    },

    row: {
      background: "white",
      padding: "16px 18px",
      borderRadius: "12px",
      border: "1px solid #e2e8f0",
      boxShadow: "0 6px 15px rgba(0,0,0,0.08)", // Softer shadow
      transition: "all 0.3s ease",
      cursor: "pointer",
      outline: "none",
      transform: "translateY(0)",
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: "16px",
      width: "100%",
    },

    rowHover: {
      transform: "translateY(-5px)", // More noticeable lift
      boxShadow: "0 15px 30px rgba(0,0,0,0.15)",
    },

    rowMain: {
      minWidth: 0,
      flex: "1 1 auto",
    },

    rowMeta: {
      flex: "0 0 auto",
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
      gap: "10px",
      minWidth: "160px",
    },

    titleText: {
      fontSize: "22px",
      fontWeight: 700,
      marginBottom: "8px",
      color: "#0f172a",
      lineHeight: 1.3,
      // Ensure text is not truncated by Admin styles
      whiteSpace: "normal",
      overflow: "visible",
      textOverflow: "unset",
    },

    keyword: {
      fontSize: "14px",
      fontWeight: 600,
      color: "#17a5b4", // Brand accent
      marginBottom: "8px",
    },
    score: {
      display: "inline-block",
      padding: "6px 14px",
      background: "#e0f2fe", // Light blue from Index page
      color: "#0369a1",
      borderRadius: "20px", // Pill shape
      fontSize: "13px",
      fontWeight: 700,
      textTransform: "uppercase",
    },
    excerpt: {
      marginTop: "6px",
      fontSize: "15px", // Slightly larger font
      lineHeight: "1.6",
      color: "#475569",
      whiteSpace: "normal",
    },
    loading: {
      textAlign: "center",
      marginTop: "80px",
      fontSize: "22px",
      color: "#64748b",
    },
    // --- NAVIGATION BAR (To match the theme) ---
    navWrapper: {
      display: "flex",
      justifyContent: "center",
      padding: "12px 0",
      backgroundColor: "#ffffff",
      borderBottom: "1px solid #e1e3e5",
      marginBottom: "40px",
      boxShadow: "0 1px 0 rgba(0, 0, 0, 0.05)",
      width: "100%",
      top: 0,
      zIndex: 100,
    },
    navLinks: {
      display: "flex",
      gap: "40px",
      fontSize: "16px",
      fontWeight: "500",
      color: "#212b36",
    },
    navLinkItem: {
      padding: "8px 12px",
      borderRadius: "6px",
      cursor: "pointer",
      transition: "background-color 0.2s, color 0.2s",
      userSelect: "none",
    },
    navLinkActive: {
      backgroundColor: "#e4e5e7",
      fontWeight: "600",
      color: "#17a5b4",
    },
  };

  /* ------------------------------------------ */
  /* Extract readable excerpt text      */
  /* ------------------------------------------ */

  const getExcerpt = (text) => {
    const plain = String(text || "")
      // remove HTML tags like <p>, <h1>, etc.
      .replace(/<[^>]*>/g, " ")
      // remove common markdown symbols
      .replace(/[#_*`>-]/g, " ")
      // normalize whitespace
      .replace(/\s+/g, " ")
      .trim();

    return plain.length > 180 ? `${plain.slice(0, 180)}...` : plain;
  };

  // Function to determine if a link is active (for the Blog page, it is /app/seo)
  const isActive = (path) => {
    // For this page, we assume the path is /app/seo
    // In a real app, you would import useLocation and check the current path
    return path === "/app/blogs";
  };

  /* ------------------------------------------ */
  /* RENDER                      */
  /* ------------------------------------------ */

  return (
    // Use the full-width wrapper style
    <div style={styles.mainWrapper}>
      {/* NAVBAR - Re-included to match the previous page's UI */}
      <nav style={styles.navWrapper}>
        <div style={styles.navLinks}>
          <button
            type="button"
            style={styles.navLinkItem}
            onClick={() => navigate("/app")}
          >
            Home
          </button>

          <button
            type="button"
            style={{
              ...styles.navLinkItem,
              ...(isActive("/app/blogs") ? styles.navLinkActive : {}), // Blog is active
            }}
            onClick={() => navigate("/app/blogs")}
          >
            Blog
          </button>

          {/* <span style={styles.navLinkItem} onClick={() => navigate("/app/seo")}>
            SEO
          </span> */}
        </div>
      </nav>

      <div style={styles.contentContainer}>
        <h1 style={styles.title}>Your Blog Posts</h1>

        {loading ? (
          <div style={styles.loading}>Loading blogs...</div>
        ) : posts.length === 0 ? (
          <div style={styles.loading}>No blog posts found. Start creating!</div>
        ) : (
          <div style={styles.list}>
            {posts.map((post) => (
              <div
                key={post.id}
                style={styles.row}
                role="button"
                tabIndex={0}
                aria-label={`Open blog post: ${post.title}`}
                onClick={() => {
                  navigate(`/app/editor?id=${encodeURIComponent(post.id)}`);
                }}
                onKeyDown={(e) =>
                  (e.key === "Enter" || e.key === " ") &&
                  navigate(`/app/editor?id=${encodeURIComponent(post.id)}`)
                }
                onMouseOver={(e) =>
                  Object.assign(e.currentTarget.style, styles.rowHover)
                }
                onMouseOut={(e) =>
                  Object.assign(e.currentTarget.style, styles.row)
                }
                onFocus={(e) =>
                  Object.assign(e.currentTarget.style, styles.rowHover)
                }
                onBlur={(e) =>
                  Object.assign(e.currentTarget.style, styles.row)
                }
              >
                <div style={styles.rowMain}>
                  <h3 style={styles.titleText}>{post.title}</h3>
                  <div style={styles.keyword}>
                    {post.blogTitle}
                    {post.publishedAt
                      ? ` · Published ${new Date(post.publishedAt).toLocaleDateString()}`
                      : " · Draft/Hidden"}
                  </div>
                  <p style={styles.excerpt}>
                    Tags: {post.tags?.length ? post.tags.join(", ") : "—"}
                  </p>
                </div>

                <div style={styles.rowMeta}>
                  <span style={styles.score}>Shopify</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
