'use client'

import { useState } from "react";
import { Search, ChevronDown } from "lucide-react";
import { useTranslation } from "@/app/providers/I18nProvider";
import type { FaqCategory } from "@/app/lib/config/faq";
import { FAQ_PCM } from "@/app/lib/config/faq";

interface FaqClientProps {
  categories: FaqCategory[];
}

export default function FaqClient({ categories }: FaqClientProps) {
  const { tf, locale } = useTranslation();
  const [search, setSearch] = useState("");
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const toggleItem = (id: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Dictionary-driven with config fallbacks: per-item pidgin overrides live
  // in FAQ_PCM (config layer, keyed by item id); missing entries fall back
  // to the config English so nothing ever renders a raw key. Search matches
  // the displayed (translated) text.
  const tItem = (id: string, field: "question" | "answer", fallback: string) => {
    if (locale === "pcm") {
      const override = FAQ_PCM[id]?.[field];
      if (override) return override;
    }
    return fallback;
  };

  const translated = categories.map((cat) => ({
    ...cat,
    items: cat.items.map((item) => ({
      ...item,
      question: tItem(item.id, "question", item.question),
      answer: tItem(item.id, "answer", item.answer),
    })),
  }));

  const filtered = translated
    .map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (item) =>
          item.question.toLowerCase().includes(search.toLowerCase()) ||
          item.answer.toLowerCase().includes(search.toLowerCase()),
      ),
    }))
    .filter((cat) => cat.items.length > 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-text-primary mb-3">
          {tf("faq.title", "Frequently Asked Questions")}
        </h1>
        <p className="text-text-secondary mb-6">
          {tf("faq.subtitle", "Everything you need to know about Along.")}
        </p>
        <div className="relative max-w-md mx-auto">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="text"
            placeholder={tf("faq.searchPlaceholder", "Search questions...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-text-muted py-12">
          {tf("faq.noResults", "No results found. Try a different search term.")}
        </p>
      ) : (
        filtered.map((category) => (
          <section key={category.id} className="mb-10">
            <h2 className="text-xl font-semibold text-text-primary mb-4 pb-2 border-b border-border">
              {category.category}
            </h2>
            <div className="space-y-2">
              {category.items.map((item) => {
                const isOpen = openItems.has(item.id);
                return (
                  <div
                    key={item.id}
                    className="border border-border rounded-lg overflow-hidden bg-bg-card"
                  >
                    <button
                      onClick={() => toggleItem(item.id)}
                      className="w-full flex items-center justify-between px-4 py-3.5 text-left text-sm font-medium text-text-primary hover:bg-bg-elevated transition-colors"
                      aria-expanded={isOpen}
                    >
                      <span>{item.question}</span>
                      <ChevronDown
                        size={16}
                        className={`text-text-muted transition-transform duration-200 ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-3.5 text-sm text-text-secondary leading-relaxed">
                        {item.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
