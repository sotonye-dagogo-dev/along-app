"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, Code, PenLine, Send, Plus, Trash2, RefreshCw, Type, ChevronUp, ChevronDown, GripVertical } from "lucide-react";
import { toastService } from "@/app/lib/services/toastService";
import { EMAIL_MANAGEMENT_CONFIG, EMAIL_BUILDER_CONFIG, parseManualEmails } from "@/app/lib/config/emailManagement";
import { composeEmailDocument } from "@/app/lib/config/email";
import type { EmailTemplate } from "@/app/lib/config/email";
import {
  blocksToHtml, blocksToText, textToBlocks, htmlToBlocks, defaultBlocks, newBlockId,
  type EmailBlock, type EmailBlockType,
} from "@/app/lib/utils/emailBuilder";

interface ComposerSelection {
  mode: string;
  role: string;
  count: number;
  query: string;
  emails: string;
  includeUnverified: boolean;
}

interface UserHit { id: string; userName: string; firstName: string; lastName: string; email: string }

/** Client-side twin of the server renderer (preview parity, no save needed). */
function escapeLiveHtml(raw: string): string {
  return raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function parseLiveToken(inner: string): { name: string; fallback: string } | null {
  const m = String(inner ?? "").match(/^\s*(\w+)\s*(?:\|\|?\s*([\s\S]*?))?\s*$/);
  if (!m) return null;
  let fb = (m[2] ?? "").trim();
  if ((fb.startsWith('"') && fb.endsWith('"')) || (fb.startsWith("'") && fb.endsWith("'"))) fb = fb.slice(1, -1);
  return { name: m[1], fallback: fb };
}

function interpolateLive(template: string, vars: Record<string, string>, escape: boolean): string {
  return String(template ?? "").replace(/\{\{\s*([\s\S]*?)\s*\}\}/g, (full, inner: string) => {
    const p = parseLiveToken(inner);
    if (!p) return "";
    let s = vars[p.name] ?? "";
    if (!String(s).trim() && p.fallback) s = p.fallback;
    if (!s) return "";
    return escape ? escapeLiveHtml(String(s)) : String(s);
  });
}

function liveDefaults(): Record<string, string> {
  const origin = typeof window !== "undefined" && window.location?.origin ? window.location.origin.replace(/\/$/, "") : "https://www.alongng.com";
  return {
    appUrl: origin,
    appName: "Along",
    logoUrl: `${origin}/logo.svg`,
    supportEmail: "support@alongng.com",
    year: String(new Date().getFullYear()),
    firstName: "Adaobi",
  };
}

function liveSamplesFor(templateName: string): Record<string, string> {
  const d = liveDefaults();
  const base: Record<string, Record<string, string>> = {
    otp: { otp: "482937" },
    welcome: { firstName: "Adaobi" },
    passwordReset: { resetLink: `${d.appUrl}/reset?token=sample-token-123` },
    verifyEmail: { firstName: "Adaobi", otp: "482937", verifyLink: `${d.appUrl}/verify-email?email=${encodeURIComponent("adaobi@example.com")}` },
    changeEmail: { firstName: "Adaobi", newEmail: "ada@newmail.com", otp: "482937", confirmLink: `${d.appUrl}/profile?emailConfirmed=1` },
    changePassword: { firstName: "Adaobi", changedAt: new Date().toUTCString() },
    contactNotification: { senderName: "Chidi Okonkwo", senderEmail: "chidi@example.com", message: "I love the app! Would love to see more routes in Lagos mainland." },
    bugReportNotification: { title: "Route map not loading", category: "UI", description: "When I open the route map on the post page, the map stays blank." },
    accountDeletionRequested: { firstName: "Adaobi", scheduledDate: "October 16, 2026", cancelLink: `${d.appUrl}/profile` },
    accountDeletionCompleted: { firstName: "Adaobi", completedDate: "October 16, 2026", supportEmail: "alongtoanywhere@gmail.com" },
    adminDeletionAlert: { displayName: "Adaobi Eze", userName: "adaobi", email: "adaobi@example.com", scheduledDate: "October 16, 2026", reasonLine: "Reason: leaving for now" },
  };
  return { ...d, ...(base[templateName] ?? {}) };
}

function wrapLiveFragment(fragment: string, subject: string): string {
  if (/<table[\s>]/i.test(fragment) || /<html[\s>]/i.test(fragment)) return fragment;
  const title = String(subject || "Along update").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "Along update";
  return composeEmailDocument({ title, bodyHtml: fragment });
}

/**
 * Admin Email Studio — config-driven template builder + composer.
 * Builder: visual blocks (paragraph/link/image/list/heading/button/divider)
 * + variables catalog (selects + custom entries) + per-block values;
 * plain-text tab is fully in-place editable; HTML tab is raw.
 * Single source of truth = blocks; mode switches convert losslessly
 * (html->blocks degrades unknown markup to paragraphs, never drops text).
 * Composer: recipient select-search for `search` mode + per-variable
 * value inputs (JSON advanced fallback).
 */
export default function AdminEmailPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [toggles, setToggles] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorMode, setEditorMode] = useState<"visual" | "html" | "text">("visual");
  const [previewMode, setPreviewMode] = useState<"preview" | "html" | "text">("preview");
  const [savedHtml, setSavedHtml] = useState("");
  const [savedText, setSavedText] = useState("");
  const [liveHtml, setLiveHtml] = useState("");
  const [liveText, setLiveText] = useState("");
  const [dirty, setDirty] = useState(false);

  // Builder draft — blocks are canonical; html/text derived + synced.
  const [blocks, setBlocks] = useState<EmailBlock[]>(defaultBlocks());
  const [draftSubject, setDraftSubject] = useState("");
  const [draftHtml, setDraftHtml] = useState("");
  const [draftText, setDraftText] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [isNew, setIsNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [customVar, setCustomVar] = useState("");
  const lastMode = useRef<"visual" | "html" | "text">("visual");
  const baseline = useRef("");

  // Composer
  const [composeVars, setComposeVars] = useState<Record<string, string>>({});
  const [composeJson, setComposeJson] = useState("");
  const [useJsonVars, setUseJsonVars] = useState(false);
  const [selection, setSelection] = useState<ComposerSelection>({ mode: "admins", role: "USER", count: 100, query: "", emails: "", includeUnverified: false });
  const [sending, setSending] = useState(false);
  // Select-search recipients
  const [userHits, setUserHits] = useState<UserHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<UserHit[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/email/templates");
      if (res.ok) {
        const data = await res.json();
        const list = (data.templates ?? []) as EmailTemplate[];
        setTemplates(list);
        setToggles(data.toggles ?? {});
        if (!selected && list.length > 0) setSelected(list[0].name);
      }
    } catch {
      toastService.error("Failed to load email templates");
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => { load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = useMemo(() => templates.find((t) => t.name === selected), [templates, selected]);
  const effectiveEnabled = current ? (toggles[current.name] ?? current.enabled ?? true) : true;
  const allVars = useMemo(() => {
    const fromTemplate = current?.variables ?? [];
    const catalog = EMAIL_BUILDER_CONFIG.variableCatalog.map((v) => v.name);
    return [...new Set([...fromTemplate, ...catalog])];
  }, [current]);

  // Hydrate draft when switching templates (blocks parsed from stored HTML).
  useEffect(() => {
    if (current && !isNew) {
      setDraftSubject(current.subject);
      const parsed = htmlToBlocks(current.bodyHtml);
      setBlocks(parsed);
      setDraftHtml(current.bodyHtml);
      setDraftText(blocksToText(parsed));
      setDraftDesc(current.description ?? "");
      setComposeVars({});
      setComposeJson("");
      setDirty(false);
      baseline.current = JSON.stringify({ s: current.subject, h: current.bodyHtml });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.name, isNew]);

  // Saved-template baseline (server render of the stored template).
  useEffect(() => {
    if (!selected) return;
    (async () => {
      try {
        const res = await fetch(`/api/email/preview?template=${encodeURIComponent(selected)}`);
        if (res.ok) {
          const data = await res.json();
          setSavedHtml(data.rendered?.html ?? "");
          setSavedText(data.rendered?.text ?? "");
        }
      } catch { /* ignore */ }
    })();
  }, [selected, templates]);

  const canonicalHtmlLive = () => {
    if (editorMode === "html") return draftHtml;
    if (editorMode === "text") return blocksToHtml(textToBlocks(draftText));
    return blocksToHtml(blocks);
  };

  // Live unsaved preview — debounced re-render from the canonical draft so
  // every keystroke/block edit reflects before saving. Mirrors the server
  // pipeline (fragment auto-wrap + sample/default vars + fallbacks).
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const name = isNew ? newName.trim() || "draft" : selected;
        const samples = liveSamplesFor(name);
        const overrides: Record<string, string> = {};
        for (const [k, v] of Object.entries(composeVars)) {
          if (v.trim()) overrides[k] = v;
        }
        const vars = { ...samples, ...overrides };
        const frag = canonicalHtmlLive();
        const wrapped = wrapLiveFragment(frag, draftSubject);
        setLiveHtml(interpolateLive(wrapped, vars, true));
        const textSrc = editorMode === "text" ? draftText : blocksToText(editorMode === "html" ? htmlToBlocks(draftHtml) : blocks);
        setLiveText(interpolateLive(textSrc || draftSubject, vars, false));
        // Dirty = draft differs from the last hydrated/saved baseline.
        if (isNew) {
          setDirty(true);
        } else if (baseline.current) {
          try {
            const base = JSON.parse(baseline.current) as { s: string; h: string };
            const norm = (s: string) => String(s ?? "").replace(/\s+/g, " ").trim();
            // Compare subject + text-level content (whitespace-insensitive)
            // so pure reformatting doesn't flag unsaved changes.
            const fragText = frag.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
            const baseText = String(base.h ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
            setDirty(norm(draftSubject) !== norm(base.s) || fragText !== baseText);
          } catch { /* leave dirty as-is */ }
        }
      } catch { /* keep last good preview */ }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, draftHtml, draftText, draftSubject, editorMode, selected, isNew, newName, composeVars]);

  const previewHtml = liveHtml || savedHtml;
  const previewText = liveText || savedText;

  /** Lossless mode switching: sync canonical blocks before changing tabs. */
  const switchMode = (next: "visual" | "html" | "text") => {
    const prev = lastMode.current;
    try {
      if (prev === "visual" && next === "html") setDraftHtml(blocksToHtml(blocks));
      else if (prev === "visual" && next === "text") setDraftText(blocksToText(blocks));
      else if (prev === "html" && next === "visual") setBlocks(htmlToBlocks(draftHtml));
      else if (prev === "html" && next === "text") { const b = htmlToBlocks(draftHtml); setBlocks(b); setDraftText(blocksToText(b)); }
      else if (prev === "text" && next === "visual") setBlocks(textToBlocks(draftText));
      else if (prev === "text" && next === "html") { const b = textToBlocks(draftText); setBlocks(b); setDraftHtml(blocksToHtml(b)); }
    } catch { /* keep current draft on parse failure */ }
    lastMode.current = next;
    setEditorMode(next);
  };

  const canonicalHtml = () => {
    if (editorMode === "html") return draftHtml;
    if (editorMode === "text") return blocksToHtml(textToBlocks(draftText));
    return blocksToHtml(blocks);
  };

  const insertVarInto = (v: string, target: "subject" | "body") => {
    const token = `{{${v}}}`;
    if (target === "subject") { setDraftSubject((p) => `${p}${token}`); return; }
    if (editorMode === "html") setDraftHtml((p) => `${p}${token}`);
    else if (editorMode === "text") setDraftText((p) => `${p}${token}`);
    else {
      setBlocks((prev) => {
        if (prev.length === 0) return [{ id: newBlockId(), type: "paragraph", text: token }];
        const last = prev[prev.length - 1];
        if (last.type === "paragraph" || last.type === "heading") {
          return prev.map((b, i) => (i === prev.length - 1 ? { ...b, text: `${b.text ?? ""}${token}` } : b));
        }
        return [...prev, { id: newBlockId(), type: "paragraph", text: token }];
      });
    }
  };

  const addBlock = (type: EmailBlockType) => {
    const base: EmailBlock = { id: newBlockId(), type };
    if (type === "heading") { base.level = 2; base.text = "New heading"; }
    else if (type === "paragraph") base.text = "New paragraph — supports {{variables}}";
    else if (type === "button") { base.text = "Open Along"; base.url = "{{appUrl}}/home"; }
    else if (type === "link") { base.text = "Learn more"; base.url = "{{appUrl}}/faq"; }
    else if (type === "image") { base.src = "{{logoUrl}}"; base.text = "{{appName}}"; }
    else if (type === "list") base.items = ["First item", "Second item"];
    setBlocks((p) => [...p, base]);
  };

  const moveBlock = (id: string, dir: -1 | 1) => {
    setBlocks((prev) => {
      const i = prev.findIndex((b) => b.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const handleSave = async () => {
    const name = isNew ? newName.trim() : selected;
    if (!name) { toastService.error("Template name required"); return; }
    setSaving(true);
    try {
      const bodyHtml = canonicalHtml();
      const res = await fetch("/api/admin/email/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: { name, subject: draftSubject, bodyHtml, description: draftDesc } }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? "Save failed");
      }
      toastService.success(`Template “${name}” saved`);
      setIsNew(false);
      setSelected(name);
      setDirty(false);
      baseline.current = JSON.stringify({ s: draftSubject, h: bodyHtml });
      await load();
    } catch (e) {
      toastService.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (name: string, next: boolean) => {
    const nextToggles = { ...toggles, [name]: next };
    setToggles(nextToggles);
    try {
      const res = await fetch("/api/admin/email/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toggles: nextToggles }),
      });
      if (!res.ok) throw new Error("toggle failed");
      toastService.success(`“${name}” ${next ? "enabled" : "paused"}`);
    } catch {
      toastService.error("Toggle failed");
      setToggles(toggles);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    try {
      const res = await fetch(`/api/admin/email/templates?name=${encodeURIComponent(selected)}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? "Delete failed");
      }
      toastService.success("Custom template deleted");
      setSelected("");
      await load();
    } catch (e) {
      toastService.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  // Restore-to-default: drops the DB override so the hardcoded config
  // fallback applies again (hardcoded updates never auto-overwrite saves).
  const handleRestore = async () => {
    if (!selected) return;
    try {
      const res = await fetch("/api/admin/email/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restore: selected }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((d as { error?: string }).error ?? "Restore failed");
      toastService.success(`“${selected}” restored to default`);
      await load();
    } catch (e) {
      toastService.error(e instanceof Error ? e.message : "Restore failed");
    }
  };

  // Select-search: debounced lookup against /api/admin/users?q=
  const onSearchInput = (q: string) => {
    setSelection({ ...selection, query: q });
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setUserHits([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q.trim())}&limit=8`);
        if (res.ok) {
          const data = await res.json();
          setUserHits((data.users ?? []) as UserHit[]);
        }
      } catch { /* ignore */ }
      finally { setSearching(false); }
    }, 300);
  };

  const handleSend = async () => {
    if (!selected) return;
    setSending(true);
    try {
      let vars: Record<string, string> = {};
      if (useJsonVars) {
        try {
          vars = composeJson.trim() ? JSON.parse(composeJson) : {};
        } catch {
          toastService.error("Vars must be valid JSON (e.g. {\"firstName\":\"Ada\"})");
          setSending(false);
          return;
        }
      } else {
        vars = { ...composeVars };
      }
      const pickedEmails = picked.map((p) => p.email);
      const res = await fetch("/api/admin/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateName: selected,
            vars,
            selection: {
              mode: selection.mode === "search" && pickedEmails.length ? "manual" : selection.mode,
              role: selection.role,
              count: selection.count,
              query: selection.query,
              includeUnverified: selection.includeUnverified,
              emails: selection.mode === "search" && pickedEmails.length
                ? pickedEmails
                : parseManualEmails(selection.emails),
            },
          }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Send failed");
      toastService.success(`Sent to ${(data as { sent?: number }).sent ?? 0}/${(data as { total?: number }).total ?? 0}`);
    } catch (e) {
      toastService.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="text-center py-12 text-text-muted">Loading email studio…</div>;

  return (
    <div className="min-w-0 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 min-w-0">
        <div className="min-w-0">
          <h1 className="text-[24px] sm:text-[28px] font-bold tracking-tight truncate">Email Studio</h1>
          <div className="text-sm text-text-secondary truncate">Blocks + variables · HTML · plain text (in-place) · toggles · dynamic recipients</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setIsNew(true); setNewName(""); setDraftSubject(""); setBlocks(defaultBlocks()); setDraftHtml(""); setDraftText(""); setDraftDesc(""); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 radius-md bg-primary text-white text-xs font-semibold border-none cursor-pointer">
            <Plus size={14} /> New template
          </button>
          <button onClick={load} className="inline-flex items-center gap-1.5 px-3 py-2 radius-md border border-border bg-bg-card text-xs font-medium cursor-pointer">
            <RefreshCw size={14} /> Reload
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {templates.map((t) => {
          const on = toggles[t.name] ?? t.enabled ?? true;
          return (
            <button
              key={t.name}
              onClick={() => { setSelected(t.name); setIsNew(false); setPicked([]); }}
              title={t.description ?? t.name}
              className={`px-3 py-2 radius-md text-xs font-semibold border cursor-pointer transition-colors ${
                selected === t.name && !isNew ? "bg-primary text-white border-primary" : "bg-bg-card text-text-secondary border-border"
              } ${on ? "" : "opacity-60"}`}
            >
              {t.name}{on ? "" : " (paused)"}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0">
        {/* Builder */}
        <section className="bg-bg-card border border-border radius-lg p-4 flex flex-col gap-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">{isNew ? "New custom template" : `Edit: ${selected || "—"}`}</h2>
            <div className="flex gap-1">
              {(["visual", "html", "text"] as const).map((m) => (
                <button key={m} onClick={() => switchMode(m)}
                  className={`px-2 py-1 radius-sm text-xs font-medium cursor-pointer border ${editorMode === m ? "bg-primary-muted text-primary border-primary" : "border-border text-text-secondary"}`}>
                  {m === "visual" ? <PenLine size={12} className="inline mr-1" /> : m === "html" ? <Code size={12} className="inline mr-1" /> : <Type size={12} className="inline mr-1" />}{m}
                </button>
              ))}
            </div>
          </div>

          {isNew && (
            <label className="text-xs flex flex-col gap-1">
              <span className="text-text-muted font-medium">Name (letters/numbers/_/-)</span>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. monthlyDigest"
                className="rounded-md border border-border bg-bg-base px-3 py-2 text-sm" />
            </label>
          )}

          <label className="text-xs flex flex-col gap-1">
            <span className="text-text-muted font-medium">Subject (supports {"{{var}}"})</span>
            <input value={draftSubject} onChange={(e) => setDraftSubject(e.target.value)}
              className="rounded-md border border-border bg-bg-base px-3 py-2 text-sm" />
          </label>

          <label className="text-xs flex flex-col gap-1">
            <span className="text-text-muted font-medium">Description</span>
            <input value={draftDesc} onChange={(e) => setDraftDesc(e.target.value)} placeholder="What is this template for?"
              className="rounded-md border border-border bg-bg-base px-3 py-2 text-sm" />
          </label>

          {current && !isNew && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-text-muted">Wired-in send:</span>
              <button onClick={() => handleToggle(current.name, !effectiveEnabled)}
                className={`px-2 py-1 radius-sm font-semibold cursor-pointer border ${effectiveEnabled ? "bg-primary-muted text-primary border-primary" : "bg-bg-elevated text-text-muted border-border"}`}>
                {effectiveEnabled ? "Enabled — click to pause" : "Paused — click to enable"}
              </button>
            </div>
          )}

          {/* Variables: catalog select + custom entry + insert targets */}
          <div className="flex flex-col gap-1.5 rounded-md border border-border bg-bg-base p-2.5">
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">Variables — pick or add custom, then insert</span>
            <div className="flex gap-1 flex-wrap items-center text-xs">
              <select
                aria-label="Variable catalog"
                defaultValue=""
                onChange={(e) => { if (e.target.value) { insertVarInto(e.target.value, "body"); e.target.value = ""; } }}
                className="rounded-md border border-border bg-bg-card px-2 py-1.5 text-xs max-w-[220px]">
                <option value="">Select variable…</option>
                {EMAIL_BUILDER_CONFIG.variableCatalog.map((v) => (
                  <option key={v.name} value={v.name}>{`{{${v.name}}}`} — {v.label}</option>
                ))}
                {allVars.filter((v) => !EMAIL_BUILDER_CONFIG.variableCatalog.some((c) => c.name === v)).map((v) => (
                  <option key={v} value={v}>{`{{${v}}}`}</option>
                ))}
              </select>
              <input value={customVar} onChange={(e) => setCustomVar(e.target.value.replace(/[^\w]/g, ""))}
                placeholder="custom_name" aria-label="Custom variable name"
                className="rounded-md border border-border bg-bg-card px-2 py-1.5 text-xs font-mono w-[130px]" />
              <button onClick={() => { if (customVar.trim()) { insertVarInto(customVar.trim(), "body"); setCustomVar(""); } }}
                className="px-2 py-1.5 radius-sm bg-bg-elevated text-xs font-semibold cursor-pointer border border-border">Add + insert</button>
              <button onClick={() => { const v = customVar.trim() || "customVar"; insertVarInto(v, "subject"); }}
                title="Insert into subject"
                className="px-2 py-1.5 radius-sm text-xs cursor-pointer border border-border text-text-secondary">→ subject</button>
            </div>
            <div className="flex gap-1 flex-wrap items-center text-xs">
              <span className="text-text-muted">Quick insert:</span>
              {allVars.slice(0, 8).map((v) => (
                <button key={v} onClick={() => insertVarInto(v, "body")}
                  className="px-1.5 py-0.5 radius-sm bg-bg-elevated font-mono cursor-pointer border-none hover:text-primary">{`{{${v}}}`}</button>
              ))}
            </div>
          </div>

          {/* Block palette */}
          {editorMode === "visual" && (
            <div className="flex gap-1 flex-wrap items-center text-xs">
              <span className="text-text-muted">Add block:</span>
              {EMAIL_BUILDER_CONFIG.blocks.map((b) => (
                <button key={b.id} onClick={() => addBlock(b.id as EmailBlockType)} title={b.description}
                  className="px-2 py-1 radius-sm bg-bg-elevated cursor-pointer border border-border hover:text-primary font-medium">{b.label}</button>
              ))}
            </div>
          )}

          {editorMode === "html" ? (
            <textarea value={draftHtml} onChange={(e) => setDraftHtml(e.target.value)} rows={12}
              aria-label="Template HTML (raw)"
              className="rounded-md border border-border bg-bg-base p-3 font-mono text-xs leading-relaxed" />
          ) : editorMode === "text" ? (
            <label className="text-xs flex flex-col gap-1">
              <span className="text-text-muted font-medium">Plain text — type in place (blank line = new paragraph, “- ” = list, [label](url) = link/button, ![alt](src) = image, # = heading)</span>
              <textarea value={draftText} onChange={(e) => setDraftText(e.target.value)} rows={14}
                aria-label="Template plain text (editable)"
                className="rounded-md border border-border bg-bg-base p-3 text-sm leading-relaxed" />
            </label>
          ) : (
            <div className="flex flex-col gap-2">
              {blocks.map((b, idx) => (
                <div key={b.id} className="rounded-md border border-border bg-bg-base p-2.5 flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <GripVertical size={13} className="text-text-muted shrink-0" />
                    <span className="text-[11px] font-bold uppercase tracking-wide text-text-muted">{b.type}</span>
                    <span className="ml-auto flex gap-0.5">
                      <button onClick={() => moveBlock(b.id, -1)} disabled={idx === 0} aria-label="Move up"
                        className="p-1 cursor-pointer bg-transparent border-none text-text-muted disabled:opacity-30"><ChevronUp size={13} /></button>
                      <button onClick={() => moveBlock(b.id, 1)} disabled={idx === blocks.length - 1} aria-label="Move down"
                        className="p-1 cursor-pointer bg-transparent border-none text-text-muted disabled:opacity-30"><ChevronDown size={13} /></button>
                      <button onClick={() => setBlocks((p) => p.filter((x) => x.id !== b.id))} aria-label="Remove block"
                        className="p-1 cursor-pointer bg-transparent border-none text-text-muted hover:text-error"><Trash2 size={13} /></button>
                    </span>
                  </div>
                  {(b.type === "paragraph" || b.type === "heading") && (
                    <textarea value={b.text ?? ""} rows={b.type === "heading" ? 1 : 3}
                      onChange={(e) => setBlocks((p) => p.map((x) => (x.id === b.id ? { ...x, text: e.target.value } : x)))}
                      aria-label={`${b.type} text (supports {{variables}})`}
                      className="rounded border border-border bg-bg-card p-2 text-sm w-full" />
                  )}
                  {(b.type === "button" || b.type === "link") && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      <input value={b.text ?? ""} placeholder="Label" aria-label="Label"
                        onChange={(e) => setBlocks((p) => p.map((x) => (x.id === b.id ? { ...x, text: e.target.value } : x)))}
                        className="rounded border border-border bg-bg-card px-2 py-1.5 text-sm" />
                      <input value={b.url ?? ""} placeholder="URL ({{appUrl}}/… or https://…)" aria-label="URL"
                        onChange={(e) => setBlocks((p) => p.map((x) => (x.id === b.id ? { ...x, url: e.target.value } : x)))}
                        className="rounded border border-border bg-bg-card px-2 py-1.5 text-sm font-mono" />
                    </div>
                  )}
                  {b.type === "image" && (
                    <div className="flex flex-col gap-1.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        <input value={b.src ?? b.url ?? ""} placeholder="Image URL ({{logoUrl}} available)" aria-label="Image source"
                          onChange={(e) => setBlocks((p) => p.map((x) => (x.id === b.id ? { ...x, src: e.target.value, url: undefined } : x)))}
                          className="rounded border border-border bg-bg-card px-2 py-1.5 text-sm font-mono" />
                        <input value={b.text ?? ""} placeholder="Alt text ({{appName}} available)" aria-label="Alt text"
                          onChange={(e) => setBlocks((p) => p.map((x) => (x.id === b.id ? { ...x, text: e.target.value } : x)))}
                          className="rounded border border-border bg-bg-card px-2 py-1.5 text-sm" />
                      </div>
                      {(b.src ?? b.url ?? "").trim() !== "" && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={(b.src ?? b.url ?? "").replace(/\{\{\s*logoUrl\s*\}\}/g, `${typeof window !== "undefined" ? window.location.origin : "https://www.alongng.com"}/logo.svg`).replace(/\{\{\s*appUrl\s*\}\}/g, typeof window !== "undefined" ? window.location.origin : "https://www.alongng.com")}
                          alt={b.text || "Image preview"}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          className="max-w-[160px] max-h-[80px] object-contain rounded border border-border bg-bg-elevated self-center"
                        />
                      )}
                    </div>
                  )}
                  {b.type === "list" && (
                    <textarea value={(b.items ?? []).join("\n")} rows={Math.max(2, (b.items ?? []).length + 1)}
                      placeholder="One item per line"
                      onChange={(e) => setBlocks((p) => p.map((x) => (x.id === b.id ? { ...x, items: e.target.value.split("\n") } : x)))}
                      aria-label="List items (one per line)"
                      className="rounded border border-border bg-bg-card p-2 text-sm w-full" />
                  )}
                  {(b.type === "divider" || b.type === "spacer") && (
                    <span className="text-[11px] text-text-muted">No settings — rendered as {b.type}.</span>
                  )}
                </div>
              ))}
              {blocks.length === 0 && (
                <button onClick={() => setBlocks(defaultBlocks())}
                  className="rounded-md border border-dashed border-border p-4 text-xs text-text-muted cursor-pointer">Empty — click to restore starter blocks</button>
              )}
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <button onClick={handleSave} disabled={saving}
              className="px-3 py-2 radius-md bg-primary text-white text-xs font-semibold border-none cursor-pointer disabled:opacity-50">
              {saving ? "Saving…" : isNew ? "Create template" : "Save changes"}
            </button>
            {!isNew && current && (
              <button onClick={handleRestore} title="Drop DB overrides and fall back to the hardcoded default (hardcoded updates never auto-overwrite saves)"
                className="inline-flex items-center gap-1 px-3 py-2 radius-md border border-border text-xs font-semibold cursor-pointer">
                <RefreshCw size={13} /> Restore default
              </button>
            )}
            {!isNew && current && !current.isSystem && (
              <button onClick={handleDelete} className="inline-flex items-center gap-1 px-3 py-2 radius-md bg-error text-error-text text-xs font-semibold border-none cursor-pointer">
                <Trash2 size={13} /> Delete
              </button>
            )}
            {isNew && (
              <button onClick={() => setIsNew(false)} className="px-3 py-2 radius-md border border-border text-xs cursor-pointer">Cancel</button>
            )}
          </div>
        </section>

        {/* Preview + composer */}
        <div className="flex flex-col gap-4 min-w-0">
          <section className="bg-bg-card border border-border radius-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-semibold truncate flex items-center gap-2">Preview
                {dirty
                  ? <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 radius-pill bg-primary-muted text-primary">Live — unsaved changes</span>
                  : <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 radius-pill bg-bg-elevated text-text-muted">Saved</span>}
              </span>
              <div className="flex gap-1">
                {(["preview", "html", "text"] as const).map((m) => (
                  <button key={m} onClick={() => setPreviewMode(m)} title={m}
                    className={`p-1.5 radius-md cursor-pointer ${previewMode === m ? "bg-primary-muted text-primary" : "text-text-muted"}`}>
                    <Eye size={14} />
                  </button>
                ))}
              </div>
            </div>
            <div className="max-h-[420px] overflow-auto">
              {previewMode === "preview" ? (
                <iframe srcDoc={previewHtml} title="Email preview" className="w-full border-none" style={{ minHeight: 320 }} />
              ) : (
                <pre className="p-4 text-xs font-mono whitespace-pre-wrap">{previewMode === "html" ? previewHtml : previewText}</pre>
              )}
            </div>
          </section>

          <section className="bg-bg-card border border-border radius-lg p-4 flex flex-col gap-3">
            <h2 className="text-sm font-semibold flex items-center gap-1.5"><Send size={14} /> Composer — send “{selected || "—"}”</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className="flex flex-col gap-1">
                <span className="text-text-muted font-medium">Recipients</span>
                <select value={selection.mode} onChange={(e) => setSelection({ ...selection, mode: e.target.value })}
                  className="rounded-md border border-border bg-bg-base px-2 py-2">
                  {EMAIL_MANAGEMENT_CONFIG.recipientModes.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </label>
              {selection.mode === "role" && (
                <label className="flex flex-col gap-1">
                  <span className="text-text-muted font-medium">Role</span>
                  <select value={selection.role} onChange={(e) => setSelection({ ...selection, role: e.target.value })}
                    className="rounded-md border border-border bg-bg-base px-2 py-2">
                    <option value="USER">USER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </label>
              )}
              {selection.mode === "firstN" && (
                <label className="flex flex-col gap-1">
                  <span className="text-text-muted font-medium">N (earliest signups, max {EMAIL_MANAGEMENT_CONFIG.maxFirstN})</span>
                  <input type="number" min={1} max={EMAIL_MANAGEMENT_CONFIG.maxFirstN} value={selection.count}
                    onChange={(e) => setSelection({ ...selection, count: Number(e.target.value) })}
                    className="rounded-md border border-border bg-bg-base px-2 py-2" />
                </label>
              )}
              {selection.mode === "search" && (
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-text-muted font-medium">Search users (select-search)</span>
                  <input value={selection.query} onChange={(e) => onSearchInput(e.target.value)}
                    placeholder="Type name / username / email…" role="combobox" aria-expanded={userHits.length > 0} aria-label="Search users"
                    className="rounded-md border border-border bg-bg-base px-2 py-2" />
                  {searching && <span className="text-[11px] text-text-muted">Searching…</span>}
                  {userHits.length > 0 && (
                    <ul className="rounded-md border border-border bg-bg-base max-h-44 overflow-auto divide-y divide-border" role="listbox">
                      {userHits.filter((h) => !picked.some((p) => p.id === h.id)).map((h) => (
                        <li key={h.id}>
                          <button onClick={() => { setPicked((p) => [...p, h]); setUserHits((u) => u.filter((x) => x.id !== h.id)); }}
                            className="w-full text-left px-2.5 py-2 hover:bg-bg-elevated cursor-pointer bg-transparent border-none">
                            <span className="block text-xs font-semibold">{h.firstName} {h.lastName} <span className="text-text-muted font-normal">@{h.userName}</span></span>
                            <span className="block text-[11px] text-text-muted font-mono truncate">{h.email}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {picked.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {picked.map((p) => (
                        <button key={p.id} onClick={() => setPicked((x) => x.filter((y) => y.id !== p.id))}
                          title="Remove" className="px-2 py-1 radius-pill bg-primary-muted text-primary text-[11px] font-semibold cursor-pointer border-none">
                          @{p.userName} ×
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            {selection.mode === "manual" && (
              <label className="text-xs flex flex-col gap-1">
                <span className="text-text-muted font-medium">Addresses (comma / line separated)</span>
                <textarea value={selection.emails} onChange={(e) => setSelection({ ...selection, emails: e.target.value })} rows={3}
                  className="rounded-md border border-border bg-bg-base p-2 font-mono" />
              </label>
            )}
            {selection.mode !== "manual" && (
              <label className="flex flex-col gap-1 text-xs">
                <span className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selection.includeUnverified}
                    onChange={(e) => setSelection({ ...selection, includeUnverified: e.target.checked })}
                    className="w-4 h-4 accent-primary cursor-pointer"
                  />
                  <span className="font-medium">Include unverified emails</span>
                </span>
                <span className="text-[11px] text-text-muted leading-relaxed">
                  {selection.includeUnverified
                    ? "Unverified addresses included — note: unverified emails may fail delivery since the addresses are not confirmed."
                    : "Unverified emails are filtered out by default to avoid resource wastage."}
                </span>
              </label>
            )}
            {/* Per-variable value inputs — only manual-entry vars REQUIRE input.
                Platform defaults (appUrl/logoUrl/…) + user-derived
                (firstName/userName/email) + generated (otp/verifyLink/…)
                resolve automatically per recipient. */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-text-muted font-medium text-xs">Values for {current?.variables.length ? `(${current.variables.length} vars)` : "(no vars declared)"} — auto vars send without input</span>
                <button onClick={() => setUseJsonVars(!useJsonVars)} className="text-[11px] text-primary cursor-pointer bg-transparent border-none">
                  {useJsonVars ? "Use field inputs" : "Use JSON instead"}
                </button>
              </div>
              {useJsonVars ? (
                <textarea value={composeJson} onChange={(e) => setComposeJson(e.target.value)} rows={3}
                  placeholder='{"firstName":"Ada"}' aria-label="Variables JSON"
                  className="rounded-md border border-border bg-bg-base p-2 font-mono text-xs" />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {(current?.variables ?? []).map((v) => {
                    const auto = ["appUrl", "appName", "logoUrl", "supportEmail", "year", "firstName", "lastName", "userName", "email", "displayName", "otp", "verifyLink", "resetLink", "confirmLink", "cancelLink", "changedAt", "scheduledDate", "completedDate", "reasonLine"].includes(v);
                    return (
                      <label key={v} className="flex flex-col gap-0.5 text-xs">
                        <span className="font-mono text-text-muted flex items-center gap-1.5">{`{{${v}}}`}
                          <span className={`text-[9px] font-bold uppercase tracking-wide px-1 py-px radius-pill ${auto ? "bg-success text-white" : "bg-warning text-warning-text"}`}>
                            {auto ? "auto" : "manual*"}
                          </span>
                        </span>
                        <input value={composeVars[v] ?? ""} onChange={(e) => setComposeVars((p) => ({ ...p, [v]: e.target.value }))}
                          placeholder={auto
                            ? `Auto per recipient — override optional (${EMAIL_BUILDER_CONFIG.variableCatalog.find((c) => c.name === v)?.example ?? v})`
                            : (EMAIL_BUILDER_CONFIG.variableCatalog.find((c) => c.name === v)?.example ?? `Value for ${v} (required for manual addresses)`)}
                          className="rounded-md border border-border bg-bg-base px-2 py-1.5 text-xs" />
                      </label>
                    );
                  })}
                  {(current?.variables ?? []).length === 0 && (
                    <span className="text-[11px] text-text-muted">This template declares no variables — sends use shared defaults (appUrl, logoUrl, …).</span>
                  )}
                </div>
              )}
            </div>
            <div>
              <button onClick={handleSend} disabled={sending || !selected}
                className="inline-flex items-center gap-1.5 px-3 py-2 radius-md bg-primary text-white text-xs font-semibold border-none cursor-pointer disabled:opacity-50">
                <Send size={13} /> {sending ? "Sending…" : "Send to selected recipients"}
              </button>
            </div>
            <p className="text-[11px] text-text-muted leading-relaxed">
              Capped at {EMAIL_MANAGEMENT_CONFIG.maxRecipientsPerSend} recipients per send. Every send is audited in EmailLog.
              Paused templates cannot send (toggle above). Missing values send as empty — never as {"{{name}}"}.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
