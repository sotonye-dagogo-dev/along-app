"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Code, PenLine, Send, Plus, Trash2, RefreshCw } from "lucide-react";
import { toastService } from "@/app/lib/services/toastService";
import { EMAIL_MANAGEMENT_CONFIG, parseManualEmails } from "@/app/lib/config/emailManagement";
import type { EmailTemplate } from "@/app/lib/config/email";

interface ComposerSelection {
  mode: string;
  role: string;
  count: number;
  query: string;
  emails: string;
}

/**
 * Admin Email Studio — config-driven template builder + composer.
 * - Templates: visual (subject + paragraphs) / HTML modes, {{var}} insertion,
 *   enabled toggles (posting transitions audited), custom create/delete.
 * - Composer: any template + dynamic recipients (admins/all/role/firstN/search/manual).
 * Non-breaking: persists to SiteConfig keys; wired-in sends read the same keys.
 */
export default function AdminEmailPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [toggles, setToggles] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorMode, setEditorMode] = useState<"visual" | "html">("visual");
  const [previewMode, setPreviewMode] = useState<"preview" | "html" | "text">("preview");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewText, setPreviewText] = useState("");

  // Builder draft
  const [draftSubject, setDraftSubject] = useState("");
  const [draftHtml, setDraftHtml] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [isNew, setIsNew] = useState(false);
  const [newName, setNewName] = useState("");

  // Composer
  const [composeVars, setComposeVars] = useState("");
  const [selection, setSelection] = useState<ComposerSelection>({ mode: "admins", role: "USER", count: 100, query: "", emails: "" });
  const [sending, setSending] = useState(false);

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

  useEffect(() => {
    if (current && !isNew) {
      setDraftSubject(current.subject);
      setDraftHtml(current.bodyHtml);
      setDraftDesc(current.description ?? "");
    }
  }, [current, isNew]);

  useEffect(() => {
    if (!selected) return;
    (async () => {
      try {
        const res = await fetch(`/api/email/preview?template=${encodeURIComponent(selected)}`);
        if (res.ok) {
          const data = await res.json();
          setPreviewHtml(data.rendered?.html ?? "");
          setPreviewText(data.rendered?.text ?? "");
        }
      } catch { /* ignore */ }
    })();
  }, [selected, templates]);

  const insertVar = (v: string) => {
    setDraftHtml((prev) => `${prev}{{${v}}}`);
  };

  const handleSave = async () => {
    const name = isNew ? newName.trim() : selected;
    if (!name) { toastService.error("Template name required"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/email/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: { name, subject: draftSubject, bodyHtml: draftHtml, description: draftDesc } }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? "Save failed");
      }
      toastService.success(`Template “${name}” saved`);
      setIsNew(false);
      setSelected(name);
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

  const handleSend = async () => {
    if (!selected) return;
    setSending(true);
    try {
      let vars: Record<string, string> = {};
      try {
        vars = composeVars.trim() ? JSON.parse(composeVars) : {};
      } catch {
        toastService.error("Vars must be valid JSON (e.g. {\"firstName\":\"Ada\"})");
        setSending(false);
        return;
      }
      const res = await fetch("/api/admin/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateName: selected,
          vars,
          selection: {
            mode: selection.mode,
            role: selection.role,
            count: selection.count,
            query: selection.query,
            emails: parseManualEmails(selection.emails),
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
          <div className="text-sm text-text-secondary truncate">Templates (visual / HTML) · toggles · dynamic recipients</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setIsNew(true); setNewName(""); setDraftSubject(""); setDraftHtml(""); setDraftDesc(""); }}
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
              onClick={() => { setSelected(t.name); setIsNew(false); }}
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
              {(["visual", "html"] as const).map((m) => (
                <button key={m} onClick={() => setEditorMode(m)}
                  className={`px-2 py-1 radius-sm text-xs font-medium cursor-pointer border ${editorMode === m ? "bg-primary-muted text-primary border-primary" : "border-border text-text-secondary"}`}>
                  {m === "visual" ? <PenLine size={12} className="inline mr-1" /> : <Code size={12} className="inline mr-1" />}{m}
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

          {current && !isNew && current.variables?.length > 0 && (
            <div className="flex gap-1 flex-wrap items-center text-xs">
              <span className="text-text-muted">Insert:</span>
              {current.variables.map((v) => (
                <button key={v} onClick={() => insertVar(v)}
                  className="px-1.5 py-0.5 radius-sm bg-bg-elevated font-mono cursor-pointer border-none hover:text-primary">{`{{${v}}}`}</button>
              ))}
            </div>
          )}

          {editorMode === "html" ? (
            <textarea value={draftHtml} onChange={(e) => setDraftHtml(e.target.value)} rows={12}
              className="rounded-md border border-border bg-bg-base p-3 font-mono text-xs leading-relaxed" />
          ) : (
            <div className="rounded-md border border-border bg-bg-base p-3 text-sm leading-relaxed whitespace-pre-wrap min-h-[220px]">
              {draftHtml.replace(/<[^>]+>/g, "").slice(0, 2000) || <span className="text-text-muted">Start typing HTML on the HTML tab — plain-text preview shows here.</span>}
            </div>
          )}
          {editorMode === "visual" && (
            <textarea value={draftHtml} onChange={(e) => setDraftHtml(e.target.value)} rows={6}
              aria-label="Template HTML (visual assist)"
              className="rounded-md border border-border bg-bg-base p-3 font-mono text-xs" />
          )}

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="px-3 py-2 radius-md bg-primary text-white text-xs font-semibold border-none cursor-pointer disabled:opacity-50">
              {saving ? "Saving…" : isNew ? "Create template" : "Save changes"}
            </button>
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
              <span className="text-sm font-semibold truncate">Preview</span>
              <div className="flex gap-1">
                {(["preview", "html", "text"] as const).map((m) => (
                  <button key={m} onClick={() => setPreviewMode(m)}
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
                <label className="flex flex-col gap-1">
                  <span className="text-text-muted font-medium">Search users</span>
                  <input value={selection.query} onChange={(e) => setSelection({ ...selection, query: e.target.value })}
                    placeholder="name / username / email" className="rounded-md border border-border bg-bg-base px-2 py-2" />
                </label>
              )}
            </div>
            {selection.mode === "manual" && (
              <label className="text-xs flex flex-col gap-1">
                <span className="text-text-muted font-medium">Addresses (comma / line separated)</span>
                <textarea value={selection.emails} onChange={(e) => setSelection({ ...selection, emails: e.target.value })} rows={3}
                  className="rounded-md border border-border bg-bg-base p-2 font-mono" />
              </label>
            )}
            <label className="text-xs flex flex-col gap-1">
              <span className="text-text-muted font-medium">Variables JSON</span>
              <textarea value={composeVars} onChange={(e) => setComposeVars(e.target.value)} rows={3}
                placeholder='{"firstName":"Ada"}' className="rounded-md border border-border bg-bg-base p-2 font-mono" />
            </label>
            <div>
              <button onClick={handleSend} disabled={sending || !selected}
                className="inline-flex items-center gap-1.5 px-3 py-2 radius-md bg-primary text-white text-xs font-semibold border-none cursor-pointer disabled:opacity-50">
                <Send size={13} /> {sending ? "Sending…" : "Send to selected recipients"}
              </button>
            </div>
            <p className="text-[11px] text-text-muted leading-relaxed">
              Capped at {EMAIL_MANAGEMENT_CONFIG.maxRecipientsPerSend} recipients per send. Every send is audited in EmailLog.
              Paused templates cannot send (toggle above).
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
