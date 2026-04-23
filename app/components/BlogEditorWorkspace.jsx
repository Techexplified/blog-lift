import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles,
  Save,
  Send,
  Menu,
  Bold,
  Italic,
  Underline,
  Link,
  Image,
  List,
  Lightbulb,
  Loader2,
  X,
  KeyRound,
  FileText,
  Search,
  MessageSquare,
} from "lucide-react";

const LS_KEY = "bloglift_editor_draft";
const LS_OPENROUTER = "bloglift_openrouter_key";
/** @deprecated legacy localStorage key (read-only migration) */
const LS_GEMINI = "bloglift_gemini_key";

/** Primary brand accent (shared with design). */
const BRAND = "#17a5b4";
const BRAND_TIP_BG = "#ecf8fa";

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function aiTextToHtml(text) {
  const lines = text.split("\n");
  let html = "";
  const buf = [];
  const flushP = () => {
    if (buf.length) {
      html += `<p>${escapeHtml(buf.join(" "))}</p>`;
      buf.length = 0;
    }
  };
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)/);
    const h3 = line.match(/^###\s+(.+)/);
    if (h2) {
      flushP();
      html += `<h2 id="">${escapeHtml(h2[1])}</h2>`;
      continue;
    }
    if (h3) {
      flushP();
      html += `<h3 id="">${escapeHtml(h3[1])}</h3>`;
      continue;
    }
    if (line.trim() === "") {
      flushP();
      continue;
    }
    buf.push(line.trim());
  }
  flushP();
  return html || "<p></p>";
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function ensureHeadingIds(root) {
  if (!root) return;
  let n = 0;
  root.querySelectorAll("h2, h3").forEach((el) => {
    if (!el.id) el.id = `heading-${n++}`;
  });
}

function buildOutline(root) {
  if (!root) return [];
  ensureHeadingIds(root);
  return [...root.querySelectorAll("h2, h3")].map((el) => ({
    id: el.id,
    level: el.tagName,
    text: (el.textContent || "").slice(0, 80) || "…",
  }));
}

/**
 * Heuristic on-page SEO score (0–100) when AI insight is unavailable.
 * Rubric totals 100: keyword placement 50, depth 25, structure 15, title 10.
 * Uses word count (not raw characters) so it matches the editor tips.
 */
function computeSeo({ title, keyword, bodyText, hasH2 }) {
  const k = keyword.toLowerCase().trim();
  const t = title.toLowerCase();
  const b = bodyText.toLowerCase();
  const words = countWords(bodyText);
  const titleWordCount = title.trim().split(/\s+/).filter(Boolean).length;

  let score = 0;
  // Keyword coverage (50): strong title + body + early mention
  if (k && t.includes(k)) score += 25;
  if (k && b.includes(k)) score += 20;
  if (k && b.slice(0, 200).includes(k)) score += 5;

  // Content depth (25): aligned with “longer content” tip (~150+ words)
  if (words >= 150) score += 12;
  if (words >= 400) score += 13;

  // Structure
  if (hasH2) score += 15;

  // Descriptive title (words ≥ 3 avoids counting long nonsense strings)
  if (titleWordCount >= 3) score += 10;

  return Math.min(100, score);
}

function seoLabel(s) {
  const n = Number(s) || 0;
  if (n < 25) return { text: "Low", className: "bg-rose-100 text-rose-800" };
  if (n < 50)
    return { text: "Average", className: "bg-amber-100 text-amber-800" };
  if (n < 75)
    return { text: "Good", className: "bg-emerald-100 text-emerald-800" };
  return { text: "Great", className: "bg-sky-100 text-sky-800" };
}

const GEN_TONES = ["Professional", "Casual", "Friendly", "Authoritative"];
const GEN_WORD_TARGETS = [300, 500, 1000];

function wordTargetToLengthLabel(n) {
  if (n <= 300) return "Short (around 300 words)";
  if (n <= 500) return "Medium (around 500 words)";
  return "Long (around 1000 words)";
}

function OutlinePreviewLines({ text }) {
  if (!text?.trim()) return null;
  return (
    <div className="space-y-2 font-medium text-slate-800">
      {text.split("\n").map((line, i) => {
        const t = line.trim();
        if (!t) return null;
        if (t.startsWith("# ")) {
          return (
            <div key={i} className="flex gap-2 text-base">
              <span className="shrink-0 rounded bg-[#17a5b4] px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                H1
              </span>
              <span>{t.slice(2)}</span>
            </div>
          );
        }
        if (t.startsWith("## ")) {
          return (
            <div key={i} className="flex gap-2 pl-0 text-sm">
              <span className="shrink-0 rounded bg-[#149db0]/95 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                H2
              </span>
              <span>{t.slice(3)}</span>
            </div>
          );
        }
        if (t.startsWith("### ")) {
          return (
            <div key={i} className="flex gap-2 pl-4 text-sm text-slate-700">
              <span className="shrink-0 rounded bg-slate-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                H3
              </span>
              <span>{t.slice(4)}</span>
            </div>
          );
        }
        return (
          <div key={i} className="pl-6 text-sm text-slate-600">
            {t}
          </div>
        );
      })}
    </div>
  );
}

const INITIAL_BODY = `<h2>Section one</h2><p>Start writing here. Use the toolbar for basic formatting.</p><h3>Subsection</h3><p>More body text.</p><div class="editor-tip-block" style="border-left:4px solid ${BRAND};background:${BRAND_TIP_BG};padding:12px 14px;border-radius:0 8px 8px 0;margin:16px 0;"><div style="display:flex;gap:8px;align-items:flex-start;"><span style="font-size:18px;">💡</span><div contenteditable="true" style="flex:1;outline:none;min-height:1.2em;">Pro tip: add your primary keyword early in the post.</div></div></div><h2>Section two</h2><p>Another paragraph.</p>`;
const EMPTY_BODY = "<p></p>";

export default function BlogEditorWorkspace({
  initialDraft = null,
  forceNew = false,
  source = "bloglift",
}) {
  const [draftId, setDraftId] = useState(() => initialDraft?.id ?? null);
  const isRemoteShopify =
    source === "shopify" ||
    (typeof draftId === "string" &&
      draftId.startsWith("gid://shopify/Article/"));
  const [title, setTitle] = useState("Untitled post");
  const [primaryKeyword, setPrimaryKeyword] = useState("keyword");
  const [lastSaved, setLastSaved] = useState(null);
  const [published, setPublished] = useState(false);
  const [tags, setTags] = useState([]);
  const [remoteSaving, setRemoteSaving] = useState(false);
  const [outline, setOutline] = useState([]);
  const [activeHeadingId, setActiveHeadingId] = useState(null);
  const bodyRef = useRef(null);
  const scrollMainRef = useRef(null);
  const genOpenPrev = useRef(false);
  const [wordCount, setWordCount] = useState(0);
  const [notice, setNotice] = useState(null);
  const [aiBusy, setAiBusy] = useState(null);

  const [showKeyModal, setShowKeyModal] = useState(false);
  const [openrouterKey, setOpenrouterKey] = useState("");
  const [bodyRev, setBodyRev] = useState(0);
  const [aiSeo, setAiSeo] = useState(null);
  const [aiSeoLoading, setAiSeoLoading] = useState(false);
  const [aiSeoErr, setAiSeoErr] = useState(null);
  const [aiSeoRefresh, setAiSeoRefresh] = useState(0);
  const [genTopic, setGenTopic] = useState("");
  const [genOpen, setGenOpen] = useState(false);
  const [genKeyword, setGenKeyword] = useState("");
  const [genTone, setGenTone] = useState("Professional");
  const [genWordTarget, setGenWordTarget] = useState(500);
  const [genOutlinePreview, setGenOutlinePreview] = useState("");
  const [outlineOpen, setOutlineOpen] = useState(true);

  const [availableBlogs, setAvailableBlogs] = useState([]);
  const [targetBlogId, setTargetBlogId] = useState("");

  useEffect(() => {
    let cancelled = false;
    const loadBlogs = async () => {
      try {
        const res = await fetch("/api/shopify/blogs");
        const data = await res.json();
        const blogs =
          (Array.isArray(data) ? data : [])
            .map((edge) => ({
              id: edge?.node?.id,
              title: edge?.node?.title || "Blog",
            }))
            .filter((b) => !!b.id) || [];
        if (cancelled) return;
        setAvailableBlogs(blogs);
        setTargetBlogId((prev) => prev || blogs?.[0]?.id || "");
      } catch {
        if (cancelled) return;
        setAvailableBlogs([]);
      }
    };
    void loadBlogs();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      const key =
        localStorage.getItem(LS_OPENROUTER) ||
        localStorage.getItem(LS_GEMINI) ||
        localStorage.getItem("user_gemini_key");
      if (key) setOpenrouterKey(key);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (genOpen && !genOpenPrev.current) {
      setGenKeyword(primaryKeyword);
      setGenOutlinePreview("");
    }
    genOpenPrev.current = genOpen;
  }, [genOpen, primaryKeyword]);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el || el.dataset.inited) return;
    let initialTitle = "Untitled post";
    if (forceNew) {
      setDraftId(null);
      setTitle("Untitled post");
      setPrimaryKeyword("keyword");
      setPublished(false);
      setTags([]);
      setLastSaved(null);
      el.innerHTML = EMPTY_BODY;
    } else if (initialDraft?.id) {
      initialTitle = initialDraft.title?.trim() || "Untitled post";
      setTitle(initialTitle);
      setPrimaryKeyword(initialDraft.keyword?.trim() || "keyword");
      setPublished(!!initialDraft.published);
      setDraftId(initialDraft.id);
      setTags(Array.isArray(initialDraft.tags) ? initialDraft.tags : []);
      setLastSaved(
        initialDraft.updatedAt
          ? new Date(initialDraft.updatedAt).toISOString()
          : null,
      );
      el.innerHTML = initialDraft.content?.trim()
        ? initialDraft.content
        : INITIAL_BODY;
    } else {
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) {
          const d = JSON.parse(raw);
          if (d.title) {
            initialTitle = d.title;
            setTitle(d.title);
          }
          if (d.primaryKeyword) setPrimaryKeyword(d.primaryKeyword);
          if (d.lastSaved) setLastSaved(d.lastSaved);
          if (d.published) setPublished(!!d.published);
          el.innerHTML = d.bodyHtml || INITIAL_BODY;
        } else {
          el.innerHTML = INITIAL_BODY;
        }
      } catch {
        el.innerHTML = INITIAL_BODY;
      }
    }
    el.dataset.inited = "1";
    ensureHeadingIds(el);
    setOutline(buildOutline(el));
    const text = el.innerText || "";
    setWordCount(countWords(text) + countWords(initialTitle));
  }, [initialDraft, forceNew]);

  const syncBody = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    ensureHeadingIds(el);
    setOutline(buildOutline(el));
    const text = el.innerText || "";
    setWordCount(countWords(text) + countWords(title));
    setBodyRev((n) => n + 1);
  }, [title]);

  useEffect(() => {
    if (!bodyRef.current?.dataset.inited) return;
    const text = bodyRef.current.innerText || "";
    setWordCount(countWords(text) + countWords(title));
  }, [title]);

  useEffect(() => {
    const root = scrollMainRef.current;
    const el = bodyRef.current;
    if (!root || !el) return;
    const headings = el.querySelectorAll("h2, h3");
    if (!headings.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) setActiveHeadingId(visible[0].target.id);
      },
      { root, threshold: [0.15, 0.35, 0.55], rootMargin: "-64px 0px -50% 0px" },
    );
    headings.forEach((h) => obs.observe(h));
    return () => obs.disconnect();
  }, [outline.length]);

  const bodyPlain = bodyRef.current?.innerText || "";
  const hasH2 = bodyRef.current?.querySelector("h2") != null;
  const fallbackSeoScore = useMemo(
    () =>
      computeSeo({
        title,
        keyword: primaryKeyword,
        bodyText: bodyPlain,
        hasH2,
      }),
    [title, primaryKeyword, bodyPlain, hasH2],
  );

  const optimizationTips = useMemo(() => {
    const tips = [];
    const k = primaryKeyword.toLowerCase();
    if (k && !title.toLowerCase().includes(k))
      tips.push({
        tone: "warn",
        text: "Add primary keyword to the title",
      });
    if (k && !bodyPlain.toLowerCase().slice(0, 200).includes(k))
      tips.push({
        tone: "info",
        text: "Use keyword in the first paragraph",
      });
    if (!hasH2)
      tips.push({ tone: "warn", text: "Add at least one H2 section" });
    if (countWords(bodyPlain) < 150)
      tips.push({ tone: "info", text: "Longer content often ranks better" });
    if (tips.length === 0)
      tips.push({ tone: "ok", text: "Looks reasonable — keep refining" });
    return tips.slice(0, 5);
  }, [title, primaryKeyword, bodyPlain, hasH2]);

  const seoScore =
    openrouterKey.trim() && aiSeo ? aiSeo.score : fallbackSeoScore;
  const badge = seoLabel(seoScore);

  const displayTips =
    openrouterKey.trim() && aiSeo?.tips?.length ? aiSeo.tips : optimizationTips;

  const suggestedKeywords =
    openrouterKey.trim() && aiSeo?.suggestedKeywords?.length
      ? aiSeo.suggestedKeywords
      : [];

  useEffect(() => {
    const resolveKey = () => {
      try {
        return (
          openrouterKey.trim() ||
          localStorage.getItem(LS_OPENROUTER) ||
          localStorage.getItem(LS_GEMINI) ||
          localStorage.getItem("user_gemini_key") ||
          ""
        );
      } catch {
        return openrouterKey.trim();
      }
    };

    const key = resolveKey();
    if (!key.trim()) {
      setAiSeo(null);
      setAiSeoErr(null);
      setAiSeoLoading(false);
      return;
    }

    const el = bodyRef.current;
    const bodyText = (el?.innerText || "").slice(0, 12000);
    const h2 = el?.querySelector("h2") != null;

    const id = setTimeout(async () => {
      setAiSeoLoading(true);
      setAiSeoErr(null);
      try {
        const res = await fetch("/api/ai/seo-insight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey: key,
            title,
            primaryKeyword,
            bodyText,
            hasH2: h2,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Request failed");
        setAiSeo({
          score: Math.min(100, Math.max(0, Number(data.score) || 0)),
          tips: Array.isArray(data.tips) ? data.tips : [],
          suggestedKeywords: Array.isArray(data.suggestedKeywords)
            ? data.suggestedKeywords
            : [],
        });
      } catch (e) {
        setAiSeoErr(e.message || "Error");
        setAiSeo(null);
      } finally {
        setAiSeoLoading(false);
      }
    }, 1400);

    return () => clearTimeout(id);
  }, [
    title,
    primaryKeyword,
    bodyRev,
    openrouterKey,
    outline.length,
    aiSeoRefresh,
  ]);

  const persistDraft = useCallback(
    async (publishedOverride) => {
      const bodyHtml = bodyRef.current?.innerHTML || "";
      const pub =
        publishedOverride !== undefined ? publishedOverride : published;
      const payload = {
        title,
        primaryKeyword,
        bodyHtml,
        lastSaved: new Date().toISOString(),
        published: pub,
      };
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(payload));
      } catch {
        /* ignore */
      }
      if (publishedOverride !== undefined) setPublished(pub);

      const bodyPlain = bodyRef.current?.innerText || "";
      const hasH2 = bodyRef.current?.querySelector("h2") != null;
      const heuristicScore = computeSeo({
        title,
        keyword: primaryKeyword,
        bodyText: bodyPlain,
        hasH2,
      });
      const scoreToSave =
        openrouterKey.trim() && aiSeo != null ? aiSeo.score : heuristicScore;

      setRemoteSaving(true);
      try {
        if (isRemoteShopify) {
          const res = await fetch("/api/shopify/article-update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: draftId,
              title,
              bodyHtml,
              tags: Array.isArray(tags) ? tags.join(", ") : tags,
              isPublished: true,
              // SEO metafields optional; only sent if filled elsewhere.
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Shopify save failed");
          setLastSaved(new Date().toISOString());
          setNotice(pub ? "Saved to Shopify — published" : "Saved to Shopify");
        } else {
          const res = await fetch("/api/seo/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: draftId,
              title,
              content: bodyHtml,
              keyword: primaryKeyword,
              score: scoreToSave,
              published: pub,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Save failed");
          if (data.id) setDraftId(data.id);
          const iso =
            data.updatedAt != null
              ? new Date(data.updatedAt).toISOString()
              : payload.lastSaved;
          setLastSaved(iso);
          setNotice(
            pub
              ? "Saved — marked published (visible on My Posts when published)"
              : "Draft saved — appears on your dashboard",
          );
        }
      } catch (e) {
        setLastSaved(payload.lastSaved);
        setNotice(
          e.message ||
            "Saved locally only. Connect DATABASE_URL (Neon) and run migrations to sync.",
        );
      } finally {
        setRemoteSaving(false);
        setTimeout(() => setNotice(null), 3200);
      }
    },
    [
      title,
      primaryKeyword,
      published,
      draftId,
      openrouterKey,
      aiSeo,
      isRemoteShopify,
      tags,
    ],
  );

  const saveOpenRouterKey = () => {
    try {
      localStorage.setItem(LS_OPENROUTER, openrouterKey);
      localStorage.removeItem(LS_GEMINI);
    } catch {
      /* ignore */
    }
    setShowKeyModal(false);
    setNotice("OpenRouter key saved in this browser");
    setTimeout(() => setNotice(null), 2000);
  };

  const exec = (command, value = null) => {
    const el = bodyRef.current;
    if (!el) return;
    el.focus();
    try {
      document.execCommand(command, false, value == null ? "" : value);
    } catch {
      /* execCommand can throw in some contexts */
    }
    syncBody();
  };

  const cloneSelectionInEditor = () => {
    const el = bodyRef.current;
    const sel = window.getSelection();
    if (!el || !sel?.rangeCount) return null;
    const r = sel.getRangeAt(0);
    if (!el.contains(r.commonAncestorContainer)) return null;
    return r.cloneRange();
  };

  const insertLink = () => {
    const saved = cloneSelectionInEditor();
    const url = window.prompt("Link URL", "https://");
    if (url == null || !url.trim()) return;
    const el = bodyRef.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (saved) {
      sel.removeAllRanges();
      sel.addRange(saved);
    }
    exec("createLink", url.trim());
  };

  const insertImage = () => {
    const saved = cloneSelectionInEditor();
    const url = window.prompt("Image URL", "https://");
    if (url == null || !url.trim()) return;
    const el = bodyRef.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (saved) {
      sel.removeAllRanges();
      sel.addRange(saved);
    }
    exec("insertImage", url.trim());
  };

  const insertTip = () => {
    const html = `<div class="editor-tip-block" style="border-left:4px solid ${BRAND};background:${BRAND_TIP_BG};padding:12px 14px;border-radius:0 8px 8px 0;margin:16px 0;"><div style="display:flex;gap:8px;align-items:flex-start;"><span style="font-size:18px;">💡</span><div contenteditable="true" style="flex:1;outline:none;min-height:1.2em;">Tip</div></div></div>`;
    const el = bodyRef.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (sel?.rangeCount) {
      const r = sel.getRangeAt(0);
      if (el.contains(r.commonAncestorContainer)) {
        r.deleteContents();
        const frag = r.createContextualFragment(html);
        const tail = frag.lastChild;
        r.insertNode(frag);
        if (tail?.parentNode) {
          r.setStartAfter(tail);
          r.collapse(true);
        } else {
          r.collapse(false);
        }
        sel.removeAllRanges();
        sel.addRange(r);
        syncBody();
        return;
      }
    }
    el.insertAdjacentHTML("beforeend", html);
    syncBody();
  };

  const scrollToHeading = (id) => {
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveHeadingId(id);
  };

  const getOpenRouterKeyOrPrompt = () => {
    let k = openrouterKey.trim();
    if (!k) {
      try {
        k =
          localStorage.getItem(LS_OPENROUTER) ||
          localStorage.getItem(LS_GEMINI) ||
          localStorage.getItem("user_gemini_key") ||
          "";
      } catch {
        k = "";
      }
    }
    if (!k) {
      setShowKeyModal(true);
      return null;
    }
    return k;
  };

  const runImproveSeo = async () => {
    const key = getOpenRouterKeyOrPrompt();
    if (!key) return;
    setAiBusy("seo");
    try {
      const res = await fetch("/api/generate-blog-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: bodyRef.current?.innerText || "",
          keyword: primaryKeyword,
          userApiKey: key,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      if (bodyRef.current) {
        bodyRef.current.innerHTML = aiTextToHtml(data.content);
        syncBody();
      }
      setNotice("SEO pass applied");
    } catch (e) {
      setNotice(e.message || "Error");
    } finally {
      setAiBusy(null);
      setTimeout(() => setNotice(null), 3000);
    }
  };

  const runTransform = async (op) => {
    const key = getOpenRouterKeyOrPrompt();
    if (!key) return;
    setAiBusy(op);
    try {
      const res = await fetch("/api/blog-transform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: bodyRef.current?.innerText || "",
          userApiKey: key,
          op,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      if (bodyRef.current) {
        bodyRef.current.innerHTML = aiTextToHtml(data.content);
        syncBody();
      }
    } catch (e) {
      setNotice(e.message || "Error");
    } finally {
      setAiBusy(null);
      setTimeout(() => setNotice(null), 3000);
    }
  };

  const runGenerateOutline = async () => {
    const key = getOpenRouterKeyOrPrompt();
    if (!key) return;
    if (!genTopic.trim()) {
      setNotice("Add a blog topic");
      setTimeout(() => setNotice(null), 2000);
      return;
    }
    const kw = genKeyword.trim() || primaryKeyword;
    if (!kw.trim()) {
      setNotice("Add a target keyword");
      setTimeout(() => setNotice(null), 2000);
      return;
    }
    setAiBusy("outline");
    try {
      const res = await fetch("/api/generate-blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: genTopic.trim(),
          keywords: [kw],
          tone: genTone,
          length: wordTargetToLengthLabel(genWordTarget),
          outline: "",
          outlineOnly: true,
          apiKey: key,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setGenOutlinePreview(data.content || "");
      setNotice("Outline ready");
      setTimeout(() => setNotice(null), 2000);
    } catch (e) {
      setNotice(e.message || "Error");
      setTimeout(() => setNotice(null), 4000);
    } finally {
      setAiBusy(null);
    }
  };

  const runGenerateBlog = async () => {
    const key = getOpenRouterKeyOrPrompt();
    if (!key) return;
    if (!genTopic.trim()) {
      setNotice("Add a blog topic");
      setTimeout(() => setNotice(null), 2000);
      return;
    }
    const kw = genKeyword.trim() || primaryKeyword;
    if (!kw.trim()) {
      setNotice("Add a target keyword");
      setTimeout(() => setNotice(null), 2000);
      return;
    }
    setAiBusy("gen");
    try {
      const res = await fetch("/api/generate-blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: genTopic.trim(),
          keywords: [kw],
          tone: genTone,
          length: wordTargetToLengthLabel(genWordTarget),
          outline: genOutlinePreview.trim(),
          apiKey: key,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      let rest = data.content;
      let newTitle = title;
      const m = data.content.match(/^#\s+(.+)/m);
      if (m) {
        newTitle = m[1].trim();
        rest = data.content.replace(/^#\s.+\n+/, "");
      }
      setTitle(newTitle);
      setPrimaryKeyword(kw);
      if (bodyRef.current) {
        bodyRef.current.innerHTML = aiTextToHtml(rest);
        syncBody();
      }
      setGenOpen(false);
      setGenTopic("");
      setGenOutlinePreview("");
      setNotice("Blog pasted into editor");
      setTimeout(() => setNotice(null), 2500);
    } catch (e) {
      setNotice(e.message || "Error");
      setTimeout(() => setNotice(null), 4000);
    } finally {
      setAiBusy(null);
    }
  };

  const closeGenModal = () => {
    setGenOpen(false);
    setGenOutlinePreview("");
  };

  const publish = () => {
    if (isRemoteShopify) {
      if (!window.confirm("Publish this post to Shopify?")) return;
      void persistDraft(true);
      return;
    }

    if (!window.confirm("Publish this post to Shopify?")) return;
    const bodyHtml = bodyRef.current?.innerHTML || "";
    if (!targetBlogId) {
      setNotice("No Shopify blog found to publish into");
      setTimeout(() => setNotice(null), 2500);
      return;
    }

    void (async () => {
      setRemoteSaving(true);
      try {
        const res = await fetch("/api/shopify/article-create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blogId: targetBlogId,
            title,
            bodyHtml,
            tags: Array.isArray(tags) ? tags.join(", ") : tags,
            isPublished: true,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Shopify publish failed");
        if (data?.article?.id) setDraftId(data.article.id);
        setPublished(true);
        setLastSaved(new Date().toISOString());
        setNotice("Published to Shopify");
      } catch (e) {
        setNotice(e.message || "Shopify publish failed");
      } finally {
        setRemoteSaving(false);
        setTimeout(() => setNotice(null), 3200);
      }
    })();
  };

  /** Run format on pointer down (after preventDefault) so selection stays in the editor. */
  const ToolbarBtn = ({ onFormat, children, title: tip }) => (
    <button
      type="button"
      title={tip}
      className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
      onMouseDown={(e) => {
        e.preventDefault();
        onFormat?.();
      }}
    >
      {children}
    </button>
  );

  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-100 p-2 text-slate-900 sm:p-3 md:p-4">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:rounded-2xl">
        {/* Top bar */}
        <header className="flex shrink-0 flex-col border-b border-slate-100 bg-white">
          <div className="flex items-center justify-between gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-2.5 md:px-5">
            <div className="flex min-w-0 items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900">
                <span className="size-1.5 rounded-full bg-amber-500" />
                {published ? "Published" : "Draft"}
              </span>
            </div>
            <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setGenOpen(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 sm:gap-1.5 sm:px-3 sm:py-2 sm:text-sm"
              >
                <Sparkles className="size-3.5 text-[#17a5b4] sm:size-4" />
                Generate with AI
              </button>
              <button
                type="button"
                disabled={remoteSaving}
                onClick={() => void persistDraft()}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 sm:gap-1.5 sm:px-3 sm:py-2 sm:text-sm"
              >
                {remoteSaving ? (
                  <Loader2 className="size-3.5 animate-spin sm:size-4" />
                ) : (
                  <Save className="size-3.5 sm:size-4" />
                )}
                <span className="hidden sm:inline">
                  {remoteSaving ? "Saving…" : "Save Draft"}
                </span>
                <span className="sm:hidden">{remoteSaving ? "…" : "Save"}</span>
              </button>
              <button
                type="button"
                disabled={remoteSaving}
                onClick={publish}
                className="inline-flex items-center gap-1 rounded-lg bg-[#17a5b4] disabled:opacity-45 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#149db0] sm:gap-1.5 sm:px-3 sm:py-2 sm:text-sm"
              >
                <Send className="size-3.5 sm:size-4" />
                Publish
              </button>
            </div>
          </div>
          {/* AI + quick SEO stay visible on small screens (full sidebar is lg+ only) */}
          <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/80 px-2 py-2 sm:flex-row sm:items-start sm:gap-3 sm:px-3 md:px-5 lg:hidden">
            <div
              className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200/80 pb-2 sm:border-b-0 sm:pb-0"
              aria-label="SEO score summary"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                SEO
              </span>
              <span className="text-sm font-bold text-slate-900">
                {seoScore}
              </span>
              <span className="text-xs text-slate-400">/100</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.className}`}
              >
                {badge.text}
              </span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <Sparkles className="size-3.5 shrink-0 text-[#17a5b4]" />
                AI actions
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  disabled={!!aiBusy}
                  onClick={runImproveSeo}
                  className="rounded-lg bg-[#17a5b4] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#149db0] disabled:opacity-50 sm:text-xs"
                >
                  {aiBusy === "seo" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    "Improve SEO"
                  )}
                </button>
                {["rewrite", "expand", "simplify"].map((op) => (
                  <button
                    key={op}
                    type="button"
                    disabled={!!aiBusy}
                    onClick={() => runTransform(op)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium capitalize text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:text-xs"
                  >
                    {aiBusy === op ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      op
                    )}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowKeyModal(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-600 hover:bg-slate-50 sm:text-xs"
                >
                  <KeyRound className="size-3" />
                  API key
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 gap-1.5 overflow-hidden bg-slate-100/95 p-1.5 sm:gap-2 sm:p-2 md:gap-3 md:p-3">
          {/* Outline */}
          <aside
            className={`hidden shrink-0 flex-col self-stretch overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm transition-[width] duration-200 ease-out md:flex ${
              outlineOpen ? "w-[13.5rem] sm:w-52" : "w-10 sm:w-11"
            }`}
          >
            {outlineOpen ? (
              <>
                <button
                  type="button"
                  onClick={() => setOutlineOpen(false)}
                  className="flex w-full shrink-0 items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hover:bg-slate-50"
                  aria-expanded={true}
                  title="Hide outline"
                >
                  <Menu className="size-3.5 shrink-0" />
                  Outline
                </button>
                <nav className="min-h-0 flex-1 overflow-y-auto p-2">
                  <button
                    type="button"
                    onClick={() =>
                      document
                        .getElementById("editor-title-scroll-anchor")
                        ?.scrollIntoView({ behavior: "smooth" })
                    }
                    className={`mb-1 w-full rounded-md px-2 py-1.5 text-left text-sm font-semibold ${
                      activeHeadingId === null
                        ? "border-l-2 border-[#17a5b4] bg-[#17a5b4]/10 text-[#134e56]"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    H1 · Title
                  </button>
                  {outline.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => scrollToHeading(item.id)}
                      className={`mb-0.5 w-full rounded-md px-2 py-1.5 text-left text-sm ${
                        item.level === "H2"
                          ? "pl-2 font-medium"
                          : "pl-4 text-slate-600"
                      } ${
                        activeHeadingId === item.id
                          ? "border-l-2 border-[#17a5b4] bg-[#17a5b4]/10 text-[#134e56]"
                          : "text-slate-700 hover:bg-white"
                      }`}
                    >
                      <span className="mr-1.5 text-[10px] font-bold text-slate-400">
                        {item.level}
                      </span>
                      {item.text}
                    </button>
                  ))}
                </nav>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setOutlineOpen(true)}
                className="flex w-full flex-1 flex-col items-center py-3 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                aria-expanded={false}
                title="Show outline"
              >
                <Menu className="size-4" />
              </button>
            )}
          </aside>

          {/* Editor column */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-xs text-slate-500 sm:px-4 sm:text-sm md:px-5">
              <span>~ {wordCount} words</span>
              <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                <ToolbarBtn title="Bold" onFormat={() => exec("bold")}>
                  <Bold className="size-4" />
                </ToolbarBtn>
                <ToolbarBtn title="Italic" onFormat={() => exec("italic")}>
                  <Italic className="size-4" />
                </ToolbarBtn>
                <ToolbarBtn
                  title="Underline"
                  onFormat={() => exec("underline")}
                >
                  <Underline className="size-4" />
                </ToolbarBtn>
                <ToolbarBtn title="Link" onFormat={insertLink}>
                  <Link className="size-4" />
                </ToolbarBtn>
                <ToolbarBtn title="Image" onFormat={insertImage}>
                  <Image className="size-4" />
                </ToolbarBtn>
                <ToolbarBtn
                  title="Bullet list"
                  onFormat={() => exec("insertUnorderedList")}
                >
                  <List className="size-4" />
                </ToolbarBtn>
                <ToolbarBtn title="Pro tip box" onFormat={insertTip}>
                  <Lightbulb className="size-4" />
                </ToolbarBtn>
              </div>
            </div>
            <div
              ref={scrollMainRef}
              className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-5 md:px-6"
            >
              <div id="editor-title-scroll-anchor" />
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mb-2 w-full border-0 bg-transparent text-2xl font-bold tracking-tight text-slate-900 outline-none focus:ring-0 sm:text-3xl"
                placeholder="Title"
              />
              <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <span className="rounded-full bg-[#17a5b4]/10 px-2.5 py-0.5 text-xs font-medium text-[#115960]">
                  {primaryKeyword || "—"}
                </span>
                <span>
                  {lastSaved
                    ? `Saved ${new Date(lastSaved).toLocaleString()}`
                    : "Not saved yet"}
                </span>
              </div>
              <div
                ref={bodyRef}
                contentEditable
                suppressContentEditableWarning
                className="max-w-none min-h-[240px] text-sm leading-relaxed text-slate-800 outline-none sm:min-h-[280px] sm:text-base [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-bold sm:[&_h2]:mt-8 sm:[&_h2]:text-xl [&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-semibold sm:[&_h3]:mt-4 sm:[&_h3]:text-lg [&_p]:my-2 [&_p]:sm:my-3 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:sm:my-3 [&_ul]:sm:pl-6"
                onInput={syncBody}
                onBlur={syncBody}
              />
            </div>
          </div>

          {/* Right column: AI first (always visible), SEO + tips scroll below */}
          <aside className="hidden w-[17.5rem] shrink-0 flex-col gap-2 self-stretch min-h-0 lg:flex xl:w-72">
            <div className="shrink-0 rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Sparkles className="size-4 text-[#17a5b4]" />
                AI actions
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!!aiBusy}
                  onClick={runImproveSeo}
                  className="rounded-lg bg-[#17a5b4] px-2 py-2.5 text-center text-xs font-semibold text-white hover:bg-[#149db0] disabled:opacity-50"
                >
                  {aiBusy === "seo" ? (
                    <Loader2 className="mx-auto size-4 animate-spin" />
                  ) : (
                    "Improve SEO"
                  )}
                </button>
                {["rewrite", "expand", "simplify"].map((op) => (
                  <button
                    key={op}
                    type="button"
                    disabled={!!aiBusy}
                    onClick={() => runTransform(op)}
                    className="rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-2.5 text-center text-xs font-medium capitalize text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    {aiBusy === op ? (
                      <Loader2 className="mx-auto size-4 animate-spin" />
                    ) : (
                      op
                    )}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowKeyModal(true)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-2 text-xs text-slate-600 hover:bg-slate-50"
              >
                <KeyRound className="size-3.5" />
                API key
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <div className="space-y-5">
                  <section aria-labelledby="seo-score-heading">
                    <h2
                      id="seo-score-heading"
                      className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      SEO score
                    </h2>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-slate-900 sm:text-3xl">
                        {seoScore}
                      </span>
                      <span className="text-slate-400">/100</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                      >
                        {badge.text}
                      </span>
                    </div>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-[#17a5b4] transition-all"
                        style={{ width: `${seoScore}%` }}
                      />
                    </div>
                    {openrouterKey.trim() && aiSeo && (
                      <p className="mt-2 text-[10px] text-slate-400">
                        Score and tips from AI (OpenRouter)
                      </p>
                    )}
                    {openrouterKey.trim() && aiSeoLoading && (
                      <p className="mt-1 text-[10px] text-slate-400">
                        Updating SEO insight…
                      </p>
                    )}
                    {aiSeoErr ? (
                      <p className="mt-1 text-[10px] text-rose-600">
                        {aiSeoErr}
                      </p>
                    ) : null}
                  </section>

                  <section
                    className="border-t border-slate-100 pt-5"
                    aria-labelledby="keyword-heading"
                  >
                    <h2
                      id="keyword-heading"
                      className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      Keyword
                    </h2>
                    <input
                      type="text"
                      value={primaryKeyword}
                      onChange={(e) => setPrimaryKeyword(e.target.value)}
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm outline-none ring-[#17a5b4]/30 focus:bg-white focus:ring-2"
                      placeholder="Primary"
                    />
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Suggested keywords
                      </p>
                      {openrouterKey.trim() ? (
                        <button
                          type="button"
                          className="text-[10px] font-medium text-[#17a5b4] hover:underline"
                          onClick={() => setAiSeoRefresh((n) => n + 1)}
                        >
                          Refresh
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {suggestedKeywords.map((kw) => (
                        <button
                          key={kw}
                          type="button"
                          onClick={() => setPrimaryKeyword(kw)}
                          className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
                        >
                          {kw}
                        </button>
                      ))}
                      {!openrouterKey.trim() ? (
                        <span className="text-xs text-slate-400">
                          Save an OpenRouter key in AI actions (above or in the
                          header on smaller screens) for keywords that often
                          rank in similar topics.
                        </span>
                      ) : null}
                      {openrouterKey.trim() &&
                      aiSeo &&
                      suggestedKeywords.length ? (
                        <p className="mt-1 w-full text-[10px] leading-snug text-slate-400">
                          These keywords often rank on pages covering topics
                          similar to yours (AI-suggested from your draft).
                        </p>
                      ) : null}
                      {openrouterKey.trim() &&
                      !suggestedKeywords.length &&
                      !aiSeoLoading ? (
                        <span className="text-xs text-slate-400">
                          Suggested keywords appear after analysis finishes.
                        </span>
                      ) : null}
                    </div>
                  </section>

                  <section
                    className="border-t border-slate-100 pt-5"
                    aria-labelledby="tips-heading"
                  >
                    <h2
                      id="tips-heading"
                      className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      Tips
                    </h2>
                    <ul className="mt-2 space-y-2 text-sm">
                      {displayTips.map((tip, i) => (
                        <li key={i} className="flex gap-2">
                          <span
                            className={
                              tip.tone === "warn"
                                ? "text-amber-500"
                                : tip.tone === "ok"
                                  ? "text-emerald-500"
                                  : "text-slate-400"
                            }
                          >
                            •
                          </span>
                          <span className="text-slate-700">{tip.text}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {notice && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {notice}
        </div>
      )}

      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">
                OpenRouter API key
              </h3>
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="rounded p-1 hover:bg-slate-100"
              >
                <X className="size-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              Stored only in this browser. Get a key at{" "}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[#17a5b4] underline"
              >
                openrouter.ai/keys
              </a>
              . You can also open{" "}
              <a
                href="/api/openrouter"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[#17a5b4] underline"
              >
                /api/openrouter
              </a>{" "}
              for JSON links.
            </p>
            <input
              type="password"
              value={openrouterKey}
              onChange={(e) => setOpenrouterKey(e.target.value)}
              className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="sk-or-…"
            />
            <button
              type="button"
              onClick={saveOpenRouterKey}
              className="mt-3 w-full rounded-lg bg-[#17a5b4] py-2 text-sm font-semibold text-white hover:bg-[#149db0]"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {genOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/45 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gen-modal-title"
        >
          <div className="my-auto flex max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[90dvh] sm:rounded-2xl">
            <div className="relative shrink-0 rounded-t-2xl bg-gradient-to-r from-[#149db0] via-[#17a5b4] to-[#149db0] px-5 py-4 sm:rounded-t-2xl">
              <button
                type="button"
                onClick={closeGenModal}
                className="absolute right-3 top-3 rounded-lg p-2 text-white/90 hover:bg-white/15"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
              <div className="pr-10">
                <h2
                  id="gen-modal-title"
                  className="text-lg font-bold tracking-tight text-white"
                >
                  Generate SEO Blog with AI
                </h2>
                <p className="mt-1 text-sm text-white/85">
                  Fill in details and let AI craft a fully optimized blog post
                </p>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <div className="space-y-5">
                <div>
                  <label
                    htmlFor="gen-blog-topic"
                    className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    <FileText className="size-3.5 text-slate-400" />
                    Blog topic
                  </label>
                  <input
                    id="gen-blog-topic"
                    type="text"
                    value={genTopic}
                    onChange={(e) => setGenTopic(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-[#17a5b4]/25 transition-shadow focus:border-[#17a5b4] focus:ring-2"
                    placeholder="e.g. How to boost Shopify store conversions with SEO"
                  />
                </div>

                <div>
                  <label
                    htmlFor="gen-target-keyword"
                    className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    <KeyRound className="size-3.5 text-slate-400" />
                    Target keyword
                  </label>
                  <div className="relative mt-2">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="gen-target-keyword"
                      type="text"
                      value={genKeyword}
                      onChange={(e) => setGenKeyword(e.target.value)}
                      className="w-full rounded-xl border border-[#17a5b4]/40 bg-white py-3 pl-10 pr-4 text-sm outline-none ring-[#17a5b4]/20 transition-shadow focus:ring-2 focus:ring-[#17a5b4]/30"
                      placeholder="shopify conversion optimization"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="gen-tone"
                      className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      <MessageSquare className="size-3.5 text-slate-400" />
                      Tone of voice
                    </label>
                    <div className="relative mt-2">
                      <select
                        id="gen-tone"
                        value={genTone}
                        onChange={(e) => setGenTone(e.target.value)}
                        className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-3 pl-3 pr-10 text-sm outline-none ring-[#17a5b4]/25 focus:border-[#17a5b4] focus:ring-2"
                      >
                        {GEN_TONES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <span className="pointer-events-none absolute right-3 top-1/2 block -translate-y-1/2 text-slate-400">
                        ▾
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Word count
                    </span>
                    <div className="mt-2 flex gap-2">
                      {GEN_WORD_TARGETS.map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setGenWordTarget(n)}
                          className={`flex-1 rounded-xl py-2.5 text-center text-sm font-semibold transition-colors ${
                            genWordTarget === n
                              ? "bg-[#17a5b4] text-white shadow-sm"
                              : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Preview outline
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#17a5b4]/12 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#115960]">
                        AI generated
                      </span>
                      <button
                        type="button"
                        disabled={!!aiBusy}
                        onClick={runGenerateOutline}
                        className="rounded-lg border border-[#17a5b4]/35 bg-[#17a5b4]/10 px-3 py-1.5 text-xs font-semibold text-[#115960] hover:bg-[#17a5b4]/16 disabled:opacity-50"
                      >
                        {aiBusy === "outline" ? (
                          <span className="inline-flex items-center gap-1">
                            <Loader2 className="size-3.5 animate-spin" />
                            Generating…
                          </span>
                        ) : (
                          "Generate outline"
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="min-h-[120px] rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                    {genOutlinePreview.trim() ? (
                      <OutlinePreviewLines text={genOutlinePreview} />
                    ) : (
                      <p className="text-sm leading-relaxed text-slate-400">
                        Click &ldquo;Generate outline&rdquo; to preview your
                        post structure, then paste the full article into the
                        editor.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-100 bg-white px-5 pb-5 pt-4">
              <button
                type="button"
                disabled={!!aiBusy}
                onClick={runGenerateBlog}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#17a5b4] py-3.5 text-sm font-bold text-white shadow-sm hover:bg-[#149db0] disabled:opacity-50"
              >
                {aiBusy === "gen" ? (
                  <>
                    <Loader2 className="size-5 animate-spin" />
                    Writing your post…
                  </>
                ) : (
                  "Paste it into the blog"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
