import { useEffect, useMemo, useRef, useState } from "react";
import {
  NavLink,
  useLoaderData,
  useRouteError,
  useNavigate,
  useSearchParams,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  PenTool,
  Search,
  Bell,
  FileText,
  BarChart3,
  Clock,
  Pencil,
  Zap,
} from "lucide-react";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();

  let drafts = [];
  let totalPosts = 0;
  let publishedPosts = 0;
  let weekly = [];
  try {
    const whereSearch =
      q.length > 0
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { keyword: { contains: q, mode: "insensitive" } },
              { content: { contains: q, mode: "insensitive" } },
            ],
          }
        : {};

    drafts = await prisma.post.findMany({
      where: { shop: session.shop, published: false, ...whereSearch },
      orderBy: { updatedAt: "desc" },
      take: 24,
    });

    totalPosts = await prisma.post.count({
      where: { shop: session.shop, ...whereSearch },
    });
    publishedPosts = await prisma.post.count({
      where: { shop: session.shop, published: true, ...whereSearch },
    });

    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 7 * 7); // include 8 weeks (current + 7 back)
    start.setHours(0, 0, 0, 0);

    const recent = await prisma.post.findMany({
      where: {
        shop: session.shop,
        updatedAt: { gte: start },
        ...whereSearch,
      },
      select: { updatedAt: true, score: true, published: true },
      orderBy: { updatedAt: "asc" },
    });

    const startOfWeek = (d) => {
      const x = new Date(d);
      const day = x.getDay(); // 0 Sun .. 6 Sat
      const diff = (day + 6) % 7; // Monday-start week
      x.setDate(x.getDate() - diff);
      x.setHours(0, 0, 0, 0);
      return x;
    };

    const buckets = new Map(); // key: ISO date string of week start
    const week0 = startOfWeek(start);
    for (let i = 0; i < 8; i++) {
      const wk = new Date(week0);
      wk.setDate(wk.getDate() + i * 7);
      buckets.set(wk.toISOString(), {
        weekStart: wk.toISOString(),
        avgScore: 0,
        scoreSum: 0,
        scoreCount: 0,
        publishedCount: 0,
        totalCount: 0,
      });
    }

    for (const p of recent) {
      const wk = startOfWeek(p.updatedAt);
      const key = wk.toISOString();
      if (!buckets.has(key)) continue;
      const b = buckets.get(key);
      b.totalCount += 1;
      if (p.published) b.publishedCount += 1;
      const s = Number(p.score) || 0;
      b.scoreSum += s;
      b.scoreCount += 1;
    }

    weekly = [...buckets.values()].map((b) => ({
      weekStart: b.weekStart,
      avgSeo: b.scoreCount ? Math.round(b.scoreSum / b.scoreCount) : 0,
      published: b.publishedCount,
      total: b.totalCount,
    }));
  } catch {
    drafts = [];
    totalPosts = 0;
    publishedPosts = 0;
    weekly = [];
  }
  return { drafts, q, totalPosts, publishedPosts, weekly };
};

function formatEditedAgo(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const sec = (Date.now() - d.getTime()) / 1000;
  if (sec < 45) return "just now";
  if (sec < 3600) return `${Math.max(1, Math.floor(sec / 60))}m ago`;
  if (sec < 86400) return `${Math.max(1, Math.floor(sec / 3600))}h ago`;
  if (sec < 86400 * 14)
    return `${Math.max(1, Math.floor(sec / 86400))}d ago`;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function scoreTone(score) {
  if (score >= 75) return "good";
  if (score >= 50) return "mid";
  return "low";
}

function ScoreDot({ tone }) {
  const map = {
    good: "bg-emerald-500",
    mid: "bg-amber-500",
    low: "bg-rose-500",
  };
  return (
    <span
      className={`inline-block size-2 rounded-full ${map[tone] || map.mid}`}
    />
  );
}

function PerformanceChart({ weeks, publishedScaled }) {
  const w = 520;
  const h = 104;
  const pad = { l: 8, r: 8, t: 6, b: 14 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const max = 100;
  const min = 0;
  const safeWeeks =
    Array.isArray(weeks) && weeks.length ? weeks : new Array(8).fill(0);
  const n = safeWeeks.length;
  const sx = (i) => pad.l + (innerW * i) / (n - 1);
  const sy = (v) => pad.t + innerH * (1 - (v - min) / (max - min));

  const linePts = safeWeeks.map((v, i) => `${sx(i)},${sy(v)}`).join(" ");
  const areaD = [
    `M ${sx(0)},${sy(safeWeeks[0])}`,
    ...safeWeeks.map((v, i) => `L ${sx(i)},${sy(v)}`),
    `L ${sx(n - 1)},${h - pad.b}`,
    `L ${sx(0)},${h - pad.b}`,
    "Z",
  ].join(" ");

  const safePublishedScaled =
    Array.isArray(publishedScaled) && publishedScaled.length === n
      ? publishedScaled
      : new Array(n).fill(0);
  const postsLinePts = safePublishedScaled
    .map((v, i) => `${sx(i)},${sy(v)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-24 w-full max-w-full sm:h-28"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <defs>
        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(23 165 180)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="rgb(23 165 180)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#chartFill)" />
      <polyline
        fill="none"
        stroke="rgb(56 189 248)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
        points={postsLinePts}
      />
      <polyline
        fill="none"
        stroke="rgb(23 165 180)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={linePts}
      />
    </svg>
  );
}

const tabClass = ({ isActive }) =>
  [
    "relative pb-3 pt-2 text-sm font-medium transition-colors",
    isActive
      ? "text-[#17a5b4] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-[#17a5b4]"
      : "text-slate-500 hover:text-slate-800",
  ].join(" ");

export default function DashboardPage() {
  const { drafts, q, totalPosts, publishedPosts, weekly } = useLoaderData();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notifWrapRef = useRef(null);
  const profileWrapRef = useRef(null);
  const draftCount = drafts.length;
  const avgSeoScore =
    draftCount > 0
      ? Math.round(
          drafts.reduce((s, p) => s + (Number(p.score) || 0), 0) / draftCount,
        )
      : 0;

  const weekLabels = (weekly || []).map((w) => {
    const d = new Date(w.weekStart);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  });
  const weekAvg = (weekly || []).map((w) => Number(w.avgSeo) || 0);
  const weekPublished = (weekly || []).map((w) => Number(w.published) || 0);
  const maxPublished = Math.max(1, ...weekPublished);
  const weekPublishedScaled = weekPublished.map((n) =>
    Math.round((n / maxPublished) * 90 + 5),
  );

  const [searchValue, setSearchValue] = useState(q || "");
  // Keep input synced when navigating back/forward
  useEffect(() => setSearchValue(q || ""), [q]);

  const submitSearch = (nextQ) => {
    const sp = new URLSearchParams(searchParams);
    const v = (nextQ || "").trim();
    if (v) sp.set("q", v);
    else sp.delete("q");
    // Preserve host/shop/embedded params used by Shopify
    navigate(`?${sp.toString()}`);
  };

  const recentDraftNotifs = useMemo(() => {
    return (drafts || []).slice(0, 6).map((p) => ({
      id: p.id,
      title: p.title || "Untitled",
      updatedAt: p.updatedAt || p.createdAt,
      score: Number(p.score) || 0,
    }));
  }, [drafts]);

  useEffect(() => {
    const onDocMouseDown = (e) => {
      const t = e.target;
      if (notifWrapRef.current && !notifWrapRef.current.contains(t)) {
        setNotifOpen(false);
      }
      if (profileWrapRef.current && !profileWrapRef.current.contains(t)) {
        setProfileOpen(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setNotifOpen(false);
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div
      className="flex min-h-screen flex-col bg-slate-50 text-sm text-slate-900"
      data-bloglift-page="dashboard"
    >
      <header className="border-b border-slate-200/80 bg-white">
        <div className="flex w-full items-center gap-3 px-5 py-2.5 sm:px-6 lg:px-8">
          <div className="flex min-w-0 flex-shrink-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#17a5b4] text-white shadow-sm ring-4 ring-[#17a5b4]/15">
              <PenTool className="size-4" strokeWidth={2.2} />
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-base font-semibold tracking-tight text-slate-900">
                BlogLift
              </span>
              <span className="hidden shrink-0 rounded-full bg-[#17a5b4]/10 px-2.5 py-0.5 text-xs font-medium text-[#115960] sm:inline">
                for Shopify
              </span>
            </div>
          </div>

          <div className="mx-auto hidden min-w-0 max-w-xl flex-1 md:block">
            <form
              className="relative block"
              onSubmit={(e) => {
                e.preventDefault();
                submitSearch(searchValue);
              }}
            >
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Search posts, keywords, content…"
                className="w-full rounded-lg border border-slate-200 bg-slate-50/80 py-2 pl-9 pr-10 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#17a5b4] focus:bg-white focus:ring-1 focus:ring-[#17a5b4]/30"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                aria-label="Search drafts"
              >
                <Search className="size-4" />
              </button>
            </form>
          </div>

          <div className="ml-auto flex flex-shrink-0 items-center gap-3">
            <div className="relative" ref={notifWrapRef}>
              <button
                type="button"
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                aria-label="Notifications"
                aria-expanded={notifOpen}
                onClick={() => {
                  setNotifOpen((v) => !v);
                  setProfileOpen(false);
                }}
              >
                <Bell className="size-5" strokeWidth={1.75} />
              </button>
              {notifOpen ? (
                <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <div className="text-sm font-semibold text-slate-900">
                      Notifications
                    </div>
                    <div className="text-xs text-slate-500">
                      Recent draft activity
                    </div>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {recentDraftNotifs.length ? (
                      recentDraftNotifs.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            setNotifOpen(false);
                            navigate(`/app/editor?id=${encodeURIComponent(n.id)}`);
                          }}
                          className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50"
                        >
                          <span className="mt-1 inline-block size-2 rounded-full bg-[#17a5b4]" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-slate-800">
                              {n.title}
                            </span>
                            <span className="mt-0.5 block text-xs text-slate-500">
                              Updated {formatEditedAgo(n.updatedAt)} · SEO {n.score}/100
                            </span>
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-6 text-sm text-slate-500">
                        No draft activity yet. Save a draft in the Editor.
                      </div>
                    )}
                  </div>
                  <div className="border-t border-slate-100 px-4 py-3">
                    <NavLink
                      to="/app/editor?new=1"
                      className="inline-flex w-full items-center justify-center rounded-lg bg-[#17a5b4] px-3 py-2 text-sm font-semibold text-white hover:bg-[#149db0]"
                      onClick={() => setNotifOpen(false)}
                    >
                      New Post
                    </NavLink>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="relative border-l border-slate-200 pl-3" ref={profileWrapRef}>
              <button
                type="button"
                className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-slate-100"
                aria-label="Profile menu"
                aria-expanded={profileOpen}
                onClick={() => {
                  setProfileOpen((v) => !v);
                  setNotifOpen(false);
                }}
              >
                <div className="flex size-10 items-center justify-center rounded-full bg-[#17a5b4] text-sm font-semibold text-white shadow-sm">
                  SA
                </div>
                <span className="hidden text-sm font-medium text-slate-700 sm:inline">
                  Store Admin
                </span>
              </button>

              {profileOpen ? (
                <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <div className="text-sm font-semibold text-slate-900">
                      Store Admin
                    </div>
                    <div className="text-xs text-slate-500">
                      Posts: {totalPosts} · Published: {publishedPosts}
                    </div>
                  </div>
                  <div className="p-2">
                    <NavLink
                      to="/app/dashboard"
                      className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      onClick={() => setProfileOpen(false)}
                    >
                      Dashboard
                    </NavLink>
                    <NavLink
                      to="/app/editor?new=1"
                      className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      onClick={() => setProfileOpen(false)}
                    >
                      New Post
                    </NavLink>
                    <NavLink
                      to="/app/blogs"
                      className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      onClick={() => setProfileOpen(false)}
                    >
                      My Posts
                    </NavLink>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Mobile search */}
        <div className="border-t border-slate-100 px-4 py-1.5 sm:px-6 md:hidden">
          <form
            className="relative block"
            onSubmit={(e) => {
              e.preventDefault();
              submitSearch(searchValue);
            }}
          >
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50/80 py-2 pl-9 pr-10 text-xs outline-none placeholder:text-slate-400"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              aria-label="Search drafts"
            >
              <Search className="size-3.5" />
            </button>
          </form>
        </div>

        {/* Sub-nav tabs */}
        <div className="border-t border-slate-100 bg-white">
          <nav className="flex w-full gap-5 px-5 sm:px-6 lg:px-8">
            <NavLink to="/app/dashboard" className={tabClass} end>
              Dashboard
            </NavLink>
            <NavLink to="/app/editor" className={tabClass}>
              Editor
            </NavLink>
            <NavLink to="/app/blogs" className={tabClass}>
              My Posts
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="flex w-full flex-1 flex-col gap-5 px-5 py-5 sm:px-6 lg:px-8">
        {/* Metrics: two stat cards + wider chart card */}
        <section className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Total Posts
              </p>
              <div className="shrink-0 rounded-lg bg-[#17a5b4]/10 p-1.5 text-[#17a5b4]">
                <FileText className="size-4" strokeWidth={2} />
              </div>
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums text-slate-900">
              {totalPosts}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Saved posts in BlogLift (drafts + published)
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Avg Draft SEO
              </p>
              <div className="shrink-0 rounded-lg bg-[#17a5b4]/10 p-1.5 text-[#17a5b4]">
                <BarChart3 className="size-4" strokeWidth={2} />
              </div>
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums text-slate-900">
              {draftCount ? avgSeoScore : "—"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Across saved drafts (last score stored)
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-6">
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Overview chart
                </h2>
                <p className="text-xs text-slate-500">
                  Last 8 weeks · Avg SEO (teal) + Published volume (blue)
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="size-2.5 rounded-full bg-[#17a5b4]" />
                  Avg SEO
                </span>
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="size-2.5 rounded-full bg-sky-400" />
                  Published
                </span>
              </div>
            </div>
            <PerformanceChart weeks={weekAvg} publishedScaled={weekPublishedScaled} />
            <div className="mt-2 flex justify-between text-xs uppercase tracking-wide text-slate-400">
              {(weekLabels.length ? weekLabels : new Array(8).fill("—")).map(
                (lbl, i) => <span key={i}>{lbl}</span>,
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>
                Published posts: <span className="font-semibold">{publishedPosts}</span>
              </span>
              {q ? (
                <NavLink
                  to="/app/dashboard"
                  className="font-medium text-[#17a5b4] hover:underline"
                >
                  Clear search
                </NavLink>
              ) : null}
            </div>
          </div>
        </section>

        {/* Recent activity */}
        <section className="flex flex-1 flex-col">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              Recent drafts
            </h2>
            <NavLink
              to="/app/editor?new=1"
              className="inline-flex items-center justify-center rounded-lg bg-[#17a5b4] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#149db0]"
            >
              + New Post
            </NavLink>
          </div>

          <div className="grid flex-1 gap-3 md:grid-cols-3">
            {drafts.map((post) => {
              const tone = scoreTone(Number(post.score) || 0);
              const kw = (post.keyword || "").trim();
              return (
                <article
                  key={post.id}
                  className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900">
                        Draft
                      </span>
                      {kw ? (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {kw.length > 28 ? `${kw.slice(0, 28)}…` : kw}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                      <ScoreDot tone={tone} />
                      {Number(post.score) || 0}/100
                    </div>
                  </div>
                  <h3 className="mb-3 line-clamp-2 flex-1 text-base font-bold text-slate-900">
                    {post.title || "Untitled"}
                  </h3>
                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                    <span className="flex items-center gap-2">
                      <Clock className="size-4 shrink-0" />
                      {formatEditedAgo(post.updatedAt || post.createdAt)}
                    </span>
                    <span className="flex items-center gap-3">
                      <NavLink
                        to={`/app/editor?id=${encodeURIComponent(post.id)}`}
                        className="inline-flex items-center gap-1 border-0 bg-transparent p-0 text-sm font-semibold text-[#17a5b4]"
                      >
                        <Pencil
                          className="size-3.5 shrink-0 text-[#17a5b4]"
                          strokeWidth={2.25}
                        />
                        Edit
                      </NavLink>
                      <span
                        className="h-4 w-px shrink-0 bg-slate-200"
                        aria-hidden
                      />
                      <NavLink
                        to={`/app/editor?id=${encodeURIComponent(post.id)}&optimize=1`}
                        className="inline-flex items-center gap-1 border-0 bg-transparent p-0 text-sm font-semibold text-orange-700"
                      >
                        <Zap
                          className="size-3.5 shrink-0 text-orange-700"
                          strokeWidth={2.25}
                        />
                        Optimize
                      </NavLink>
                    </span>
                  </div>
                </article>
              );
            })}
            {drafts.length === 0 ? (
              <div className="col-span-full rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500">
                <p className="text-sm font-medium text-slate-700">
                  No drafts yet
                </p>
                <p className="mt-2 text-sm">
                  Save a post from the Editor (Save Draft) to see it here. Uses
                  your Neon database via{" "}
                  <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
                    DATABASE_URL
                  </code>
                  .
                </p>
                <NavLink
                  to="/app/editor"
                  className="mt-4 inline-flex items-center justify-center rounded-lg bg-[#17a5b4] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#149db0]"
                >
                  Open editor
                </NavLink>
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
