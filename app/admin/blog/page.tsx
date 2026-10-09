"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, RefreshCw, Eye } from "lucide-react";
import { toastService } from "@/app/lib/services/toastService";
import { BLOG_MANAGEMENT_CONFIG, normalizeSlug } from "@/app/lib/config/blogManagement";
import type { ManagedBlogPost, BlogPostStatus } from "@/app/lib/config/blogManagement";
import { DEFAULT_BLOG_CATEGORIES } from "@/app/lib/config/blog";
import {
  blocksToHtml, htmlToBlocks, defaultBlocks, newBlockId,
  type EmailBlock, type EmailBlockType,
} from "@/app/lib/utils/emailBuilder";

/**
 * Admin Blog Studio — draft / publish / archive / edit lifecycle with a
 * visual block builder (same model as Email Studio) for non-HTML admins.
 * Content is styled + sanitized server-side like the email configs.
 */
export default function AdminBlogPage() {
  const [posts, setPosts] = useState<ManagedBlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string>("");
  const [isNew, setIsNew] = useState(false);

  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [author, setAuthor] = useState<string>(BLOG_MANAGEMENT_CONFIG.defaultAuthor);
  const [category, setCategory] = useState<string>("updates");
  const [image, setImage] = useState<string>(BLOG_MANAGEMENT_CONFIG.defaultImage);
  const [status, setStatus] = useState<BlogPostStatus>(BLOG_MANAGEMENT_CONFIG.defaultStatus);
  const [blocks, setBlocks] = useState<EmailBlock[]>(defaultBlocks());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/blog");
      if (res.ok) {
        const data = await res.json();
        const list = (data.posts ?? []) as ManagedBlogPost[];
        setPosts(list);
        if (!selected && list.length > 0) setSelected(list[0].slug);
      }
    } catch {
      toastService.error("Failed to load blog posts");
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => { load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const cur = posts.find((p) => p.slug === selected);
    if (cur && !isNew) {
      setSlug(cur.slug); setTitle(cur.title); setDescription(cur.description);
      setAuthor(cur.author); setCategory(cur.category); setImage(cur.image);
      setStatus(cur.status); setBlocks(htmlToBlocks(cur.content));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, isNew]);

  const handleSave = async () => {
    const cleanSlug = normalizeSlug(slug);
    if (!cleanSlug) { toastService.error("Slug required (letters/numbers/dashes)"); return; }
    if (!title.trim()) { toastService.error("Title required"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/blog", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post: {
            slug: cleanSlug, title, description, author, category, image,
            date: new Date().toISOString().slice(0, 10),
            status, content: blocksToHtml(blocks),
          },
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? "Save failed");
      }
      toastService.success(`Post “${cleanSlug}” saved (${status})`);
      setIsNew(false); setSelected(cleanSlug);
      await load();
    } catch (e) {
      toastService.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleStatus = async (next: BlogPostStatus) => {
    if (!selected) return;
    try {
      const res = await fetch("/api/admin/blog", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slugs: [selected], status: next }),
      });
      if (!res.ok) throw new Error("Status change failed");
      toastService.success(`“${selected}” → ${next}`);
      setStatus(next);
      await load();
    } catch {
      toastService.error("Status change failed");
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    try {
      const res = await fetch(`/api/admin/blog?slug=${encodeURIComponent(selected)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toastService.success("Post deleted");
      setSelected(""); await load();
    } catch {
      toastService.error("Delete failed");
    }
  };

  const addBlock = (type: EmailBlockType) => {
    setBlocks((p) => [...p, { id: newBlockId(), type, text: type === "paragraph" ? "New paragraph" : type === "heading" ? "New heading" : undefined }]);
  };

  if (loading) return <div className="text-center py-12 text-text-muted">Loading blog studio…</div>;

  return (
    <div className="min-w-0 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[24px] sm:text-[28px] font-bold tracking-tight">Blog Studio</h1>
          <div className="text-sm text-text-secondary">Draft · publish · archive · visual builder (no HTML needed)</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setIsNew(true); setSlug(""); setTitle(""); setDescription(""); setStatus("draft"); setBlocks(defaultBlocks()); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 radius-md bg-primary text-white text-xs font-semibold border-none cursor-pointer">
            <Plus size={14} /> New post
          </button>
          <button onClick={load} className="inline-flex items-center gap-1.5 px-3 py-2 radius-md border border-border bg-bg-card text-xs font-medium cursor-pointer">
            <RefreshCw size={14} /> Reload
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {posts.map((p) => (
          <button key={p.slug} onClick={() => { setSelected(p.slug); setIsNew(false); }}
            className={`px-3 py-2 radius-md text-xs font-semibold border cursor-pointer ${selected === p.slug && !isNew ? "bg-primary text-white border-primary" : "bg-bg-card text-text-secondary border-border"} ${p.status !== "published" ? "opacity-60" : ""}`}>
            {p.slug}{p.status !== "published" ? ` (${p.status})` : ""}
          </button>
        ))}
        {posts.length === 0 && <span className="text-xs text-text-muted">No managed posts yet — filesystem seeds still serve publicly.</span>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-bg-card border border-border radius-lg p-4 flex flex-col gap-3">
          <h2 className="text-sm font-semibold">{isNew ? "New post" : `Edit: ${selected || "—"}`}</h2>
          {isNew && (
            <label className="text-xs flex flex-col gap-1">
              <span className="text-text-muted font-medium">Slug (auto-normalized)</span>
              <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="e.g. lagos-commute-guide"
                className="rounded-md border border-border bg-bg-base px-3 py-2 text-sm font-mono" />
            </label>
          )}
          <label className="text-xs flex flex-col gap-1">
            <span className="text-text-muted font-medium">Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-md border border-border bg-bg-base px-3 py-2 text-sm" />
          </label>
          <label className="text-xs flex flex-col gap-1">
            <span className="text-text-muted font-medium">Description</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-md border border-border bg-bg-base px-3 py-2 text-sm" />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <label className="text-xs flex flex-col gap-1">
              <span className="text-text-muted font-medium">Author</span>
              <input value={author} onChange={(e) => setAuthor(e.target.value)} className="rounded-md border border-border bg-bg-base px-3 py-2 text-sm" />
            </label>
            <label className="text-xs flex flex-col gap-1">
              <span className="text-text-muted font-medium">Category</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-md border border-border bg-bg-base px-2 py-2 text-sm">
                {DEFAULT_BLOG_CATEGORIES.filter((c) => c.id !== "all").map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </label>
            <label className="text-xs flex flex-col gap-1">
              <span className="text-text-muted font-medium">Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value as BlogPostStatus)} className="rounded-md border border-border bg-bg-base px-2 py-2 text-sm">
                {BLOG_MANAGEMENT_CONFIG.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
          <label className="text-xs flex flex-col gap-1">
            <span className="text-text-muted font-medium">Cover image URL</span>
            <input value={image} onChange={(e) => setImage(e.target.value)} className="rounded-md border border-border bg-bg-base px-3 py-2 text-sm font-mono" />
          </label>

          <div className="flex gap-1 flex-wrap items-center text-xs">
            <span className="text-text-muted">Add block:</span>
            {(["heading", "paragraph", "image", "list", "link", "button", "divider"] as EmailBlockType[]).map((b) => (
              <button key={b} onClick={() => addBlock(b)} className="px-2 py-1 radius-sm bg-bg-elevated cursor-pointer border border-border font-medium">{b}</button>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            {blocks.map((b) => (
              <div key={b.id} className="rounded-md border border-border bg-bg-base p-2.5 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-text-muted">{b.type}</span>
                  <button onClick={() => setBlocks((p) => p.filter((x) => x.id !== b.id))}
                    className="ml-auto p-1 cursor-pointer bg-transparent border-none text-text-muted hover:text-error"><Trash2 size={13} /></button>
                </div>
                {(b.type === "paragraph" || b.type === "heading") && (
                  <textarea value={b.text ?? ""} rows={3}
                    onChange={(e) => setBlocks((p) => p.map((x) => (x.id === b.id ? { ...x, text: e.target.value } : x)))}
                    className="rounded border border-border bg-bg-card p-2 text-sm w-full" />
                )}
                {(b.type === "button" || b.type === "link") && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <input value={b.text ?? ""} placeholder="Label"
                      onChange={(e) => setBlocks((p) => p.map((x) => (x.id === b.id ? { ...x, text: e.target.value } : x)))}
                      className="rounded border border-border bg-bg-card px-2 py-1.5 text-sm" />
                    <input value={b.url ?? ""} placeholder="URL"
                      onChange={(e) => setBlocks((p) => p.map((x) => (x.id === b.id ? { ...x, url: e.target.value } : x)))}
                      className="rounded border border-border bg-bg-card px-2 py-1.5 text-sm font-mono" />
                  </div>
                )}
                {b.type === "image" && (
                  <input value={b.src ?? b.url ?? ""} placeholder="Image URL"
                    onChange={(e) => setBlocks((p) => p.map((x) => (x.id === b.id ? { ...x, src: e.target.value, url: e.target.value } : x)))}
                    className="rounded border border-border bg-bg-card px-2 py-1.5 text-sm font-mono" />
                )}
                {b.type === "list" && (
                  <textarea value={(b.items ?? []).join("\n")} rows={3} placeholder="One item per line"
                    onChange={(e) => setBlocks((p) => p.map((x) => (x.id === b.id ? { ...x, items: e.target.value.split("\n") } : x)))}
                    className="rounded border border-border bg-bg-card p-2 text-sm w-full" />
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2 flex-wrap">
            <button onClick={handleSave} disabled={saving}
              className="px-3 py-2 radius-md bg-primary text-white text-xs font-semibold border-none cursor-pointer disabled:opacity-50">
              {saving ? "Saving…" : isNew ? "Create post" : "Save changes"}
            </button>
            {!isNew && (["draft", "published", "archived"] as BlogPostStatus[]).filter((s) => s !== status).map((s) => (
              <button key={s} onClick={() => handleStatus(s)}
                className="px-3 py-2 radius-md border border-border text-xs font-semibold cursor-pointer">
                {s === "published" ? "Publish" : s === "archived" ? "Archive" : "To draft"}
              </button>
            ))}
            {!isNew && (
              <button onClick={handleDelete} className="inline-flex items-center gap-1 px-3 py-2 radius-md bg-error text-error-text text-xs font-semibold border-none cursor-pointer">
                <Trash2 size={13} /> Delete
              </button>
            )}
            {isNew && <button onClick={() => setIsNew(false)} className="px-3 py-2 radius-md border border-border text-xs cursor-pointer">Cancel</button>}
          </div>
        </section>

        <section className="bg-bg-card border border-border radius-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Eye size={14} className="text-text-muted" />
            <span className="text-sm font-semibold">Live preview (sanitized, styled)</span>
          </div>
          <div className="max-h-[560px] overflow-auto p-4">
            <h3 className="text-lg font-bold mb-2">{title || "Untitled"}</h3>
            <div
              className="prose prose-sm max-w-none prose-headings:text-text-primary prose-p:text-text-secondary prose-a:text-primary"
              dangerouslySetInnerHTML={{ __html: blocksToHtml(blocks) }}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
