import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Search, X, Loader2,
  Building2, Briefcase, FileText, Receipt,
  FileCheck, BookOpen, Users, ClipboardList,
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

const TYPE_CONFIG: Record<string, { icon: React.ComponentType<any>; color: string; label: string }> = {
  client:           { icon: Building2,     color: "text-blue-600",   label: "Clients" },
  job:              { icon: Briefcase,     color: "text-green-600",  label: "Jobs" },
  quote:            { icon: FileText,      color: "text-purple-600", label: "Quotes / Leads" },
  invoice:          { icon: Receipt,       color: "text-amber-600",  label: "Invoices" },
  service_contract: { icon: FileCheck,     color: "text-teal-600",   label: "Service Contracts" },
  rental_contract:  { icon: ClipboardList, color: "text-indigo-600", label: "Rental Contracts" },
  field_diary:      { icon: BookOpen,      color: "text-orange-600", label: "Field Diaries" },
  staff:            { icon: Users,         color: "text-gray-600",   label: "Staff" },
};

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
  const inputRef                        = useRef<HTMLInputElement>(null);
  const containerRef                    = useRef<HTMLDivElement>(null);
  const [, navigate]                    = useLocation();

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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

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
    if (!open || flat.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(i => (i + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(i => (i - 1 + flat.length) % flat.length);
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(flat[activeIndex]);
    }
  }

  const showDropdown = open && query.length >= 2;

  return (
    <div className="relative" ref={containerRef}>
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
              {groups.map(([type, items]) => {
                const cfg = TYPE_CONFIG[type] ?? { icon: FileText, color: "text-gray-500", label: type };
                const Icon = cfg.icon;
                return (
                  <div key={type}>
                    <div className="px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400 select-none">
                      {cfg.label}
                    </div>
                    {items.map(result => {
                      const flatIdx = flat.findIndex(r => r.id === result.id && r.type === result.type);
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
            </div>
          )}
          {isFetching && results.length > 0 && (
            <div className="border-t border-gray-100 px-3 py-1.5 flex items-center gap-1.5 text-xs text-gray-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              Updating results…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
