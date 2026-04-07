import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  PenTool,
  FileText,
  Sparkles,
  Save,
  Trash2,
  Loader2,
  X,
  Key,
  Eye,
} from "lucide-react";
import PropTypes from "prop-types";

const SidebarItem = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
      active
        ? "bg-[#17a5b4] text-white shadow-lg shadow-[#17a5b4]/25"
        : "text-slate-600 hover:bg-slate-100"
    }`}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </button>
);

// ✅ Fix ESLint warning
SidebarItem.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  active: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired,
};

const ScoreGauge = ({ score }) => {
  const getColor = (s) => {
    if (s >= 80) return "text-emerald-500 border-emerald-500";
    if (s >= 50) return "text-amber-500 border-amber-500";
    return "text-rose-500 border-rose-500";
  };

  return (
    <div
      className={`relative w-32 h-32 rounded-full border-8 flex items-center justify-center ${getColor(score)}`}
    >
      <div className="text-center">
        <span className="text-3xl font-bold text-slate-800">{score}</span>
        <span className="block text-xs text-slate-500 font-medium uppercase">
          SEO Score
        </span>
      </div>
    </div>
  );
};

ScoreGauge.propTypes = {
  score: PropTypes.number.isRequired,
};

const generateBlogContent = async (content, keyword, userApiKey) => {
  const response = await fetch("/api/generate-blog-content", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content, keyword, userApiKey }),
  });

  let data;
  try {
    data = await response.json();
  } catch (err) {
    throw new Error("Couldn't fetch response.");
  }

  if (!response.ok) {
    throw new Error(data.error || "Failed to generate content");
  }
  return data.content;
};

export default function GoBlogApp() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);

  const [userApiKey, setUserApiKey] = useState("");
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  const [currentPost, setCurrentPost] = useState({
    id: null,
    title: "",
    content: "",
    keyword: [],
    visibility: "",
    seoTitle: "",
    seoDescription: "",
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState(null);
  const [posts, setPosts] = useState([]);
  const [viewsById, setViewsById] = useState({});

  const [topic, setTopic] = useState("");
  const [length, setLength] = useState("Short");
  const [tone, setTone] = useState("Professional");
  const [outline, setOutline] = useState("");

  // SEO Keywords State (Array of strings)
  const [keywords, setKeywords] = useState([]);
  const [keywordInput, setKeywordInput] = useState("");

  // Image State
  /* --- Keyword Logic --- */
  const handleKeywordKeyDown = (e) => {
    if (e.key === "Enter" && keywordInput.trim() !== "") {
      e.preventDefault();
      // Prevent duplicates
      if (!keywords.includes(keywordInput.trim())) {
        setKeywords([...keywords, keywordInput.trim()]);
      }
      setKeywordInput("");
    }
  };

  const removeKeyword = (indexToRemove) => {
    setKeywords(keywords.filter((_, index) => index !== indexToRemove));
  };

  const generateWithAI = async (payload) => {
    try {
      setIsGenerating(true);

      const res = await fetch("/api/generate-blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          apiKey: userApiKey,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Generation failed");

      // Move generated blog to editor
      setCurrentPost({
        id: null,
        title: payload.topic,
        content: data.content,
        keyword: payload.keywords,
        visibility: "Visible",
        seoTitle: payload.topic,
        seoDescription: "",
      });

      setActiveTab("editor");
      showNotification("AI blog generated!", "success");
    } catch (err) {
      showNotification(err.message, "error");
    } finally {
      setIsGenerating(false);
    }
  };

  // const uploadToShopify = async (base64) => {
  //   const res = await fetch("/api/shopify/upload-file", {
  //     method: "POST",
  //     headers: { "Content-Type": "application/json" },
  //     body: JSON.stringify({
  //       imageBase64: base64,
  //       fileName: "blog-image.png",
  //     }),
  //   });

  //   const data = await res.json();
  //   if (!res.ok) throw new Error(data.error || "Upload failed");

  //   return data.url;
  // };

  useEffect(() => {
    const loadPosts = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/shopify/blogs");
        const data = await res.json();

        const allArticles = data.flatMap((blogEdge) => {
          const articles = blogEdge.node.articles?.edges || [];

          return articles.map((articleEdge) => ({
            ...articleEdge.node,
            blogTitle: blogEdge.node.title, // e.g., "News"
            blogId: blogEdge.node.id,
          }));
        });

        setPosts(allArticles);
        try {
          const ids = (allArticles || []).map((a) => a.id).filter(Boolean);
          if (ids.length) {
            const resViews = await fetch(
              `/api/views/list?ids=${encodeURIComponent(ids.join(","))}`,
            );
            const dataViews = await resViews.json();
            if (resViews.ok && dataViews && typeof dataViews === "object") {
              setViewsById(dataViews);
            } else {
              setViewsById({});
            }
          } else {
            setViewsById({});
          }
        } catch {
          setViewsById({});
        }
      } catch (err) {
        console.error("Mapping Error:", err);
        setNotification("Cannot load posts");
      } finally {
        setLoading(false);
      }
    };

    loadPosts();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedKey =
      localStorage.getItem("bloglift_openrouter_key") ||
      localStorage.getItem("user_gemini_key");
    if (savedKey) setUserApiKey(savedKey);
  }, []);

  const handleGenerate = async (content, keyword, userApiKey) => {
    try {
      setIsGenerating(true);
      const result = await generateBlogContent(content, keyword, userApiKey);
      setCurrentPost({
        ...currentPost,
        content: result,
      });

      setActiveTab("editor");
      showNotification("Content generated successfully!", "success");
    } catch (err) {
      console.error("Generation error:", err);

      let message = "Failed to generate content.";

      if (err.message.includes("Invalid API key")) {
        message = "Your API key is invalid. Please update it.";
      } else if (err.message.includes("Failed to fetch")) {
        message = "Network error: cannot reach server.";
      } else if (err.message.includes("JSON")) {
        message = "Server returned unexpected response.";
      } else if (err.message) {
        message = err.message;
      }
      showNotification(message, "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const stripHtml = (html) => {
    if (!html) return "";
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.body.textContent || "";
  };

  const handleEdit = async (post) => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/shopify/article?id=${encodeURIComponent(post.id)}`,
      );
      const article = await res.json();

      setCurrentPost({
        id: post.id,
        title: article.title,
        content: stripHtml(article.body),
        keyword: article.tags || [],
        visibility: article.visibility,
        seoTitle: article.seoTitle || "",
        seoDescription: article.seoDescription || "",
      });

      setActiveTab("editor");
    } catch (err) {
      showNotification("Failed to load article", "error");
    } finally {
      setLoading(false);
    }
  };

  // const handleSave = async () => {
  //   if (!currentPost.id) {
  //     showNotification(
  //       "This post doesn't have a Shopify ID. Use Save Draft instead.",
  //       "error",
  //     );
  //     return;
  //   }

  //   try {
  //     setIsSaving(true);

  //     const res = await fetch("/api/shopify/article-update", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({
  //         id: currentPost.id,
  //         title: currentPost.title,
  //         bodyHtml: currentPost.content,
  //         tags: currentPost.keyword,
  //         isPublished: currentPost.visibility === "Visible",
  //         seoTitle: currentPost.seoTitle,
  //         seoDescription: currentPost.seoDescription,
  //       }),
  //     });

  //     const result = await res.json();

  //     if (!res.ok || result.error || result.errors) {
  //       showNotification(result.error || "Failed to update article", "error");
  //       return;
  //     }

  //     showNotification("Successfully updated in Shopify!", "success");
  //     setActiveTab("posts");

  //     const res1 = await fetch("/api/shopify/blogs");
  //     const data = await res1.json();

  //     const allArticles = data.flatMap((blogEdge) => {
  //       const articles = blogEdge.node.articles?.edges || [];

  //       return articles.map((articleEdge) => ({
  //         ...articleEdge.node,
  //         blogTitle: blogEdge.node.title, // e.g., "News"
  //         blogId: blogEdge.node.id,
  //       }));
  //     });

  //     setPosts(allArticles || []);
  //     setCurrentPost({
  //       id: null,
  //       title: "",
  //       content: "",
  //       keyword: [],
  //       visibility: "",
  //       seoTitle: "",
  //       seoDescription: "",
  //     });
  //   } catch (error) {
  //     showNotification("Network error while updating", "error");
  //   } finally {
  //     setIsSaving(false);
  //   }
  // };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      // let imageUrl = image;

      // Upload only if base64
      // if (imageUrl?.startsWith("data:")) {
      //   imageUrl = await uploadToShopify(imageUrl);
      // }

      const endpoint = currentPost.id
        ? "/api/shopify/article-update"
        : "/api/shopify/article-create";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: currentPost.id,
          blogId: posts[0]?.blogId,
          title: currentPost.title,
          bodyHtml: currentPost.content,
          tags: currentPost.keyword,
          isPublished: currentPost.visibility === "Visible",

          // image: imageUrl
          //   ? { url: imageUrl, altText: currentPost.title }
          //   : null,
        }),
      });

      const result = await res.json();

      if (!res.ok || result.error) {
        throw new Error(result.error || "Save failed");
      }

      showNotification(
        currentPost.id
          ? "Blog updated in Shopify!"
          : "Blog created in Shopify!",
        "success",
      );

      setActiveTab("posts");
    } catch (err) {
      showNotification(err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (postId) => {
    const confirmed = window.confirm(
      "Are you sure you want to permanently delete this blog post?",
    );

    if (!confirmed) return;

    try {
      setLoading(true);

      const res = await fetch("/api/shopify/article-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: postId }),
      });

      const result = await res.json();

      if (!res.ok || result.error) {
        showNotification(result.error || "Delete failed", "error");
        return;
      }

      showNotification("Blog post deleted successfully", "success");

      // Remove deleted post from UI instantly
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err) {
      showNotification("Network error while deleting", "error");
    } finally {
      setLoading(false);
    }
  };

  const resetApiKey = () => {
    localStorage.removeItem("bloglift_openrouter_key");
    localStorage.removeItem("user_gemini_key");
    setUserApiKey("");
    setShowApiKeyModal(true);
    showNotification("API key removed. Please enter a new key.", "success");
  };

  const showNotification = (msg, type) => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const RenderDashboard = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Posts</p>
              <h3 className="text-3xl font-bold text-slate-800 mt-2">
                {posts.length}
              </h3>
            </div>
            <div className="rounded-lg bg-[#17a5b4]/10 p-3 text-[#17a5b4]">
              <FileText size={24} />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800">Recent Activity</h2>
          <button
            onClick={() => setActiveTab("posts")}
            className="text-lg text-[#17a5b4] font-medium hover:text-[#149db0]"
          >
            View All
          </button>
        </div>
        <div className="p-6">
          {posts.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              No posts yet. Start writing!
            </div>
          ) : (
            <div className="space-y-4">
              {posts.slice(0, 3).map((post) => (
                <div
                  key={post.id}
                  className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-lg transition-colors border border-slate-100"
                >
                  <div className="flex items-center gap-4">
                    {/* --- REPLACED SCORE WITH IMAGE --- */}
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                      {post.image?.url ? (
                        <img
                          src={post.image.url}
                          alt={post.image.altText || post.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          {/* Fallback icon if no image exists */}
                          <svg
                            className="w-6 h-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                    {/* ---------------------------------- */}

                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="font-semibold text-slate-800 line-clamp-1">
                          {post.title}
                        </h4>
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                          <Eye size={13} className="text-slate-400" />
                          {Number(viewsById?.[post.id]) || 0}
                        </span>
                      </div>

                      {post.tags.length > 0 && (
                        <div
                          style={{
                            marginTop: "10px",
                            display: "flex",
                            gap: "5px",
                            flexWrap: "wrap", // Added to prevent overflow on small screens
                          }}
                        >
                          {post.tags.map((tag) => (
                            <span
                              key={tag}
                              style={{
                                background: "#f1f1f1",
                                padding: "2px 8px",
                                borderRadius: "10px",
                                fontSize: "12px",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleEdit(post)}
                    className="p-2 text-slate-400 hover:text-[#17a5b4]"
                  >
                    <PenTool size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderEditor = () => (
    <div className="flex gap-6 max-w-6xl mx-auto p-4">
      <div className="flex-1 space-y-6">
        {/* Blog Post Content Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-slate-700">Blog Post Content</h3>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 cursor-pointer bg-[#17a5b4] text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-[#149db0] disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Save Draft
            </button>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label
                htmlFor="title"
                className="text-xs font-semibold text-slate-500 uppercase"
              >
                Title
              </label>
              <input
                id="title"
                value={currentPost.title}
                onChange={(e) =>
                  setCurrentPost({ ...currentPost, title: e.target.value })
                }
                className="w-full text-xl font-bold border-b border-slate-200 outline-none py-2"
              />
            </div>
            <div className="relative space-y-2">
              {/* Header row */}
              <div className="flex items-center justify-between">
                <label
                  htmlFor="content"
                  className="text-xs font-semibold text-slate-500 uppercase"
                >
                  Content
                </label>

                <div className="flex items-center gap-4">
                  {/* API key indicator */}
                  {userApiKey && (
                    <button
                      type="button"
                      onClick={resetApiKey}
                      className="text-xs text-slate-400 hover:text-[#17a5b4] flex items-center gap-1"
                    >
                      <Key size={12} />
                      Change API key
                    </button>
                  )}

                  {/* AI button */}
                  <button
                    type="button"
                    disabled={isGenerating}
                    onClick={async () => {
                      if (!userApiKey) {
                        setShowApiKeyModal(true);
                        return;
                      }
                      handleGenerate(
                        currentPost?.content,
                        currentPost?.keyword[0],
                        userApiKey,
                      );
                    }}
                    className="flex items-center gap-1 text-xs font-semibold text-[#17a5b4] hover:underline disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Improving…
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        Improve with AI
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Optional helper text */}
              {userApiKey && (
                <p className="text-[10px] text-slate-400">
                  Using your saved OpenRouter API key
                </p>
              )}

              {/* Textarea */}
              <textarea
                id="content"
                value={currentPost.content}
                onChange={(e) =>
                  setCurrentPost({ ...currentPost, content: e.target.value })
                }
                className="w-full min-h-[300px] resize-none outline-none text-slate-600 leading-relaxed mt-2"
                disabled={isGenerating}
              />

              {/* Loading overlay */}
              {isGenerating && (
                <div className="absolute inset-0 bg-white/60 flex items-center justify-center rounded-lg">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                    <Loader2 className="animate-spin" size={18} />
                    Optimizing content with AI…
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Visibility Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <label
            htmlFor="visibility"
            className="text-xs font-semibold text-slate-500 uppercase"
          >
            Blog Post Visibility
          </label>
          <select
            id="visibility"
            value={currentPost.visibility}
            onChange={(e) =>
              setCurrentPost({ ...currentPost, visibility: e.target.value })
            }
            className="w-full mt-2 p-2 border rounded-lg bg-slate-50 outline-none"
          >
            <option value="Visible">Visible</option>
          </select>
        </div>

        {/* Blog Post Tags Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
            <h3 className="font-bold text-slate-700">Blog Post Tags</h3>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="tags"
              className="text-xs font-semibold text-slate-500 uppercase"
            >
              Tags
            </label>
            <div className="flex flex-wrap gap-2 p-2 border rounded-lg bg-slate-50 min-h-[45px]">
              {currentPost.keyword.map((tag, index) => (
                <span
                  key={index}
                  className="flex items-center gap-1 bg-white border border-slate-200 px-2 py-1 rounded-md text-sm text-slate-600"
                >
                  {tag}
                  <button
                    onClick={() => {
                      const newTags = currentPost.keyword.filter(
                        (_, i) => i !== index,
                      );
                      setCurrentPost({ ...currentPost, keyword: newTags });
                    }}
                    className="hover:text-rose-500"
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
              <input
                placeholder="Enter a tag..."
                className="flex-1 bg-transparent outline-none text-sm min-w-[120px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.target.value.trim()) {
                    e.preventDefault();
                    const newTag = e.target.value.trim();
                    if (!currentPost.keyword.includes(newTag)) {
                      setCurrentPost({
                        ...currentPost,
                        keyword: [...currentPost.keyword, newTag],
                      });
                    }
                    e.target.value = "";
                  }
                }}
              />
            </div>
            <p className="text-[10px] text-slate-400">
              Press Enter to add a tag
            </p>
          </div>
        </div>

        {/* SEO Meta Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <h3 className="font-bold text-slate-700 border-b pb-2">
            Blog Post SEO Meta
          </h3>

          <div>
            <label
              htmlFor="seotitle"
              className="text-xs font-semibold text-slate-500 uppercase"
            >
              SEO Title
            </label>
            <input
              id="seotitle"
              value={currentPost.seoTitle}
              onChange={(e) =>
                setCurrentPost({ ...currentPost, seoTitle: e.target.value })
              }
              className="w-full p-2 border rounded-lg mt-1 outline-none focus:ring-1 ring-[#17a5b4]"
            />
            <span className="text-[10px] text-slate-400">
              {currentPost.seoTitle.length} characters
            </span>
          </div>

          <div>
            <label
              htmlFor="seodes"
              className="text-xs font-semibold text-slate-500 uppercase"
            >
              SEO Description
            </label>
            <textarea
              id="seodes"
              value={currentPost.seoDescription}
              onChange={(e) =>
                setCurrentPost({
                  ...currentPost,
                  seoDescription: e.target.value,
                })
              }
              placeholder="Meta Description"
              className="w-full p-2 border rounded-lg mt-1 outline-none focus:ring-1 ring-[#17a5b4] h-20"
            />
            <span className="text-[10px] text-slate-400">
              {currentPost.seoDescription.length} characters
            </span>
          </div>

          {/* Google Preview */}
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">
              Google Search Preview
            </p>
            <h4 className="text-blue-700 text-lg hover:underline cursor-pointer truncate">
              {currentPost.seoTitle || currentPost.title}
            </h4>
            <p className="text-sm text-slate-600 line-clamp-2 mt-1">
              {currentPost.seoDescription ||
                "Please enter a meta description for your blog post..."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPosts = () => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center">
        <h2 className="text-lg font-bold text-slate-800">My Blog Posts</h2>
      </div>
      <div className="divide-y divide-slate-100">
        {posts.map((post) => (
          <div
            key={post.id}
            className="p-6 flex items-start justify-between hover:bg-slate-50 transition-colors group"
          >
            {/* LEFT SIDE */}
            <div className="flex-1">
              <h3 className="font-semibold text-slate-800 mb-2">
                {post.title}
              </h3>

              {/* Tags + Date */}
              <div className="flex items-center gap-4 flex-wrap text-sm text-slate-500">
                {/* Tags */}
                {post.tags?.map((tag) => (
                  <span
                    key={tag}
                    className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs"
                  >
                    {tag}
                  </span>
                ))}

                {/* Date */}
                <span className="text-slate-400 whitespace-nowrap">
                  {post.publishedAt
                    ? new Date(post.publishedAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : "Just now"}
                </span>
              </div>
            </div>

            {/* RIGHT SIDE – ACTIONS */}
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={() => handleEdit(post)}
                className="rounded-full p-2 text-slate-400 hover:bg-[#17a5b4]/10 hover:text-[#17a5b4]"
              >
                <PenTool size={18} />
              </button>

              <button
                onClick={() => handleDelete(post.id)}
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
        {posts.length === 0 && (
          <div className="p-12 text-center text-slate-400">
            <FileText size={48} className="mx-auto mb-4 opacity-20" />
            <p>No posts found. Generate one with AI!</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderGenerate = () => {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto p-4">
        {/* LEFT PANEL: INPUTS */}
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              {/* <Sparkles className="text-teal-600" size={20} /> */}
              Blog Configuration
            </h2>

            {/* Topic */}
            <div className="space-y-1">
              <label htmlFor="blog-topic" className="text-sm font-semibold text-slate-700">
                Blog Topic
              </label>
              <input
                id="blog-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. 10 Best Summer Fashion Trends"
                className="w-full p-3 border border-slate-300 rounded-xl outline-none transition focus:border-[#17a5b4] focus:ring-2 focus:ring-[#17a5b4]/35"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Length */}
              <div className="space-y-1">
                <label htmlFor="blog-length" className="text-sm font-semibold text-slate-700">
                  Length
                </label>
                <select
                  id="blog-length"
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl outline-none"
                >
                  <option>Short</option>
                  <option>Medium</option>
                  <option>Long</option>
                </select>
              </div>

              {/* Tone */}
              <div className="space-y-1">
                <label htmlFor="blog-tone" className="text-sm font-semibold text-slate-700">
                  Tone
                </label>
                <select
                  id="blog-tone"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl outline-none"
                >
                  <option>Professional</option>
                  <option>Friendly</option>
                  <option>Persuasive</option>
                  <option>Educational</option>
                </select>
              </div>
            </div>

            {/* SEO Keywords (Tag Input) */}
            <div className="space-y-2">
              <label htmlFor="seo-keywords" className="text-sm font-semibold text-slate-700">
                SEO Keywords
              </label>
              <div className="min-h-[48px] p-2 border border-slate-300 rounded-xl flex flex-wrap gap-2 items-center bg-slate-50 transition focus-within:bg-white focus-within:ring-2 focus-within:ring-[#17a5b4]/35">
                {keywords.map((kw, index) => (
                  <span
                    key={index}
                    className="flex items-center gap-1 border border-[#17a5b4]/30 bg-[#17a5b4]/12 px-3 py-1 rounded-full text-sm font-medium text-[#115960]"
                  >
                    {kw}
                    <button
                      type="button"
                      onClick={() => removeKeyword(index)}
                      className="hover:text-[#17a5b4]"
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
                <input
                  id="seo-keywords"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={handleKeywordKeyDown}
                  placeholder={
                    keywords.length === 0 ? "Type and press Enter..." : ""
                  }
                  className="flex-1 bg-transparent outline-none text-sm p-1 min-w-[120px]"
                />
              </div>
              <p className="text-[11px] text-slate-400 italic">
                Press Enter after each keyword
              </p>
            </div>

            {/* Featured Image Upload & Delete */}
            {/* <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">
                Featured Image
              </label>
              {!image ? (
                <label className="mt-2 flex flex-col items-center justify-center w-full h-32 cursor-pointer rounded-xl border-2 border-dashed border-slate-300 transition hover:border-[#17a5b4] hover:bg-slate-50">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="text-slate-400 mb-2" size={24} />
                    <p className="text-xs text-slate-500">
                      Click to upload or drag and drop
                    </p>
                  </div>
                  <input
                    id="image-upload"
                    type="file"
                    className="hidden"
                    onChange={handleImageChange}
                    accept="image/*"
                  />
                </label>
              ) : (
                <div className="relative mt-2 group">
                  <img
                    src={image}
                    alt="Preview"
                    className="w-full h-40 object-cover rounded-xl border border-slate-200"
                  />
                  <button
                    onClick={removeImage}
                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div> */}

            {/* Outline */}
            <div className="space-y-1">
              <label htmlFor="blog-outline" className="text-sm font-semibold text-slate-700">
                Blog Outline (optional)
              </label>
              <textarea
                id="blog-outline"
                value={outline}
                onChange={(e) => setOutline(e.target.value)}
                placeholder="Briefly describe the structure..."
                className="w-full mt-1 h-28 rounded-xl border border-slate-300 p-3 outline-none transition focus:ring-2 focus:ring-[#17a5b4]/35"
              />
            </div>
          </div>

          {/* Create button */}
          <button
            disabled={isGenerating}
            className="w-full rounded-xl bg-[#17a5b4] py-4 text-lg font-bold text-white shadow-lg shadow-[#17a5b4]/25 transition-all hover:bg-[#149db0] active:scale-[0.98]"
            onClick={() => {
              if (!userApiKey) {
                setShowApiKeyModal(true);
                return;
              }

              generateWithAI({
                topic,
                keywords,
                tone,
                length,
                outline,
              });
            }}
          >
            {isGenerating ? "Generating with AI..." : "Generate AI Blog Post"}
          </button>
        </div>

        {/* RIGHT PANEL (PREVIEW) */}
        <div className="bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center p-12 sticky top-4 h-[fit-content] min-h-[500px]">
          <div className="bg-white p-6 rounded-full shadow-sm mb-6">
            <Sparkles size={48} className="animate-pulse text-[#17a5b4]" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">
            Ready to Spark?
          </h3>
          <p className="text-slate-500 max-w-xs leading-relaxed">
            Fill in the details on the left and click generate. Our AI will
            craft a high-ranking SEO blog post for you in seconds.
          </p>
        </div>
      </div>
    );
  };

  const ApiKeyModal = () => {
    const [tempKey, setTempKey] = useState(userApiKey || "");
    const [orInfo, setOrInfo] = useState(null);

    useEffect(() => {
      if (!showApiKeyModal) return;
      fetch("/api/openrouter")
        .then((r) => r.json())
        .then(setOrInfo)
        .catch(() => setOrInfo(null));
    }, [showApiKeyModal]);

    if (!showApiKeyModal) return null;

    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white p-8 rounded-xl shadow-xl w-[400px] space-y-6">
          <h2 className="text-xl font-bold text-slate-800">
            OpenRouter API key
          </h2>
          <p className="text-sm text-slate-600">
            {orInfo?.message ||
              "Create a key at OpenRouter and paste it here. It stays in your browser only."}
          </p>
          {orInfo?.keysUrl ? (
            <a
              href={orInfo.keysUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-[#17a5b4] hover:underline"
            >
              {orInfo.keysUrl}
            </a>
          ) : null}

          <input
            type="password"
            value={tempKey}
            onChange={(e) => setTempKey(e.target.value)}
            placeholder="sk-or-…"
            className="w-full p-3 border border-slate-300 rounded-lg outline-none"
          />

          <div className="flex justify-end gap-4">
            <button
              className="px-4 py-2 text-slate-600"
              onClick={() => setShowApiKeyModal(false)}
            >
              Cancel
            </button>

            <button
              className="rounded-lg bg-[#17a5b4] px-4 py-2 text-white hover:bg-[#149db0]"
              onClick={() => {
                localStorage.setItem("bloglift_openrouter_key", tempKey);
                localStorage.removeItem("user_gemini_key");
                setUserApiKey(tempKey);
                setShowApiKeyModal(false);
                showNotification("OpenRouter key saved!", "success");
              }}
            >
              Save Key
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading)
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50 text-slate-400">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-xl z-50 text-white font-medium animate-in slide-in-from-top-2
        ${notification.type === "success" ? "bg-emerald-600" : "bg-rose-600"}`}
        >
          {notification.msg}
        </div>
      )}

      {/* TOP NAVBAR (instead of sidebar) */}
      <nav className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-5 sticky top-0 z-20">
        {/* Logo */}
        <div className="flex items-center gap-2 text-[#17a5b4]">
          {/* <span className="text-xl font-bold text-slate-800">
            SEO Optimizer
          </span> */}
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-4 text-sm sm:gap-5 sm:text-base">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`flex items-center gap-1.5 font-medium transition-colors sm:gap-2 ${
              activeTab === "dashboard"
                ? "text-[#17a5b4]"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <LayoutDashboard size={16} />
            Dashboard
          </button>

          <button
            onClick={() => setActiveTab("editor")}
            className={`flex items-center gap-1.5 font-medium transition-colors sm:gap-2 ${
              activeTab === "editor"
                ? "text-[#17a5b4]"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <PenTool size={16} />
            Editor
          </button>

          <button
            onClick={() => setActiveTab("posts")}
            className={`flex items-center gap-1.5 font-medium transition-colors sm:gap-2 ${
              activeTab === "posts"
                ? "text-[#17a5b4]"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FileText size={16} />
            My Posts
          </button>

          <button
            onClick={() => setActiveTab("generate")}
            className={`flex items-center gap-1.5 font-medium transition-colors sm:gap-2 ${
              activeTab === "generate"
                ? "text-[#17a5b4]"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Sparkles size={16} />
            Generate
          </button>
        </div>

        {/* Avatar */}
        <div></div>
      </nav>

      {/* MAIN PAGE CONTENT */}
      <main className="flex-1 overflow-visible p-4 sm:p-5 md:p-6">
        {activeTab === "dashboard" && <RenderDashboard />}
        {activeTab === "editor" && renderEditor()}
        {activeTab === "posts" && renderPosts()}
        {activeTab === "generate" && renderGenerate()}
      </main>

      <ApiKeyModal />
    </div>
  );
}
