"use client";

import { useState } from "react";
import { BLOG_VARIABLE_CATALOG } from "@/app/lib/config/blogManagement";

/**
 * BlogVariableInsert — reusable insert-variable picker for Blog Studio.
 * Mirrors the Email Studio pattern: catalog select + custom entry + quick
 * inserts, so admins never hand-type `{{identifiers}}`. Only whitelisted
 * catalog names (or sanitized custom names) can be inserted — the block
 * renderer + server sanitizer enforce the same allowlist shape.
 */
export default function BlogVariableInsert({ onInsert }: { onInsert: (token: string) => void }) {
  const [customVar, setCustomVar] = useState("");

  const insert = (name: string) => {
    const clean = String(name ?? "").replace(/[^\w]/g, "").slice(0, 40);
    if (!clean) return;
    const catalog = (BLOG_VARIABLE_CATALOG as readonly { name: string; fallback?: string }[]).find(
      (c) => c.name === clean,
    );
    const fallback = (catalog as { fallback?: string } | undefined)?.fallback;
    onInsert(fallback ? `{{${clean}||${fallback}}}` : `{{${clean}}}`);
  };

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border bg-bg-base p-2.5">
      <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">
        Variables — pick or add custom, then insert (guest-safe fallbacks included)
      </span>
      <div className="flex gap-1 flex-wrap items-center text-xs">
        <select
          aria-label="Blog variable catalog"
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) {
              insert(e.target.value);
              e.target.value = "";
            }
          }}
          className="rounded-md border border-border bg-bg-card px-2 py-1.5 text-xs max-w-[240px]"
        >
          <option value="">Select variable…</option>
          {BLOG_VARIABLE_CATALOG.map((v) => (
            <option key={v.name} value={v.name}>
              {`{{${v.name}}}`} — {v.label} (fallback: {v.fallback || "none"})
            </option>
          ))}
        </select>
        <input
          value={customVar}
          onChange={(e) => setCustomVar(e.target.value.replace(/[^\w]/g, ""))}
          placeholder="custom_name"
          aria-label="Custom variable name"
          className="rounded-md border border-border bg-bg-card px-2 py-1.5 text-xs font-mono w-[130px]"
        />
        <button
          onClick={() => {
            if (customVar.trim()) {
              insert(customVar.trim());
              setCustomVar("");
            }
          }}
          className="px-2 py-1.5 radius-sm bg-bg-elevated text-xs font-semibold cursor-pointer border border-border"
        >
          Add + insert
        </button>
      </div>
      <div className="flex gap-1 flex-wrap items-center text-xs">
        <span className="text-text-muted">Quick insert:</span>
        {BLOG_VARIABLE_CATALOG.slice(0, 6).map((v) => (
          <button
            key={v.name}
            onClick={() => insert(v.name)}
            title={v.description}
            className="px-1.5 py-0.5 radius-sm bg-bg-elevated font-mono cursor-pointer border-none hover:text-primary"
          >
            {`{{${v.name}}}`}
          </button>
        ))}
      </div>
    </div>
  );
}
