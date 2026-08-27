import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Search, X, Loader2,
  Building2, Briefcase, FileText, Receipt, UserPlus,
  FileCheck, BookOpen, Users, ClipboardList, History,
} from "lucide-react";

interface SearchResult {
  type: string;
  id: string;
  label: string;
  sublabel: string;
  url: string;
}

interface SearchResponse {
  results: SearchResult[];
}

const RECENT_SEARCHES_KEY = "global-search-recents";
const MAX_RECENT_SEARCHES = 5;

const TYPE_CONFIG: Record<string, { icon: React.ComponentType<any>; color: string; label: string }> = {
  client:           { icon: Building2,     color: "text-blue-600",   label: "Clients" },
  job:              { icon: Briefcase,     color: "text-green-600",  label: "Jobs" },
  quote:            { icon: FileText,      color: "text-purple-600", label: "Quotes" },
  lead:             { icon: UserPlus,      color: "text-cyan-600",   label: "Leads" },
  invoice:          { icon: Receipt,       color: "text-amber-600",  label: "Invoices" },
  service_contract: { icon: FileCheck,     color: "text-teal-600",   label: "Service Contracts" },
  rental_contract:  { icon: ClipboardList, color: "text-indigo-600", label: "Rental Contracts" },
  field_diary:      { icon: BookOpen,      color: "text-orange-600", label: "Field Diaries" },
  staff:            { icon: Users,         color: "text-gray-600",   label: "Staff" },
};

function isSearchResult(value: unknown): value is SearchResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<SearchResult>;
  return [result.type, result.id, result.label, result.sublabel, result.url]
    .every(field => typeof field === "string");
}

function loadRecentSearches(): SearchResult[] {
  try {
    const stored = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) ?? "[]");
    return Array.isArray(stored)
      ? stored.filter(isSearchResult).slice(0, MAX_RECENT_SEARCHES)
      : [];
  } catch {
    return [];
  }
}

function groupResults(results: SearchResult[]): [string, SearchResult[]][] {
  const map = new Map<string, SearchResult[]>();
  for (const r of results) {
    if (!map.has(r.type)) map.set(r.type, []);
    map.get(r.type)!.push(r);
  }
  return Array.from(map.entries());
}

export default function GlobalSearch() {
  const [query, setQuery]               = useState("");
  const [debouncedQuery, setDebounced]  = useState("");
  const [open, setOpen]                 = useState(false);
  const [activeIndex, setActiveIndex]   = useState(-1);
  const [recentSearches, setRecentSearches] = useState<SearchResult[]>([]);
  const inputRef                        = useRef<HTMLInputElement>(null);
  const mobileInputRef                  = useRef<HTMLInputElement>(null);
  const containerRef                    = useRef<HTMLDivElement>(null);
  const [, navigate]                    = useLocation();

  useEffect(() => {
    setRecentSearches(loadRecentSearches());
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isFetching } = useQuery<SearchResponse>({
    queryKey: [`/api/search?q=${encodeURIComponent(debouncedQuery)}`],
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  });

  const results = data?.results ?? [];
  const groups  = groupResults(results);
  const flat    = groups.flatMap(([, items]) => items);
  const displayedGroups: [string, SearchResult[]][] =
    query.length === 0 ? [["recent", recentSearches]] : groups;
  const displayedFlat = displayedGroups.flatMap(([, items]) => items);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!open) return;

    const focusInput = () => {
      if (window.matchMedia("(max-width: 639px)").matches) {
        mobileInputRef.current?.focus();
      } else {
        inputRef.current?.focus();
      }
    };
    const timer = window.setTimeout(focusInput, 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleSelect(result: SearchResult) {
    setRecentSearches(previous => {
      const updated = [
        result,
        ...previous.filter(item => item.type !== result.type || item.id !== result.id),
      ].slice(0, MAX_RECENT_SEARCHES);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      } catch {
        // Keep the in-memory recents available if browser storage is unavailable.
      }
      return updated;
    });
    navigate(result.url);
    setOpen(false);
    setQuery("");
    setDebounced("");
    setActiveIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      inputRef.current?.blur();
      return;
    }
    if (!open || displayedFlat.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(i => (i + 1) % displayedFlat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(i => (i - 1 + displayedFlat.length) % displayedFlat.length);
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(displayedFlat[activeIndex]);
    }
  }

  const showRecents = open && query.length === 0 && recentSearches.length > 0;
  const showDropdown = open && (query.length >= 2 || showRecents);

  function renderResults() {
    return (
      <>
        {isFetching && results.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching…
          </div>
        ) : results.length === 0 && debouncedQuery.length >= 2 ? (
          <div className="py-8 text-center text-sm text-gray-400">
            No results for <span className="font-medium text-gray-600">"{debouncedQuery}"</span>
          </div>
        ) : (
          <div className="max-h-[440px] overflow-y-auto py-1">
            {displayedGroups.map(([type, items]) => {
              const cfg = type === "recent"
                ? { icon: History, color: "text-gray-500", label: "Recent" }
                : TYPE_CONFIG[type] ?? { icon: FileText, color: "text-gray-500", label: type };
              const Icon = cfg.icon;
              return (
                <div key={type}>
                  <div className="px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400 select-none">
                    {cfg.label}
                  </div>
                  {items.map(result => {
                    const flatIdx = displayedFlat.findIndex(r => r.id === result.id && r.type === result.type);
                    const isActive = flatIdx === activeIndex;
                    return (
                      <button
                        key={`${result.type}-${result.id}`}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${isActive ? "bg-blue-50" : "hover:bg-gray-50"}`}
                        onClick={() => handleSelect(result)}
                        onMouseEnter={() => setActiveIndex(flatIdx)}
                      >
                        <Icon className={`h-3.5 w-3.5 shrink-0 ${cfg.color}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate leading-tight">{result.label}</p>
                          {result.sublabel && (
                            <p className="text-xs text-gray-500 truncate leading-tight">{result.sublabel}</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
            {showRecents && (
              <button
                type="button"
                className="w-full border-t border-gray-100 px-3 py-2 text-left text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                onClick={() => {
                  setRecentSearches([]);
                  setActiveIndex(-1);
                  try {
                    localStorage.removeItem(RECENT_SEARCHES_KEY);
                  } catch {
                    // Ignore storage errors; the visible list is already cleared.
                  }
                }}
              >
                Clear recents
              </button>
            )}
          </div>
        )}
        {isFetching && results.length > 0 && (
          <div className="border-t border-gray-100 px-3 py-1.5 flex items-center gap-1.5 text-xs text-gray-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            Updating results…
          </div>
        )}
      </>
    );
  }

  return (
    <div className="relative w-9 sm:w-auto" ref={containerRef}>
      <div className="hidden sm:block">
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); setActiveIndex(-1); }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search… (⌘K)"
            aria-label="Global search"
            className="w-44 lg:w-60 h-8 pl-8 pr-7 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all placeholder:text-gray-400"
          />
          {query && (
            <button
              className="absolute right-2 text-gray-400 hover:text-gray-600 transition-colors"
              onClick={() => { setQuery(""); setDebounced(""); setActiveIndex(-1); inputRef.current?.focus(); }}
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {showDropdown && (
          <div className="absolute top-full mt-1.5 left-0 w-96 max-w-[90vw] bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
            {renderResults()}
          </div>
        )}
      </div>

      <button
        type="button"
        className="sm:hidden flex items-center justify-center w-9 h-9 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
        onClick={() => setOpen(true)}
        aria-label="Open global search"
        data-testid="mobile-search-toggle"
      >
        <Search className="h-[18px] w-[18px]" />
      </button>

      {open && (
        <div className="fixed inset-x-0 top-0 z-[60] bg-white border-b border-gray-200 shadow-lg sm:hidden">
          <div className="flex items-center gap-2 h-14 px-3">
            <Search className="h-4 w-4 shrink-0 text-gray-400" />
            <input
              ref={mobileInputRef}
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setActiveIndex(-1); }}
              onKeyDown={handleKeyDown}
              placeholder="Search…"
              aria-label="Global search"
              className="min-w-0 flex-1 h-9 text-base bg-transparent focus:outline-none placeholder:text-gray-400"
            />
            {query && (
              <button
                type="button"
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                onClick={() => { setQuery(""); setDebounced(""); setActiveIndex(-1); mobileInputRef.current?.focus(); }}
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              className="p-1 text-gray-500 hover:text-gray-800 transition-colors"
              onClick={() => { setOpen(false); setActiveIndex(-1); mobileInputRef.current?.blur(); }}
              aria-label="Close search"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {showDropdown && (
            <div className="max-h-[calc(100vh-3.5rem)] overflow-y-auto border-t border-gray-100">
              {renderResults()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
