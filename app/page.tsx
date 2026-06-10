"use client";

import { useQuery } from "@tanstack/react-query";
import { Lock, Scroll, Search, Loader2, BookOpen } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchJsonOrThrow } from "@/lib/fetch-json";

interface PublicSharePage {
  noteId: string;
  title: string;
  contentHtml: string;
  dateModified: string;
}

interface SearchResult {
  id: string;
  title: string;
  score: number;
  path: string;
}

export default function PublicHomePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError } = useQuery<PublicSharePage>({
    queryKey: ["public-lore"],
    queryFn: () => fetchJsonOrThrow("/api/public/lore"),
    retry: false,
  });

  const { data: publishedNotes, isLoading: isNotesLoading } = useQuery<{ results: SearchResult[] }>({
    queryKey: ["public-lore-list"],
    queryFn: () => fetchJsonOrThrow("/api/public/search?q=%23lore"),
    retry: false,
  });

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetchJsonOrThrow<{ results: SearchResult[] }>(
          `/api/public/search?q=${encodeURIComponent(searchQuery)}`
        );
        setSearchResults(response.results || []);
        setShowDropdown(true);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchResultClick = (shareId: string) => {
    router.push(`/public/lore/${shareId}`);
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-900 via-neutral-950 to-black text-foreground antialiased flex flex-col justify-between">
      {/* Header */}
      <header className="border-b border-primary/10 bg-black/40 backdrop-blur-md px-5 py-4 w-full">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <Scroll className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-sm font-bold uppercase tracking-[0.25em] text-primary" style={{ fontFamily: "var(--font-cinzel)" }}>
              AllCodex
            </h1>
          </div>
          <Button asChild size="sm" variant="outline" className="ml-auto gap-2 rounded-none border-primary/30 hover:border-primary hover:bg-primary/10 text-primary hover:text-primary transition-all duration-300">
            <Link href="/login">
              <Lock className="h-3.5 w-3.5" />
              Owner Login
            </Link>
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto px-5 py-12 md:py-16 w-full space-y-12">
        <div className="text-center space-y-4">
          {/* Glowing Scroll Logo */}
          <div className="relative inline-flex items-center justify-center p-6 bg-primary/5 rounded-full border border-primary/15 shadow-[0_0_50px_rgba(212,175,55,0.05)] mb-2">
            <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl animate-pulse" />
            <Scroll className="h-16 w-16 text-primary relative z-10 filter drop-shadow-[0_0_15px_rgba(212,175,55,0.4)]" />
          </div>
          
          <h2 className="text-4xl md:text-6xl font-bold tracking-[0.3em] uppercase text-primary" style={{ fontFamily: "var(--font-cinzel)" }}>
            AllCodex
          </h2>
          <p className="text-sm md:text-base text-muted-foreground uppercase tracking-[0.2em]" style={{ fontFamily: "var(--font-cinzel)" }}>
            Worldbuilding Chronicle & Lore Archive
          </p>
        </div>

        {/* Search Bar */}
        <div ref={dropdownRef} className="relative w-full max-w-xl mx-auto z-40">
          <div className="relative flex items-center bg-neutral-900/50 backdrop-blur-md border border-primary/30 rounded-none shadow-[0_0_20px_rgba(212,175,55,0.05)] focus-within:border-primary focus-within:shadow-[0_0_30px_rgba(212,175,55,0.15)] transition-all duration-500">
            <Search className="absolute left-4 h-5 w-5 text-primary/60" />
            <input
              type="text"
              placeholder="Search the archives..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              className="w-full bg-transparent pl-12 pr-12 py-4 text-base placeholder-muted-foreground/60 border-none outline-none focus:ring-0 text-foreground font-sans rounded-none"
            />
            {isSearching && (
              <Loader2 className="absolute right-4 h-5 w-5 text-primary animate-spin" />
            )}
          </div>

          {/* Search Results Dropdown */}
          {showDropdown && searchQuery.trim() !== "" && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-neutral-950/90 backdrop-blur-md border border-primary/20 shadow-[0_10px_30px_rgba(0,0,0,0.8)] overflow-hidden max-h-[300px] overflow-y-auto divide-y divide-primary/10 rounded-sm">
              {searchResults.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  {isSearching ? "Consulting the scrolls..." : "No records matching your query."}
                </div>
              ) : (
                searchResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => handleSearchResultClick(result.id)}
                    className="w-full text-left p-4 hover:bg-primary/5 flex flex-col gap-0.5 transition-colors duration-200 group"
                  >
                    <span className="text-sm font-semibold text-primary/90 group-hover:text-primary transition-colors flex items-center gap-1.5" style={{ fontFamily: "var(--font-cinzel)" }}>
                      <BookOpen className="h-3.5 w-3.5 text-primary/60" />
                      {result.title}
                    </span>
                    {result.path && (
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider pl-5">
                        {result.path}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Landing Content / Grimoire Box */}
        <div className="w-full max-w-3xl">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-1/3 bg-neutral-800" />
              <Skeleton className="h-[200px] w-full bg-neutral-800" />
            </div>
          ) : isError || !data ? (
            <div className="border border-primary/10 bg-neutral-900/20 backdrop-blur-sm p-6 text-center text-sm text-muted-foreground rounded-sm">
              Chronicle introduction is not available.
            </div>
          ) : (
            <div className="border border-primary/20 bg-neutral-900/30 backdrop-blur-md p-8 shadow-[0_4px_30px_rgba(0,0,0,0.5)] rounded-lg relative overflow-hidden group">
              {/* Gold corners design */}
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary/40 group-hover:border-primary transition-all duration-500" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary/40 group-hover:border-primary transition-all duration-500" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary/40 group-hover:border-primary transition-all duration-500" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary/40 group-hover:border-primary transition-all duration-500" />

              {data.title === "root" ? (
                <div className="space-y-4 text-center py-4">
                  <h3 className="text-2xl font-bold text-primary tracking-wider" style={{ fontFamily: "var(--font-cinzel)" }}>
                    AllCodex Archives
                  </h3>
                  <div className="h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent w-full mb-4" />
                  <p className="font-[var(--font-crimson)] text-lg md:text-xl leading-relaxed text-neutral-300">
                    Welcome to the public chronicles. Use the search bar above to look for specific entries, or browse the published lore records below.
                  </p>
                </div>
              ) : (
                <>
                  <h3 className="text-2xl font-bold text-primary mb-4 text-center tracking-wider" style={{ fontFamily: "var(--font-cinzel)" }}>
                    {data.title}
                  </h3>
                  
                  <div className="h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent w-full mb-6" />

                  <div
                    className="lore-content prose prose-invert max-w-none font-[var(--font-crimson)] text-base md:text-lg leading-relaxed text-neutral-300"
                    dangerouslySetInnerHTML={{ __html: data.contentHtml }}
                  />
                </>
              )}
            </div>
          )}
        </div>

        {/* Browse Section */}
        <div className="w-full max-w-3xl space-y-6">
          <div className="flex items-center gap-2 border-b border-primary/15 pb-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <h3 className="text-lg font-bold uppercase tracking-[0.18em] text-primary" style={{ fontFamily: "var(--font-cinzel)" }}>
              Chronicle Index
            </h3>
          </div>

          {isNotesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Skeleton className="h-24 w-full bg-neutral-800" />
              <Skeleton className="h-24 w-full bg-neutral-800" />
            </div>
          ) : !publishedNotes || publishedNotes.results.length === 0 ? (
            <div className="border border-primary/10 bg-neutral-900/10 p-6 text-center text-sm text-muted-foreground rounded-sm">
              No public lore entries have been published yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {publishedNotes.results.map((note) => (
                <Link
                  key={note.id}
                  href={`/public/lore/${note.id}`}
                  className="group relative block p-5 border border-primary/15 bg-neutral-900/20 hover:bg-neutral-900/40 hover:border-primary/50 transition-all duration-300 shadow-md hover:shadow-[0_4px_20px_rgba(212,175,55,0.05)] rounded-md"
                >
                  {/* Decorative corner indicator */}
                  <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-primary/20 group-hover:border-primary transition-all duration-300" />
                  
                  <span className="text-[9px] text-muted-foreground uppercase tracking-widest block mb-1">
                    Lore Entry
                  </span>
                  
                  <h4 className="text-base font-bold text-primary/90 group-hover:text-primary transition-colors duration-200" style={{ fontFamily: "var(--font-cinzel)" }}>
                    {note.title}
                  </h4>
                  
                  {note.path && note.path !== note.title && (
                    <p className="text-[10px] text-muted-foreground/70 truncate mt-1">
                      {note.path}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-primary/10 bg-black/40 px-5 py-6 w-full text-center">
        <p className="text-xs text-muted-foreground/60 uppercase tracking-widest" style={{ fontFamily: "var(--font-cinzel)" }}>
          Powered by AllCodex & AllKnower
        </p>
      </footer>
    </main>
  );
}
