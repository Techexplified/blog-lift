import React, { useState, useMemo, useCallback } from "react";
import { 
  X, 
  RefreshCw, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  BarChart3,
  Zap,
  Image,
  Undo2
} from "lucide-react";
import { useTheme } from "./ThemeProvider";

export default function ProductLinkerOverlay({ 
  isOpen, 
  onClose, 
  products = [], 
  content = "", 
  onUpdateContent,
  isSyncing,
  onSync,
  shopUrl,
  stats = null
}) {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [dismissedIds, setDismissedIds] = useState(new Set());
  const [history, setHistory] = useState([]);

  // Reset suggestions when opening the overlay
  React.useEffect(() => {
    if (isOpen) {
      setDismissedIds(new Set());
    }
  }, [isOpen]);

  // Save current state to history before an update
  const updateWithHistory = useCallback((newHtml) => {
    setHistory(prev => [...prev, content].slice(-5)); // Keep last 5 states
    onUpdateContent(newHtml);
  }, [content, onUpdateContent]);

  const undo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    onUpdateContent(previous);
  };

  // Helper to remove a redundant mention safely using DOM manipulation
  const removeRedundantMention = useCallback((html, product) => {
    const container = document.createElement('div');
    container.innerHTML = html;
    
    // Find all links for this product
    const links = container.querySelectorAll(`a[data-product-id="${product.id}"]`);
    if (links.length > 0) {
      const lastLink = links[links.length - 1];
      const textNode = document.createTextNode(lastLink.textContent);
      lastLink.parentNode.replaceChild(textNode, lastLink);
      return container.innerHTML;
    }
    return html;
  }, []);

  // Helper to link a mention safely
  const linkMention = useCallback((html, product) => {
    const container = document.createElement('div');
    container.innerHTML = html;

    const title = product.title;
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[\s-]/g, '[\\s-]*');
    const url = `https://${shopUrl}/products/${product.handle}`;
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    
    let replaced = false;

    const walk = (node) => {
      if (replaced) return;
      if (node.nodeType === 3) { // Text node
        const text = node.nodeValue;
        const parent = node.parentNode;
        if (parent.tagName === 'A' || parent.closest('a')) return;

        const match = regex.exec(text);
        if (match) {
          replaced = true;
          const fragment = document.createDocumentFragment();
          fragment.appendChild(document.createTextNode(text.slice(0, match.index)));
          
          const a = document.createElement('a');
          a.href = url;
          a.className = "product-link";
          a.style.cssText = "color:#17a5b4; text-decoration:underline; font-weight:600;";
          a.setAttribute('data-product-id', product.id);
          a.textContent = match[0];
          fragment.appendChild(a);
          
          fragment.appendChild(document.createTextNode(text.slice(match.index + match[0].length)));
          parent.replaceChild(fragment, node);
        }
      } else {
        if (node.tagName === 'A') return;
        const children = Array.from(node.childNodes);
        children.forEach(walk);
      }
    };

    walk(container);
    return container.innerHTML;
  }, [shopUrl]);

  // Dynamic AI Suggestions logic
  const aiSuggestions = useMemo(() => {
    if (!content || products.length === 0) return [];
    
    const doc = new DOMParser().parseFromString(content, 'text/html');
    const text = doc.body.innerText;
    const suggestionsList = [];

    products.forEach(p => {
      const title = p.title;
      if (title.length < 3) return;

      const linkCount = (content.match(new RegExp(`data-product-id="${p.id}"`, 'g')) || []).length;
      const suggestionId = `${p.id}-${linkCount > 2 ? 'over' : 'unlinked'}`;

      if (dismissedIds.has(suggestionId)) return;

      // 1. Over-optimization check
      if (linkCount > 2) {
        suggestionsList.push({
          id: suggestionId,
          type: 'warning',
          title: 'Over-optimization detected',
          description: `"${title}" is linked ${linkCount} times.`,
          actionText: 'Remove redundant link',
          onAction: () => {
            updateWithHistory(removeRedundantMention(content, p));
          }
        });
        return;
      }

      // 2. Unlinked mention check
      const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[\\s-]/g, '[\\s-]*');
      const textRegex = new RegExp(`\\b${escaped}\\b`, 'gi');
      
      if (textRegex.test(text)) {
        const isLinked = content.includes(`data-product-id="${p.id}"`);
        if (!isLinked) {
          suggestionsList.push({
            id: suggestionId,
            type: 'mention',
            title: 'Unlinked mention detected',
            description: `"${title}" was found but isn't linked.`,
            actionText: 'Link it',
            onAction: () => {
              updateWithHistory(linkMention(content, p));
            }
          });
        }
      }
    });

    // 3. Upsell opportunity
    if (suggestionsList.length === 0) {
      const lowerContent = content.toLowerCase();
      const unusedProducts = products.filter(p => !lowerContent.includes(p.title.toLowerCase()));
      if (unusedProducts.length > 0) {
        const p = unusedProducts[0];
        const suggestionId = `upsell-${p.id}`;
        if (!dismissedIds.has(suggestionId)) {
          suggestionsList.push({
            id: suggestionId,
            type: 'upsell',
            title: 'Upsell opportunity',
            description: `Readers also love ${p.title}. Add a mention?`,
            actionText: 'Add mention',
            onAction: () => {
              updateWithHistory(content + `<p>Pro tip: Check out our <a href="https://${shopUrl}/products/${p.handle}" style="color:#17a5b4; text-decoration:underline; font-weight:600;" data-product-id="${p.id}">${p.title}</a>.</p>`);
            }
          });
        }
      }
    }

    return suggestionsList;
  }, [content, products, shopUrl, updateWithHistory, dismissedIds, linkMention, removeRedundantMention]);

  const autoLinkAll = () => {
    const container = document.createElement('div');
    container.innerHTML = content;

    const sortedProducts = [...products].sort((a, b) => b.title.length - a.title.length);

    const walk = (node) => {
      if (node.nodeType === 3) { // Text node
        let text = node.nodeValue;
        let parent = node.parentNode;
        
        // Skip if already inside a link or a tag we shouldn't touch
        if (parent.tagName === 'A' || parent.closest('a')) return;

        let lastIndex = 0;
        const fragment = document.createDocumentFragment();

        // This is complex for all products at once in one text node.
        // For simplicity and correctness, we'll build a single regex for ALL products.
        const patterns = sortedProducts.map(p => {
          const escaped = p.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[\s-]/g, '[\\s-]*');
          return `(?<p${p.id.replace(/[^a-zA-Z0-9]/g, '')}>\\b${escaped}\\b)`;
        }).join('|');

        if (!patterns) return;

        const regex = new RegExp(patterns, 'gi');
        let match;
        let hasMatch = false;

        while ((match = regex.exec(text)) !== null) {
          hasMatch = true;
          // Add text before match
          fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
          
          // Find which product matched
          const matchedGroup = Object.entries(match.groups || {}).find(([, v]) => v !== undefined);
          if (matchedGroup) {
            const productIdPart = matchedGroup[0].slice(1);
            const product = sortedProducts.find(p => p.id.replace(/[^a-zA-Z0-9]/g, '') === productIdPart);
            
            if (product) {
              const a = document.createElement('a');
              a.href = `https://${shopUrl}/products/${product.handle}`;
              a.className = "product-link";
              a.style.cssText = "color:#17a5b4; text-decoration:underline; font-weight:600;";
              a.setAttribute('data-product-id', product.id);
              a.textContent = match[0];
              fragment.appendChild(a);
            } else {
              fragment.appendChild(document.createTextNode(match[0]));
            }
          } else {
             fragment.appendChild(document.createTextNode(match[0]));
          }
          lastIndex = regex.lastIndex;
        }

        if (hasMatch) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
          parent.replaceChild(fragment, node);
        }
      } else {
        // Don't walk into existing links
        if (node.tagName === 'A') return;
        const children = Array.from(node.childNodes);
        children.forEach(walk);
      }
    };

    walk(container);
    updateWithHistory(container.innerHTML);
  };

  const dismissSuggestion = (id) => {
    setDismissedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  // UI helpers
  const linkedCount = useMemo(() => {
    if (!content) return 0;
    return products.filter(p => content.includes(`data-product-id="${p.id}"`)).length;
  }, [content, products]);

  const progressPercent = products.length > 0 ? Math.round((linkedCount / products.length) * 100) : 0;

  const totalLinks = useMemo(() => {
    if (!content) return 0;
    return (content.match(/data-product-id="/g) || []).length;
  }, [content]);

  const displayStats = useMemo(() => {
    if (stats) return stats;
    
    // Simulate smart performance metrics based on actual linking data
    // This gives the user immediate feedback on their progress
    const ctr = linkedCount > 0 ? (1.2 + (linkedCount * 0.8)).toFixed(1) : "0.0";
    const conversions = Math.floor(linkedCount * 0.5);
    const revenue = conversions * 1250; // Simulated revenue per conversion
    
    return [
      { label: "Predicted CTR", val: `${ctr}%`, progress: parseFloat(ctr) * 10, color: "bg-teal-500" },
      { label: "Est. Monthly Conversions", val: conversions.toString(), progress: conversions * 20, color: "bg-indigo-500" },
      { label: "Potential Revenue", val: `₹${revenue.toLocaleString()}`, progress: (revenue / 10000) * 100, color: "bg-emerald-500" },
      { label: "Total Links Embedded", val: `${totalLinks} links`, progress: (totalLinks / 8) * 100, color: "bg-orange-500" },
    ];
  }, [stats, linkedCount, totalLinks]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans overflow-hidden animate-in fade-in duration-300">
      
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex h-16 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 px-6 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#17a5b4] shadow-lg shadow-[#17a5b4]/20">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">Smart Product Linker</h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-black">AI detects product mentions in your blog and embeds shoppable links automatically</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={undo}
            disabled={history.length === 0}
            className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <Undo2 className="h-3.5 w-3.5" />
            Undo
          </button>
          <button 
            onClick={() => {
              setDismissedIds(new Set());
              onSync();
            }}
            disabled={isSyncing}
            className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? "Syncing..." : "Sync Products"}
          </button>
          <button 
            onClick={autoLinkAll}
            className="rounded-lg bg-[#17a5b4] px-5 py-2 text-xs font-black text-white shadow-lg shadow-[#17a5b4]/20 transition hover:bg-[#149db0] hover:scale-[1.02]"
          >
            Auto-link All
          </button>
          <button 
            onClick={onClose}
            className="ml-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        
        {/* ── Left Content (Editor Preview) ───────────────────── */}
        <div className="flex flex-1 flex-col overflow-hidden border-r border-slate-200 dark:border-slate-800">
          <div className="flex h-12 items-center border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Blog post — currently editing</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-8 lg:p-12 bg-white dark:bg-slate-900">
            <div className="mx-auto max-w-3xl">
              <div 
                className="prose dark:prose-invert prose-slate prose-teal max-w-none"
                dangerouslySetInnerHTML={{ __html: content }}
              />
              
              <div className="mt-16">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Your Shopify products</h3>
                  <span className="text-[10px] font-bold text-slate-400">{products.length} total · {linkedCount} linked</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {products.map(p => {
                    const isLinked = content.includes(`data-product-id="${p.id}"`);
                    return (
                      <div 
                        key={p.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedProduct(p)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedProduct(p); }}
                        className={`group relative flex cursor-pointer items-center gap-4 rounded-2xl border p-4 transition-all ${selectedProduct?.id === p.id ? 'border-[#17a5b4] bg-[#17a5b4]/5 ring-1 ring-[#17a5b4]' : 'border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-800'}`}
                      >
                        <div className="h-14 w-14 overflow-hidden rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                          {p.image ? <img src={p.image} alt={p.title} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-slate-300 dark:text-slate-600"><Image className="h-6 w-6" /></div>}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{p.title}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">₹{p.price} · {p.inventory} in stock</p>
                        </div>
                        <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${isLinked ? 'bg-teal-500 border-teal-500' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'}`}>
                          {isLinked && <CheckCircle2 className="h-3 w-3 text-white" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Panel (Analytics & Suggestions) ──────────── */}
        <div className="w-80 overflow-y-auto bg-slate-50/80 dark:bg-slate-900/80 p-6 lg:w-96">
          
          {/* Link Performance */}
          <div className="mb-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400">
                <BarChart3 className="h-4 w-4" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100">Link performance</h3>
            </div>
            
            <div className="space-y-6">
              {displayStats.map((s, idx) => (
                <div key={idx}>
                  <div className="mb-2 flex justify-between text-xs font-bold">
                    <span className="text-slate-500">{s.label}</span>
                    <span className="text-slate-900">{s.val}</span>
                  </div>
                  {s.progress !== null && (
                    <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className={`h-full rounded-full ${s.color || 'bg-teal-500'}`} style={{ width: `${s.progress}%` }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">AI suggestions</h3>
              {dismissedIds.size > 0 && (
                <button 
                  onClick={() => setDismissedIds(new Set())}
                  className="text-[10px] font-bold text-[#17a5b4] hover:underline"
                >
                  Reset
                </button>
              )}
            </div>
            
            <div className="space-y-4">
              {aiSuggestions.length > 0 ? aiSuggestions.map((s, idx) => (
                <div key={idx} className={`rounded-2xl border p-5 ${s.type === 'upsell' ? 'border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/30 dark:bg-indigo-900/10' : s.type === 'warning' ? 'border-rose-100 dark:border-rose-900/30 bg-rose-50/30 dark:bg-rose-900/10' : 'border-teal-100 dark:border-teal-900/30 bg-teal-50/30 dark:bg-teal-900/10'}`}>
                  <div className={`mb-3 flex items-center gap-2 ${s.type === 'upsell' ? 'text-indigo-600 dark:text-indigo-400' : s.type === 'warning' ? 'text-rose-600 dark:text-rose-400' : 'text-teal-600 dark:text-teal-400'}`}>
                    {s.type === 'upsell' ? <TrendingUp className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    <span className="text-[10px] font-black uppercase tracking-widest">{s.title}</span>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-600 mb-4">{s.description}</p>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => s.onAction && s.onAction()}
                      className={`flex-1 rounded-lg py-2 text-[10px] font-black uppercase tracking-widest text-white shadow-sm transition ${s.type === 'upsell' ? 'bg-indigo-500 hover:bg-indigo-600' : s.type === 'warning' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-teal-500 hover:bg-teal-600'}`}>
                      {s.actionText || 'Apply'}
                    </button>
                    <button 
                      onClick={() => dismissSuggestion(s.id)}
                      className="rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center bg-white/50 dark:bg-slate-900/50">
                  <Sparkles className="h-8 w-8 text-slate-200 dark:text-slate-800 mx-auto mb-3" />
                  <p className="text-xs text-slate-400 font-medium italic">No new AI suggestions for this post yet.</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <div className="mb-4 flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
              <span>Post linking status</span>
              <span className="text-teal-600 font-black">{progressPercent}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 mb-6">
              <div className="h-full rounded-full bg-teal-500 shadow-sm shadow-teal-500/20 transition-all duration-500" style={{ width: `${progressPercent}%` }} />
            </div>
            <button 
              onClick={onClose}
              className="w-full rounded-xl bg-slate-900 dark:bg-slate-800 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg transition hover:bg-slate-800 dark:hover:bg-slate-700"
            >
              Back to Editor
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
