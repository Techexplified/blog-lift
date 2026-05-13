import React, { useState, useEffect, useMemo } from "react";
import { useLoaderData, useFetcher, NavLink, useNavigate } from "react-router";
import { Sparkles, Upload, Zap, Loader2, Target, Wand2, Pencil, Trash2, FileText, CheckCircle2, X } from "lucide-react";
import Papa from "papaparse";

const LS_OPENROUTER = "bloglift_openrouter_key";

export function SchedulerPage() {
  const { drafts, scheduledPosts, allScheduled, blogs, rules } = useLoaderData();
  const fetcher = useFetcher();
  const navigate = useNavigate();

  const [isModalOpen, setModalOpen] = useState(false);
  const [selectedDraftId, setSelectedDraftId] = useState("");
  const [selectedDate, setSelectedDate] = useState(null);
  const [view, setView] = useState('month'); // 'month' or 'week'
  const [toast, setToast] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTitle, setGeneratedTitle] = useState("");
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tempKey, setTempKey] = useState("");
  const [editingPost, setEditingPost] = useState(null);

  // ── Toast handling ──────────────────────────────────────────────
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      if (fetcher.data.success) {
        setToast({ msg: fetcher.data.scheduled ? "Post scheduled on Shopify ✓" : "Settings saved ✓", type: "success" });
        setModalOpen(false);
        setSelectedDraftId("");
        setEditingPost(null);
      } else if (fetcher.data.error) {
        setToast({ msg: fetcher.data.error, type: "error" });
      }
    }
  }, [fetcher.state, fetcher.data]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // ── Computed Stats (Real Data) ──────────────────────────────────
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const scheduledThisMonth = allScheduled.filter(p => {
    const d = new Date(p.scheduledAt);
    return d >= thisMonthStart && d <= thisMonthEnd;
  }).length;

  const publishedThisMonth = allScheduled.filter(p => {
    const d = new Date(p.scheduledAt);
    return p.published && d >= thisMonthStart && d <= thisMonthEnd;
  }).length;

  const pendingDrafts = drafts.length;

  // AI Best Hour Heuristic
  const bestHour = allScheduled.length > 0 
    ? Math.round(allScheduled.reduce((acc, p) => acc + new Date(p.scheduledAt).getHours(), 0) / allScheduled.length)
    : 18; // default 6 PM
  const bestHourLabel = `${bestHour % 12 || 12}:00 ${bestHour < 12 ? "AM" : "PM"}`;

  // ── Helpers ──────────────────────────────────────────────────────
  const isRuleEnabled = (type) => {
    const rule = rules?.find(r => r.postType === type);
    return rule ? rule.enabled : (type === "seo" || type === "seasonal");
  };

  const tabClass = ({ isActive }) =>
    `inline-block border-b-2 px-1 py-3 text-sm font-bold transition-all ${
      isActive
        ? "border-[#17a5b4] text-[#17a5b4]"
        : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
    }`;

  const openScheduleOnDate = (day, isCurrentMonth) => {
    if (!isCurrentMonth) return;
    const d = new Date(now.getFullYear(), now.getMonth(), day, 10, 0);
    setSelectedDate(d);
    setModalOpen(true);
  };


  // ── Calendar Generation ──────────────────────────────────────────
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const dates = useMemo(() => {
    const res = [];
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay  = new Date(year, month + 1, 0);
    const startingDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

    const prevLast = new Date(year, month, 0).getDate();
    for (let i = startingDay - 1; i >= 0; i--) {
      res.push({ day: prevLast - i, isCurrentMonth: false, events: [] });
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      const cur = new Date(year, month, i);
      const isToday = cur.toDateString() === now.toDateString();
      const events = allScheduled
        .filter(p => p.scheduledAt && new Date(p.scheduledAt).toDateString() === cur.toDateString())
        .map(p => {
          let color = "bg-purple-500";
          if (p.postType === "promo")    color = "bg-orange-500";
          if (p.postType === "seasonal") color = "bg-yellow-400";
          return { type: p.postType || "seo", color, title: p.title };
        });
      res.push({ day: i, isCurrentMonth: true, isToday, events });
    }

    const remaining = 42 - res.length;
    for (let i = 1; i <= remaining; i++) {
      res.push({ day: i, isCurrentMonth: false, events: [] });
    }
    return res;
  }, [allScheduled]);

  const displayDates = useMemo(() => {
    if (view === 'month') return dates;
    
    // For week view: Find the row containing today or the current date
    const todayIndex = dates.findIndex(d => d.isToday && d.isCurrentMonth);
    if (todayIndex === -1) return dates.slice(0, 7); // Fallback to first row
    
    const startOfWeek = Math.floor(todayIndex / 7) * 7;
    return dates.slice(startOfWeek, startOfWeek + 7);
  }, [dates, view]);

  const displayLegend = [
    { type: "SEO", color: "bg-purple-500" },
    { type: "Promo", color: "bg-orange-500" },
    { type: "Seasonal", color: "bg-yellow-400" },
  ];

  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8 font-sans transition-colors duration-300">
      

      <div className="mx-auto w-full max-w-6xl animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* ── Header ───────────────────────────────────────────── */}
        <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-3">
              Bulk Post Scheduler
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 dark:bg-indigo-900/40 px-2.5 py-0.5 text-[10px] font-black text-indigo-700 dark:text-indigo-300 animate-pulse">
                TREND ALERT
              </span>
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Plan and auto-publish your Shopify content across the month</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                const dataToExport = allScheduled.length > 0 ? allScheduled : scheduledPosts;
                const csvData = dataToExport.map(p => ({
                  title: p.title,
                  content: p.content || "",
                  scheduledAt: p.scheduledAt,
                  postType: p.postType || "seo",
                  status: p.published ? "Published" : "Scheduled"
                }));
                const csv = Papa.unparse(csvData);
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                const url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", `bloglift_schedule_${new Date().toISOString().split('T')[0]}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
            >
              <Upload className="size-4 rotate-180" />
              Export CSV
            </button>
            <button onClick={() => { setSelectedDate(new Date()); setModalOpen(true); }} className="rounded-lg bg-[#17a5b4] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[#17a5b4]/20 transition-all hover:bg-[#149db0] hover:scale-[1.02]">Schedule Posts</button>
          </div>
        </div>

        {/* ── Stats ────────────────────────────────────────────── */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Scheduled", val: scheduledThisMonth, sub: `${scheduledPosts.length} in queue`, color: "text-[#17a5b4]" },
            { label: "Published", val: publishedThisMonth, sub: "On track", color: "text-emerald-500" },
            { label: "Unscheduled", val: pendingDrafts, sub: "Needs scheduling", color: "text-amber-500" },
            { label: "AI Target", val: bestHourLabel, sub: "7.1% CTR Slot", color: "text-indigo-500" },
          ].map((stat, idx) => (
            <div key={idx} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{stat.label}</p>
              <p className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-100">{stat.val}</p>
              <p className={`mt-1 text-xs font-bold ${stat.color}`}>{stat.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            
            {/* ── Calendar ─────────────────────────────────────── */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 p-6 bg-slate-50/50 dark:bg-slate-800/30">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <svg className="size-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  {now.toLocaleDateString('default', { month: 'long', year: 'numeric' })}
                </h2>
                <div className="flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-1">
                  <button onClick={() => setView('month')} className={`rounded-lg px-4 py-1.5 text-xs font-bold ${view === 'month' ? 'bg-[#17a5b4] text-white shadow-sm' : 'text-slate-500'}`}>Month</button>
                  <button onClick={() => setView('week')} className={`rounded-lg px-4 py-1.5 text-xs font-bold ${view === 'week' ? 'bg-[#17a5b4] text-white shadow-sm' : 'text-slate-500'}`}>Week</button>
                </div>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-7 gap-2">
                  {days.map(day => (
                    <div key={day} className="py-2 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">{day}</div>
                  ))}
                  {displayDates.map((date, i) => (
                    <div key={i} onClick={() => openScheduleOnDate(date.day, date.isCurrentMonth)} className={`group relative min-h-[90px] cursor-pointer rounded-xl border p-2 transition-all ${date.isCurrentMonth ? date.isToday ? 'border-[#17a5b4] bg-[#17a5b4]/5' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-[#17a5b4] hover:bg-slate-50 dark:hover:bg-slate-800/50' : 'opacity-20 cursor-default'} ${view === 'week' ? 'min-h-[140px]' : ''}`}>
                      <span className={`text-sm font-black ${date.isToday ? 'text-[#17a5b4]' : 'text-slate-700 dark:text-slate-300'}`}>{date.day}</span>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {date.events?.map((evt, idx) => (
                          <div key={idx} className={`h-2.5 w-2.5 rounded-full ${evt.color} shadow-sm animate-in zoom-in`} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-800 px-6 py-4 flex gap-6 bg-slate-50/30 dark:bg-slate-800/20">
                {displayLegend.map(item => (
                  <div key={item.type} className="flex items-center gap-2">
                    <div className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{item.type}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Upcoming Queue ───────────────────────────────── */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
              <div className="border-b border-slate-200 dark:border-slate-800 p-6 flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Upcoming Content</h2>
                <button className="text-xs font-black uppercase tracking-widest text-[#17a5b4]">View All →</button>
              </div>
              <div className="divide-y divide-slate-200 dark:divide-slate-800 px-6">
                {scheduledPosts.length === 0 && <div className="py-8 text-center text-sm text-slate-500">No scheduled content.</div>}
                {scheduledPosts.slice(0, 5).map(post => (
                  <div key={post.id} className="group flex items-center justify-between py-5">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#17a5b4]/10 border border-[#17a5b4]/20 text-[#17a5b4]">
                        <FileText className="size-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{post.title}</p>
                        <p className="text-xs text-slate-500">{new Date(post.scheduledAt).toLocaleDateString()} · {post.postType.toUpperCase()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => {
                          setEditingPost(post);
                          setSelectedDraftId(post.id);
                          setModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 shadow-sm transition-all hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-[#17a5b4] active:scale-[0.98]"
                      >
                        <Pencil className="size-3.5" />
                        Edit
                      </button>
                      <button 
                        onClick={() => {
                          if (confirm("Remove this post from the schedule?")) {
                            fetcher.submit({ intent: "deleteScheduled", id: post.id }, { method: "post" });
                          }
                        }}
                        className="inline-flex items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-600 transition-all duration-200"
                        title="Unschedule"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Sidebar ────────────────────────────────────────── */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="size-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 flex items-center justify-center"><Sparkles className="size-4" /></div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100">Trend Alerts</h3>
              </div>
              <div className="rounded-xl bg-indigo-50/50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/10 p-4">
                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Trending</p>
                <p className="mt-1 text-sm font-bold">Summer Skincare Routine</p>
                <p className="mt-1 text-xs text-slate-500">Search volume up 45% this week.</p>
                <button 
                  onClick={() => navigate(`/app/editor?new=1&title=${encodeURIComponent("Summer Skincare Routine")}`)}
                  className="mt-4 w-full rounded-xl bg-white dark:bg-slate-800 py-3 text-xs font-bold border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-750 transition-all active:scale-[0.98] text-[#17a5b4]"
                >
                  Draft post
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-4">Auto-Publish Rules</h3>
              <div className="space-y-5">
                {["SEO", "Promo", "Seasonal"].map((type) => (
                  <div key={type} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{type} Posts</p>
                      <p className="text-xs text-slate-500">Auto-queue enabled</p>
                    </div>
                    <button 
                      onClick={() => {
                        const currentlyEnabled = isRuleEnabled(type.toLowerCase());
                        fetcher.submit({ intent: "saveRule", postType: type.toLowerCase(), enabled: (!currentlyEnabled).toString() }, { method: "post" });
                      }}
                      className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors ${!isRuleEnabled(type.toLowerCase()) ? 'bg-slate-200 dark:bg-slate-700' : 'bg-[#17a5b4]'}`}
                    >
                      <span className={`${!isRuleEnabled(type.toLowerCase()) ? 'translate-x-1' : 'translate-x-5'} inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal ────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-8 shadow-2xl animate-in zoom-in-95">
            <div className="mb-6 flex justify-between items-center">
              <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                {editingPost ? "Edit Scheduled Post" : "Schedule Content"}
              </h2>
              <button onClick={() => { setModalOpen(false); setEditingPost(null); }} className="text-slate-400 hover:text-slate-600 transition-colors">✕</button>
            </div>
            
            <fetcher.Form method="post" className="space-y-6">
              <input type="hidden" name="intent" value={editingPost ? "updateSchedule" : "schedule"} />
              {editingPost && <input type="hidden" name="id" value={editingPost.id} />}
              
              {!editingPost && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Select Draft or Placeholder</label>
                  <select name="id" value={selectedDraftId} onChange={(e) => {
                    setSelectedDraftId(e.target.value);
                    setGeneratedTitle("");
                  }} className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-[#17a5b4]/50 transition-all">
                    <option value="">-- Choose an existing draft --</option>
                    <option value="new" className="text-[#17a5b4] font-black tracking-wide">+ Create New Placeholder</option>
                    {drafts?.map(d => <option key={d.id} value={d.id}>{d.title || 'Untitled Draft'}</option>)}
                  </select>
                </div>
              )}

              {editingPost && (
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Editing Schedule for</p>
                  <p className="text-sm font-black text-slate-900 dark:text-slate-100">{editingPost.title}</p>
                </div>
              )}

              {selectedDraftId === "new" && (
                <div className="space-y-4 animate-in slide-in-from-top-4 duration-300">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Target Blog</label>
                    <select name="blogId" required className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-sm font-bold outline-none">
                      {blogs.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Content Title</label>
                      <button 
                        type="button"
                        disabled={isGenerating}
                        onClick={async () => {
                          const apiKey = localStorage.getItem(LS_OPENROUTER);
                          if (!apiKey) {
                            setShowKeyModal(true);
                            return;
                          }
                          setIsGenerating(true);
                          try {
                            const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                              method: "POST",
                              headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
                              body: JSON.stringify({
                                model: "google/gemini-flash-1.5",
                                messages: [{ role: "user", content: "Suggest one catchy, SEO-optimized blog title about a trending topic. Return only the title text, nothing else." }]
                              })
                            });
                            const json = await res.json();
                            const title = json.choices?.[0]?.message?.content?.replace(/^"|"$/g, '') || "New Trending Post";
                            setGeneratedTitle(title);
                          } catch (err) {
                            setToast({ msg: "AI Generation failed", type: "error" });
                          } finally {
                            setIsGenerating(false);
                          }
                        }}
                        className="flex items-center gap-1.5 text-[10px] font-black text-[#17a5b4] hover:underline uppercase tracking-wider disabled:opacity-50"
                      >
                        {isGenerating ? <Loader2 className="size-3 animate-spin" /> : <Wand2 className="size-3" />}
                        Generate with AI
                      </button>
                    </div>
                    <input 
                      type="text" 
                      name="title" 
                      required 
                      value={generatedTitle}
                      onChange={(e) => setGeneratedTitle(e.target.value)}
                      placeholder="e.g. 10 Best Summer Fashion Trends..." 
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-sm font-bold outline-none focus:bg-white dark:focus:bg-slate-900 transition-colors" 
                    />
                  </div>
                </div>
              )}

              {selectedDraftId && (
                <div className="group relative rounded-2xl bg-emerald-50/50 dark:bg-emerald-500/5 p-4 border border-emerald-100 dark:border-emerald-500/20 transition-all hover:bg-emerald-50 dark:hover:bg-emerald-500/10">
                  <div className="flex items-center gap-4">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500 shadow-lg shadow-emerald-500/20 text-white">
                      <Zap className="size-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-widest">AI Performance Optimization</p>
                      <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Saturday @ 6 PM <span className="ml-1 opacity-70">(+7.1% predicted CTR)</span></p>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + (6 + 7 - d.getDay()) % 7 || 7);
                        d.setHours(18, 0, 0, 0);
                        const input = document.getElementsByName("scheduledAt")[0];
                        if (input) input.value = d.toISOString().slice(0, 16);
                      }} 
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black text-white uppercase tracking-wider shadow-md shadow-emerald-600/20 transition-all hover:bg-emerald-700 active:scale-95"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Publish Date</label>
                  <div className="relative">
                    <input type="datetime-local" name="scheduledAt" required defaultValue={selectedDate ? selectedDate.toISOString().slice(0, 16) : ""} className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-sm font-bold outline-none focus:bg-white dark:focus:bg-slate-900 transition-colors" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Post Type</label>
                  <select name="postType" defaultValue={editingPost?.postType || "seo"} className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-sm font-bold outline-none">
                    <option value="seo">SEO Focus</option>
                    <option value="promo">Promotional</option>
                    <option value="seasonal">Seasonal</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <button type="submit" disabled={fetcher.state !== "idle" || (!selectedDraftId && !editingPost)} className="w-full rounded-2xl bg-[#17a5b4] py-4 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-[#17a5b4]/30 hover:bg-[#149db0] hover:shadow-[#149db0]/40 disabled:opacity-50 transition-all active:scale-[0.98]">
                  {fetcher.state !== "idle" ? "Saving..." : editingPost ? "Update Schedule" : "Schedule Post Now"}
                </button>
                <button type="button" onClick={() => { setModalOpen(false); setEditingPost(null); }} className="py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">Discard Changes</button>
              </div>
            </fetcher.Form>
          </div>
        </div>
      )}

      {/* ── Toast ────────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 rounded-2xl px-6 py-4 shadow-2xl backdrop-blur-xl border border-white/10 transition-all animate-in slide-in-from-bottom-4 duration-300 ${toast.type === "success" ? "bg-slate-900/90 text-emerald-400" : "bg-rose-950/90 text-rose-200"}`}>
          <div className={`flex size-5 items-center justify-center rounded-full ${toast.type === "success" ? "bg-emerald-500/20 text-emerald-500" : "bg-rose-500/20 text-rose-400"}`}>
            {toast.type === "success" ? <CheckCircle2 className="size-3.5" /> : <X className="size-3.5" />}
          </div>
          <span className="text-xs font-black uppercase tracking-widest">{toast.msg}</span>
          <button onClick={() => setToast(null)} className="ml-4 flex size-5 items-center justify-center rounded-full hover:bg-white/10 transition-colors">✕</button>
        </div>
      )}

      {/* ── API Key Modal ────────────────────────────────────── */}
      {showKeyModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-8 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95">
            <div className="mb-6 flex items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-[#17a5b4]/10 text-[#17a5b4]">
                <Wand2 className="size-6" />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100">AI Configuration</h2>
                <p className="text-xs font-bold text-slate-500">Enable magic title generation</p>
              </div>
            </div>
            
            <p className="mb-6 text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
              To use AI features, please enter your OpenRouter API key. It's stored safely in your browser.
            </p>

            <div className="space-y-4">
              <div className="relative">
                <input
                  type="password"
                  value={tempKey}
                  onChange={(e) => setTempKey(e.target.value)}
                  placeholder="sk-or-v1-..."
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-[#17a5b4]/50"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowKeyModal(false)}
                  className="rounded-2xl bg-slate-100 dark:bg-slate-800 py-4 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (tempKey.trim()) {
                      localStorage.setItem(LS_OPENROUTER, tempKey.trim());
                      setShowKeyModal(false);
                      setToast({ msg: "API Key Saved! Try generating now.", type: "success" });
                    }
                  }}
                  className="rounded-2xl bg-[#17a5b4] py-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-[#17a5b4]/30 hover:bg-[#149db0] transition-all"
                >
                  Save Key
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SchedulerPage;
